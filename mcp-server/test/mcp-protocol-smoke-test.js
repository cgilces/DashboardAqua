// test/mcp-protocol-smoke-test.js
// Smoke test del protocolo MCP real: levanta src/server.js en un puerto
// efímero, se conecta con el Client oficial del SDK, hace el handshake de
// inicialización, lista las tools y llama una. Valida el wiring del
// transporte (no la lógica de negocio, que ya prueba manual-test.js).
require("dotenv").config();
const { spawn } = require("child_process");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

const PORT = 8788;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const proc = spawn(process.execPath, ["src/server.js"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stdout.on("data", (d) => process.stdout.write(`[server] ${d}`));
  proc.stderr.on("data", (d) => process.stderr.write(`[server:err] ${d}`));

  await esperar(1000);

  try {
    const client = new Client({ name: "smoke-test-client", version: "0.1.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`http://localhost:${PORT}/mcp`));
    await client.connect(transport);
    console.log("Conectado. Handshake de inicialización OK.");

    const { tools } = await client.listTools();
    console.log(`Tools listadas (${tools.length}):`, tools.map((t) => t.name).join(", "));
    if (tools.length !== 5) throw new Error(`Se esperaban 5 tools, llegaron ${tools.length}`);

    const resultado = await client.callTool({
      name: "resumenDiario",
      arguments: { fecha: new Date(Date.now() - 86400000).toISOString().slice(0, 10) },
    });
    console.log("callTool(resumenDiario) OK, primeros 200 chars:");
    console.log(resultado.content[0].text.slice(0, 200));

    console.log("\nSMOKE TEST OK");
  } finally {
    proc.kill();
  }
}

main().catch((err) => {
  console.error("SMOKE TEST FALLÓ:", err);
  process.exit(1);
});
