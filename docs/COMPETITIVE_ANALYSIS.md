# clinconvert 競品分析 + 定位 + 設計決策

> 為什麼是 browser-side、為什麼是 modular、跟業界既有工具的關係。
>
> 寫於 2026-05-14，給推甄面試 + 研究計劃 + 自己半年後不會忘記用。

---

## 〇、起源

2026-05-13 指導教授校準：
> 「目前診所都沒有進行轉檔，政府只有給幾家大醫院開始 ... 醫療資料若要真的傳輸，非常注重安全性 ... 若是強調隱私的東西，可能要考慮在 local 端 ... 落實應用需放在大的架構下和其他系統做連接。」

→ clinconvert 必須**重新定位為「研究型 POC + 模塊化 reference architecture」**，不是「給診所過渡用的 production tool」。

本文件回答兩個問題：
1. 業界已經有什麼工具？clinconvert 在哪？
2. browser-side + modular 為什麼是對的選擇？

---

## 一、業界 FHIR 轉檔 / 整合工具總表

| 工具 | 類型 | 輸入格式 | 部署 | License | Browser? | 簡評 |
|---|---|---|---|---|---|---|
| [HAPI FHIR](https://hapifhir.io/) | FHIR Server（Java） | FHIR | Self-host Java + DB | Apache 2.0 | ❌ | 業界標準 FHIR server，**不是 converter** |
| [MIRTH Connect](https://github.com/nextgenhealthcare/connect) | ETL Engine（Java） | HL7v2 / CSV / JSON / FHIR | Self-host Java | ⚠️ 2024 起 NextGen 商業化 | ❌ | de-facto 醫院整合引擎 |
| [Microsoft FHIR Converter](https://github.com/microsoft/FHIR-Converter) | Converter（C# / Liquid） | HL7v2 / C-CDA / JSON | Docker / Azure Container Apps | MIT | ❌ | 508 stars，最後 release 2022/11（停更跡象）|
| [FUME](https://www.fume.health/) | Converter（mapping DSL） | CSV / HL7v2 / JSON / XML / C-CDA | Server + Web Playground | Community GitHub | ⚠️ Playground 是 server-backed，資料會送出 | 自家 mapping 語言、自動 profile 注入 |
| [Metriport FHIR Converter](https://www.metriport.com/fhir-converter) | API service | C-CDA / HL7v2 / PDF | Cloud API | Open source | ❌ | SaaS / API service |
| [CODA-19 csv-to-fhir](https://github.com/CODA-19/csv-to-fhir) | CLI scripts | CSV | Python CLI | MIT | ❌ | 研究用 anonymized CSV 腳本集 |
| [CSV-FHIR-Transformer](https://github.com/alkarkoukly/CSV-FHIR-Transformer) | Mirth channel | CSV | 需先裝 Mirth | MIT | ❌ | 一個 Mirth channel 模板而已 |
| [InterSystems IRIS FHIR Bridge](https://openexchange.intersystems.com/package/iris-fhir-bridge) | Commercial | CSV 等 | Self-host or cloud | 商業 | ❌ | 大企業方案 |
| [Taiwan-Health-MCP](https://github.com/healthymind-tech/Taiwan-Health-MCP) | **MCP server + FHIR query** | 醫療代碼（ICD-10、SNOMED、LOINC、RxNorm） | Docker Compose（PG16 + pgBouncer + Redis + Python 3.12） | MIT | ❌ | **不是 converter，是給 LLM 用的查詢服務**，148 ⭐ |
| **clinconvert**（這個）| Converter | XLS / CSV / JSON | **Static site (Cloudflare Pages)** | MIT | **✅ 純瀏覽器** | Adapter / Web Worker pool / PWA |

---

## 二、clinconvert 的差異化定位

對照上表，**沒有一個工具同時做到**：

1. ✅ 純瀏覽器（檔案絕對不上傳）
2. ✅ 零安裝（打開 URL 就用）
3. ✅ PWA 離線可用
4. ✅ 直接吃 Excel（不是只有 CSV）
5. ✅ TypeScript + 現代 web 技術棧（不是 Java / C# / Python）
6. ✅ Adapter pattern + 模塊化 interface（給研究 / 教學用）

**這六點交集 = clinconvert 的 niche**。

### 跟最相近的 FUME 比

FUME 有 Web Playground，看起來最像 clinconvert。**但**：
- FUME Playground 是 **server-backed**（資料送到 FUME 後端處理）
- clinconvert 是 **client-only**（資料完全不離開瀏覽器）
- → 隱私保證是**架構等級**而不是**政策等級**

### 跟 Taiwan-Health-MCP 比

兩者**不在同一層**，是**互補**：

| 層 | Taiwan-Health-MCP | clinconvert |
|---|---|---|
| 目的 | 給 LLM 查台灣醫療代碼 + FHIR 資源 | 把 Excel/CSV 變成 FHIR Bundle |
| 輸入 | 醫療代碼（ICD/SNOMED/LOINC） | 任意 Excel/CSV |
| 輸出 | FHIR resource（給 LLM 用） | FHIR Bundle（給 server / 學生用） |
| 部署 | Docker Compose（重） | Static site（零部署）|
| 使用者 | 開發 LLM 應用的 dev | 整理 Excel 的研究者 / 學生 |

→ **clinconvert 是 pre-step，Taiwan-Health-MCP 是 LLM consumption。資料流上不衝突。**

---

## 三、誠實的弱點（要主動承認）

| 弱點 | 競品 |
|---|---|
| 只實作 Patient / Encounter / Observation 三種 resource | HAPI / MIRTH 全部 FHIR R4 resource 都支援 |
| 沒 persistence（不是 FHIR server）| HAPI 是 |
| 沒 HL7 v2 parsing | MIRTH / Microsoft Converter 主力 |
| 沒 production deployment | 全部競品都有真實醫院案例 |
| 沒 audit log / compliance cert | 商業競品都有 |
| Single user / batch only，無 real-time integration | MIRTH 強項 |

**面試時要主動講這些**，不要等問。

---

## 四、為什麼 browser-side 是正確選擇

### Pros

1. **隱私是架構保證、不是政策口號**
   - Server tool：使用者必須**信任**服務商隱私政策
   - clinconvert：架構上**做不到上傳**，CSP `connect-src 'none'` 可驗證
   - → 在 GDPR / HIPAA 對話裡這是**重要的技術 argument**

2. **零基建成本**
   - HAPI / MIRTH / FUME / MS Converter：都需要 server（Java VM、Docker、Azure）
   - clinconvert：Cloudflare Pages free tier，月成本 **$0**
   - → 對學生 / 研究者 / 小診所 / 非營利組織友善

3. **零安裝門檻**
   - HAPI：裝 Java + PostgreSQL + 設定 yml
   - MIRTH：裝 Java + Channel 設計
   - clinconvert：打開 URL
   - → 推甄 demo 現場可以**馬上開來給教授看**，這個現場 demo 力是其他工具沒有的

4. **PWA + 離線**
   - 沒網路（醫院內網、出差）也能用
   - 競品大都需要 server connection

5. **跨平台**（任何裝置 + 任何瀏覽器）
   - 競品基本上限定 Java / .NET / Python runtime

### Cons（不能裝沒事）

1. **資料量限制**
   - 瀏覽器 RAM 限制大約 4GB 上限，50k 列以上 Excel 會卡
   - 解：clinconvert 已加 Web Worker Pool + chunked processing，但仍有上限
   - 競品 server 沒這個限制

2. **沒辦法當 production hospital tool**
   - 醫院 IT 環境通常**強制 server-side**（稽核、權限、整合）
   - clinconvert 結構上做不了
   - → 這也是為什麼定位「**研究 POC**」而非「production tool」

3. **缺乏 server-side 才能做的事**
   - 不能集中稽核（每個 user 的 audit log 散在 browser）
   - 不能跨 user 共享（每人各做各的）
   - 不能 server-to-server FHIR push

### 結論

**browser-side 對下列場景是正確選擇**：
- 研究者 / 學生 / 教育用途
- 隱私敏感的 pre-step 處理
- 工程展示 / portfolio
- 跨組織的「最小信任」場景

**browser-side 對下列場景不是**：
- 大型醫院 production
- Real-time integration
- 跨 user 共享資料

→ clinconvert 屬於前者，**設計目標跟使用場景一致**。

---

## 五、為什麼 modular interface 是正確選擇

### 模塊化策略 — 教授問題的答案

> 「如果模塊化弄起來之後，再微調補接口協議規定，有辦法嗎？」

**技術層：可以。非技術層：不能。**

#### 技術層（純 code、可以後期插）

| 層 | Interface 名稱 | 後期可插的東西 |
|---|---|---|
| 輸入 | `InputAdapter` | HL7 v2 parser、CCDA parser、Cerner schema、Epic schema |
| 輸出 | `TransportProvider` | HAPI POST、衛福部中台 API、MIRTH channel |
| 加密 | `EncryptionProvider` | AES-GCM、ChaCha20、醫院指定演算法 |
| 認證 | `AuthProvider` | OAuth2、SMART on FHIR、自家 |
| 驗證 | `FhirValidator` | 國際 base profile、台灣 NHI profile、機構自家 profile |
| 稽核 | `AuditLogger` | localStorage、IndexedDB、server-side log push |
| 同意 | `ConsentManager` | FHIR Consent resource、書面表單轉檔 |

→ 這個 plug-in 設計**HAPI / MIRTH 都這麼做**，是業界 best practice。

#### 非技術層（不能後期補）

| 層 | 為什麼不能後期補 |
|---|---|
| HIPAA / 個資法合規認證 | 需要認證機構審查 + 法務 + 持續稽核 |
| IRB 倫理審查 | 需要醫院倫理委員會 + 真實 PHI 存取權 |
| HSM / KMS 實體基建 | 需要 ops 團隊 + 硬體 |
| 醫院 HIS 整合測試 | 需要醫院簽 NDA + 提供測試環境 |
| 滲透測試認證 | 需要付費認證機構 |
| 保險 + 責任歸屬 | 需要法律架構 |

→ 這些**不是模塊化能解的**，需要組織層級的資源。

### 對外的講法

> 「我的架構是 **reference architecture for future plug-in**。技術層的 adapter / encryption / transport / auth 都抽象化了，未來如果有醫院 IT 接手做合規認證，code 層不需要重寫。但合規、認證、IRB 這些不是 code 能解的，需要組織與資源層級的投入 ── 這也是我希望進研究所深入研究『可實作的醫療系統架構』的原因。」

**這種講法教授會買單**，因為**承認限制 = 學術成熟度**。

---

## 六、具體要做的 6 個 interface（給未來自己看）

位置：[clinconvert/src/lib/core/interfaces.ts](D:/clinconvert/src/lib/core/interfaces.ts)（待建）

```typescript
// 1. 輸入 adapter（已有，現在要正式抽象化）
export interface InputAdapter {
  readonly name: string;
  readonly supportedFormats: readonly string[];  // ['xlsx', 'xls', 'csv', 'json']
  parse(file: File): Promise<RawData[]>;
}

// 2. 加密
export interface EncryptionProvider {
  readonly algorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305';
  deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey>;
  encrypt(plaintext: Uint8Array, key: CryptoKey): Promise<EncryptedPayload>;
  decrypt(payload: EncryptedPayload, key: CryptoKey): Promise<Uint8Array>;
}

// 3. 傳輸
export interface TransportProvider {
  readonly name: string;
  send(bundle: FhirBundle, endpoint: string, auth?: AuthToken): Promise<TransportResult>;
}

// 4. 認證
export interface AuthProvider {
  readonly type: 'oauth2' | 'smart-on-fhir' | 'bearer' | 'none';
  getToken(): Promise<AuthToken>;
  refresh?(): Promise<AuthToken>;
}

// 5. 驗證
export interface FhirValidator {
  readonly profileUrl: string;
  validate(bundle: FhirBundle): Promise<ValidationReport>;
}

// 6. 稽核
export interface AuditLogger {
  readonly storage: 'memory' | 'localStorage' | 'indexedDB' | 'remote';
  log(event: AuditEvent): Promise<void>;
  query(filter?: AuditFilter): Promise<AuditEvent[]>;
}

// 7. 同意（FHIR Consent resource 對應）
export interface ConsentManager {
  record(consent: ConsentRecord): Promise<void>;
  check(patientId: string, purpose: string): Promise<ConsentStatus>;
}
```

每個 interface 都會：
- 寫一個現用的 default 實作（例 `WebCryptoEncryption`、`DownloadOnlyTransport`）
- 寫 docs 註明「Future plug-in points」
- 寫 mock 實作給 testing

---

## 七、5 天執行計劃

| Day | 任務 | 產出 | 估時 |
|---|---|---|---|
| 1 | 設計 7 個 interface + 重構現有 code 套上 | `src/lib/core/interfaces.ts` + 既有 adapter 改套介面 | 4-6h |
| 2 | ExClinCalc threat model 文件（STRIDE）| `D:\exclinclac\docs\THREAT_MODEL.md` | 3-4h |
| 3 | 落實 EncryptionProvider（Web Crypto AES-GCM）| 「加密匯出」UI + module | 3-4h |
| 4 | 落實 TransportProvider（HAPI FHIR server demo）| `docker-compose.yml` + 介面加 endpoint | 3-4h |
| 5 | 寫研究 note：「FHIR pre-step 為什麼少人系統性做」 | `clinconvert.pages.dev/research` 新頁面 + repo `docs/RESEARCH_NOTE.md` | 4-5h |

**Total**：約 17-23 小時，5-7 天完成。完成後**對外敘事**升一級：

```
舊：「我做了 FHIR 轉檔工具」
新：「我設計了 modular reference architecture，
     落實 client-side encryption + HAPI 對接 demo，
     寫了一份 pre-step research note 分析業界現有工具的 gap。」
```

---

## 八、參考資料

研究時讀過的東西，給未來自己 trace back：

- [Microsoft FHIR Converter GitHub](https://github.com/microsoft/FHIR-Converter)
- [HAPI FHIR Official](https://hapifhir.io/)
- [MIRTH Connect FHIR Support](https://mirth.support/blog/mirth-connect-fhir-healthcare-data-interoperability)
- [FUME FHIR Converter](https://www.fume.health/)
- [FUME Community GitHub](https://github.com/Outburn-IL/fume-community)
- [CODA-19 CSV-to-FHIR](https://github.com/CODA-19/csv-to-fhir)
- [Taiwan-Health-MCP GitHub](https://github.com/healthymind-tech/Taiwan-Health-MCP)
- [療心智能 開源揭幕 blog](https://www.healthymind-tech.com/blog/開源揭幕一taiwan-health-mcp-的誕生/)
- [Breaking Barriers for Interoperability paper](https://www.researchgate.net/publication/370894896_Breaking_Barriers_for_Interoperability_A_Reference_Implementation_of_CSV-FHIR_Transformation_Using_Open-Source_Tools)
- [Mirth Connect Alternatives 2026](https://nirmitee.io/blog/mirth-connect-alternatives-2026-after-licensing-change/)
- [FHIR Validator (HL7 Official)](https://wiki.hl7.org/Using_the_FHIR_Validator)

---

## 九、文件版本

| 日期 | 變動 | 作者 |
|---|---|---|
| 2026-05-14 | 初版 | Chia-Yu Chiang + Claude |
