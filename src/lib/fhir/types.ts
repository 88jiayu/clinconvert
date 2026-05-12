/**
 * FHIR R4 minimal type definitions (subset).
 * Spec: https://hl7.org/fhir/R4/
 *
 * 本檔只覆蓋 MVP 用到的 resource。完整型別可裝 @types/fhir。
 * 設計原則：用 minimal subset，可讀、可測、容易 inline 給 reviewer 看懂。
 */

export type FhirResourceType =
  | 'Patient'
  | 'Encounter'
  | 'Observation'
  | 'Medication'
  | 'Condition'
  | 'Procedure'
  | 'Bundle';

// === 通用 ===

export interface FhirReference {
  reference: string; // e.g. "Patient/123"
  display?: string;
}

export interface FhirCoding {
  system?: string;
  code: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirIdentifier {
  system?: string;
  value: string;
  use?: 'usual' | 'official' | 'temp' | 'secondary';
}

export interface FhirPeriod {
  start?: string; // ISO 8601
  end?: string;
}

export interface FhirQuantity {
  value: number;
  unit?: string;
  system?: string;
  code?: string;
}

// === Patient ===
// https://hl7.org/fhir/R4/patient.html

export interface FhirPatient {
  resourceType: 'Patient';
  id?: string;
  identifier?: FhirIdentifier[];
  name?: {
    use?: 'official' | 'usual' | 'nickname';
    family?: string;
    given?: string[];
    text?: string;
  }[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string; // YYYY-MM-DD
  telecom?: {
    system: 'phone' | 'email' | 'sms';
    value: string;
    use?: 'home' | 'work' | 'mobile';
  }[];
  address?: {
    use?: 'home' | 'work' | 'temp';
    line?: string[];
    city?: string;
    postalCode?: string;
    country?: string;
  }[];
}

// === Encounter ===
// https://hl7.org/fhir/R4/encounter.html

export interface FhirEncounter {
  resourceType: 'Encounter';
  id?: string;
  identifier?: FhirIdentifier[];
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'finished' | 'cancelled';
  class: FhirCoding; // 必填，至少有 code（AMB = ambulatory / 門診）
  subject: FhirReference; // Patient/xxx
  period?: FhirPeriod;
  reasonCode?: FhirCodeableConcept[];
}

// === Observation ===
// https://hl7.org/fhir/R4/observation.html
// LOINC: https://loinc.org/

export interface FhirObservation {
  resourceType: 'Observation';
  id?: string;
  identifier?: FhirIdentifier[];
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected';
  code: FhirCodeableConcept; // 必填，描述「測什麼」(LOINC 編碼)
  subject: FhirReference; // Patient/xxx
  encounter?: FhirReference; // Encounter/xxx
  effectiveDateTime?: string; // ISO 8601
  valueQuantity?: FhirQuantity;
  valueString?: string;
  valueCodeableConcept?: FhirCodeableConcept;
  interpretation?: FhirCodeableConcept[];
  referenceRange?: {
    low?: FhirQuantity;
    high?: FhirQuantity;
    text?: string;
  }[];
}

// === Bundle ===
// https://hl7.org/fhir/R4/bundle.html

export type FhirAnyResource = FhirPatient | FhirEncounter | FhirObservation;

export interface FhirBundle {
  resourceType: 'Bundle';
  type: 'document' | 'message' | 'transaction' | 'batch' | 'collection';
  timestamp?: string;
  entry: {
    fullUrl?: string;
    resource: FhirAnyResource;
    request?: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      url: string;
    };
  }[];
}
