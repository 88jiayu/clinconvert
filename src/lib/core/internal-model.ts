/**
 * Internal normalized model
 *
 * Input adapters (XLS / CSV / JSON / HL7v2 / DICOM) 各自輸出統一格式，
 * 後續 mapping engine 跟 FHIR resource builder 只認這一個 model。
 *
 * 這層的存在讓「新增 input format」不必動 FHIR builder。
 */

export interface NormalizedRecord {
  /** Source row identifier (e.g. "Sheet1!A2" or csv row 3) */
  sourceRef: string;

  /** Original column → value map. 由 adapter 填入 */
  fields: Record<string, unknown>;

  /** 自由筆記區，給 mapping engine 暫存中間結果 */
  meta?: Record<string, unknown>;
}

export interface NormalizedDataset {
  /** Source 描述 (e.g. "patients.xlsx > Sheet1") */
  sourceDescription: string;

  /** 原始 column 名稱（順序保留） */
  columns: string[];

  /** 每筆紀錄 */
  records: NormalizedRecord[];

  /** Adapter 提供的 metadata（檔名、sheet 數、列數等）*/
  metadata?: {
    fileName?: string;
    sheetCount?: number;
    rowCount?: number;
    adapter?: string;
  };
}
