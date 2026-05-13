/**
 * XLSX / XLS / CSV Adapter
 *
 * 用 SheetJS (npm: xlsx) 解析。完全在瀏覽器 / Node 端執行，檔案內容不外傳。
 */
import * as XLSX from 'xlsx';
import type { NormalizedDataset, NormalizedRecord } from '../core/internal-model';

export interface XlsxAdapterOptions {
  /** 把哪幾個 sheet 讀進來，undefined = 全部 */
  sheetNames?: string[];
  /** 第一列當 header（預設 true）*/
  headerRow?: boolean;
}

export async function parseXlsx(
  file: File | ArrayBuffer,
  options: XlsxAdapterOptions = {}
): Promise<NormalizedDataset[]> {
  const buffer =
    file instanceof File ? await file.arrayBuffer() : file;
  const fileName = file instanceof File ? file.name : 'inline';
  // dense + cellDates 在大檔上比物件 hash 表省 30-50% 記憶體
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    cellNF: false,
    cellStyles: false,
    sheetStubs: false,
    dense: true,
  });

  const targetSheets =
    options.sheetNames && options.sheetNames.length > 0
      ? options.sheetNames
      : workbook.SheetNames;

  const datasets: NormalizedDataset[] = [];

  for (const sheetName of targetSheets) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // 用 header: 1 取出 raw matrix，再自己處理 header row
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    if (rows.length === 0) continue;

    const headerRow = options.headerRow !== false; // 預設 true
    const columns: string[] = headerRow
      ? rows[0].map((c, i) => (c == null || c === '' ? `col_${i + 1}` : String(c).trim()))
      : rows[0].map((_, i) => `col_${i + 1}`);

    const dataRows = headerRow ? rows.slice(1) : rows;

    const records: NormalizedRecord[] = dataRows.map((row, idx) => {
      const fields: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        fields[col] = row[i];
      });
      return {
        sourceRef: `${sheetName}!row${idx + (headerRow ? 2 : 1)}`,
        fields,
      };
    });

    datasets.push({
      sourceDescription: `${fileName} > ${sheetName}`,
      columns,
      records,
      metadata: {
        fileName,
        sheetCount: workbook.SheetNames.length,
        rowCount: records.length,
        adapter: 'xlsx',
      },
    });
  }

  return datasets;
}

/**
 * CSV 直接走 XLSX（SheetJS 原生支援）。File extension 由 SheetJS 自動偵測。
 */
export const parseCsv = parseXlsx;
