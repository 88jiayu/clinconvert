# Day 1 — 7 個 Interface + Plugin Registry

> 2026-05-15 完成

## 做了什麼

加入「模塊化 reference architecture」── 7 個 plug-in interface + default 實作 + 中央 registry。

**Zero breaking change**：
- 既有 `parseXlsx` / `parseJson` / `triggerDownload` / `validateBundle` 全部不動
- 既有 UI / Worker pool 程式碼不動
- 新介面是**疊加層**、**opt-in**

## 新增檔案

```
src/lib/core/
  interfaces.ts       ← 7 個 interface 契約定義
  registry.ts         ← 中央 plug-in registry

src/lib/impl/
  xlsx-adapter.ts          ← DefaultXlsxAdapter (wraps parseXlsx)
  json-adapter.ts          ← DefaultJsonAdapter (wraps parseJson)
  webcrypto-encryption.ts  ← WebCryptoEncryption (AES-256-GCM + PBKDF2)
  download-transport.ts    ← DefaultDownloadTransport + HapiFhirTransportStub
  noop-auth.ts             ← NoopAuthProvider + BearerAuthProvider
  default-validator.ts     ← DefaultFhirValidator (wraps existing validator)
  memory-audit-logger.ts   ← MemoryAuditLogger (in-memory)
  noop-consent.ts          ← NoopConsentManager (always granted)

docs/
  DAY1_INTERFACES.md   ← 本檔
```

## 7 個 Interface 摘要

| # | Interface | 目的 | 預設實作 | 未來可插入 |
|---|---|---|---|---|
| 1 | `InputAdapter` | 檔案 → NormalizedDataset | XLSX / JSON | HL7 v2 / CCDA / Cerner / Epic |
| 2 | `EncryptionProvider` | 加密匯出 | WebCrypto AES-GCM | HSM / ChaCha20 / 醫院指定 |
| 3 | `TransportProvider` | Bundle 送去哪 | 本地下載 | HAPI / 衛福部中台 / MIRTH |
| 4 | `AuthProvider` | 認證 token | None / Bearer | OAuth2 / SMART on FHIR |
| 5 | `FhirValidator` | Profile 驗證 | base R4 | TW NHI / 機構自家 |
| 6 | `AuditLogger` | 稽核軌跡 | Memory | IndexedDB / Remote |
| 7 | `ConsentManager` | FHIR Consent | Noop（永遠 granted）| Local / Server / 簽章 |

## 使用範例

```typescript
import { registry } from './lib/core/registry';

// 加密匯出（Day 3 才接 UI、但底層已可用）
const key = await registry.encryption.deriveKey('my-passphrase');
const encrypted = await registry.encryption.encrypt(
  new TextEncoder().encode(bundleJson),
  key
);

// 走 transport 層（目前等於本地下載）
const result = await registry.transport.send(bundle);

// 稽核 log
await registry.audit.log({
  timestamp: Date.now(),
  actor: 'researcher@university.edu.tw',
  action: 'convert',
  target: 'patients.xlsx',
});

// 找對應的 input adapter
const adapter = registry.findAdapterByExtension('xlsx');
const datasets = await adapter?.parse(file);
```

## 對外敘事（自傳 / 面試用）

> 「我的 clinconvert 是 modular reference architecture。
> 7 個 plug-in interface（input / encryption / transport / auth /
> validator / audit / consent）抽象化了所有與外部世界的整合點。
>
> 醫院 IT 未來如果要接 HAPI FHIR server / 衛福部中台 / 自家 HSM /
> SMART on FHIR auth、只要實作對應 interface、其他 code 完全不動。
>
> 我不能解的部分（HIPAA 認證、IRB 倫理審查、HSM 實體基建）我承認、
> 列在 docs 裡。模塊化解技術層、不解組織層。」

## 對 ExClinCalc / Kaizei / portfolio 的呼應

- **EncryptionProvider** 跟 Kaizei 的零知識加密 vault 是同一個工程方法
- **AuditLogger** 跟 ExClinCalc 的稽核軌跡是同一個設計動機
- **ConsentManager** 對應 FHIR Consent resource、是 ExClinCalc 患者同意流程的 FHIR 版本
- **FhirValidator** 跟 ExClinCalc 的 PostgreSQL CHECK constraint 是同一層思維（資料正確性在邊界驗）

→ Clin- 系列三件作品的設計理念**是一致的**、不是各做各的。

## 驗證

- ✅ `npm run build` 通過（2026-05-15、6.44s）
- ✅ Zero runtime impact（純加檔、未動原有 code）
- ✅ Type-safe（所有實作都 `implements` 對應 interface、TypeScript 編譯通過）

## 下一步（Day 2-5）

- **Day 2**：ExClinCalc 寫 STRIDE Threat Model → `D:\exclinclac\docs\THREAT_MODEL.md`
- **Day 3**：clinconvert UI 加「加密匯出」按鈕 + 落實 EncryptionProvider 真實流程
- **Day 4**：clinconvert UI 加「上傳到 FHIR server」面板 + docker-compose.yml + HAPI demo
- **Day 5**：寫 `docs/RESEARCH_NOTE.md`「FHIR pre-step」研究 note + `/research` 頁面

## TODO（之後再加）

- [ ] 寫 `tests/interfaces.test.ts`（每個 interface 一個 mock + 一個 default 實作測試）
- [ ] 在 README.md 加一段「Reference Architecture」介紹（給未來研究員看）
- [ ] 在 `src/pages/index.astro` 加一句說明（給普通使用者看）
