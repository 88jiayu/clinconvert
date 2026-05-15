# 5 天升級成果 — 測試指南

> 給用戶 review 完整功能。順序照 Day 1 → 5。

---

## 0. 啟動 dev server

```bash
cd D:\clinconvert
npm run dev
```

預期看到：
```
astro  v6.x  ready in xxx ms
┃ Local    http://localhost:4321/
```

開瀏覽器到 `http://localhost:4321`。

---

## 1. 測試 Day 1 — 既有功能應該沒壞

打開首頁，**確認跟之前一模一樣**：

| 行為 | 預期 |
|---|---|
| 上傳 [sample-patients.csv](https://clinconvert.pages.dev/sample-data/sample-patients.csv) | ✅ 自動解析、產出 Patient 等 resource |
| 進度條動 | ✅ |
| Step 4 出現「下載 FHIR Bundle」| ✅ 4 個既有按鈕 + **新增 2 個按鈕** |
| 點「⬇ Bundle (collection)」| ✅ 下載 `fhir-bundle-xxx.json` 跟之前一樣 |
| 點「📦 完整整理包」| ✅ 下載 zip 跟之前一樣 |

**Day 1 deliverable**：interface 與 registry 是「**隱形重構**」、UI 不會看到變化、但 build 仍 pass。已驗證 ✅

---

## 2. 測試 Day 2 — 威脅模型文件

開檔案：[D:\exclincalc\docs\THREAT_MODEL.md](D:\exclincalc\docs\THREAT_MODEL.md)

**測試方式**：純閱讀。
- 看 24 個威脅是否合理
- 看「不解決的問題」section 是否誠實
- 想像面試官問「你的安全分析」、能不能用這份回答

---

## 3. 測試 Day 3 — 加密匯出

### 步驟

1. **首頁 → 上傳 sample-patients.csv**
2. 等處理完、Step 4 出現按鈕區
3. **找到新按鈕**「🔐 加密匯出 (.fhir.enc.json)」
4. **點下去** → 應該跳第一個 prompt：要求 passphrase（≥ 12 字）
5. 輸入測試 passphrase，例如：`MyTestPass2026!`
6. **應該跳第二個 prompt**：再輸入一次確認
7. 輸入同樣的 `MyTestPass2026!`
8. **應該下載**檔案 `fhir-bundle-xxxxxx.fhir.enc.json`
9. **alert 顯示**「✅ 加密匯出完成」+ 提醒保管 passphrase

### 驗證下載的檔案

用記事本打開 `.fhir.enc.json`，應該看到：
```json
{
  "$schema": "clinconvert-encrypted-bundle-v1",
  "algorithm": "AES-256-GCM",
  "kdf": "PBKDF2-SHA256-100000",
  "salt": "xxx...",
  "iv": "xxx...",
  "ciphertext": "xxx... (很長)"
}
```

### 錯誤情境測試

| 測試 | 預期行為 |
|---|---|
| Passphrase 輸入少於 12 字 | alert「至少 12 字、加密取消」 |
| 兩次 passphrase 不同 | alert「兩次輸入不同、加密取消」 |
| 取消第一個 prompt | 直接返回、不下載 |

---

## 4. 測試 Day 5 — 解密工具（**用 Day 3 產出的檔案驗證**）

### 步驟

1. **開新分頁** → `http://localhost:4321/research`
2. **應該看到頁面**：
   - 頂部：研究 note 摘要 + 3 個 RQ
   - 下半部：「🔐 解密工具」面板
3. **把 Day 3 產出的 `.fhir.enc.json` 拖進去** 或點選檔案
4. **應該顯示**檔名 + 大小
5. **輸入剛才用的 passphrase** `MyTestPass2026!`
6. **按「🔓 解密」**
7. **應該顯示**：原 FHIR Bundle JSON（前 6000 字）
8. **「⬇ 下載解密後 Bundle」按鈕出現**
9. 按下載 → 取回 `fhir-bundle-xxx.fhir.json`（去掉 `.enc`）
10. **打開驗證** → 內容跟 Day 3 加密前的 collection bundle 一模一樣

### 錯誤情境測試

| 測試 | 預期 |
|---|---|
| Passphrase 錯（輸入 `WrongPass1234!`）| 紅字錯誤：「解密失敗、AES-GCM auth tag 驗證失敗」 |
| 沒選檔就按解密 | 紅字：「請先選檔」 |
| 沒輸入 passphrase | 紅字：「請輸入 passphrase」 |
| 拖個亂的 JSON 進去 | 紅字：「不支援的 schema」 |

---

## 5. 測試 Day 4 — HAPI FHIR server demo（**選擇性、要有 Docker**）

### 先檢查 Docker 有沒有裝

```bash
docker --version
```

- 有 → 繼續測
- 沒有 → 跳過、看 [DAY4_HAPI_DEMO.md](./DAY4_HAPI_DEMO.md) 紀錄就好

### 步驟（有 Docker 的話）

1. **啟動 HAPI server**
   ```bash
   cd D:\clinconvert
   docker-compose up -d
   ```

2. **等 30-60 秒**（HAPI 啟動慢）
   ```bash
   # 確認跑起來
   curl http://localhost:8080/fhir/metadata
   # 應該回 JSON、約 50KB
   ```

3. **首頁 → 上傳 sample-patients.csv → 轉好後**

4. **找面板**「🏥 進階：上傳到 FHIR server」**展開**
5. **endpoint** 預設已填 `http://localhost:8080/fhir`
6. **按「🩺 試連線」**
   - 預期黑色 console log：
   - 第一行：`Pinging http://localhost:8080/fhir/metadata ...`
   - 然後綠字：`✅ 連線成功（FHIR 4.0.1）`

7. **按「↗ Send Collection Bundle」**
   - 預期：
   - `Sending collection bundle (N resources) → http://localhost:8080/fhir ...`
   - 綠字：`✅ HTTP 201` + server 回應的 OperationOutcome

8. **驗證 server 真的收到**
   ```bash
   curl http://localhost:8080/fhir/Patient
   # 應該看到剛剛 upload 的 Patient resource
   ```

9. **停 HAPI 用完**
   ```bash
   docker-compose down
   ```

### 錯誤情境

| 測試 | 預期 |
|---|---|
| Docker 沒跑就試連線 | 紅字 CORS / Network error |
| endpoint 改成隨便的 URL | 紅字 fetch failed |

---

## 6. 測試 /research 頁面（純資訊）

`http://localhost:4321/research`

**確認看到**：
- ✅ Note 摘要 + 3 個 RQ
- ✅ 連結到 GitHub 完整文件（會打開新分頁）
- ✅ 解密工具（已在第 4 點驗證）

---

## 7. 測試 build production

```bash
npm run build
npm run preview
# 開 http://localhost:4321 看 production 版
```

**預期**：跟 dev mode 行為一樣、但更快。

---

## 8. 推甄面試 demo 排練（給未來自己看）

```
教授：「demo 一下你的 clinconvert 吧。」

你（30 秒 demo）：
1. 開 clinconvert.pages.dev
2. 拖一個 sample Excel 上去
3. 「老師看、檔案在我瀏覽器處理、network tab 完全沒有 outbound request」
4. 30 秒後 Bundle 產出
5. 「點加密匯出、輸入 passphrase」
6. 「老師我同樣的工具也能解密 → /research 頁面」
7. （如果有 Docker）「我也對接到本地 HAPI server demo」
8. 「整個架構是模塊化的、未來換成衛福部中台只要替換一個 module」
```

---

## 9. 已知限制（用戶該知道）

| 限制 | 解 |
|---|---|
| Web Crypto SubtleCrypto 需 HTTPS / localhost | dev / production 都符合、不會有事 |
| HAPI server 啟動慢（30-60 秒）| 喝杯水的時間 |
| 大檔案（>50000 列）瀏覽器會卡 | 已有 Web Worker pool、但仍有上限 |
| 解密失敗看不出是 passphrase 錯還是檔案壞 | 設計如此（zero-knowledge 不能 leak info） |
