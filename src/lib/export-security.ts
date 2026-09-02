export const EXPORT_MAX_COLUMN_WIDTH = 60;

const SPREADSHEET_FORMULA_PREFIX = /^[\t\r\n ]*[=+\-@]/;

export function exportCellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[unserializable]";
    }
  }
  return String(value);
}

export function neutralizeSpreadsheetFormula(value: unknown): string {
  const text = exportCellText(value);
  return SPREADSHEET_FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

export function spreadsheetColumnWidth(values: unknown[], header: string): number {
  let width = Math.min(EXPORT_MAX_COLUMN_WIDTH, Math.max(8, header.length));
  for (const value of values) {
    width = Math.max(width, Math.min(EXPORT_MAX_COLUMN_WIDTH, exportCellText(value).length));
    if (width >= EXPORT_MAX_COLUMN_WIDTH) return EXPORT_MAX_COLUMN_WIDTH;
  }
  return width;
}
