/**
 * Output adapters — 把 FHIR resource array 包成不同格式輸出。
 */
import type { FhirAnyResource, FhirBundle } from '../fhir/types';

/**
 * Standard FHIR Bundle (type=collection)
 * 適合：研究用、檔案匯出、人類閱讀
 */
export function toCollectionBundle(resources: FhirAnyResource[]): FhirBundle {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: resources.map((r) => ({
      fullUrl: r.id ? `urn:uuid:${r.id}` : undefined,
      resource: r,
    })),
  };
}

/**
 * FHIR Transaction Bundle (type=transaction)
 * 適合：直接 POST 到 FHIR server 做批次寫入
 */
export function toTransactionBundle(resources: FhirAnyResource[]): FhirBundle {
  return {
    resourceType: 'Bundle',
    type: 'transaction',
    timestamp: new Date().toISOString(),
    entry: resources.map((r) => ({
      fullUrl: r.id ? `urn:uuid:${r.id}` : undefined,
      resource: r,
      request: {
        method: 'POST',
        url: r.resourceType,
      },
    })),
  };
}

/**
 * NDJSON (Newline-Delimited JSON)
 * 適合：大量資料 streaming 匯入、bulk data
 * 每行一個 resource
 */
export function toNdjson(resources: FhirAnyResource[]): string {
  return resources.map((r) => JSON.stringify(r)).join('\n');
}

/**
 * Pretty-printed JSON（給人類閱讀 / debug）
 */
export function toPrettyJson(bundle: FhirBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/** 觸發瀏覽器下載 */
export function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
