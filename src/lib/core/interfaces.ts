/**
 * Modular reference architecture — 7 個 plug-in interface
 *
 * 設計目標：把 clinconvert 從「一個固定流程」變成「可插拔的 reference architecture」。
 * 未來醫院 IT / 研究者要接 HL7 v2 / 衛福部中台 / 自家 HSM，只要實作對應 interface、
 * 不必動既有的 XLSX adapter / FHIR builder / Web Worker pool。
 *
 * 7 個 interface：
 *   1. InputAdapter      — 檔案格式入口（XLSX / CSV / JSON / 未來 HL7v2 / CCDA）
 *   2. EncryptionProvider — 加密層（Web Crypto AES-GCM / 未來 HSM）
 *   3. TransportProvider  — 輸出去向（local download / HAPI POST / 衛福部中台）
 *   4. AuthProvider       — 認證（none / bearer / 未來 OAuth2 / SMART on FHIR）
 *   5. FhirValidator      — 驗證 profile（base R4 / 未來 TW NHI profile / 機構自家）
 *   6. AuditLogger        — 稽核軌跡（memory / IndexedDB / 未來 remote push）
 *   7. ConsentManager     — FHIR Consent resource（未來 GDPR / HIPAA workflow）
 *
 * Non-goal：本檔不實作合規認證、IRB、HSM、跨院整合 —— 那些是組織層級的事、
 * 不是 code 能解的。本檔是「technical reference」、不是「production turnkey」。
 *
 * 詳見 docs/COMPETITIVE_ANALYSIS.md「模塊化策略」段。
 */

import type { NormalizedDataset } from './internal-model';
import type { FhirBundle, FhirAnyResource } from '../fhir/types';
import type { ValidationIssue } from '../fhir/validator';

// =============================================================================
// 1. InputAdapter — 把任意格式檔案 → NormalizedDataset[]
// =============================================================================

/**
 * 任何輸入格式（XLSX / CSV / JSON / 未來 HL7v2 / CCDA / Cerner export）都實作此介面。
 *
 * 已有：DefaultXlsxAdapter（包 parseXlsx）、DefaultJsonAdapter（包 parseJson）
 * 未來可加：Hl7v2Adapter、CcdaAdapter、CernerCsvAdapter、EpicHl7Adapter
 */
export interface InputAdapter {
  /** 識別名稱（log / UI / 稽核用）*/
  readonly name: string;
  /** 支援的副檔名（不含 dot，小寫）*/
  readonly supportedExtensions: readonly string[];
  /** 解析檔案 → 統一 NormalizedDataset 陣列 */
  parse(
    file: File | ArrayBuffer | string,
    options?: Record<string, unknown>
  ): Promise<NormalizedDataset[]>;
}

// =============================================================================
// 2. EncryptionProvider — 加密匯出（Web Crypto AES-GCM）
// =============================================================================

/** 加密後的資料封包 */
export interface EncryptedPayload {
  /** AES-GCM ciphertext + auth tag */
  ciphertext: Uint8Array;
  /** Initialization vector（建議 12 bytes）*/
  iv: Uint8Array;
  /** Key derivation salt（建議 16 bytes、PBKDF2 用）*/
  salt: Uint8Array;
  /** 演算法識別字串，例如 "AES-256-GCM" */
  algorithm: string;
  /** Key derivation function 識別，例如 "PBKDF2-SHA256-100000" */
  kdf?: string;
}

/**
 * 加密 / 解密層。
 *
 * 已有：（Day 3 會落實 WebCryptoEncryption）
 * 未來可加：醫院指定 HSM、ChaCha20-Poly1305、後量子演算法
 *
 * 為什麼這個 interface 有用：醫院常指定「**只能用 algorithm X**」的合規要求。
 * 模塊化後，換實作不必改 builder / validator。
 */
export interface EncryptionProvider {
  /** 演算法識別，例如 "AES-256-GCM" */
  readonly algorithm: string;
  /** 從 passphrase + salt 派生 CryptoKey */
  deriveKey(passphrase: string, salt?: Uint8Array): Promise<CryptoKey>;
  /** 加密 plaintext */
  encrypt(plaintext: Uint8Array, key: CryptoKey): Promise<EncryptedPayload>;
  /** 解密 EncryptedPayload */
  decrypt(payload: EncryptedPayload, key: CryptoKey): Promise<Uint8Array>;
}

// =============================================================================
// 3. TransportProvider — 把 Bundle 送去哪
// =============================================================================

export type TransportResult =
  | { ok: true; status: number; body?: string; locationHeader?: string }
  | { ok: false; status: number; error: string };

/**
 * 輸出去向。
 *
 * 已有：DefaultDownloadTransport（瀏覽器下載、預設行為）
 * 未來可加：HapiFhirTransport、MohwMiddlewareTransport（衛福部中台）、
 *           MirthChannelTransport、自家 EHR 內部 API
 *
 * 為什麼模塊化：「跨機構傳輸」每家 FHIR server 的 endpoint / auth 不同，
 * 但我們的 builder / validator / encryption 完全一樣 — 換 TransportProvider 即可。
 */
export interface TransportProvider {
  /** 識別名稱 */
  readonly name: string;
  /** 傳送 Bundle 到 endpoint（download / POST / 等）*/
  send(
    bundle: FhirBundle,
    endpoint?: string,
    auth?: AuthToken
  ): Promise<TransportResult>;
}

// =============================================================================
// 4. AuthProvider — 認證 token
// =============================================================================

export interface AuthToken {
  type: 'bearer' | 'basic' | 'none';
  value: string;
  /** Unix ms timestamp。undefined = 不過期 / 沒記錄 */
  expiresAt?: number;
}

/**
 * 認證提供者。
 *
 * 已有：NoopAuthProvider（不用認證、用於 local 下載）
 * 未來可加：BearerAuthProvider、OAuth2AuthProvider、SmartOnFhirAuthProvider
 *
 * SMART on FHIR scope-based authorization 是 FHIR 生態的標準，未來接 HAPI / Epic
 * / Cerner 都會走這個。本 interface 為此預留 plug-in 點。
 */
export interface AuthProvider {
  /** Token 類型識別 */
  readonly type: AuthToken['type'];
  /** 取得當前 token（必要時自動 refresh）*/
  getToken(): Promise<AuthToken>;
  /** 強制 refresh（如果支援）*/
  refresh?(): Promise<AuthToken>;
}

// =============================================================================
// 5. FhirValidator — 結構與 profile 驗證
// =============================================================================

/**
 * FHIR resource / Bundle 驗證器。
 *
 * 已有：DefaultFhirValidator（wrap 現有 validator.ts、base R4 profile）
 * 未來可加：TaiwanNhiProfileValidator（台灣健保 FHIR profile）、
 *           HospitalSpecificValidator、HapiServerValidator（轉發到 HAPI $validate）
 */
export interface FhirValidator {
  /** Profile 識別（URL 或代號），例如 "base-r4"、"tw-nhi"、"mohw-2024" */
  readonly profileId: string;
  /** 驗證單一 resource */
  validateResource(r: FhirAnyResource): ValidationIssue[];
  /** 驗證整個 Bundle（含 reference integrity）*/
  validateBundle(b: FhirBundle): ValidationIssue[];
}

// =============================================================================
// 6. AuditLogger — 稽核軌跡
// =============================================================================

export interface AuditEvent {
  /** Unix ms timestamp */
  timestamp: number;
  /** 行為者識別（user id / system / anonymous）*/
  actor: string;
  /** 動作識別，例如 "convert"、"export"、"validate"、"transport.send" */
  action: string;
  /** 目標識別（檔名 / Bundle id / Patient id）*/
  target?: string;
  /** 自由欄位 */
  meta?: Record<string, unknown>;
}

export type AuditFilter = Partial<
  Pick<AuditEvent, 'actor' | 'action' | 'target'>
> & {
  since?: number;
  until?: number;
};

/**
 * 稽核 log。
 *
 * 已有：MemoryAuditLogger（in-memory、頁面 reload 就清空）
 * 未來可加：IndexedDbAuditLogger、RemoteAuditLogger（合規場景：log 推到 server）
 *
 * 為什麼模塊化：合規場景下、log 必須**不可竄改**（append-only + 簽章）。
 * 切換到 RemoteAuditLogger 就能滿足要求、其他 code 不必動。
 */
export interface AuditLogger {
  /** 儲存後端識別 */
  readonly storage: 'memory' | 'localStorage' | 'indexedDB' | 'remote';
  /** 記錄一筆 event */
  log(event: AuditEvent): Promise<void>;
  /** 查詢 events（依時間 / actor / action 篩選）*/
  query(filter?: AuditFilter): Promise<AuditEvent[]>;
}

// =============================================================================
// 7. ConsentManager — FHIR Consent resource
// =============================================================================

export interface ConsentRecord {
  /** Patient identifier */
  patientId: string;
  /** Consent 用途，例如 "research"、"treatment"、"export-to-hospital-X" */
  purpose: string;
  /** Scope 描述（自由文字 / FHIR Consent.scope code）*/
  scope: string;
  /** 狀態 */
  status: 'active' | 'inactive' | 'rejected';
  /** Unix ms timestamp、簽署時間 */
  signedAt: number;
  /** Unix ms timestamp、過期時間（undefined = 不過期）*/
  expiresAt?: number;
}

export interface ConsentStatus {
  granted: boolean;
  reason?: string;
  /** 找到的 record id（如果有）*/
  recordId?: string;
}

/**
 * Consent 管理（FHIR Consent resource 的應用層）。
 *
 * 已有：NoopConsentManager（永遠 granted、用於 demo）
 * 未來可加：LocalConsentManager（IndexedDB 存簽名）、
 *           ServerConsentManager（跟醫院 patient portal 整合）、
 *           BlockchainConsentManager（不可竄改紀錄）
 *
 * 為什麼這個 interface 重要：醫療資料的「同意 workflow」是合規核心、
 * 但實作差異極大（書面 vs 電子簽章 vs 第三方驗證），plug-in 化是必須。
 */
export interface ConsentManager {
  /** 記錄一筆 consent */
  record(consent: ConsentRecord): Promise<void>;
  /** 檢查特定 patient + purpose 是否有 active consent */
  check(patientId: string, purpose: string): Promise<ConsentStatus>;
}

// =============================================================================
// Registry — central plug-in 註冊
// =============================================================================

/**
 * Plug-in registry。每個 interface 可以有多個實作、依使用情境切換。
 *
 * 預設值：本檔 default* 系列。使用者要替換時：
 *
 *   registry.setEncryption(new MyHospitalHsmEncryption());
 *   registry.setTransport(new MohwMiddlewareTransport());
 *
 * 之後所有走 registry 的程式碼都會用新實作。
 *
 * 注意：既有 code 仍可直接 import parseXlsx / triggerDownload 不走 registry，
 * 這層只是「希望走 plug-in 化」的入口。**不是強制依賴**。
 */
export interface PluginRegistry {
  readonly inputAdapters: ReadonlyArray<InputAdapter>;
  registerInputAdapter(a: InputAdapter): void;
  findAdapterByExtension(ext: string): InputAdapter | undefined;

  encryption: EncryptionProvider;
  transport: TransportProvider;
  auth: AuthProvider;
  validator: FhirValidator;
  audit: AuditLogger;
  consent: ConsentManager;
}
