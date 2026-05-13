/**
 * Custom Mapping Designer ── localStorage 內建立 / 編輯 / 匯出 / 匯入自家範本。
 *
 * 用途：診所欄位名稱跟內建範本不一樣（例如 「身分證」「健保號」 → Patient.identifier），
 * 使用者可以自己定義範本，本工具不會把人鎖在預設範本內。
 */
import type { MappingTemplate, FhirField, FieldMapping } from './templates';
import { ALL_TEMPLATES } from './templates';

const STORAGE_KEY = 'clinconvert.custom-templates.v1';

export interface CustomTemplateBundle {
  version: 1;
  exportedAt: string;
  templates: MappingTemplate[];
}

export function loadCustomTemplates(): MappingTemplate[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export function saveCustomTemplate(template: MappingTemplate): void {
  if (typeof localStorage === 'undefined') return;
  const existing = loadCustomTemplates();
  const idx = existing.findIndex((t) => t.id === template.id);
  if (idx >= 0) existing[idx] = template;
  else existing.push(template);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function deleteCustomTemplate(id: string): void {
  if (typeof localStorage === 'undefined') return;
  const existing = loadCustomTemplates().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function exportCustomBundle(): string {
  const bundle: CustomTemplateBundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    templates: loadCustomTemplates(),
  };
  return JSON.stringify(bundle, null, 2);
}

export function importCustomBundle(json: string): { added: number; replaced: number } {
  const parsed = JSON.parse(json) as CustomTemplateBundle;
  if (parsed.version !== 1 || !Array.isArray(parsed.templates)) {
    throw new Error('不支援的 bundle 版本或格式錯誤');
  }
  const existing = loadCustomTemplates();
  let added = 0;
  let replaced = 0;
  for (const t of parsed.templates) {
    const idx = existing.findIndex((e) => e.id === t.id);
    if (idx >= 0) {
      existing[idx] = t;
      replaced += 1;
    } else {
      existing.push(t);
      added += 1;
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  return { added, replaced };
}

export function allTemplates(): MappingTemplate[] {
  return [...ALL_TEMPLATES, ...loadCustomTemplates()];
}

export function createBlankTemplate(
  resourceType: 'Patient' | 'Encounter' | 'Observation',
  name: string
): MappingTemplate {
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    name,
    description: `自訂範本：${name}`,
    resourceType,
    fields: [],
  };
}

/** Patient 的所有可映射 FHIR fields */
export const FIELD_OPTIONS_PATIENT: FhirField[] = [
  'Patient.identifier',
  'Patient.name.family',
  'Patient.name.given',
  'Patient.gender',
  'Patient.birthDate',
  'Patient.telecom.phone',
  'Patient.telecom.email',
  'Patient.address.city',
];
export const FIELD_OPTIONS_ENCOUNTER: FhirField[] = [
  'Encounter.identifier',
  'Encounter.status',
  'Encounter.class.code',
  'Encounter.period.start',
  'Encounter.period.end',
  'Encounter.subject',
];
export const FIELD_OPTIONS_OBSERVATION: FhirField[] = [
  'Observation.identifier',
  'Observation.code.coding.code',
  'Observation.code.text',
  'Observation.valueQuantity.value',
  'Observation.valueQuantity.unit',
  'Observation.effectiveDateTime',
  'Observation.subject',
];

export function fieldOptionsFor(
  resourceType: 'Patient' | 'Encounter' | 'Observation'
): FhirField[] {
  if (resourceType === 'Patient') return FIELD_OPTIONS_PATIENT;
  if (resourceType === 'Encounter') return FIELD_OPTIONS_ENCOUNTER;
  return FIELD_OPTIONS_OBSERVATION;
}

export type { FieldMapping };
