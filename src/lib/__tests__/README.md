# Tests

> 暫無 unit tests（推甄之後加）。設計目標：每個 interface 一個 mock + 一個 default 實作測試。

## 計畫測試的 interface

從 [`../core/interfaces.ts`](../core/interfaces.ts)：

1. `InputAdapter` ── DefaultXlsxAdapter / DefaultJsonAdapter
2. `EncryptionProvider` ── WebCryptoEncryption（含 round-trip 測試）
3. `TransportProvider` ── DefaultDownloadTransport / HapiFhirTransport
4. `AuthProvider` ── NoopAuthProvider / BearerAuthProvider
5. `FhirValidator` ── DefaultFhirValidator
6. `AuditLogger` ── MemoryAuditLogger
7. `ConsentManager` ── NoopConsentManager

## 建議測試框架

- **Vitest**（Vite 原生整合、speed 快）
- 或 **Playwright**（end-to-end、模擬瀏覽器）

## 加入步驟（之後）

```bash
npm install --save-dev vitest @vitest/ui
```

`package.json` 加 script：
```json
"test": "vitest",
"test:run": "vitest run"
```

第一個 test 範本：

```typescript
// src/lib/__tests__/encryption.test.ts
import { describe, it, expect } from 'vitest';
import { WebCryptoEncryption } from '../impl/webcrypto-encryption';

describe('WebCryptoEncryption', () => {
  it('round-trip encrypt → decrypt', async () => {
    const enc = new WebCryptoEncryption();
    const passphrase = 'test-pass-12345';
    const plaintext = new TextEncoder().encode('hello world');

    const key = await enc.deriveKey(passphrase);
    const payload = await enc.encrypt(plaintext, key);

    const decryptedKey = await enc.deriveKey(passphrase, payload.salt);
    const decrypted = await enc.decrypt(payload, decryptedKey);

    expect(new TextDecoder().decode(decrypted)).toBe('hello world');
  });
});
```

## 為什麼還沒寫

- 推甄優先：作品功能 > test coverage
- 但測試是研究所進去後必補的
- 列在 [`docs/TODO.md`](../../../docs/TODO.md) 長期任務裡

## 對外敘事（被問時）

> 「我目前還沒寫 unit tests。原因是推甄前優先功能完整、tests 列在 long-term TODO。
>  進研究所後加 Vitest + 對每個 interface 寫測試是首批要做的事。」
