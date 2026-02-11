/* ════════════════════════════════════════════════════════════════════
csvtable.js — Lightweight Dashboard Table Library
Version: 1.0.0
════════════════════════════════════════════════════════════════════ */

// ┌──────────────────────────────────────────────────────────────────┐
// │ CONFIGURATION — Edit this section only                          │
// └──────────────────────────────────────────────────────────────────┘
const CSVTABLE_CONFIG = {
  source: "#source-data",
  tables: {
    SummaryByRegion: {
      columns: "col1: Region [type:text]; col2: m2r [type:number; decimals:0; locale:fr-CA; showColTotal:true]",
      staticFilters: "",
      groupBy: "Region",
      agg: "m2r: sum",
      tfoot: true,
      locale: "fr-CA"
    },
    AssetDetail: {
      columns: "col1: AOID [type:text]; col2: Region [type:text]; col3: Asset Name [type:text]; col4: m2r [type:number; decimals:2]",
      tfoot: true
    }
  },
  filters: [
    { table: "SummaryByRegion", select: "region_select", column: "Region" },
    { table: "SummaryByRegion", select: "year_select", column: "Year", static: true },
    { table: "AssetDetail", select: "region_select", column: "Region" }
  ],
  hooks: {},
  formatters: {
    status: function(val) { return Number(val) > 12 ? "Critical" : "OK"; }
  }
};

// ┌──────────────────────────────────────────────────────────────────┐
// │ ENGINE — Do not edit below this line                            │
// └──────────────────────────────────────────────────────────────────┘
(function(CONFIG) {
  "use strict";

  const DEFAULT_LOCALE = "en-CA";

  const state = {
    source: { headers: [], rows: [] },
    headersIndex: {},
    tables: {},
    selectBindings: {},
    tableSummaries: {}
  };

  // 1. CSV Parser
  function parseCsvLine(line) {
    const out = [];
    let current = "";
    let quote = null;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];

      if (quote) {
        if (ch === quote) {
          if (line[i + 1] === quote) {
            current += quote;
            i += 1;
          } else {
            quote = null;
          }
        } else {
          current += ch;
        }
      } else if ((ch === "\"" || ch === "'") && current.length === 0) {
        quote = ch;
      } else if (ch === ",") {
        out.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }

    out.push(current.trim());
    return out;
  }

  function parseCsv(csvText) {
    const lines = String(csvText || "").replace(/\r/g, "").split("\n");
    if (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }
    if (!lines.length || lines[0].trim() === "") {
      return { headers: [], rows: [] };
    }

    const headers = parseCsvLine(lines[0]).map(function(h) { return h.trim(); });
    const rows = [];

    for (let i = 1; i < lines.length; i += 1) {
      if (lines[i].trim() === "") continue;
      const parsed = parseCsvLine(lines[i]);
      while (parsed.length < headers.length) parsed.push("");
      rows.push(parsed.slice(0, headers.length));
    }

    return { headers: headers, rows: rows };
  }

  // 2. Config Parsers
  function splitOutsideBrackets(value) {
    const input = String(value || "");
    const segments = [];
    let depth = 0;
    let current = "";
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (ch === "[") depth += 1;
      if (ch === "]") depth = Math.max(0, depth - 1);
      if (ch === ";" && depth === 0) {
        if (current.trim()) segments.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) segments.push(current.trim());
    return segments;
  }

  function parseColumns(value) {
    const out = [];
    const segments = splitOutsideBrackets(value);

    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      const colonIndex = segment.indexOf(":");
      if (colonIndex === -1) continue;

      const key = segment.slice(0, colonIndex).trim();
      const right = segment.slice(colonIndex + 1).trim();

      let sourceHeader = right;
      let options = "";
      const bracketStart = right.indexOf("[");
      const bracketEnd = right.lastIndexOf("]");

      if (bracketStart !== -1 && bracketEnd > bracketStart) {
        sourceHeader = right.slice(0, bracketStart).trim();
        options = right.slice(bracketStart + 1, bracketEnd);
      }

      const col = {
        key: key,
        sourceHeader: sourceHeader,
        type: "text",
        decimals: 0,
        locale: null,
        format: null,
        showColTotal: false,
        showRowTotal: false
      };

      if (options.trim()) {
        options.split(";").forEach(function(pair) {
          const idx = pair.indexOf(":");
          if (idx === -1) return;
          const k = pair.slice(0, idx).trim();
          const v = pair.slice(idx + 1).trim();
          if (k === "type") col.type = v === "number" ? "number" : "text";
          else if (k === "decimals") col.decimals = parseInt(v, 10) || 0;
          else if (k === "locale") col.locale = v || null;
          else if (k === "format") col.format = v || null;
          else if (k === "showColTotal") col.showColTotal = v === "true";
          else if (k === "showRowTotal") col.showRowTotal = v === "true";
        });
      }

      out.push(col);
    }

    return out;
  }

  function parseStaticFilters(value) {
    const out = [];
    splitOutsideBrackets(value).forEach(function(segment) {
      let idx;
      if ((idx = segment.indexOf("<>")) !== -1) {
        out.push({ column: segment.slice(0, idx).trim(), operator: "neq", value: segment.slice(idx + 2).trim() });
      } else if ((idx = segment.indexOf("~")) !== -1) {
        out.push({ column: segment.slice(0, idx).trim(), operator: "contains", value: segment.slice(idx + 1).trim() });
      } else if ((idx = segment.indexOf("=")) !== -1) {
        out.push({ column: segment.slice(0, idx).trim(), operator: "eq", value: segment.slice(idx + 1).trim() });
      }
    });
    return out;
  }

  function parseAgg(value) {
    const out = {};
    splitOutsideBrackets(value).forEach(function(segment) {
      const idx = segment.indexOf(":");
      if (idx === -1) return;
      out[segment.slice(0, idx).trim()] = segment.slice(idx + 1).trim().toLowerCase();
    });
    return out;
  }

  // 3. Data Store
  function buildHeaderIndex() {
    state.headersIndex = {};
    state.source.headers.forEach(function(h, i) {
      state.headersIndex[h] = i;
    });
  }

  async function loadSource(source) {
    try {
      if (!source) {
        console.error("[csvtable] Missing source.");
        return false;
      }

      let csvText = "";
      let sourceEl = null;
      const trimmedSource = typeof source === "string" ? source.trim() : "";
      const isRelativePath = /^\.\.?\//.test(trimmedSource);
      const isLikelySelector = /^([#\[]|\.[^./])/.test(trimmedSource);

      if (typeof source === "string" && !isRelativePath && isLikelySelector) {
        sourceEl = document.querySelector(source);
      }

      if (sourceEl && sourceEl.tagName === "SCRIPT" && sourceEl.type === "text/csv") {
        csvText = sourceEl.textContent || "";
      } else {
        const response = await fetch(source);
        if (!response.ok) {
          console.error("[csvtable] Failed to fetch CSV source:", source);
          return false;
        }
        csvText = await response.text();
      }

      state.source = parseCsv(csvText);
      buildHeaderIndex();
      return true;
    } catch (err) {
      console.error("[csvtable] Source load failed.", err);
      return false;
    }
  }

  // 4. Filter Engine
  function getRowSourceValue(sourceRow, header) {
    const idx = state.headersIndex[header];
    if (idx === undefined) return "";
    return sourceRow[idx] || "";
  }

  function staticFilterPredicate(filters) {
    return function(sourceRow) {
      for (let i = 0; i < filters.length; i += 1) {
        const filter = filters[i];
        const value = getRowSourceValue(sourceRow, filter.column);
        if (filter.operator === "eq" && value !== filter.value) return false;
        if (filter.operator === "neq" && value === filter.value) return false;
        if (filter.operator === "contains" && !String(value).toLowerCase().includes(String(filter.value).toLowerCase())) return false;
      }
      return true;
    };
  }

  function applyDynamicFilters(tableState, mappedRows) {
    const bindings = tableState.filters || [];
    if (!bindings.length) return mappedRows;

    return mappedRows.filter(function(rowObj) {
      for (let i = 0; i < bindings.length; i += 1) {
        const b = bindings[i];
        const select = document.getElementById(b.select);
        if (!select) continue;
        const selected = select.value;
        if (selected === "" || selected === "All") continue;
        if ((rowObj._source[b.column] || "") !== selected) return false;
      }
      return true;
    });
  }

  // 5. Aggregation Engine
  const AGG_FUNCS = {
    sum: function(values) {
      return values.reduce(function(a, b) { return a + (parseFloat(b) || 0); }, 0);
    },
    count: function(values) {
      return values.filter(function(v) { return v !== null && v !== ""; }).length;
    },
    mean: function(values) {
      const nums = values.map(function(v) { return parseFloat(v); }).filter(function(v) { return !isNaN(v); });
      return nums.length ? AGG_FUNCS.sum(nums) / nums.length : 0;
    },
    avg: function(values) { return AGG_FUNCS.mean(values); },
    min: function(values) {
      const nums = values.map(function(v) { return parseFloat(v); }).filter(function(v) { return !isNaN(v); });
      return nums.length ? Math.min.apply(null, nums) : 0;
    },
    max: function(values) {
      const nums = values.map(function(v) { return parseFloat(v); }).filter(function(v) { return !isNaN(v); });
      return nums.length ? Math.max.apply(null, nums) : 0;
    },
    nunique: function(values) {
      return new Set(values).size;
    },
    first: function(values) {
      return values[0] == null ? "" : values[0];
    }
  };

  function groupAndAggregate(tableState, rows) {
    if (!tableState.groupBy) return rows.map(function(r) { r._isGroup = false; return r; });

    const groupColumn = tableState.columns.find(function(c) {
      return c.key === tableState.groupBy || c.sourceHeader === tableState.groupBy;
    });
    if (!groupColumn) return rows;

    const groups = new Map();

    rows.forEach(function(row) {
      const key = row[groupColumn.key];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });

    const aggRows = [];
    groups.forEach(function(groupRows, key) {
      const out = { _source: {}, _isGroup: true };
      tableState.columns.forEach(function(col) {
        if (col.key === groupColumn.key) {
          out[col.key] = key;
          return;
        }
        const fnName = tableState.aggMap[col.sourceHeader] || tableState.aggMap[col.key] || (col.type === "number" ? "sum" : "first");
        const fn = AGG_FUNCS[fnName] || AGG_FUNCS.first;
        const values = groupRows.map(function(gr) { return gr[col.key]; });
        out[col.key] = fn(values);
      });
      aggRows.push(out);
    });

    return aggRows;
  }

  // 6. Sort Engine
  function setupSort(tableName, tableEl) {
    const ths = Array.from(tableEl.querySelectorAll("thead th.sortable"));
    if (!ths.length) return;

    ths.forEach(function(th) {
      const fullColumnIndex = Array.from(th.parentNode.children).indexOf(th);
      th.addEventListener("click", function() {
        const tState = state.tables[tableName];
        if (!tState) return;

        if (tState.sort.columnIndex !== fullColumnIndex) {
          tState.sort.columnIndex = fullColumnIndex;
          tState.sort.direction = "asc";
        } else if (tState.sort.direction === "asc") {
          tState.sort.direction = "desc";
        } else if (tState.sort.direction === "desc") {
          tState.sort.columnIndex = null;
          tState.sort.direction = null;
        } else {
          tState.sort.direction = "asc";
        }

        ths.forEach(function(header) {
          header.classList.remove("sort-asc", "sort-desc");
        });

        if (tState.sort.columnIndex !== null) {
          const active = ths.find(function(headerEl) {
            return Array.from(headerEl.parentNode.children).indexOf(headerEl) === tState.sort.columnIndex;
          });
          if (active) active.classList.add(tState.sort.direction === "asc" ? "sort-asc" : "sort-desc");
        }

        renderTable(tableName);
      });
    });
  }

  function applySort(tableState, rows) {
    if (tableState.sort.columnIndex === null || !rows.length) return rows;
    const col = tableState.columns[tableState.sort.columnIndex];
    if (!col) return rows;

    const sortType = tableState.sortTypes[tableState.sort.columnIndex] || "text";
    const dir = tableState.sort.direction === "desc" ? -1 : 1;
    const sorted = rows.slice();

    sorted.sort(function(a, b) {
      const av = a[col.key] == null ? "" : String(a[col.key]);
      const bv = b[col.key] == null ? "" : String(b[col.key]);
      if (sortType === "number") {
        return ((parseFloat(av) || 0) - (parseFloat(bv) || 0)) * dir;
      }
      return av.localeCompare(bv) * dir;
    });

    return sorted;
  }

  // 7. Formatter / Locale Engine
  function formatNumber(value, locale, decimals) {
    const num = parseFloat(value);
    if (isNaN(num)) return "";
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num);
  }

  function formatValue(tableState, col, rawValue) {
    if (col.type !== "number") return rawValue == null ? "" : String(rawValue);

    const locale = col.locale || tableState.locale || DEFAULT_LOCALE;
    const base = parseFloat(rawValue);
    if (isNaN(base)) return "";

    if (col.format && tableState.formatters[col.format]) {
      return String(tableState.formatters[col.format](base));
    }

    if (col.format === "currency") {
      return "$" + formatNumber(base, locale, 2);
    }
    if (col.format === "percent") {
      return formatNumber(base * 100, locale, col.decimals) + "%";
    }
    return formatNumber(base, locale, col.decimals);
  }

  function computeTotals(tableState, rows) {
    const totals = {};
    const rowTotals = [];

    rows.forEach(function(row) {
      let rowTotal = 0;
      tableState.columns.forEach(function(col) {
        if (col.type !== "number") return;
        const numeric = parseFloat(row[col.key]);
        const safe = isNaN(numeric) ? 0 : numeric;
        totals[col.key] = (totals[col.key] || 0) + safe;
        if (col.showRowTotal) rowTotal += safe;
      });
      rowTotals.push(rowTotal);
    });

    return { totals: totals, rowTotals: rowTotals, grandRowTotal: rowTotals.reduce(function(a, b) { return a + b; }, 0) };
  }

  // 8. DOM Renderer
  function ensureTableParts(tableEl) {
    let tbody = tableEl.querySelector("tbody");
    if (!tbody) {
      tbody = document.createElement("tbody");
      tableEl.appendChild(tbody);
    }
    let tfoot = tableEl.querySelector("tfoot");
    if (!tfoot) {
      tfoot = document.createElement("tfoot");
      tableEl.appendChild(tfoot);
    }
    return { tbody: tbody, tfoot: tfoot };
  }

  function mapRows(tableState) {
    const mapped = [];

    state.source.rows.forEach(function(sourceRow) {
      const obj = { _source: {} };

      tableState.columns.forEach(function(col) {
        const idx = state.headersIndex[col.sourceHeader];
        if (idx === undefined) {
          obj[col.key] = "";
          obj._source[col.sourceHeader] = "";
          return;
        }
        const val = sourceRow[idx] || "";
        obj[col.key] = val;
        obj._source[col.sourceHeader] = val;
      });

      Object.keys(state.headersIndex).forEach(function(header) {
        obj._source[header] = getRowSourceValue(sourceRow, header);
      });

      mapped.push(obj);
    });

    return mapped;
  }

  function renderTable(tableName) {
    try {
      const tableState = state.tables[tableName];
      if (!tableState || !tableState.el) return;

      const parts = ensureTableParts(tableState.el);
      parts.tbody.innerHTML = "";
      parts.tfoot.innerHTML = "";

      const mapped = mapRows(tableState);
      const staticFiltered = mapped.filter(tableState.staticPredicate);
      const dynamicFiltered = applyDynamicFilters(tableState, staticFiltered);

      if (tableState.hooks.onFilter) {
        tableState.hooks.onFilter({ tableName: tableName, filters: tableState.filters || [], matchCount: dynamicFiltered.length });
      }

      const grouped = groupAndAggregate(tableState, dynamicFiltered);
      const sorted = applySort(tableState, grouped);
      const totalsInfo = computeTotals(tableState, sorted);
      const frag = document.createDocumentFragment();

      if (!sorted.length) {
        const tr = document.createElement("tr");
        tr.className = "no-data-row";
        tr.setAttribute("data-row-index", "0");
        const td = document.createElement("td");
        td.colSpan = tableState.columns.length;
        td.textContent = "No data";
        tr.appendChild(td);
        frag.appendChild(tr);
      } else {
        sorted.forEach(function(row, rowIndex) {
          const tr = document.createElement("tr");
          tr.setAttribute("data-row-index", String(rowIndex));
          if (row._isGroup) tr.classList.add("group-row");

          tableState.columns.forEach(function(col) {
            const td = document.createElement("td");
            td.setAttribute("data-col", col.key);
            td.textContent = formatValue(tableState, col, row[col.key]);
            tr.appendChild(td);
          });

          frag.appendChild(tr);
        });
      }

      parts.tbody.appendChild(frag);

      if (tableState.tfoot) {
        const footFrag = document.createDocumentFragment();
        const tr = document.createElement("tr");
        tr.setAttribute("data-row-index", "0");
        tableState.columns.forEach(function(col) {
          const td = document.createElement("td");
          td.setAttribute("data-col", col.key);
          const baseValue = sorted.length ? (totalsInfo.totals[col.key] || 0) : (col.type === "number" ? 0 : "null");
          td.textContent = col.type === "number" ? formatValue(tableState, col, baseValue) : String(baseValue || "");
          tr.appendChild(td);
        });
        footFrag.appendChild(tr);
        parts.tfoot.appendChild(footFrag);
      }

      state.tableSummaries[tableName] = {
        rowCount: sorted.length,
        firstRow: sorted[0] || {},
        totals: totalsInfo.totals,
        rowTotals: totalsInfo.rowTotals,
        grandRowTotal: totalsInfo.grandRowTotal,
        columns: tableState.columns
      };

      resolveTemplateTags();

      if (tableState.hooks.onRender) {
        tableState.hooks.onRender({ tableName: tableName, rowCount: sorted.length, data: sorted });
      }
    } catch (err) {
      console.error("[csvtable] Render failed for table:", tableName, err);
    }
  }

  // 9. Template Tag Resolver
  function resolveTemplateTags() {
    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      const pattern = /\{(\w+):(\w+)\}/g;
      const nodes = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (pattern.test(node.nodeValue || "")) nodes.push(node);
        pattern.lastIndex = 0;
      }

      nodes.forEach(function(node) {
        const text = node.nodeValue || "";
        const replaced = text.replace(pattern, function(_, tableName, key) {
          const summary = state.tableSummaries[tableName];
          if (!summary) return "";

          if (key === "RowTotal") {
            const parentTr = node.parentElement && node.parentElement.closest("tr[data-row-index]");
            if (!parentTr) return "";
            const idx = parseInt(parentTr.getAttribute("data-row-index") || "-1", 10);
            const value = idx >= 0 ? (summary.rowTotals[idx] || 0) : 0;
            return String(value);
          }

          if (key.endsWith("Total")) {
            const colKey = key.slice(0, -5);
            const col = summary.columns.find(function(c) { return c.key === colKey; });
            if (!col) return "";
            const tableState = state.tables[tableName];
            return formatValue(tableState, col, summary.totals[colKey] || 0);
          }

          const col = summary.columns.find(function(c) { return c.key === key; });
          if (!col) return "";
          const tableState = state.tables[tableName];
          return formatValue(tableState, col, summary.firstRow[key] || "");
        });
        node.nodeValue = replaced;
      });
    } catch (err) {
      console.error("[csvtable] Tag resolution failed.", err);
    }
  }

  // 10. Event Wiring
  function setupFilters(runtimeConfig) {
    const filters = runtimeConfig.filters || [];
    filters.forEach(function(filterDef) {
      const tState = state.tables[filterDef.table];
      if (!tState) return;

      const selectEl = document.getElementById(filterDef.select);
      if (!selectEl) {
        console.warn("[csvtable] Select element not found:", filterDef.select);
        return;
      }

      if (!state.selectBindings[filterDef.select]) state.selectBindings[filterDef.select] = [];
      state.selectBindings[filterDef.select].push(filterDef.table);

      tState.filters.push(filterDef);

      if (filterDef.static !== true) {
        const values = new Set();
        state.source.rows.forEach(function(sourceRow) {
          const idx = state.headersIndex[filterDef.column];
          if (idx === undefined) return;
          const rowMap = { _source: {} };
          Object.keys(state.headersIndex).forEach(function(h) { rowMap._source[h] = getRowSourceValue(sourceRow, h); });
          if (!tState.staticPredicate(rowMap)) return;
          values.add(sourceRow[idx] || "");
        });

        const sortedValues = Array.from(values).sort(function(a, b) { return String(a).localeCompare(String(b)); });

        while (selectEl.firstChild) selectEl.removeChild(selectEl.firstChild);
        const allOpt = document.createElement("option");
        allOpt.value = "";
        allOpt.textContent = "All";
        selectEl.appendChild(allOpt);

        sortedValues.forEach(function(v) {
          const opt = document.createElement("option");
          opt.value = v;
          opt.textContent = v;
          selectEl.appendChild(opt);
        });
      }

      if (!selectEl.dataset.csvtableBound) {
        selectEl.addEventListener("change", function() {
          const tables = state.selectBindings[filterDef.select] || [];
          tables.forEach(function(name) {
            renderTable(name);
          });
        });
        selectEl.dataset.csvtableBound = "true";
      }
    });
  }

  // 11. Declarative HTML API scanner
  function mergeDeclarativeConfig(baseConfig) {
    const runtime = {
      source: baseConfig.source,
      tables: Object.assign({}, baseConfig.tables || {}),
      filters: (baseConfig.filters || []).slice(),
      hooks: baseConfig.hooks || {},
      formatters: baseConfig.formatters || {}
    };

    const tableEls = Array.from(document.querySelectorAll("table[data-table-name]"));
    tableEls.forEach(function(tableEl) {
      const name = tableEl.getAttribute("data-table-name");
      if (!name || runtime.tables[name]) return;
      runtime.tables[name] = {
        columns: tableEl.getAttribute("data-columns") || "",
        staticFilters: tableEl.getAttribute("data-static-filters") || "",
        groupBy: tableEl.getAttribute("data-group-by") || null,
        agg: tableEl.getAttribute("data-agg") || "",
        tfoot: tableEl.getAttribute("data-tfoot") === "true",
        locale: tableEl.getAttribute("data-locale") || DEFAULT_LOCALE
      };
    });

    const filterEls = Array.from(document.querySelectorAll("select[data-filter-table][data-filter-column]"));
    filterEls.forEach(function(selectEl) {
      const table = selectEl.getAttribute("data-filter-table");
      const column = selectEl.getAttribute("data-filter-column");
      if (!table || !column || !selectEl.id) return;
      const exists = runtime.filters.some(function(f) {
        return f.table === table && f.select === selectEl.id && f.column === column;
      });
      if (!exists) runtime.filters.push({ table: table, select: selectEl.id, column: column, static: false });
    });

    return runtime;
  }

  // 12. Init
  async function init(config) {
    try {
      const runtime = mergeDeclarativeConfig(config || {});
      const sourceOk = await loadSource(runtime.source);
      if (!sourceOk) return;

      Object.keys(runtime.tables || {}).forEach(function(tableName) {
        const def = runtime.tables[tableName] || {};
        const tableEl = document.querySelector('table[data-table-name="' + tableName + '"]');
        if (!tableEl) {
          console.warn("[csvtable] Table element not found for:", tableName);
          return;
        }

        const columns = parseColumns(def.columns || "");
        columns.forEach(function(col) {
          if (state.headersIndex[col.sourceHeader] === undefined) {
            console.warn("[csvtable] Column header not found in CSV:", col.sourceHeader);
          }
        });

        const staticFilters = parseStaticFilters(def.staticFilters || "");

        state.tables[tableName] = {
          el: tableEl,
          columns: columns,
          staticPredicate: staticFilterPredicate(staticFilters),
          aggMap: parseAgg(def.agg || ""),
          groupBy: def.groupBy || null,
          tfoot: Boolean(def.tfoot),
          locale: def.locale || DEFAULT_LOCALE,
          formatters: runtime.formatters || {},
          hooks: runtime.hooks || {},
          filters: [],
          sort: { columnIndex: null, direction: null },
          sortTypes: Array.from(tableEl.querySelectorAll("thead th")).map(function(th) {
            const t = th.getAttribute("data-sort-type") || "text";
            return t === "number" ? "number" : "text";
          })
        };

        setupSort(tableName, tableEl);
      });

      setupFilters(runtime);

      Object.keys(state.tables).forEach(function(tableName) {
        renderTable(tableName);
      });
    } catch (err) {
      console.error("[csvtable] Init failed.", err);
    }
  }

  document.addEventListener("DOMContentLoaded", function() {
    init(CONFIG);
  });
})(CSVTABLE_CONFIG);
