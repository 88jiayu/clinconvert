# clinconvert CLI

Command-line version of [clinconvert](https://clinconvert.pages.dev/). For batch processing **thousands of files** beyond browser memory limits.

## Install

```bash
# From repo root
cd cli && npm install

# Or globally
npm install -g .
```

## Quick start

```bash
# Process a folder of XLSX, output organized bundles:
clinconvert -i ./xls-archive -o ./fhir-output

# Single file:
clinconvert -i patients.xlsx -o ./out

# NDJSON for FHIR server bulk import:
clinconvert -i ./batch -o ./out --format ndjson

# Strict mode (fail on validation errors):
clinconvert -i data.xlsx -o ./out --strict
```

## Why CLI (vs web)

| Scenario | Web | CLI |
|---|---|---|
| 1-10 files | ✅ | ✅ |
| 100 files | ✅ | ✅ |
| 1,000 files | ⚠️ may OOM | ✅ |
| 10,000+ files | ❌ | ✅ |
| Cron / batch automation | ❌ | ✅ |
| Network-air-gapped server | ❌ | ✅ |
| `find ... \| xargs clinconvert` pipelines | ❌ | ✅ |

## Output formats

- **organized** (default) ── Folder with `README.md` / `bundle-all.json` / `by-resource-type/` / `by-patient/` / `errors.csv`
- **bundle** ── Single FHIR Bundle (collection) JSON
- **transaction** ── FHIR Transaction Bundle (POST-able)
- **ndjson** ── Newline-delimited JSON

## Limitations (v0.1)

- Only auto-detected templates (ExClinCalc / KDIGO / NHI prescription)
- Custom mapping templates not yet supported via CLI (use web UI for now)
- No multi-core worker parallelism yet (sequential, but no browser overhead)
- HAPI validator integration is web-only

## Roadmap

- [ ] Custom JSON-based mapping templates (`--template ./my-template.json`)
- [ ] `--validate=hapi` to POST to HAPI public test server
- [ ] Worker threads for true parallel processing
- [ ] Streaming mode for huge single files

## License

MIT · Part of the [Clin- series](https://jiayuselfweb.pages.dev/projects)
