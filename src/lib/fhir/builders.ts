/**
 * FHIR R4 Resource Builders
 *
 * 從 NormalizedRecord + MappingTemplate 建構出符合 FHIR R4 spec 的 resource。
 *
 * 設計：每個 builder 函式都是 pure function，輸入 (record + mapping) → 輸出 FHIR resource。
 * 不依賴外部狀態，方便測試與型別檢查。
 */
import type {
  FhirPatient,
  FhirEncounter,
  FhirObservation,
  FhirAnyResource,
  FhirCoding,
} from './types';
import type { NormalizedRecord } from '../core/internal-model';
import type { FieldMapping, MappingTemplate } from '../mapping/templates';
import { applyTransform } from '../mapping/transforms';

// === 工具 ===

function getMappedValue(
  record: NormalizedRecord,
  mapping: FieldMapping
): unknown {
  const raw = record.fields[mapping.sourceColumn];
  return applyTransform(raw, mapping.transform);
}

function findMapping(
  template: MappingTemplate,
  targetField: FieldMapping['targetField']
): FieldMapping | undefined {
  return template.fields.find((f) => f.targetField === targetField);
}

function nonNullString(v: unknown): string | undefined {
  if (v == null || v === '') return undefined;
  return String(v);
}

// === Patient ===

export function buildPatient(
  record: NormalizedRecord,
  template: MappingTemplate,
  options: { resourceId?: string } = {}
): FhirPatient {
  const patient: FhirPatient = {
    resourceType: 'Patient',
  };

  const idVal = findMapping(template, 'Patient.identifier')
    ? getMappedValue(record, findMapping(template, 'Patient.identifier')!)
    : undefined;
  const identifier = nonNullString(idVal);
  if (identifier) {
    patient.identifier = [{ value: identifier, use: 'official' }];
    patient.id = options.resourceId ?? identifier;
  } else {
    patient.id = options.resourceId ?? cryptoRandomId();
  }

  const family = nonNullString(
    findMapping(template, 'Patient.name.family')
      ? getMappedValue(record, findMapping(template, 'Patient.name.family')!)
      : undefined
  );
  const given = nonNullString(
    findMapping(template, 'Patient.name.given')
      ? getMappedValue(record, findMapping(template, 'Patient.name.given')!)
      : undefined
  );
  if (family || given) {
    patient.name = [
      {
        use: 'official',
        ...(family ? { family } : {}),
        ...(given ? { given: [given] } : {}),
        ...(family && given ? { text: `${family}${given}` } : {}),
      },
    ];
  }

  const genderM = findMapping(template, 'Patient.gender');
  if (genderM) {
    const g = String(getMappedValue(record, genderM) ?? 'unknown');
    if (['male', 'female', 'other', 'unknown'].includes(g)) {
      patient.gender = g as FhirPatient['gender'];
    }
  }

  const birthDateM = findMapping(template, 'Patient.birthDate');
  if (birthDateM) {
    const d = nonNullString(getMappedValue(record, birthDateM));
    if (d) patient.birthDate = d;
  }

  // telecom
  const telecom: NonNullable<FhirPatient['telecom']> = [];
  const phoneM = findMapping(template, 'Patient.telecom.phone');
  if (phoneM) {
    const v = nonNullString(getMappedValue(record, phoneM));
    if (v) telecom.push({ system: 'phone', value: v, use: 'mobile' });
  }
  const emailM = findMapping(template, 'Patient.telecom.email');
  if (emailM) {
    const v = nonNullString(getMappedValue(record, emailM));
    if (v) telecom.push({ system: 'email', value: v });
  }
  if (telecom.length > 0) patient.telecom = telecom;

  // address
  const cityM = findMapping(template, 'Patient.address.city');
  if (cityM) {
    const v = nonNullString(getMappedValue(record, cityM));
    if (v) patient.address = [{ use: 'home', city: v, country: 'TW' }];
  }

  return patient;
}

// === Encounter ===

export function buildEncounter(
  record: NormalizedRecord,
  template: MappingTemplate,
  options: { resourceId?: string } = {}
): FhirEncounter {
  const idVal = findMapping(template, 'Encounter.identifier')
    ? getMappedValue(record, findMapping(template, 'Encounter.identifier')!)
    : undefined;
  const identifier = nonNullString(idVal);

  const subjectVal = findMapping(template, 'Encounter.subject')
    ? getMappedValue(record, findMapping(template, 'Encounter.subject')!)
    : undefined;
  const subject = nonNullString(subjectVal) ?? 'unknown';

  const statusVal = findMapping(template, 'Encounter.status')
    ? getMappedValue(record, findMapping(template, 'Encounter.status')!)
    : 'finished';
  const status = normalizeEncounterStatus(statusVal);

  const classCodeVal = findMapping(template, 'Encounter.class.code')
    ? getMappedValue(record, findMapping(template, 'Encounter.class.code')!)
    : 'AMB';
  const encClass: FhirCoding = {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: nonNullString(classCodeVal) ?? 'AMB',
    display: 'ambulatory',
  };

  const encounter: FhirEncounter = {
    resourceType: 'Encounter',
    id: options.resourceId ?? identifier ?? cryptoRandomId(),
    status,
    class: encClass,
    subject: { reference: `Patient/${subject}` },
  };

  if (identifier) {
    encounter.identifier = [{ value: identifier, use: 'official' }];
  }

  const startM = findMapping(template, 'Encounter.period.start');
  const endM = findMapping(template, 'Encounter.period.end');
  const start = startM ? nonNullString(getMappedValue(record, startM)) : undefined;
  const end = endM ? nonNullString(getMappedValue(record, endM)) : undefined;
  if (start || end) {
    encounter.period = {
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
    };
  }

  return encounter;
}

function normalizeEncounterStatus(
  value: unknown
): FhirEncounter['status'] {
  const s = String(value ?? '').toLowerCase().trim();
  const valid: FhirEncounter['status'][] = [
    'planned',
    'arrived',
    'triaged',
    'in-progress',
    'finished',
    'cancelled',
  ];
  if ((valid as string[]).includes(s)) return s as FhirEncounter['status'];

  // 常見對應
  if (s === 'completed' || s === 'done' || s === '已完成') return 'finished';
  if (s === 'pending' || s === '候診') return 'arrived';
  if (s === 'cancel' || s === '取消') return 'cancelled';
  return 'finished';
}

// === Observation ===

export function buildObservation(
  record: NormalizedRecord,
  template: MappingTemplate,
  options: { resourceId?: string } = {}
): FhirObservation {
  const subjectVal = findMapping(template, 'Observation.subject')
    ? getMappedValue(record, findMapping(template, 'Observation.subject')!)
    : undefined;
  const subject = nonNullString(subjectVal) ?? 'unknown';

  const codeM = findMapping(template, 'Observation.code.coding.code');
  const codeTextM = findMapping(template, 'Observation.code.text');

  const codeVal = codeM ? nonNullString(getMappedValue(record, codeM)) : undefined;
  const codeText = codeTextM ? nonNullString(getMappedValue(record, codeTextM)) : undefined;

  const obs: FhirObservation = {
    resourceType: 'Observation',
    id: options.resourceId ?? cryptoRandomId(),
    status: 'final',
    code: {
      ...(codeVal
        ? {
            coding: [
              {
                system: 'http://loinc.org',
                code: codeVal,
                ...(codeText ? { display: codeText } : {}),
              },
            ],
          }
        : {}),
      ...(codeText ? { text: codeText } : {}),
    },
    subject: { reference: `Patient/${subject}` },
  };

  const valueM = findMapping(template, 'Observation.valueQuantity.value');
  const unitM = findMapping(template, 'Observation.valueQuantity.unit');
  if (valueM) {
    const v = getMappedValue(record, valueM);
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    if (!isNaN(n)) {
      const unit = unitM ? nonNullString(getMappedValue(record, unitM)) : undefined;
      obs.valueQuantity = {
        value: n,
        ...(unit ? { unit } : {}),
      };
    }
  }

  const dtM = findMapping(template, 'Observation.effectiveDateTime');
  if (dtM) {
    const v = nonNullString(getMappedValue(record, dtM));
    if (v) obs.effectiveDateTime = v;
  }

  return obs;
}

// === 統一 dispatcher ===

export function buildResource(
  record: NormalizedRecord,
  template: MappingTemplate
): FhirAnyResource {
  switch (template.resourceType) {
    case 'Patient':
      return buildPatient(record, template);
    case 'Encounter':
      return buildEncounter(record, template);
    case 'Observation':
      return buildObservation(record, template);
    default:
      throw new Error(`Unsupported resourceType: ${template.resourceType}`);
  }
}

// === Helpers ===

function cryptoRandomId(): string {
  // 瀏覽器有 crypto.randomUUID()，Node 18+ 也有
  if (typeof globalThis !== 'undefined' && 'crypto' in globalThis) {
    const c = (globalThis as { crypto: { randomUUID?: () => string } }).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  }
  // fallback
  return 'urn:uuid:' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
