import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { createRoot, Root } from "react-dom/client";
import {
  Map as MapIcon, Phone, MessageCircle, ChevronDown, ChevronUp, Crosshair, AlertTriangle,
} from "lucide-react";
import { API_BASE_URL } from "../../config";
import { fetchAuth } from "../../utils/fetchAuth";

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

// Cache de icons por estado: solo se crea UNA vez por estado, no por marker.
// Esto evita re-parsear HTML 2000 veces.
const ICON_CACHE: Record<string, L.DivIcon> = {};
function crearIcono(estado: string) {
  if (ICON_CACHE[estado]) return ICON_CACHE[estado];
  const color = COLOR_ESTADO[estado] || "#6b7280";
  const icon = L.divIcon({
    className: "marker-custom",
    html: `<div style="width:14px;height:14px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -9],
  });
  ICON_CACHE[estado] = icon;
  return icon;
}

// Helper: ajusta el viewport del mapa al conjunto de puntos.
// Llama invalidateSize PRIMERO porque cuando el contenedor cambia de
// "colapsado" a "expandido" Leaflet conserva tamaños viejos y se ve deformado.
function AjustarViewport({ puntos }: { puntos: ClienteMapa[] }) {
  const map = useMap();
  useEffect(() => {
    // Recalcula tamaño antes de hacer cualquier cosa (arregla deformación)
    map.invalidateSize();
    if (puntos.length === 0) return;
    const bounds = L.latLngBounds(puntos.map(p => [p.lat, p.lng] as [number, number]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [puntos, map]);
  return null;
}

// Helper que observa el contenedor del mapa y refresca tamaño cuando cambia.
// Esencial cuando el panel expande/colapsa o cambia el viewport.
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    // Llamada inicial
    map.invalidateSize();
    // Observer continuo
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(container);
    // También en window resize
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [map]);
  return null;
}

// Capa de marker cluster — agrupa pins cercanos en clusters numerados.
// Usa leaflet.markercluster con chunkedLoading + addLayers bulk para soportar miles de puntos.
function CapaCluster({ puntos }: { puntos: ClienteMapa[] }) {
  const map = useMap();
  const rootsRef = useRef<Root[]>([]);

  useEffect(() => {
    const clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      // CRÍTICO para performance: carga los markers en chunks asincrónicos en lugar
      // de bloquear el thread principal.
      chunkedLoading: true,
      chunkInterval: 100,         // ms por chunk (se libera el thread entre chunks)
      chunkDelay: 30,             // ms de pausa entre chunks
      removeOutsideVisibleBounds: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        const size = count < 10 ? 32 : count < 100 ? 40 : 48;
        const color = count < 10 ? "#10b981" : count < 100 ? "#f59e0b" : "#dc2626";
        return L.divIcon({
          html: `<div style="
            width: ${size}px; height: ${size}px;
            background: ${color}cc;
            border: 3px solid #fff;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            color: #fff; font-weight: 700; font-size: ${count < 100 ? 12 : 11}px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          ">${count}</div>`,
          className: "cluster-icon",
          iconSize: [size, size],
        });
      },
    });

    // Crear todos los markers en un array (bulk) y luego agregarlos de una sola vez.
    // addLayers([]) con chunkedLoading es MUCHO más rápido que addLayer en loop.
    rootsRef.current = [];
    const markers = puntos.map(p => {
      const marker = L.marker([p.lat, p.lng], { icon: crearIcono(p.estado) });
      marker.bindPopup(() => {
        const div = document.createElement("div");
        const root = createRoot(div);
        rootsRef.current.push(root);
        root.render(<PopupContenido cliente={p} />);
        return div;
      }, { minWidth: 240 });
      return marker;
    });

    clusterGroup.addLayers(markers);
    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
      const roots = rootsRef.current;
      rootsRef.current = [];
      setTimeout(() => roots.forEach(r => { try { r.unmount(); } catch {} }), 0);
    };
  }, [puntos, map]);

  return null;
}

// ─── Componente principal ────────────────────────────────────────────────
export default function MapaClientes() {
  // Default a PERDIDO (los más críticos). Si pone TODOS, se trunca al límite.
  const [estado, setEstado]       = useState("PERDIDO");
  const [prefijos, setPrefijos]   = useState("*");
  const [dias, setDias]           = useState(15);
  const [limite, setLimite]       = useState(500);
  const [data, setData]           = useState<ClienteMapa[]>([]);
  const [conteo, setConteo]       = useState<Record<string, number>>({});
  const [totalDisponible, setTotalDisponible] = useState(0);
  const [truncado, setTruncado]   = useState(false);
  const [cargando, setCargando]   = useState(false);
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    if (!expandido) return;
    const ctrl = new AbortController();
    (async () => {
      setCargando(true);
      try {
        const url = `${API_BASE_URL}/api/dashboard-clientes/clientes-mapa?dias=${dias}&prefijos=${encodeURIComponent(prefijos)}&estado=${estado}&limite=${limite}`;
        const res = await fetchAuth(url, { signal: ctrl.signal });
        const json = await res.json();
        if (json.ok) {
          setData(json.data || []);
          setConteo(json.conteo || {});
          setTotalDisponible(json.total_disponible ?? (json.data?.length ?? 0));
          setTruncado(Boolean(json.truncado));
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error("Error clientes-mapa:", e);
      } finally {
        setCargando(false);
      }
    })();
    return () => ctrl.abort();
  }, [expandido, estado, prefijos, dias, limite]);

  // Centro por defecto: Quito-ish (lo ajusta AjustarViewport cuando carga data)
  const centroDefault: [number, number] = [-0.18, -78.47];

  // Para el badge de conteo en cada botón de estado
  const total = data.length;

  // return (
  //   <div className="mb-6 bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-2xl shadow-2xl overflow-hidden">
  //     {/* Header */}
  //     <div className="px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#046C5E]/40 bg-gradient-to-r from-purple-900/20 to-transparent">
  //       <div className="flex items-center gap-3 min-w-0">
  //         <div className="bg-purple-500/20 border border-purple-500/40 rounded-xl p-2 shrink-0">
  //           <MapIcon className="text-purple-400" size={22} />
  //         </div>
  //         <div className="min-w-0">
  //           <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2 flex-wrap">
  //             Mapa Geográfico de Clientes
  //             {cargando && (
  //               <span className="text-xs text-emerald-400 inline-flex items-center gap-1">
  //                 <span className="w-3 h-3 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin"/>
  //                 cargando…
  //               </span>
  //             )}
  //           </h2>
  //           <p className="text-[11px] md:text-xs text-white/60">
  //             Visualización geográfica de clientes — <span className="font-semibold text-white">{total}</span> puntos en el mapa
  //           </p>
  //         </div>
  //       </div>
  //       <button
  //         onClick={() => setExpandido(o => !o)}
  //         className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs flex items-center gap-1.5 text-white/70 hover:text-white transition-colors"
  //       >
  //         {expandido ? <>Ocultar <ChevronUp size={14} /></> : <>Ver <ChevronDown size={14} /></>}
  //       </button>
  //     </div>

  //     {expandido && (
  //       <div className="p-4 md:p-6 space-y-4">
  //         {/* Filtros */}
  //         <div className="flex flex-col gap-3">
  //           {/* Estado pills */}
  //           <div className="flex items-center gap-1.5 flex-wrap">
  //             <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mr-1">Estado:</span>
  //             {ESTADOS.map(e => (
  //               <button key={e.id} onClick={() => setEstado(e.id)}
  //                 className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
  //                   estado === e.id
  //                     ? "border-white/40 text-white"
  //                     : "bg-[#013d32] border-[#046C5E] text-white/50 hover:text-white"
  //                 }`}
  //                 style={estado === e.id ? { backgroundColor: `${e.color}33`, borderColor: e.color } : {}}>
  //                 <span className="w-2 h-2 rounded-full" style={{ background: e.color }} />
  //                 {e.label}
  //                 {conteo[e.id] != null && estado !== "TODOS" && e.id !== "TODOS" && (
  //                   <span className="text-[10px] opacity-70">({conteo[e.id]})</span>
  //                 )}
  //               </button>
  //             ))}
  //           </div>

  //           {/* Canal pills */}
  //           <div className="flex items-center gap-1.5 flex-wrap">
  //             <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mr-1">Canal:</span>
  //             {PRESET_PREFIJOS.map(p => (
  //               <button key={p.id} onClick={() => setPrefijos(p.value)}
  //                 className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
  //                   prefijos === p.value
  //                     ? "bg-blue-500/30 border-blue-500 text-blue-200"
  //                     : "bg-[#013d32] border-[#046C5E] text-white/50 hover:text-white hover:border-blue-500/40"
  //                 }`}>
  //                 {p.label}
  //               </button>
  //             ))}
  //             <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold ml-2 mr-1">Umbral:</span>
  //             {[15, 30, 60, 90].map(d => (
  //               <button key={d} onClick={() => setDias(d)}
  //                 className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
  //                   dias === d
  //                     ? "bg-yellow-500/25 border-yellow-500/50 text-yellow-200"
  //                     : "bg-[#013d32] border-[#046C5E] text-white/50 hover:text-white"
  //                 }`}>
  //                 {d}d
  //               </button>
  //             ))}
  //           </div>
  //         </div>

  //         {/* Leyenda + total + selector límite */}
  //         <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-white/60">
  //           <div className="flex items-center gap-3 flex-wrap">
  //             {ESTADOS.filter(e => e.id !== "TODOS").map(e => (
  //               <span key={e.id} className="inline-flex items-center gap-1">
  //                 <span className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }}/>
  //                 {e.label}
  //               </span>
  //             ))}
  //           </div>
  //           <div className="flex items-center gap-2">
  //             <label className="text-white/50">Límite:</label>
  //             <select value={limite} onChange={e => setLimite(Number(e.target.value))}
  //               className="bg-[#013d32] border border-[#046C5E] rounded px-2 py-0.5 text-[11px] text-white focus:outline-none">
  //               <option value={500}>500</option>
  //               <option value={1000}>1000</option>
  //               <option value={2000}>2000</option>
  //               <option value={5000}>5000</option>
  //             </select>
  //           </div>
  //         </div>

  //         {/* Indicador de truncado */}
  //         {truncado && !cargando && (
  //           <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-[11px] text-yellow-200/90 flex items-start gap-2">
  //             <AlertTriangle size={14} className="shrink-0 mt-0.5"/>
  //             <span>
  //               Mostrando {data.length.toLocaleString("es-EC")} de {totalDisponible.toLocaleString("es-EC")} clientes (los más críticos primero).
  //               Sube el límite o filtra por estado para ver más.
  //             </span>
  //           </div>
  //         )}

  //         {/* Mapa — preferCanvas=true mejora performance con muchos markers */}
  //         <div className="rounded-xl overflow-hidden border border-[#046C5E]/40 bg-[#011f1a]" style={{ height: 520 }}>
  //           <MapContainer
  //             center={centroDefault}
  //             zoom={7}
  //             scrollWheelZoom
  //             preferCanvas
  //             className="h-full w-full"
  //             style={{ background: "#011f1a", height: "100%", width: "100%" }}
  //           >
  //             <TileLayer
  //               attribution='&copy; <a href="https://osm.org">OpenStreetMap</a>'
  //               url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  //             />
  //             <AutoResize />
  //             <AjustarViewport puntos={data} />
  //             <CapaCluster puntos={data} />
  //           </MapContainer>
  //         </div>

  //         {data.length === 0 && !cargando && (
  //           <p className="text-center text-white/40 italic text-sm py-2">
  //             No hay clientes con coordenadas para los filtros seleccionados
  //           </p>
  //         )}
  //       </div>
  //     )}
  //   </div>
  // );
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
