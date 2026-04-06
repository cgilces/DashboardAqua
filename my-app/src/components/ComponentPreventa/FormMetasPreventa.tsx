import React, { useState } from "react";
import { BsSave } from "react-icons/bs";


const rutas = [
  "PV1", "PV2", "PV3", "PV4", "PV5", "PV6", "PV8", "PV9", "PV10", "PV11", "PV12", "PV13", "PV14",
  "TELEVENTA 1", "TELEVENTA 4", "PREVENTA VIP 1"
];

const meses = [
  { id: 1, nombre: "Enero" },
  { id: 2, nombre: "Febrero" },
  { id: 3, nombre: "Marzo" },
  { id: 4, nombre: "Abril" },
  { id: 5, nombre: "Mayo" },
  { id: 6, nombre: "Junio" },
  { id: 7, nombre: "Julio" },
  { id: 8, nombre: "Agosto" },
  { id: 9, nombre: "Septiembre" },
  { id: 10, nombre: "Octubre" },
  { id: 11, nombre: "Noviembre" },
  { id: 12, nombre: "Diciembre" }
];

const FormMetasPreventa = () => {
  const [form, setForm] = useState({
    codigo_ruta: "",
    anio: new Date().getFullYear(),
    tipo: "mensual", // mensual | anual
    mes: 0,
    meta_unidades: "",
    meta_dolares: ""
  });

  const handleSave = async () => {
    const payload = {
      codigo_ruta: form.codigo_ruta,
      anio: form.anio,
      mes: form.tipo === "anual" ? 0 : form.mes,
      meta_unidades: Number(form.meta_unidades),
      meta_dolares: Number(form.meta_dolares)
    };

    const res = await fetch("http://localhost:5000/api/ventas/metas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    alert(data.message);
  };

  return (
    <div className="bg-[#002b24] p-6 rounded-xl shadow-lg text-white w-full max-w-2xl">
      <h2 className="text-xl font-bold mb-4">Configurar Metas de Preventas</h2>

      {/* RUTA */}
      <label className="block text-sm mb-1">Ruta / Preventa</label>
      <select
        className="w-full p-2 mb-3 bg-[#013830] rounded-md"
        value={form.codigo_ruta}
        onChange={(e) => setForm({ ...form, codigo_ruta: e.target.value })}
      >
        <option value="">Seleccione</option>
        {rutas.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      {/* AÑO */}
      <label className="block text-sm mb-1">Año</label>
      <input
        type="number"
        className="w-full p-2 mb-3 bg-[#013830] rounded-md"
        value={form.anio}
        onChange={(e) => setForm({ ...form, anio: Number(e.target.value) })}
      />

      {/* TIPO META */}
      <label className="block text-sm mb-1">Tipo de Meta</label>
      <select
        className="w-full p-2 mb-3 bg-[#013830] rounded-md"
        value={form.tipo}
        onChange={(e) => setForm({ ...form, tipo: e.target.value })}
      >
        <option value="mensual">Mensual</option>
        <option value="anual">Anual</option>
      </select>

      {/* MES SOLO SI ES MENSUAL */}
      {form.tipo === "mensual" && (
        <>
          <label className="block text-sm mb-1">Mes</label>
          <select
            className="w-full p-2 mb-3 bg-[#013830] rounded-md"
            value={form.mes}
            onChange={(e) => setForm({ ...form, mes: Number(e.target.value) })}
          >
            <option value="">Seleccione</option>
            {meses.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        </>
      )}

      {/* META UNIDADES */}
      <label className="block text-sm mb-1">Meta Unidades</label>
      <input
        type="number"
        className="w-full p-2 mb-3 bg-[#013830] rounded-md"
        value={form.meta_unidades}
        onChange={(e) => setForm({ ...form, meta_unidades: e.target.value })}
      />

      {/* META DOLARES */}
      <label className="block text-sm mb-1">Meta USD</label>
      <input
        type="number"
        className="w-full p-2 mb-4 bg-[#013830] rounded-md"
        value={form.meta_dolares}
        onChange={(e) => setForm({ ...form, meta_dolares: e.target.value })}
      />


      <button
        onClick={handleSave}
        className="
    w-full
    flex items-center justify-center gap-2
    py-2
    bg-[#0db48b] hover:bg-[#0aa77e]
    rounded-md
    font-semibold
    transition
  "
      >
        <BsSave size={16} />
        Guardar Meta
      </button>

    </div>
  );
};

export default FormMetasPreventa;
