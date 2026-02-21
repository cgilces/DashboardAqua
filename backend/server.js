require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

// ======================================================
// 🌐 CORS (LOCAL + PRODUCCIÓN)
// ======================================================
const allowedOrigins = [
  "https://dashboard.aqua.com.ec",
  "https://api.aqua.com.ec",
  "http://localhost:5173",
  "http://localhost:3000"
];

app.use(cors({
  origin: (origin, callback) => {
    // Permite Postman, cron, jobs internos
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// ======================================================
// 🔐 AUTH
// ======================================================
app.use("/api/login", require("./routes/login/loginRoutes"));
app.use("/api/usuarios", require("./routes/login/usuariosRoutes"));

// ======================================================
// 📦 PREVENTAS
// ======================================================
app.use("/api/sync", require("./routes/rutasPreventas/sincronizacionRoutes"));
app.use("/api/ventas", require("./routes/rutasPreventas/ventasRoutes"));
app.use("/api/ventas", require("./routes/rutasPreventas/detallePreventaRoutes"));
app.use("/api/metas", require("./routes/rutasPreventas/metasRoutes"));

// ======================================================
// 🚚 BOTELLONES
// ======================================================
app.use("/api/botellones", require("./routes/rutasBotellones/rutasBotellones"));
app.use("/api/botellones", require("./routes/rutasBotellones/detalleBotellonesRoutes"));

// ======================================================
// ❄️ HIELO
// ======================================================
app.use("/api/hielo", require("./routes/rutasHielo/rutasHielo"));
app.use("/api/hielo", require("./routes/rutasHielo/detalleHieloRoutes"));


// ======================================================
//  VISITAS RUTAS
// ======================================================
app.use("/api/visitas", require("./routes/rutasVisitas/visitasRoutes"));


app.use("/api/bot", require("./routes/rutasbotinteligente/chat.routes"));


// ======================================================
// ❤️ HEALTHCHECK
// ======================================================
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ======================================================
// 🚀 START SERVER
// ======================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ API escuchando en puerto ${PORT}`);
});
