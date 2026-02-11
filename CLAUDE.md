# csvtable.js — Lightweight Dashboard Table Library

Single-file, zero-dependency vanilla JS (ES6+) library that renders HTML tables from CSV data. Populates `<tbody>` and `<tfoot>` of existing `<table>` elements. Does not generate its own markup.

## Architecture

```
csvtable.js (single file)
├── CONFIG block (top, user-editable)
└── Engine IIFE (bottom, never edited)
    ├── CSV Parser
    ├── Config Parsers (columns, filters, agg strings)
    ├── Data Store (parsed rows cache)
    ├── Filter Engine (static + dynamic)
    ├── Aggregation Engine (sum/count/mean/min/max/nunique)
    ├── Sort Engine (click-driven from <thead>)
    ├── Formatter Engine (Intl.NumberFormat, en-CA/fr-CA)
    ├── DOM Renderer (DocumentFragment → <tbody>/<tfoot>)
    ├── Template Tag Resolver (TreeWalker scan)
    ├── Declarative HTML API scanner (data-* fallback)
    └── Init (DOMContentLoaded auto-start)
```

Render pipeline per table per cycle: **Parse → Map → Static Filter → Dynamic Filter → Group/Agg → Sort → Format → DOM → Tags → Hooks**

## Constraints — NEVER violate these

- Zero external dependencies. No npm, no CDN, no build tools.
- No `eval()`, no `new Function()`, no inline `<style>`. CSP-safe.
- No `innerHTML` for row construction. Use `document.createElement` + `DocumentFragment`.
- Library NEVER generates `<table>`, `<thead>`, or `<select>`. Only fills `<tbody>`, `<tfoot>`, `<option>`.
- No CSS injection. Host page owns all styling.
- Unresolved template tags, missing DOM elements, or bad config NEVER throw. Log and skip.
- Filters are independent. No cascading. Option lists populated once from static-filtered data.

## File boundaries

- `csvtable.js` — THE deliverable. All library code lives here.
- `test.html` — Self-contained test suite (13 tests, inline CSV, visual PASS/FAIL).
- `example.html` — Realistic dashboard demo (2 tables, 2 filters, grouping, tags, sorting, dual locale).
- `BUILD_PROMPT.md` — Full implementation spec. **Read this first for any ambiguity.**

Do NOT create additional JS files, CSS files, node_modules, or package.json.

## Commands

```bash
# Validate — open test.html in browser, all 13 tests must show PASS
# No build step, no test runner, no npm scripts

# Quick file size check
wc -c csvtable.js
cat csvtable.js | wc -l

# Minify (optional, manual)
npx terser csvtable.js -o csvtable.min.js --compress --mangle
```

## CSV parser gotchas

- Fields can be wrapped in `"double"` or `'single'` quotes.
- Commas inside quoted fields must be handled. Escaped quotes (`''` inside single-quoted fields) must resolve.
- Data guarantees: no newlines inside fields, no `/` inside fields.
- First row is always headers. Trim header whitespace.
- Empty trailing line from EOF newline → ignore.

## Config string formats (get these right)

Column def: `"col1: SourceHeader [type:number; decimals:2; locale:fr-CA; showColTotal:true]; col2: Header Name"`
- Split on `;` OUTSIDE brackets. Header names may contain spaces.

Static filter: `"Region=Quebec; Asset Name~Tower"`
- Operators: `=` (eq), `<>` (neq), `~` (contains, case-insensitive). Check `<>` before `=`.

Filter wiring (JS config, not string):
```js
{ table: "Name", select: "element_id", column: "CSVHeader", static: false }
```

Agg: `"m2r: sum; count_col: count"` — keys are source header or friendly names.

## Formatting rules

- Use `Intl.NumberFormat` only. Never hand-roll separators.
- Locale resolution: column → table → `"en-CA"` default.
- `decimals: 0` is the default. Respect it even for totals.
- Custom formatters receive raw numeric value, return display string.
- Text columns: output as-is. Empty = `""`, not `"null"` or `"undefined"`.

## Sort behavior

Driven by host HTML: `<th class="sortable" data-sort-type="number">`. Library adds click handlers.
Cycle: unsorted → asc → desc → unsorted. Add/remove `sort-asc`/`sort-desc` classes. No CSS injected.

## Empty state

Zero matching rows → `<tbody>`: single "No data" row with full colspan. `<tfoot>` (if enabled): `0` for numeric cols, `""` for text.

## Performance target

25,000 rows < 200ms render. Use DocumentFragment batch writes, avoid row-by-row DOM append, minimize reflows.

## When in doubt

Read `BUILD_PROMPT.md` — it has input/output examples for every parser, the exact file structure, all 13 test case specs, and explicit "what NOT to do" guardrails.
