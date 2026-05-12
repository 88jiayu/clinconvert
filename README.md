# clinconvert ⇄ FHIR R4

> 把病歷資料從 **XLS / XLSX / CSV / JSON** 轉成符合 **HL7 FHIR R4** 標準的 Bundle JSON。
> 完全瀏覽器本地處理 — 檔案不離開你的裝置。
> 江家寓的「Clin- 系列」第三個作品，跟 [ClinCalc](https://github.com/RO883C/clincalc) / [ExClinCalc](https://github.com/RO883C/exclincalc) 同一系列。

---

## 為什麼做這個

衛福部 2026 年目標完成全台**醫學中心 FHIR 電子病歷互通**（中山、長庚、馬偕已示範完成）；2028 年擴及衛生所、診所。

但**中小型診所、護理之家、研究者**手上的資料還在 Excel / CSV 階段。`clinconvert` 是給這個過渡情境用的工具：

- 把 Excel 病人名冊 → FHIR Patient bundle
- 把體檢 XLS → FHIR Observation（含 LOINC 編碼）
- 把自家 schema JSON → 標準 FHIR R4 resource

大醫院的 HIS DB → FHIR 已有 [MIRTH Connect](https://www.nextgen.com/products-and-services/integration-engine) 與 [HAPI FHIR](https://hapifhir.io/) 等 ETL 框架。本工具填補的是「**資料還在 Excel 階段**」的小場景。

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
