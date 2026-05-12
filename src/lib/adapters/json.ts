/**
 * JSON Adapter
 *
 * 支援兩種 JSON 結構：
 *   1. Array of objects: [{ name: "Alice", age: 30 }, ...]
 *   2. ExClinCalc / 自家 schema: { patients: [...], encounters: [...] }
 *
 * 後者由 mapping template 處理欄位映射。
 */
import type { NormalizedDataset, NormalizedRecord } from '../core/internal-model';

export interface JsonAdapterOptions {
  /** 如果 JSON 是物件且包含多個 array，指定要讀哪個 key（e.g. "patients"）*/
  arrayKey?: string;
  /** Source 名稱（顯示用）*/
  sourceName?: string;
}

export async function parseJson(
  input: string | object,
  options: JsonAdapterOptions = {}
): Promise<NormalizedDataset[]> {
  const data = typeof input === 'string' ? JSON.parse(input) : input;

  // 找出要當 dataset 的 array
  const buckets: { name: string; rows: unknown[] }[] = [];

  if (Array.isArray(data)) {
    buckets.push({ name: options.sourceName ?? 'root', rows: data });
  } else if (data && typeof data === 'object') {
    if (options.arrayKey) {
      const arr = (data as Record<string, unknown>)[options.arrayKey];
      if (!Array.isArray(arr)) {
        throw new Error(`arrayKey "${options.arrayKey}" 不是陣列`);
      }
      buckets.push({ name: options.arrayKey, rows: arr });
    } else {
      // 自動掃出所有 array property（適合 ExClinCalc-like schema）
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
          buckets.push({ name: key, rows: value });
        }
      }
    }
  } else {
    throw new Error('JSON 必須是物件或陣列');
  }

  const datasets: NormalizedDataset[] = [];

  for (const bucket of buckets) {
    if (bucket.rows.length === 0) continue;

    // 從第一筆推導 columns（聯集所有 row 的 key，避免漏欄）
    const columnSet = new Set<string>();
    bucket.rows.forEach((row) => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach((k) => columnSet.add(k));
      }
    });
    const columns = Array.from(columnSet);

    const records: NormalizedRecord[] = bucket.rows.map((row, idx) => {
      const fields: Record<string, unknown> = {};
      if (row && typeof row === 'object') {
        for (const col of columns) {
          fields[col] = (row as Record<string, unknown>)[col];
        }
      }
      return {
        sourceRef: `${bucket.name}[${idx}]`,
        fields,
      };
    });

    datasets.push({
      sourceDescription: options.sourceName
        ? `${options.sourceName} > ${bucket.name}`
        : bucket.name,
      columns,
      records,
      metadata: {
        fileName: options.sourceName,
        rowCount: records.length,
        adapter: 'json',
      },
    });
  }

  return datasets;
}
