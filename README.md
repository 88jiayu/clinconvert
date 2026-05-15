# clinconvert ⇄ FHIR R4

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/88jiayu/clinconvert/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![FHIR R4](https://img.shields.io/badge/FHIR-R4-orange)](https://hl7.org/fhir/R4/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Astro](https://img.shields.io/badge/Astro-Static-FF5D01?logo=astro)](https://astro.build/)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8)](https://web.dev/progressive-web-apps/)
[![AES-256-GCM](https://img.shields.io/badge/Encryption-AES--256--GCM-blue)](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)

> 把病歷資料從 **XLS / XLSX / CSV / JSON** 轉成符合 **HL7 FHIR R4** 標準的 Bundle JSON。
> 完全瀏覽器本地處理 — 檔案不離開你的裝置。
> 江家寓的「Clin- 系列」第三個作品，跟 [ClinCalc](https://github.com/RO883C/clincalc) / [ExClinCalc](https://github.com/RO883C/exclincalc) 同一系列。

---

## 為什麼做這個（定位與限制）

台灣衛福部正在推動以 **FHIR R4** 為國家醫療資訊互通標準。目前**中山、長庚、馬偕等示範醫院**已導入；政策路線圖未來覆蓋區域醫院與診所，但**現階段仍處於少數大型醫院實作階段**，診所端目前並沒有實際在做 FHIR 轉檔。

`clinconvert` 是一個 **research-grade proof-of-concept**，**不是**「現在能給診所直接用的 production tool」。它的存在價值在：

- **工程展示**：完整實作 XLS / CSV / JSON → FHIR R4 batch pipeline、Adapter pattern、Web Worker pool、結構驗證、PWA 離線
- **研究議題**：探索「醫療資料本地處理 + LLM 安全嵌入 + 大架構整合」這幾個我關心的設計議題
- **學習材料**：開源 + 文件完整，供其他開發者學習 FHIR R4 結構

### 跟既有開源專案的關係

台灣已有更成熟的開源專案，例如 **[療心智能 Taiwan-Health-MCP](https://github.com/healthymind-tech/Taiwan-Health-MCP)**（148 stars；Python + FastMCP + PostgreSQL；整合 ICD-10 / LOINC / 台灣 FDA 資料），他們做的是「**FHIR 資料 → LLM 透過 MCP 協議查詢**」。

`clinconvert` 解決的是不同層次的問題：「**Excel 資料 → FHIR Bundle**」── 這是 pre-step，跟前者互補不重疊。

### 真正臨床落地需要的東西（本工具不解決，但要意識到）

- **合規傳輸加密**：醫療資料跨系統傳輸涉及個資法、HIPAA 對應要求、AES-GCM 等規定的加密方式
- **HIS / EMR 架構整合**：standalone tool 沒辦法落實，必須跟既有臨床系統打通
- **FHIR 認證的 server 端**：HAPI FHIR、Smile CDR 等 production-grade server
- **臨床安全驗證**：HAPI FHIR validator、Inferno (ONC-HIT) 等專業工具

---

## 設計選擇

### 🔒 隱私先行

所有解析、映射、輸出都在瀏覽器本地完成。**檔案永遠不上傳**。

實作：
- SheetJS 在 Web 端 parse XLSX
- FHIR resource 在 client TypeScript 內建構
- 下載透過 `Blob` + `URL.createObjectURL`

→ 即使 Cloudflare Pages 被攻破，也讀不到使用者資料。

### 🧩 Adapter Pattern

```
Input Adapters → Internal Model → Mapping Engine → FHIR Builders → Output Adapters
   xlsx                                                                Bundle JSON
   csv                                                                 NDJSON
   json                                                                Transaction Bundle
   (v2: hl7v2)                                                         (v2: 反向轉 XLS)
   (v3: dicom)
```

新增輸入 / 輸出格式 = 加一個 adapter，不必動 FHIR builder。

### 📐 跟 FHIR R4 規範對齊

只支援標準 FHIR R4 resource type、用 LOINC 編碼指標、JSON 結構驗證可過 [HAPI FHIR validator](https://hapifhir.io/hapi-fhir/docs/validation/introduction.html)。

---

## 目前支援（v1）

### Input 格式

| 格式 | 副檔名 | 備註 |
|---|---|---|
| XLSX | `.xlsx` | SheetJS, 多 sheet 支援 |
| XLS | `.xls` | 同上 |
| CSV | `.csv` | 走 SheetJS |
| JSON | `.json` | array of objects 或 ExClinCalc 自家 schema |

### FHIR R4 Resource

| Resource | HL7 spec | 對應 |
|---|---|---|
| `Patient` | [link](https://hl7.org/fhir/R4/patient.html) | 身分、姓名、性別、生日、聯絡方式 |
| `Encounter` | [link](https://hl7.org/fhir/R4/encounter.html) | 就診紀錄、狀態、時間段 |
| `Observation` | [link](https://hl7.org/fhir/R4/observation.html) | 檢驗值、生命徵象（LOINC 編碼）|

### 預設映射範本（一鍵套用）

| 範本 ID | 用途 |
|---|---|
| `exclincalc-patients` | ExClinCalc patients 表 → FHIR Patient |
| `exclincalc-encounters` | ExClinCalc 掛號 / SOAP → FHIR Encounter |
| `nhi-prescription-patient` | 健保處方箋姓名 / 身分證 / 生日 → FHIR Patient |
| `kdigo-observations` | KDIGO 體檢值（eGFR / Cr / HbA1c）→ FHIR Observation |

### Output 格式

| 格式 | 用途 |
|---|---|
| **Bundle JSON (collection)** | 標準 FHIR Bundle，適合檔案匯出、研究用 |
| **Transaction Bundle** | 可直接 `POST` 到 FHIR server 做批次寫入 |
| **NDJSON** | Newline-delimited，給大量資料 streaming 匯入 |

---

## 規劃中（v2 / v3）

### v2

- [ ] `Medication` / `Condition` / `Procedure` resource
- [ ] HL7 v2 message → FHIR R4 轉換（大醫院主流場景）
- [ ] 反向轉換：FHIR → XLS（給診所人員看的格式）
- [ ] 對接 [HAPI FHIR public test server](http://hapi.fhir.org/) 做 round-trip 驗證
- [ ] 自訂 mapping designer（拖拉 UI）

### v3

- [ ] DICOM metadata → FHIR ImagingStudy
- [ ] CCDA (Continuity of Care Document) → FHIR
- [ ] FHIR ePrescription / 健保處方箋雙向

---

## 本地開發

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # → dist/
npm run preview      # 預覽 build 結果
```

需求：Node 22+。

## 技術棧

- [Astro](https://astro.build/) 6 — Static site generator
- [SheetJS / xlsx](https://sheetjs.com/) — XLSX 解析
- TypeScript strict mode
- 純 CSS（無 Tailwind）
- 部署於 Cloudflare Pages

## 部署

```bash
# Push 到 GitHub repo
git init
git add .
git commit -m "Initial commit"
gh repo create clinconvert --public --source=. --push

# Cloudflare Pages: Connect to Git → 選 clinconvert repo
#   Framework preset: Astro
#   Build command:    npm run build
#   Build output:     dist
```

## 程式碼導覽

| 想看什麼 | 看哪個檔 |
|---|---|
| FHIR R4 type definitions | [`src/lib/fhir/types.ts`](src/lib/fhir/types.ts) |
| Patient / Encounter / Observation builder | [`src/lib/fhir/builders.ts`](src/lib/fhir/builders.ts) |
| XLSX / CSV adapter | [`src/lib/adapters/xlsx.ts`](src/lib/adapters/xlsx.ts) |
| JSON adapter | [`src/lib/adapters/json.ts`](src/lib/adapters/json.ts) |
| 預設映射範本 | [`src/lib/mapping/templates.ts`](src/lib/mapping/templates.ts) |
| 欄位 transform（民國 → 西元 / 性別 / 電話）| [`src/lib/mapping/transforms.ts`](src/lib/mapping/transforms.ts) |
| Bundle / NDJSON 輸出 | [`src/lib/output/bundle.ts`](src/lib/output/bundle.ts) |
| UI 跟 wiring | [`src/pages/index.astro`](src/pages/index.astro) |

## Clin- 生態系

本作品是 **Clin- 系列**之一 ── 4 件作品共用同一套技術主軸
（Cloudflare Workers + Supabase + PostgreSQL RLS + TypeScript strict）。
不是各做各的、是**一個生態系**、環環相扣：

| 作品 | 角色 | 對應 |
|---|---|---|
| [ClinCalc](https://github.com/RO883C/clincalc) | 民眾端 · 健康自查 + AI 解讀 | 入口：把醫療資料變得**看得懂** |
| [ExClinCalc](https://github.com/RO883C/exclincalc) | 醫事端 · 診所 CDSS | 流程：醫師 / 護理師 / 藥師完整工作流 |
| **clinconvert**（本作品） | 互通研究 · FHIR R4 轉換 POC | 標準化：跨機構資料**可互通** |
| [Kaizei](https://jiayuselfweb.pages.dev/projects/kaizei) | 跨領域 · Personal Finance OS | 證明同套工程方法**跨領域複用** |

設計理念：**隱私先行（local 端處理）· 規則優於 LLM · 安全在資料庫層**。
詳見[個人網站](https://jiayuselfweb.pages.dev)。

## License

MIT — 學術與非商業用途自由使用。商業使用請先聯絡。

本工具僅供資料格式轉換，**不對 FHIR 輸出做臨床正確性保證**。
正式應用前請以 [HAPI FHIR validator](https://hapifhir.io/) 或 [Inferno](https://inferno.healthit.gov/) 驗證。

## 我是誰

**江家寓 / Chia-Yu Chiang**
銘傳大學 生物醫學工程學系 · 2026 應屆畢業

🌐 [jiayuselfweb.pages.dev](https://jiayuselfweb.pages.dev)
📧 yuyulsc881209@icloud.com
💻 GitHub：[github.com/RO883C](https://github.com/RO883C)

歡迎研究合作、issue 討論、PR。
