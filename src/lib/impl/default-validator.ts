/**
 * DefaultFhirValidator — wrap 既有 validator.ts、套上 FhirValidator interface
 *
 * Profile: base R4（HL7 international）
 *
 * 未來可加：
 *   - TaiwanNhiProfileValidator（台灣健保 FHIR profile）
 *   - HapiServerValidator（POST 到 HAPI $validate endpoint）
 *   - MohwMiddlewareValidator（衛福部中台 validate）
 */
import type { FhirValidator } from '../core/interfaces';
import type { FhirBundle, FhirAnyResource } from '../fhir/types';
import {
  validateResource as _validateResource,
  validateBundle as _validateBundle,
  type ValidationIssue,
} from '../fhir/validator';

export class DefaultFhirValidator implements FhirValidator {
  readonly profileId = 'base-r4';

  validateResource(r: FhirAnyResource): ValidationIssue[] {
    return _validateResource(r);
  }

  validateBundle(b: FhirBundle): ValidationIssue[] {
    return _validateBundle(b);
  }
}
