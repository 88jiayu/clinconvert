/**
 * NoopConsentManager — 永遠 granted、預設 default
 *
 * 適合：demo / 教學（清楚標示「無實際 consent workflow」）
 * 不適合：production（要真實 FHIR Consent resource workflow）
 *
 * 未來實作：
 *   - LocalConsentManager: IndexedDB 存 consent record、含電子簽章
 *   - ServerConsentManager: 跟醫院 patient portal 整合
 */
import type {
  ConsentManager,
  ConsentRecord,
  ConsentStatus,
} from '../core/interfaces';

export class NoopConsentManager implements ConsentManager {
  async record(_consent: ConsentRecord): Promise<void> {
    // no-op
  }

  async check(_patientId: string, _purpose: string): Promise<ConsentStatus> {
    return {
      granted: true,
      reason: 'NoopConsentManager: research/demo mode, all access granted',
    };
  }
}
