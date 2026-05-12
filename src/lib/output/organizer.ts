/**
 * Organizer ── 把零散的 FHIR resource 分類、去重、生成統計報告。
 *
 * 給診所場景用：上傳幾百個檔之後，輸出 zip 內結構：
 *
 *   output.zip/
 *   ├── README.md                          (統計總覽)
 *   ├── bundle-all.json                    (全部 resource 一個 Bundle)
 *   ├── by-resource-type/
 *   │   ├── patients.json                  (所有 Patient resource Bundle)
 *   │   ├── encounters.json
 *   │   └── observations.json
 *   ├── by-patient/
 *   │   ├── patient-P001.json              (P001 個人 Bundle，含他所有 Encounter/Observation)
 *   │   ├── patient-P002.json
 *   │   └── ...
 *   ├── errors.csv                         (轉換失敗列 + 原因，給診所修 source data)
 *   └── unmatched.csv                      (找不到 mapping 範本的 dataset 清單)
 */
import type { FhirAnyResource, FhirBundle, FhirPatient, FhirEncounter, FhirObservation } from '../fhir/types';
import type { DatasetSummary } from '../../workers/converter.worker';
import { toCollectionBundle, toPrettyJson } from './bundle';

export interface FileOutcome {
  fileName: string;
  status: 'done' | 'error';
  resources: FhirAnyResource[];
  datasets: DatasetSummary[];
  error?: string;
}

export interface OrganizedReport {
  totalFiles: number;
  doneFiles: number;
  errorFiles: number;
  totalResources: number;
  resourcesByType: Record<string, number>;
  uniquePatients: number;
  duplicatePatientIds: { id: string; count: number }[];
  totalErrorRows: number;
  totalUnmatchedDatasets: number;
  processingTimeMs: number;
}

interface OrganizedOutput {
  byType: Map<string, FhirAnyResource[]>;
  byPatient: Map<string, FhirAnyResource[]>;
  errors: { file: string; sourceRef: string; reason: string }[];
  unmatched: { file: string; dataset: string }[];
  report: OrganizedReport;
}

function getPatientRef(resource: FhirAnyResource): string | null {
  // 從 resource 抓出對應的 Patient id
  if (resource.resourceType === 'Patient') return resource.id ?? null;
  const subject = (resource as FhirEncounter | FhirObservation).subject;
  if (subject?.reference) return subject.reference.replace(/^Patient\//, '');
  return null;
}

export function organize(files: FileOutcome[], processingTimeMs: number): OrganizedOutput {
  const byType = new Map<string, FhirAnyResource[]>();
  const byPatient = new Map<string, FhirAnyResource[]>();
  const errors: OrganizedOutput['errors'] = [];
  const unmatched: OrganizedOutput['unmatched'] = [];
  const patientIdCounts = new Map<string, number>();

  let totalResources = 0;
  let doneFiles = 0;
  let errorFiles = 0;
  let totalErrorRows = 0;
  let totalUnmatchedDatasets = 0;

  for (const file of files) {
    if (file.status === 'error') {
      errorFiles += 1;
      errors.push({ file: file.fileName, sourceRef: '<file>', reason: file.error ?? 'unknown' });
      continue;
    }

    doneFiles += 1;

    // Bucket by type / by patient
    for (const res of file.resources) {
      totalResources += 1;

      // by-type
      const typeKey = res.resourceType;
      if (!byType.has(typeKey)) byType.set(typeKey, []);
      byType.get(typeKey)!.push(res);

      // by-patient
      const pid = getPatientRef(res);
      if (pid) {
        if (!byPatient.has(pid)) byPatient.set(pid, []);
        byPatient.get(pid)!.push(res);
      }

      // Count Patient identifier dups
      if (res.resourceType === 'Patient') {
        const id = (res as FhirPatient).id ?? '<no-id>';
        patientIdCounts.set(id, (patientIdCounts.get(id) ?? 0) + 1);
      }
    }

    // Collect row errors + unmatched datasets
    for (const ds of file.datasets) {
      if (!ds.matchedTemplateId) {
        unmatched.push({ file: file.fileName, dataset: ds.sourceDescription });
        totalUnmatchedDatasets += 1;
      }
      for (const er of ds.errorRows) {
        errors.push({ file: file.fileName, sourceRef: er.sourceRef, reason: er.reason });
        totalErrorRows += 1;
      }
    }
  }

  const resourcesByType: Record<string, number> = {};
  for (const [k, v] of byType.entries()) resourcesByType[k] = v.length;

  const duplicatePatientIds = Array.from(patientIdCounts.entries())
    .filter(([, c]) => c > 1)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);

  const report: OrganizedReport = {
    totalFiles: files.length,
    doneFiles,
    errorFiles,
    totalResources,
    resourcesByType,
    uniquePatients: byPatient.size,
    duplicatePatientIds,
    totalErrorRows,
    totalUnmatchedDatasets,
    processingTimeMs,
  };

  return { byType, byPatient, errors, unmatched, report };
}

// === Output generators ===

function safeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
}

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function generateReadme(report: OrganizedReport, locale: 'zh' | 'en' = 'zh'): string {
  const elapsedSec = (report.processingTimeMs / 1000).toFixed(1);
  const ts = new Date().toISOString();

  if (locale === 'en') {
    let md = `# clinconvert export — Organized FHIR R4 output\n\n`;
    md += `Generated: ${ts}\n`;
    md += `Processing time: ${elapsedSec}s\n\n`;
    md += `## Summary\n\n`;
    md += `- **Input files**: ${report.totalFiles} (done: ${report.doneFiles}, failed: ${report.errorFiles})\n`;
    md += `- **Total FHIR resources**: ${report.totalResources}\n`;
    md += `- **Unique patients**: ${report.uniquePatients}\n`;
    md += `- **Row conversion errors**: ${report.totalErrorRows}\n`;
    md += `- **Unmatched datasets (no template)**: ${report.totalUnmatchedDatasets}\n\n`;
    md += `## Resources by type\n\n`;
    for (const [type, count] of Object.entries(report.resourcesByType)) {
      md += `- **${type}**: ${count}\n`;
    }
    md += `\n## Folder structure\n\n`;
    md += '```\n';
    md += 'bundle-all.json                Single Bundle (collection) with everything\n';
    md += 'by-resource-type/              One Bundle per FHIR resource type\n';
    md += 'by-patient/                    One Bundle per patient (their Encounters + Observations)\n';
    md += 'errors.csv                     Rows that failed to convert (with reason)\n';
    md += 'unmatched.csv                  Datasets where no template matched\n';
    md += '```\n\n';
    if (report.duplicatePatientIds.length > 0) {
      md += `## ⚠️ Duplicate Patient IDs detected\n\n`;
      md += `These patient identifiers appear more than once. If two records share an ID, the data may need de-duplication / MPI reconciliation before use:\n\n`;
      for (const { id, count } of report.duplicatePatientIds.slice(0, 30)) {
        md += `- \`${id}\` × ${count}\n`;
      }
      if (report.duplicatePatientIds.length > 30) {
        md += `- ... and ${report.duplicatePatientIds.length - 30} more\n`;
      }
      md += `\n`;
    }
    md += `## Validation reminder\n\n`;
    md += `This output is structurally formed but **not validated against FHIR R4 spec by HAPI FHIR validator**.\n`;
    md += `Before production use, validate via:\n`;
    md += `- [HAPI FHIR validator](https://hapifhir.io/hapi-fhir/docs/validation/introduction.html)\n`;
    md += `- [Inferno (ONC-HIT)](https://inferno.healthit.gov/)\n`;
    md += `- Or post a Transaction Bundle to the HAPI public test server (http://hapi.fhir.org/) for round-trip check.\n\n`;
    md += `---\n\n`;
    md += `Generated by [clinconvert](https://clinconvert.pages.dev/) · Chia-Yu Chiang ([jiayuselfweb.pages.dev](https://jiayuselfweb.pages.dev))\n`;
    return md;
  }

  // zh
  let md = `# clinconvert 匯出包 — 已整理的 FHIR R4 輸出\n\n`;
  md += `產生時間：${ts}\n`;
  md += `處理時間：${elapsedSec} 秒\n\n`;
  md += `## 總覽\n\n`;
  md += `- **輸入檔案**：${report.totalFiles} 個（完成 ${report.doneFiles}、失敗 ${report.errorFiles}）\n`;
  md += `- **產出 FHIR resource**：${report.totalResources} 個\n`;
  md += `- **不重複病人數**:${report.uniquePatients}\n`;
  md += `- **列轉換錯誤**：${report.totalErrorRows} 列\n`;
  md += `- **未匹配範本的 dataset**：${report.totalUnmatchedDatasets} 個\n\n`;
  md += `## Resource 數量分布\n\n`;
  for (const [type, count] of Object.entries(report.resourcesByType)) {
    md += `- **${type}**：${count} 個\n`;
  }
  md += `\n## 資料夾結構\n\n`;
  md += '```\n';
  md += 'bundle-all.json                 全部 resource 合併的單一 Bundle (collection)\n';
  md += 'by-resource-type/               依 FHIR resource type 分組（每個 type 一個 Bundle）\n';
  md += 'by-patient/                     依病人分組（每個病人一個 Bundle，含他所有就診/檢驗）\n';
  md += 'errors.csv                      轉換失敗的列（含原因）\n';
  md += 'unmatched.csv                   找不到對應範本的 dataset\n';
  md += '```\n\n';
  if (report.duplicatePatientIds.length > 0) {
    md += `## ⚠️ 偵測到重複的 Patient ID\n\n`;
    md += `以下身分證 / 病歷號出現多次。如果兩筆共用同 ID，請評估是否要去重或做 MPI（Master Patient Index）reconciliation：\n\n`;
    for (const { id, count } of report.duplicatePatientIds.slice(0, 30)) {
      md += `- \`${id}\` × ${count}\n`;
    }
    if (report.duplicatePatientIds.length > 30) {
      md += `- ... 還有 ${report.duplicatePatientIds.length - 30} 筆\n`;
    }
    md += `\n`;
  }
  md += `## 驗證提醒\n\n`;
  md += `本工具輸出**結構正確但未經 HAPI FHIR validator 驗證**。正式使用前請透過：\n`;
  md += `- [HAPI FHIR validator](https://hapifhir.io/hapi-fhir/docs/validation/introduction.html)\n`;
  md += `- [Inferno (ONC-HIT)](https://inferno.healthit.gov/)\n`;
  md += `- 或 POST Transaction Bundle 到 HAPI public test server (http://hapi.fhir.org/) 做 round-trip 驗證\n\n`;
  md += `---\n\n`;
  md += `由 [clinconvert](https://clinconvert.pages.dev/) 產出 · 江家寓 ([jiayuselfweb.pages.dev](https://jiayuselfweb.pages.dev))\n`;
  return md;
}

export function generateErrorsCsv(errors: OrganizedOutput['errors']): string {
  let csv = 'file,source_ref,reason\n';
  for (const e of errors) {
    csv += `${csvEscape(e.file)},${csvEscape(e.sourceRef)},${csvEscape(e.reason)}\n`;
  }
  return csv;
}

export function generateUnmatchedCsv(unmatched: OrganizedOutput['unmatched']): string {
  let csv = 'file,dataset\n';
  for (const u of unmatched) {
    csv += `${csvEscape(u.file)},${csvEscape(u.dataset)}\n`;
  }
  return csv;
}

/**
 * 把組織好的 output 打包成 zip Blob。
 * 結構見本檔開頭註解。
 */
export async function buildOrganizedZip(
  output: OrganizedOutput,
  locale: 'zh' | 'en' = 'zh'
): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // README.md
  zip.file('README.md', generateReadme(output.report, locale));

  // bundle-all.json
  const allResources: FhirAnyResource[] = [];
  for (const arr of output.byType.values()) allResources.push(...arr);
  if (allResources.length > 0) {
    zip.file('bundle-all.json', toPrettyJson(toCollectionBundle(allResources)));
  }

  // by-resource-type/
  const typeFolder = zip.folder('by-resource-type');
  if (typeFolder) {
    for (const [type, arr] of output.byType.entries()) {
      typeFolder.file(
        `${type.toLowerCase()}s.json`,
        toPrettyJson(toCollectionBundle(arr))
      );
    }
  }

  // by-patient/
  if (output.byPatient.size > 0) {
    const patientFolder = zip.folder('by-patient');
    if (patientFolder) {
      for (const [pid, arr] of output.byPatient.entries()) {
        patientFolder.file(
          `patient-${safeFilename(pid)}.json`,
          toPrettyJson(toCollectionBundle(arr))
        );
      }
    }
  }

  // errors.csv
  if (output.errors.length > 0) {
    zip.file('errors.csv', generateErrorsCsv(output.errors));
  }

  // unmatched.csv
  if (output.unmatched.length > 0) {
    zip.file('unmatched.csv', generateUnmatchedCsv(output.unmatched));
  }

  return zip.generateAsync({ type: 'blob' });
}

/** 顯示總結用的人類可讀字串（給 UI） */
export function formatReport(report: OrganizedReport, locale: 'zh' | 'en' = 'zh'): string {
  if (locale === 'en') {
    const parts = [
      `${report.totalResources} resources`,
      `${report.uniquePatients} patients`,
    ];
    if (report.totalErrorRows > 0) parts.push(`${report.totalErrorRows} row errors`);
    if (report.duplicatePatientIds.length > 0) parts.push(`${report.duplicatePatientIds.length} duplicate IDs`);
    return parts.join(' · ');
  }
  const parts = [
    `${report.totalResources} 個 resource`,
    `${report.uniquePatients} 位病人`,
  ];
  if (report.totalErrorRows > 0) parts.push(`${report.totalErrorRows} 列錯誤`);
  if (report.duplicatePatientIds.length > 0) parts.push(`${report.duplicatePatientIds.length} 個重複 ID`);
  return parts.join(' · ');
}

/** 在 Bundle (collection) 模式下：依 patient 分 chunk 進 single Bundle（給單檔但邏輯 grouping）*/
export function toPatientCentricBundle(byPatient: Map<string, FhirAnyResource[]>): FhirBundle {
  const allResources: FhirAnyResource[] = [];
  // 依 patient id 排序，輸出時就同 patient 的 resource 連在一起
  const sorted = Array.from(byPatient.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [, arr] of sorted) {
    // Patient resource 先、Encounter 次、Observation 之後
    const order: Record<string, number> = { Patient: 0, Encounter: 1, Observation: 2 };
    const sortedByType = [...arr].sort(
      (a, b) => (order[a.resourceType] ?? 99) - (order[b.resourceType] ?? 99)
    );
    allResources.push(...sortedByType);
  }
  return toCollectionBundle(allResources);
}
