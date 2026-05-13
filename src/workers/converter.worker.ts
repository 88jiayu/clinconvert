/**
 * Web Worker：在背景執行緒跑 parsing + FHIR building
 *
 * 為什麼用 worker：
 *   - 主執行緒不阻塞 UI（用戶可繼續操作）
 *   - 可並行：多個 worker 同時處理不同檔案
 *   - 大檔（10K+ rows）不會卡住整個 tab
 *
 * 訊息協定：
 *   主執行緒 → worker:
 *     { type: 'convert', jobId, file: ArrayBuffer, fileName, templates: MappingTemplate[] }
 *
 *   worker → 主執行緒:
 *     { type: 'progress', jobId, phase, current, total }
 *     { type: 'success', jobId, fileName, resources: FhirAnyResource[], datasets: Summary[] }
 *     { type: 'error', jobId, fileName, message }
 */
import { parseXlsx } from '../lib/adapters/xlsx';
import { parseJson } from '../lib/adapters/json';
import { suggestTemplate, ALL_TEMPLATES, type MappingTemplate } from '../lib/mapping/templates';
import { buildResource } from '../lib/fhir/builders';
import { validateResource, summarize, type ValidationIssue, type ValidationSummary } from '../lib/fhir/validator';
import type { FhirAnyResource } from '../lib/fhir/types';
import type { NormalizedDataset } from '../lib/core/internal-model';

export interface ConvertJob {
  type: 'convert';
  jobId: string;
  fileName: string;
  buffer: ArrayBuffer;
  isJson: boolean;
}

export interface ConvertProgress {
  type: 'progress';
  jobId: string;
  phase: 'parse' | 'build';
  current: number;
  total: number;
}

export interface DatasetSummary {
  sourceDescription: string;
  rowCount: number;
  columnCount: number;
  matchedTemplateId: string | null;
  resourceType: string | null;
  builtCount: number;
  errorRows: { sourceRef: string; reason: string }[];
}

export interface ConvertSuccess {
  type: 'success';
  jobId: string;
  fileName: string;
  resources: FhirAnyResource[];
  datasets: DatasetSummary[];
  validation: ValidationSummary;
  validationIssues: ValidationIssue[];
}

export interface ConvertError {
  type: 'error';
  jobId: string;
  fileName: string;
  message: string;
}

export type WorkerMessage = ConvertProgress | ConvertSuccess | ConvertError;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<ConvertJob>) => {
  const { jobId, fileName, buffer, isJson } = e.data;

  try {
    // === Phase 1: parse ===
    ctx.postMessage({ type: 'progress', jobId, phase: 'parse', current: 0, total: 1 } as ConvertProgress);

    let datasets: NormalizedDataset[];
    if (isJson) {
      const text = new TextDecoder().decode(buffer);
      datasets = await parseJson(text, { sourceName: fileName });
    } else {
      datasets = await parseXlsx(buffer);
    }

    ctx.postMessage({ type: 'progress', jobId, phase: 'parse', current: 1, total: 1 } as ConvertProgress);

    // === Phase 2: build resources (with auto template matching) ===
    const allResources: FhirAnyResource[] = [];
    const summaries: DatasetSummary[] = [];
    const totalRows = datasets.reduce((s, d) => s + d.records.length, 0);
    let processed = 0;

    for (const dataset of datasets) {
      const template = suggestTemplate(dataset.sourceDescription);
      const summary: DatasetSummary = {
        sourceDescription: dataset.sourceDescription,
        rowCount: dataset.records.length,
        columnCount: dataset.columns.length,
        matchedTemplateId: template?.id ?? null,
        resourceType: template?.resourceType ?? null,
        builtCount: 0,
        errorRows: [],
      };

      if (template) {
        for (const record of dataset.records) {
          try {
            const res = buildResource(record, template);
            allResources.push(res);
            summary.builtCount += 1;
          } catch (err) {
            summary.errorRows.push({
              sourceRef: record.sourceRef,
              reason: err instanceof Error ? err.message : String(err),
            });
          }
          processed += 1;
          if (processed % 200 === 0) {
            ctx.postMessage({
              type: 'progress',
              jobId,
              phase: 'build',
              current: processed,
              total: totalRows,
            } as ConvertProgress);
          }
        }
      }
      summaries.push(summary);
    }

    ctx.postMessage({
      type: 'progress',
      jobId,
      phase: 'build',
      current: totalRows,
      total: totalRows,
    } as ConvertProgress);

    // === Phase 3: validate ===
    const allIssues: ValidationIssue[] = [];
    for (const r of allResources) {
      allIssues.push(...validateResource(r));
    }
    const validationSummary = summarize(allIssues, 100);

    // === Done ===
    ctx.postMessage({
      type: 'success',
      jobId,
      fileName,
      resources: allResources,
      datasets: summaries,
      validation: validationSummary,
      validationIssues: allIssues,
    } as ConvertSuccess);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ type: 'error', jobId, fileName, message } as ConvertError);
  }
};

// 讓 TypeScript 知道這是 module
export {};
// 提示 ALL_TEMPLATES 不要被 tree-shake（worker 可能間接需要）
void ALL_TEMPLATES;
type _Keep = MappingTemplate;
