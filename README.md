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
- Supports reset of all active filters from any `<button type="reset">`
- Supports template-driven `<tbody>` and `<tfoot>` rows so you can style each cell with your own classes
- Supports config override from `window.CSVTABLE_CONFIG` in host HTML
- Supports grouping and aggregation (`sum`, `count`, `mean`, `min`, `max`, `nunique`)
- Supports click sorting on host `<th class="sortable">` headers
- Supports locale based number formatting using `Intl.NumberFormat`
- Resolves display tags like `{TableName:col1Total}` in page text

## Files in this repo

- `csvtable.js`: main library source
- `csvtable.min.js`: compact build artifact
- `test.html`: browser test page with 13 checks and PASS or FAIL output
- `example.html`: dashboard style usage example
- `Instructions.md`: usage guide with mapping, config, filter wiring, and value tag examples

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

## Validation

- Syntax check:

```bash
node --check csvtable.js
```

- Open `test.html` in a browser and verify all checks show PASS.

