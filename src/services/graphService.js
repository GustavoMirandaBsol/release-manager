// src/services/graphService.js
import { sharepointConfig } from "./authConfig";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// Row headers matching the Excel sheet
const RELEASE_FIELDS = [
  { key: "Release", header: "Release", aliases: ["Release"] },
  { key: "Proyecto", header: "Proyecto", aliases: ["Proyecto", "Proyectos"] },
  { key: "Flujo", header: "Flujo", aliases: ["Flujo", "Flujos"] },
  { key: "en Base a", header: "en Base a ", aliases: ["en Base a", "en Base a "] },
  { key: "Funcionalidades", header: "Funcionalidades", aliases: ["Funcionalidades"] },
  { key: "Pase a producción", header: "Pase a producción", aliases: ["Pase a producción"] },
  { key: "Fecha de Pase", header: "Fecha de Pase", aliases: ["Fecha de Pase"] },
  { key: "Activo", header: "Activo", aliases: ["Activo"] },
];

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const FIELD_BY_HEADER = RELEASE_FIELDS.reduce((acc, field) => {
  field.aliases.forEach((alias) => {
    acc[normalizeText(alias)] = field.key;
  });
  return acc;
}, {});

function resolveFieldKey(header) {
  return FIELD_BY_HEADER[normalizeText(header)] || null;
}

function buildUrl(path) {
  const { siteId, fileId } = sharepointConfig;
  return `${GRAPH_BASE}/sites/${siteId}/drive/items/${fileId}/workbook/worksheets('Release%20y%20funcionalidades')${path}`;
}

/**
 * Fetch all rows from the "Release y funcionalidades" sheet
 */
export async function fetchReleaseData(accessToken) {
  const url = buildUrl("/usedRange(valuesOnly=true)");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Graph API error: ${res.status} ${res.statusText}`);
  const data = await res.json();

  const rows = data.values || [];
  if (rows.length < 2) return [];

  // First row = headers, rest = data
  const headers = rows[0];
  return rows.slice(1).map((row, index) => {
    const obj = { _rowIndex: index + 2 }; // +2 because Excel is 1-indexed and row 1 is header
    headers.forEach((h, i) => {
      const fieldKey = resolveFieldKey(h);
      if (fieldKey) obj[fieldKey] = row[i] ?? "";
    });
    return obj;
  });
}

/**
 * Append a new row to the sheet
 */
export async function appendReleaseRow(accessToken, rowData) {
  // Get current used range to find next empty row
  const usedRangeUrl = buildUrl("/usedRange(valuesOnly=true)");
  const usedRes = await fetch(usedRangeUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!usedRes.ok) throw new Error(`Error fetching used range: ${usedRes.status}`);
  const usedData = await usedRes.json();
  const nextRow = (usedData.values?.length || 1) + 1;

  // Build the row values array in header order
  const values = [RELEASE_FIELDS.map((field) => rowData[field.key] ?? "")];

  // Write to the next row
  const rangeAddress = `A${nextRow}:H${nextRow}`;
  const writeUrl = buildUrl(`/range(address='${rangeAddress}')`);
  const writeRes = await fetch(writeUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });
  if (!writeRes.ok) {
    const err = await writeRes.text();
    throw new Error(`Error writing row: ${writeRes.status} - ${err}`);
  }
  return await writeRes.json();
}

/**
 * Update an existing row by row index
 */
export async function updateReleaseRow(accessToken, rowIndex, rowData) {
  const values = [RELEASE_FIELDS.map((field) => rowData[field.key] ?? "")];
  const rangeAddress = `A${rowIndex}:H${rowIndex}`;
  const writeUrl = buildUrl(`/range(address='${rangeAddress}')`);
  const res = await fetch(writeUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) throw new Error(`Error updating row: ${res.status}`);
  return await res.json();
}

/**
 * Fetch nomenclature options from the "Nomenclatura" sheet
 */
export async function fetchNomenclatura(accessToken) {
  const { siteId, fileId } = sharepointConfig;
  const url = `${GRAPH_BASE}/sites/${siteId}/drive/items/${fileId}/workbook/worksheets('Nomenclatura')/usedRange(valuesOnly=true)`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { abreviaciones: [], proyectos: [] };
  const data = await res.json();
  const rows = data.values || [];
  const abreviaciones = rows.slice(1).map((r) => r[2]).filter(Boolean);
  const flujos = rows.slice(1).map((r) => r[3]).filter(Boolean);
  const proyectos = rows.slice(1).map((r) => r[4]).filter(Boolean);
  return { abreviaciones, flujos, proyectos };
}
