// src/services/localExcelService.js
import * as XLSX from "xlsx";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import { getCurrentUserProfile } from "./authService";

const RELEASE_SHEET_NAME = "Release y funcionalidades";
const RELEASE_TABLE = "release_records";
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

export const isSupabaseBackendEnabled = isSupabaseConfigured;

const FALLBACK_NOMENCLATURA = {
  abreviaciones: ["CT", "FD", "FH", "TDH", "FO", "DIF", "ALL"],
  flujos: [
    "Carpeta Transversal",
    "Flujo digital",
    "Flujo híbrido",
    "Transferencia de Leads",
    "Flujo Originación",
    "Diferimiento",
    "Transversal",
  ],
  proyectos: [
    "CRM",
    "BUM",
    "BFF-PB",
    "WC-PB",
    "Reporting Services",
    "Document Library",
    "Signature",
    "CRA",
    "Web Client-Loans",
    "BFF-Loans",
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

function buildAuditFields(profile, mode = "insert") {
  if (!profile) return {};

  const fields = {
    updated_by_user_id: profile.id,
    updated_by_email: profile.email,
    updated_by_name: profile.name,
  };

  if (mode === "insert") {
    fields.created_by_user_id = profile.id;
    fields.created_by_email = profile.email;
    fields.created_by_name = profile.name;
  }

  return fields;
}

function toDatabaseRow(row, profile = null, mode = "insert") {
  const normalized = normalizeReleaseRow(row, row._rowIndex || 0);
  return {
    release: normalized.Release,
    proyecto: normalized.Proyecto,
    flujo: normalized.Flujo,
    en_base_a: normalized["en Base a"],
    funcionalidades: normalized.Funcionalidades,
    pase_a_produccion: normalized["Pase a producción"] || "NO",
    fecha_de_pase: normalized["Fecha de Pase"] || null,
    activo: normalized.Activo || "SI",
    ...buildAuditFields(profile, mode),
  };
}

function fromDatabaseRow(row, index = 0) {
  const normalized = normalizeReleaseRow(
    {
      _rowIndex: row.id || index + 2,
      Release: row.release,
      Proyecto: row.proyecto,
      Flujo: row.flujo,
      "en Base a": row.en_base_a,
      Funcionalidades: row.funcionalidades,
      "Pase a producción": row.pase_a_produccion,
      "Fecha de Pase": row.fecha_de_pase,
      Activo: row.activo,
    },
    row.id || index + 2
  );

  return {
    ...normalized,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    createdByEmail: row.created_by_email || "",
    createdByName: row.created_by_name || "",
    updatedByEmail: row.updated_by_email || "",
    updatedByName: row.updated_by_name || "",
  };
}

function ensureSupabaseReady() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase no está configurado");
  }
}

async function ensureSupabaseUser() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    throw new Error("Debes iniciar sesión con Google para usar la base compartida.");
  }
  return profile;
}

function getSupabaseErrorMessage(error, action) {
  const message = error?.message || "Error desconocido";

  if (message.includes("row-level security")) {
    return `Supabase bloqueó ${action} por políticas RLS. Ejecuta el bloque de políticas de supabase/schema.sql en el SQL Editor.`;
  }

  if (message.includes("relation") && message.includes("does not exist")) {
    return `No existe la tabla release_records en Supabase. Ejecuta supabase/schema.sql en el SQL Editor del proyecto correcto.`;
  }

  return message;
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

async function fetchReleaseDataFromSupabase() {
  ensureSupabaseReady();

  const { data, error } = await supabase
    .from(RELEASE_TABLE)
    .select("*")
    .order("id", { ascending: true });

  if (error) throw new Error(getSupabaseErrorMessage(error, "leer registros"));
  return (data || []).map(fromDatabaseRow);
}

async function replaceReleaseDataInSupabase(rows) {
  ensureSupabaseReady();
  const profile = await ensureSupabaseUser();

  const { error: deleteError } = await supabase
    .from(RELEASE_TABLE)
    .delete()
    .gt("id", 0);

  if (deleteError) throw new Error(getSupabaseErrorMessage(deleteError, "reemplazar registros"));
  if (!rows.length) return [];

  const { data, error } = await supabase
    .from(RELEASE_TABLE)
    .insert(rows.map((row) => toDatabaseRow(row, profile, "insert")))
    .select("*");

  if (error) throw new Error(getSupabaseErrorMessage(error, "importar registros"));
  return (data || []).map(fromDatabaseRow);
}

export async function checkDataBackend({ testWrite = false } = {}) {
  if (!isSupabaseConfigured) {
    return {
      ok: true,
      mode: "local",
      canRead: true,
      canWrite: false,
      message: "La app está en modo local; los datos no se comparten entre usuarios.",
    };
  }

  ensureSupabaseReady();
  await ensureSupabaseUser();

  const readResult = await supabase
    .from(RELEASE_TABLE)
    .select("id", { count: "exact", head: true });

  if (readResult.error) {
    return {
      ok: false,
      mode: "supabase",
      canRead: false,
      canWrite: false,
      message: getSupabaseErrorMessage(readResult.error, "leer registros"),
    };
  }

  if (!testWrite) {
    return {
      ok: true,
      mode: "supabase",
      canRead: true,
      canWrite: null,
      message: "Supabase responde para lectura. Usa Probar escritura para validar registros de otros usuarios.",
    };
  }

  const testRow = {
    Release: `healthcheck-${Date.now()}`,
    Proyecto: "Healthcheck",
    Flujo: "",
    "en Base a": "",
    Funcionalidades: "Prueba temporal de conexión Supabase",
    "Pase a producción": "NO",
    "Fecha de Pase": "",
    Activo: "NO",
  };
  const profile = await ensureSupabaseUser();

  const insertResult = await supabase
    .from(RELEASE_TABLE)
    .insert(toDatabaseRow(testRow, profile, "insert"))
    .select("id")
    .single();

  if (insertResult.error) {
    return {
      ok: false,
      mode: "supabase",
      canRead: true,
      canWrite: false,
      message: getSupabaseErrorMessage(insertResult.error, "crear registros"),
    };
  }

  const deleteResult = await supabase
    .from(RELEASE_TABLE)
    .delete()
    .eq("id", insertResult.data.id);

  if (deleteResult.error) {
    return {
      ok: false,
      mode: "supabase",
      canRead: true,
      canWrite: true,
      message: getSupabaseErrorMessage(deleteResult.error, "eliminar la fila temporal de prueba"),
    };
  }

  return {
    ok: true,
    mode: "supabase",
    canRead: true,
    canWrite: true,
    message: "Supabase conectado con permisos de lectura y escritura.",
  };
}

/**
 * Fetch all rows
 */
export async function fetchReleaseData() {
  if (isSupabaseConfigured) return fetchReleaseDataFromSupabase();
  return getReleaseData();
}

/**
 * Append a new row
 */
export async function appendReleaseRow(rowData) {
  if (isSupabaseConfigured) {
    ensureSupabaseReady();
    const profile = await ensureSupabaseUser();
    const { data, error } = await supabase
      .from(RELEASE_TABLE)
      .insert(toDatabaseRow(rowData, profile, "insert"))
      .select("*")
      .single();

    if (error) throw new Error(getSupabaseErrorMessage(error, "crear el registro"));
    return fromDatabaseRow(data);
  }

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
  if (isSupabaseConfigured) {
    ensureSupabaseReady();
    const profile = await ensureSupabaseUser();
    const { data, error } = await supabase
      .from(RELEASE_TABLE)
      .update({
        ...toDatabaseRow(rowData, profile, "update"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowIndex)
      .select("*")
      .single();

    if (error) throw new Error(getSupabaseErrorMessage(error, "actualizar el registro"));
    return fromDatabaseRow(data);
  }

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
  if (isSupabaseConfigured) {
    ensureSupabaseReady();
    await ensureSupabaseUser();
    const { error } = await supabase
      .from(RELEASE_TABLE)
      .delete()
      .eq("id", rowIndex);

    if (error) throw new Error(getSupabaseErrorMessage(error, "eliminar el registro"));
    return;
  }

  const data = getReleaseData();
  const filtered = data.filter((r) => r._rowIndex !== rowIndex);
  saveReleaseData(filtered);
}

/**
 * Delete all release rows
 */
export async function deleteAllReleaseRows() {
  if (isSupabaseConfigured) {
    return replaceReleaseDataInSupabase([]);
  }

  saveReleaseData([]);
  return [];
}

/**
 * Export data to Excel file
 */
export async function exportToExcel() {
  const data = await fetchReleaseData();
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
    reader.onload = async (e) => {
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
        if (isSupabaseConfigured) {
          const savedData = await replaceReleaseDataInSupabase(importedData);
          resolve(savedData);
          return;
        }

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
  const rows = isSupabaseConfigured ? await fetchReleaseDataFromSupabase() : getReleaseData();
  const dataProjects = rows.map((row) => row.Proyecto);

  return {
    abreviaciones: metadata.abreviaciones || FALLBACK_NOMENCLATURA.abreviaciones,
    flujos: metadata.flujos || FALLBACK_NOMENCLATURA.flujos,
    proyectos: unique([
      ...(metadata.proyectos || FALLBACK_NOMENCLATURA.proyectos),
      ...dataProjects,
    ]),
  };
}
