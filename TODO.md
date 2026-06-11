# TODO — DashboardAqua

Fuente de verdad del backlog. Solo se trabajan tareas en `[ ]`. Al entregar, marcar `[x]` con la rama/PR.

## Promociones — Analítica por prendedor + IA (rama: `feature/promos-analitica-prendedor`)

Contexto: el web-service de MobilVendor NO expone `users_in_promos` (confirmado: "Schema not found").
Pero las **líneas de venta** (`getInvoices` → detalle) sí traen `promo_code` y `promo_action_code`,
y la cabecera trae el vendedor (`seller_code`/`user_code`). De ahí sale "qué promo vendió cada prendedor".

- [x] **Datos**: persistir `promo_code` y `promo_action_code` (+ `descuento_linea`) en `detalle_documento`
      (modelo + schema + ALTER idempotente) y mapearlos en el sync de ventas. Dedup de líneas ahora
      incluye la promo en la clave; `UNIQUE` migrado a `unique_detalle_doc_promo`.
- [x] **Backend analítica**: `promosDashboard.service.js` (rankingGeneral, rankingPrendedores,
      promosPorPrendedor, detallePromo) sobre `detalle_documento` ⨝ `facturas`/`ordenes`.
- [x] **API**: `controllerPromos/promosController.js` + `routes/rutasPromos/promosRoutes.js` en `/api/promos`.
- [x] **IA/Cloud**: glosario del agente (`agente.service.js`) ampliado con promos (columnas + cómo calcular).
- [x] **UI**: página `DashboardPromos` (destacado + ranking general + ranking prendedores + drill-down modal)
      + ruta en `main.tsx` + entrada "PROMOCIONES" en el menú lateral.
- [x] Verificado: `node --check` (backend) y `tsc --noEmit` (frontend) sin errores. Pendiente: revisión + PR.

## Reporte "Promociones Utilizadas" — réplica dashboard86 (rama: `feature/promos-reporte-utilizadas`)

Objetivo: replicar en `/dashboard/promociones` el reporte de MobilVendor `#reporting/dashboard86`
(detalle línea por línea con filtros), integrado como vista "Reporte detallado" junto al
"Resumen" (ranking) que ya existía. Solo se usan datos ya sincronizados (detalle_documento ⨝
facturas/ordenes); no se tocó el sync.

- [x] **Backend**: `promosDashboard.service.reporteUtilizadas` (detalle línea por línea con
      filtros inicio/fin/promo/tab + total cantidad + conteo factura/orden para la torta) y
      `listaPromos` (dropdown). Controller `obtenerReporte`/`obtenerListaPromos`; rutas
      `GET /api/promos/reporte` y `GET /api/promos/lista`.
- [x] **Frontend**: `ReportePromocionesUtilizadas.tsx` (cabecera con logo + título centrado +
      fecha de emisión dinámica; filtros Fecha Inicio/Fin con hora + Restablecer/Aceptar +
      dropdown PROMOCIÓN "(Todos)"; 2 pestañas; tabla con las 11 columnas exactas, encabezados
      azules, fila seleccionada azul, total CANTIDAD (U) al pie; torta ECharts FACTURA azul /
      ORDEN rosado con conteo central). Toggle "Resumen / Reporte detallado" en `DashboardPromos`.
- [x] Verificado: `node --check` (backend), `tsc --noEmit -p tsconfig.app.json` y `vite build` (exit 0).
      Pendiente: revisión + PR (`main...feature/promos-reporte-utilizadas`).
- [ ] **Fase 2 (requiere tocar el sync)**: capturar `factor` real por línea (hoy = 1.00);
      confirmar/ajustar la base de cálculo de `DESC. %` contra dashboard86; sincronizar
      documentos de devolución para poblar la pestaña `Devolucion_SolicitudDev` (hoy sin datos:
      el sync solo pide `type:"1,2"`).

## Drill-down por promo en el Ranking general (misma rama: `feature/promos-reporte-utilizadas`)

Objetivo: clic en una promo del "Ranking general de promociones" → vista de los vendedores
que la vendieron, mismo diseño que el detalle de "Vendedores", con columnas
Cant. promoción · Cant. sin promoción · Dólares (bruto) · Descuento · Total (neto).

Decisión validada con datos reales: las promos `DESC*` no guardan el "+1" como línea a $0,
sino como descuento embebido. Cálculo elegido por el usuario: cantidad promoción =
descuento ÷ precio (unidades-equivalentes gratis), sin promoción = subtotal ÷ precio.
Dólares = subtotal+descuento (bruto), Total = subtotal (neto), de modo que bruto−desc = neto.

- [x] **Diagnóstico**: `scripts/probePromoGift.js` + consultas psql para confirmar que el regalo
      va embebido como descuento (no línea $0) en las promos `DESC*`.
- [x] **Backend**: `detallePromo` ahora separa cant. promoción/sin promoción y devuelve
      dólares/descuento/total por vendedor + totales (CTE extendida con `precio`/`subtotal`).
      Endpoint existente `GET /api/promos/detalle/:promoCode`.
- [x] **Frontend** (`DashboardPromos`): filas del ranking general clicables → vista por promo
      (tarjeta + KPIs + `TablaPromoVendedores` con footer de totales), botón "volver".
- [x] Verificado: `node --check`, `tsc -p tsconfig.app.json`, `vite build` (exit 0).
      Pendiente: probar con datos reales en el server + revisión/PR.

## Saludo de bienvenida dinámico del chatbot (rama: `feature/saludo-bienvenida-personalizado`)

Objetivo: que el "Asistente Aqua" salude al iniciar sesión de forma 100% personalizada
(por nombre, según la hora en America/Guayaquil) y alineado a lo que el dashboard
realmente ofrece (ventas, cartera, metas, rutas) — no el saludo estático genérico.

- [x] **Backend**: endpoint `GET /api/bot/bienvenida` (controller aislado
      `bienvenida.controller.js`) que genera el saludo con Claude; caché corto 3 min
      (dedupe doble-montaje) + fallback determinista si la IA falla. Ruta registrada.
- [x] **Frontend** (`ChatFlotante.tsx`): pide el saludo al montar (chat fresco) y tras
      "limpiar"; reemplaza solo el saludo por defecto, nunca pisa conversación real.
- [x] Verificado: `node --check` (backend) y `tsc --noEmit` (frontend) sin errores.
      Pendiente: revisión + PR (`main...feature/saludo-bienvenida-personalizado`).

## Voz "JARVIS" del chatbot — ElevenLabs (misma rama)

Objetivo: que el Asistente Aqua hable en voz alta (TTS) el saludo y cada respuesta,
con voz masculina grave (Adam), configurable por `.env`.

- [x] **Backend**: `voz.service.js` (ElevenLabs, limpia markdown/emojis, tope 800 chars,
      voz/modelo por `ELEVENLABS_VOICE_ID`/`ELEVENLABS_MODEL`) + `voz.controller.js`
      (`POST /api/bot/voz` → audio/mpeg). Ruta registrada. Usa la `ELEVENLABS_API_KEY` del `.env`.
- [x] **Frontend** (`ChatFlotante.tsx`): habla el saludo al abrir y cada respuesta del bot;
      toggle de mute en el header (recordado), botón ▶ por mensaje, animación "Hablando…".
- [x] Verificado: `node --check`, `tsc --noEmit` y **prueba real de TTS** (MP3 97 KB, voz Adam, español).
      Default voz = Adam (`pNInz6obpgDQGcFmaJgB`), modelo `eleven_multilingual_v2`.

## Flujo JARVIS completo: modal de bienvenida + micrófono (misma rama)

Flujo: login → modal que saluda con voz → micrófono escucha la pregunta →
Claude responde → ElevenLabs vocaliza → acciones PDF/Excel/stats (ya existentes).

- [x] **Modal de bienvenida** (`JarvisBienvenida.tsx`, montado en `ChatGlobal`): aparece una vez
      tras el login (flag `jarvis_saludar` puesto en `AuthContext.login`), pide el saludo dinámico,
      lo muestra y lo vocaliza; fallback "Escuchar saludo" si el navegador bloquea autoplay.
      Botones "Hablar con JARVIS" (abre chat + micrófono) y "Escribir en el chat".
- [x] **Micrófono (voz→texto)** en `ChatFlotante`: Web Speech API (es-EC), botón mic en el input,
      transcribe y envía solo al terminar de hablar; estado "Escuchando…". Coordinación modal↔chat
      por eventos `jarvis:escuchar` / `jarvis:abrir-chat`. Sin doble saludo (flag `jarvis_modal_sesion`).
- [x] Verificado: `tsc --noEmit` sin errores.

### Mejora PRO: STT en servidor + VAD + ondas reactivas (modo conversación del modal)
El `SpeechRecognition` del navegador era inestable ("se corta solo / no escucha"). Reemplazado por:
- [x] **Backend STT**: `voz.service.transcribirAudio` (ElevenLabs `scribe_v1`) + `transcribirHandler`
      (`POST /api/bot/transcribir`, `express.raw` 25mb). Probado round-trip TTS→STT con la key real.
- [x] **Frontend modal**: `MediaRecorder` + **VAD** (detección voz/silencio para cerrar la frase) +
      **ondas que reaccionan al micrófono** mientras hablas y al TTS mientras responde; reusa el stream
      durante la conversación, libera el micro al detener. Avisos de permiso/errores. Voz a ~1.07x natural.

### Resiliencia: fallback a voz NATIVA del navegador (sin créditos ElevenLabs)
Causa detectada en logs: la cuenta ElevenLabs se quedó **sin créditos** (`quota_exceeded`, 20/157).
- [x] **Backend**: `voz.controller` distingue `quota_exceeded` → `402 {code:"quota_exceeded"}` (antes lo
      etiquetaba mal como "API key inválida"). Verificado contra la cuenta real agotada.
- [x] **Frontend**: si `/voz` falla → **TTS por `SpeechSynthesis`** (modal + ChatFlotante, con onda animada);
      si `/transcribir` falla → **STT por `SpeechRecognition`** del navegador. Así sigue hablando/escuchando
      gratis aunque ElevenLabs no tenga créditos. Verificado: `tsc` + `vite build` OK.
- [ ] Para recuperar la voz premium de ElevenLabs: **recargar créditos** en la cuenta (o bajar uso).

### Limpieza de voz + robustez del dictado (autónomo)
- [x] **Lectura coherente** (`utils/limpiarVoz.ts` + backend `limpiarTexto`): lista blanca (solo letras,
      números y puntuación de habla) → ya no lee "guion/asterisco/barra/signo de dólares" ni describe emojis;
      moneda `$`→"dólares", decimal `,`→"con", `%`→"por ciento", tablas→frases. Verificado en node.
- [x] **Dictado robusto** (sin colgarse): persiste el fallback STT del navegador (no malgasta el primer
      intento), tope de escucha 10s, `onstart` limpia avisos, mensaje "No te escuché" si no capta (no se
      queda mudo/congelado), aviso "usando dictado del navegador" cuando ElevenLabs no tiene créditos.
- [x] Verificado: `node --check`, `tsc --noEmit`, `vite build` (exit 0).

### Voz del navegador nivel premium (`utils/vozNavegador.ts`, autónomo)
- [x] **Mejor voz en español**: elige neural/Google/Microsoft/voz de red (no la voz por defecto, a veces
      en inglés) y **espera `voiceschanged`** (las voces cargan async). `precargarVoces()` al montar.
- [x] **Sin cortes**: trocea el texto por frases (evita el bug de Chrome ~15s en textos largos) y recorta
      respuestas muy largas para voz (el texto completo queda en el chat).
- [x] **DRY**: módulo único usado por el modal JARVIS y el ChatFlotante; `detenerNavegador()` corta la voz
      al silenciar/detener. Verificado: `tsc --noEmit` + `vite build` (exit 0).

### Pendiente / fase 2
- [ ] Inventario *asignado* por prendedor (`users_in_promos`): requiere que MobilVendor habilite ese
      schema en el web-service para el contexto `grupoAqua`. Solo entonces el sync ya existente lo levanta.
- [ ] Arreglo overflow `varchar(100)` en tablas de promo → ampliado a `TEXT` (hecho en rama de fix previa).
