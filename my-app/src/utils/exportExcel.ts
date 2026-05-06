import * as XLSX from "xlsx";

// Helper de export a Excel reutilizable.
// Detecta tipos numéricos y los exporta como números (no como strings),
// auto-ajusta el ancho de columnas según contenido más largo.
//
// Uso:
//   exportExcel("alertas_recuperacion", filas, "Alertas")
//   exportExcel("declive_consumo_2026-05-05", filas)
export function exportExcel(
  baseFilename: string,
  rows: Record<string, any>[],
  sheetName: string = "Datos",
): void {
  if (!rows || rows.length === 0) return;

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-ajuste de columnas
  const cols = Object.keys(rows[0] || {});
  ws["!cols"] = cols.map(col => {
    const len = Math.max(
      col.length,
      ...rows.map(r => {
        const v = r[col];
        return v == null ? 0 : String(v).length;
      })
    );
    return { wch: Math.min(50, len + 2) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  const fecha = new Date().toISOString().slice(0, 10);
  const filename = `${baseFilename}_${fecha}.xlsx`;
  XLSX.writeFile(wb, filename, { compression: true });
}
