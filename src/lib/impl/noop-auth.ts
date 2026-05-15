/**
 * NoopAuthProvider — 預設不用認證（local 下載場景）
 *
 * 未來換成 BearerAuthProvider / OAuth2 / SMART on FHIR 時、
 * 只要替換 registry.auth = newProvider 即可。
 */
import type { AuthProvider, AuthToken } from '../core/interfaces';

export class NoopAuthProvider implements AuthProvider {
  readonly type = 'none' as const;

  async getToken(): Promise<AuthToken> {
    return { type: 'none', value: '' };
  }
}

/**
 * BearerAuthProvider — 簡單的 Bearer token 認證
 *
 * 用法：
 *   const a = new BearerAuthProvider('eyJhbGc...');
 *   const t = await a.getToken();  // { type: 'bearer', value: 'eyJhbGc...' }
 *
 * 適合：HAPI test server、自家 server、有預發 token 的場景
 * 不適合：OAuth2 flow（需要 refresh、登入流程）
 */
export class BearerAuthProvider implements AuthProvider {
  readonly type = 'bearer' as const;
  constructor(private token: string, private expiresAt?: number) {}

  async getToken(): Promise<AuthToken> {
    return { type: 'bearer', value: this.token, expiresAt: this.expiresAt };
  }
}
