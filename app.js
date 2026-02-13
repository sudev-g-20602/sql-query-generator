"use strict";

const queryTypeEl = document.getElementById("queryType");
const tableNameEl = document.getElementById("tableName");
const tableStructureEl = document.getElementById("tableStructure");
const rowsInputEl = document.getElementById("rowsInput");
const outputQueryEl = document.getElementById("outputQuery");
const statusEl = document.getElementById("status");
const generateBtn = document.getElementById("generateBtn");
const sampleBtn = document.getElementById("sampleBtn");
const copyBtn = document.getElementById("copyBtn");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? "status error" : "status success";
}

function escapeSqlString(value) {
  return String(value).replace(/'/g, "''");
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, "\"\"")}"`;
}

function quoteTableName(tableName) {
  return tableName
    .split(".")
    .map((part) => quoteIdentifier(part.trim()))
    .join(".");
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
        name: column.name,
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

  return lines.map((line, index) => {
    const parts = line.split(":").map((part) => part.trim());
    if (!parts[0]) {
      throw new Error(`Missing column name in structure line ${index + 1}.`);
    }
    return {
      name: parts[0],
      type: String(parts[1] || "text").toLowerCase(),
      primaryKey: parts[2] === "pk" || parts[2] === "primary"
    };
  });
}

function parseRows(rowsText) {
  const trimmed = rowsText.trim();
  if (!trimmed) {
    throw new Error("Rows input is required.");
  }

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

  throw new Error("Rows input must be a JSON object or array of objects.");
}

function formatValue(value, column) {
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
    if (column.type.includes("jsonb")) {
      return `'${jsonText}'::jsonb`;
    }
    if (column.type.includes("json")) {
      return `'${jsonText}'::json`;
    }
    return `'${jsonText}'`;
  }

  return `'${escapeSqlString(value)}'`;
}

function getAvailableColumns(structure, row) {
  return structure.filter((column) =>
    Object.prototype.hasOwnProperty.call(row, column.name)
  );
}

function buildInsertQuery(tableName, structure, rows) {
  const table = quoteTableName(tableName);
  const allColumnNames = structure.map((column) => column.name);

  const presentNames = allColumnNames.filter((name) =>
    rows.some((row) => Object.prototype.hasOwnProperty.call(row, name))
  );

  if (!presentNames.length) {
    throw new Error("No row columns match the provided table structure.");
  }

  const columnsMap = new Map(structure.map((col) => [col.name, col]));
  const columnSql = presentNames.map(quoteIdentifier).join(", ");

  const valuesSql = rows
    .map((row) => {
      const eachValue = presentNames.map((name) => {
        const column = columnsMap.get(name);
        const value = Object.prototype.hasOwnProperty.call(row, name)
          ? row[name]
          : null;
        return formatValue(value, column);
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

  const fallback = structure.find((column) => column.name === "id");
  if (fallback && Object.prototype.hasOwnProperty.call(row, "id")) {
    return [fallback];
  }

  return [];
}

function buildUpdateQuery(tableName, structure, rows) {
  const table = quoteTableName(tableName);
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
          `${quoteIdentifier(column.name)} = ${formatValue(row[column.name], column)}`
      )
      .join(", ");

    const whereSql = keyColumns
      .map(
        (column) =>
          `${quoteIdentifier(column.name)} = ${formatValue(row[column.name], column)}`
      )
      .join(" AND ");

    return `UPDATE ${table} SET ${setSql} WHERE ${whereSql};`;
  });

  return queries.join("\n");
}

function generate() {
  try {
    const queryType = queryTypeEl.value;
    const tableName = tableNameEl.value.trim();
    if (!tableName) {
      throw new Error("Table name is required.");
    }

    const structure = parseStructure(tableStructureEl.value);
    const rows = parseRows(rowsInputEl.value);
    const query =
      queryType === "insert"
        ? buildInsertQuery(tableName, structure, rows)
        : buildUpdateQuery(tableName, structure, rows);

    outputQueryEl.value = query;
    setStatus("Query generated successfully.");
  } catch (error) {
    outputQueryEl.value = "";
    setStatus(error.message || "Failed to generate query.", true);
  }
}

function loadSample() {
  queryTypeEl.value = "insert";
  tableNameEl.value = "public.users";
  tableStructureEl.value = JSON.stringify(
    [
      { name: "id", type: "bigint", primaryKey: true },
      { name: "name", type: "text" },
      { name: "email", type: "text" },
      { name: "is_active", type: "boolean" },
      { name: "metadata", type: "jsonb" }
    ],
    null,
    2
  );
  rowsInputEl.value = JSON.stringify(
    [
      {
        id: 1001,
        name: "Sudev",
        email: "sudev@example.com",
        is_active: true,
        metadata: { source: "web", level: "gold" }
      },
      {
        id: 1002,
        name: "Rita",
        email: "rita@example.com",
        is_active: false,
        metadata: { source: "api", level: "silver" }
      }
    ],
    null,
    2
  );
  outputQueryEl.value = "";
  setStatus("Sample loaded. Click Generate query.");
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
sampleBtn.addEventListener("click", loadSample);
copyBtn.addEventListener("click", copyQuery);
