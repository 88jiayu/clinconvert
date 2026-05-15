/**
 * DefaultJsonAdapter — 把 parseJson 包成 InputAdapter interface
 */
import type { InputAdapter } from '../core/interfaces';
import type { NormalizedDataset } from '../core/internal-model';
import { parseJson, type JsonAdapterOptions } from '../adapters/json';

export class DefaultJsonAdapter implements InputAdapter {
  readonly name = 'default-json';
  readonly supportedExtensions = ['json', 'ndjson'] as const;

  async parse(
    file: File | ArrayBuffer | string,
    options: Record<string, unknown> = {}
  ): Promise<NormalizedDataset[]> {
    let text: string;
    if (typeof file === 'string') {
      text = file;
    } else if (file instanceof ArrayBuffer) {
      text = new TextDecoder().decode(file);
    } else {
      text = await file.text();
    }
    return parseJson(text, options as JsonAdapterOptions);
  }
}
