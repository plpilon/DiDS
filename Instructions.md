# Instructions for using csvtable.js

This guide shows how to map CSV columns, configure tables, wire filters, and place value tags in your display markup.

## 1) Add a CSV source

### Option A: Inline source

```html
<script type="text/csv" id="source-data">
AOID,Region,Asset,Asset Name,m2r,Year
1001,Quebec,BLD-A,Tour Montréal,24,2024
1002,Ontario,BLD-B,King's Place,18,2024
1003,Quebec,BLD-C,Central Hub,30,2023
</script>
```

Use this in config:

```js
source: "#source-data"
```

### Option B: External source

```js
source: "data/assets.csv"
```

## 2) Create table markup shells

The library fills only `<tbody>` and `<tfoot>`.

```html
<table data-table-name="SummaryByRegion">
  <thead>
    <tr>
      <th class="sortable">Region</th>
      <th class="sortable" data-sort-type="number">m2r</th>
    </tr>
  </thead>
  <tbody></tbody>
  <tfoot></tfoot>
</table>

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

## 3) Configure mapping and table behavior

Edit the config block at the top of `csvtable.js`.

```js
const CSVTABLE_CONFIG = {
  source: "#source-data",
  tables: {
    SummaryByRegion: {
      columns: "col1: Region [type:text]; col2: m2r [type:number; decimals:0; locale:fr-CA; showColTotal:true]",
      groupBy: "Region",
      agg: "m2r: sum",
      tfoot: true,
      locale: "fr-CA"
    },
    AssetDetail: {
      columns: "col1: AOID [type:text]; col2: Region [type:text]; col3: Asset Name [type:text]; col4: m2r [type:number; decimals:2]",
      staticFilters: "Region<>Archived",
      tfoot: true,
      locale: "en-CA"
    }
  },
  filters: [],
  hooks: {},
  formatters: {}
};
```

### Mapping format

`columns` uses this pattern:

`colKey: CSV Header [options]`

Example:

`col3: Asset Name [type:text]`

This maps CSV header `Asset Name` to output column key `col3`.

### Supported options in `columns`

- `type:text` or `type:number`
- `decimals:0` (integer)
- `locale:fr-CA`
- `format:currency` or `format:percent` or custom formatter name
- `showColTotal:true`
- `showRowTotal:true`

## 4) Configure static filters

Use `staticFilters` to filter before dynamic selects run.

```js
staticFilters: "Region=Quebec; Asset Name~Tower"
```

Operators:

- `=` exact match
- `<>` not equal
- `~` contains (case insensitive)

## 5) Wire dynamic select filters

Add selects in HTML:

```html
<select id="region_select"></select>
<select id="year_select">
  <option value="">All</option>
  <option>2023</option>
  <option>2024</option>
</select>
```

Wire them in config:

```js
filters: [
  { table: "SummaryByRegion", select: "region_select", column: "Region" },
  { table: "SummaryByRegion", select: "year_select", column: "Year", static: true },
  { table: "AssetDetail", select: "region_select", column: "Region" }
]
```

Notes:

- Non static filters auto populate options from the static filtered dataset.
- `static: true` means your HTML options are preserved.
- One select can drive multiple tables.
- Option lists do not cascade from each other.

## 6) Set value tags in display elements

You can place tags in text nodes such as `<span>` and `<td>`.

### Supported tag formats

- `{TableName:colKey}`
- `{TableName:colKeyTotal}`
- `{TableName:RowTotal}`

Example:

```html
<div class="kpi">Total m2r: <span>{SummaryByRegion:col2Total}</span></div>
<div class="kpi">First AOID: <span>{AssetDetail:col1}</span></div>
```

If a table or column key does not exist, the tag resolves to an empty string.

## 7) Optional declarative HTML configuration

You can define a table directly in markup when needed:

```html
<table
  data-table-name="SummaryByRegion"
  data-columns="col1:Region; col2:m2r[type:number;decimals:0]"
  data-group-by="Region"
  data-agg="m2r:sum"
  data-tfoot="true"
  data-locale="fr-CA">
  <thead>...</thead>
  <tbody></tbody>
  <tfoot></tfoot>
</table>
```

If a table exists in both JS config and HTML data attributes, JS config wins.

## 8) Sorting setup

Add sortable headers in your `<thead>`:

```html
<th class="sortable">Region</th>
<th class="sortable" data-sort-type="number">m2r</th>
```

Click cycle is:

- unsorted
- ascending
- descending
- unsorted

The library toggles `sort-asc` and `sort-desc` classes on `<th>`.

## 9) Hooks and custom formatters

```js
hooks: {
  onRender: function(e) {
    // e.tableName, e.rowCount, e.data
  },
  onFilter: function(e) {
    // e.tableName, e.filters, e.matchCount
  }
},
formatters: {
  status: function(val) {
    return Number(val) > 12 ? "Critical" : "OK";
  }
}
```

## 10) Minimal full page example

```html
<script type="text/csv" id="source-data">AOID,Region,m2r
1001,Quebec,24
1002,Ontario,18
</script>

<select id="region_select"></select>

<table data-table-name="Simple">
  <thead><tr><th>Region</th><th>m2r</th></tr></thead>
  <tbody></tbody><tfoot></tfoot>
</table>

<span>Total: {Simple:col2Total}</span>

<script src="csvtable.js"></script>
```

And matching config:

```js
const CSVTABLE_CONFIG = {
  source: "#source-data",
  tables: {
    Simple: {
      columns: "col1: Region [type:text]; col2: m2r [type:number; decimals:0; showColTotal:true]",
      tfoot: true
    }
  },
  filters: [
    { table: "Simple", select: "region_select", column: "Region" }
  ]
};
```

## 11) Manual verification checklist

1. Open the page.
2. Confirm table body rows render.
3. Confirm select options include `All` plus CSV distinct values.
4. Change filter and confirm table rows update.
5. Confirm tfoot totals update correctly.
6. Confirm display tag values resolve in spans.
7. Click sortable headers and confirm sorting direction changes.



## 12) Pager (optional, per table)

Enable paging in table config:

```js
tables: {
  AssetDetail: {
    columns: "col1: AOID [type:text]; col2: Region [type:text]; col3: Asset Name [type:text]; col4: m2r [type:number; decimals:2]",
    pager: { enabled: true, rowsPerPage: 5 }
  }
}
```

Or in declarative HTML:

```html
<table data-table-name="AssetDetail" data-pager="true" data-rows-per-page="5">
```

Pager DOM classes are all `pager-*` for styling:

- `.pager`
- `.pager-info`
- `.pager-controls`
- `.pager-btn`, `.pager-btn-prev`, `.pager-btn-next`
- `.pager-page`, `.pager-page-current`

Controls behavior:

- `Previous` shown only when not on page 1
- current page indicator always shown
- `Next` shown only when not on last page

## 13) Row click filter source (cross-table filtering)

You can use a clicked row from one table as a filter for another table.

```js
filters: [
  { table: "SummaryByRegion", select: "region_select", column: "Region" },
  {
    table: "SummaryByRegion",
    sourceTable: "AssetDetail",
    sourceColumn: "Region",
    column: "Region",
    trigger: "rowClick"
  }
]
```

You can also use a short string command in `filters`:

```js
filters: [
  "AssetDetail.Region -> SummaryByRegion.Region"
]
```

Command format:

- `SourceTable.SourceColumn -> TargetTable.TargetColumn`
- or `TargetTable.TargetColumn <- SourceTable.SourceColumn`
- optional prefix: `rowclick:`

Behavior:

- click a row in `AssetDetail` to filter `SummaryByRegion` by matching `Region`
- click the same row again to toggle the row filter off
- only the clicked source row is shown as active
- row-click filters combine with select filters using AND logic

## 14) Reset all filters

Any reset button triggers a global reset:

```html
<button type="reset">Reset filters</button>
```

Reset clears:

- all select-based dynamic filters
- all row-click filters
- pager current page back to page 1 on paged tables



## 15) Styling per column with template rows

You can author template rows directly in your table so each cell keeps your own classes.

```html
<table data-table-name="AssetDetail">
  <thead>...</thead>
  <tbody>
    <tr>
      <td class="col-aoid">{AssetDetail:col1}</td>
      <td class="col-region">{AssetDetail:col2}</td>
      <td class="col-asset-name">{AssetDetail:col3}</td>
      <td class="col-m2r">{AssetDetail:col4}</td>
    </tr>
  </tbody>
  <tfoot>
    <tr>
      <td></td><td></td><td>Total</td><td class="col-m2r-total">{AssetDetail:col4Total}</td>
    </tr>
  </tfoot>
</table>
```

The engine clones these rows and replaces tags on each render. Your classes are preserved.

## 16) Keep config in HTML

You can keep all configuration in the host page so `csvtable.js` never needs edits.

```html
<script>
window.CSVTABLE_CONFIG = {
  source: "#source-data",
  tables: {
    AssetDetail: {
      columns: "col1: AOID [type:text]; col2: Region [type:text]; col3: Asset Name [type:text]; col4: m2r [type:number; decimals:2]",
      tfoot: true
    }
  },
  filters: [
    { table: "AssetDetail", select: "region_select", column: "Region" }
  ]
};
</script>
<script src="csvtable.js"></script>
```

`window.CSVTABLE_CONFIG` takes priority when provided.
