// src/services/localExcelService.js
import * as XLSX from "xlsx";

const RELEASE_SHEET_NAME = "Release y funcionalidades";
const STORAGE_KEY = "releaseManagerData";
const META_STORAGE_KEY = "releaseManagerMeta";
const FILENAME = "Release_y_funcionalidades.xlsx";

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

const FIELD_KEYS = RELEASE_FIELDS.map((field) => field.key);
const EXPORT_HEADERS = RELEASE_FIELDS.map((field) => field.header);

const FALLBACK_NOMENCLATURA = {
  abreviaciones: ["CT", "FD", "FH", "TDH", "FO", "DIF", "ALL"],
  flujos: [
    "Carpeta Transversal",
    "Flujo digital",
    "Flujo hibrido",
    "Transferencia de Leads",
    "Flujo Originación",
    "Diferimiento",
    "Tranversal",
  ],
  proyectos: [
    "Crm",
    "doc library",
    "CRA",
    "Web Client-Loans",
    "BFF -loans",
    "BUM",
  ],
};

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function cleanCell(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function unique(values) {
  const seen = new Set();
  return values
    .map(cleanCell)
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeText(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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

function excelSerialToDate(value) {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) return "";
  const month = String(parsed.m).padStart(2, "0");
  const day = String(parsed.d).padStart(2, "0");
  return `${parsed.y}-${month}-${day}`;
}

function normalizeDateValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return excelSerialToDate(value);

  const text = cleanCell(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const dateParts = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!dateParts) return text;

  const [, dayPart, monthPart, yearPart] = dateParts;
  const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
  const month = monthPart.padStart(2, "0");
  const day = dayPart.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getValueByAliases(row, field) {
  for (const alias of field.aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) return row[alias];
  }
  return "";
}

function normalizeReleaseRow(row, fallbackRowIndex) {
  const normalized = {
    _rowIndex: Number(row._rowIndex) || fallbackRowIndex,
  };

  RELEASE_FIELDS.forEach((field) => {
    const value = getValueByAliases(row, field);
    normalized[field.key] = field.key === "Fecha de Pase"
      ? normalizeDateValue(value)
      : cleanCell(value);
  });

  return normalized;
}

function findHeaderRow(rows) {
  return rows.findIndex((row) => {
    const fields = row.map(resolveFieldKey).filter(Boolean);
    return fields.includes("Release") && fields.includes("Funcionalidades");
  });
}

function getReleaseSheet(workbook) {
  const exactSheet = workbook.Sheets[RELEASE_SHEET_NAME];
  if (exactSheet) return exactSheet;

  const targetName = normalizeText(RELEASE_SHEET_NAME);
  const matchingName = workbook.SheetNames.find((name) => normalizeText(name) === targetName);
  if (matchingName) return workbook.Sheets[matchingName];

  return workbook.Sheets[workbook.SheetNames[0]];
}

function parseNomenclatura(workbook) {
  const sheet = workbook.Sheets.Nomenclatura;
  if (!sheet) return FALLBACK_NOMENCLATURA;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!rows.length) return FALLBACK_NOMENCLATURA;

  const headers = rows[0].map(normalizeText);
  const abbreviationIndex = headers.findIndex((header) => header === "abreviacion");
  const flowIndex = headers.findIndex((header) => header === "flujo");
  const projectIndex = headers.findIndex((header) => header.includes("proyecto"));

  return {
    abreviaciones: unique([
      ...FALLBACK_NOMENCLATURA.abreviaciones,
      ...rows.slice(1).map((row) => row[abbreviationIndex]),
    ]),
    flujos: unique([
      ...FALLBACK_NOMENCLATURA.flujos,
      ...rows.slice(1).map((row) => row[flowIndex]),
    ]),
    proyectos: unique([
      ...FALLBACK_NOMENCLATURA.proyectos,
      ...rows.slice(1).map((row) => row[projectIndex]),
    ]),
  };
}

function getStoredMetadata() {
  try {
    const stored = localStorage.getItem(META_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (err) {
    console.error("Error loading metadata:", err);
  }
  return FALLBACK_NOMENCLATURA;
}

function saveMetadata(metadata) {
  localStorage.setItem(META_STORAGE_KEY, JSON.stringify(metadata));
}

/**
 * Get all release data from localStorage or Excel file
 */
export function getReleaseData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored).map((row, index) => normalizeReleaseRow(row, index + 2));
    }
  } catch (err) {
    console.error("Error loading data:", err);
  }
  return [];
}

/**
 * Save release data to localStorage
 */
function saveReleaseData(data) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(data.map((row, index) => normalizeReleaseRow(row, row._rowIndex || index + 2)))
  );
}

/**
 * Fetch all rows
 */
export async function fetchReleaseData() {
  return getReleaseData();
}

/**
 * Append a new row
 */
export async function appendReleaseRow(rowData) {
  const data = getReleaseData();
  const maxRowIndex = data.reduce((max, row) => Math.max(max, Number(row._rowIndex) || 1), 1);
  const newRow = {
    ...rowData,
    _rowIndex: maxRowIndex + 1,
  };
  const normalizedRow = normalizeReleaseRow(newRow, maxRowIndex + 1);
  data.push(normalizedRow);
  saveReleaseData(data);
  return normalizedRow;
}

/**
 * Update an existing row
 */
export async function updateReleaseRow(rowIndex, rowData) {
  const data = getReleaseData();
  const index = data.findIndex((r) => r._rowIndex === rowIndex);
  if (index === -1) throw new Error("Row not found");
  data[index] = normalizeReleaseRow({ ...data[index], ...rowData, _rowIndex: rowIndex }, rowIndex);
  saveReleaseData(data);
  return data[index];
}

/**
 * Delete a row
 */
export async function deleteReleaseRow(rowIndex) {
  const data = getReleaseData();
  const filtered = data.filter((r) => r._rowIndex !== rowIndex);
  saveReleaseData(filtered);
}

/**
 * Delete all release rows
 */
export async function deleteAllReleaseRows() {
  saveReleaseData([]);
  return [];
}

/**
 * Export data to Excel file
 */
export function exportToExcel() {
  const data = getReleaseData();
  const wsData = [
    EXPORT_HEADERS,
    ...data.map((row) => FIELD_KEYS.map((key) => row[key] || "")),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, RELEASE_SHEET_NAME);
  XLSX.writeFile(wb, FILENAME);
}

/**
 * Import data from Excel file
 */
export function importFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        if (workbook.SheetNames.length === 0) throw new Error("No sheets found in the workbook");

        const sheet = getReleaseSheet(workbook);

        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        const headerRowIndex = findHeaderRow(rows);
        if (headerRowIndex === -1) {
          throw new Error(`No se encontraron encabezados válidos en la hoja "${RELEASE_SHEET_NAME}"`);
        }

        const headers = rows[headerRowIndex];
        const fieldByColumn = headers.map(resolveFieldKey);
        const importedData = [];

        rows.slice(headerRowIndex + 1).forEach((row, index) => {
          const hasData = row.some((value) => cleanCell(value));
          if (!hasData) return;

          const obj = { _rowIndex: headerRowIndex + index + 2 };
          fieldByColumn.forEach((fieldKey, columnIndex) => {
            if (fieldKey) obj[fieldKey] = row[columnIndex] ?? "";
          });
          importedData.push(normalizeReleaseRow(obj, obj._rowIndex));
        });

        saveMetadata(parseNomenclatura(workbook));
        saveReleaseData(importedData);
        resolve(importedData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Error reading file"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Fetch nomenclatura (empty for local mode)
 */
export async function fetchNomenclatura() {
  const metadata = getStoredMetadata();
  const dataProjects = getReleaseData().map((row) => row.Proyecto);

  return {
    abreviaciones: metadata.abreviaciones || FALLBACK_NOMENCLATURA.abreviaciones,
    flujos: metadata.flujos || FALLBACK_NOMENCLATURA.flujos,
    proyectos: unique([
      ...(metadata.proyectos || FALLBACK_NOMENCLATURA.proyectos),
      ...dataProjects,
    ]),
  };
}
