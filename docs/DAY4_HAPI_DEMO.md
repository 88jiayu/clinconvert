# Day 4 — HAPI FHIR server demo（落實 TransportProvider）

> 2026-05-15 完成

## 做了什麼

把 Day 1 的 `HapiFhirTransportStub`（純 stub）替換成真實的 `HapiFhirTransport`。同時加 `docker-compose.yml` + UI 進階面板，讓使用者可以**現場 POST Bundle 到本地 HAPI FHIR server**。

**完整 flow**：
```
1. 使用者 docker-compose up（背景跑 HAPI + Postgres 約 30-60 秒）
2. clinconvert UI 展開「進階：上傳到 FHIR server」面板
3. 填 endpoint http://localhost:8080/fhir
4. 按「🩺 試連線」確認 server 跑起來 → GET /metadata
5. 按「↗ Send Collection / Transaction Bundle」
6. registry.audit.log({ action: 'transport.send', ... }) ← 自動稽核
7. server 回應顯示在 console-style log（綠色成功 / 紅色錯誤）
```

## 新增 / 修改檔案

```
docker-compose.yml                          ← NEW
  - HAPI FHIR v7.4.0 + PostgreSQL 16
  - 開 CORS、開 $validate、R4 模式

src/lib/impl/hapi-transport.ts              ← NEW
  - HapiFhirTransport implements TransportProvider
  - .send(bundle, endpoint, auth) → 真實 fetch POST
  - .ping(endpoint) → GET /metadata 確認連線
  - 處理 transaction vs collection 不同 endpoint

src/pages/index.astro                       ← EDIT
  - 加 import HapiFhirTransport
  - 加 <details> 進階面板（endpoint + token + 3 個按鈕 + log）
  - 加 handler: ping / send collection / send transaction
  - 加 CSS .hapi-panel
```

## 為什麼這個 demo 重要

**對推甄面試**：
- 直接回應教授說的「**落實應用需放在大架構下、和其他系統做連接**」
- 推甄時現場 `docker-compose up` + 把 Bundle POST 進去 → 給教授看「整合到大架構」
- **沒有其他競品 demo 能在面試現場做到**

**對研究敘事**：
- HAPI 是業界 reference impl、對接成功 = 證明 clinconvert 輸出符合 HL7 標準
- 將來研究「FHIR-based CDSS」要從這個基礎延伸

**對工程展示**：
- 落實 Day 1 的 TransportProvider interface
- 寫一個新 transport（衛福部中台 / MIRTH）只要 implements TransportProvider 即可
- **不必動 UI / builder / encryption 任何 code**

## 跟 Day 1 的關聯

```
Day 1 TransportProvider interface
   ├── DefaultDownloadTransport ── 本地下載（既有行為）
   └── HapiFhirTransport (Day 4) ── 真實對接

未來：
   ├── MohwMiddlewareTransport ── 衛福部中台（如有 sandbox）
   ├── MirthChannelTransport ── MIRTH channel
   └── 自家 EHR 內部 API
```

每個只要 implements TransportProvider、其他層完全不必動。**這就是模塊化的價值**。

## 對外敘事

> 「我加了 Docker compose 把 HAPI FHIR server 本機跑起來，clinconvert 可以把 Bundle POST 到 `http://localhost:8080/fhir`。對接 HAPI = 證明輸出符合 HL7 R4 標準。
>
> 我落實了 Day 1 寫的 TransportProvider interface ── `HapiFhirTransport` 是其中一個實作、跟 `DefaultDownloadTransport` 同 interface、可互換。未來如果衛福部開放中台 sandbox、我寫一個 `MohwMiddlewareTransport` 就能對接、UI / builder code 一行不必動。
>
> 這是教授說的『整合到大架構』的具體展示。」

## 驗證

- ✅ `npm run build` **4.66s pass**（2026-05-15 03:03）
- ✅ Docker compose 純 YAML、不影響 build
- ✅ TypeScript 編譯通過（HapiFhirTransport 完全符合 TransportProvider interface）

## 推甄面試 demo 腳本（用這份）

```
教授：「你的工具怎麼整合到大架構？」

你（30 秒）：「我有 HAPI FHIR server 對接 demo，老師現在如果有 Docker、
              我們可以現場 docker-compose up、把 Bundle POST 進去看結果。」

（如果現場可以跑）：
1. 開 terminal、cd 到 clinconvert/
2. docker-compose up
3. 等 30 秒
4. 開 clinconvert.pages.dev、上傳 sample 檔
5. 展開「進階：上傳到 FHIR server」面板
6. 按「🩺 試連線」→ ✅ 連線成功
7. 按「↗ Send Collection Bundle」→ 顯示 HAPI 回應的 OperationOutcome
8. 「老師可以直接在 http://localhost:8080/fhir/Patient 看到剛上傳的 resource」

（如果現場不能跑）：
   開錄好的 screen recording GIF / 影片
   說明：「這個 demo 之前我在自己 laptop 跑過、附在 docs/DAY4_HAPI_DEMO.md」
```

## TODO（之後可加）

- [ ] 錄一段 30 秒 demo GIF 放到 docs/、面試現場備案
- [ ] 加「HAPI server response 解析」── 把 OperationOutcome 變成中文友善顯示
- [ ] 加 retry mechanism（network flaky 時）
- [ ] 加 batch send（一次送多個 Bundle）
- [ ] 加 SMART on FHIR OAuth2 flow（給未來研究階段、需要 IRB 等）
