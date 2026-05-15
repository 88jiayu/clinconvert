# Day 5 — Research Note + /research 頁面

> 2026-05-15 完成

## 做了什麼

寫一份**正式格式研究 note**（含 abstract / RQ / references / appendix）+ 上線 `/research` 互動頁面（含「FHIR pre-step 摘要」+「加密檔案解密工具」）。

## 新增檔案

```
docs/RESEARCH_NOTE.md                       ← NEW
  - Abstract（英 / 中）
  - Problem statement
  - Survey（9 工具表）
  - 3 個 RQ + publication target
  - Limitations（誠實列）
  - References（10 篇）
  - Appendix A: 架構 ASCII 圖
  - Appendix B: 實作統計
  - 中文版（給推甄面試直接用）

src/pages/research.astro                    ← NEW
  - /research 頁面
  - Note 摘要 + 3 個 RQ 顯示
  - 連結到 GitHub 完整文件
  - 解密工具 UI：拖檔 + passphrase + 解密 + 預覽 + 下載
```

## 修改檔案

```
src/pages/index.astro                       ← EDIT（加 1 行 link to /research）
```

## Research Note 重點

### 3 個 RQ

1. **RQ1 · Schema mapping under uncertainty**
   - Question: 任意欄位名 → FHIR 欄位自動可驗證 mapping
   - Target: AMIA Annual Symposium, JMIR Medical Informatics

2. **RQ2 · Privacy in browser-only architecture**
   - Question: 「資料從不離開瀏覽器」可驗證的架構屬性
   - Target: USENIX Security, IEEE S&P workshops

3. **RQ3 · Modular reference architecture for healthcare**
   - Question: 同份 codebase 服務小診所 / 研究者 / 大醫院（composition vs fork）
   - Target: ICSE, FSE, IEEE TSE

### 對推甄的價值

> 「我寫了一份 FHIR pre-step 研究 note，討論為什麼 Excel → FHIR 這個前置步驟少有系統性研究。
>
> 我調查了 9 個業界 / 開源工具、發現它們都假設輸入是良好格式 ── 但實際小診所、護理之家、研究者的真實情況是 Excel chaos。
>
> 我提出三個研究方向、每個都有具體 publication target。希望進  貴所深入做。」

→ **這份 note 證明你「會寫研究 statement」**、不只是「會寫 code」。

## 解密工具

`/research` 頁面下半部是**互動式解密工具**：
1. 使用者拖 `.fhir.enc.json` 進去（從首頁加密匯出產生）
2. 輸入 passphrase
3. 按解密 → 顯示原 Bundle（前 6000 字）
4. 按下載 → 取回 `.fhir.json` 原檔

**整個解密在瀏覽器跑、檔案 / passphrase 從不上傳** ── 跟首頁設計一致。

## 驗證

- ✅ `npm run build` **4.94s pass**（2026-05-15 03:07）
- ✅ **4 個頁面** build 出來（/、/en、/mapping-designer、/research）
- ✅ /research 頁面解密工具用 registry.encryption（跟 Day 3 加密同一個 module、可往返驗證）

## 5 天計劃 — 完整總結

| Day | 主要工作 | 主要 deliverable | Build 驗證 |
|---|---|---|---|
| 1 | 7 個 interface + registry | `src/lib/core/interfaces.ts` + `registry.ts` + 8 個 impl 檔案 | ✅ 6.44s |
| 2 | ExClinCalc STRIDE | `D:\exclincalc\docs\THREAT_MODEL.md` | (純文件) |
| 3 | Web Crypto 加密 UI | 加密匯出按鈕 + `src/lib/output/encrypted.ts` | ✅ 4.79s |
| 4 | HAPI FHIR demo | `docker-compose.yml` + UI 進階面板 + `hapi-transport.ts` | ✅ 4.66s |
| 5 | Research note + /research | `RESEARCH_NOTE.md` + `src/pages/research.astro` | ✅ 4.94s |

## 對外敘事升級對照

```
舊（5 天前）：
  「我做了 FHIR 轉檔工具」

新（今天）：
  「我設計了 modular reference architecture（7 個 plug-in interface）+
   落實 client-side Web Crypto 加密匯出 +
   HAPI FHIR server 對接 demo（docker-compose 啟動）+
   STRIDE 威脅模型分析（覆蓋 24 個威脅）+
   寫了一份 FHIR pre-step research note 分析業界 gap、
   提出 3 個明確 RQ 與 publication target。」
```

## 還沒做（給之後 / push GitHub 前可加）

- [ ] 錄一段 30 秒 demo GIF（HAPI docker-compose up + clinconvert 上傳 → server 收到）
- [ ] 補 portfolio 截圖（27-Portfolio-PDF模板.md 列了 4 件作品的截圖點）
- [ ] `npm audit` 漏洞修補（之前 PS1 列、用戶選擇延後）
- [ ] **推 GitHub**（要 review 後才推）
