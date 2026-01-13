require("dotenv").config();

const express = require("express");
const cors = require("cors");


const login = require('./routes/login/loginRoutes');
const crearUsuario = require('./routes/login/usuariosRoutes');


const syncRoutes = require("./routes/rutasPreventas/sincronizacionRoutes");
const ventasRoutes = require("./routes/rutasPreventas/ventasRoutes");
const detallePreventaRoutes = require("./routes/rutasPreventas/detallePreventaRoutes");
const metasRoutes = require("./routes/rutasPreventas/metasRoutes");
const app = express();

app.use(cors());
app.use(express.json());


app.use('/api/login', login);
app.use('/api/usuarios', crearUsuario);

// RUTAS PREVENTAS
app.use("/api/sync", syncRoutes);
app.use('/api/ventas', ventasRoutes);
app.use("/api/ventas", detallePreventaRoutes);
app.use("/api/metas", metasRoutes);

// RUTAS BOTELLONES
const botellonesRoutes = require("./routes/rutasBotellones/rutasBotellones");
app.use("/api/botellones", botellonesRoutes);


// RUTAS HIELO
const HieloRoutes = require("./routes/rutasHielo/rutasHielo");
app.use("/api/hielo", HieloRoutes);




const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ API escuchando en puerto ${PORT}`);
});


// 🔥 iniciar cron
require('./cron/tareasCron');