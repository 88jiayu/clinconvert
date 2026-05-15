/**
 * MemoryAuditLogger — in-memory 稽核 log
 *
 * 預設 default、頁面 reload 就清空。
 *
 * 適合：研究 / 教學 / 純 demo 場景
 * 不適合：production / 合規場景（要不可竄改 + 持久化 + 簽章 → 之後加 RemoteAuditLogger）
 */
import type { AuditEvent, AuditFilter, AuditLogger } from '../core/interfaces';

export class MemoryAuditLogger implements AuditLogger {
  readonly storage = 'memory' as const;
  private events: AuditEvent[] = [];

  async log(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  async query(filter?: AuditFilter): Promise<AuditEvent[]> {
    if (!filter) return [...this.events];
    return this.events.filter((e) => {
      if (filter.actor && e.actor !== filter.actor) return false;
      if (filter.action && e.action !== filter.action) return false;
      if (filter.target && e.target !== filter.target) return false;
      if (filter.since && e.timestamp < filter.since) return false;
      if (filter.until && e.timestamp > filter.until) return false;
      return true;
    });
  }

  /** Debug 用：清空 log。production 場景不該存在。 */
  clear(): void {
    this.events = [];
  }
}
