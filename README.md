# csvtable.js

`csvtable.js` is a lightweight, zero dependency JavaScript library that renders existing HTML tables from CSV data.

## What it does

- Reads CSV from either:
  - an inline `<script type="text/csv">` element, or
  - an external `.csv` file path via `fetch`
- Maps CSV headers to table columns using a declarative config string
- Supports static and dynamic filters
- Supports optional table-level paging with stylable `.pager-*` classes
- Supports row-click filters across tables (for example click in detail table to filter summary table)
- Supports CSV export buttons for source data and per-table rendered data
- Supports reset of all active filters from any `<button type="reset">`
- Supports template-driven `<tbody>` and `<tfoot>` rows so you can style each cell with your own classes
- Supports config override from `window.CSVTABLE_CONFIG` in host HTML
- Supports grouping and aggregation (`sum`, `count`, `mean`, `min`, `max`, `nunique`)
- Supports source-level metrics and source metric operations for KPI cards
- Supports click sorting on host `<th class="sortable">` headers
- Supports locale based number formatting using `Intl.NumberFormat`
- Resolves display tags like `{TableName:col1Total}` in page text

## Files in this repo

- `csvtable.js`: main library source
- `csvtable.min.js`: compact build artifact
- `test.html`: browser test page with 13 checks and PASS or FAIL output
- `example.html`: dashboard style usage example
- `Instructions.md`: usage guide with mapping, config, filter wiring, and value tag examples
- `config-assistant.html`: rules based GUI helper that generates config, hooks, and wiring snippets

## Quick start

1. Add an inline CSV source:

```html
<script type="text/csv" id="source-data">
AOID,Region,Asset Name,m2r
1001,Quebec,Tour Montréal,24
1002,Ontario,King's Place,18
</script>
```

2. Add a table shell:

```html
<table data-table-name="AssetDetail">
  <thead>
    <tr>
      <th class="sortable">AOID</th>
      <th>Region</th>
      <th>Asset Name</th>
      <th class="sortable" data-sort-type="number">m2r</th>
    </tr>
  </thead>
  <tbody></tbody>
  <tfoot></tfoot>
</table>
```

3. Define `window.CSVTABLE_CONFIG` in your page (recommended).

4. Load the script:

```html
<script src="csvtable.js"></script>
```

The library auto initializes on `DOMContentLoaded`.

## CSV downloads

You can add export buttons with a `type` attribute:

- `<button type="download-source">` exports the parsed source dataset
- `<button type="download-TableName">` exports the currently rendered rows for that table (after filtering, grouping, sorting, and paging)

Example:

```html
<button type="download-source">Download source CSV</button>
<button type="download-AssetDetail">Download AssetDetail CSV</button>
```


## Source metrics for KPIs

You can configure source-level metrics from raw CSV columns and optional operations between those metrics.

```html
<span>Total AOID: {source:totalUniqueAOID}</span>
<span>Total m2r: {source:sourceM2RSum}</span>
<span>m2r per AOID: {source:m2rPerAoid}</span>
```

```js
window.CSVTABLE_CONFIG = {
  sourceMetrics: {
    totalUniqueAOID: { column: "AOID", agg: "nunique" },
    sourceM2RSum: { column: "m2r", agg: "sum" }
  },
  sourceMetricOps: {
    m2rPerAoid: { op: "divide", left: "sourceM2RSum", right: "totalUniqueAOID", decimals: 2 }
  }
};
```

## Validation

- Syntax check:

```bash
node --check csvtable.js
```

- Open `test.html` in a browser and verify all checks show PASS.
