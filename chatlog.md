# csvtable.js — Project Chatlog

## Session: February 11, 2026

### Phase 1: Initial Requirements Gathering

**User brief:** Lightweight JS library for HTML dashboards. Renders tables from hidden/external CSV data. Single-file, embeddable via `<script>`.

**8 core requirements stated:**
1. Output via `<tbody>` and `<tfoot>` of existing styled tables
2. Filterable via on-screen `<select>` elements
3. Configurable indexing, value-based, near-plain-text format
4. Output column selection via indexing from R3
5. Multiple tables with different column selections/filters
6. Filter wiring in near-plain-text syntax
7. Aggregation/grouping via pseudo pivot table parameters
8. No file modification needed beyond config block

### Phase 2: Clarifying Questions & Answers

**Data source:** Inline `<script type="text/csv">` (mandatory) + external fetch (mandatory).

**CSV parsing:** Must handle `''` and `""` quoted fields, commas inside quotes. No newlines or `/` guaranteed by data producer.

**Indexing/mapping syntax decided:**
```
TableName1 (col1: AOID; col2: Region; col3: Asset Name; col4: m2r)
```

**Column-level config:** type, decimals, locale, format, showColTotal, showRowTotal.

**Output tags:** `{TableName1:Col1}`, `{TableName1:Col1Total}`, `{TableName:RowTotal}` — placed in `<td>` or `<span>`.

**Filters:**
- Bind to existing `<select>`, auto-populate options from distinct values (datalist-style).
- Auto-populate can be turned off per filter (`static` flag) for hard-coded options.
- Static filters in config: `Region=Quebec`, `Region<>Ontario`, `Asset Name~Tower`.
- Operators: `=` (eq), `<>` (neq), `~` (contains).

**Filter wiring syntax decided:** JS config array:
```js
{ table: "Name", select: "element_id", column: "CSVHeader" }
```

**Aggregation:** pandas-style — sum, count, mean, min, max, nunique. Single-level grouping, flat tabular output, no collapsing.

**Sorting:** Driven by host HTML `<th class="sortable" data-sort-type="number">`.

**Localization:** `en-CA` and `fr-CA` via `Intl.NumberFormat`. Decimal places configurable per column (0, 1, 2).

**Rendering:** Live automatic re-render on filter change. `<tfoot>` optional/configurable per table.

**Added requirements:** R9 (zero deps), R10 (declarative HTML API), R11 (formatter hooks), R13 (event hooks), R15 (idempotent render). R12 (empty state: 0 for numbers, null for text, "No data" row). R16 (25,000 rows).

### Phase 3: Follow-up Decisions

- **No cascading filters.** All independent. Option lists from full static-filtered data, populated once.
- **Template tags** scoped to `<td>` and `<span>`. Unused tags silently ignored. Missing references → empty. Never throws.
- **Auto-initialize on `DOMContentLoaded`.** No `init()` call needed.

### Phase 4: Deliverables Produced

1. **Dashboard_Table_Library_Technical_Requirements.docx** — Full 15-section requirements document with tables, code examples, non-functional requirements, config syntax summary, architecture constraints, and glossary.

2. **BUILD_PROMPT.md** — Bulletproof coding agent prompt. 15 sections covering: ground rules, CSV parsing with test cases, config schema, all parsers with input/output examples, rendering engine, filtering engine, aggregation engine, sorting, localization, declarative HTML API, error handling, file structure, 13 test cases, deliverables list, and "what not to do" guardrails.

3. **CLAUDE.md** — Project-level instruction file for Claude Code. Covers architecture, constraints, file boundaries, commands, parser gotchas, config string formats, formatting rules, sort behavior, empty state, and performance target.

### Key Design Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data embedding | `<script type="text/csv">` | Lightest weight, no DOM overhead |
| Config syntax | Near-plain-text strings in JS object | Readable by non-devs, parseable by library |
| Filter independence | No cascading | Simpler UX, predictable behavior |
| Aggregation API | pandas-style naming | Familiar to data-oriented users |
| Sort ownership | Host HTML `<thead>` | Library doesn't generate markup |
| Locale engine | `Intl.NumberFormat` | Browser-native, zero-dependency |
| Init trigger | `DOMContentLoaded` | Zero-config startup |
| Error philosophy | Never throw, always log + skip | Dashboard must never break |
