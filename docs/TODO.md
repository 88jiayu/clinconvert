# clinconvert — TODO

> 短期 + 長期任務分開列。短期 = 推甄前要做完。長期 = 推甄後再說。

---

## 🔥 短期（2026-05 ~ 2026-09，推甄前）

### 5 天升級計劃（決定要做、待開工）

- [ ] **Day 1**：設計 7 個 interface（InputAdapter / EncryptionProvider / TransportProvider / AuthProvider / FhirValidator / AuditLogger / ConsentManager）+ 重構現有 code 套上 → `src/lib/core/interfaces.ts`
- [ ] **Day 2**：ExClinCalc threat model 文件（STRIDE）→ `D:\exclinclac\docs\THREAT_MODEL.md`
- [ ] **Day 3**：落實 EncryptionProvider（Web Crypto AES-256-GCM + PBKDF2）+ UI「加密匯出」按鈕
- [ ] **Day 4**：落實 TransportProvider（HAPI FHIR server demo，docker-compose.yml + UI 上傳 endpoint）
- [ ] **Day 5**：寫研究 note「FHIR pre-step 為什麼少人系統性做」→ `docs/RESEARCH_NOTE.md` + 新 `/research` 頁面

### 1 小時加分項

- [ ] 加 `vite-plugin-singlefile` → 輸出單檔 `.html`，雙擊就能用、面試現場 USB demo（**對推甄殺力極大**）

### 漏洞修補（之前 PS1 audit 列出來、暫緩）

- [ ] `npm audit` 列出的 vulnerabilities（小心起見等推甄後再升）

---

## 🌱 長期（推甄後、2027 起）

### Tauri 打包桌面 app（用戶想要、但學習成本高）

- [ ] 學 Rust 基礎（1-2 週）
- [ ] 用 Tauri 把 clinconvert 包成桌面 app（Windows / macOS / Linux）
- [ ] 需要的能力：寫本地檔案、自動更新、code signing
- **Why 不現在做**：學 Rust 1-2 週對推甄敘事沒加分（教授不會把「會 Tauri」當研究貢獻）、會排擠英文 / portfolio 準備時間
- **Why 之後要做**：商業化 / 醫院內網部署 / 真離線版

### 模塊化深度擴展

- [ ] HL7 v2 → FHIR adapter（InputAdapter 多 1 個實作）
- [ ] CCDA → FHIR adapter
- [ ] Cerner / Epic schema adapter（如果有 sample 資料）
- [ ] 衛福部中台 API TransportProvider（如果有 sandbox 環境）
- [ ] SMART on FHIR AuthProvider
- [ ] 台灣 NHI Profile 的 FHIR Validator

### 真實落地需要的（不是這個 repo 能解的）

- [ ] HIPAA / 個資法合規認證（要組織資源）
- [ ] IRB 倫理審查（要醫院合作）
- [ ] HSM / KMS 基建（要 ops 團隊）
- [ ] 滲透測試（要付費認證機構）

→ 這些只是清單、不是 actionable，**列出來提醒自己「我不解這些不是不知道、是知道做不到」**。

---

## 📚 文件 TODO

- [x] [COMPETITIVE_ANALYSIS.md](./COMPETITIVE_ANALYSIS.md)（2026-05-14 完成）
- [ ] THREAT_MODEL.md（Day 2 產出）
- [ ] RESEARCH_NOTE.md（Day 5 產出）
- [ ] ARCHITECTURE.md（模塊化後的整體架構圖）
