"use strict";

const queryTypeEl = document.getElementById("queryType");
const dialectTypeEl = document.getElementById("dialectType");
const tableNameEl = document.getElementById("tableName");
const tableStructureEl = document.getElementById("tableStructure");
const tableStructureSuggestionsEl = document.getElementById("tableStructureSuggestions");
const rowsInputEl = document.getElementById("rowsInput");
const outputQueryEl = document.getElementById("outputQuery");
const statusEl = document.getElementById("status");
const tableNameHistoryEl = document.getElementById("tableNameHistory");
const generateBtn = document.getElementById("generateBtn");
const copyBtn = document.getElementById("copyBtn");
const TABLE_NAME_HISTORY_KEY = "sqlGenerator.tableNameHistory";
const TABLE_STRUCTURE_HISTORY_KEY = "sqlGenerator.tableStructureHistory";
const MAX_TABLE_NAME_HISTORY = 10;
const MAX_TABLE_STRUCTURE_HISTORY = 10;
const MAX_TABLE_STRUCTURE_SUGGESTIONS = 5;
const MAX_TABLE_STRUCTURE_LABEL_LENGTH = 50;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? "status error" : "status success";
}

function escapeSqlString(value) {
  return String(value).replace(/'/g, "''");
}

function normalizeIdentifier(identifier) {
  const trimmed = String(identifier).trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("`") && trimmed.endsWith("`"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function formatIdentifier(identifier) {
  return normalizeIdentifier(identifier);
}

function quoteTableName(tableName) {
  return tableName
    .split(".")
    .map((part) => formatIdentifier(part.trim()))
    .join(".");
}

function readTableNameHistory() {
  try {
    const raw = localStorage.getItem(TABLE_NAME_HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .slice(0, MAX_TABLE_NAME_HISTORY);
  } catch (_error) {
    return [];
  }
}

function writeTableNameHistory(history) {
  try {
    localStorage.setItem(
      TABLE_NAME_HISTORY_KEY,
      JSON.stringify(history.slice(0, MAX_TABLE_NAME_HISTORY))
    );
  } catch (_error) {
    // Ignore storage write errors (e.g. private mode restrictions).
  }
}

function renderTableNameHistory(history) {
  if (!tableNameHistoryEl) {
    return;
  }
  tableNameHistoryEl.innerHTML = "";
  history.forEach((tableName) => {
    const option = document.createElement("option");
    option.value = tableName;
    tableNameHistoryEl.appendChild(option);
  });
}

function rememberTableName(tableName) {
  const normalized = tableName.trim();
  if (!normalized) {
    return;
  }

  const current = readTableNameHistory();
  const deduped = [normalized, ...current.filter((item) => item !== normalized)];
  writeTableNameHistory(deduped);
  renderTableNameHistory(deduped);
}

function initializeRememberedTableName() {
  const history = readTableNameHistory();
  renderTableNameHistory(history);
}

function readTableStructureHistory() {
  try {
    const raw = localStorage.getItem(TABLE_STRUCTURE_HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .slice(0, MAX_TABLE_STRUCTURE_HISTORY);
  } catch (_error) {
    return [];
  }
}

function writeTableStructureHistory(history) {
  try {
    localStorage.setItem(
      TABLE_STRUCTURE_HISTORY_KEY,
      JSON.stringify(history.slice(0, MAX_TABLE_STRUCTURE_HISTORY))
    );
  } catch (_error) {
    // Ignore storage write errors (e.g. private mode restrictions).
  }
}

function truncateSuggestionLabel(value) {
  if (value.length <= MAX_TABLE_STRUCTURE_LABEL_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_TABLE_STRUCTURE_LABEL_LENGTH)}...`;
}

function renderTableStructureHistory(history) {
  if (!tableStructureSuggestionsEl) {
    return;
  }
  tableStructureSuggestionsEl.innerHTML = "";
  if (!history.length) {
    return;
  }
  history.slice(0, MAX_TABLE_STRUCTURE_SUGGESTIONS).forEach((structure) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-chip";
    button.textContent = truncateSuggestionLabel(structure);
    button.title = structure;
    button.dataset.value = structure;
    tableStructureSuggestionsEl.appendChild(button);
  });
}

function rememberTableStructure(tableStructureText) {
  const normalized = tableStructureText.trim();
  if (!normalized) {
    return;
  }
  const current = readTableStructureHistory();
  const deduped = [normalized, ...current.filter((item) => item !== normalized)];
  writeTableStructureHistory(deduped);
  renderTableStructureHistory(deduped);
}

function initializeRememberedTableStructure() {
  const history = readTableStructureHistory();
  renderTableStructureHistory(history);
}

function applySelectedTableStructure(event) {
  if (!tableStructureSuggestionsEl) {
    return;
  }
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const selected = target.dataset.value;
  if (!selected) {
    return;
  }
  tableStructureEl.value = selected;
}

function parseStructure(structureText) {
  const trimmed = structureText.trim();
  if (!trimmed) {
    throw new Error("Table structure is required.");
  }

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Table structure JSON must be a non-empty array.");
    }

    return parsed.map((column, index) => {
      if (!column || typeof column !== "object" || !column.name) {
        throw new Error(`Invalid column at index ${index} in table structure.`);
      }
      return {
        name: normalizeIdentifier(column.name),
        type: String(column.type || "text").toLowerCase(),
        primaryKey: Boolean(column.primaryKey || column.pk || column.isPrimaryKey)
      };
    });
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("Table structure line format must not be empty.");
  }

  const hasTypeHints = lines.some((line) => line.includes(":"));
  if (!hasTypeHints) {
    const columnNames = trimmed.split(/[\s,]+/).map((name) => name.trim()).filter(Boolean);
    if (!columnNames.length) {
      throw new Error("Table structure must include at least one column name.");
    }
    return columnNames.map((name) => ({
      name: normalizeIdentifier(name),
      type: "text",
      primaryKey: false
    }));
  }

  return lines.map((line, index) => {
    const parts = line.split(":").map((part) => part.trim());
    if (!parts[0]) {
      throw new Error(`Missing column name in structure line ${index + 1}.`);
    }
    return {
      name: normalizeIdentifier(parts[0]),
      type: String(parts[1] || "text").toLowerCase(),
      primaryKey: parts[2] === "pk" || parts[2] === "primary"
    };
  });
}

function isNumericType(columnType) {
  return /(int|serial|numeric|decimal|real|double|float|money)/.test(columnType);
}

function parsePlainRowValue(rawValue) {
  const value = rawValue.trim();
  if (/^null$/i.test(value)) {
    return null;
  }
  if (/^true$/i.test(value)) {
    return true;
  }
  if (/^false$/i.test(value)) {
    return false;
  }
  return value;
}

function mapValuesToRow(values, structure) {
  return structure.reduce((row, column, index) => {
    row[column.name] = parsePlainRowValue(values[index] || "");
    return row;
  }, {});
}

function parseRows(rowsText, structure) {
  const trimmed = rowsText.trim();
  if (!trimmed) {
    throw new Error("Rows input is required.");
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      if (!parsed.length) {
        throw new Error("Rows array must contain at least one object.");
      }
      return parsed;
    }

    if (typeof parsed === "object" && parsed !== null) {
      return [parsed];
    }
  } catch (_error) {
    // Fall back to newline-delimited JSON objects.
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim());

  const nonEmptyLines = lines.filter(Boolean);
  if (!nonEmptyLines.length) {
    throw new Error("Rows input is required.");
  }

  const groupedByBlankLine = [];
  let currentGroup = [];
  lines.forEach((line) => {
    if (!line) {
      if (currentGroup.length) {
        groupedByBlankLine.push(currentGroup);
        currentGroup = [];
      }
      return;
    }
    currentGroup.push(line);
  });
  if (currentGroup.length) {
    groupedByBlankLine.push(currentGroup);
  }

  if (
    groupedByBlankLine.length > 1 &&
    groupedByBlankLine.every((group) => group.length === structure.length)
  ) {
    return groupedByBlankLine.map((group) => mapValuesToRow(group, structure));
  }

  const tabRows = nonEmptyLines.map((line) => line.split("\t").map((part) => part.trim()));
  if (
    tabRows.every((parts) => parts.length === structure.length)
  ) {
    return tabRows.map((parts) => mapValuesToRow(parts, structure));
  }

  if (nonEmptyLines.length % structure.length !== 0) {
    throw new Error(
      `Rows input does not align with table structure. Expected values in multiples of ${structure.length}.`
    );
  }

  const rows = [];
  for (let i = 0; i < nonEmptyLines.length; i += structure.length) {
    const chunk = nonEmptyLines.slice(i, i + structure.length);
    if (chunk.length !== structure.length) {
      throw new Error("Invalid rows input.");
    }
    rows.push(mapValuesToRow(chunk, structure));
  }

  return rows;
}

function formatValue(value, column, dialect) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid numeric value for column "${column.name}".`);
    }
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (typeof value === "object") {
    const jsonText = escapeSqlString(JSON.stringify(value));
    if (dialect === "postgresql" && column.type.includes("jsonb")) {
      return `'${jsonText}'::jsonb`;
    }
    if (dialect === "postgresql" && column.type.includes("json")) {
      return `'${jsonText}'::json`;
    }
    return `'${jsonText}'`;
  }

  if (typeof value === "string" && isNumericType(column.type)) {
    const numericText = value.trim();
    if (/^-?\d+(\.\d+)?$/.test(numericText)) {
      return numericText;
    }
  }

  return `'${escapeSqlString(value)}'`;
}

function getAvailableColumns(structure, row) {
  return structure.filter((column) =>
    Object.prototype.hasOwnProperty.call(row, column.name)
  );
}

function buildInsertQuery(tableName, structure, rows, dialect) {
  const table = quoteTableName(tableName);
  const allColumnNames = structure.map((column) => column.name);

  const presentNames = allColumnNames.filter((name) =>
    rows.some((row) => Object.prototype.hasOwnProperty.call(row, name))
  );

  if (!presentNames.length) {
    throw new Error("No row columns match the provided table structure.");
  }

  const columnsMap = new Map(structure.map((col) => [col.name, col]));
  const columnSql = presentNames
    .map((name) => formatIdentifier(name))
    .join(", ");

  const valuesSql = rows
    .map((row) => {
      const eachValue = presentNames.map((name) => {
        const column = columnsMap.get(name);
        const value = Object.prototype.hasOwnProperty.call(row, name)
          ? row[name]
          : null;
        return formatValue(value, column, dialect);
      });
      return `(${eachValue.join(", ")})`;
    })
    .join(",\n");

  return `INSERT INTO ${table} (${columnSql}) VALUES\n${valuesSql};`;
}

function pickKeyColumns(structure, row) {
  const keyColumns = structure.filter((column) => column.primaryKey);
  if (keyColumns.length > 0) {
    return keyColumns.filter((column) =>
      Object.prototype.hasOwnProperty.call(row, column.name)
    );
  }

  const idNamedColumn = structure.find(
    (column) =>
      column.name.trim().toLowerCase() === "id" &&
      Object.prototype.hasOwnProperty.call(row, column.name)
  );
  if (idNamedColumn) {
    return [idNamedColumn];
  }

  const idLikeColumn = structure.find(
    (column) =>
      /id$/i.test(column.name.trim()) &&
      Object.prototype.hasOwnProperty.call(row, column.name)
  );
  if (idLikeColumn) {
    return [idLikeColumn];
  }

  const firstAvailableColumn = structure.find((column) =>
    Object.prototype.hasOwnProperty.call(row, column.name)
  );
  if (firstAvailableColumn) {
    return [firstAvailableColumn];
  }

  return [];
}

function buildUpdateQuery(tableName, structure, rows, dialect) {
  const table = quoteTableName(tableName, dialect);
  const queries = rows.map((row, index) => {
    const availableColumns = getAvailableColumns(structure, row);
    if (!availableColumns.length) {
      throw new Error(`Row ${index + 1}: no columns from table structure found.`);
    }

    const keyColumns = pickKeyColumns(structure, row);
    if (!keyColumns.length) {
      throw new Error(
        `Row ${index + 1}: missing key column. Add primaryKey in structure or include "id".`
      );
    }

    const keyNames = new Set(keyColumns.map((column) => column.name));
    const setColumns = availableColumns.filter((column) => !keyNames.has(column.name));
    if (!setColumns.length) {
      throw new Error(`Row ${index + 1}: no updatable column found besides key column.`);
    }

    const setSql = setColumns
      .map(
        (column) =>
          `${formatIdentifier(column.name, dialect)} = ${formatValue(row[column.name], column, dialect)}`
      )
      .join(", ");

    const whereSql = keyColumns
      .map(
        (column) =>
          `${formatIdentifier(column.name, dialect)} = ${formatValue(row[column.name], column, dialect)}`
      )
      .join(" AND ");

    return `UPDATE ${table} SET ${setSql} WHERE ${whereSql};`;
  });

  return queries.join("\n");
}

function generate() {
  try {
    const queryType = queryTypeEl && queryTypeEl.value === "update" ? "update" : "insert";
    const dialect = dialectTypeEl && dialectTypeEl.value === "mysql" ? "mysql" : "postgresql";
    const tableName = tableNameEl.value.trim();
    if (!tableName) {
      throw new Error("Table name is required.");
    }

    const structure = parseStructure(tableStructureEl.value);
    const rows = parseRows(rowsInputEl.value, structure);
    const query =
      queryType === "update"
        ? buildUpdateQuery(tableName, structure, rows, dialect)
        : buildInsertQuery(tableName, structure, rows, dialect);

    outputQueryEl.value = query;
    rememberTableName(tableName);
    rememberTableStructure(tableStructureEl.value);
    setStatus("Query generated successfully.");
  } catch (error) {
    outputQueryEl.value = "";
    setStatus(error.message || "Failed to generate query.", true);
  }
}

async function copyQuery() {
  const query = outputQueryEl.value.trim();
  if (!query) {
    setStatus("Generate a query before copying.", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(query);
    setStatus("Query copied to clipboard.");
  } catch (error) {
    setStatus("Clipboard permission denied. Copy manually from output box.", true);
  }
}

generateBtn.addEventListener("click", generate);
copyBtn.addEventListener("click", copyQuery);
if (tableStructureSuggestionsEl) {
  tableStructureSuggestionsEl.addEventListener("click", applySelectedTableStructure);
}
initializeRememberedTableName();
initializeRememberedTableStructure();
