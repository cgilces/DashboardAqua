import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Map as MapIcon, Phone, MessageCircle, ChevronDown, ChevronUp, Crosshair,
} from "lucide-react";
import { API_BASE_URL } from "../../config";

// ─── Tipos ───────────────────────────────────────────────────────────────
type ClienteMapa = {
  group_key: string;
  codigo_cliente: string;
  ruc: string;
  nombre_cliente: string;
  ruta: string;
  telefono: string;
  email: string;
  ciudad: string;
  tipo_negocio: string;
  lat: number;
  lng: number;
  ultima_compra: string;
  dias_sin_compra: number;
  primera_compra: string;
  promedio_mensual: number;
  valor_en_riesgo: number;
  facturas_6m: number;
  estado: "ACTIVO" | "RIESGO" | "INACTIVO" | "PERDIDO" | "NUEVO" | "SIN_COMPRAS";
};

const ESTADOS = [
  { id: "TODOS",       label: "Todos",       color: "#3b82f6" },
  { id: "PERDIDO",     label: "Perdidos",    color: "#dc2626" },
  { id: "INACTIVO",    label: "Inactivos",   color: "#ef4444" },
  { id: "RIESGO",      label: "En riesgo",   color: "#f59e0b" },
  { id: "ACTIVO",      label: "Activos",     color: "#10b981" },
  { id: "NUEVO",       label: "Nuevos",      color: "#8b5cf6" },
  { id: "SIN_COMPRAS", label: "Sin compras", color: "#6b7280" },
];

const PRESET_PREFIJOS = [
  { id: "todos",      label: "Todas",         value: "*"   },
  { id: "autoventa",  label: "Autoventa (R)", value: "R"   },
  { id: "preventa",   label: "PVR",           value: "PVR" },
  { id: "tiendas",    label: "Tiendas (PV)",  value: "PV"  },
  { id: "domicilio",  label: "Domicilio (A)", value: "A"   },
  { id: "vip",        label: "VIP (V)",       value: "V"   },
  { id: "mayorista",  label: "Mayorista (M)", value: "M"   },
];

const COLOR_ESTADO: Record<string, string> = {
  ACTIVO:      "#10b981",
  RIESGO:      "#f59e0b",
  INACTIVO:    "#ef4444",
  PERDIDO:     "#dc2626",
  NUEVO:       "#8b5cf6",
  SIN_COMPRAS: "#6b7280",
};

const money = (n = 0) => Number(n).toLocaleString("es-EC", { style: "currency", currency: "USD" });
const fmtFecha = (s: string | null) => s ? new Date(s).toLocaleDateString("es-EC") : "-";

function normalizarTel(t: string) {
  if (!t) return "";
  const limpio = t.replace(/\D/g, "");
  if (!limpio) return "";
  if (limpio.length > 10) return limpio;
  if (limpio.startsWith("0") && limpio.length === 10) return "593" + limpio.slice(1);
  return limpio;
}

// Icono custom como divIcon (evita problemas de bundling con iconos default de Leaflet)
function crearIcono(estado: string) {
  const color = COLOR_ESTADO[estado] || "#6b7280";
  return L.divIcon({
    className: "marker-custom",
    html: `
      <div style="
        width: 18px; height: 18px;
        background: ${color};
        border: 2px solid #fff;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
      "></div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });
}

// Helper: ajusta el viewport del mapa al conjunto de puntos
function AjustarViewport({ puntos }: { puntos: ClienteMapa[] }) {
  const map = useMap();
  useEffect(() => {
    if (puntos.length === 0) return;
    const bounds = L.latLngBounds(puntos.map(p => [p.lat, p.lng] as [number, number]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [puntos, map]);
  return null;
}

// ─── Componente principal ────────────────────────────────────────────────
export default function MapaClientes() {
  const [estado, setEstado]       = useState("TODOS");
  const [prefijos, setPrefijos]   = useState("*");
  const [dias, setDias]           = useState(15);
  const [data, setData]           = useState<ClienteMapa[]>([]);
  const [conteo, setConteo]       = useState<Record<string, number>>({});
  const [cargando, setCargando]   = useState(false);
  const [expandido, setExpandido] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setCargando(true);
      try {
        const url = `${API_BASE_URL}/api/dashboard-clientes/clientes-mapa?dias=${dias}&prefijos=${encodeURIComponent(prefijos)}&estado=${estado}`;
        const res = await fetch(url, { signal: ctrl.signal });
        const json = await res.json();
        if (json.ok) {
          setData(json.data || []);
          setConteo(json.conteo || {});
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error("Error clientes-mapa:", e);
      } finally {
        setCargando(false);
      }
    })();
    return () => ctrl.abort();
  }, [estado, prefijos, dias]);

  // Centro por defecto: Quito-ish (lo ajusta AjustarViewport cuando carga data)
  const centroDefault: [number, number] = [-0.18, -78.47];

  // Para el badge de conteo en cada botón de estado
  const total = data.length;

  return (
    <div className="mb-6 bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#046C5E]/40 bg-gradient-to-r from-purple-900/20 to-transparent">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-purple-500/20 border border-purple-500/40 rounded-xl p-2 shrink-0">
            <MapIcon className="text-purple-400" size={22} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2 flex-wrap">
              Mapa Geográfico de Clientes
              {cargando && (
                <span className="text-xs text-emerald-400 inline-flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin"/>
                  cargando…
                </span>
              )}
            </h2>
            <p className="text-[11px] md:text-xs text-white/60">
              Visualización geográfica de clientes — <span className="font-semibold text-white">{total}</span> puntos en el mapa
            </p>
          </div>
        </div>
        <button
          onClick={() => setExpandido(o => !o)}
          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs flex items-center gap-1.5 text-white/70 hover:text-white transition-colors"
        >
          {expandido ? <>Ocultar <ChevronUp size={14} /></> : <>Ver <ChevronDown size={14} /></>}
        </button>
      </div>

      {expandido && (
        <div className="p-4 md:p-6 space-y-4">
          {/* Filtros */}
          <div className="flex flex-col gap-3">
            {/* Estado pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mr-1">Estado:</span>
              {ESTADOS.map(e => (
                <button key={e.id} onClick={() => setEstado(e.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                    estado === e.id
                      ? "border-white/40 text-white"
                      : "bg-[#013d32] border-[#046C5E] text-white/50 hover:text-white"
                  }`}
                  style={estado === e.id ? { backgroundColor: `${e.color}33`, borderColor: e.color } : {}}>
                  <span className="w-2 h-2 rounded-full" style={{ background: e.color }} />
                  {e.label}
                  {conteo[e.id] != null && estado !== "TODOS" && e.id !== "TODOS" && (
                    <span className="text-[10px] opacity-70">({conteo[e.id]})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Canal pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mr-1">Canal:</span>
              {PRESET_PREFIJOS.map(p => (
                <button key={p.id} onClick={() => setPrefijos(p.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    prefijos === p.value
                      ? "bg-blue-500/30 border-blue-500 text-blue-200"
                      : "bg-[#013d32] border-[#046C5E] text-white/50 hover:text-white hover:border-blue-500/40"
                  }`}>
                  {p.label}
                </button>
              ))}
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold ml-2 mr-1">Umbral:</span>
              {[15, 30, 60, 90].map(d => (
                <button key={d} onClick={() => setDias(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    dias === d
                      ? "bg-yellow-500/25 border-yellow-500/50 text-yellow-200"
                      : "bg-[#013d32] border-[#046C5E] text-white/50 hover:text-white"
                  }`}>
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Leyenda + total */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-white/60">
            <div className="flex items-center gap-3 flex-wrap">
              {ESTADOS.filter(e => e.id !== "TODOS").map(e => (
                <span key={e.id} className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }}/>
                  {e.label}
                </span>
              ))}
            </div>
            <span className="text-white/50">Click en un punto para ver detalles</span>
          </div>

          {/* Mapa */}
          <div className="rounded-xl overflow-hidden border border-[#046C5E]/40 bg-[#011f1a]" style={{ height: 520 }}>
            <MapContainer
              center={centroDefault}
              zoom={7}
              scrollWheelZoom
              className="h-full w-full"
              style={{ background: "#011f1a" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://osm.org">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <AjustarViewport puntos={data} />
              {data.map(c => (
                <Marker key={c.codigo_cliente} position={[c.lat, c.lng]} icon={crearIcono(c.estado)}>
                  <Popup minWidth={240}>
                    <PopupContenido cliente={c} />
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {data.length === 0 && !cargando && (
            <p className="text-center text-white/40 italic text-sm py-2">
              No hay clientes con coordenadas para los filtros seleccionados
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Popup ────────────────────────────────────────────────────────────────
function PopupContenido({ cliente }: { cliente: ClienteMapa }) {
  const tel = normalizarTel(cliente.telefono);
  const wapp = tel ? `https://wa.me/${tel}?text=${encodeURIComponent(`Hola ${cliente.nombre_cliente}, te contactamos de Aqua...`)}` : "";
  const call = tel ? `tel:+${tel}` : "";
  const colorEstado = COLOR_ESTADO[cliente.estado] || "#6b7280";

  return (
    <div className="text-[13px] leading-tight" style={{ minWidth: 220 }}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <strong className="text-[14px]">{cliente.nombre_cliente}</strong>
        <span style={{
          background: `${colorEstado}22`, color: colorEstado, border: `1px solid ${colorEstado}66`,
          padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
          whiteSpace: "nowrap",
        }}>{cliente.estado}</span>
      </div>
      <p style={{ color: "#666", fontSize: 11, marginBottom: 6 }}>
        {cliente.ruc || "Sin RUC"} {cliente.ciudad && `· ${cliente.ciudad}`}
      </p>
      <div style={{ fontSize: 11, lineHeight: 1.6 }}>
        <div><strong>Ruta:</strong> {cliente.ruta || "-"}</div>
        <div><strong>Tipo:</strong> {cliente.tipo_negocio}</div>
        <div><strong>Última compra:</strong> {fmtFecha(cliente.ultima_compra)} <span style={{color:"#888"}}>({cliente.dias_sin_compra}d)</span></div>
        <div><strong>Promedio/mes:</strong> {money(cliente.promedio_mensual)}</div>
        {cliente.estado !== "ACTIVO" && cliente.estado !== "NUEVO" && cliente.valor_en_riesgo > 0 && (
          <div style={{ color: "#dc2626", fontWeight: 600 }}>
            <strong>En riesgo:</strong> {money(cliente.valor_en_riesgo)}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
        {wapp && (
          <a href={wapp} target="_blank" rel="noopener noreferrer"
             style={{ background:"#16a34a", color:"#fff", padding:"4px 8px", borderRadius:4, fontSize:11, fontWeight:600, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:4 }}>
            <MessageCircle size={11}/> WhatsApp
          </a>
        )}
        {call && (
          <a href={call}
             style={{ background:"#2563eb", color:"#fff", padding:"4px 8px", borderRadius:4, fontSize:11, fontWeight:600, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:4 }}>
            <Phone size={11}/> Llamar
          </a>
        )}
        {cliente.lat && cliente.lng && (
          <a href={`https://maps.google.com/?q=${cliente.lat},${cliente.lng}`} target="_blank" rel="noopener noreferrer"
             style={{ background:"#7c3aed", color:"#fff", padding:"4px 8px", borderRadius:4, fontSize:11, fontWeight:600, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:4 }}>
            <Crosshair size={11}/> Cómo llegar
          </a>
        )}
      </div>
    </div>
  );
}
