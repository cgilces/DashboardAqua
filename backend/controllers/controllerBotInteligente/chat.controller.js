const { generarSQL } = require("../../services/chatbotservicio/openai.service");
const { ejecutarSQL } = require("../../services/chatbotservicio/query.service");
const { validarSQL, aplicarLimite } = require("../../utils/sqlValidator");

function esPreguntaSQL(mensaje) {
  const texto = mensaje.toLowerCase();

  const palabrasClave = [

    // 🔹 Ventas
    "venta", "vendio", "vendido", "factura", "orden",
    "consumo", "monto", "total", "ingreso", "recaudacion",

    // 🔹 Clientes
    "cliente", "clientes", "saldo", "credito",
    "negocio", "tipo de negocio", "direccion",

    // 🔹 Productos
    "producto", "productos", "cantidad",
    "categoria", "precio", "detalle",

    // 🔹 Rutas
    "ruta", "rutas", "preventas", "televenta",
    "vip", "despacho", "secuencia",

    // 🔹 Usuarios
    "usuario", "usuarios", "vendedor",
    "despachador", "admin", "rol",

    // 🔹 Visitas
    "visita", "visitas", "accion",
    "ruptura", "comentario",

    // 🔹 Tiempo
    "hoy", "ayer", "semana", "mes",
    "año", "fecha", "rango", "periodo",

    // 🔹 Sincronización
    "sincronizacion", "sincronizacion ventas",
    "estado sync", "registros sincronizados",

    // 🔹 Geolocalización
    "latitud", "longitud", "ubicacion",

    // 🔹 Estado
    "estado", "activo", "inactivo",
    "proceso", "proceso de venta", "proceso de sincronizacion",

    //otros términos relacionados con el negocio o sistema pueden ser añadidos aquí
    "hielo",
    "agua",
    "botellon",
    "botellones",
    "galon",
    "galones",
    "pack",
    "producto",
    "categoria",
    "unidades"
  ];

  return palabrasClave.some(p => texto.includes(p));
}

async function chatHandler(req, res) {
  console.log("----- INICIO CHAT HANDLER -----");

  try {
    const { mensaje } = req.body;
    const { usuario, rol, seller_code } = req.user;

    console.log("Mensaje:", mensaje);
    console.log("Usuario:", usuario);
    console.log("Rol:", rol);
    console.log("Seller_code:", seller_code);

    if (!mensaje) {
      return res.status(400).json({ respuesta: "Mensaje vacío." });
    }

    if (!esPreguntaSQL(mensaje)) {
      return res.json({
        respuesta: "Solo puedo responder consultas relacionadas con ventas y datos del sistema."
      });
    }

    // 1️⃣ Generar SQL
    let sql = await generarSQL(mensaje, rol, seller_code);
    console.log("🧠 SQL generado:", sql);

    // 2️⃣ Validar SQL
    if (!validarSQL(sql)) {
      console.log("❌ SQL inválido");
      return res.json({ respuesta: "Consulta no permitida." });
    }

    // 3️⃣ Aplicar límite
    sql = aplicarLimite(sql, 200);
    console.log("📏 SQL con límite aplicado:", sql);

    // 4️⃣ Ejecutar
    const datos = await ejecutarSQL(sql);
    console.log("📊 Datos obtenidos:", datos);
    console.log("📊 Total registros reales:", datos?.length);

    if (!datos || datos.length === 0) {
      return res.json({
        respuesta: "No existe información en la base de datos."
      });
    }

    // 5️⃣ Construcción determinística segura
    const totalRegistros = datos.length;

    let respuesta = `Se encontraron ${totalRegistros} registros.\n\n`;

    datos.forEach((fila, index) => {
      const valores = Object.entries(fila)
        .map(([key, value]) => `${key}: ${value}`)
        .join(" | ");

      respuesta += `${index + 1}. ${valores}\n`;
    });

    console.log("✅ Respuesta final enviada al usuario.");

    return res.json({ respuesta });

  } catch (error) {
    console.error("❌ ERROR EN CHAT:", error);
    return res.status(500).json({
      respuesta: "Ocurrió un error procesando la consulta."
    });
  }
}

module.exports = { chatHandler };