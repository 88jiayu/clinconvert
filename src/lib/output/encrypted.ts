/**
 * Encrypted Bundle Serialization
 *
 * 把 EncryptedPayload 序列化成可下載 / 可解密的單一檔案。
 *
 * 檔案格式：JSON wrapper，UTF-8 encoded
 * {
 *   "$schema": "clinconvert-encrypted-bundle-v1",
 *   "algorithm": "AES-256-GCM",
 *   "kdf": "PBKDF2-SHA256-100000",
 *   "salt": "<base64>",
 *   "iv": "<base64>",
 *   "ciphertext": "<base64>"
 * }
 *
 * 解密工具範例（Node.js / browser）：
 *   1. parse JSON
 *   2. base64 decode salt / iv / ciphertext → Uint8Array
 *   3. PBKDF2(passphrase, salt, 100000) → AES-GCM key
 *   4. AES-GCM decrypt(ciphertext, key, iv) → 原 Bundle JSON 字串
 *
 * 為什麼選 JSON wrapper：
 *   - 可讀性高、debug 容易
 *   - Base64 比 binary blob 大 33%、但對 Bundle 來說可接受
 *   - 跨平台（任何語言能讀 JSON + base64）
 *
 * 為什麼不用 PGP / age 等格式：
 *   - PGP 太重、需 GnuPG runtime
 *   - age 是 Go 工具、瀏覽器沒原生支援
 *   - 自家 format 簡單明確、給研究 / 教學足夠
 */
import type { EncryptedPayload } from '../core/interfaces';

export const ENCRYPTED_SCHEMA = 'clinconvert-encrypted-bundle-v1';

export interface EncryptedFileFormat {
  $schema: typeof ENCRYPTED_SCHEMA;
  algorithm: string;
  kdf?: string;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function serializeEncrypted(payload: EncryptedPayload): string {
  const obj: EncryptedFileFormat = {
    $schema: ENCRYPTED_SCHEMA,
    algorithm: payload.algorithm,
    kdf: payload.kdf,
    salt: toBase64(payload.salt),
    iv: toBase64(payload.iv),
    ciphertext: toBase64(payload.ciphertext),
  };
  return JSON.stringify(obj, null, 2);
}

export function deserializeEncrypted(json: string): EncryptedPayload {
  const obj = JSON.parse(json) as Partial<EncryptedFileFormat>;
  if (obj.$schema !== ENCRYPTED_SCHEMA) {
    throw new Error(
      `不支援的 schema: ${obj.$schema ?? '<missing>'}（期待 ${ENCRYPTED_SCHEMA}）`
    );
  }
  if (!obj.salt || !obj.iv || !obj.ciphertext || !obj.algorithm) {
    throw new Error('加密檔案結構不完整、缺少必要欄位');
  }
  return {
    ciphertext: fromBase64(obj.ciphertext),
    iv: fromBase64(obj.iv),
    salt: fromBase64(obj.salt),
    algorithm: obj.algorithm,
    kdf: obj.kdf,
  };
}
