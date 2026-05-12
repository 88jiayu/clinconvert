/**
 * Field transforms — 把 source value 轉成 FHIR 規範的格式。
 */

export type TransformName = 'lowercase' | 'date-iso' | 'phone-tw' | 'gender-tw';

const TW_GENDER_MAP: Record<string, 'male' | 'female' | 'other' | 'unknown'> = {
  男: 'male',
  女: 'female',
  M: 'male',
  F: 'female',
  m: 'male',
  f: 'female',
  male: 'male',
  female: 'female',
};

export function applyTransform(value: unknown, name?: TransformName): unknown {
  if (value == null || value === '') return value;
  if (!name) return value;

  switch (name) {
    case 'lowercase':
      return String(value).toLowerCase();

    case 'gender-tw': {
      const s = String(value).trim();
      return TW_GENDER_MAP[s] ?? 'unknown';
    }

    case 'date-iso':
      return toIsoDate(value);

    case 'phone-tw':
      return normalizePhoneTw(value);

    default:
      return value;
  }
}

/**
 * 各種日期格式轉 ISO 8601 (YYYY-MM-DD)
 * 支援：
 *   - "2024/01/15"、"2024-01-15"、"2024.01.15"
 *   - "20240115"
 *   - JS Date object
 *   - Excel serial number (1900 epoch)
 */
export function toIsoDate(value: unknown): string {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    // Excel serial date (天數 from 1900-01-01；30 是 1900 閏年 bug 修正後的 day 1)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + value * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/[./]/g, '-');

    // 純數字 20240115
    if (/^\d{8}$/.test(cleaned)) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    }

    // YYYY-MM-DD 或 YYYY-M-D
    const m = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      const [, y, mo, d] = m;
      return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // 民國 → 西元（簡易處理 0XX/MM/DD 或 1XX/MM/DD）
    const tw = cleaned.match(/^(\d{2,3})-(\d{1,2})-(\d{1,2})/);
    if (tw) {
      const [, ty, mo, d] = tw;
      const tyN = parseInt(ty, 10);
      // 民國 ≤ 200 視為民國年；否則當西元
      const year = tyN <= 200 ? tyN + 1911 : tyN;
      return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  return String(value);
}

/** 台灣手機格式統一 0912345678 (10 碼) */
export function normalizePhoneTw(value: unknown): string {
  const s = String(value).replace(/[\s\-+]/g, '');
  // +886912345678 → 0912345678
  if (s.startsWith('886')) return '0' + s.slice(3);
  return s;
}
