/**
 * DefaultDownloadTransport — 把 Bundle 用瀏覽器下載送出
 *
 * 這是目前 clinconvert 的預設行為、用 TransportProvider 介面包起來。
 *
 * 為什麼包這層：未來換成 HapiFhirTransport（POST 到 server）時、
 * UI / Worker code 只要呼叫 registry.transport.send(...)、不用改邏輯。
 */
import type {
  TransportProvider,
  TransportResult,
  AuthToken,
} from '../core/interfaces';
import type { FhirBundle } from '../fhir/types';

export class DefaultDownloadTransport implements TransportProvider {
  readonly name = 'default-download';

  async send(
    bundle: FhirBundle,
    endpoint?: string,
    _auth?: AuthToken
  ): Promise<TransportResult> {
    // endpoint 在這裡當作 filename 使用、未提供就用 timestamp
    const filename =
      endpoint && endpoint.length > 0
        ? endpoint
        : `bundle-${Date.now()}.json`;

    if (typeof document === 'undefined' || typeof URL === 'undefined') {
      // SSR / Node 環境、不能下載
      return {
        ok: false,
        status: 0,
        error: 'DOM not available (likely SSR)',
      };
    }

    try {
      const content = JSON.stringify(bundle, null, 2);
      const blob = new Blob([content], { type: 'application/fhir+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return { ok: true, status: 200 };
    } catch (e) {
      return {
        ok: false,
        status: 0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}

/**
 * Future: HapiFhirTransport
 * 預留 stub、Day 4 會實作。
 *
 * 用法（未來）：
 *   const t = new HapiFhirTransport();
 *   const result = await t.send(bundle, 'http://localhost:8080/fhir', token);
 *   // result.locationHeader 可能是新建 Bundle 的 URL
 */
export class HapiFhirTransportStub implements TransportProvider {
  readonly name = 'hapi-fhir-stub';

  async send(
    _bundle: FhirBundle,
    _endpoint?: string,
    _auth?: AuthToken
  ): Promise<TransportResult> {
    return {
      ok: false,
      status: 501,
      error:
        'HapiFhirTransport 尚未實作（Day 4 計畫）。請改用 DefaultDownloadTransport。',
    };
  }
}
