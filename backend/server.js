require("dotenv").config();

const express = require("express");
const cors = require("cors");

const syncRoutes = require("./routes/sincronizacionRoutes");
const ventasRoutes = require("./routes/ventasRoutes");
const detallePreventaRoutes = require("./routes/detallePreventaRoutes");
const metasRoutes = require("./routes/metasRoutes");
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/sync", syncRoutes);
app.use('/api/ventas', ventasRoutes);
app.use("/api/ventas", detallePreventaRoutes);
app.use("/api/metas", metasRoutes);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ API escuchando en puerto ${PORT}`);
});


// 🔥 iniciar cron
require('./cron/tareasCron');