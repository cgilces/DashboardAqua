import { API_BASE_URL } from "../config";
import { fetchAuth } from "./fetchAuth";

// Construye un link de WhatsApp con texto personalizado.
// Si el cliente tenía productos típicos, los incluye en el mensaje.
//
// Uso:
//   const link = await buildWhatsAppLink({ telefono, codigoCliente, nombre });
//   window.open(link, "_blank");

export type WaArgs = {
  telefono: string;
  codigoCliente: string;
  nombre: string;
  diasSinCompra?: number;
};

function normalizarTel(t: string) {
  if (!t) return "";
  const limpio = t.replace(/\D/g, "");
  if (!limpio) return "";
  if (limpio.length > 10) return limpio;
  if (limpio.startsWith("0") && limpio.length === 10) return "593" + limpio.slice(1);
  return limpio;
}

export async function buildWhatsAppLink(args: WaArgs): Promise<string | null> {
  const tel = normalizarTel(args.telefono);
  if (!tel) return null;

  // Saludo + razón
  let msg = `Hola ${args.nombre.split(" ")[0]}, te contactamos de Aqua. `;
  if (args.diasSinCompra && args.diasSinCompra > 0) {
    msg += `Notamos que no nos has hecho un pedido en ${args.diasSinCompra} días.`;
  } else {
    msg += `Queremos saber cómo te podemos ayudar.`;
  }

  // Intenta obtener productos típicos para personalizar
  try {
    const res = await fetchAuth(
      `${API_BASE_URL}/api/dashboard-clientes/productos-recientes/${encodeURIComponent(args.codigoCliente)}`
    );
    const json = await res.json();
    if (json.ok && json.productos && json.productos.length > 0) {
      const tops = json.productos.slice(0, 2).map((p: any) => p.producto).filter(Boolean);
      if (tops.length > 0) {
        msg += `\n\n¿Necesitas reabastecer ${tops.join(" o ")}? Estamos listos para hacerte llegar tu pedido.`;
      }
    }
  } catch {
    // Falla silenciosa: usamos solo el mensaje base
  }

  return `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
}

// Versión síncrona/sin productos para uso fallback
export function buildWhatsAppLinkSimple(args: WaArgs): string | null {
  const tel = normalizarTel(args.telefono);
  if (!tel) return null;
  const nombre = args.nombre.split(" ")[0];
  const txt = args.diasSinCompra && args.diasSinCompra > 0
    ? `Hola ${nombre}, te contactamos de Aqua. Notamos que llevas ${args.diasSinCompra} días sin pedido. ¿Te podemos ayudar?`
    : `Hola ${nombre}, te contactamos de Aqua.`;
  return `https://wa.me/${tel}?text=${encodeURIComponent(txt)}`;
}
