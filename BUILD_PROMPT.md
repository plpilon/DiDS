# BUILD PROMPT — Dashboard Table Library (codename: `csvtable.js`)

> **Purpose of this document:** This is a complete implementation specification for a coding agent. Follow it top-to-bottom. Do not skip sections. Do not invent features not described here. Do not use external dependencies.

---

## 0. GROUND RULES

- **Single file.** The entire library is ONE JavaScript file: `csvtable.js`.
- **Zero dependencies.** No npm packages, no CDN imports, no build tools, no bundler.
- **Vanilla ES6+ JavaScript.** No TypeScript, no JSX, no frameworks.
- **No `eval()`, no `new Function()`, no inline style injection.** Must be CSP-safe.
- **The file has two sections:**
  1. `CONFIG` block at the top (the only part the user edits).
  2. Library engine below (the user never touches this).
- **Auto-initializes on `DOMContentLoaded`.** No init() call required.
- **Target: all modern browsers** (Chrome, Firefox, Safari, Edge). No IE11.
- **Performance: 25,000 rows must render in <200ms** on a mid-range laptop.
- **File size target: <15KB minified.**

---

## 1. DATA SOURCE — CSV PARSING

### 1.1 Two source modes (user picks one in CONFIG):

**Mode A — Inline CSV:**
```html
<script type="text/csv" id="source-data">
AOID,Region,Asset,Asset Name,m2r
1001,Quebec,BLD-A,"Tour Montréal",24
1002,Ontario,BLD-B,"King's Place",18
</script>
```
Config references it by CSS selector: `source: "#source-data"`

**Mode B — External CSV file:**
Config references it by path: `source: "data/assets.csv"`
Use `fetch()`. If fetch fails, log a clear error to console and stop. Do not throw uncaught exceptions.

### 1.2 CSV parser requirements:

Write a custom CSV parser. Do NOT use regex-only approaches. The parser must:

- Treat the **first row as headers**. Trim whitespace from header names.
- Handle fields enclosed in **double quotes** (`"value"`) and **single quotes** (`'value'`).
- Handle **commas inside quoted fields** correctly (e.g., `"Montréal, QC"` is one field).
- The data producer guarantees: **no newlines inside fields, no forward slashes inside fields.**
- Empty fields → empty string `""`. Numeric conversion happens later at format time.
- Strip the enclosing quotes from field values after parsing.
- Handle the edge case of a trailing newline at end of file (ignore empty last line).
- Return an object: `{ headers: string[], rows: string[][] }`

### 1.3 Parser test cases — your parser MUST pass all of these:

```
Input line: 1001,Quebec,BLD-A,"Tour Montréal",24
Expected:   ["1001", "Quebec", "BLD-A", "Tour Montréal", "24"]

Input line: 1002,Ontario,BLD-B,'King''s Place',18
Expected:   ["1002", "Ontario", "BLD-B", "King's Place", "18"]

Input line: 1003,,"",,"0"
Expected:   ["1003", "", "", "", "0"]

Input line: 1004,Quebec,"Building, Suite 200","Name",30
Expected:   ["1004", "Quebec", "Building, Suite 200", "Name", "30"]
```

---

## 2. CONFIG BLOCK STRUCTURE

The CONFIG block sits at the top of `csvtable.js`. It is a plain JS object. Here is the COMPLETE schema with EVERY supported property:

```javascript
const CSVTABLE_CONFIG = {

  // ─── DATA SOURCE (required, pick one) ───
  source: "#source-data",        // CSS selector for <script type="text/csv">
  // source: "data/assets.csv",  // OR relative/absolute path to .csv file

  // ─── TABLE DEFINITIONS (required, at least one) ───
  tables: {

    // Each key is the table name. It must match a data-table-name attribute in the HTML.
    SummaryByRegion: {

      // Column mapping string (required).
      // Format: "col1: SourceHeader [options]; col2: SourceHeader [options]; ..."
      // Options are optional, inside square brackets, semicolon-separated.
      // Supported options: type, decimals, locale, format, showColTotal, showRowTotal
      columns: "col1: Region [type:text]; col2: m2r [type:number; decimals:0; locale:fr-CA; showColTotal:true]",

      // Static filters applied before any dynamic filter. Optional.
      // Format: "ColumnName=value" or "ColumnName<>value" or "ColumnName~value"
      // Multiple filters separated by semicolons.
      staticFilters: "Region=Quebec",

      // Group-by column name (friendly name from columns). Optional.
      groupBy: "Region",

      // Aggregation per column. Optional. Only meaningful if groupBy is set.
      // Format: "colName: func; colName: func"
      // Supported functions: sum, count, mean (alias: avg), min, max, nunique
      agg: "m2r: sum",

      // Show <tfoot> with column totals. Optional. Default: false.
      tfoot: true,

      // Default locale for all columns in this table. Optional. Default: "en-CA".
      locale: "fr-CA"
    },

    AssetDetail: {
      columns: "col1: AOID [type:text]; col2: Region [type:text]; col3: Asset Name [type:text]; col4: m2r [type:number; decimals:2]",
      tfoot: false
    }
  },

  // ─── FILTER WIRING (optional) ───
  filters: [
    // Each entry wires one <select> element to one column of one table.
    // select: the id attribute of the <select> element in the HTML.
    // column: the SOURCE CSV header name this filter operates on.
    // static: if true, the library does NOT auto-populate <option> elements.
    //         The HTML author has hard-coded them. Default: false.
    { table: "SummaryByRegion", select: "region_select", column: "Region" },
    { table: "SummaryByRegion", select: "year_select", column: "Year", static: true },
    { table: "AssetDetail", select: "region_select", column: "Region" }
  ],

  // ─── EVENT HOOKS (optional) ───
  hooks: {
    onRender: function(e) { /* e = { tableName, rowCount, data } */ },
    onFilter: function(e) { /* e = { tableName, filters, matchCount } */ }
  },

  // ─── CUSTOM FORMATTERS (optional) ───
  formatters: {
    status: function(val) { return Number(val) > 12 ? "Critical" : "OK"; }
  }
};
```

---

## 3. CONFIG PARSING — COLUMN STRING PARSER

You must write a parser for the column definition string. This is critical — get it right.

**Input:** `"col1: Region [type:text]; col2: m2r [type:number; decimals:0; locale:fr-CA; showColTotal:true]"`

**Output (array of objects):**
```javascript
[
  {
    key: "col1",              // positional key
    sourceHeader: "Region",   // exact CSV header name to look up
    type: "text",             // "text" or "number". Default: "text"
    decimals: 0,              // integer. Default: 0
    locale: null,             // null = inherit from table-level locale. Default: null
    format: null,             // formatter name or null. Default: null
    showColTotal: false,      // boolean. Default: false
    showRowTotal: false       // boolean. Default: false
  },
  {
    key: "col2",
    sourceHeader: "m2r",
    type: "number",
    decimals: 0,
    locale: "fr-CA",
    showColTotal: true,
    showRowTotal: false
  }
]
```

**Parsing rules:**
1. Split the string on `;` that are OUTSIDE square brackets.
2. For each segment, extract `colN: HeaderName` and optionally `[options]`.
3. Header names may contain spaces (e.g., `Asset Name`). Trim whitespace.
4. Options inside `[]` are semicolon-separated `key:value` pairs.
5. Boolean values: `"true"` → `true`, anything else → `false`.
6. Numeric values: parse with `parseInt`.

---

## 4. STATIC FILTER PARSER

**Input:** `"Region=Quebec; Asset Name~Tower"`

**Output (array of objects):**
```javascript
[
  { column: "Region", operator: "eq", value: "Quebec" },
  { column: "Asset Name", operator: "contains", value: "Tower" }
]
```

**Operators:**
| Syntax | Internal name | Logic |
|--------|--------------|-------|
| `=`    | `eq`         | `row[col] === value` (case-sensitive exact match) |
| `<>`   | `neq`        | `row[col] !== value` |
| `~`    | `contains`   | `row[col].toLowerCase().includes(value.toLowerCase())` |

Split on `;` first, then detect the operator by checking for `<>` first (two-char), then `~`, then `=`.

---

## 5. RENDERING ENGINE

### 5.1 Table binding

On init, for each table in CONFIG.tables, find the HTML element:
```javascript
document.querySelector(`table[data-table-name="${tableName}"]`)
```
If not found, log a warning: `[csvtable] Table element not found for: ${tableName}` and skip. Do NOT throw.

### 5.2 Render pipeline (execute in this exact order)

For each table, on every render cycle:

```
1. READ     → Get cached parsed rows (string[][]) and headers (string[])
2. MAP      → For each row, extract only the columns defined in this table's column config.
              Build an array of objects keyed by the column's `key` (col1, col2, etc.)
              Also store the sourceHeader name for filter matching.
3. STATIC   → Apply static filters. Remove rows that don't match.
4. DYNAMIC  → Apply current values from bound <select> elements. "All" or "" = no filter.
5. GROUP    → If groupBy is set, group rows and apply aggregation functions.
6. SORT     → If a sort column is active (from <thead> click), sort the rows.
7. FORMAT   → Convert raw values to display strings using locale, decimals, formatters.
8. DOM      → Build a DocumentFragment. Create <tr>/<td> elements. Replace <tbody> innerHTML.
              If tfoot is enabled, build and replace <tfoot> content.
9. TAGS     → Scan the document for template tags and resolve them.
10. HOOKS   → Fire onRender callback.
```

### 5.3 DOM rendering rules

- **ALWAYS clear before writing:** `tbody.innerHTML = ""; tfoot.innerHTML = "";`
- **Use DocumentFragment** for batch DOM construction. Do NOT append row-by-row to the live DOM.
- Each `<td>` gets a `data-col="col1"` attribute matching the column key.
- Each `<tr>` gets a `data-row-index` attribute (0-based).
- For grouped/aggregated tables, add `class="group-row"` to aggregate rows.

### 5.4 Empty state

When zero rows match after filtering:
- **<tbody>:** Render a single `<tr>` with one `<td>` that has `colspan` equal to the number of columns. Text content: `"No data"`. Add class `no-data-row`.
- **<tfoot>:** If enabled, render totals row with `0` for numeric columns (formatted with locale/decimals) and empty string for text columns.

### 5.5 Template tags

After rendering tables, scan the entire `document.body` for text nodes matching the pattern `{TableName:colKey}`, `{TableName:colKeyTotal}`, or `{TableName:RowTotal}`.

**Implementation:**

```
1. Use a TreeWalker to find all text nodes in document.body.
2. For each text node, check if it contains a pattern matching: {word:word}
3. Regex: /\{(\w+):(\w+)\}/g
4. For each match:
   a. Look up the table name in the resolved data.
   b. Look up the column key.
   c. If the key ends with "Total", resolve to the column total.
   d. If key is "RowTotal", resolve to the row total for that row context.
   e. Replace the tag text with the resolved value.
   f. If the table or column doesn't exist, replace with "" (empty string).
5. NEVER throw an error for an unresolved tag. Silent empty replacement.
```

**CRITICAL:** Template tags are found inside `<td>` and `<span>` elements. The parent element is preserved; only the text content changes. If a `<span class="kpi-value">{TableName1:col1Total}</span>` exists, after resolution it becomes `<span class="kpi-value">1,234</span>`. The class and element are untouched.

**CRITICAL:** Not every column defined in CONFIG needs a corresponding template tag in the HTML. Not every table needs to use tags at all. Unused columns and unused tags are silently ignored. The page must never break due to missing tags.

---

## 6. FILTERING ENGINE

### 6.1 Static filters
Applied in step 3 of the pipeline. These never change after init. Parse them once, cache the predicate functions.

### 6.2 Dynamic filters (<select> binding)

On init, for each entry in `CONFIG.filters`:
1. Find the `<select>` element by id: `document.getElementById(entry.select)`
2. If not found, log warning and skip. Do NOT throw.
3. If `entry.static !== true`, auto-populate options:
   a. Get the full dataset AFTER static filters only (not after other dynamic filters).
   b. Extract distinct values for `entry.column`.
   c. Sort alphabetically.
   d. Clear existing `<option>` elements.
   e. Prepend an `<option value="">All</option>`.
   f. Add one `<option>` per distinct value.
4. Attach a `change` event listener that triggers a re-render of **only the tables this select is wired to**.

### 6.3 Filter independence (NO cascading)

This is critical: **filters are independent**. When filter A changes:
- Re-render the affected tables using the new filter values.
- Do **NOT** re-populate the options of filter B based on filter A's selection.
- Each filter's options are always derived from the full static-filtered dataset, never from the dynamically-filtered subset.

The option lists are populated ONCE on init and never change unless the source data itself changes.

### 6.4 Multiple tables sharing a filter

A single `<select>` can be wired to multiple tables. When it changes, ALL tables that reference it re-render. Each table applies the filter to its own column independently.

---

## 7. AGGREGATION ENGINE

### 7.1 Grouping

When `groupBy` is set on a table:
1. After filtering, group rows by the value of the groupBy column.
2. For each group, produce ONE output row.
3. The groupBy column shows the group key value.
4. Other columns are aggregated using the function specified in `agg`, or the defaults.

### 7.2 Default aggregation (when `agg` is not specified for a column):
- `type: "number"` → `sum`
- `type: "text"` → `first` (first encountered value in the group)

### 7.3 Aggregation functions — implement ALL of these:

```javascript
sum:     (values) => values.reduce((a, b) => a + b, 0)
count:   (values) => values.filter(v => v !== null && v !== "").length
mean:    (values) => sum(values) / count(values)   // handle division by zero → 0
min:     (values) => Math.min(...numericValues)     // ignore non-numeric
max:     (values) => Math.max(...numericValues)     // ignore non-numeric
nunique: (values) => new Set(values).size
first:   (values) => values[0] ?? ""
```

### 7.4 Aggregation string parser

**Input:** `"m2r: sum; asset_count: count"`

**Output:**
```javascript
{ "m2r": "sum", "asset_count": "count" }
```

Note: the keys here are the SOURCE HEADER names (or friendly names from the column mapping). The engine must resolve them to the correct column.

---

## 8. SORTING

### 8.1 Sort is driven by the HOST HTML, not by config.

The library looks for `<th>` elements with `class="sortable"` inside the `<thead>` of each bound table.

### 8.2 Sort setup (on init, per table):

1. Find all `<th class="sortable">` in the table's `<thead>`.
2. Read `data-sort-type` attribute: `"number"` or `"text"`. Default: `"text"`.
3. Map each `<th>` to a column index (position within the row, 0-based).
4. Attach a `click` event listener to each.

### 8.3 Sort behaviour:

Click cycles: **unsorted → ascending → descending → unsorted**

Track sort state per table: `{ columnIndex: number | null, direction: "asc" | "desc" | null }`

### 8.4 Sort comparators:

```javascript
// Text sort
(a, b) => a.localeCompare(b)

// Number sort  
(a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)
```

### 8.5 Visual feedback:

Add/remove CSS classes on the `<th>`:
- `sort-asc` when ascending
- `sort-desc` when descending
- Remove both when unsorted

Do NOT inject CSS. The host page is responsible for styling these classes (e.g., adding arrow indicators).

---

## 9. LOCALIZATION & FORMATTING

### 9.1 Number formatting

Use `Intl.NumberFormat` exclusively. Never hand-roll thousand separators.

```javascript
function formatNumber(value, locale, decimals) {
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}
```

### 9.2 Locale resolution order:
1. Column-level `locale` property (highest priority).
2. Table-level `locale` property.
3. Global default: `"en-CA"`.

### 9.3 Decimal resolution:
- Use the column's `decimals` property. Default: `0`.

### 9.4 Built-in format presets:

| Name       | Behaviour |
|------------|-----------|
| `currency` | Prefix with `$`, use locale formatting, 2 decimal places (override decimals). |
| `percent`  | Multiply by 100, append `%`, use locale formatting. |
| `none`     | Default. Use locale + decimals only. |

### 9.5 Custom formatters

If a column has `format: "status"` and `CONFIG.formatters.status` exists, call the formatter function AFTER locale formatting. The formatter receives the raw numeric value (not the formatted string) and returns a string.

### 9.6 Text column formatting

Text columns are output as-is. No locale processing. Empty values display as empty string (not "null", not "undefined"). The "null" literal string in empty state (Section 5.4) applies only to the single "No data" row scenario per the spec.

**CORRECTION:** Re-reading the spec — for the zero-results empty state, text cells display the literal string `null` and numeric cells display `0`. This applies ONLY to the tfoot totals row when the table has no matching data. The tbody shows the single "No data" colspan row instead.

---

## 10. DECLARATIVE HTML API (OPTIONAL OVERRIDE)

As an alternative to the JS CONFIG block, tables can be configured via data attributes:

```html
<table data-table-name="SummaryByRegion"
       data-columns="col1:Region; col2:m2r[type:number;decimals:0]"
       data-group-by="Region"
       data-agg="m2r:sum"
       data-tfoot="true"
       data-locale="fr-CA">
</table>

<select data-filter-table="SummaryByRegion"
        data-filter-column="Region">
</select>
```

**Rules:**
- On init, the library first reads `CSVTABLE_CONFIG`.
- Then it scans the DOM for elements with `data-table-name` and `data-filter-table` attributes.
- If a table name exists in BOTH the JS config and HTML attributes, **JS config wins**.
- If a table name exists only in HTML attributes, it is added to the runtime config.
- Use the same parsers as for the JS config strings.

---

## 11. ERROR HANDLING

**The library must NEVER throw an uncaught exception.** Every operation is wrapped in try/catch at the top level.

| Scenario | Behaviour |
|----------|-----------|
| Source element not found | Console error. Stop init for that source. |
| External CSV fetch fails | Console error. Stop init. |
| Table element not found in DOM | Console warn. Skip that table. Continue others. |
| Select element not found in DOM | Console warn. Skip that filter. Continue others. |
| Column header not found in CSV | Console warn. Column renders as empty. |
| Template tag references unknown table | Replace tag with "". No error. |
| Template tag references unknown column | Replace tag with "". No error. |
| Division by zero in mean aggregation | Return 0. |
| Non-numeric value in numeric column | Treat as 0 for calculations, empty string for display. |
| Empty CSV (headers only, no rows) | Render "No data" row. |

---

## 12. FILE STRUCTURE

The final `csvtable.js` file must follow this exact structure:

```javascript
/* ════════════════════════════════════════════════════════════════════
   csvtable.js — Lightweight Dashboard Table Library
   Version: 1.0.0
   ════════════════════════════════════════════════════════════════════ */

// ┌──────────────────────────────────────────────────────────────────┐
// │  CONFIGURATION — Edit this section only                          │
// └──────────────────────────────────────────────────────────────────┘

const CSVTABLE_CONFIG = {
  source: "#source-data",
  tables: { /* ... */ },
  filters: [ /* ... */ ],
  hooks: {},
  formatters: {}
};

// ┌──────────────────────────────────────────────────────────────────┐
// │  ENGINE — Do not edit below this line                            │
// └──────────────────────────────────────────────────────────────────┘

(function(CONFIG) {
  "use strict";

  // ... entire library wrapped in IIFE ...
  // Sections in order:
  // 1. CSV Parser
  // 2. Config Parsers (columns, static filters, agg)
  // 3. Data Store (parsed data cache)
  // 4. Filter Engine
  // 5. Aggregation Engine
  // 6. Sort Engine
  // 7. Formatter / Locale Engine
  // 8. DOM Renderer
  // 9. Template Tag Resolver
  // 10. Event Wiring (select change listeners, sort click listeners)
  // 11. Declarative HTML API scanner
  // 12. Init (DOMContentLoaded entry point)

  document.addEventListener("DOMContentLoaded", function() {
    init(CONFIG);
  });

})(CSVTABLE_CONFIG);
```

---

## 13. TESTING INSTRUCTIONS

After building the library, create a test file `test.html` that validates ALL of the following:

### Test 1: Basic rendering
- Inline CSV with 5 rows, 5 columns.
- One table showing 3 of the 5 columns.
- Verify: correct rows appear in `<tbody>`, correct number of columns.

### Test 2: Static filter
- Table with `staticFilters: "Region=Quebec"`.
- Verify: only Quebec rows appear.

### Test 3: Dynamic filter
- A `<select>` wired to Region column.
- Verify: options auto-populated with distinct values + "All".
- Verify: selecting "Ontario" shows only Ontario rows.
- Verify: selecting "All" shows all rows.

### Test 4: Filter independence
- Two `<select>` elements on the same table.
- Select a value in filter A.
- Verify: filter B's options have NOT changed.

### Test 5: Grouping + aggregation
- Table grouped by Region with `m2r: sum`.
- Verify: one row per region, m2r values are summed.

### Test 6: Sorting
- Click a sortable `<th>`.
- Verify: rows reorder. Click again: reverse. Click again: original order.

### Test 7: Locale formatting
- Column with `locale: "fr-CA"`, `decimals: 2`.
- Verify: number displays with narrow space as thousand separator and comma as decimal.

### Test 8: Template tags
- `<span>{TableName1:col1Total}</span>` in HTML.
- Verify: span content updates with the column total.

### Test 9: Missing tag graceful degradation
- `<span>{NonExistentTable:col1}</span>` in HTML.
- Verify: span is empty, no console errors.

### Test 10: Multiple tables
- Two different tables from the same CSV with different column selections.
- Verify: both render independently with correct data.

### Test 11: tfoot totals
- Table with `tfoot: true` and `showColTotal: true` on a numeric column.
- Verify: `<tfoot>` contains a row with the column sum.

### Test 12: Empty state
- Apply a filter that matches zero rows.
- Verify: "No data" row appears in tbody.

### Test 13: 25,000 row performance
- Generate a CSV with 25,000 rows programmatically.
- Verify: initial render completes in <200ms (use `performance.now()`).

### The test.html file must:
- Be self-contained (inline CSV + library script).
- Show PASS/FAIL for each test visually on the page.
- Log timing for Test 13 to the page.

---

## 14. DELIVERABLES

1. `csvtable.js` — The complete library file with example CONFIG at top.
2. `csvtable.min.js` — Minified version (can be done manually or noted as TODO).
3. `test.html` — The full test suite described in Section 13.
4. `example.html` — A realistic dashboard example with:
   - Inline CSV data (10-20 rows, 6 columns).
   - Two tables with different column selections.
   - Two filter dropdowns.
   - One grouped/aggregated table.
   - Template tags in `<span>` elements.
   - Sortable columns.
   - Both en-CA and fr-CA locales demonstrated.
   - Minimal but clean CSS showing the library works with styled tables.

---

## 15. WHAT NOT TO DO

- Do NOT create a class-based OOP architecture. Use a module pattern (IIFE) with plain functions.
- Do NOT use innerHTML to build rows. Use `document.createElement` and `DocumentFragment`.
- Do NOT add any CSS or `<style>` tags to the page. The library is JS-only.
- Do NOT use `setTimeout` or `requestAnimationFrame` for rendering. Render synchronously.
- Do NOT add loading spinners, skeleton screens, or UI chrome. The host page handles all visual design.
- Do NOT auto-generate `<table>`, `<thead>`, or `<select>` elements. Only populate `<tbody>`, `<tfoot>`, and `<option>` lists.
- Do NOT modify any element attributes except the ones explicitly described (sort classes on `<th>`, option population on `<select>`).
- Do NOT use `localStorage`, `sessionStorage`, or cookies.
- Do NOT use `async/await` anywhere except the initial `fetch()` for external CSV.
- Do NOT add polyfills.
