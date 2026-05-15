/**
 * HapiFhirTransport — 把 Bundle POST 到 HAPI FHIR server
 *
 * 取代 Day 1 的 HapiFhirTransportStub。
 *
 * 用法：
 *   const t = new HapiFhirTransport();
 *   const result = await t.send(bundle, 'http://localhost:8080/fhir');
 *
 *   if (result.ok) {
 *     // result.body 含 server 回應的 OperationOutcome 或 Bundle
 *     // result.locationHeader 可能含新建 resource 的 URL
 *   }
 *
 * 為什麼這個 transport 重要：
 *   - 證明 clinconvert 輸出符合 HL7 標準（HAPI 嚴格 validate）
 *   - 推甄 demo「整合到大架構」的核心展示
 *   - 對接 HAPI = 對接「業界 reference implementation」、隱含對接其他 FHIR server
 *
 * 安全注意：
 *   - 預設 fetch、瀏覽器會強制 CORS（HAPI 需開 CORS、見 docker-compose.yml）
 *   - 不做 TLS verify bypass、不做 SSL pinning（瀏覽器處理）
 *   - 帶 Auth token 時走 Authorization header、不放 URL
 */
import type {
  TransportProvider,
  TransportResult,
  AuthToken,
} from '../core/interfaces';
import type { FhirBundle } from '../fhir/types';

export class HapiFhirTransport implements TransportProvider {
  readonly name = 'hapi-fhir';

  async send(
    bundle: FhirBundle,
    endpoint?: string,
    auth?: AuthToken
  ): Promise<TransportResult> {
    if (!endpoint) {
      return {
        ok: false,
        status: 0,
        error: 'endpoint URL 必填（例：http://localhost:8080/fhir）',
      };
    }

    // 確保 endpoint 不重複加 /Bundle
    const baseUrl = endpoint.replace(/\/$/, '');
    const targetUrl =
      bundle.type === 'transaction' || bundle.type === 'batch'
        ? baseUrl // transaction 直接 POST 到 root
        : `${baseUrl}/Bundle`; // collection 走 /Bundle endpoint

    const headers: Record<string, string> = {
      'Content-Type': 'application/fhir+json',
      Accept: 'application/fhir+json',
    };

    if (auth && auth.type !== 'none' && auth.value) {
      headers.Authorization =
        auth.type === 'bearer' ? `Bearer ${auth.value}` : auth.value;
    }

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(bundle),
        mode: 'cors',
      });

      const body = await response.text();
      const locationHeader = response.headers.get('Location') ?? undefined;

      if (response.ok) {
        return {
          ok: true,
          status: response.status,
          body,
          locationHeader,
        };
      } else {
        return {
          ok: false,
          status: response.status,
          error: body || response.statusText || 'Unknown server error',
        };
      }
    } catch (e) {
      // 通常是 CORS error 或 network error
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        status: 0,
        error:
          `Network / CORS error: ${msg}\n` +
          `提示：(1) 確認 docker-compose up 已啟動 (2) HAPI server CORS 已開 (3) endpoint URL 正確`,
      };
    }
  }

  /**
   * 試打 server 確認連線（不送 Bundle、只 GET /metadata）
   */
  async ping(endpoint: string): Promise<{ ok: boolean; serverInfo?: string; error?: string }> {
    try {
      const baseUrl = endpoint.replace(/\/$/, '');
      const r = await fetch(`${baseUrl}/metadata`, {
        method: 'GET',
        headers: { Accept: 'application/fhir+json' },
        mode: 'cors',
      });
      if (!r.ok) {
        return {
          ok: false,
          error: `HTTP ${r.status} ${r.statusText}`,
        };
      }
      const text = await r.text();
      // 不解析整個 CapabilityStatement、只 sanity check
      const fhirVersion = /"fhirVersion":\s*"([^"]+)"/.exec(text)?.[1];
      return {
        ok: true,
        serverInfo: fhirVersion ? `FHIR ${fhirVersion}` : 'reachable',
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
