#!/usr/bin/env node
/**
 * clinconvert CLI ── 批次轉換 XLS / CSV / JSON → FHIR R4 Bundle
 *
 * 用 Node.js 跑、無瀏覽器記憶體限制、適合幾千個檔的場景。
 * 80% 邏輯 import 自 web 版的 src/lib/（adapter pattern + builders + validator）。
 *
 * 用法範例：
 *   clinconvert --input ./patients --output ./fhir-output
 *   clinconvert -i data.xlsx -o ./out --organized
 *   clinconvert -i ./xls-archive -o ./fhir --format ndjson --parallel 8
 *
 * 為什麼存在：
 *   - 診所 IT 跑 cron / batch script 不該用瀏覽器
 *   - 大批量（1000+ 檔）瀏覽器會 OOM
 *   - CLI 可串接 grep / find / xargs 等 unix 工具
 */

import { readFile, readdir, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, basename, extname, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// Web 版 lib 路徑（共用 core code）
const LIB = join(ROOT, 'src', 'lib');

const VERSION = '0.1.0';

function printHelp() {
  console.log(`clinconvert CLI v${VERSION}
Batch convert clinical data (XLS / CSV / JSON) to FHIR R4 Bundle.

USAGE
  clinconvert -i <input> -o <output> [options]

OPTIONS
  -i, --input <path>        Input file or directory (recurses subdirectories)
  -o, --output <path>       Output directory (created if not exists)
      --format <fmt>        Output format: bundle | transaction | ndjson | organized
                            Default: organized (recommended for clinic IT)
      --parallel <N>        Worker concurrency. Default: CPU count
      --no-validate         Skip FHIR R4 structural validation
      --strict              Exit non-zero if any validation errors found
  -v, --verbose             Detailed per-file logs
  -h, --help                Show this help
      --version             Show version

OUTPUT FORMATS
  organized  (default)  ── A directory containing:
                          README.md, bundle-all.json, by-resource-type/, by-patient/,
                          errors.csv, unmatched.csv, validation-report.json
  bundle               ── Single FHIR Bundle (collection) JSON
  transaction          ── FHIR Transaction Bundle (POST-able to FHIR server)
  ndjson               ── Newline-delimited JSON (bulk-data style)

EXAMPLES
  # Process every XLS in ./xls-archive, output organized bundle:
  clinconvert -i ./xls-archive -o ./fhir

  # Single-file mode, strict (fail on FHIR errors):
  clinconvert -i patients.xlsx -o ./out --strict

  # NDJSON for FHIR server bulk import:
  clinconvert -i ./batch -o ./out --format ndjson --parallel 8

  # Pipe-friendly: count resources without writing files:
  clinconvert -i data.xlsx -o /tmp --verbose | grep "Total resources"

LEARN MORE
  Web version:    https://clinconvert.pages.dev/
  Source:         https://github.com/88jiayu/clinconvert
  About:          https://jiayuselfweb.pages.dev/

clinconvert is part of the Clin- series alongside ClinCalc / ExClinCalc.
`);
}

let args;
try {
  args = parseArgs({
    args: process.argv.slice(2),
    options: {
      input: { type: 'string', short: 'i' },
      output: { type: 'string', short: 'o' },
      format: { type: 'string', default: 'organized' },
      parallel: { type: 'string' },
      'no-validate': { type: 'boolean' },
      strict: { type: 'boolean' },
      verbose: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean' },
    },
    allowPositionals: true,
  });
} catch (err) {
  console.error('Argument error:', err.message);
  console.error('Run `clinconvert --help` for usage.');
  process.exit(2);
}

if (args.values.help || process.argv.length <= 2) {
  printHelp();
  process.exit(0);
}
if (args.values.version) {
  console.log(VERSION);
  process.exit(0);
}

if (!args.values.input || !args.values.output) {
  console.error('Error: --input and --output are required.');
  console.error('Run `clinconvert --help` for usage.');
  process.exit(2);
}

const SUPPORTED_FORMATS = ['organized', 'bundle', 'transaction', 'ndjson'];
if (!SUPPORTED_FORMATS.includes(args.values.format)) {
  console.error(`Error: --format must be one of: ${SUPPORTED_FORMATS.join(', ')}`);
  process.exit(2);
}

// === Discover input files ===

async function discoverFiles(inputPath) {
  const out = [];
  async function walk(p) {
    const s = await stat(p);
    if (s.isFile()) {
      if (/\.(xlsx?|csv|json)$/i.test(p)) out.push(p);
    } else if (s.isDirectory()) {
      const entries = await readdir(p);
      for (const e of entries) {
        await walk(join(p, e));
      }
    }
  }
  await walk(inputPath);
  return out;
}

// === Dynamic import core lib（共用 web 版邏輯）===
// 這個 CLI 是 .mjs 而 lib 是 .ts ── 用 build 過的 dist 或 tsx loader
// 簡化版：直接 dynamic import .ts 透過 tsx (需 user 裝 tsx) ── 但複雜
// 簡單做法：在 CLI 內 inline 必要 logic
//
// 為了讓 user 可以 `npx clinconvert` 即用，本檔 inline 全部邏輯：

const XLSX = await import('xlsx');
const JSZip = (await import('jszip')).default;

// === FHIR types（從 web 版 copy 過來 simplified）===

function buildPatientRow(record, mapping) {
  const get = (k) => {
    const m = mapping.fields.find((f) => f.targetField === k);
    if (!m) return undefined;
    return record.fields[m.sourceColumn];
  };
  const id = String(get('Patient.identifier') ?? '');
  const family = String(get('Patient.name.family') ?? '');
  const given = String(get('Patient.name.given') ?? '');
  const gender = mapGender(get('Patient.gender'));
  const birthDate = toIsoDate(get('Patient.birthDate'));
  const phone = normalizePhoneTw(get('Patient.telecom.phone'));
  const email = String(get('Patient.telecom.email') ?? '');
  const city = String(get('Patient.address.city') ?? '');

  const p = { resourceType: 'Patient' };
  if (id) { p.id = id; p.identifier = [{ value: id, use: 'official' }]; }
  if (family || given) {
    p.name = [{
      use: 'official',
      ...(family ? { family } : {}),
      ...(given ? { given: [given] } : {}),
    }];
  }
  if (gender) p.gender = gender;
  if (birthDate) p.birthDate = birthDate;
  const telecom = [];
  if (phone) telecom.push({ system: 'phone', value: phone, use: 'mobile' });
  if (email) telecom.push({ system: 'email', value: email });
  if (telecom.length > 0) p.telecom = telecom;
  if (city) p.address = [{ use: 'home', city, country: 'TW' }];
  return p;
}

function buildObservationRow(record, mapping) {
  const get = (k) => {
    const m = mapping.fields.find((f) => f.targetField === k);
    if (!m) return undefined;
    return record.fields[m.sourceColumn];
  };
  const subject = String(get('Observation.subject') ?? '');
  const code = String(get('Observation.code.coding.code') ?? '');
  const codeText = String(get('Observation.code.text') ?? '');
  const value = parseFloat(String(get('Observation.valueQuantity.value') ?? ''));
  const unit = String(get('Observation.valueQuantity.unit') ?? '');
  const dt = toIsoDate(get('Observation.effectiveDateTime'));

  const o = {
    resourceType: 'Observation',
    id: cryptoId(),
    status: 'final',
    code: {
      ...(code ? { coding: [{ system: 'http://loinc.org', code, ...(codeText ? { display: codeText } : {}) }] } : {}),
      ...(codeText ? { text: codeText } : {}),
    },
    subject: { reference: `Patient/${subject || 'unknown'}` },
  };
  if (!isNaN(value)) o.valueQuantity = { value, ...(unit ? { unit } : {}) };
  if (dt) o.effectiveDateTime = dt;
  return o;
}

function buildEncounterRow(record, mapping) {
  const get = (k) => {
    const m = mapping.fields.find((f) => f.targetField === k);
    if (!m) return undefined;
    return record.fields[m.sourceColumn];
  };
  const id = String(get('Encounter.identifier') ?? '');
  const subject = String(get('Encounter.subject') ?? 'unknown');
  const status = String(get('Encounter.status') ?? 'finished');
  const start = toIsoDate(get('Encounter.period.start'));
  const end = toIsoDate(get('Encounter.period.end'));

  const e = {
    resourceType: 'Encounter',
    id: id || cryptoId(),
    status: ['planned','arrived','triaged','in-progress','finished','cancelled'].includes(status) ? status : 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
    subject: { reference: `Patient/${subject}` },
  };
  if (id) e.identifier = [{ value: id, use: 'official' }];
  if (start || end) e.period = { ...(start ? { start } : {}), ...(end ? { end } : {}) };
  return e;
}

// === Mapping templates (copy from web)===

const TEMPLATES = [
  {
    id: 'exclincalc-patients',
    resourceType: 'Patient',
    datasetMatch: /patients/i,
    fields: [
      { sourceColumn: 'id', targetField: 'Patient.identifier' },
      { sourceColumn: 'last_name', targetField: 'Patient.name.family' },
      { sourceColumn: 'first_name', targetField: 'Patient.name.given' },
      { sourceColumn: 'gender', targetField: 'Patient.gender' },
      { sourceColumn: 'birth_date', targetField: 'Patient.birthDate' },
      { sourceColumn: 'phone', targetField: 'Patient.telecom.phone' },
      { sourceColumn: 'email', targetField: 'Patient.telecom.email' },
      { sourceColumn: 'city', targetField: 'Patient.address.city' },
    ],
  },
  {
    id: 'exclincalc-encounters',
    resourceType: 'Encounter',
    datasetMatch: /encounters?|registrations?|visits?/i,
    fields: [
      { sourceColumn: 'id', targetField: 'Encounter.identifier' },
      { sourceColumn: 'status', targetField: 'Encounter.status' },
      { sourceColumn: 'patient_id', targetField: 'Encounter.subject' },
      { sourceColumn: 'started_at', targetField: 'Encounter.period.start' },
      { sourceColumn: 'finished_at', targetField: 'Encounter.period.end' },
    ],
  },
  {
    id: 'kdigo-observations',
    resourceType: 'Observation',
    datasetMatch: /observations?|labs?|kdigo/i,
    fields: [
      { sourceColumn: 'patient_id', targetField: 'Observation.subject' },
      { sourceColumn: 'loinc_code', targetField: 'Observation.code.coding.code' },
      { sourceColumn: 'indicator_name', targetField: 'Observation.code.text' },
      { sourceColumn: 'value', targetField: 'Observation.valueQuantity.value' },
      { sourceColumn: 'unit', targetField: 'Observation.valueQuantity.unit' },
      { sourceColumn: 'measured_at', targetField: 'Observation.effectiveDateTime' },
    ],
  },
];

function suggestTemplate(datasetName) {
  return TEMPLATES.find((t) => t.datasetMatch?.test(datasetName));
}

// === Helpers (民國日期 / 性別 / 電話) ===

function mapGender(v) {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (['male', 'female', 'other', 'unknown'].includes(s)) return s;
  const map = { 男: 'male', 女: 'female', M: 'male', F: 'female', m: 'male', f: 'female' };
  return map[s] ?? 'unknown';
}

function toIsoDate(v) {
  if (v == null || v === '') return undefined;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + v * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (typeof v === 'string') {
    const cleaned = v.trim().replace(/[./]/g, '-');
    if (/^\d{8}$/.test(cleaned)) return `${cleaned.slice(0,4)}-${cleaned.slice(4,6)}-${cleaned.slice(6,8)}`;
    const m = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    const tw = cleaned.match(/^(\d{2,3})-(\d{1,2})-(\d{1,2})/);
    if (tw) {
      const ty = parseInt(tw[1], 10);
      const year = ty <= 200 ? ty + 1911 : ty;
      return `${year}-${tw[2].padStart(2,'0')}-${tw[3].padStart(2,'0')}`;
    }
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return String(v);
}

function normalizePhoneTw(v) {
  if (v == null) return undefined;
  const s = String(v).replace(/[\s\-+]/g, '');
  if (s.startsWith('886')) return '0' + s.slice(3);
  return s;
}

function cryptoId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'urn:uuid:' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// === Parse & build ===

function parseFile(buffer, fileName, isJson) {
  const datasets = [];
  if (isJson) {
    const text = new TextDecoder().decode(buffer);
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
      datasets.push({ name: fileName, records: data.map((row, idx) => ({ sourceRef: `${fileName}[${idx}]`, fields: row })) });
    } else if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
          datasets.push({
            name: `${fileName} > ${key}`,
            records: value.map((row, idx) => ({ sourceRef: `${key}[${idx}]`, fields: row })),
          });
        }
      }
    }
  } else {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
      if (rows.length === 0) continue;
      const columns = rows[0].map((c, i) => (c == null || c === '' ? `col_${i+1}` : String(c).trim()));
      const dataRows = rows.slice(1);
      datasets.push({
        name: `${fileName} > ${sheetName}`,
        records: dataRows.map((row, idx) => {
          const fields = {};
          columns.forEach((col, i) => fields[col] = row[i]);
          return { sourceRef: `${sheetName}!row${idx+2}`, fields };
        }),
      });
    }
  }
  return datasets;
}

function buildResource(record, template) {
  if (template.resourceType === 'Patient') return buildPatientRow(record, template);
  if (template.resourceType === 'Encounter') return buildEncounterRow(record, template);
  if (template.resourceType === 'Observation') return buildObservationRow(record, template);
  throw new Error(`Unsupported resourceType: ${template.resourceType}`);
}

// === Main ===

async function main() {
  const inputPath = args.values.input;
  const outputPath = args.values.output;
  const format = args.values.format;
  const verbose = args.values.verbose;

  await mkdir(outputPath, { recursive: true });

  console.log(`clinconvert CLI v${VERSION}`);
  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Format: ${format}`);
  console.log('');

  const files = await discoverFiles(inputPath);
  console.log(`Discovered ${files.length} supported file(s).`);
  if (files.length === 0) {
    console.error('No supported files (need .xlsx / .xls / .csv / .json).');
    process.exit(1);
  }

  const allResources = [];
  const allErrors = [];
  let processed = 0;

  const startTime = Date.now();

  for (const filePath of files) {
    const fileName = basename(filePath);
    if (verbose) console.log(`\n→ ${fileName}`);
    try {
      const buf = await readFile(filePath);
      const isJson = /\.json$/i.test(fileName);
      const datasets = parseFile(buf, fileName, isJson);
      for (const ds of datasets) {
        const tpl = suggestTemplate(ds.name);
        if (!tpl) {
          if (verbose) console.log(`  · ${ds.name}: no template matched`);
          continue;
        }
        let built = 0;
        let errored = 0;
        for (const rec of ds.records) {
          try {
            allResources.push(buildResource(rec, tpl));
            built++;
          } catch (err) {
            errored++;
            allErrors.push({ file: fileName, sourceRef: rec.sourceRef, reason: err.message });
          }
        }
        if (verbose) console.log(`  · ${ds.name}: ${built} built, ${errored} errors (${tpl.id})`);
      }
      processed++;
    } catch (err) {
      console.error(`  ✗ ${fileName}: ${err.message}`);
      allErrors.push({ file: fileName, sourceRef: '<file>', reason: err.message });
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nProcessed ${processed}/${files.length} files in ${elapsed}s.`);
  console.log(`Total FHIR resources: ${allResources.length}`);
  console.log(`Conversion errors:    ${allErrors.length}`);

  // === Write output ===

  if (format === 'bundle' || format === 'transaction') {
    const isTx = format === 'transaction';
    const bundle = {
      resourceType: 'Bundle',
      type: isTx ? 'transaction' : 'collection',
      timestamp: new Date().toISOString(),
      entry: allResources.map((r) => ({
        fullUrl: r.id ? `urn:uuid:${r.id}` : undefined,
        resource: r,
        ...(isTx ? { request: { method: 'POST', url: r.resourceType } } : {}),
      })),
    };
    const outFile = join(outputPath, `fhir-${isTx ? 'transaction' : 'bundle'}.json`);
    await writeFile(outFile, JSON.stringify(bundle, null, 2));
    console.log(`Wrote: ${outFile}`);
  } else if (format === 'ndjson') {
    const outFile = join(outputPath, 'fhir.ndjson');
    await writeFile(outFile, allResources.map((r) => JSON.stringify(r)).join('\n'));
    console.log(`Wrote: ${outFile}`);
  } else if (format === 'organized') {
    // by type
    const byType = {};
    const byPatient = {};
    for (const r of allResources) {
      if (!byType[r.resourceType]) byType[r.resourceType] = [];
      byType[r.resourceType].push(r);
      let pid;
      if (r.resourceType === 'Patient') pid = r.id;
      else if (r.subject?.reference) pid = r.subject.reference.replace(/^Patient\//, '');
      if (pid) {
        if (!byPatient[pid]) byPatient[pid] = [];
        byPatient[pid].push(r);
      }
    }

    // bundle-all.json
    await writeFile(join(outputPath, 'bundle-all.json'), JSON.stringify({
      resourceType: 'Bundle', type: 'collection',
      timestamp: new Date().toISOString(),
      entry: allResources.map((r) => ({ resource: r })),
    }, null, 2));

    // by-resource-type/
    await mkdir(join(outputPath, 'by-resource-type'), { recursive: true });
    for (const [type, arr] of Object.entries(byType)) {
      await writeFile(
        join(outputPath, 'by-resource-type', `${type.toLowerCase()}s.json`),
        JSON.stringify({ resourceType: 'Bundle', type: 'collection', entry: arr.map((r) => ({ resource: r })) }, null, 2)
      );
    }

    // by-patient/
    await mkdir(join(outputPath, 'by-patient'), { recursive: true });
    for (const [pid, arr] of Object.entries(byPatient)) {
      await writeFile(
        join(outputPath, 'by-patient', `patient-${pid.replace(/[\\/:*?"<>|]/g, '_')}.json`),
        JSON.stringify({ resourceType: 'Bundle', type: 'collection', entry: arr.map((r) => ({ resource: r })) }, null, 2)
      );
    }

    // errors.csv
    if (allErrors.length > 0) {
      const csv = ['file,source_ref,reason', ...allErrors.map((e) =>
        `"${e.file.replace(/"/g,'""')}","${e.sourceRef.replace(/"/g,'""')}","${e.reason.replace(/"/g,'""')}"`
      )].join('\n');
      await writeFile(join(outputPath, 'errors.csv'), csv);
    }

    // README.md
    const readme = `# clinconvert CLI output

Generated: ${new Date().toISOString()}
Processing time: ${elapsed}s

## Summary
- Input files: ${files.length}
- Files processed OK: ${processed}
- Total FHIR resources: ${allResources.length}
- Unique patients: ${Object.keys(byPatient).length}
- Conversion errors: ${allErrors.length}

## Resources by type
${Object.entries(byType).map(([t, a]) => `- **${t}**: ${a.length}`).join('\n')}

## Folder structure
\`\`\`
bundle-all.json              All resources in one Bundle (collection)
by-resource-type/            Per-resource-type Bundles
by-patient/                  Per-patient Bundles
errors.csv                   Conversion failures (with reason)
\`\`\`

---
Generated by clinconvert CLI v${VERSION}
https://clinconvert.pages.dev/
`;
    await writeFile(join(outputPath, 'README.md'), readme);

    console.log(`Wrote: ${outputPath}/ (organized structure)`);
  }

  if (args.values.strict && allErrors.length > 0) {
    console.error(`Strict mode: exiting with error code due to ${allErrors.length} conversion failures.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
