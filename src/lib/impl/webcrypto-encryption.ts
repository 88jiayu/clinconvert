/**
 * WebCryptoEncryption — AES-256-GCM + PBKDF2-SHA256 零知識加密
 *
 * Day 3 會落實 UI 加密匯出按鈕、本檔目前只實作底層 module。
 *
 * 設計：
 *   - AES-256-GCM（NIST 認可、Web Crypto 原生、HIPAA 接受）
 *   - PBKDF2-SHA256 100,000 iter（OWASP 2023 建議）
 *   - 隨機 12-byte IV（GCM 標準）
 *   - 隨機 16-byte salt
 *
 * 為什麼這套：
 *   - 全瀏覽器原生 SubtleCrypto、無 dependency
 *   - Passphrase 從不離開瀏覽器、密鑰從不持久化 → 零知識架構
 *   - 解密失敗會 throw（GCM auth tag 自動驗證）→ 不會收到「靜默竄改」的封包
 */
import type {
  EncryptionProvider,
  EncryptedPayload,
} from '../core/interfaces';

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export class WebCryptoEncryption implements EncryptionProvider {
  readonly algorithm = 'AES-256-GCM';
  readonly kdf = `PBKDF2-SHA256-${PBKDF2_ITERATIONS}`;

  async deriveKey(passphrase: string, salt?: Uint8Array): Promise<CryptoKey> {
    const actualSalt = salt ?? crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const passKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const derived = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: actualSalt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      passKey,
      { name: 'AES-GCM', length: 256 },
      false, // not extractable
      ['encrypt', 'decrypt']
    );
    // 把 salt 黏到 key 上、方便 caller 之後加進 EncryptedPayload
    (derived as CryptoKey & { __salt?: Uint8Array }).__salt = actualSalt;
    return derived;
  }

  async encrypt(
    plaintext: Uint8Array,
    key: CryptoKey
  ): Promise<EncryptedPayload> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
    );
    const salt =
      (key as CryptoKey & { __salt?: Uint8Array }).__salt ??
      new Uint8Array(SALT_BYTES);
    return {
      ciphertext,
      iv,
      salt,
      algorithm: this.algorithm,
      kdf: this.kdf,
    };
  }

  async decrypt(
    payload: EncryptedPayload,
    key: CryptoKey
  ): Promise<Uint8Array> {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: payload.iv },
      key,
      payload.ciphertext
    );
    return new Uint8Array(plaintext);
  }
}
