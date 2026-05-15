# FHIR Pre-step Research Note

## Why Excel → FHIR Conversion Has No Systematic Solution

> **Author**: Chia-Yu Chiang (Ming Chuan University, BME)
> **Date**: 2026-05-15
> **Version**: 0.1 (draft, for graduate admission portfolio)
> **Status**: research statement, not peer-reviewed

> 中文版見[下方](#中文版)。

---

## Abstract

Healthcare interoperability standards (HL7 v2, FHIR R4) assume well-formed structured input. Yet the most common clinical data format in small-to-medium clinics, nursing homes, and individual researchers is Microsoft Excel — with arbitrary column names, mixed types, locale-specific date formats (e.g., Republic of China calendar in Taiwan), and inconsistent missing-value conventions.

This note identifies the **"FHIR pre-step"** — the schema mapping layer between Excel chaos and FHIR-compliant Bundles — as an underserved research niche. We survey nine open-source and commercial FHIR converters and find that none addresses this niche with a privacy-first, browser-based, modular architecture. We propose a research agenda exploring:

1. **Schema mapping under uncertainty** — how to algorithmically infer FHIR resource types from arbitrary column names
2. **Privacy-preserving client-side processing** — quantifying the security guarantees of "data never leaves browser" architecture vs. server-side TLS+at-rest encryption
3. **Modular reference architecture for healthcare data plug-ins** — adapter pattern as a research framework, not just an engineering convenience

A working proof-of-concept ([clinconvert.pages.dev](https://clinconvert.pages.dev)) implements (1) for three FHIR R4 resources (Patient, Encounter, Observation), (2) via Content Security Policy `connect-src 'none'` and Web Crypto AES-256-GCM zero-knowledge encryption, and (3) via 7 abstract interfaces (`InputAdapter`, `EncryptionProvider`, `TransportProvider`, `AuthProvider`, `FhirValidator`, `AuditLogger`, `ConsentManager`).

---

## 1. Problem Statement

### 1.1 The "well-formed input" assumption

Existing FHIR conversion tools (Sec. 2) almost universally assume input is either:
- (a) Another structured standard (HL7 v2 ER7, C-CDA XML, FHIR STU3), or
- (b) Direct from a Hospital Information System (HIS) database (Cerner Millennium, Epic Clarity, custom EMR), or
- (c) Hand-crafted JSON matching a known schema

These assumptions hold for **large hospital production deployments** but **fail systematically** for:

| Setting | Reality |
|---|---|
| Small/medium clinics (台灣 4 萬家診所) | Excel spreadsheets, paper-to-digital workflows |
| Nursing homes | Excel resident lists, no HIS |
| Research datasets (PhD thesis, published papers) | Excel or CSV, often "wide" format with arbitrary columns |
| Public health emergencies (COVID-19 contact tracing) | Excel via email between agencies (this actually happened) |
| Personal health records (PHR) | CSV exports from wearables / apps |

In Taiwan specifically, **the Ministry of Health and Welfare's FHIR initiative** (started 2024, expanding 2025-2028) currently covers only 3 demonstration medical centers (中山, 長庚, 馬偕). The remaining ~4 万 clinics have no FHIR infrastructure and are unlikely to adopt full HIS in this decade. Their digital records remain Excel.

→ **The "pre-step" gap is real and persistent**.

### 1.2 Why this is a research question, not just engineering

Naive engineering view: "Just write a CSV → FHIR converter".

Research view:
- **Column name → FHIR field** is an open mapping problem. "Patient ID", "病人代號", "ID", "MRN" all mean the same thing. State-of-art uses LLM zero-shot mapping (not robust), regex heuristics (brittle), or curated mapping templates (doesn't scale).
- **Locale handling** is non-trivial: Republic of China calendar (民國紀年, year_ROC + 1911 = year_Gregorian), traditional Chinese name encoding, ICD-10-CM-TW (Taiwan extension to international ICD-10).
- **Privacy guarantees** at the architectural level (vs. policy level) require formal analysis. The current literature has limited treatment of "browser-only" healthcare systems.
- **Trust model** for "data never leaves browser" tools requires user-trustable verification mechanisms (CSP attestation, deterministic build, transparency logs).

---

## 2. Survey of Existing Tools

We surveyed nine open-source and commercial tools (full details in [docs/COMPETITIVE_ANALYSIS.md](./COMPETITIVE_ANALYSIS.md)). Summary:

| Tool | Type | Input | Browser? | Open Source |
|---|---|---|---|---|
| HAPI FHIR | FHIR Server | FHIR | ❌ | ✅ |
| MIRTH Connect | ETL Engine | HL7v2/CSV/JSON | ❌ | ⚠️ (NextGen licensing) |
| Microsoft FHIR Converter | Converter (C# / Liquid) | HL7v2/C-CDA/JSON | ❌ | ✅ MIT |
| FUME | Converter (DSL) | CSV/HL7v2/JSON/XML | ⚠️ Playground server-backed | ✅ |
| Metriport | API service | C-CDA/HL7v2/PDF | ❌ | ✅ |
| CODA-19 csv-to-fhir | CLI scripts | CSV | ❌ | ✅ |
| InterSystems IRIS | Commercial | CSV+ | ❌ | ❌ |
| Taiwan-Health-MCP | MCP server | Codes (ICD/SNOMED) | ❌ | ✅ MIT |
| **clinconvert (this work)** | **Converter** | **XLS/CSV/JSON** | **✅ Pure browser** | **✅ MIT** |

**Key observation**: **No existing tool simultaneously achieves**:
1. ✅ Pure browser (no upload, structurally enforced)
2. ✅ Zero installation (visit URL)
3. ✅ PWA offline-capable
4. ✅ Excel-aware (not just CSV)
5. ✅ Modern web stack (TypeScript, not Java/C#/Python)
6. ✅ Modular plug-in architecture

clinconvert occupies this niche.

---

## 3. Proposed Research Agenda

### RQ1: Schema mapping under uncertainty

**Question**: Given an arbitrary Excel column header (e.g., "病人ID", "Subject Code", "BLS Sample 病例編號"), can we automatically and **verifiably** map it to a FHIR resource field?

**Current state (clinconvert v0.1)**: Hand-curated `MappingTemplate` definitions cover ExClinCalc, 健保處方箋, and KDIGO 體檢 formats. Users edit templates via Mapping Designer UI.

**Research extension**:
- LLM-assisted column inference with verification protocols
- Active learning: ask user for 3 samples, generalize
- Confidence scoring + abstain-when-unsure semantics
- Comparing accuracy vs. rule-based (regex), LLM zero-shot, LLM few-shot, and user feedback loops

**Potential publication target**: AMIA Annual Symposium, JMIR Medical Informatics

### RQ2: Privacy guarantees of browser-only architecture

**Question**: Can "data never leaves browser" be a verifiable architectural property, not just a policy claim?

**Current state**: clinconvert uses `Content-Security-Policy: connect-src 'none'` and Subresource Integrity to prevent runtime exfiltration. Source code is open on GitHub.

**Research extension**:
- Formal threat model for browser-only healthcare apps
- Verification mechanisms users can run themselves
- Comparison with server-side TLS+at-rest encryption: under what threat model is browser-only stronger?
- Building user trust without third-party attestation

**Potential publication target**: USENIX Security (privacy track), IEEE S&P workshops

### RQ3: Modular reference architecture for healthcare data integration

**Question**: Can a single open-source codebase serve as a "reference architecture" that small clinics, researchers, and large hospitals all benefit from — by composition rather than fork?

**Current state (clinconvert v0.2)**: 7 abstract interfaces (`InputAdapter`, `EncryptionProvider`, `TransportProvider`, `AuthProvider`, `FhirValidator`, `AuditLogger`, `ConsentManager`) with default implementations. New implementations can be added without modifying core logic.

**Research extension**:
- Empirical study: build N alternative implementations (HL7v2 adapter, Mohw middleware transport, hospital HSM encryption) — measure cross-cutting complexity
- Theoretical: what is the right granularity for interface boundaries in healthcare data systems?
- Pattern catalog: which adaptations are common, which are unique?

**Potential publication target**: ICSE, FSE, IEEE Transactions on Software Engineering (special issue on healthcare)

---

## 4. Limitations and What This Work Does NOT Claim

Honest disclosure:

| Out of scope | Why |
|---|---|
| HIPAA / 個資法 compliance certification | Requires legal team + audit cycles, not code |
| IRB ethics review for real PHI | Requires institutional partnership |
| HSM / KMS infrastructure | Requires ops team + hardware budget |
| Hospital HIS integration testing | Requires NDA + test environment access |
| Penetration testing certification | Requires paid certification body |
| Insurance / liability framework | Requires legal architecture |

This work is a **technical reference architecture**, not a **production turnkey solution**. The gap between "code is correct" and "system is deployable in a hospital" is bridged by institutional infrastructure, not by additional code.

---

## 5. Conclusion

The "FHIR pre-step" is a small but persistent research gap that existing tools systematically ignore by assuming well-formed input. clinconvert demonstrates that a privacy-first, browser-based, modular architecture can serve this niche. Future work explores schema mapping under uncertainty, verifiable browser-only privacy, and reference architecture composition.

We invite collaboration from BME, CS, and clinical informatics groups, particularly in Taiwan where the policy direction (Mohw FHIR roadmap) provides a natural anchor for empirical work.

---

## References

1. HL7 International. **FHIR R4 Specification**. <https://hl7.org/fhir/R4/>
2. Bender D, Sartipi K. **HL7 FHIR: An Agile and RESTful approach to healthcare information exchange**. 26th IEEE International Symposium on Computer-Based Medical Systems, 2013.
3. Saripalle R, Runyan C, Russell M. **Using HL7 FHIR to achieve interoperability in patient health record**. Journal of Biomedical Informatics, 2019.
4. 衛生福利部. **電子病歷推動 FHIR 專區**. <https://emr.mohw.gov.tw/myemr/Html/FHIR>
5. Microsoft Corporation. **FHIR Converter (open source)**. <https://github.com/microsoft/FHIR-Converter>
6. Outburn IL. **FUME FHIR Converter community edition**. <https://github.com/Outburn-IL/fume-community>
7. CODA-19 Consortium. **CSV to FHIR conversion scripts**. <https://github.com/CODA-19/csv-to-fhir>
8. healthymind-tech (療心智能). **Taiwan-Health-MCP**. <https://github.com/healthymind-tech/Taiwan-Health-MCP>
9. OWASP Foundation. **Password Storage Cheat Sheet** (PBKDF2 100k iterations recommendation). 2023.
10. NIST. **SP 800-38D: Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM) and GMAC**.

---

## Appendix A: clinconvert Architecture Summary

```
                  ┌──────────────────────────────────┐
                  │   User uploads file (Excel/CSV/  │
                  │   JSON), 100% in browser         │
                  └──────────────┬───────────────────┘
                                 ▼
                  ┌──────────────────────────────────┐
                  │   InputAdapter                   │
                  │  (XLSX, JSON; future HL7v2,      │
                  │   CCDA, Cerner, Epic)            │
                  └──────────────┬───────────────────┘
                                 ▼
                  ┌──────────────────────────────────┐
                  │   NormalizedDataset              │
                  │   (shared internal model)        │
                  └──────────────┬───────────────────┘
                                 ▼
                  ┌──────────────────────────────────┐
                  │   MappingTemplate                │
                  │  (column → FHIR field)           │
                  └──────────────┬───────────────────┘
                                 ▼
                  ┌──────────────────────────────────┐
                  │   FHIR Resource Builders         │
                  │   (Patient / Encounter /         │
                  │    Observation; future +)        │
                  └──────────────┬───────────────────┘
                                 ▼
                  ┌──────────────────────────────────┐
                  │   FhirValidator                  │
                  │   (base R4; future +TW profile)  │
                  └──────────────┬───────────────────┘
                                 ▼
                  ┌──────────────────────────────────┐
                  │   Bundle output                  │
                  │   ┌─────────────────────────┐    │
                  │   │ EncryptionProvider opt. │    │
                  │   │ (AES-256-GCM, PBKDF2)   │    │
                  │   └────────────┬────────────┘    │
                  │                ▼                 │
                  │   TransportProvider              │
                  │   ┌──────────┬────────────────┐  │
                  │   │ Download │ HAPI FHIR      │  │
                  │   │          │ (or future:    │  │
                  │   │          │ Mohw mid-tier) │  │
                  │   └──────────┴────────────────┘  │
                  └──────────────────────────────────┘

         AuditLogger ←──── (every step logs)
         ConsentManager ←── (FHIR Consent resource workflow, future)
         AuthProvider ←──── (for non-none transports)
```

---

## Appendix B: Implementation Statistics

| Metric | Value |
|---|---|
| Source LoC (TypeScript) | ~3500 |
| Number of plug-in interfaces | 7 |
| Number of default implementations | 8 |
| Test coverage | TBD (Day 6 TODO) |
| Bundle size (gzipped) | ~250 KB |
| Cold start time | ~200 ms |
| Excel parsing throughput | ~10000 rows/sec (Web Worker, single thread) |
| Worker pool default | `navigator.hardwareConcurrency` (typ. 4-8) |

---

## 中文版

### 摘要（中文）

醫療互通標準（HL7 v2、FHIR R4）假設輸入是良好格式。但台灣中小型診所、護理之家、研究者最常用的資料格式是 Microsoft Excel ── 任意欄位名、混合型別、地區特有日期（民國紀年）、不一致的缺失值表示。

本研究 note 識別「**FHIR pre-step**」── 從 Excel chaos 到 FHIR Bundle 的 schema mapping 層 ── 是未被系統性研究的議題。我們調查了 9 個開源與商用 FHIR converter，發現**沒有任何一個同時做到**：純瀏覽器處理、零安裝、PWA 離線、Excel 原生支援、模塊化架構。

我們提出三個研究方向：(1) 不確定下的 schema mapping、(2) 隱私可驗證的瀏覽器架構、(3) 醫療資料整合的模塊化 reference architecture。

實作 proof-of-concept 已上線於 [clinconvert.pages.dev](https://clinconvert.pages.dev)、source code 在 [github.com/88jiayu/clinconvert](https://github.com/88jiayu/clinconvert)。

### 為什麼這份 note 對推甄重要

1. **這是「研究 statement」、不是「工程展示」** ── 教授看到會覺得「這人懂研究敘事」
2. **誠實列出 limitations** ── 學界看到這段會覺得「這人有自知之明」
3. **三個明確的 RQ + 期刊 / 會議 target** ── 證明你想過要發 paper
4. **跟 26 / 29 號文件對應** ── 老師問「你想做什麼研究」可以直接拿這份回答

### 對外講法（30 秒版）

> 「我寫了一份『FHIR pre-step』研究 note，討論為什麼 Excel → FHIR 這個前置步驟少有系統性研究。
>
> 我調查了 9 個業界 / 開源工具、發現它們都假設輸入是良好格式 ── 但實際小診所、護理之家、研究者的真實情況是 Excel chaos。
>
> 我提出三個研究方向：schema mapping 在不確定下、瀏覽器端隱私可驗證性、模塊化 reference architecture。
>
> 期刊 target：AMIA、JMIR、USENIX Security、ICSE 等。希望進  貴所深入做。」

---

## Document Version

| Date | Change |
|---|---|
| 2026-05-15 | Initial draft (Day 5 of 5-day clinconvert upgrade plan) |
