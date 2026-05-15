/**
 * DefaultXlsxAdapter — 把 parseXlsx 包成 InputAdapter interface
 *
 * 既有 parseXlsx 是 function 形式、保持不動。此檔只是「以 interface 形式」呈現。
 * UI / Worker pool 仍可繼續直接呼叫 parseXlsx，沒有 breaking change。
 */
import type { InputAdapter } from '../core/interfaces';
import type { NormalizedDataset } from '../core/internal-model';
import { parseXlsx, type XlsxAdapterOptions } from '../adapters/xlsx';

export class DefaultXlsxAdapter implements InputAdapter {
  readonly name = 'default-xlsx';
  readonly supportedExtensions = ['xlsx', 'xls', 'csv', 'xlsm'] as const;

  async parse(
    file: File | ArrayBuffer | string,
    options: Record<string, unknown> = {}
  ): Promise<NormalizedDataset[]> {
    if (typeof file === 'string') {
      // String input: 假設是 CSV 文字內容
      const buffer = new TextEncoder().encode(file).buffer;
      return parseXlsx(buffer as ArrayBuffer, options as XlsxAdapterOptions);
    }
    return parseXlsx(file, options as XlsxAdapterOptions);
  }
}
