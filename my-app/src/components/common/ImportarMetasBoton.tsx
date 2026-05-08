import { useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { BsUpload, BsCloudUpload, BsFileEarmarkSpreadsheet, BsCheckCircle, BsXCircle, BsDownload } from "react-icons/bs";
import { X, Star, RotateCcw } from "lucide-react";
import { API_BASE_URL } from "../../config";
import { detectarSeccion, normalizarSeccion, type Seccion } from "../../utils/detectarSeccionMetas";

interface FilaImport {
  codigo_ruta: string;
  mes: number | string;
  anio: number | string;
  meta_unidades: number;
  meta_dolares: number;
  seccion: string;
  seccion_efectiva: Seccion;
  valida: boolean;
  motivo?: string;
}

interface ResultadoImport {
  ok: boolean;
  total: number;
  creados: number;
  actualizados: number;
  errores: { fila: number; codigo_ruta: string; motivo: string }[];
}

interface Props {
  onImportComplete?: () => void;
  /** Etiqueta visible. Default: "Importar" */
  label?: string;
}

const HEADER_ALIASES: Record<string, string> = {
  CODIGO_RUTA: "codigo_ruta",
  CODIGORUTA: "codigo_ruta",
  RUTA: "codigo_ruta",
  PREVENTA: "codigo_ruta",
  MES: "mes",
  ANIO: "anio",
  ANO: "anio",
  AÑO: "anio",
  YEAR: "anio",
  META_UNIDADES: "meta_unidades",
  METAUNIDADES: "meta_unidades",
  UNIDADES: "meta_unidades",
  META_USD: "meta_dolares",
  METAUSD: "meta_dolares",
  META_DOLARES: "meta_dolares",
  USD: "meta_dolares",
  DOLARES: "meta_dolares",
  SECCION: "seccion",
  SECCIÓN: "seccion",
};

const stripDiacritics = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "");

const normalizarHeader = (h: string): string =>
  stripDiacritics(String(h || "")).trim().toUpperCase().replace(/\s+/g, "_");

const toNum = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

export default function ImportarMetasBoton({ onImportComplete, label = "Importar_Metas" }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<FilaImport[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState<string>("");
  const [subiendo, setSubiendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const reiniciar = () => {
    setFilas([]);
    setNombreArchivo("");
    setResultado(null);
    setErrorMsg("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const cerrar = () => {
    setAbierto(false);
    reiniciar();
  };

  const descargarPlantilla = () => {
    const headers = ["CODIGO_RUTA", "MES", "AÑO", "META_UNIDADES", "META_USD", "SECCION"];
    const ejemplos = [
      ["PV1", 5, 2026, 1500, 8200, ""],
      ["RUTA 113", 5, 2026, 0, 12000, ""],
      ["T2", 5, 2026, 800, 4500, ""],
      ["TV1", 5, 2026, 600, 3300, ""],
      ["M1", 5, 2026, 1200, 6800, ""],
      ["R1", 5, 2026, 900, 5100, ""],
      ["148399", 5, 2026, 200, 1100, ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...ejemplos]);
    ws["!cols"] = [{ wch: 14 }, { wch: 6 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Metas");
    XLSX.writeFile(wb, "plantilla_metas.xlsx", { compression: true });
  };

  const handleArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg("");
    setResultado(null);
    setNombreArchivo(file.name);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      if (raw.length === 0) {
        setErrorMsg("El archivo está vacío o no se pudo leer.");
        setFilas([]);
        return;
      }

      const procesadas: FilaImport[] = raw.map((rowRaw) => {
        const row: Record<string, unknown> = {};
        Object.keys(rowRaw).forEach((k) => {
          const key = HEADER_ALIASES[normalizarHeader(k)] ?? normalizarHeader(k).toLowerCase();
          row[key] = rowRaw[k];
        });

        const codigo_ruta = String(row.codigo_ruta || "").trim().toUpperCase();
        const mes = parseInt(String(row.mes), 10);
        const anio = parseInt(String(row.anio), 10);
        const meta_unidades = toNum(row.meta_unidades);
        const meta_dolares = toNum(row.meta_dolares);
        const seccionRaw = String(row.seccion || "").trim();
        const seccionExplicita = seccionRaw ? normalizarSeccion(seccionRaw) : null;
        const seccion_efectiva: Seccion = seccionExplicita ?? detectarSeccion(codigo_ruta);

        let valida = true;
        let motivo: string | undefined;
        if (!codigo_ruta) { valida = false; motivo = "CODIGO_RUTA vacío"; }
        else if (!Number.isInteger(mes) || mes < 1 || mes > 12) { valida = false; motivo = `MES inválido (${row.mes ?? ""})`; }
        else if (!Number.isInteger(anio) || anio < 2020 || anio > 2099) { valida = false; motivo = `AÑO inválido (${row.anio ?? ""})`; }
        else if (!Number.isFinite(meta_unidades) || !Number.isFinite(meta_dolares)) { valida = false; motivo = "Metas no numéricas"; }
        else if (meta_unidades <= 0 && meta_dolares <= 0) { valida = false; motivo = "Ambas metas en 0/vacío"; }
        else if (seccionRaw && !seccionExplicita) { valida = false; motivo = `SECCION inválida (${seccionRaw})`; }

        return {
          codigo_ruta,
          mes: Number.isFinite(mes) ? mes : (row.mes as any),
          anio: Number.isFinite(anio) ? anio : (row.anio as any),
          meta_unidades: Number.isFinite(meta_unidades) ? meta_unidades : 0,
          meta_dolares: Number.isFinite(meta_dolares) ? meta_dolares : 0,
          seccion: seccionRaw,
          seccion_efectiva,
          valida,
          motivo,
        };
      });

      setFilas(procesadas);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Error leyendo el archivo: ${err?.message || "desconocido"}`);
      setFilas([]);
    }
  };

  const filasValidas = useMemo(() => filas.filter((f) => f.valida), [filas]);
  const filasInvalidas = useMemo(() => filas.filter((f) => !f.valida), [filas]);

  const subir = async () => {
    if (filasValidas.length === 0) return;
    setSubiendo(true);
    setErrorMsg("");
    try {
      const items = filasValidas.map((f) => ({
        codigo_ruta: f.codigo_ruta,
        mes: f.mes,
        anio: f.anio,
        meta_unidades: f.meta_unidades,
        meta_dolares: f.meta_dolares,
        seccion: f.seccion_efectiva,
      }));
      const res = await fetch(`${API_BASE_URL}/api/metas/importar-masivo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data: ResultadoImport = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg((data as any)?.message || "Error en el servidor");
      } else {
        setResultado(data);
        onImportComplete?.();
      }
    } catch (err: any) {
      setErrorMsg(`No se pudo enviar: ${err?.message || "error de red"}`);
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        title="Importar metas desde Excel"
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-400/60 bg-amber-400/15 text-amber-100 font-semibold hover:bg-amber-400/25 active:scale-[0.98] transition-all"
      >
        <BsUpload size={16} />
        <span>{label}</span>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-5xl max-h-[92vh] bg-[#012a20] border border-white/10 rounded-2xl shadow-2xl flex flex-col">

            {/* HEADER */}
            <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                  <BsCloudUpload className="text-black text-lg" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Importación masiva de metas</h2>
                  <p className="text-[11px] text-amber-300/70">Sube un Excel con todas las metas de todas las tablas</p>
                </div>
              </div>
              <button
                onClick={cerrar}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            {/* BODY */}
            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">

              {/* Paso 1: Plantilla + Archivo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400/70 mb-2">1. Plantilla</p>
                  <p className="text-xs text-white/50 mb-3">
                    Columnas: <code className="text-emerald-300">CODIGO_RUTA · MES · AÑO · META_UNIDADES · META_USD · SECCION (opcional)</code>
                  </p>
                  <button
                    onClick={descargarPlantilla}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-sm font-semibold hover:bg-emerald-500/20 transition-all"
                  >
                    <BsDownload size={14} /> Descargar plantilla
                  </button>
                </div>

                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/70 mb-2">2. Selecciona archivo</p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleArchivo}
                    className="block w-full text-xs text-white/70 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-400/20 file:text-amber-200 hover:file:bg-amber-400/30 cursor-pointer"
                  />
                  {nombreArchivo && (
                    <p className="mt-2 text-[11px] text-white/50 flex items-center gap-1.5">
                      <BsFileEarmarkSpreadsheet className="text-emerald-400" /> {nombreArchivo}
                    </p>
                  )}
                </div>
              </div>

              {/* Error de lectura */}
              {errorMsg && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start gap-2">
                  <BsXCircle className="text-red-400 mt-0.5 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Resumen + previsualización */}
              {filas.length > 0 && !resultado && (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs font-bold">
                      {filasValidas.length} válidas
                    </span>
                    {filasInvalidas.length > 0 && (
                      <span className="px-3 py-1 rounded-full bg-red-500/15 border border-red-500/25 text-red-300 text-xs font-bold">
                        {filasInvalidas.length} con error
                      </span>
                    )}
                    <span className="text-[11px] text-white/40">
                      Las filas válidas se enviarán al servidor; las inválidas se omiten.
                    </span>
                  </div>

                  <div className="rounded-xl border border-white/10 overflow-hidden max-h-[40vh] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[#014434] text-emerald-300 uppercase text-[10px] sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">Ruta</th>
                          <th className="px-3 py-2 text-center">Mes</th>
                          <th className="px-3 py-2 text-center">Año</th>
                          <th className="px-3 py-2 text-right">Unidades</th>
                          <th className="px-3 py-2 text-right">USD</th>
                          <th className="px-3 py-2 text-center">Sección</th>
                          <th className="px-3 py-2 text-left">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filas.map((f, i) => (
                          <tr key={i} className={f.valida ? "hover:bg-white/[0.03]" : "bg-red-900/10"}>
                            <td className="px-3 py-2 text-white/40 font-mono">{i + 2}</td>
                            <td className="px-3 py-2 font-bold text-emerald-200">{f.codigo_ruta}</td>
                            <td className="px-3 py-2 text-center text-white/70">{f.mes}</td>
                            <td className="px-3 py-2 text-center text-white/70">{f.anio}</td>
                            <td className="px-3 py-2 text-right text-white/80">{Number(f.meta_unidades).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-teal-200">${Number(f.meta_dolares).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                f.seccion ? "bg-blue-500/20 text-blue-200 border border-blue-500/30" : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                              }`}>
                                {f.seccion_efectiva}
                                {f.seccion && <Star size={10} className="fill-blue-200 text-blue-200" />}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {f.valida
                                ? <span className="text-emerald-400 flex items-center gap-1"><BsCheckCircle className="text-[11px]" /> OK</span>
                                : <span className="text-red-300 text-[11px]">{f.motivo}</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="mt-2 text-[10px] text-white/30 flex items-center gap-1">
                    <Star size={10} className="fill-blue-200 text-blue-200" />
                    = sección forzada por columna SECCION del Excel.
                  </p>
                </div>
              )}

              {/* Resultado del servidor */}
              {resultado && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BsCheckCircle className="text-emerald-300 text-xl" />
                    <h3 className="text-base font-bold text-white">Importación finalizada</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-lg bg-white/5 border border-white/8 px-3 py-2 text-center">
                      <p className="text-[10px] text-white/40 uppercase">Total</p>
                      <p className="text-xl font-bold text-white">{resultado.total}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/25 px-3 py-2 text-center">
                      <p className="text-[10px] text-emerald-300 uppercase">Creados</p>
                      <p className="text-xl font-bold text-emerald-200">{resultado.creados}</p>
                    </div>
                    <div className="rounded-lg bg-blue-500/15 border border-blue-500/25 px-3 py-2 text-center">
                      <p className="text-[10px] text-blue-300 uppercase">Actualizados</p>
                      <p className="text-xl font-bold text-blue-200">{resultado.actualizados}</p>
                    </div>
                  </div>
                  {resultado.errores.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-red-300 mb-2">Errores ({resultado.errores.length}):</p>
                      <div className="max-h-40 overflow-y-auto rounded-lg border border-red-500/20 bg-red-900/10 p-2 space-y-1">
                        {resultado.errores.map((e, i) => (
                          <p key={i} className="text-[11px] text-red-200 font-mono">
                            Fila {e.fila} · <span className="text-red-100 font-bold">{e.codigo_ruta || "(vacío)"}</span> — {e.motivo}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="px-6 py-4 border-t border-white/8 flex items-center justify-between flex-shrink-0">
              <button
                onClick={reiniciar}
                disabled={filas.length === 0 && !resultado}
                className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <RotateCcw size={12} />
                Limpiar
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={cerrar}
                  className="px-4 py-2 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20 text-sm font-semibold transition-all"
                >
                  {resultado ? "Cerrar" : "Cancelar"}
                </button>
                {!resultado && (
                  <button
                    onClick={subir}
                    disabled={filasValidas.length === 0 || subiendo}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm text-black bg-gradient-to-r from-amber-300 to-orange-400 hover:from-amber-200 hover:to-orange-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_4px_18px_rgba(251,191,36,0.35)]"
                  >
                    {subiendo
                      ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      : <BsCloudUpload className="text-base" />}
                    {subiendo ? "Subiendo…" : `Subir ${filasValidas.length} fila${filasValidas.length === 1 ? "" : "s"}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
