/**
 * Mapping Templates — 預設範本，讓使用者一鍵套用。
 *
 * 一個 template 描述「source column → FHIR field path」的對應。
 * 對應 FHIR R4 spec。
 */

export type FhirField =
  | 'Patient.identifier'
  | 'Patient.name.family'
  | 'Patient.name.given'
  | 'Patient.gender'
  | 'Patient.birthDate'
  | 'Patient.telecom.phone'
  | 'Patient.telecom.email'
  | 'Patient.address.city'
  | 'Encounter.identifier'
  | 'Encounter.status'
  | 'Encounter.class.code'
  | 'Encounter.period.start'
  | 'Encounter.period.end'
  | 'Encounter.subject' // 用 Patient.identifier 連結
  | 'Observation.identifier'
  | 'Observation.code.coding.code' // LOINC
  | 'Observation.code.text'
  | 'Observation.valueQuantity.value'
  | 'Observation.valueQuantity.unit'
  | 'Observation.effectiveDateTime'
  | 'Observation.subject';

export interface FieldMapping {
  /** 來源欄位名稱（XLS column / JSON key）*/
  sourceColumn: string;
  /** 目標 FHIR field path */
  targetField: FhirField;
  /** 轉換函式（optional）*/
  transform?: 'lowercase' | 'date-iso' | 'phone-tw' | 'gender-tw';
}

export interface MappingTemplate {
  id: string;
  name: string;
  description: string;
  /** 哪一個 FHIR resource type */
  resourceType: 'Patient' | 'Encounter' | 'Observation';
  /** 套用到哪一個 dataset 名稱（regex 或 string）*/
  datasetMatch?: string | RegExp;
  fields: FieldMapping[];
}

// === 預設範本 ===

/** ExClinCalc patients 表 → FHIR Patient */
export const TEMPLATE_EXCLINCALC_PATIENTS: MappingTemplate = {
  id: 'exclincalc-patients',
  name: 'ExClinCalc patients 表 → FHIR Patient',
  description: 'ExClinCalc 的 patients 表格欄位對應到 FHIR R4 Patient resource',
  resourceType: 'Patient',
  datasetMatch: /patients/i,
  fields: [
    { sourceColumn: 'id', targetField: 'Patient.identifier' },
    { sourceColumn: 'last_name', targetField: 'Patient.name.family' },
    { sourceColumn: 'first_name', targetField: 'Patient.name.given' },
    { sourceColumn: 'gender', targetField: 'Patient.gender', transform: 'gender-tw' },
    { sourceColumn: 'birth_date', targetField: 'Patient.birthDate', transform: 'date-iso' },
    { sourceColumn: 'phone', targetField: 'Patient.telecom.phone', transform: 'phone-tw' },
    { sourceColumn: 'email', targetField: 'Patient.telecom.email' },
    { sourceColumn: 'city', targetField: 'Patient.address.city' },
  ],
};

/** 健保處方箋 XLS → FHIR Patient（基本欄位）*/
export const TEMPLATE_NHI_PRESCRIPTION_PATIENT: MappingTemplate = {
  id: 'nhi-prescription-patient',
  name: '健保處方箋 → FHIR Patient',
  description: '台灣健保處方箋常用欄位（姓名、身分證、生日、性別）轉 FHIR Patient',
  resourceType: 'Patient',
  fields: [
    { sourceColumn: '身分證字號', targetField: 'Patient.identifier' },
    { sourceColumn: '姓名', targetField: 'Patient.name.family' },
    { sourceColumn: '性別', targetField: 'Patient.gender', transform: 'gender-tw' },
    { sourceColumn: '生日', targetField: 'Patient.birthDate', transform: 'date-iso' },
    { sourceColumn: '電話', targetField: 'Patient.telecom.phone', transform: 'phone-tw' },
  ],
};

/** KDIGO / 體檢 XLS → FHIR Observation */
export const TEMPLATE_KDIGO_OBSERVATIONS: MappingTemplate = {
  id: 'kdigo-observations',
  name: 'KDIGO 體檢報告 → FHIR Observation',
  description: '體檢 XLS 一筆對應一個指標（eGFR / Cr / HbA1c 等）',
  resourceType: 'Observation',
  fields: [
    { sourceColumn: 'patient_id', targetField: 'Observation.subject' },
    { sourceColumn: 'loinc_code', targetField: 'Observation.code.coding.code' },
    { sourceColumn: 'indicator_name', targetField: 'Observation.code.text' },
    { sourceColumn: 'value', targetField: 'Observation.valueQuantity.value' },
    { sourceColumn: 'unit', targetField: 'Observation.valueQuantity.unit' },
    { sourceColumn: 'measured_at', targetField: 'Observation.effectiveDateTime', transform: 'date-iso' },
  ],
};

/** ExClinCalc encounters 表 → FHIR Encounter */
export const TEMPLATE_EXCLINCALC_ENCOUNTERS: MappingTemplate = {
  id: 'exclincalc-encounters',
  name: 'ExClinCalc encounters 表 → FHIR Encounter',
  description: 'ExClinCalc 掛號 / SOAP encounter 資料對應到 FHIR Encounter',
  resourceType: 'Encounter',
  datasetMatch: /encounters?|registrations?|visits?/i,
  fields: [
    { sourceColumn: 'id', targetField: 'Encounter.identifier' },
    { sourceColumn: 'status', targetField: 'Encounter.status' },
    { sourceColumn: 'patient_id', targetField: 'Encounter.subject' },
    { sourceColumn: 'started_at', targetField: 'Encounter.period.start', transform: 'date-iso' },
    { sourceColumn: 'finished_at', targetField: 'Encounter.period.end', transform: 'date-iso' },
  ],
};

export const ALL_TEMPLATES: MappingTemplate[] = [
  TEMPLATE_EXCLINCALC_PATIENTS,
  TEMPLATE_EXCLINCALC_ENCOUNTERS,
  TEMPLATE_NHI_PRESCRIPTION_PATIENT,
  TEMPLATE_KDIGO_OBSERVATIONS,
];

/** 依 dataset 名稱自動推薦範本 */
export function suggestTemplate(datasetName: string): MappingTemplate | undefined {
  return ALL_TEMPLATES.find((t) => {
    if (!t.datasetMatch) return false;
    if (typeof t.datasetMatch === 'string') return datasetName.includes(t.datasetMatch);
    return t.datasetMatch.test(datasetName);
  });
}
