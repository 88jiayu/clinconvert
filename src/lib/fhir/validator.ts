/**
 * FHIR R4 Structural Validator
 *
 * 為什麼自己寫不用 HAPI:
 *   - HAPI FHIR validator 是 Java 寫的，瀏覽器跑不動（無好的 WASM port）
 *   - 我們的 use case 是「結構性檢查」── 必填欄位、value set、cardinality、reference 完整性
 *   - HL7 official validator runs server-side、需要連網
 *
 * 本檔做：
 *   - 每個 resource type 的 structural validation
 *   - Bundle 整體的 reference integrity (e.g. Encounter.subject -> Patient/X 必須在 bundle 內)
 *
 * 給診所實用意義：
 *   - 直接告訴使用者「身分證沒填」「日期格式錯」「Encounter 指到不存在的 Patient」
 *   - 不需把資料丟到 server 等回應
 *
 * 對接學界:
 *   - 之後可加 「POST 到 HAPI public test server」做 server-side 二次驗證
 *   - https://hapi.fhir.org/baseR4/$validate
 */
import type {
  FhirPatient,
  FhirEncounter,
  FhirObservation,
  FhirAnyResource,
  FhirBundle,
} from './types';

export type IssueSeverity = 'error' | 'warning' | 'information';

export interface ValidationIssue {
  severity: IssueSeverity;
  path: string;      // e.g. "Patient[0].birthDate"
  message: string;
  resourceType?: string;
  resourceId?: string;
}

// === Helpers ===

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

const PATIENT_GENDERS = new Set(['male', 'female', 'other', 'unknown']);
const ENCOUNTER_STATUSES = new Set([
  'planned', 'arrived', 'triaged', 'in-progress', 'finished', 'cancelled',
  'onleave', 'entered-in-error', 'unknown',
]);
const OBSERVATION_STATUSES = new Set([
  'registered', 'preliminary', 'final', 'amended', 'corrected',
  'cancelled', 'entered-in-error', 'unknown',
]);

function issue(
  severity: IssueSeverity,
  path: string,
  message: string,
  resource?: FhirAnyResource
): ValidationIssue {
  return {
    severity,
    path,
    message,
    resourceType: resource?.resourceType,
    resourceId: resource?.id,
  };
}

// === Per-resource validators ===

export function validatePatient(p: FhirPatient): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const tag = `Patient/${p.id ?? '<no-id>'}`;

  if (!p.id) {
    issues.push(issue('warning', `${tag}.id`, 'Patient 缺少 id（建議補上以供跨 resource 引用）', p));
  }
  if (!p.identifier || p.identifier.length === 0) {
    issues.push(issue('warning', `${tag}.identifier`, 'Patient 沒有 identifier（身分證 / 病歷號）', p));
  }
  if (!p.name || p.name.length === 0) {
    issues.push(issue('warning', `${tag}.name`, 'Patient 缺少姓名', p));
  }
  if (p.gender && !PATIENT_GENDERS.has(p.gender)) {
    issues.push(
      issue('error', `${tag}.gender`, `gender 值「${p.gender}」不在允許範圍（male/female/other/unknown）`, p)
    );
  }
  if (p.birthDate && !ISO_DATE_RE.test(p.birthDate)) {
    issues.push(issue('error', `${tag}.birthDate`, `birthDate「${p.birthDate}」不符 ISO 8601 (YYYY-MM-DD)`, p));
  }
  if (p.telecom) {
    p.telecom.forEach((tc, i) => {
      if (tc.system === 'email' && tc.value && !/@/.test(tc.value)) {
        issues.push(issue('warning', `${tag}.telecom[${i}]`, `Email 格式可疑：${tc.value}`, p));
      }
    });
  }
  return issues;
}

export function validateEncounter(e: FhirEncounter): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const tag = `Encounter/${e.id ?? '<no-id>'}`;

  if (!e.id) issues.push(issue('warning', `${tag}.id`, 'Encounter 缺少 id', e));
  if (!e.status) {
    issues.push(issue('error', `${tag}.status`, '必填欄位 status 缺失', e));
  } else if (!ENCOUNTER_STATUSES.has(e.status)) {
    issues.push(issue('error', `${tag}.status`, `status 值「${e.status}」不在允許範圍`, e));
  }
  if (!e.class) {
    issues.push(issue('error', `${tag}.class`, '必填欄位 class 缺失', e));
  } else if (!e.class.code) {
    issues.push(issue('error', `${tag}.class.code`, 'class.code 必填', e));
  }
  if (!e.subject || !e.subject.reference) {
    issues.push(issue('error', `${tag}.subject`, 'subject (Patient reference) 必填', e));
  }
  if (e.period) {
    if (e.period.start && !ISO_DATETIME_RE.test(e.period.start)) {
      issues.push(issue('error', `${tag}.period.start`, `period.start「${e.period.start}」不符 ISO 8601`, e));
    }
    if (e.period.end && !ISO_DATETIME_RE.test(e.period.end)) {
      issues.push(issue('error', `${tag}.period.end`, `period.end「${e.period.end}」不符 ISO 8601`, e));
    }
    if (e.period.start && e.period.end && e.period.start > e.period.end) {
      issues.push(issue('warning', `${tag}.period`, 'period.start 晚於 period.end', e));
    }
  }
  return issues;
}

export function validateObservation(o: FhirObservation): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const tag = `Observation/${o.id ?? '<no-id>'}`;

  if (!o.id) issues.push(issue('warning', `${tag}.id`, 'Observation 缺少 id', o));
  if (!o.status) {
    issues.push(issue('error', `${tag}.status`, '必填欄位 status 缺失', o));
  } else if (!OBSERVATION_STATUSES.has(o.status)) {
    issues.push(issue('error', `${tag}.status`, `status 值「${o.status}」不在允許範圍`, o));
  }
  if (!o.code || (!o.code.coding && !o.code.text)) {
    issues.push(issue('error', `${tag}.code`, 'code 必填（至少要有 coding 或 text）', o));
  }
  if (o.code?.coding) {
    o.code.coding.forEach((c, i) => {
      if (!c.code) {
        issues.push(issue('error', `${tag}.code.coding[${i}].code`, 'coding.code 必填', o));
      }
      if (c.system === 'http://loinc.org' && c.code && !/^\d+-\d$/.test(c.code)) {
        issues.push(
          issue('warning', `${tag}.code.coding[${i}].code`, `LOINC 編碼「${c.code}」格式可疑（標準應為 nnnn-n）`, o)
        );
      }
    });
  }
  if (!o.subject || !o.subject.reference) {
    issues.push(issue('error', `${tag}.subject`, 'subject (Patient reference) 必填', o));
  }
  if (o.effectiveDateTime && !ISO_DATETIME_RE.test(o.effectiveDateTime)) {
    issues.push(
      issue('error', `${tag}.effectiveDateTime`, `effectiveDateTime「${o.effectiveDateTime}」不符 ISO 8601`, o)
    );
  }
  if (o.valueQuantity && (typeof o.valueQuantity.value !== 'number' || isNaN(o.valueQuantity.value))) {
    issues.push(
      issue('error', `${tag}.valueQuantity.value`, 'valueQuantity.value 必須為數值', o)
    );
  }
  return issues;
}

// === Dispatcher ===

export function validateResource(r: FhirAnyResource): ValidationIssue[] {
  switch (r.resourceType) {
    case 'Patient': return validatePatient(r);
    case 'Encounter': return validateEncounter(r);
    case 'Observation': return validateObservation(r);
    default:
      return [];
  }
}

// === Bundle-level (reference integrity) ===

export function validateBundle(bundle: FhirBundle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 收集所有 resource id by type
  const idsByType = new Map<string, Set<string>>();
  for (const entry of bundle.entry) {
    const r = entry.resource;
    if (!r.id) continue;
    if (!idsByType.has(r.resourceType)) idsByType.set(r.resourceType, new Set());
    idsByType.get(r.resourceType)!.add(r.id);
  }

  // 個別 resource validation
  for (const entry of bundle.entry) {
    issues.push(...validateResource(entry.resource));
  }

  // Reference integrity（Encounter.subject、Observation.subject、Observation.encounter）
  for (const entry of bundle.entry) {
    const r = entry.resource;
    const subjectRef =
      r.resourceType === 'Encounter' || r.resourceType === 'Observation'
        ? r.subject?.reference
        : undefined;
    if (subjectRef) {
      const m = subjectRef.match(/^([A-Z]\w+)\/(.+)$/);
      if (m) {
        const [, refType, refId] = m;
        if (!idsByType.get(refType)?.has(refId)) {
          issues.push({
            severity: 'warning',
            path: `${r.resourceType}/${r.id ?? '<no-id>'}.subject`,
            message: `Reference「${subjectRef}」指到的 ${refType} 不在本 Bundle 內（dangling reference，正式提交前需確認該 ${refType} 已存在 FHIR server）`,
            resourceType: r.resourceType,
            resourceId: r.id,
          });
        }
      }
    }

    if (r.resourceType === 'Observation' && r.encounter?.reference) {
      const m = r.encounter.reference.match(/^Encounter\/(.+)$/);
      if (m) {
        const [, refId] = m;
        if (!idsByType.get('Encounter')?.has(refId)) {
          issues.push({
            severity: 'warning',
            path: `Observation/${r.id ?? '<no-id>'}.encounter`,
            message: `Reference「${r.encounter.reference}」指到的 Encounter 不在本 Bundle 內`,
            resourceType: r.resourceType,
            resourceId: r.id,
          });
        }
      }
    }
  }

  return issues;
}

// === Summary ===

export interface ValidationSummary {
  total: number;
  errors: number;
  warnings: number;
  informations: number;
  byResource: Record<string, { errors: number; warnings: number }>;
  topIssues: ValidationIssue[]; // 前 N 個最重要的
}

export function summarize(issues: ValidationIssue[], topN = 50): ValidationSummary {
  const byResource: Record<string, { errors: number; warnings: number }> = {};
  let errors = 0;
  let warnings = 0;
  let informations = 0;
  for (const i of issues) {
    if (i.severity === 'error') errors += 1;
    else if (i.severity === 'warning') warnings += 1;
    else informations += 1;
    const type = i.resourceType ?? '<unknown>';
    if (!byResource[type]) byResource[type] = { errors: 0, warnings: 0 };
    if (i.severity === 'error') byResource[type].errors += 1;
    else if (i.severity === 'warning') byResource[type].warnings += 1;
  }
  // 排序：error 在前、warning 次、info 最後
  const sorted = [...issues].sort((a, b) => {
    const order: Record<IssueSeverity, number> = { error: 0, warning: 1, information: 2 };
    return order[a.severity] - order[b.severity];
  });
  return {
    total: issues.length,
    errors,
    warnings,
    informations,
    byResource,
    topIssues: sorted.slice(0, topN),
  };
}
