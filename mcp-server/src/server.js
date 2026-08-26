// src/server.js
// Servidor MCP remoto de solo lectura sobre ventas (MobilVendor + Odoo, ya
// sincronizadas en Postgres). El transporte de las tools sigue el patrón de
// sesión del ejemplo oficial del SDK
// (@modelcontextprotocol/sdk/dist/cjs/examples/server/simpleStreamableHttp.js).
// La autorización (paso 2) usa el router OAuth oficial del SDK
// (server/auth/router.js) + un OAuthServerProvider propio (./auth/provider.js)
// que delega el login real a Google y valida el dominio (hd).
require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { isInitializeRequest } = require("@modelcontextprotocol/sdk/types.js");
const { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } = require("@modelcontextprotocol/sdk/server/auth/router.js");
const { requireBearerAuth } = require("@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js");

const { provider } = require("./auth/provider");
const googleCallbackRoute = require("./auth/googleCallbackRoute");

const { ventasPorRuta, inputSchema: schemaVentasPorRuta } = require("./tools/ventasPorRuta");
const { ventasPorGrupo, inputSchema: schemaVentasPorGrupo } = require("./tools/ventasPorGrupo");
const { resumenDiario, inputSchema: schemaResumenDiario } = require("./tools/resumenDiario");
const { topProductos, inputSchema: schemaTopProductos } = require("./tools/topProductos");
const { clientesInactivos, inputSchema: schemaClientesInactivos } = require("./tools/clientesInactivos");
const { proyeccionMensual, inputSchema: schemaProyeccionMensual } = require("./tools/proyeccionMensual");
const { ventasCliente, inputSchema: schemaVentasCliente } = require("./tools/ventasCliente");

function resultadoTexto(objeto) {
  return { content: [{ type: "text", text: JSON.stringify(objeto, null, 2) }] };
}

function crearServer() {
  const server = new McpServer({ name: "aqua-ventas-mcp", version: "0.1.0" });

  server.registerTool(
    "ventasPorRuta",
    {
      description:
        "Ventas totales (unidades y dólares) de una ruta/vendedor en un rango de fechas, desglosado por categoría de producto.",
      inputSchema: schemaVentasPorRuta,
    },
    async (args) => resultadoTexto(await ventasPorRuta(args))
  );

  server.registerTool(
    "ventasPorGrupo",
    {
      description:
        "Ventas totales de un grupo de canal (MAYORISTA, TIENDAS, TIENDAS_VIP, RURAL, DOMICILIO, EMPRESAS, VIP, QUITO, PREVENTA) en un rango de fechas, con categoría de producto opcional (BOTELLÓN, DESCARTABLE, HIELO, CAFÉ, PLUS, SUSCRIPCION, PT-DISTRINTER, PT-COTTSA, PT-IIBC, SERVICIOS, GASTOS GENERALES), desglosado por ruta, con comparación vs. el periodo anterior de igual duración. Para PREVENTA, si no se especifica categoría se usa DESCARTABLE por default (coincide con el ranking oficial del dashboard); se puede pedir otra categoría (ej. BOTELLÓN) para ver qué más venden esas rutas fuera del ranking oficial.",
      inputSchema: schemaVentasPorGrupo,
    },
    async (args) => resultadoTexto(await ventasPorGrupo(args))
  );

  server.registerTool(
    "resumenDiario",
    {
      description:
        "Resumen de ventas de un día específico: total, desglose por grupo, top rutas, y una bandera posible_hueco_sync que avisa si el conteo de documentos del día es anormalmente bajo vs. el mismo día de la semana en semanas anteriores (posible problema de sincronización, no necesariamente una caída real de ventas).",
      inputSchema: schemaResumenDiario,
    },
    async (args) => resultadoTexto(await resumenDiario(args))
  );

  server.registerTool(
    "topProductos",
    {
      description:
        "Ranking de productos más vendidos (por dólares) en un rango de fechas. Grupo y categoría opcionales para acotar (mismos valores que ventasPorGrupo) — ej. productos de PREVENTA en categoría DESCARTABLE. Para PREVENTA, si no se especifica categoría se usa DESCARTABLE por default.",
      inputSchema: schemaTopProductos,
    },
    async (args) => resultadoTexto(await topProductos(args))
  );

  server.registerTool(
    "clientesInactivos",
    {
      description:
        "Clientes de una ruta que compraron en el pasado reciente pero no en los últimos 15 días (ventanas de comparación fijas, no decididas por el modelo).",
      inputSchema: schemaClientesInactivos,
    },
    async (args) => resultadoTexto(await clientesInactivos(args))
  );

  server.registerTool(
    "proyeccionMensual",
    {
      description:
        "Proyección de venta mensual (run-rate) con la misma fórmula y días hábiles que ya usa el dashboard (excluye domingos y feriados nacionales). Por defecto proyecta el mes en curso, la empresa completa; acepta año/mes, grupo y categoría opcionales para acotar. Un mes ya cerrado devuelve el real sin proyectar.",
      inputSchema: schemaProyeccionMensual,
    },
    async (args) => resultadoTexto(await proyeccionMensual(args))
  );

  server.registerTool(
    "ventasCliente",
    {
      description:
        "Historial de ventas de un cliente específico buscado por nombre parcial (no hace falta el nombre exacto). Si hay más de una coincidencia, devuelve la lista de candidatos (código + nombre) para elegir, no asume ninguno. Con exactamente un match, devuelve el total, el desglose por mes y por dirección de entrega en el rango de fechas.",
      inputSchema: schemaVentasCliente,
    },
    async (args) => resultadoTexto(await ventasCliente(args))
  );

  return server;
}

const app = express();
app.use(express.json());

const issuerUrl = new URL(process.env.MCP_ISSUER_URL);
const resourceServerUrl = new URL("/mcp", issuerUrl);

// Instala /authorize, /token, /register, /revoke y los .well-known de
// metadata OAuth — todo generado por el SDK a partir de nuestro provider.
app.use(
  mcpAuthRouter({
    provider,
    issuerUrl,
    resourceServerUrl,
    scopesSupported: ["ventas:read"],
  })
);

// El paso intermedio del navegador (vuelta de Google) no es parte del
// protocolo OAuth que ve Claude — es interno entre nuestro /authorize y
// nuestro propio código de autorización.
app.use(googleCallbackRoute);

const exigirBearerToken = requireBearerAuth({
  verifier: provider,
  requiredScopes: ["ventas:read"],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceServerUrl),
});

// sessionId -> transport ya conectado a un McpServer.
const transports = {};

async function mcpPostHandler(req, res) {
  const sessionId = req.headers["mcp-session-id"];

  try {
    let transport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
        },
      });
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) delete transports[sid];
      };

      const server = crearServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error manejando request MCP:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
}

async function mcpGetHandler(req, res) {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
}

async function mcpDeleteHandler(req, res) {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
}

app.post("/mcp", exigirBearerToken, mcpPostHandler);
app.get("/mcp", exigirBearerToken, mcpGetHandler);
app.delete("/mcp", exigirBearerToken, mcpDeleteHandler);

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT) || 8787;
app.listen(PORT, () => {
  console.log(`aqua-mcp-server escuchando en :${PORT} (OAuth con Google, dominio=${process.env.ALLOWED_HD})`);
});
