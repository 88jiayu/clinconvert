/**
 * Plugin Registry — 中央註冊表
 *
 * 提供「換實作不必改 caller」的機制。
 *
 * 範例使用：
 *   import { registry } from './lib/core/registry';
 *
 *   // 用 default 行為
 *   const result = await registry.transport.send(bundle);
 *
 *   // 想換實作（例如未來加 HAPI）
 *   registry.transport = new HapiFhirTransport();
 *   const result2 = await registry.transport.send(bundle, 'http://localhost:8080/fhir', token);
 *
 * 注意：既有 code（parseXlsx / triggerDownload）**不強制走 registry**。
 * 這層只是給「希望模塊化」的程式碼一個入口。
 */
import type {
  InputAdapter,
  EncryptionProvider,
  TransportProvider,
  AuthProvider,
  FhirValidator,
  AuditLogger,
  ConsentManager,
  PluginRegistry,
} from './interfaces';

import { DefaultXlsxAdapter } from '../impl/xlsx-adapter';
import { DefaultJsonAdapter } from '../impl/json-adapter';
import { WebCryptoEncryption } from '../impl/webcrypto-encryption';
import { DefaultDownloadTransport } from '../impl/download-transport';
import { NoopAuthProvider } from '../impl/noop-auth';
import { DefaultFhirValidator } from '../impl/default-validator';
import { MemoryAuditLogger } from '../impl/memory-audit-logger';
import { NoopConsentManager } from '../impl/noop-consent';

class DefaultPluginRegistry implements PluginRegistry {
  private _inputAdapters: InputAdapter[] = [];

  encryption: EncryptionProvider = new WebCryptoEncryption();
  transport: TransportProvider = new DefaultDownloadTransport();
  auth: AuthProvider = new NoopAuthProvider();
  validator: FhirValidator = new DefaultFhirValidator();
  audit: AuditLogger = new MemoryAuditLogger();
  consent: ConsentManager = new NoopConsentManager();

  constructor() {
    this.registerInputAdapter(new DefaultXlsxAdapter());
    this.registerInputAdapter(new DefaultJsonAdapter());
  }

  get inputAdapters(): ReadonlyArray<InputAdapter> {
    return this._inputAdapters;
  }

  registerInputAdapter(a: InputAdapter): void {
    this._inputAdapters.push(a);
  }

  findAdapterByExtension(ext: string): InputAdapter | undefined {
    const lower = ext.toLowerCase().replace(/^\./, '');
    return this._inputAdapters.find((a) =>
      a.supportedExtensions.includes(lower)
    );
  }
}

/** 全域 registry singleton。需要客製時可以 `import { registry }` 直接改屬性。*/
export const registry: PluginRegistry = new DefaultPluginRegistry();

/** Re-export interfaces 方便 import */
export type {
  InputAdapter,
  EncryptionProvider,
  EncryptedPayload,
  TransportProvider,
  TransportResult,
  AuthProvider,
  AuthToken,
  FhirValidator,
  AuditLogger,
  AuditEvent,
  AuditFilter,
  ConsentManager,
  ConsentRecord,
  ConsentStatus,
  PluginRegistry,
} from './interfaces';
