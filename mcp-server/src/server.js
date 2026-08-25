// src/server.js
// Servidor MCP remoto de solo lectura sobre ventas (MobilVendor + Odoo, ya
// sincronizadas en Postgres). Paso 1: sin OAuth todavía (se agrega en el
// paso 2) — este archivo expone las 5 tools sobre el transporte Streamable
// HTTP oficial, siguiendo el patrón de sesión del ejemplo del propio SDK
// (@modelcontextprotocol/sdk/dist/cjs/examples/server/simpleStreamableHttp.js).
require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { isInitializeRequest } = require("@modelcontextprotocol/sdk/types.js");

const { ventasPorRuta, inputSchema: schemaVentasPorRuta } = require("./tools/ventasPorRuta");
const { ventasPorGrupo, inputSchema: schemaVentasPorGrupo } = require("./tools/ventasPorGrupo");
const { resumenDiario, inputSchema: schemaResumenDiario } = require("./tools/resumenDiario");
const { topProductos, inputSchema: schemaTopProductos } = require("./tools/topProductos");
const { clientesInactivos, inputSchema: schemaClientesInactivos } = require("./tools/clientesInactivos");

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
        "Ventas totales de un grupo de canal (MAYORISTA, TIENDAS, TIENDAS_VIP, RURAL, DOMICILIO, EMPRESAS, VIP, QUITO) en un rango de fechas, desglosado por ruta, con comparación vs. el periodo anterior de igual duración.",
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
      description: "Ranking de productos más vendidos (por dólares) en un rango de fechas.",
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

  return server;
}

const app = express();
app.use(express.json());

// sessionId -> transport ya conectado a un McpServer.
const transports = {};

// NOTA paso 1: sin autenticación todavía. El paso 2 agrega el flujo OAuth con
// Google (validación de hd=aqua.com.ec) antes de aceptar requests en /mcp.
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

app.post("/mcp", mcpPostHandler);
app.get("/mcp", mcpGetHandler);
app.delete("/mcp", mcpDeleteHandler);

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT) || 8787;
app.listen(PORT, () => {
  console.log(`aqua-mcp-server escuchando en :${PORT} (sin OAuth — paso 1)`);
});
