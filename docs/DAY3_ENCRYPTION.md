# Day 3 — Web Crypto 加密匯出（落實 EncryptionProvider）

> 2026-05-15 完成

## 做了什麼

把 Day 1 寫好的 `WebCryptoEncryption` 接上 UI ── 在「Step 4 · 下載 FHIR Bundle」加一個按鈕「🔐 加密匯出 (.fhir.enc.json)」。

**完整 flow**：
```
1. 使用者按「加密匯出」
2. prompt() 要求 passphrase（≥ 12 字、防忘記）
3. prompt() 再要求一次確認
4. registry.encryption.deriveKey(passphrase) → PBKDF2-SHA256 100k iter → AES-256 key
5. registry.encryption.encrypt(bundleBytes, key) → EncryptedPayload (ciphertext + iv + salt + algorithm)
6. serializeEncrypted(payload) → JSON wrapper
7. triggerDownload → .fhir.enc.json 檔
8. registry.audit.log({ action: 'encrypt-export', ... }) ← 走 Day 1 的 AuditLogger
```

## 新增 / 修改檔案

```
src/lib/output/encrypted.ts         ← NEW
  - ENCRYPTED_SCHEMA 常數
  - serializeEncrypted(payload) → JSON string
  - deserializeEncrypted(json) → payload （給未來解密工具用）

src/pages/index.astro               ← EDIT
  - 加 import: registry, serializeEncrypted
  - 加按鈕 data-format="collection-encrypted"
  - 加 download handler case
  - 加 CSS .output-actions button.encrypted
  - 加 UI hint 段
```

## 加密格式

`.fhir.enc.json`：

```json
{
  "$schema": "clinconvert-encrypted-bundle-v1",
  "algorithm": "AES-256-GCM",
  "kdf": "PBKDF2-SHA256-100000",
  "salt": "<base64, 16 bytes>",
  "iv": "<base64, 12 bytes>",
  "ciphertext": "<base64, original + 16-byte auth tag>"
}
```

**為什麼選 JSON wrapper**：
- 跨平台（任何語言解析 JSON + base64）
- 可讀性高、debug 容易
- 大小成本：base64 比 binary +33%，對 FHIR Bundle 可接受

**為什麼不用 PGP / age**：
- PGP 太重、需 GnuPG runtime
- age 是 Go 工具、瀏覽器沒原生支援
- 自家 format 簡單明確、給研究 / 教學足夠

## 對外敘事（推甄）

> 「我加了 'encrypt-export' 模式：用 Web Crypto AES-256-GCM + PBKDF2-SHA256 100k iter（OWASP 2023 標準）加密 FHIR Bundle、存成 `.fhir.enc.json`。**Passphrase 從不上傳**（零知識架構）── 對應教授說的『強調隱私的東西應在 local 端』設計原則。
>
> 解密失敗會 throw（GCM auth tag 自動驗證）── 不會收到靜默竄改的封包。
>
> 這個模組是  Day 1 寫的 `EncryptionProvider` interface 的落實 ── 未來換成醫院指定的 HSM / ChaCha20 都不必動 UI code。」

## 驗證

- ✅ `npm run build` **4.79s pass**（2026-05-15 03:00）
- ✅ Web Crypto SubtleCrypto API 是瀏覽器原生、不增加 bundle 體積
- ✅ Zero new dependency
- ⏳ 解密工具（給使用者用）── Day 5 會放在 /research 頁面

## TODO（之後可加）

- [ ] **Day 5**：寫一個 `/decrypt` 頁面、把 `.fhir.enc.json` 拖進去 + 輸入 passphrase → 顯示原 Bundle
- [ ] passphrase strength meter（red / yellow / green）
- [ ] 替 organized zip 也加加密版（目前只有 collection bundle）
- [ ] 加 `--encrypt` CLI option 給 batch script 用
