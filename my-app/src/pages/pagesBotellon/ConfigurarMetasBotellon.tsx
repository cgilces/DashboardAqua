import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { BsSave, BsClipboardCheck, BsPencilSquare, BsTrash, BsXCircle, BsCheckCircle, BsPlus } from "react-icons/bs";
import { X, Calendar } from "lucide-react";
import { API_BASE_URL } from "../../config";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const LABELS: Record<string, string> = {
  tiendas_vip: "Tiendas VIP (TV)",
  tiendas:     "Tiendas (T)",
  mayorista:   "Mayorista (M)",
  rural:       "Rural (R)",
};

const FORM_VACIO = {
  codigo_ruta: "", meta_unidades: "", meta_dolares: "",
  mes: "", anio: String(new Date().getFullYear()),
};

type Meta = {
  id_meta?: number;
  codigo_ruta: string;
  seccion: string;
  meta_unidades: number;
  meta_dolares: number;
  mes: number;
  anio: number;
};

type Toast = { msg: string; tipo: "ok" | "err" } | null;

export default function ConfigurarMetasBotellon() {
  const { seccion = "" } = useParams<{ seccion: string }>();
  const seccionDB = seccion.toUpperCase();
  const titulo = LABELS[seccion.toLowerCase()] ?? seccion.toUpperCase();

  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const anios = Array.from({ length: 5 }, (_, i) => anioActual - 2 + i);

  const [form, setForm] = useState(FORM_VACIO);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState<Meta | null>(null);
  const [confirmDel, setConfirmDel] = useState<Meta | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [mesFiltro, setMesFiltro] = useState(hoy.getMonth() + 1);
  const [anioFiltro, setAnioFiltro] = useState(anioActual);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = (msg: string, tipo: "ok" | "err" = "ok") => setToast({ msg, tipo });

  const cargarMetas = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/metas-botellon/listarmetas?seccion=${seccionDB}`);
      const data = await res.json();
      const lista: Meta[] = Array.isArray(data.metas) ? data.metas : [];
      setMetas(lista.sort((a, b) =>
        a.codigo_ruta.localeCompare(b.codigo_ruta, undefined, { numeric: true, sensitivity: "base" })
      ));
    } catch { notify("Error cargando metas", "err"); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargarMetas(); }, [seccion]);

  const guardarMeta = async () => {
    if (!form.codigo_ruta || !form.mes || !form.meta_unidades || !form.meta_dolares) {
      notify("Todos los campos son obligatorios", "err"); return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/metas-botellon/guardarmeta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, seccion: seccionDB }),
      });
      const data = await res.json();
      notify(data.message || "Meta guardada");
      setForm(FORM_VACIO);
      cargarMetas();
    } catch { notify("No se pudo guardar", "err"); }
    finally { setGuardando(false); }
  };

  const confirmarEdicion = async () => {
    if (!editando) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/metas-botellon/editarmeta`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo_ruta:  editando.codigo_ruta,
          seccion:      editando.seccion,
          mes:          editando.mes,
          anio:         editando.anio,
          meta_unidades: editando.meta_unidades,
          meta_dolares:  editando.meta_dolares,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message);
      notify(data.message || "Meta actualizada");
      setEditando(null);
      cargarMetas();
    } catch (e: any) { notify(e.message || "Error al actualizar", "err"); }
  };

  const confirmarEliminar = async () => {
    if (!confirmDel) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/metas-botellon/eliminarmeta`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo_ruta: confirmDel.codigo_ruta,
          seccion:     confirmDel.seccion,
          mes:         confirmDel.mes,
          anio:        confirmDel.anio,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message);
      notify("Meta eliminada correctamente");
      setConfirmDel(null);
      cargarMetas();
    } catch (e: any) { notify(e.message || "Error al eliminar", "err"); }
  };

  const metasFiltradas = metas.filter(m => m.mes === mesFiltro && m.anio === anioFiltro);

  return (
    <div className="min-h-screen bg-[#011f18] text-white flex flex-col">

      {/* Fondo decorativo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#0db48b]/5 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#014434]/40 blur-[100px]" />
      </div>

      {/* Toast centrado horizontalmente arriba */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-sm font-semibold border backdrop-blur-sm animate-[fadeSlideDown_0.25s_ease-out]
          ${toast.tipo === "ok"
            ? "bg-emerald-900/90 border-emerald-500/40 text-emerald-200"
            : "bg-red-900/90 border-red-500/40 text-red-200"}`}>
          {toast.tipo === "ok"
            ? <BsCheckCircle className="text-emerald-400 text-base flex-shrink-0" />
            : <BsXCircle className="text-red-400 text-base flex-shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="relative z-10 border-b border-white/5 bg-[#012a20]/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg">
            <BsClipboardCheck className="text-black text-lg" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight tracking-tight">
              Metas Botellón — {titulo}
            </h1>
            <p className="text-[11px] text-emerald-400/70 leading-none">Configuración de objetivos por ruta</p>
          </div>
        </div>
        <Link to="/dashboard/botellon"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-300 hover:text-white transition-all">
          ← Volver al Dashboard
        </Link>
      </div>

      {/* Contenido centrado vertical y horizontalmente */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6 max-w-[1400px] w-full">

        {/* FORMULARIO */}
        <div className="bg-[#012a20]/80 border border-white/8 rounded-2xl p-6 shadow-xl backdrop-blur-sm h-fit">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
            <h2 className="text-base font-bold text-white">Nueva Meta — {titulo}</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-emerald-400/70 mb-1.5">
                Código de Ruta
              </label>
              <input
                placeholder="Ej: T01, TV01, M2, R3"
                value={form.codigo_ruta}
                onChange={e => setForm({ ...form, codigo_ruta: e.target.value.toUpperCase() })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-emerald-500/60 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-emerald-400/70 mb-1.5">Mes</label>
                <div className="relative">
                  <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                  <select value={form.mes} onChange={e => setForm({ ...form, mes: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm appearance-none focus:outline-none focus:border-emerald-500/60 transition-all">
                    <option value="" className="bg-[#012a20]">Seleccione…</option>
                    {MESES.map((m, i) => <option key={i} value={i + 1} className="bg-[#012a20]">{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-emerald-400/70 mb-1.5">Año</label>
                <div className="relative">
                  <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                  <select value={form.anio} onChange={e => setForm({ ...form, anio: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm appearance-none focus:outline-none focus:border-emerald-500/60 transition-all">
                    {anios.map(y => <option key={y} value={y} className="bg-[#012a20]">{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-emerald-400/70 mb-1.5">Meta Unidades</label>
                <input type="number" placeholder="0"
                  value={form.meta_unidades}
                  onChange={e => setForm({ ...form, meta_unidades: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-emerald-500/60 transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-emerald-400/70 mb-1.5">Meta USD</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                  <input type="number" placeholder="0.00"
                    value={form.meta_dolares}
                    onChange={e => setForm({ ...form, meta_dolares: e.target.value })}
                    className="w-full pl-7 pr-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-emerald-500/60 transition-all" />
                </div>
              </div>
            </div>

            <button onClick={guardarMeta} disabled={guardando}
              className="w-full mt-2 flex items-center justify-center gap-2.5 py-3 rounded-xl font-bold text-sm text-black bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 disabled:opacity-50 transition-all shadow-[0_4px_20px_rgba(13,180,139,0.35)]">
              {guardando
                ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                : <BsPlus className="text-lg" />}
              {guardando ? "Guardando…" : `Guardar Meta ${titulo}`}
            </button>
          </div>
        </div>

        {/* TABLA */}
        <div className="bg-[#012a20]/80 border border-white/8 rounded-2xl shadow-xl backdrop-blur-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Calendar size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                <select value={mesFiltro} onChange={e => setMesFiltro(Number(e.target.value))}
                  className="bg-[#021f18] border border-white/10 text-white text-xs rounded-lg pl-7 pr-2 py-1 appearance-none">
                  {MESES.map((mes, i) => <option key={i} value={i + 1}>{mes}</option>)}
                </select>
              </div>
              <div className="relative">
                <Calendar size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                <select value={anioFiltro} onChange={e => setAnioFiltro(Number(e.target.value))}
                  className="bg-[#021f18] border border-white/10 text-white text-xs rounded-lg pl-7 pr-2 py-1 appearance-none">
                  {anios.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
              <h2 className="text-base font-bold text-white">Metas Registradas</h2>
              {!loading && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold border border-emerald-500/20">
                  {metasFiltradas.length}
                </span>
              )}
            </div>
            <button onClick={cargarMetas}
              className="text-[11px] text-emerald-400/60 hover:text-emerald-400 transition flex items-center gap-1">
              ↻ Actualizar
            </button>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-emerald-400/50">
                <span className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                <span className="text-sm">Cargando metas…</span>
              </div>
            ) : metasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-white/20">
                <BsClipboardCheck className="text-4xl mb-3" />
                <p className="text-sm">No hay metas registradas para {titulo}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-emerald-400/60">Ruta</th>
                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-emerald-400/60">Unidades</th>
                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-emerald-400/60">USD</th>
                    <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-emerald-400/60">Mes</th>
                    <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-emerald-400/60">Año</th>
                    <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-emerald-400/60">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {metasFiltradas.map((m, idx) => (
                    <tr key={idx} className="group hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold text-xs tracking-wider">
                          {m.codigo_ruta}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-white/90">
                        {Number(m.meta_unidades).toLocaleString()}
                        <span className="text-white/30 text-xs ml-1">u</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-teal-300">
                        ${Number(m.meta_dolares).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-center text-white/70">{MESES[m.mes - 1]}</td>
                      <td className="px-5 py-3.5 text-center text-white/50 font-mono text-xs">{m.anio}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => setEditando({ ...m })} title="Editar"
                            className="w-8 h-8 rounded-lg bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/20 text-blue-400 hover:text-blue-300 transition-all flex items-center justify-center">
                            <BsPencilSquare className="text-xs" />
                          </button>
                          <button onClick={() => setConfirmDel(m)} title="Eliminar"
                            className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-400 hover:text-red-300 transition-all flex items-center justify-center">
                            <BsTrash className="text-xs" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* MODAL EDITAR */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#012a20] border border-white/10 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 rounded-full bg-gradient-to-b from-blue-400 to-blue-600" />
                <h3 className="text-base font-bold text-white">Editar Meta</h3>
              </div>
              <button onClick={() => setEditando(null)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition flex items-center justify-center">
                <X size={14} />
              </button>
            </div>
            <div className="flex gap-2 mb-5">
              <div className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-center">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Ruta</p>
                <p className="text-sm font-bold text-emerald-400">{editando.codigo_ruta}</p>
              </div>
              <div className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-center">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Período</p>
                <p className="text-sm font-bold text-white/80">{MESES[editando.mes - 1]} {editando.anio}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-blue-400/70 mb-1.5">Meta Unidades</label>
                <input type="number" value={editando.meta_unidades}
                  onChange={e => setEditando({ ...editando, meta_unidades: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-blue-400/70 mb-1.5">Meta USD</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                  <input type="number" value={editando.meta_dolares}
                    onChange={e => setEditando({ ...editando, meta_dolares: Number(e.target.value) })}
                    className="w-full pl-7 pr-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-all" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditando(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm font-semibold transition-all">Cancelar</button>
              <button onClick={confirmarEdicion}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-sm font-bold transition-all flex items-center justify-center gap-2">
                <BsSave className="text-xs" /> Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#012a20] border border-red-500/20 rounded-2xl shadow-2xl p-6">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                <BsTrash className="text-red-400 text-2xl" />
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">¿Eliminar esta meta?</h3>
              <p className="text-sm text-white/40">Esta acción no se puede deshacer.</p>
              <div className="mt-3 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/15 text-sm">
                <span className="font-bold text-red-300">{confirmDel.codigo_ruta}</span>
                <span className="text-white/40 mx-1.5">·</span>
                <span className="text-white/50">{MESES[confirmDel.mes - 1]} {confirmDel.anio}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm font-semibold transition-all">Cancelar</button>
              <button onClick={confirmarEliminar}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white text-sm font-bold transition-all flex items-center justify-center gap-2">
                <BsTrash className="text-xs" /> Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity:0; transform:translateY(16px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes fadeSlideDown {
          from { opacity:0; transform:translate(-50%, -16px) scale(0.97); }
          to   { opacity:1; transform:translate(-50%, 0) scale(1); }
        }
      `}</style>
    </div>
  );
}
