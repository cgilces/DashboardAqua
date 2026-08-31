# TODO — DashboardAqua

Fuente de verdad del backlog. Solo se trabajan tareas en `[ ]`. Al entregar, marcar `[x]` con la rama/PR.

## Sesión sin cierre automático (rama: `feature/sesion-sin-cierre-automatico`)

- [x] Quitado el auto-logout por inactividad (timer de 5 min) en `AuthContext.tsx` y
      extendido el JWT de `8h` → `30d` (`backend/config/index.js`) para que la sesión
      se mantenga abierta. Verificado: `node --check` + `tsc --noEmit` (exit 0).

## Visibilidad por rol/canal en todo el dashboard (rama: `feature/visibilidad-por-rol-canal`)

Regla: ADMIN ve todo · SUPERVISOR ve toda la tabla del/los CANAL(es) de sus rutas
asignadas (basta una ruta del canal) · VENDEDOR ve solo su(s) ruta(s) exactas ·
CLIENTES abierto a todos. Canal = letras iniciales del código (T1→T, TV1→TV, distingue
T de TV). Antes solo se filtraba a VENDEDOR por ruta exacta; ADMIN/SUPERVISOR veían todo.

- [x] **Helper backend** `utils/visibilidadRutas.js` (`canalDeRuta`, `filtroVisibilidad`):
      fuente única del filtrado. ADMIN no restringe; SUPERVISOR por canal; VENDEDOR exacto.
- [x] **Controladores** refactorizados al helper (sin cambiar ADMIN/VENDEDOR, agregando
      canal de SUPERVISOR): Botellón (`botellonesController`), Preventa/Descartable
      (`ventasController`, 3 sitios), Hielo (`hieloController`).
- [x] **Helper frontend** `utils/visibilidad.ts` (espejo) + **menú por canal** en
      `SidebarDashboards` (módulos con `canales`; Clientes `abiertoATodos`) + **redirección
      post-login** del VENDEDOR al módulo de su canal (`moduloInicial`).
- [x] Verificado: `node --check` (helper + 3 controladores), `tsc -p tsconfig.app.json`,
      `vite build` (exit 0). Pendiente: prueba real con usuarios SUPERVISOR/VENDEDOR + PR.
- [ ] **Fase 2 (requiere input del usuario)**: mapeo canal→módulo de Plus/Café/Visitas/
      Consolidado (qué prefijos de ruta los alimentan) + filtrado de datos en esos módulos.
      Confirmar solapes de prefijos (TV/M/R aparecen en Botellón y Preventa).
- [ ] **Endurecimiento**: las rutas de `main.tsx` no tienen guard por rol (solo el menú
      oculta); un no-admin podría navegar por URL a un módulo aún sin filtro. Agregar guard.

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

## Errores del chatbot en modal en pantalla (rama: `feature/chatbot-errores-modal`)

Contexto: el chatbot mostraba "No pude conectarme con el servidor" para cualquier fallo,
ocultando la causa real. Diagnóstico (logs): la cuenta de Anthropic se quedó **sin créditos**
(`400 invalid_request_error: "credit balance is too low"`) → todo lo que pasa por el agente
Claude falla. El front no leía el cuerpo del error.

- [x] **Backend** (`chat.controller.js`): clasificar el error de saldo agotado (`credit balance`)
      y devolver `503` con mensaje honesto (`codigo: "sin_creditos"`) en vez del genérico.
- [x] **Frontend** (`ChatFlotante.tsx`): leer el `respuesta` real del backend en `!res.ok` y
      mostrarlo en un **modal de error** en pantalla (título + mensaje + "Entendido");
      `catch` de red muestra modal "Sin conexión".
- [ ] Verificar: `node --check` (backend) + `tsc --noEmit` (frontend) + PR.
- [ ] **Acción del usuario (no es código):** recargar créditos en console.anthropic.com →
      Plans & Billing (o cambiar `ANTHROPIC_API_KEY`) para que la IA vuelva a funcionar.
- [x] **Fase 2 — modal de error GLOBAL** (rama `feature/modal-error-global`): cubre toda la app.
      `utils/errorGlobal.ts` (bus de eventos + lector del mensaje del backend),
      `utils/interceptorErrores.ts` (intercepta `fetch`: red caída + HTTP ≥400 excepto 401; +
      `unhandledrejection` y `window.error`; excluye `/api/bot/*` que tiene su propio modal),
      `ErrorModalGlobal.tsx` (modal único, con cola) y `ErrorBoundary.tsx` (errores de render).
      Montados en `main.tsx`. Verificado: `tsc --noEmit` + `vite build` (exit 0).

## Preventa "no cuadra" vs guías de entrega MobilVendor (rama: `fix/preventa-cuadre-guias-entrega`)

- [x] **Causa hallada:** el RANKING PREVENTA (`calcularKPIsMes` en `ventasController.js`) era el
      único query del módulo que **no filtraba `dd.codigo_categoria = '7'`**, así que sumaba TODAS
      las líneas del pedido (no-descartable, anticipos, envíos) e inflaba los dólares de cada ruta
      → por eso "ninguna ruta cuadraba" con la guía de entrega (status terminado). `status = 5` y
      `dd.total` (c/IVA) sí eran correctos (convención del módulo; `tendencia6MesesPreventa` ya
      usaba esos mismos filtros + categoría '7').
- [x] **Fix:** agregado `AND dd.codigo_categoria = '7'` a las 2 consultas afectadas (ranking de
      dólares/unidades + unidades por presentación). Ahora cuadra con `tendencia6MesesPreventa`.
- [x] **Diagnóstico/verificación:** `scripts/diagRankingPreventaVsGuia.js` imprime por ruta los
      candidatos de suma (total/subtotal, con/sin cat '7', sin anticipo/envío) y el desglose por
      status, para comparar contra la guía. Verificado: `node --check` (controller + script).
- [x] **2ª causa — órdenes faltantes (borde de mes):** MobilVendor entrega los documentos por
      FECHA DE CREACIÓN. Un pedido creado a fin del mes anterior pero ENTREGADO este mes (ej.
      creado 30/05, entregado 02/06) se sincroniza cuando aún no está entregado → `dispatch_date`
      vacío → `fecha_entrega` queda en mayo; y como ninguna sync posterior lo vuelve a pedir (su
      fecha de creación ya pasó), queda congelado y "falta" en el ranking de junio (filtra por
      `fecha_entrega`). El cron (`tareasCron.js`) solo miraba "ayer+hoy", agravándolo.
- [x] **Fix sync:** ventana retroactiva de 10 días: `tareasCron.js` (ambos crons miran los últimos
      10 días) y `sincronizacionController.js` (la sync por mes solapa 10 días del mes anterior).
      Re-trae esas órdenes y actualiza su `fecha_entrega` real (idempotente). Verificado: `node --check`.
- [ ] **Acción del usuario:** tras desplegar, correr **una sync manual de junio** (ahora con el
      solape) para reparar las órdenes ya guardadas con la fecha de mayo. Luego comparar con la guía
      con `node scripts/diagRankingPreventaVsGuia.js 2026 6`.

## Deduplicar "Productos Vendidos" en todo el dashboard (rama: `feature/dedupe-productos-vendidos`)

Problema: `detalle_documento.descripcion` a veces trae el código como prefijo
(`[28] BOTELLÓN 20L AQUA PREMIUM`) y a veces no (`BOTELLÓN 20L AQUA PREMIUM`), así que el
mismo producto aparece duplicado en las tablas de Productos Vendidos. Ejemplo real:
`/domicilio-botellon/clientes/2026/6`.

- [x] **Helper único** `utils/dedupeProductos.js` (`limpiarNombreProducto` quita `[NN] `/`[código] `;
      `dedupeProductosVendidos` fusiona por nombre normalizado, suma unidades/dólares y recalcula
      precio promedio). Auto-detecta los nombres de campo de cada módulo. Probado con el caso real.
- [x] **Aplicado** en todas las tablas de productos vendidos: Botellón (`botellonesController` ×9,
      `detalleBotellonController`), Descartable Odoo, Preventa (`ventasController`,
      `detalleCanalController`, `detallePreventaController`), Plus (2º endpoint), Hielo Odoo (2º
      endpoint), COTTSA, Clientes (`dashboardClientes` ×3) y Gerencia (top productos). Café y los
      1ºs endpoints de Plus/Hielo ya tenían su propia limpieza (sin cambios).
- [x] Verificado: `node --check` en los 12 archivos + prueba unitaria del helper. Pendiente: PR.
- [ ] **Fase 2 (opcional):** la "tabla de precio promedio" de preventa (keyed por vendedor+producto,
      `obtenerProductosVendidosMes`/`procesarTablaPrecioPromedio`) no se tocó; si también muestra
      duplicados por prefijo, normalizar ahí.

## Fluidez del chatbot: voz sin demora + respuesta más ágil (rama: `feat/chatbot-fluidez`)

- [x] **Voz sin demora** (`utils/vozEstado.ts`): se mantienen las DOS opciones (ElevenLabs premium
      → navegador/Google), pero al detectar que ElevenLabs no tiene saldo se **recuerda por sesión**
      (`sessionStorage`) y los siguientes mensajes van **directo** a la voz del navegador, sin esperar
      el round-trip que falla. Aplicado en `ChatFlotante.hablar()` y `JarvisBienvenida.hablar()`.
      (El STT ya tenía su propio short-circuit `jarvis_stt_navegador`.)
- [x] **Respuesta más ágil**: `agente.service.js` baja `effort` de `high` a `medium` (equilibrio
      velocidad/calidad; reversible). Verificado: `node --check` + `tsc --noEmit`.
- [ ] **Fluidez (fase 2, opcional):** streaming de la respuesta del chat (SSE) para que el texto/voz
      empiecen a aparecer mientras el agente sigue redactando — sensación más natural y rápida.

## Barra de sincronización congelada en 70% (rama: `fix/sync-progreso-barra`)

Síntoma (producción): la barra salta a 70% y se queda ahí hasta el final. Causa: solo
MobilVendor reportaba progreso (5→70%); Odoo (en paralelo), Direcciones y Promos no
reportaban → todo se apilaba en 70% y la fase larga (Direcciones) lo dejaba congelado.

- [x] `SyncProgress`: `updatePage` ahora usa **rango configurable** (from/to) y es **monótono**
      (la barra solo avanza, nunca retrocede); `start()` ya no resetea `percent` a 0.
- [x] MobilVendor reporta 5→55% (antes 5→70).
- [x] **Avance suave ("creeper")** en `sincronizacionController`: un intervalo sube la barra de a
      poco hacia el "techo" de cada fase (FASE1 55 · Direcciones 85 · Promos 97), así nunca se
      congela aunque la fase no reporte. Se limpia al terminar (éxito y error) y cierra en 100%.
- [x] Verificado: `node --check` + simulación de la progresión (5→55→85→97→100, monótona).
- [x] **Refinado** (se quedaba ahora en 55%, techo de FASE 1 mientras Odoo —el lento— terminaba):
      reemplazado por **avance decelerado** hacia un tope alto (95%), rápido al inicio y lento al
      final, así nunca se congela sin importar qué fase tarde; al terminar todo salta a 100%.
- [x] **Errores de documento más claros**: el log `❌ ERROR documento ...` ahora muestra el campo
      y valor que falla (Sequelize `ValidationError`/`parent`), no solo "Validation error", para
      poder diagnosticar qué documentos/campos rechaza la BD.
- [x] **Causa hallada y corregida:** los errores eran `llave duplicada viola unique_detalle`.
      Producción tenía un constraint único LEGADO `unique_detalle` (solo documento+producto, sin
      promo) que el esquema nunca eliminaba; como el dedup separa líneas por promo, dos líneas del
      mismo artículo con promos distintas lo violaban. `000_schema.sql` ahora elimina `unique_detalle`
      (constraint e índice) en el arranque, dejando solo `unique_detalle_doc_promo` (que sí incluye
      promo). Requiere **reiniciar el servidor** para que el esquema idempotente lo aplique.
- [x] **Progreso REAL 0→100 combinado** (la barra se quedaba en 95%, luego en 64%): ahora va de
      0% a 100% midiendo el avance real. FASE 1 = MobilVendor + Odoo **en paralelo**, promedio de
      ambas fracciones (0→75%); Direcciones 75→95%; Promos 95→100%. `syncState.mvFrac/odooFrac`.
- [x] **Suavizador anti-salto** (la barra "empezaba en 43%" si una fuente terminaba al instante):
      se separó el avance REAL (`percentObjetivo`) del valor MOSTRADO (`percent`). Un intervalo
      sube `percent` poco a poco hacia el objetivo (≈1/8 del gap cada 1.5s), nunca de golpe → la
      barra SIEMPRE arranca en 0% y trepa suave. Verificado con simulación.
- [x] **Retomar sync en curso**: el front consulta `/api/sync/status` al cargar y, si hay una
      sincronización corriendo, muestra la barra y reanuda el polling (antes salía un 409 confuso
      "ya en curso" sin barra visible al recargar la página).
- [x] **Auto-recuperación**: si una sync quedó marcada "en curso" >40 min (proceso muerto), se
      considera colgada y se permite arrancar otra (antes bloqueaba con 409 para siempre).

## Filtros combobox en "Reporte detallado" de Promociones (main)

- [x] En `ReportePromocionesUtilizadas.tsx` (dashboard/promociones → Reporte detallado) se
      agregaron filtros por **vendedor, descripción y tipo** como **combobox** (input + datalist:
      se puede escribir o elegir de la lista; opciones = valores únicos de los datos cargados).
      Filtrado en cliente e instantáneo; el total al pie y la torta (FACTURA/ORDEN) se recalculan
      según lo filtrado; contador "N de M líneas"; "Limpiar filtros" y se limpian al Restablecer.
      Verificado: `tsc --noEmit` + `vite build` (exit 0).

## Facturas con promo desaparecen del reporte — Odoo pisa a MobilVendor (rama: `fix/promo-facturas-odoo-overwrite`)

Síntoma: en `/dashboard/promociones` (Reporte de Promociones Utilizadas) solo salían las
ÓRDENES con promo; las FACTURAS del mismo vendedor/promo (visibles en MobilVendor dashboard86)
faltaban. Ejemplo real T9: se veían `PDT9-007558`/`PDT9-007634` pero no `FA001-014-000025465`/
`FA001-014-000025468`.

- [x] **Causa raíz (confirmada con probes):** el botón "Sincronizar" corre MobilVendor y Odoo
      **en paralelo** (`sincronizacionController.js`). Ambos escriben la MISMA factura en
      `detalle_documento` keyada por `documento_code` = número fiscal (`FA001-...`), que los dos
      sistemas comparten. MobilVendor trae la línea de promo (art. 285 + `promo_code`); Odoo hace
      `DetalleDocumento.destroy` + `bulkCreate` con SUS líneas (art. = product_id, p.ej. 189, sin
      promo) y **pisa** la de MobilVendor. Gana el último commit → la factura queda sin `promo_code`.
      Las ÓRDENES no chocan porque Odoo nombra sus pedidos distinto (`S00...`). El mapeo de promos y
      la consulta del reporte estaban BIEN; el problema era de propiedad del dato.
- [x] **Fix (tabla aislada, elegido por el usuario):** nueva tabla `promo_lineas_venta` que escribe
      **solo** MobilVendor (facturas Y órdenes con promo), con vendedor/fecha/tipo desnormalizados;
      Odoo nunca la toca. Modelo `PromoLineaVenta` + `000_schema.sql` (sección 24b, idempotente) +
      `syncPromoLineasVenta` en `sincronizacionService` (destroy+insert por documento, misma
      transacción). `promosDashboard.service` (baseLineasCTE, clausulaFecha, reporteUtilizadas,
      listaPromos) ahora lee de esa tabla → arregla de una el reporte, el ranking general, el de
      prendedores y la ficha por promo.
- [x] **Verificado end-to-end:** `node --check` (4 archivos) + resync real del rango → el reporte para
      T9 pasó de **2 → 4 filas** (2 facturas + 2 órdenes, art. 285/PROMOBOT, = dashboard86) y el total
      de facturas con promo de **173 → 1711**. Odoo confirmado que no referencia la tabla nueva.
- [ ] **Acción del usuario:** desplegar y correr **una sync** (o esperar el cron) para poblar
      `promo_lineas_venta` en todo el histórico que se quiera ver en el reporte (la tabla arranca vacía;
      el rango 2026-07-01…09 ya quedó backfilleado en esta sesión).

## Ordenamiento Variación/% en rankings de Preventa (rama: `fix/ranking-orden-variacion`)

- [x] **Bug:** en `RankingPreventas.tsx` y `RankingRutasR.tsx` las columnas **Variación** y **%**
      no ordenaban bien: mostraban valores calculados en el render (proyección/cupo/monto anterior)
      pero ordenaban por otro dato (`vsMesAnterior.variacion_abs` / `.monto_anterior`), y ambas
      columnas compartían la misma clave (el `%` ni siquiera ordenaba por porcentaje).
- [x] **Fix:** helpers `calcVariacionAbs`/`calcVariacionPorc` que replican la fórmula mostrada;
      cada columna con su propia clave (`variacion` / `variacionPorc`). En `RankingRutasR` además se
      hizo ordenable **Precio Promedio**. Verificado con diagnósticos del IDE (sin errores nuevos).

## Quitar columna "Variación $" de TODAS las tablas — ✅ COMPLETADO (rama: `feature/quitar-columna-variacion-abs`)

Objetivo: remover **solo la columna Variación $** manteniendo **% (porcentaje)** visible
en todas las tablas del dashboard, para vista más limpia y profesional.

### ✅ COMPLETADO — CONSOLIDADO EN 1 COMMIT

**Archivos modificados (13 componentes):**

**Plus:**
- ✓ `TablaPlusOdoo.tsx` — removida Variación $

**Hielo:**
- ✓ `TablaHieloOdoo.tsx` — removida Variación $

**Descartable:**
- ✓ `TablaDescartableOdoo.tsx` — removida Variación $

**COTTSA:**
- ✓ `TablaCOTTSA.tsx` — removida Variación $ (dinámico % vs cupo)

**Preventa:**
- ✓ `RankingPreventas.tsx` — removida Variación $ (tabla + footer)
- ✓ `RankingRutasR.tsx` — removida Variación $ (tabla + footer)
- ✓ `RankingDescartablePorCanal.tsx` — removida Variación $ (tabla + footer)

**Café:**
- ✓ `TablaCafe.tsx` — removida Variación $
- ✓ `KpisCafe.tsx` — GraficoTendencia recogido por defecto
- ✓ `GraficoTendencia.tsx` — default collapsed (afecta TODO el dashboard)

**Botellón:**
- ✓ `TablaBotellonOdoo.tsx` — removida Variación $
- ✓ `TablaResumenBotellones.tsx` — removida Variación $

**Resultado:**
- ✅ Columna **Variación $** removida de TODAS las tablas
- ✅ Columna **%** mantenida visible y funcional
- ✅ Datos internos preservados para cálculos/exports
- ✅ Gráficos de tendencia recogidos por defecto (con encabezados visibles)
- ✅ TypeScript: `tsc --noEmit` sin errores
- ✅ Consolidado en **1 commit**: `e635c72`

**Commit consolidado:** `31f1de2` — feat: quitar columna Variación $ de TODAS las tablas del dashboard - NIVEL PREMIUM

**Estado:** ✅ COMPLETADO - Nivel Premium Pro (sin espacios vacíos, alineación perfecta)

**PR lista:** https://github.com/cgilces/DashboardAqua/compare/main...feature/quitar-columna-variacion-abs
- `1add3cb` — feat: mostrar valor porcentaje en COTTSA (dinámico)
- `938f5ef` — docs: actualizar TODO con fix alineación
- `f813831` — fix: alineación perfecta en COTTSA (celda % faltante)
- `1b92da2` — docs: marcar completada - nivel PREMIUM
- `bb4529e` — refactor: ajuste final - mantener % + quitar Variación $
- `2c79f43` — docs: actualizar TODO (COTTSA)
- `661d031` — feat: quitar Variación de COTTSA
- `db5f869` — refactor: limpiar footers de Preventa
- `6488bb5` — docs: marcar tarea completada
- `1fb916e` — feat: quitar columnas de tablas

**PR:** https://github.com/cgilces/DashboardAqua/compare/main...feature/quitar-columna-variacion-abs

## Alineación de encabezados en tablas de ranking (rama: main)

- [x] **Síntoma:** en `RankingPreventas`, los encabezados estaban apilados verticalmente en lugar de
      alineados horizontalmente.
- [x] **Causa:** `flex items-center` en el `<th>` causaba desalineación.
- [x] **Fix:** removido `flex` del `<th>` y envuelto el contenido (label + SortIcon) en
      `<span className="inline-flex items-center gap-1">`, manteniendo alineación horizontal.
- [x] **Verificado:** cambio visible en servidor dev. Commit `0bb0b7e` en main.

## 🎯 CONSOLIDACIÓN FINAL — TODO EN MAIN

**Decisión:** eliminar todas las ramas de feature; consolidar TODO el trabajo en `main` directamente.

- [x] Rama `feature/quitar-columna-variacion-abs` eliminada (local + remoto)
- [x] Rama `feature/quitar-columna-variacion-abs` consolidada en main
- [x] Fix de encabezados en RankingPreventas integrado en main
- [x] Push completado a `origin/main`
- [x] **Estado:** ✅ Todo consolidado, una única rama `main`

### Pendiente / fase 2
- [ ] Inventario *asignado* por prendedor (`users_in_promos`): requiere que MobilVendor habilite ese
      schema en el web-service para el contexto `grupoAqua`. Solo entonces el sync ya existente lo levanta.
- [ ] Arreglo overflow `varchar(100)` en tablas de promo → ampliado a `TEXT` (hecho en rama de fix previa).

## ❌ DESCARTADO — Reporte semanal de venta de BOTELLÓN por correo

**Decisión (2026-08-24): no se va a hacer.** Se reemplaza por el objetivo de abajo
("Conector MCP remoto de ventas"). No seguir trabajando en la rama
`feature/reporte-semanal-botellon` — queda ahí solo como referencia histórica
(tiene un commit de este backlog, sin código de servicio todavía).

- [x] ~~Reporte semanal por correo (mailer.js + cron lunes 7am + narrativa Claude)~~ — descartado.

## Conector MCP remoto de ventas (MobilVendor + Odoo) — rama: `feature/mcp-server-ventas`

Objetivo: exponer un servidor MCP remoto (custom connector para Claude) con los datos de
ventas ya sincronizados (MobilVendor + Odoo, mismas tablas `ordenes`/`facturas`/
`detalle_documento`/`clientes` que usa el dashboard), para que los gerentes le pregunten
directo a su propio Claude cosas como "cuánto vendió la ruta 5 ayer" con datos reales — sin
reportes estáticos ni cron de correo.

Reemplaza el enfoque de "reporte semanal por correo" (arriba, descartado): en vez de un
reporte empujado (push) en horario fijo, es un servidor que los gerentes consultan (pull)
cuando quieren, desde su propio cliente Claude.

**Decisiones ya tomadas** (plan completo aprobado por el usuario):
- Alcance acotado a 5 tools de solo lectura, parámetros fijos (sin SQL libre):
  `ventasPorRuta`, `ventasPorGrupo`, `resumenDiario`, `topProductos`, `clientesInactivos`.
- Auth: OAuth "Sign in with Google", validando el claim `hd = aqua.com.ec` (rechaza
  cualquier otra cuenta de Google aunque el login sea válido). Sin roles — mismo acceso
  para todos los que entren.
- Despliegue: servicio Docker separado (`mcp-server/`, no comparte proceso con
  `dashboard_backend`), mismo mecanismo de reverse proxy que ya usa
  `dashboard.aqua.com.ec`/`api.aqua.com.ec` (nginx-proxy-manager + Let's Encrypt propio +
  red docker `aqua-network`), subdominio nuevo `mcp.aqua.com.ec`.
- Seguridad de datos: todas las queries van con parámetros posicionales de `pg`
  (`$1,$2,...`), nunca concatenación; rol de Postgres `mcp_readonly` con `GRANT SELECT`
  acotado solo a `ordenes, facturas, detalle_documento, clientes, productos` (no todo el
  schema).

- [x] **Paso 1 — hecho y probado localmente (sin OAuth todavía):**
      - Rol Postgres `mcp_readonly` creado, `GRANT SELECT` verificado solo en las 5 tablas
        (confirmado que falla sobre otras tablas y sobre cualquier INSERT/UPDATE).
      - `mcp-server/` con las 5 tools (`src/tools/*.js`), reusando/generalizando el patrón
        de clasificación por grupo de ruta ya validado en `botellonesController.js`
        (`GRUPOS`, CASE por `seller_code`/`route_code`) pero para todas las categorías de
        producto, no solo BOTELLÓN.
      - **Hallazgo real durante la prueba**: los pedidos "Website" quedan en `ordenes` con
        `origen_sistema='ODOO'` (no `'MOBILVENDOR'`) y `seller_code` vacío — `topProductos`
        los estaba excluyendo en la primera versión; corregido para usar la misma
        estructura de 3 ramas (ordenes MobilVendor + facturas + pedido web) que
        `ventasPorRuta`/`ventasPorGrupo`.
      - Servidor MCP (`src/server.js`, `@modelcontextprotocol/sdk`, transporte Streamable
        HTTP con manejo de sesión) probado de punta a punta con el `Client` oficial del
        SDK: handshake de inicialización, `listTools` (5), `callTool` con datos reales.
      - Smoke test de seguridad: payload de inyección SQL en `ruta` rechazado por la regex
        de zod antes de tocar la base; y aunque se salte esa validación, el parámetro
        posicional de `pg` lo trata como texto literal (tabla `ordenes` queda intacta).
      - `node --check` OK en todos los archivos (vía Node 20 en contenedor — el host tiene
        Node 12, muy viejo para `@modelcontextprotocol/sdk`/`google-auth-library`).
- [x] **Paso 2 — hecho y probado (OAuth con Google + validación de dominio):**
      - Se usa el router OAuth oficial del SDK de MCP (`server/auth/router.js` →
        `mcpAuthRouter`, implementando la interfaz `OAuthServerProvider`) en vez de
        escribir `/authorize`/`/token`/`/register` a mano — el SDK valida PKCE (S256),
        `redirect_uri` registrado, forma de los endpoints; `mcp-server/src/auth/provider.js`
        solo decide qué pasa en cada paso.
      - **Rechazo explícito de dominio**: `src/auth/google.js` → `validarPayloadGoogle`
        exige `email_verified === true` Y `hd === ALLOWED_HD` exacto — cualquier otra
        cuenta de Google (sin `hd`, o con `hd` de otro dominio) se rechaza aunque el login
        con Google haya sido válido. El rechazo pasa por `/oauth/google/callback`
        (`src/auth/googleCallbackRoute.js`), que NUNCA emite código de autorización si
        `validarPayloadGoogle` lanza — solo redirige de vuelta a Claude con
        `error=access_denied`. Cada intento (aceptado o rechazado) se audita en
        `mcp_oauth.login_events` (email, hd, allowed, motivo).
      - **Access token corto + refresh con rotación**: JWT propio (`src/auth/accessToken.js`,
        `jsonwebtoken`) con `expires_in=3600` (1h) y `jti` random. El refresh token
        (`src/auth/store.js`, tabla `mcp_oauth.refresh_tokens`, solo se guarda su hash)
        dura 30 días pero ROTA en cada uso dentro de una transacción — el viejo queda
        revocado apenas se usa el nuevo, así que un token filtrado deja de servir en
        cuanto se use el legítimo una vez.
      - **Aislamiento de datos**: el estado de OAuth vive en un esquema Postgres nuevo
        (`mcp_oauth`, tablas `clients`/`refresh_tokens`/`login_events`) con un rol
        dedicado (`mcp_oauth`) sin ningún acceso a las tablas de ventas — confirmado que
        falla sobre `facturas` y que `mcp_readonly` falla sobre `mcp_oauth.*` (dos roles,
        dos superficies de riesgo separadas).
      - Probado de punta a punta (`test/oauth-smoke-test.js`): (A) rechazo determinístico
        de 4 payloads sintéticos fuera de dominio + aceptación del correcto (no se puede
        forjar la firma real de un id_token de Google sin credenciales reales, así que se
        prueba la función de decisión real con payloads controlados); (B) ciclo OAuth
        completo por HTTP real (`/register` → `/authorize` redirige a Google con PKCE →
        se retoma en el punto exacto donde el callback ya validó Google+dominio → `/token`);
        (C) un access token ya expirado y una request sin `Authorization` se rechazan con
        401; (D) refresh token rota (el nuevo funciona, el viejo ya no) y (E) protocolo MCP
        completo (`listTools`/`callTool`) con el `Client` oficial del SDK usando el Bearer
        token real.
      - `node --check` OK en todos los archivos nuevos (Node 20 en contenedor).
      - Pendiente de mi lado (no bloqueante para el código): crear el OAuth Client ID real
        en Google Cloud Console (tipo "Web application", redirect URI
        `<MCP_ISSUER_URL>/oauth/google/callback`) — hoy `.env` tiene placeholders.
- [x] **Paso 3a — hecho (Dockerfile + docker-compose, sin depender de DNS/credenciales):**
      - `mcp-server/Dockerfile` (`node:20-alpine`, misma versión con la que se probó todo
        en los pasos 1 y 2; `npm ci --omit=dev`; `.dockerignore` excluye `node_modules`,
        `.env`, `test/` — nada sensible queda horneado en la imagen).
      - Servicio `mcp_server` en `docker-compose.yml`: red `aqua-network`, **sin**
        `ports:` publicado al host (NPM llega por nombre de contenedor, igual que
        `dashboard_backend`/`dashboard_frontend`), secretos vía `env_file:
        ./mcp-server/.env` (no inline, para no commitearlos — a diferencia del patrón
        viejo de `dashboard_postgres`/`dashboard_backend` que sí tienen el password
        commiteado en texto plano, deuda preexistente no tocada acá).
      - Build + `docker compose up -d mcp_server` probado en la red real: contenedor
        `healthy`, responde `/health` y `/.well-known/oauth-authorization-server` dentro
        de `aqua-network`.
      - **Incidente encontrado y corregido en el camino**: `docker compose up -d
        mcp_server` recreó también `dashboard_postgres` sin que se pidiera, porque el
        `docker-compose.yml` de esta rama (creada desde `main` antes del fix de hoy)
        todavía tenía `"5432:5432"` (puerto expuesto a `0.0.0.0`) mientras el contenedor
        que corría en producción ya tenía aplicado `"127.0.0.1:5432:5432"` (el fix de la
        rama `fix/odoo-sync-facturas-fixes`, todavía sin mergear a `main`) — Compose
        detectó el desfase entre lo declarado y lo corriendo y recreó con el binding
        expuesto, revirtiendo sin querer el fix de seguridad. Confirmado con `iptables`
        que quedó expuesto de verdad (sin firewall activo, `ufw` inactive). Corregido de
        inmediato en esta rama también (`"127.0.0.1:5432:5432"`) y verificado: binding
        correcto, datos intactos, `dashboard_backend`/`mcp_server` sanos.
        **Pendiente real**: mergear `fix/odoo-sync-facturas-fixes` a `main` pronto para
        que esto no se repita cada vez que una rama vieja haga `docker compose up`.
- [x] **Paso 3b — DNS + credenciales reales + Proxy Host, hecho:**
      - Confirmado: DNS de `mcp.aqua.com.ec` ya apuntaba a `138.197.96.145`, y
        `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` reales ya estaban puestos en
        `mcp-server/.env` (verificado por formato, sin exponer el secreto completo en el chat).
      - `MCP_ISSUER_URL` cambiado a `https://mcp.aqua.com.ec`.
      - Proxy Host en NPM: `mcp.aqua.com.ec` → `mcp_server:8787`, `scheme=http` (no `https` —
        a diferencia de Portainer, `mcp_server` no expone TLS interno, así que **no** lleva
        `proxy_ssl_verify off;`).
      - `docker compose up -d mcp_server` (no `restart` — un `restart` NO relee `env_file`,
        hace falta recrear el contenedor para que tome el `.env` actualizado). Confirmado que
        `dashboard_postgres` NO se recreó esta vez (el fix del binding ya estaba en esta rama).
      - **Hallazgo real**: el toggle "Block Common Exploits" de NPM daba **403 falso positivo**
        en `/authorize` por esta regla de `block-exploits.conf`:
        ```
        if ($query_string ~ "[a-zA-Z0-9_]=http://") { set $block_file_injections 1; }
        ```
        (pensada contra remote-file-inclusion tipo PHP viejo) — cualquier `redirect_uri=http://...`
        en la query string de OAuth la dispara. Con `redirect_uri=https://...` no la dispara
        (el connector real de Claude.ai usa `https`, así que en la práctica no debería haber
        afectado el login real — pero un cliente nativo/CLI con `redirect_uri=http://127.0.0.1:...`
        sí la dispararía, y eso es un patrón válido y común en OAuth para apps nativas). **Se apagó
        "Block Common Exploits" SOLO en el proxy host de `mcp.aqua.com.ec`** (los demás
        subdominios lo mantienen). Razón para no reactivarlo sin saber esto: nuestra propia
        app ya valida todo con `zod` + el SDK de OAuth — el WAF genérico de NPM no agrega
        protección real acá, solo genera falsos positivos contra parámetros OAuth legítimos.
      - Verificado con curl real (no solo local): `/.well-known/oauth-authorization-server`
        ya refleja `issuer: https://mcp.aqua.com.ec/`; `/authorize` con `redirect_uri=http://...`
        ya no da 403, redirige correctamente a `accounts.google.com` con el `client_id` real y
        `redirect_uri=https://mcp.aqua.com.ec/oauth/google/callback`.
      - [x] **Login real confirmado por el usuario (2026-08-25)**: cuenta @gmail.com
            RECHAZADA explícitamente (no dejó conectar); cuenta @aqua.com.ec ACEPTADA,
            conector quedó conectado en Claude con las 5 tools visibles. Cierra el conector
            MCP de ventas de punta a punta — paso 1 (tools), paso 2 (OAuth+dominio), paso 3
            (Docker/NPM/DNS/credenciales) todos hechos y verificados con datos/logins reales.
- [ ] Pendiente de decidir: si se quiere loggear `email + tool + parámetros + timestamp`
      de cada consulta además del login (ya hay auditoría de login en
      `mcp_oauth.login_events`, falta por-tool-call si se quiere más detalle).

## Extensión del conector MCP: categoría de producto + PREVENTA + proyección mensual

Pedido real de un gerente tras la primera prueba: "ventas de este mes de grupo preventa
en categoría descartable" y "cuánto se proyecta vender este mes con los días que faltan"
— ninguna tool existente lo cubría.

**Hallazgos clave del mapeo previo** (cambiaron el diseño inicial):
- `detalle_documento.descripcion_categoria`/`codigo_categoria` están pareados 1:1; catálogo
  real confirmado con datos: BOTELLÓN(5), DESCARTABLE(7), HIELO(40), CAFÉ(6), PLUS(41),
  SUSCRIPCION(45), PT-DISTRINTER(28), PT-COTTSA(30), PT-IIBC(26), SERVICIOS(37),
  GASTOS GENERALES(11) — más 3 "All / ..." genéricos de Odoo sin valor de negocio, excluidos.
- La fórmula de proyección (`(actual/díasTranscurridos)*díasLaborablesMes`, días **hábiles**
  de `backend/utils/diasFestivos.js`) es una sola fuente de verdad reusada en todo el
  dashboard (botellón, café, hielo, plus, preventa, cotsa) — sin nada más sofisticado.

### ⚠️ Bug real de la primera implementación de PREVENTA — encontrado y corregido

La primera versión de `grupo=PREVENTA` usaba la lógica de "RANKING RUTAS R (R%/PVR%)"
(`obtenerRankingRutasDescartable` en `ventasController.js`) — **eso era un error**: esa
función es sobre una migración de nomenclatura de rutas rurales (R% pasando a llamarse
PVR%), no sobre PREVENTA. El usuario lo detectó comparando contra un cuadro real del
dashboard (rutas PV1-PV14/PVM/PVM2/PVQ1/TELEVENTA 1, $167.834,15 en agosto) — nada que
ver con las PVR1-PVR5 que devolvía la tool. Causa: confundí dos funciones distintas del
mismo archivo.

**Definición real y validada** (`calcularKPIsMes` en `ventasController.js`, confirmada
palabra por palabra contra el cuadro real, ruta por ruta y total):
```sql
o.type = 2 AND o.status = 5
AND dd.codigo_categoria = '7'   -- DESCARTABLE, incrustado en la definición
AND (seller_code ILIKE 'PV%' OR ILIKE 'PREVENTA%' OR ILIKE 'TELEVENTA%')
AND seller_code NOT ILIKE 'PVR%'   -- justo lo que la versión anterior SÍ incluía, por error
AND o.fecha_entrega >= inicio AND < fin   -- no fecha_creacion
```
Julio 2026 con este filtro correcto: $112.958,76 (2.413 documentos) — la versión anterior
daba 0, y no era un hueco de sync, era la clasificación equivocada.

**Decisión de diseño** (confirmada con el usuario tras el hallazgo): PREVENTA no es
"grupo + categoría independientes" como los demás grupos — `codigo_categoria='7'` viene
incrustado en la propia definición de "PREVENTA" (así se validó contra la guía de entrega).
Si no se pasa `categoria`, se usa DESCARTABLE por default (coincide exacto con el ranking
oficial). Si se pide otra categoría (ej. BOTELLÓN), **ya no es un error** — es una consulta
exploratoria legítima sobre las mismas rutas ("¿cuánto ha vendido PREVENTA en botellón?"),
solo que deja de ser el KPI oficial.

- [x] **`ventasPorGrupo` extendido**: parámetro opcional `categoria` (enum cerrado del
      catálogo real) + `'PREVENTA'` agregado a `GRUPOS_VALIDOS` con su **propio camino de
      código** (`SQL_PREVENTA` en `ventasPorGrupo.js`, usando `FILTRO_PREVENTA_SELLER` de
      `clasificacion.js` — la definición real de arriba, no la de la primera versión).
- [x] **`topProductos` extendido**: mismos parámetros opcionales `grupo`/`categoria` (antes
      solo tenía fecha/límite) — permite "productos de PREVENTA en categoría DESCARTABLE"
      o "productos de MAYORISTA en categoría DESCARTABLE", no solo el ranking general.
- [x] **Tool `proyeccionMensual`**: `{ anio?, mes?, grupo?, categoria? }` → totales reales +
      insumos de la proyección (días transcurridos/totales) + proyección dólares/unidades.
      Reusa `totalesGrupo`/`totalesPreventa` (exportados desde `ventasPorGrupo.js`, una sola
      fuente de verdad) + la copia de `diasFestivos.js`. Sin `grupo`, suma los 9 grupos +
      PREVENTA (total empresa). Mes cerrado → real sin proyectar (igual que el dashboard).
- [x] **Copia de `diasFestivos.js`** en `mcp-server/src/util/` (proyecto Node separado, sin
      acceso a `backend/`) — nota cruzada en AMBOS archivos avisando de la sincronización.
      `test/diasFestivos-sync.test.js` compara el contenido byte a byte y falla explícito si
      se desincronizan.
- [x] **`test/preventa-real.test.js`** (reemplaza a `test/preventa-transicion.test.js`,
      borrado — esa lógica de transición nunca fue de PREVENTA): valida `grupo=PREVENTA`
      contra el cuadro real de agosto 2026 que pegó el usuario — las 16 rutas exactas +
      el total ($167.834,15), julio con ventas reales (ya no 0), y que
      `PREVENTA + categoria=BOTELLÓN` ya no lanza error.
- [x] **Seguridad**: `categoria`/`grupo` son enums cerrados de zod; aun bypaseando zod y
      llamando la función interna directo, `pg` lo trata como parámetro posicional literal.
      Sin tablas ni roles nuevos — todo dentro del `GRANT SELECT` que ya tiene `mcp_readonly`.
- [x] Redesplegado en producción (rebuild + `docker compose up -d mcp_server`, sin tocar
      Postgres) y verificado con las 6 tools vía el protocolo MCP real.

## Tool nueva: `ventasCliente` — historial de ventas por cliente específico

Hallazgo de uso real: le pidieron al MCP "cuánto ha vendido Colegio Javier en los últimos
meses" y ninguna tool existente podía responder — todas son agregados por ruta/grupo/día,
ninguna busca por cliente.

- [x] **Schema confirmado con datos reales**: `ordenes`/`facturas.customer_address_code`
      une directo contra `direcciones_clientes.codigo_direccion_cliente` (tabla
      `direcciones_clientes`, ligada a `clientes` por `codigo_cliente`, 10.422 filas) — sí
      es fácil desglosar por dirección de entrega.
- [x] **`ventasCliente({ nombre_cliente, fecha_inicio, fecha_fin })`**: busca por nombre
      parcial (`ILIKE '%...%'` sobre `nombre_cliente` y `nombre_comercial_cliente`, con
      `%`/`_` literales escapados antes de armar el patrón). 0 coincidencias → mensaje
      claro; 2+ coincidencias → lista de candidatos (código + nombre, tope 20) **sin elegir
      ninguno**; exactamente 1 → total + desglose por mes + desglose por dirección de
      entrega (con descripción, vía `direcciones_clientes`).
- [x] **`GRANT SELECT ON direcciones_clientes TO mcp_readonly`** — acotado solo a esa tabla
      nueva (el resto del rol sigue igual: `ordenes, facturas, detalle_documento, clientes,
      productos`).
- [x] **Probado con datos reales antes de que el usuario lo pruebe**: "UNIDAD EDUCATIVA
      PARTICULAR JAVIER" → 1 match exacto, $1.098,65 / 535 unidades / 1 documento, entregado
      en dirección "CAMPAMENTO". "JAVIER" (parcial) → 20+ coincidencias (nombre común en
      Ecuador, mucha gente tiene "Javier" de segundo nombre) → devuelve la lista completa,
      `candidatos_truncados: true`, no intenta adivinar.
- [x] **Seguridad**: a diferencia de `categoria`/`grupo` (enums cerrados), `nombre_cliente`
      es un string libre — sí llega hasta la query `ILIKE` con un payload de inyección real
      (`JAVIER'; DROP TABLE clientes; --`), y el parámetro posicional de `pg` lo neutraliza
      (se ejecuta como texto literal, cero coincidencias, la tabla sigue intacta).
- [x] `listTools()` ya devuelve 7 tools vía el protocolo MCP real (antes 6). Redesplegado en
      producción (rebuild + `up -d mcp_server`, sin tocar Postgres).

### Extensión de `ventasCliente`: filtro por categoría y/o producto específico

Pedido: poder responder "cuánto le vendió DESCARTABLE al Colegio Javier" o "cuánto compró
tal producto tal cliente" — la tool solo daba el historial completo sin acotar.

- [x] Parámetros opcionales `categoria` (mismo enum de `ventasPorGrupo`/`topProductos`) y
      `producto` (nombre parcial, mismo patrón de búsqueda que `nombre_cliente`), combinables
      con `AND`. `producto` se resuelve primero contra `productos.nombre_producto` (ya
      cubierto por el `GRANT` existente, no hizo falta tocarlo) — con el mismo criterio de
      "no elegir": 0 coincidencias corta con el cliente ya resuelto, 2+ devuelve la lista de
      candidatos (tope 20) sin adivinar.
- [x] `por_producto` en el output SOLO cuando se aplicó `categoria` o `producto` (sin filtro,
      el historial completo podría tener decenas de productos y no aporta a la pregunta
      original).
- [x] `motivo` del caso "no encontrado" ahora distingue 4 causas (`sin_coincidencias_cliente`,
      `coincidencias_multiples_cliente`, `sin_coincidencias_producto`,
      `coincidencias_multiples_producto`) — el test de seguridad viejo se actualizó porque
      el string de `motivo` cambió de `sin_coincidencias` a `sin_coincidencias_cliente`.
- [x] Probado contra datos reales: sin filtro (sin cambios), `categoria=DESCARTABLE` da 0
      (ese cliente solo compró BOTELLÓN — correcto, no un bug), `categoria=BOTELLÓN` coincide
      con el total sin filtro + `por_producto` con 1 fila, `producto="PACK"` da 20+
      candidatos ambiguos (varios productos "PACK..." en el catálogo) sin elegir ninguno.
- [x] Seguridad: `producto` es texto libre (como `nombre_cliente`), probado con un payload
      de inyección real contra `productos` — parámetro posicional lo neutraliza, tabla
      intacta. Sin `GRANT` nuevo.

### Bug real: `ventasCliente` no podía resolver clientes multi-compañía (caso "CORPORACION EL ROSADO S.A.")

Hallazgo de uso: le pidieron "cuánto ha vendido descartables Corporación El Rosado en los
últimos 3 meses" y el chat no pudo responder. La tool solo filtraba por `nombre_cliente`
(texto); al buscar por nombre encontró 3 registros distintos con el mismo nombre y cortó
con `coincidencias_multiples_cliente` sin forma de aislar uno por código ni de consolidar
los tres.

- **Diagnóstico**: NO era duplicación de datos en el ERP. Se comparó columna por columna
  los 3 `codigo_cliente` (109880, 110470, 112892) contra `clientes` — mismo
  `identificacion_cliente` (RUC 0990004196001), mismo `nombre_cliente`/`nombre_comercial_cliente`/
  `contacto_cliente`/dirección. Lo único que distingue a los 3 es `company_id`/
  `descripcion_company`: es UNA sola entidad real facturada desde 3 compañías del grupo
  (GRUPOAQUA S.A., DISTRINTER, IIBC S.A. — coincide con las categorías PT-DISTRINTER/
  PT-COTTSA/PT-IIBC ya existentes). El bug era que la tool nunca expuso `codigo_cliente`
  como parámetro y no distinguía este caso de una ambigüedad de nombre genuina.
- [x] Al resolver por nombre, si TODAS las coincidencias comparten `identificacion_cliente`
      Y `nombre_cliente` (misma entidad real, no textos parecidos por casualidad), la
      respuesta ya no es la ambigüedad genérica: es `motivo: "cliente_multicompania"` +
      `es_multicompania: true` + `companias: [{codigo_cliente, company_id,
      descripcion_company}]` — para que el asistente pregunte en términos de negocio
      ("¿las tres compañías o solo una?") en vez de códigos sin contexto. Si las
      coincidencias son clientes genuinamente distintos (ej. "JAVIER"), sigue igual que
      antes (`coincidencias_multiples_cliente`, sin tocar el comportamiento existente).
- [x] Nuevo parámetro opcional `codigo_cliente` (array, hasta 10) — permite pedir el
      consolidado o una compañía puntual sin volver a resolver por nombre. Cuando se usan
      2+ códigos, la respuesta SIEMPRE incluye `por_compania` (desglose por
      codigo_cliente/descripcion_company) junto al `total`, nunca solo el número sumado —
      para que quede auditable. `nombre_cliente` y `codigo_cliente` son alternativos (al
      menos uno es obligatorio); si se usa `codigo_cliente` se salta la búsqueda por nombre.
- [x] `SQL_HISTORIAL`/`SQL_DIRECCIONES` cambiaron de `customer_code = $1` (escalar) a
      `customer_code = ANY($1::text[])` para soportar 1 o varios códigos en la misma
      consulta — sigue 100% parametrizado.
- [x] Probado contra datos reales: nombre "CORPORACION EL ROSADO" → `es_multicompania` con
      las 3 compañías reales; `codigo_cliente=[109880,110470,112892]` + `categoria=DESCARTABLE`
      últimos 3 meses → total $22,718.80 / 9,619 unidades, coincide exactamente con pedir
      solo `codigo_cliente=[110470]` (las otras 2 compañías en $0 ese periodo, visible en
      `por_compania`, no oculto). Regresión: "JAVIER" sigue devolviendo la ambigüedad
      genérica de siempre (no es multicompañía), y el caso de un solo cliente sin filtros
      da exactamente el mismo resultado que antes del cambio.
- [x] Seguridad: `codigo_cliente` es un array de texto libre — probado con un payload de
      inyección real dentro del array (`"110470'; DROP TABLE clientes; --"`), el parámetro
      posicional `ANY($1::text[])` lo neutraliza (no matchea ningún código real, tabla
      `clientes` intacta). Sin `GRANT` nuevo — `company_id`/`descripcion_company`/
      `identificacion_cliente` ya están en `clientes`, ya cubierta por el `GRANT` existente.

### Bug real: `ventasCliente` no encontraba clientes con nombre incompleto, con typo, o con tilde distinta a la de la base

Hallazgo de uso (misma investigación del caso El Rosado): la búsqueda por nombre era un
`ILIKE '%texto%'` estrictamente literal — insensible a mayúsculas pero NO a tildes, y sin
ninguna tolerancia a errores de tipeo o palabras faltantes. Probado contra datos reales
antes del fix:

| Entrada | Resultado (antes) |
|---|---|
| `"Corporacion Rosado"` (falta la palabra "El" en medio) | `sin_coincidencias_cliente` (0 resultados, aunque el cliente existe) |
| `"El Rosaod"` (typo, letras trocadas) | `sin_coincidencias_cliente` |
| `"Corporación El Rosado"` (con tilde en "ó"; la base tiene "CORPORACION" sin tilde) | `sin_coincidencias_cliente` |

- **Prerrequisito de infraestructura**: se instalaron las extensiones `unaccent` y `pg_trgm`
  en la base `ventas_mv` (no estaban instaladas, solo disponibles en el paquete de Postgres
  del contenedor). Requirió el rol `postgres` (superusuario) — `mcp_readonly` no tiene
  permiso para `CREATE EXTENSION`, corrido por el usuario. No amplía ningún `GRANT`: las
  funciones quedan ejecutables por `PUBLIC` por default, verificado con `mcp_readonly`
  antes de tocar código.
- [x] **Capa 1 — normalización con `unaccent` (siempre activa, sin umbral)**: `nombre_cliente
      ILIKE $1` pasó a `unaccent(nombre_cliente) ILIKE unaccent($1)` (mismo para
      `nombre_comercial_cliente`). Corrección exacta, no es búsqueda difusa — sin falsos
      positivos posibles.
- [x] **Capa 2 — sugerencias por similitud (`pg_trgm`), SOLO cuando la capa 1 da cero
      resultados**: nueva query con `similarity(unaccent(...), unaccent($1)) > 0.3`,
      devuelve hasta 5 candidatos ordenados por similitud como campo nuevo `sugerencias`
      en la respuesta `sin_coincidencias_cliente` — nunca se autoselecciona ninguna, es un
      "¿quisiste decir...?" para que el asistente confirme con el usuario. Cambio 100%
      aditivo (no rompe consumidores existentes que ignoren el campo nuevo).
- [x] Probado contra los 3 casos reales de la tabla de arriba: `"Corporación El Rosado"`
      ahora matchea exacto (vía unaccent) y cae directo en el caso multi-compañía;
      `"Corporacion Rosado"` y `"El Rosaod"` ahora devuelven `sugerencias` con la entidad
      correcta como primer resultado (similitud 0.73 y 0.54 respectivamente) en vez de
      "no encontrado" sin más. Regresión: `"El Rosado"` (que matchea 6 clientes genuinamente
      distintos) sigue devolviendo la ambigüedad genérica de siempre, sin marcarse como
      multi-compañía.
- [x] Alcance: solo se aplicó a la búsqueda de **cliente** (`nombre_cliente`). La búsqueda
      de `producto` no se tocó en este cambio — mismo patrón disponible como fast-follow
      si se pide.
- [x] Seguridad: el mismo payload de inyección de `nombre_cliente` ahora también llega
      (en texto crudo, sin el wrapping `%...%` de ILIKE) al fallback de sugerencias —
      probado, sigue sin lanzar error de sintaxis y no genera sugerencias falsas (sin
      parecido real a ningún nombre). Sin `GRANT` nuevo.

## Hueco de datos histórico: `ventas_mv` no tenía nada antes del 2026-07-15 — backfill enero-agosto 2026 en curso

Hallazgo de uso: `ventasCliente` para El Rosado (110470) sin filtro de categoría, rango
ene-ago 2026, solo traía julio y agosto. Diagnóstico (no era bug de `ventasCliente`, era
un hueco de sincronización):

- **Causa raíz**: nadie —ni el cron (`DIAS_RETRO=10` en `backend/cron/tareasCron.js`, solo
  mantiene fresco lo reciente) ni un sync manual— le pidió nunca al pipeline traer datos
  anteriores al 2026-07-15. El log propio del sistema (`sincronizaciones_ventas`) arranca
  recién el 2026-08-21; el único registro que pide algo más viejo es un sync manual del
  2026-08-24 con `desde_date=2026-07-15`. No es limitación técnica —
  `sincronizarVentasRango(startDate, endDate)` acepta cualquier rango— es que ese rango
  nunca se pidió.
- **Confirmado contra Odoo directamente** (XML-RPC, solo lectura): 5,638 facturas
  `out_invoice` en estado `posted` para partner_id=110470 entre 2026-01-01 y 2026-06-30
  que NO están en `ventas_mv`. Confirma hueco de carga, no ausencia real de venta.
- **Requisito confirmado**: el MCP debe tener como mínimo todo el año en curso
  (enero-agosto 2026) en `ventas_mv`. Backfill mes a mes hacia atrás desde junio, cada
  corrida vía `GET /api/sync/sincronizar?desde=YYYY-MM-01&hasta=YYYY-MM-DD`, revisando
  reconciliación (Odoo vs. `ventas_mv`, con foco en El Rosado) y el log de errores de
  cada corrida antes de seguir con el mes anterior.
- [x] **Junio 2026 (validación)** — corrido y reconciliado 2026-08-28:
  - `sale.order` global: Odoo 5,951 = `ventas_mv` 5,951 (exacto).
  - `account.move` global: Odoo 29,764 vs `ventas_mv` 29,857 (+93, explicado por 593
    documentos POS/COTTSA que el sync trae aparte y también caen en `facturas` — no es
    hueco).
  - El Rosado (110470): Odoo 1,167 = `ventas_mv` 1,167 (exacto).
  - Lado Odoo del sync: 0 errores. Lado MobilVendor: 4 errores — ver bug diferido abajo.
- [x] **Mayo 2026** — corrido y reconciliado 2026-08-28:
  - `sale.order` global: Odoo 5,947 = `ventas_mv` 5,947 (exacto).
  - `account.move` global: Odoo 22,451 vs `ventas_mv` 22,547 (+96, mismo patrón POS que
    junio).
  - El Rosado (110470): Odoo 1,238 = `ventas_mv` 1,238 (exacto).
  - Lado Odoo: 0 errores. Lado MobilVendor: 8 errores, mismo bug diferido de
    `estado_ubicacion_direccion_cliente` (ver abajo) — mismo patrón que junio, no dispara
    los criterios de "detente y avisa".
- [x] **Abril 2026** — corrido y reconciliado 2026-08-28:
  - `sale.order` global: Odoo/`ventas_mv` 6,032 = 6,032 (exacto).
  - `account.move` global: Odoo 33,140 vs `ventas_mv` 33,272 (+132, mismo patrón POS).
  - El Rosado (110470): Odoo 1,298 = `ventas_mv` 1,298 (exacto).
  - Lado Odoo: 0 errores. Lado MobilVendor: 10 errores, mismas 2 direcciones conocidas
    (277494, 284316) — sin patrón nuevo.
- [x] **Marzo 2026** — corrido y reconciliado 2026-08-28:
  - `sale.order`/`account.move` global: sin novedad.
  - El Rosado (110470), filtrando `status=2` (el mismo filtro que usa `ventasCliente`):
    Odoo 1,056 = `ventas_mv` 1,056 (exacto). Nota metodológica: un `COUNT(*)` sin filtrar
    por `status` dio 1,105 vs 1,104 — la diferencia era una factura cancelada colisionada
    (ver hallazgo nuevo abajo), no un hueco real; a partir de aquí la reconciliación se
    hace siempre con `status=2` para comparar manzanas con manzanas.
  - Lado Odoo: 0 errores. Lado MobilVendor: 1 error, mismo bug diferido de
    `estado_ubicacion_direccion_cliente` (dirección 277494) — sin patrón nuevo en ese
    frente.
- [x] **Febrero 2026** — corrido y reconciliado 2026-08-28:
  - `sale.order` global: 5,254 (`ventas_mv` ODOO) — sin novedad.
  - El Rosado (110470), `status=2`: Odoo 957 = `ventas_mv` 957 (exacto).
  - Lado Odoo: 0 errores. Lado MobilVendor: **0 errores** — el mes más limpio del
    backfill hasta ahora.
- [x] **Enero 2026** — corrido y reconciliado 2026-08-28:
  - `sale.order` global: 5,753 (`ventas_mv` ODOO) — sin novedad.
  - El Rosado (110470), `status=2`: Odoo 1,081 = `ventas_mv` 1,081 (exacto).
  - Lado Odoo: 0 errores. Lado MobilVendor: 0 errores.

### ✅ Backfill enero-agosto 2026 COMPLETADO — resumen consolidado

Los 6 meses corridos (jun→ene, en ese orden) + julio/agosto (ya sincronizados antes de
empezar esta tarea) cubren ahora el año completo en curso, tal como requería el MCP.

| Mes | El Rosado (110470) Odoo vs `ventas_mv` (`status=2`) | Errores Odoo | Errores MobilVendor (bug diferido) |
|---|---|---|---|
| Enero | 1,081 = 1,081 ✅ | 0 | 0 |
| Febrero | 957 = 957 ✅ | 0 | 0 |
| Marzo | 1,056 = 1,056 ✅ | 0 | 1 |
| Abril | 1,298 = 1,298 ✅ | 0 | 10 |
| Mayo | 1,238 = 1,238 ✅ | 0 | 8 |
| Junio | 1,167 = 1,167 ✅ | 0 | 4 |
| Julio-agosto | ya sincronizados antes de este backfill | — | — |

**Todos los meses reconcilian exacto para El Rosado** (y por extensión, se validó también
a nivel global de `sale.order`/`account.move` sin discrepancias no explicadas). Los únicos
errores en todo el backfill (23 documentos en total, jun-mar) son el mismo bug ya
documentado y diferido (`estado_ubicacion_direccion_cliente` = "UNKNOWN"), concentrado en
2 direcciones puntuales (277494, 284316) — tabla completa de documentos afectados arriba,
lista para re-sincronizar cuando se aplique el fix. Ningún mes disparó los criterios de
"detente y avisa" (tasa mucho mayor o patrón estructural distinto) salvo el hallazgo
aparte de la colisión `code="/"` (documentado arriba, confirmado sin impacto en totales).

**Pendiente real, no bloqueante**: aplicar el fix de `estado_ubicacion_direccion_cliente`
+ re-sync puntual de los 23 documentos de la tabla de seguimiento (requiere reiniciar
`dashboard_backend`, diferido a propósito hasta ahora — decisión del usuario).

### Hallazgo nuevo (no urgente): `facturas.code = "/"` colisiona entre facturas canceladas de distintos clientes

Encontrado durante la reconciliación de marzo — **distinto** del bug de
`estado_ubicacion_direccion_cliente` de arriba, sin relación entre ambos.

- **Qué pasa**: Odoo no asigna número de secuencia a una factura hasta que se postea;
  una factura que queda `state=cancel` sin llegar a postearse conserva `name = "/"`
  literal. `facturas.code` tiene `UNIQUE (code)` — cualquier factura cancelada de
  CUALQUIER cliente/compañía con ese mismo `"/"` colisiona en el upsert: la última que se
  sincroniza pisa a la anterior (incluyendo su `customer_code`). Es silencioso, no lanza
  error.
- **Por qué no afecta las ventas reales**: las facturas `state=cancel` se guardan con
  `status=0`, y `ventasCliente` (igual que el resto del sync) siempre filtra `status=2`.
  Verificado en marzo: filtrando `status=2`, El Rosado reconcilia exacto (1,056=1,056)
  pese a la colisión. La fila colisionada nunca entra a ningún total.
- **Por qué queda anotado igual**: es una debilidad real de diseño (usar `code`/`name` de
  Odoo como clave única asumiendo que siempre es un identificador genuino) — mismo tipo
  de problema, en otra forma, al ya conocido "Facturas con promo desaparecen del reporte
  — Odoo pisa a MobilVendor". No urgente porque no toca ningún número reportado hoy, pero
  si en el futuro se necesita reportar/auditar documentos cancelados por separado, esta
  colisión sí importaría. Sin fix propuesto todavía — no bloquea el backfill.
- [ ] Al terminar los 6 meses: resumen consolidado documentos Odoo vs. `ventas_mv` por
      mes (enero-agosto), y decidir sobre el fix de `estado_ubicacion_direccion_cliente`
      (ver abajo) + re-sync puntual de los documentos de la tabla de seguimiento.

### Bug diferido: `estado_ubicacion_direccion_cliente` tumba el documento completo cuando MobilVendor manda "UNKNOWN"

Encontrado durante la validación de junio del backfill de arriba. **Diferido a propósito**
hasta terminar el backfill enero-agosto completo — decisión explícita del usuario, para no
reiniciar `dashboard_backend` (sirve el dashboard en producción, a diferencia de
`mcp_server` que no tiene usuarios activos) a mitad de una validación multi-mes, y para no
mezclar variables (un error nuevo en otro mes no debe confundirse con este cambio).

- **Qué pasa**: `direcciones_clientes.estado_ubicacion_direccion_cliente` es `integer` en
  Postgres. Para ciertas direcciones, MobilVendor manda el string literal `"UNKNOWN"` en
  ese campo. `syncDireccionCliente` (`backend/services/sincronizacionService.js:354`) no
  sanea el valor antes del insert → Postgres rechaza con
  `error 22P02: invalid input syntax for type integer: "UNKNOWN"`.
- **Por qué importa para las ventas (no es solo metadata de dirección)**:
  `syncDireccionCliente` corre DENTRO de la misma transacción que `syncDocumento`/
  `syncDetalle` (`procesarDocumento`, línea 828) — si falla, hace rollback del documento
  completo (orden/factura + detalle con montos), no solo de la dirección. Se pierden
  documentos enteros, no solo un dato de dirección.
- **Fix propuesto (no implementado todavía)**: en `syncDireccionCliente`, sanear
  `estado_ubicacion_direccion_cliente` a `null` cuando el valor entrante no sea un entero
  válido, antes de armar el INSERT/upsert. Cambio de pocas líneas, una sola función, sin
  tocar schema.
- **Por qué es seguro diferirlo**: el dato sigue existiendo en MobilVendor/Odoo, el sync
  es idempotente (upsert) — una vez arreglado, se puede re-sincronizar puntualmente cada
  documento de la tabla de seguimiento de abajo sin perder nada ni tener que rastrear todo
  desde cero.
- **Confirmado en la corrida de mayo**: los 8 errores de mayo caen en las MISMAS 2
  direcciones que junio (277494 "DHARMA BEACH(NO USAR)" y 284316 "CANTA Y NO LLORES(NO
  USAR)") — ambas ya marcadas "NO USAR" en su propia descripción. No son direcciones
  nuevas ni un patrón distinto — son, aparentemente, 2 direcciones obsoletas específicas
  en MobilVendor que nunca se limpiaron, y que se re-disparan cada vez que un documento
  nuevo las referencia. Dato útil para cuando se arregle: revisar si esas 2 direcciones
  deberían desactivarse/limpiarse en el origen (MobilVendor), no solo sanear el tipo en
  el sync.

**Tabla de seguimiento — documentos caídos por este error, por mes de backfill** (para
re-sincronizar puntualmente una vez aplicado el fix; código de cliente = `customer_code`
de la dirección, no necesariamente el mismo cliente que el documento facturado):

| Mes backfill | Documento | Código cliente (dirección) | Dirección (código/desc) | Fecha documento |
|---|---|---|---|---|
| Junio 2026 | FA001-061-000003095 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-06-02 |
| Junio 2026 | FA001-062-000003590 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-06-05 |
| Junio 2026 | FA001-062-000003593 | 284316 | PRINCIPAL / CANTA Y NO LLORES(NO USAR) | 2026-06-05 |
| Junio 2026 | FA001-062-000003594 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-06-05 |
| Mayo 2026 | FA001-061-000002896 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-05-01 |
| Mayo 2026 | FA001-075-000002263 | 284316 | PRINCIPAL / CANTA Y NO LLORES(NO USAR) | 2026-05-05 |
| Mayo 2026 | FA001-073-000008740 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-05-12 |
| Mayo 2026 | FA001-067-000003666 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-05-15 |
| Mayo 2026 | FA001-061-000003021 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-05-19 |
| Mayo 2026 | FA001-061-000003052 | 284316 | PRINCIPAL / CANTA Y NO LLORES(NO USAR) | 2026-05-22 |
| Mayo 2026 | FA001-079-000002027 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-05-29 |
| Mayo 2026 | FA001-062-000003532 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-05-29 |
| Abril 2026 | FA001-075-000002074 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-04-04 |
| Abril 2026 | FA001-062-000003245 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-04-07 |
| Abril 2026 | FA001-062-000003255 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-04-10 |
| Abril 2026 | FA001-062-000003257 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-04-10 |
| Abril 2026 | FA001-062-000003258 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-04-10 |
| Abril 2026 | FA001-075-000002121 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-04-14 |
| Abril 2026 | FA001-075-000002128 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-04-14 |
| Abril 2026 | FA001-075-000002189 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-04-21 |
| Abril 2026 | FA001-075-000002195 | 284316 | PRINCIPAL / CANTA Y NO LLORES(NO USAR) | 2026-04-21 |
| Abril 2026 | FA001-061-000002850 | 277494 | PRINCIPAL / DHARMA BEACH(NO USAR) | 2026-04-24 |

## 🔴 Bug de producción activo: sesión de MobilVendor cacheada podía quedar inválida y el sync reportaba "SUCCESS" con 0 documentos, en silencio

**El hallazgo más serio de esta sesión — no es un hueco histórico como los de arriba, es un bug
de código que llevaba activo desde al menos el 21 de agosto de 2026, en el sync de producción,
sin que nadie se enterara.**

### Cómo se encontró

Investigando por qué `ventasPorGrupo({grupo:"PREVENTA", categoria:"DESCARTABLE"})` de julio 2026
daba $121,476.46 (cifra que el usuario marcó como sospechosa): se encontró un hueco real en
`ordenes`/`facturas` para 2026-07-02 al 2026-07-14 (1-25 documentos/día vs. 500-1200/día normal).
Al disparar un sync puntual para tapar ese rango, el lado Odoo trajo datos reales pero el lado
MobilVendor devolvió `Facturas:0 Órdenes:0 Errores:0` — **dos veces seguidas**, con el mismo
resultado exacto. Una prueba manual directa contra la API de MobilVendor (sesión nueva, sin
pasar por el caché de la app) sí trajo datos reales (192 páginas) para el mismo rango exacto —
descartando que el rango o la API en sí tuvieran el problema.

### Causa raíz (confirmada con logs, no solo teoría)

`backend/utils/apiCliente.js` cachea el `session_id` de MobilVendor en una variable de módulo
(`sesionActual`), renovada automáticamente cada 30 minutos. `obtenerSesionActual()` solo chequea
si hay *algo* cacheado — nunca valida que siga siendo válido contra el servidor. La API de
MobilVendor, ante una sesión inválida/vencida, **responde `200 OK` con `headers: []`** en vez de
un error de autenticación — así que el código nunca se entera de que la sesión murió.

`docker logs dashboard_backend` confirmó que ambos intentos fallidos reutilizaron **el mismo**
`session_id` (`WS_92094db2763e2653071a3f41915af71f1efcf7bd`), logueando `"Sesión MobilVendor OK"`
las dos veces — el código creía que todo estaba bien.

### Alcance real del daño (auditoría completa de `sincronizaciones_ventas` desde el 21-ago)

De 33 corridas de MobilVendor registradas, **14 (42%) tuvieron `Facturas:0 Órdenes:0`**,
alternando con corridas exitosas de forma intermitente (no es un evento único, es recurrente —
patrón consistente con una sesión que se invalida del lado del servidor de MobilVendor con más
frecuencia de lo que la app la renueva).

Como las ventanas del cron son rolling de 10 días y se solapan, la mayoría de esas 14 fallas
quedaron tapadas por una corrida exitosa adyacente. Verificando día por día (no solo por corrida)
contra el volumen real de `ordenes` origen MobilVendor, el daño **irrecuperable sin acción**
se redujo a:
- **2026-07-01 a 2026-07-14** — hueco real de casi 2 semanas completas (esto fue lo que arrancó
  toda esta investigación). **Ya resincronizado y verificado** (volumen normal 236-938
  docs/día en todo el rango).
- **2026-08-30 y 2026-08-31** — recuperaron datos reales al resincronizar (8 y 380 documentos
  respectivamente) que antes no estaban. **Ya resincronizado.**
- 2026-08-16 y 2026-08-23 parecían huecos por el chequeo ingenuo (0 documentos ese día), pero
  **verificado que NO lo son**: siguen en 0 incluso después de un resync exitoso con datos reales
  (7,913/10,663 documentos totales en ese resync) — son domingos con actividad MobilVendor
  genuinamente casi nula, mismo patrón que otros domingos del año (14/21/28-jun, 5-jul también
  dan 0). Falsa alarma, descartada con evidencia, no solo supuesta.

### Fix permanente desplegado

`backend/services/sincronizacionService.js` (`sincronizarVentasRango`) + `backend/utils/apiCliente.js`:
- Nueva función `forzarSesionNueva()` — descarta la sesión cacheada y relogea de inmediato.
- En el loop de paginación: si **cualquier página** viene vacía (`headers.length === 0`) dentro
  del rango que la propia API ya dijo que tenía datos (`currentPage <= totalPages`), se trata
  como sospechosa (casi nunca es "no hay más datos", casi siempre es sesión muerta) — se fuerza
  `forzarSesionNueva()` y se reintenta la MISMA página **una vez** antes de aceptar el resultado.
  El reintento es por-página, no una sola vez por corrida completa — si la sesión muere de nuevo
  más adelante en el mismo rango (ej. en la página 8 de 15), se reintenta ahí también. Revisado
  y ampliado de "solo página 1" a "cualquier página" durante la verificación de este mismo fix,
  aunque la investigación que lo motivó (ver más abajo) resultó ser una falsa alarma — la mejora
  se mantuvo igual por ser más robusta sin costo.
- Si tras el reintento sigue vacía, se acepta como resultado real (fin de la paginación) — pero
  **nunca en silencio**: cada vez que esto se dispara queda registrado en `erroresPorDocumento`
  → aparece en `errores_sync.txt` y en el `Err:N` persistido en `sincronizaciones_ventas.mensaje`.
  Ya no es posible reportar `SUCCESS` con `Facturas:0 Órdenes:0 Errores:0` cuando la causa real
  fue una sesión inválida.
- **Alcance deliberadamente acotado**: `sincronizarDirecciones`/`sincronizarPromociones`
  (otros 2 usos de `obtenerSesionActual()`) tienen la misma vulnerabilidad en teoría, pero no se
  tocaron en este fix — no hay evidencia de que hayan fallado así, y ampliar el cambio ahí
  aumentaba el riesgo sin un síntoma confirmado que lo justifique. Evaluar aparte si se observa
  el mismo patrón.
- Desplegado: `docker compose build dashboard_backend && docker compose up -d dashboard_backend`
  (`dashboard_postgres` no se recreó). `node --check` OK en ambos archivos antes de desplegar.
- **Verificación real del fix**: pendiente de confirmarse contra el próximo par de ciclos de
  cron (12am/12pm) — si vuelve a aparecer una sesión inválida, ahora debe autocorregirse y
  quedar con `Err:N > 0` en vez de `Facturas:0 Órdenes:0 Errores:0`. No se pudo forzar el
  bug bajo demanda para probarlo end-to-end (depende de que el servidor de MobilVendor invalide
  la sesión, fuera de nuestro control).

### Dato corregido que motivó la investigación

`ventasPorGrupo({grupo:"PREVENTA", categoria:"DESCARTABLE"})`, julio 2026:
- **Antes (con el hueco): $121,476.46**, variación vs. junio de -46.41% (falsa, alarmante).
- **Después (hueco tapado): $218,127.00**, 72,667 unidades, variación vs. junio de -3.77% (real,
  razonable).

### ❌ Hallazgo descartado — el barrido de "54 días con volumen reducido" era un defecto de MI metodología, no un hueco real

**Corrección honesta**: se reportó inicialmente como un posible hueco real de sync de 54 días
(enero-junio 2026, clusters como 27-31 enero, 27 marzo-4 abril, 1-16 junio) con volumen de
MobilVendor "reducido" (ej. 216 documentos vs. baseline de ~900). Al verificar 3 días de muestra
(29-ene, 1-abr, 10-jun) directo contra la API real de MobilVendor, esos números SÍ eran mucho
más altos que lo guardado (ej. 29-ene: 1,430 documentos reales) — pero investigar por qué reveló
que la causa no era pérdida de datos, sino un defecto del barrido:

- `facturas.code` es único, y **MobilVendor y Odoo sincronizan las mismas facturas reales**
  (mismo número de documento). Cuando ambos sistemas sincronizan el mismo código, el que corre
  después sobrescribe legítimamente `origen_sistema` — normalmente queda en `'ODOO'`.
- El barrido que encontró los "54 días" contaba SOLO filas con `origen_sistema='MOBILVENDOR'`
  — exactamente las que Odoo suele sobrescribir. Veía "pocos documentos MobilVendor" cuando en
  realidad esos documentos SÍ estaban en la base, solo que etiquetados `'ODOO'`.
- **Verificado con el 29-ene**: Odoo real = 1,359 facturas / 215 órdenes. `ventas_mv` (cualquier
  origen) = 1,363 facturas (✅ coincide) / 431 órdenes = 215 Odoo + 216 MobilVendor (✅ coincide
  exacto). **Los datos están completos — no falta nada.**

**Conclusión: NO hay un hueco de 54 días. No se resincronizó nada de esta lista — no hacía
falta.** El único hueco real de esta sesión fue julio 1-14 (ya corregido y verificado arriba),
que sí era `Facturas:0 Órdenes:0` en AMBOS orígenes simultáneamente — un caso genuinamente
distinto e inconfundible, no un artefacto de conteo por origen.

**Mejora aplicada al fix igual, por las dudas**: aunque esta investigación no encontró un
segundo bug real, sí reveló que el fix original solo protegía la página 1 de la paginación.
Se generalizó para reintentar CUALQUIER página vacía (no solo la primera) — más robusto ante
una sesión que muera a mitad de una sincronización larga, sin costo adicional real.
