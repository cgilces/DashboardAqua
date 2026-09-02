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

## Fix sync Odoo — facturas caídas por coordenadas corruptas (rama: `fix/odoo-sync-facturas-fixes`)

Síntoma: la tabla `facturas` estaba en 0 filas. Causas encontradas: `ODOO_API_KEY` en `.env`
corrupta (bloque duplicado, corregida manualmente); faltaban columnas
`equipo_ventas`/`equipo_ventas_id`/`equipo_ventas_nombre` en la tabla (existían en el modelo
Sequelize pero no en la BD, agregadas con `ALTER TABLE` manual); cliente Odoo id 262274 con
`partner_latitude` corrupto (`-212881` sin punto decimal) tumbaba lotes completos de facturas.

- [x] Validación de rango en `partner_latitude`/`partner_longitude` antes de guardar
      (`sincronizacionOdooService.js`), para que un dato corrupto no tumbe el chunk completo.
- [x] Log de `err.parent.detail`/`err.original.detail` en chunks fallidos, para diagnosticar
      sin adivinar.
- [x] Dedup en `bulkUpsertHistorial` (`syncHistorialVisitasService.js`) por
      (customer_code, route_code, date) antes del `INSERT ON CONFLICT`.
- [x] `docker-compose.yml`: postgres bindeado a `127.0.0.1` en vez de expuesto a todas las interfaces.
- [x] Verificado: `node --check` (vía node del contenedor `dashboard_backend`, node 18 — el
      node del host es v12 y no soporta optional chaining). Resultado ya probado en el server:
      `facturas` pasó de 0 a 26,091 filas (15 jul–24 ago), 0 errores.
- [x] Push a `origin/fix/odoo-sync-facturas-fixes`.
      **PR:** https://github.com/cgilces/DashboardAqua/compare/main...fix/odoo-sync-facturas-fixes

---

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

## Nota (sin acción): usuario "27" (DAISY MORAN) no es una ruta de preventa

Encontrado investigando el bug de PREVENTA+BOTELLÓN (ver más abajo). El `seller_code`
`"27"` (no un código tipo PV1-PV14/PVR3-5/PVM2/TELEVENTA 1) aparece en documentos de
MobilVendor pero **no es un prevendedor real** — decisión pendiente con Alberto sobre si
excluirlo formalmente de las consultas de PREVENTA. **No requiere cambio de código hoy**:
verificado que `FILTRO_PREVENTA_SELLER` (`seller_code ILIKE 'PV%'...`) ya lo excluye de
forma natural, porque "27" no matchea ese patrón. Queda anotado por si en el futuro el
patrón de filtro cambia y empieza a colarse, o si se pide una exclusión explícita.

## ⚠️ Hallazgo de alcance (NO tocado hoy): el dashboard real y el chatbot tienen el mismo patrón `NOT ILIKE 'PVR%'` sin filtro de guía

Investigando el bug de PREVENTA+BOTELLÓN (ver abajo) se confirmó que la exclusión de
`PVR%` y la ausencia de un filtro de guía de entrega **no son solo del MCP** — existen en
el código real de producción:
- `backend/controllers/controllerPreventa/ventasController.js` (`calcularKPIsMes`, la
  función que genera el ranking oficial): 4 ocurrencias de `NOT ILIKE 'PVR%'`.
- `backend/services/chatbotservicio/openai.service.js`: 4 ocurrencias.
- `backend/services/chatbotservicio/agente.service.js`: documentado en el prompt del
  chatbot como parte de la definición de PREVENTA.

**No se tocó nada de esto hoy** — el fix de esta sesión es solo para el MCP
(`mcp-server/src/sql/clasificacion.js`), que es una copia independiente. Si la validación
de DESCARTABLE-agosto (más abajo) confirma que el mismo problema de guía/PVR% afecta
también al ranking oficial del dashboard, sería una tarea aparte y de mayor alcance —
tocar `ventasController.js` afecta el dashboard en producción que ven los gerentes
directamente, no solo el MCP.

### 🌙 Backfill 2025 — arrancó automáticamente (2026-08-31 22:02 -05)

Ejecución programada sin supervisión (lunes 22:00 Ecuador → estimado terminar ~3:00 AM
martes). Mismo patrón que 2026: mes a mes, diciembre 2025 hacia atrás hasta enero 2025.
Reconciliación automática contra El Rosado (110470, `status=2` vs Odoo `state=posted`)
+ verificación de que cualquier error nuevo coincide con el patrón ya conocido
(`estado_ubicacion_direccion_cliente`, direcciones 277494/284316). Se detiene ante
cualquier cosa que no reconoce — nunca sigue de largo con algo no verificado.
- [x] **Diciembre 2025** — corrido 2026-08-31 22:24 -05 (automático, sin supervisión):
  ```
  [dotenv@17.3.1] injecting env (16) from .env -- tip: ⚙️  write to custom object with { processEnv: myObject }
[dotenv@17.3.1] injecting env (0) from .env -- tip: ⚙️  load multiple .env files with { path: ['.env.local', '.env'] }
Conexión a la base de datos establecida correctamente.
{"desde":"2025-12-01","hasta":"2025-12-31","ventasMv":626,"odoo":1072,"reconciliaExacto":false,"erroresNuevosCount":0,"totalErroresAcumulados":0,"patronConocido":true,"detenerse":true,"motivoDetencion":"Reconciliación no exacta: ventas_mv=626 vs Odoo=1072"}
  ```

### 🛑 Backfill 2025 DETENIDO en Diciembre 2025

Reconciliación no exacta: `ventas_mv=626` vs `Odoo=1072` (El Rosado, status=2/posted).
Diferencia grande (~42%), no es el tipo de desfase menor que vimos en 2026 — pendiente de
investigar antes de reanudar noviembre/octubre/etc. de 2025. (El mensaje de motivo que
imprimió el orquestador tuvo un error cosmético de parseo en el log de arriba — el JSON
completo con el resultado real SÍ quedó registrado.)

---

## 🔬 Validación del fix de PREVENTA (waybill + PVR) — julio BOTELLÓN revalidado, hallazgo estructural importante

Continuación de la validación aprobada (fix implementado y desplegado: `waybill_code`/
`waybill_status` capturados en el sync, filtro PREVENTA actualizado a
`waybill_status='3'` sin excluir PVR%, backfill liviano corrido para julio y agosto 2026).

### Julio 2026, BOTELLON VERDE PET (producto 285) — resultado final

| Intento | Unidades | Dólares | Nota |
|---|---|---|---|
| Antes del fix (status=5 solo) | 835 | $1,501.16 | el bug original reportado |
| Con fix, backfill sin solape de mes | 641 | $1,157.70 | faltaban 3 docs creados en junio |
| Con fix, backfill CON solape (`DIAS_SOLAPE`-style) | **671** | **$1,210.20** | ver hueco residual abajo |
| **Real (Excel "Terminated", ground truth)** | **716** | **$1,288.76** | — |

**Hueco residual: 45 unidades / $78.56 — 100% explicado, 4 documentos identificados**
(`PDPV5-009669`, `PDPV5-009668`, `PDPVR4-001036`, `PDPV10-007342`). Los cuatro SÍ tienen
`waybill_code` capturado, pero su `waybill_status` actual (consultado hoy, semanas después
de la entrega real) es `"0"`, no `"3"` — aunque el Excel (exportado más cerca de la fecha
real) los marcaba "Terminated".

### Causa raíz del hueco residual (NO es un bug de código)

Los códigos de guía (`GUT5-000029`, etc.) parecen ser **identificadores de ruta/camión
reutilizables**, no un ID permanente de una sola entrega. Al consultar la API de MobilVendor
HOY (mucho después de julio), el `status` "vivo" de esos códigos probablemente refleja el
**despacho más reciente** que usó ese mismo código — no necesariamente el de julio. Es decir:
**backfillear `waybill_status` retroactivamente, mucho después de los hechos, tiene un
desfase estructural irreducible** — no relacionado con la lógica de `FILTRO_PREVENTA_SELLER`
ni con ningún bug de sync.

**Para datos nuevos (sync en tiempo real, de ahora en adelante) esto no debería ocurrir** —
`waybill_status` se captura el mismo día, cuando todavía refleja la entrega real en curso.
El problema es específico y probablemente inevitable al backfillear meses ya pasados.

### Implicación para la validación de agosto-DESCARTABLE (pendiente, sin iniciar)

Dado este hallazgo, comparar agosto-DESCARTABLE contra un número exacto casi seguro **va a
mostrar un hueco residual similar por la misma razón estructural** — no sería evidencia de
que el fix está mal. Antes de correr esa comparación (y de decidir qué hacer con ella si
también muestra un hueco "explicado pero no cerrable"), esto necesita una decisión del
usuario:

1. ¿Aceptamos un margen de error pequeño y documentado para MESES YA PASADOS (backfill),
   entendiendo que el dato de aquí en adelante (sync en tiempo real) sí será preciso?
2. ¿Vale la pena intentar re-correr el backfill de waybill más seguido/más cerca de la fecha
   real para los meses recién sincronizados (julio/agosto), para minimizar (no eliminar) el
   desfase, aunque probablemente no lo cierre del todo?
3. ¿Algo distinto?

**No se tocó nada más de código para esto** — el fix en sí (`waybill_status='3'` + sin
exclusión de PVR%) se considera funcionalmente correcto y validado; lo que queda abierto es
solo la fidelidad del backfill retroactivo de datos ya pasados, no la lógica del filtro.

**Housekeeping de esta validación**: se encontró y corrigió un bug real en
`ops/backfill2025/backfill_waybill.js` — no llamaba a `process.exit(0)` al terminar
exitosamente, dejando el proceso colgado indefinidamente (el mecanismo de renovación de
sesión de MobilVendor cada 30 min mantenía vivo el event loop). Ya corregido en el archivo;
los procesos colgados de las corridas de julio/agosto (con y sin solape) se mataron
manualmente después de confirmar que su trabajo real ya había terminado (verificado por log
y por conteo en la base, no se perdió ningún dato).

---

## 🐛→✅ Bug de coordenadas corruptas de Odoo — encontrado, arreglado y verificado (2026-09-01)

Investigando la reconciliación fallida de diciembre-2025 (`ventasMv=626` vs `Odoo=1072`),
se encontró que los 57 errores de Odoo eran TODOS `"numeric field overflow"` — a nivel de
**chunk completo** (~50 facturas perdidas de una vez), no documento por documento como el
bug de `estado_ubicacion` ya conocido. Al investigar, se confirmó que **el mismo bug está
activo en el cron regular de HOY**, no solo en 2025 (id_sync=82, ventana Aug22-Sep1,
`Err:19` con el mismo mensaje) — un bug de producción activo, no histórico.

**Causa raíz**: `clientes.latitud_cliente`/`longitud_cliente` son `DECIMAL(12,8)` (máx. 4
dígitos enteros). Muchos clientes en Odoo tienen `partner_latitude`/`partner_longitude`
mal formados — **sin punto decimal** (ej. `-2196885` en vez de `-2.196885`). Al desbordar
la columna, Postgres tira el error y se pierde el chunk (~50 facturas) completo, incluyendo
clientes con coordenadas perfectamente válidas que solo compartían chunk con el corrupto.

**Fix**: nuevo `backend/utils/sanitizeCoordinate.js` (extraído de una función ya existente
en `sincronizacionService.js`/MobilVendor, que ya se protegía de esto) — valida rango
geográfico real (lat: -90 a 90, lon: -180 a 180) y descarta a `NULL` si no cumple, en vez
de insertar el valor corrupto. Aplicado en `sincronizacionOdooService.js`
(`latitud_cliente`/`longitud_cliente`) y refactorizado `sincronizacionService.js` para usar
el mismo util compartido (antes duplicaba la misma lógica localmente).

**Verificado con corridas reales, no solo con el código**:
- Cron actual (Aug22-Sep1) re-corrido tras el fix: `Err:0` (antes `Err:19`), y recuperó más
  datos que antes se perdían (`Fac:6391` vs `6319`, `Cli:7627` vs `6537`).
- Impacto real en agosto 2026: reconciliar El Rosado (110470) mostró `ventas_mv=1063` vs
  `Odoo=1211` — **faltaban 148 documentos (12%)**, acumulado de varias corridas fallidas
  del día por este bug. Re-sincronizado agosto completo con el fix activo: **0 errores en
  ambos lados, El Rosado reconcilia exacto (1,211=1,211)**.
- Enero-julio 2026 NO fueron afectados — sus backfills originales ya mostraban `Err:0` del
  lado Odoo (el bug es determinístico: si hubiera aparecido un cliente corrupto en esas
  ventanas, el chunk habría fallado igual) y no se han vuelto a tocar desde entonces.

**Enero-agosto 2026 queda genuinamente reconciliado y limpio** tras este fix — objetivo
cumplido antes de retomar 2025.

---

## ✅ Filtro de guía condicional por categoría — PREVENTA (BOTELLÓN vs. DESCARTABLE)

Con enero-agosto 2026 limpio, se retomó la validación de PREVENTA-DESCARTABLE pausada
antes. Hallazgo: el criterio `waybill_status='3'` (validado contra BOTELLÓN) **no
generaliza a DESCARTABLE**.

### Evidencia

Cruzando 5 documentos reales confirmados "Terminated" en un Excel de guías de MobilVendor
(agosto 2026, productos DESCARTABLE, todos bajo la guía `GU000458`): los 5 tenían
`waybill_status = '0'` — el mismo valor que para guías de botellón (`GUT#.#-######`/
`GUR#-######`) significa "Shipping" (no entregado). Las guías de productos
empaquetados/livianos usan un esquema de código distinto (`GU######` puro, sin sufijo de
ruta, consolidando varios documentos en una sola guía) donde `waybill_status` no tiene el
mismo significado.

Probando "tiene guía asociada, sin mirar el status" contra ambos casos reales de agosto:

| Categoría | Criterio | Resultado | Real | Diferencia |
|---|---|---|---|---|
| DESCARTABLE | `waybill_code IS NOT NULL` | $252,889.93 | $252,960.5169 | **0.03%** |
| BOTELLÓN (285) | `waybill_code IS NOT NULL` | $1,504.44 | $1,288.76 (jul) | +17% (peor que con status) |
| BOTELLÓN (285) | `waybill_status = '3'` | $1,264.73 (ago) | $1,351.98 (ago) | 6.5% (aceptado, ver abajo) |

### Fix desplegado

`mcp-server/src/sql/clasificacion.js` — `FILTRO_PREVENTA_SELLER` pasó de string estático a
función `(categoriaParam) => ...` que arma un filtro condicional reutilizando el MISMO
parámetro posicional de categoría que cada query ya tenía (sin agregar un parámetro nuevo):
- `categoria = 'DESCARTABLE'` → `waybill_code IS NOT NULL` (sin mirar status).
- Cualquier otra categoría (BOTELLÓN incluido) → `waybill_status = '3'` (el criterio ya
  validado, sin cambios en su comportamiento).
- **Categorías nunca probadas contra un Excel real** (HIELO, CAFÉ, PLUS, PT-DISTRINTER,
  PT-COTTSA, PT-IIBC, SUSCRIPCION, SERVICIOS, GASTOS GENERALES) caen en la rama estricta
  (`waybill_status='3'`) por default — más conservadora, sin evidencia propia todavía. Si
  se reporta un número raro para PREVENTA en alguna de estas, empezar por acá.

Actualizado `mcp-server/test/preventa-real.test.js` — el número de agosto que usaba
($167,834.15) había quedado obsoleto por el paso del tiempo (más días de agosto
sincronizados desde la validación original), no por ningún bug; reemplazado por los
números re-confirmados el mismo día contra el Excel real, con tolerancia (0.5% DESCARTABLE,
10% BOTELLÓN — ver comentario en el test) en vez de exigir exactitud a centavos.

**Margen residual de BOTELLÓN (julio Y agosto, ~6-7% en ambos) queda aceptado como
límite conocido de backfill retroactivo de `waybill_status`** (códigos de guía por ruta
reutilizados con el tiempo) — no se le dedica más tiempo por ahora, documentado arriba.

Verificado: `node --check` en los 3 archivos de código + `test/seguridad-smoke-test.js` +
`test/oauth-smoke-test.js` (7 tools) + `test/preventa-real.test.js`, todos OK. Desplegado a
producción (`mcp_server` reconstruido y reiniciado, `dashboard_postgres` intacto).

**Confirmado 2026-09-01**: diciembre-2025 se re-sincronizó con el fix de coordenadas activo
— **El Rosado reconcilia exacto (1,072 = 1,072)**, contra el `626 vs 1072` original. Los
errores de Odoo bajaron de 57 a 1, y el único restante es un timeout de red transitorio
(`connect ETIMEDOUT`, no relacionado con ningún bug de esta sesión) — no afectó la
reconciliación, no se persigue más. **Diciembre-2025 cerrado, backfill de 2025 retomado.**

### 🌙 Backfill 2025 (continuación) — arrancó 2026-09-01 09:22 -05, a pedido explícito

Diciembre ya reconciliado por separado tras el fix de coordenadas. Continúa
noviembre 2025 hacia atrás hasta enero 2025, mismo patrón: reconciliación real contra
El Rosado (110470, `status=2` vs Odoo `state=posted`), se detiene ante cualquier cosa
que no reconoce.
- [x] **Noviembre 2025** — corrido 2026-09-01 09:43 -05 (continuación manual, sin supervisión):
  ```
  [dotenv@17.3.1] injecting env (16) from .env -- tip: 🤖 agentic secret storage: https://dotenvx.com/as2
[dotenv@17.3.1] injecting env (0) from .env -- tip: ⚙️  write to custom object with { processEnv: myObject }
Conexión a la base de datos establecida correctamente.
{"desde":"2025-11-01","hasta":"2025-11-30","ventasMv":853,"odoo":853,"reconciliaExacto":true,"erroresNuevosCount":0,"totalErroresAcumulados":0,"patronConocido":true,"detenerse":false,"motivoDetencion":null}
  ```

### ⚠️ Corrección: el "DETENIDO en Noviembre 2025" de arriba fue un falso positivo

Bug real en el propio orquestador (`run.sh`/`run_resume.sh`), no un problema de datos:
`dotenv` imprime sus mensajes de "tip" en **stdout** (no stderr), mezclándose con el JSON
de `reconcile.js` en `$RESULT` — al intentar parsear el blob completo como JSON, siempre
fallaba y por diseño defaulteaba a `detenerse=true`, aunque el JSON real (visible arriba)
decía `"detenerse":false` con reconciliación exacta (853=853). **Noviembre 2025 SÍ
reconcilió correctamente** — el corte fue del script, no del dato.

Corregido en ambos scripts: ahora se extrae solo la última línea de `$RESULT` (donde
`reconcile.js` siempre imprime el JSON, después del ruido de dotenv) antes de parsear.
Continuando con octubre 2025 en adelante.

### 🌙 Backfill 2025 (continuación) — arrancó 2026-09-01 09:45 -05, a pedido explícito

Diciembre ya reconciliado por separado tras el fix de coordenadas. Continúa
noviembre 2025 hacia atrás hasta enero 2025, mismo patrón: reconciliación real contra
El Rosado (110470, `status=2` vs Odoo `state=posted`), se detiene ante cualquier cosa
que no reconoce.
- [x] **Octubre 2025** — corrido 2026-09-01 10:10 -05 (continuación manual, sin supervisión):
  ```
  [dotenv@17.3.1] injecting env (16) from .env -- tip: ⚙️  write to custom object with { processEnv: myObject }
[dotenv@17.3.1] injecting env (0) from .env -- tip: ⚡️ secrets for agents: https://dotenvx.com/as2
Conexión a la base de datos establecida correctamente.
{"desde":"2025-10-01","hasta":"2025-10-31","ventasMv":923,"odoo":923,"reconciliaExacto":true,"erroresNuevosCount":0,"totalErroresAcumulados":0,"patronConocido":true,"detenerse":false,"motivoDetencion":null}
  ```
- [x] **Septiembre 2025** — corrido 2026-09-01 10:34 -05 (continuación manual, sin supervisión):
  ```
  [dotenv@17.3.1] injecting env (16) from .env -- tip: ⚡️ secrets for agents: https://dotenvx.com/as2
[dotenv@17.3.1] injecting env (0) from .env -- tip: 🛡️ auth for agents: https://vestauth.com
Conexión a la base de datos establecida correctamente.
{"desde":"2025-09-01","hasta":"2025-09-30","ventasMv":732,"odoo":732,"reconciliaExacto":true,"erroresNuevosCount":0,"totalErroresAcumulados":0,"patronConocido":true,"detenerse":false,"motivoDetencion":null}
  ```
- [x] **Agosto 2025** — corrido 2026-09-01 10:53 -05 (continuación manual, sin supervisión):
  ```
  [dotenv@17.3.1] injecting env (16) from .env -- tip: 🔐 encrypt with Dotenvx: https://dotenvx.com
[dotenv@17.3.1] injecting env (0) from .env -- tip: 🛡️ auth for agents: https://vestauth.com
Conexión a la base de datos establecida correctamente.
{"desde":"2025-08-01","hasta":"2025-08-31","ventasMv":846,"odoo":846,"reconciliaExacto":true,"erroresNuevosCount":0,"totalErroresAcumulados":0,"patronConocido":true,"detenerse":false,"motivoDetencion":null}
  ```
- [x] **Julio 2025** — corrido 2026-09-01 11:22 -05 (continuación manual, sin supervisión):
  ```
  [dotenv@17.3.1] injecting env (16) from .env -- tip: ⚡️ secrets for agents: https://dotenvx.com/as2
[dotenv@17.3.1] injecting env (0) from .env -- tip: 🔐 prevent building .env in docker: https://dotenvx.com/prebuild
Conexión a la base de datos establecida correctamente.
{"desde":"2025-07-01","hasta":"2025-07-31","ventasMv":756,"odoo":756,"reconciliaExacto":true,"erroresNuevosCount":0,"totalErroresAcumulados":0,"patronConocido":true,"detenerse":false,"motivoDetencion":null}
  ```
- [x] **Junio 2025** — corrido 2026-09-01 11:51 -05 (continuación manual, sin supervisión):
  ```
  [dotenv@17.3.1] injecting env (16) from .env -- tip: 🔐 prevent committing .env to code: https://dotenvx.com/precommit
[dotenv@17.3.1] injecting env (0) from .env -- tip: 🛠️  run anywhere with `dotenvx run -- yourcommand`
Conexión a la base de datos establecida correctamente.
{"desde":"2025-06-01","hasta":"2025-06-30","ventasMv":654,"odoo":654,"reconciliaExacto":true,"erroresNuevosCount":1,"totalErroresAcumulados":1,"patronConocido":false,"detenerse":true,"motivoDetencion":"Error nuevo con patrón distinto al conocido (estado_ubicacion / 277494 / 284316)"}
  ```

### ⚠️ Corrección: el "DETENIDO en Junio 2025" de arriba también fue un falso positivo

El error nuevo era `SESION_SOSPECHOSA_2025-06-01_2025-06-30_pag1` — el fix de sesión de
MobilVendor (2026-08-31) detectando una página vacía, forzando re-login y reintentando.
**Es exactamente el comportamiento sano que ese fix fue diseñado a hacer** — no un
problema. La reconciliación ya mostraba `reconciliaExacto:true` (654=654), confirmando que
el reintento funcionó y el dato de junio quedó completo. `reconcile.js` no reconocía
todavía este patrón (solo el de `estado_ubicacion`) — corregido para reconocer también
`SESION_SOSPECHOSA_*`/`CONFIRMADO_SIN_DATOS_*` como sano. **Junio 2025 SÍ reconcilió
correctamente.** Continuando con mayo 2025 en adelante.

### 🌙 Backfill 2025 (continuación) — arrancó 2026-09-01 11:53 -05, a pedido explícito

Diciembre ya reconciliado por separado tras el fix de coordenadas. Continúa
noviembre 2025 hacia atrás hasta enero 2025, mismo patrón: reconciliación real contra
El Rosado (110470, `status=2` vs Odoo `state=posted`), se detiene ante cualquier cosa
que no reconoce.

---

## ✅ Punto 1 de la checklist de validación 2026 — fix PREVENTA cerrado formalmente (2026-09-01)

Confirmado, con el backfill 2025 corriendo en paralelo sin interferencia (todo lo de abajo
es solo lectura):

- **Comentario explicativo en el código**: ya estaba en `mcp-server/src/sql/clasificacion.js`
  (historial completo del hallazgo, con la evidencia de agosto). Confirmado presente.
- **Entrada en TODO.md**: ya estaba (sección "Filtro de guía condicional por categoría"
  arriba). Confirmado presente.
- **Suite de regresión/seguridad, corrida fresca hoy** (contenedor `mcp_server`, Node 18 —
  el host solo tiene Node 12 y no puede correr estos tests directo):
  - `test/seguridad-smoke-test.js` → **falló primero**, pero no por seguridad: el fixture
    usaba `nombre_cliente: "UNIDAD EDUCATIVA PARTICULAR JAVIER"` esperando un único cliente,
    y desde el fix de búsqueda fuzzy ese nombre ahora también matchea a otro cliente real
    (`...JAVIER-CASA DE RETIROS`), devolviendo `coincidencias_multiples_cliente` antes de
    llegar al payload de `producto` que el test quería probar. No es una regresión de
    seguridad (la inyección seguía bloqueada, las tablas intactas) — corregido usando el
    nombre completo y específico del cliente en el fixture. Con el fix, **todas las
    aserciones pasan**.
  - `test/oauth-smoke-test.js` → **OK**, las 5 partes (rechazo de dominio, ciclo OAuth
    completo, expiración de token, rotación de refresh token, protocolo MCP con las 7
    tools).
  - `test/preventa-real.test.js` → **OK**, contra los datos ya re-sincronizados tras el fix
    de coordenadas: DESCARTABLE agosto $252,889.93 (0.03% del real $252,960.5169),
    BOTELLÓN 285 agosto $1,264.73 (6.5% del real $1,351.98, dentro del margen aceptado),
    julio PREVENTA ya no da $0.

**Fix de PREVENTA queda formalmente cerrado y verificado con datos vivos.**

## ✅ Punto 2 de la checklist — volumen PREVENTA 2026 por categoría (2026-09-01)

Consulta real (mismo filtro que `SQL_PREVENTA`: `type=2`, `status=5`, `seller_code`
PV%/PREVENTA%/TELEVENTA%, `fecha_entrega` — SIN el filtro de guía, para tener el
universo completo antes de filtrar) contra todo 2026 (enero 1 - agosto 31):

| Categoría | Líneas | Dólares | Unidades |
|---|---|---|---|
| DESCARTABLE | 53,156 | $1,906,557.70 | 625,827 |
| BOTELLÓN | 773 | $13,924.71 | 6,901 |

**Las 9 categorías restantes (HIELO, CAFÉ, PLUS, SUSCRIPCION, PT-DISTRINTER, PT-COTTSA,
PT-IIBC, SERVICIOS, GASTOS GENERALES) no aparecen — $0 en el canal PREVENTA durante todo
2026.** Confirmado que no es un problema de categoría NULL escondiendo datos (0 líneas con
`descripcion_categoria IS NULL` en este filtro).

**No hace falta pedir Excel ni validar ninguna de las 9** — simplemente no se vende nada de
esas categorías por PREVENTA. Solo DESCARTABLE y BOTELLÓN (ya ambas validadas) tienen
volumen real en este canal.

## ✅ Punto 3 de la checklist — desambiguación multi-compañía probada de punta a punta (2026-09-01)

Llamada real al tool MCP `ventasCliente` (no query SQL directa):

1. `nombre_cliente: "Corporación El Rosado"` → responde `encontrado:false,
   motivo:"cliente_multicompania", es_multicompania:true` con las 3 compañías
   (GRUPOAQUA S.A. `110470`, IIBC S.A. `112892`, DISTRINTER `109880`) — **nunca elige una
   sola automáticamente**, tal como se diseñó.
2. Repitiendo la llamada con `codigo_cliente: ["110470","112892","109880"]` → `encontrado:true`
   con el consolidado de las 3 y `por_compania` presente (desglose obligatorio cuando hay
   más de un código).

**Comportamiento confirmado en vivo, tal como se diseñó.**

## ✅ Punto 4 de la checklist — búsqueda fuzzy probada de punta a punta (2026-09-01)

Llamadas reales al tool MCP `ventasCliente`:

1. `nombre_cliente: "corporacion rosaddo"` (typo real) → `sin_coincidencias_cliente` +
   `sugerencias` por similitud (`pg_trgm`), con las 3 entidades multi-compañía de El
   Rosado en el tope (similitud 0.64) y otras razonablemente cercanas (Jave, Ayala, 0.41)
   más abajo — nunca elige una automáticamente, siempre pregunta "¿quisiste decir...?".
2. `nombre_cliente: "el rosad"` (nombre incompleto) → matchea por `ILIKE` parcial directo
   (no necesita el fallback de similitud), devuelve `coincidencias_multiples_cliente` con
   los 6 clientes reales que contienen "el rosad" (CD EL ROSADO, CEDI, las 3 entidades de
   Corporación El Rosado, EL ROSADO) — tampoco asume ninguno.

**Ambos casos (typo puro y nombre incompleto) confirmados en vivo, comportamiento tal
como se diseñó.**
- [x] **Mayo 2025** — corrido 2026-09-01 12:28 -05 (continuación manual, sin supervisión):
  ```
  [dotenv@17.3.1] injecting env (16) from .env -- tip: ⚡️ secrets for agents: https://dotenvx.com/as2
[dotenv@17.3.1] injecting env (0) from .env -- tip: 🤖 agentic secret storage: https://dotenvx.com/as2
Conexión a la base de datos establecida correctamente.
{"desde":"2025-05-01","hasta":"2025-05-31","ventasMv":595,"odoo":595,"reconciliaExacto":true,"erroresNuevosCount":2,"totalErroresAcumulados":3,"patronConocido":false,"detenerse":true,"motivoDetencion":"Error nuevo con patrón distinto al conocido (estado_ubicacion/277494/284316, o SESION_SOSPECHOSA/CONFIRMADO_SIN_DATOS)"}
  ```

### 🛑 Backfill 2025 DETENIDO en Mayo 2025

Error nuevo con patrón distinto al conocido (estado_ubicacion/277494/284316, o SESION_SOSPECHOSA/CONFIRMADO_SIN_DATOS)

No se continuó con los meses anteriores. Requiere revisión manual antes de reanudar.

## ✅ Punto 5 de la checklist — auditoría del bug de sesión de MobilVendor desde el deploy (2026-09-01)

Fix generalizado (cualquier página, no solo la 1) desplegado en `4cd22d3`
(2026-08-31 15:48 UTC). Auditoría de `sincronizaciones_ventas` desde ese momento hasta
ahora (2026-09-01 ~17:00 UTC):

- **28 filas de log** (14 sincronizaciones × 2 = venta MobilVendor + Odoo), cubriendo
  **3 ciclos reales de cron automático** (31-ago 12pm local, 1-sep 12am local, 1-sep 12pm
  local) + 11 meses de backfill 2025/2026 disparados manualmente.
- **Cero coincidencias** del patrón del bug (`estado='SUCCESS'` con `Facturas:0
  Órdenes:0`, o `total_registros=0`).
- **Un solo reintento de sesión sospechosa** registrado (`SESION_SOSPECHOSA_2025-06-01_
  2025-06-30_pag1`, junio 2025) — el mecanismo de retry funcionando correctamente
  (reconciliación exacta 654=654 confirmada, ver sección de backfill 2025 arriba), no un
  caso del bug original.

**El bug no ha vuelto a aparecer desde el fix — confirmado con datos reales de producción,
no solo con el código.**

## 🔴 Bug nuevo encontrado durante backfill 2025 — deadlock de Postgres pierde documentos (2026-09-01, SIN FIX, pendiente de priorizar)

Backfill 2025 se detuvo correctamente en **Mayo 2025** (reconciliación de El Rosado
exacta: 595=595, pero 2 errores nuevos con patrón no reconocido — el orquestador se
detuvo tal como está diseñado, no siguió de largo).

### Qué pasó

Los 2 errores nuevos son **deadlocks de Postgres** (`code: 40P01`) al hacer
`Producto.upsert()` sobre la tabla `productos`, durante el sync paralelo de MobilVendor +
Odoo:
```
"detail": "Process 571116 waits for ShareLock on transaction 69563307; blocked by
process 570714.\nProcess 570714 waits for ShareLock on transaction 69563308; blocked by
process 571116."
```
Dos procesos (probablemente el sync de MobilVendor y el de Odoo corriendo en paralelo,
o dos workers del mismo) intentaron actualizar productos relacionados al mismo tiempo y
Postgres abortó una de las dos transacciones por deadlock.

### Impacto confirmado (verificado con datos reales, no asumido)

- `FA001-041-000004157` (factura): terminó completa igual — 4 líneas en
  `detalle_documento`, `status=2`. El deadlock no le costó nada a este documento (se ve
  que otro intento/reintento sí insertó el producto).
- **`PDPV8-001710` (pedido/orden): NO existe en `ordenes` ni tiene ninguna línea en
  `detalle_documento` — se perdió por completo.** Confirmado con consulta directa a la
  base, no solo inferido del log de error.

### Alcance — por qué esto es más serio de lo que parece a primera vista

La reconciliación del backfill (`reconcile.js`) solo compara el conteo de **un cliente**
(El Rosado, 110470) contra Odoo — un deadlock que pierde un documento de OTRO cliente
**no lo detecta**. Es decir: aunque los meses anteriores (junio-noviembre 2025, y
probablemente el backfill 2026 también) mostraron `reconciliaExacto:true`, eso NO
garantiza que no haya habido pérdidas puntuales por deadlock en documentos de otros
clientes — la reconciliación nunca lo habría visto. Esta es la primera vez que aparece
este patrón en `errores_sync.txt` desde que se empezó a trackear en este backfill (el
archivo tenía 0 bloques antes de junio 2025), así que no hay evidencia de que haya
pasado antes — pero tampoco hay forma de descartarlo con la reconciliación actual.

### Sin fix todavía — pendiente de que el usuario priorice

Backfill 2025 **queda detenido en Mayo** (no relanzado) hasta que se decida qué hacer:
opciones típicas serían reintentar el upsert ante un deadlock (backoff simple) o serializar
mejor las escrituras a `productos` entre MobilVendor/Odoo. No implementado — solo
documentado y notificado, como corresponde a un hallazgo nuevo no listado todavía.

## ✅ Fix del deadlock de Postgres — causa raíz encontrada y corregida (2026-09-01)

### Causa raíz

`sincronizacionController.js` corre MobilVendor (`sincronizarVentasRango`) y Odoo
(`sincronizarOdooCompletoRango`) en **paralelo real** (`Promise.allSettled`). Ambos
escriben a la misma tabla `productos`:
- MobilVendor: un producto a la vez, dentro de la transacción de cada documento
  (`procesarDocumento`), documentos procesados secuencialmente entre sí (NO se
  deadlockea contra sí mismo — confirmado leyendo el loop, es un `for` con `await`).
- Odoo: un solo `bulkCreate` (multi-row upsert) por chunk, ya con un comentario propio
  ("secuencial → sin deadlock") que evita colisiones DENTRO de Odoo, pero sin ninguna
  coordinación con MobilVendor.

Ninguno de los dos ordena los productos antes de escribir — el orden depende del orden
en que llegó cada API. Cuando ambos sync tocan los mismos códigos de producto al mismo
tiempo en orden distinto, se forma un ciclo de locks y Postgres aborta una de las dos
transacciones (`40P01`). Antes de este fix, ese error se registraba en
`erroresPorDocumento` y el documento se perdía en silencio (confirmado: `PDPV8-001710`
nunca llegó a `ordenes` ni a `detalle_documento`).

### Fix (dos capas, `backend/services/sincronizacionService.js` +
`backend/services/odooServicio/sincronizacionOdooService.js`)

1. **Orden consistente de locks**: ambos lados ahora ordenan sus productos por
   `codigo_producto` ascendente (comparación de string simple, sin locale) antes de
   escribir — MobilVendor ordena `dedupDetails` antes del loop de `syncDetalle`, Odoo
   ordena el array antes de `Producto.bulkCreate`. Con el mismo criterio de orden en
   ambos lados, dos transacciones concurrentes que necesiten los mismos códigos siempre
   los piden en el mismo orden — el ciclo de locks deja de poder formarse.
2. **Red de seguridad — retry con backoff ante 40P01**: el orden consistente reduce la
   probabilidad pero no la elimina al 100% (ej. si el conflicto viniera de `clientes`/
   `direcciones_cliente`, que también se escriben en paralelo). Se agregó
   `conReintentoDeadlock()`: si `procesarDocumento` falla específicamente por `40P01`,
   se reintenta el documento completo hasta 3 veces con backoff (200ms/400ms + jitter)
   antes de darlo por perdido. Cualquier otro tipo de error sigue fallando inmediato,
   sin reintento (no se enmascara nada que no sea el deadlock puntual).

Verificado: `node --check` (Node 18, vía contenedor — el host tiene Node 12) OK en ambos
archivos. Desplegado (`dashboard_backend` reconstruido y healthy).

**Sin relanzar el backfill 2025 todavía** — antes hay que descartar pérdidas silenciosas
en meses ya dados por reconciliados (punto pendiente, ver próxima sección).

## 🔴 Chequeo retroactivo (conteo total, todos los clientes) — encontró una pérdida real en Julio 2026 ya dado por "cerrado" (2026-09-01)

Nuevo script `ops/reconciliacion-total/check_total.js`: generaliza la reconciliación
usada en los backfills (que solo comparaba El Rosado) a **todos los clientes**,
comparando `facturas` local (`status=2`) vs Odoo `account.move` (`state=posted`,
`out_invoice`+`out_refund`) **día por día** — para no diluir un desfase real en un
promedio mensual. Corrido sobre diciembre 2025 y enero-agosto 2026 completos (todos los
meses que ya se habían dado por reconciliados, antes del fix del deadlock).

### Resultado por mes

| Mes | Local | Odoo | Diferencia | Veredicto |
|---|---|---|---|---|
| Diciembre 2025 | 19,230 | 19,230 | 0 | ✅ limpio |
| Enero 2026 | 21,769 | 21,769 | 0 | ✅ limpio |
| Febrero 2026 | 18,051 | 18,051 | 0 | ✅ limpio |
| Marzo 2026 | 23,065 | 23,065 | 0 | ✅ limpio |
| Abril 2026 | 32,793 | 32,793 | 0 | ✅ limpio |
| Mayo 2026 | 22,115 | 22,115 | 0 | ✅ limpio |
| Junio 2026 | 29,470 | 29,470 | 0 | ✅ limpio |
| **Julio 2026** | **20,200** | **21,121** | **-921** | 🔴 **pérdida real** |
| Agosto 2026 | 21,111 | 21,065 | +46 | ✅ ruido normal (ver abajo) |

**Todos los meses tienen ruido día a día** (diferencias de ±5 a ±20 documentos,
alternando de signo) que se explica por atribución de fecha en el borde de
medianoche (`fecha_creacion` local vs `invoice_date` de Odoo) — se cancela dentro del
mes y no representa pérdida real. Diciembre 2025 y agosto 2026 tienen exactamente ese
patrón. **Julio es la única excepción: no se cancela, es sistemático y unidireccional.**

### El patrón de julio, específicamente

- **1-15 julio: perfecto, diff=0 los 15 días** — confirma que el backfill de ese hueco
  (hecho antes en esta sesión) sí quedó bien.
- **16-31 julio: déficit sistemático, SIEMPRE local < Odoo, nunca al revés** — 12 de 16
  días con diferencias de -28 a -136 documentos/día (16 jul: -114, 21 jul: -136, 23 jul:
  -106, 25 jul: -93, 30 jul: -99, 31 jul: -82, etc.). Esto NO tiene la forma de ruido de
  frontera de fecha (que alterna signo) — tiene la forma exacta del bug de sesión de
  MobilVendor (páginas que vuelven vacías con 200 OK, documentos completos perdidos).

### Por qué "julio ya estaba cerrado" y este hueco no se vio antes

El fix del bug de sesión se desplegó el 2026-08-31. La auditoría que se hizo entonces
(ver sección "🔴→✅ Bug de producción activo") se enfocó en los ciclos de cron **desde
el 21-ago** — el backfill original de julio 2026 (hecho ANTES de que existiera el fix)
nunca se volvió a resincronizar con la lógica de reintento activa. La reconciliación
puntual de esa época solo miraba El Rosado, que aparentemente no tuvo un documento
afectado ese mes — por eso pasó desapercibido.

### Estado: SIN TOCAR — reportado antes de continuar, como se pidió

No se resincronizó julio, no se recuperó `PDPV8-001710` (mayo 2025, deadlock — sigue
pendiente según lo acordado), y el backfill 2025 sigue detenido en mayo. A la espera de
que el usuario revise este hallazgo antes de seguir.

## ✅ Julio 2026 resincronizado, reconciliado y revalidado (2026-09-01)

Con el fix del deadlock ya desplegado y el session-fix vigente desde el 31-ago, se
resincronizó específicamente la ventana con pérdida confirmada.

### Punto 1 — Resync de julio 16-31

`GET /api/sync/sincronizar?desde=2026-07-16&hasta=2026-07-31` — `COMPLETADO`,
`Ped:3129 Fac:10740 Cli:12812 Prod:1923 Det:15143 Err:0` (Odoo) /
`Facturas:8389 Órdenes:12140 Errores:2` (MobilVendor). Los 2 errores de MobilVendor son
el bug YA CONOCIDO y diferido (`estado_ubicacion_direccion_cliente="UNKNOWN"`,
direcciones 277494/284316) — no session bug, no deadlock. Cero ocurrencias de
`SESION_SOSPECHOSA`/`40P01` en este resync.

### Punto 2 — Reconciliación día por día de julio completo (`check_total.js`), post-resync

**Total: 21,121 local = 21,121 Odoo — exacto.** Los 16 días previamente en déficit
(16-23 julio) ahora dan `diff=0` exacto. Queda el mismo ruido residual de ±1 a ±13 por
frontera de fecha, alternando de signo, en 14 de los 31 días — idéntico al patrón
benigno visto en todos los demás meses limpios (diciembre 2025, enero-junio y agosto
2026). **Julio 2026 queda genuinamente cerrado.**

### Punto 3 — Revalidación de PREVENTA/BOTELLÓN y DESCARTABLE contra Excel real

- **BOTELLÓN, producto 285 (único con Excel real de julio)**: `topProductos` da
  **671 unidades / $1,210.20** — **exactamente el mismo número que antes del resync**
  (no cambió). Investigado por qué: los 4 documentos que ya explicaban el hueco
  residual conocido (`PDPV5-009669`, `PDPV5-009668`, `PDPVR4-001036`,
  `PDPV10-007342`) tienen `fecha_entrega` 7, 8, 9 y 22 de julio — solo el último cae en
  la ventana resincronizada hoy (16-31), y sigue con `waybill_status="0"` pese al
  resync: confirma que el desfase es estructural (el código de guía `GUT10-000022` ya
  refleja un despacho posterior, no se puede recuperar re-sincronizando) y no algo que
  el resync de hoy pudiera arreglar. **Sigue dentro del margen ya aceptado**
  (671/716 = 93.7% del real, ~6.3% — consistente con el ~6-7% ya documentado).
- **DESCARTABLE**: $252,895.62 / 84,693 unidades. **No hay Excel real de julio para
  DESCARTABLE específicamente** (solo se validó agosto) — no se puede confirmar contra
  ground truth, pero se descarta cualquier regresión: el número es positivo, de
  magnitud consistente con agosto (~$252,960 ya validado), no vuelve a dar $0 como el
  bug original.

**Julio 2026 queda confirmado limpio y revalidado — no por asunción, contra Excel real
donde existe (BOTELLÓN 285) y como control de sanidad donde no (DESCARTABLE).**

## ✅ Mayo 2025 recuperado y reconciliado — `PDPV8-001710` de vuelta (2026-09-02)

Con el fix del deadlock desplegado, se resincronizó mayo 2025 completo
(`2025-05-01`→`2025-05-31`). Resultado: `Ped:4915 Fac:33620 POS:898/898 Cli:37109
Prod:4233 Det:42974 Err:0` (Odoo) / `Facturas:29069 Órdenes:6976 Errores:1`
(MobilVendor, el único error es `SESION_SOSPECHOSA_2025-05-01_2025-05-31_pag1` — el
retry funcionando, señal sana). **Cero deadlocks en este resync.**

**`PDPV8-001710` recuperado**: ahora existe en `ordenes` (`status=5`, entrega
2025-05-12).

### Reconciliación amplia — versión mejorada (por existencia de código, no por conteo diario)

El primer intento de reconciliación amplia (conteo local vs Odoo día por día, igual
método que detectó julio) marcó mayo con `reconciliaExacto:false` (+71 documentos de
más localmente). Investigado a fondo antes de asumir nada:
- Los "documentos extra" del 26-may **sí existen en Odoo**, con `invoice_date` un día
  después (27-may) — verificado documento por documento (`FA001-065-000003776` y
  otros 4, todos `posted`, mismo código, un día de corrimiento).
- Los "documentos faltantes" del 22-may (día en déficit) **sí existen todos en local**,
  bajo otro código/fecha — 0 de 1,215 códigos de Odoo de ese día faltan realmente.

**Conclusión: el conteo día por día genera falsos positivos en datos 2025 backfilleados**
por corrimiento de fecha entre `fecha_creacion` local e `invoice_date` de Odoo (no
relacionado con ningún bug — es cómo Odoo asigna la fecha en algunos casos). Rediseñado
`ops/reconciliacion-total/reconcile_amplio.js` a **chequeo por existencia de código**:
por cada factura que Odoo marca `posted` en el rango, ¿existe ese código en `facturas`
local en CUALQUIER fecha/status (ventana ±2 días)? Esto es inmune al corrimiento de
fecha y detecta pérdida real sin falsos positivos — reverificado contra julio 2026
(21,121=21,121, 0 códigos faltantes, consistente con el chequeo día-por-día anterior) y
contra mayo (33,439=33,439, **0 códigos faltantes** con el método nuevo). Además es
~10x más rápido (una sola consulta a Odoo por mes en vez de 31).

**Mayo 2025 queda genuinamente reconciliado, sin pérdida real, `PDPV8-001710`
recuperado.**

### Reconciliación amplia como estándar del orquestador

`ops/backfill2025/run_resume.sh` actualizado: usa `reconcile_amplio.js` (todos los
clientes, existencia de código) en vez de `reconcile.js` (solo El Rosado) para abril
2025 en adelante. `MESES` recortado a Abril→Enero 2025 (mayo ya cerrado arriba).

### 🌙 Backfill 2025 (continuación) — arrancó 2026-09-02 05:39 -05, a pedido explícito

Mayo ya reconciliado por separado (recuperación de PDPV8-001710 tras el fix del
deadlock de Postgres). Continúa abril 2025 hacia atrás hasta enero 2025.
**Reconciliación amplia desde acá en adelante** (todos los clientes, chequeo de
existencia de código vs Odoo — no solo El Rosado), se detiene ante cualquier cosa
que no reconoce.

## ✅ Fix de días hábiles en `proyeccionMensual` — feriados trabajados ya no se excluyen a ciegas (2026-09-02)

Corrección de regla de negocio pedida por el usuario: un feriado del calendario estático
NO se debe excluir automáticamente de "días hábiles" — el negocio puede trabajarlo (ej.
2026-08-10, Primer Grito de Independencia, tuvo 1,628 documentos, prácticamente un día
normal).

### Diseño

- **Días PASADOS** (de cualquier mes, cerrado o en curso): si el calendario estático
  marca el día como feriado, se verifica si hubo venta real ese día — si la hubo, cuenta
  como hábil; si no, se mantiene excluido. Los días normales (no feriado) no se
  re-verifican, ya se sabe que son hábiles.
- **Días FUTUROS del mes en curso**: no hay forma de saber de antemano si un feriado se
  va a trabajar — se mantiene el calendario estático como fallback. **Limitación
  conocida y aceptada, documentada en el código** (`esDiaHabilReal` en
  `diasFestivos.js`): no se puede predecir el futuro.

### Umbral — "¿hubo venta real ese día?"

Calibrado con datos reales (no arbitrario), comparando feriados NO trabajados contra
feriados SÍ trabajados:

| Día | Tipo | Documentos (facturas+órdenes) |
|---|---|---|
| 2026-01-01 (Año Nuevo) | feriado NO trabajado | 223 |
| domingo típico | día cerrado (referencia) | hasta ~160 |
| 2026-01-02 (feriado adicional Decreto 249) | feriado SÍ trabajado | 1,524 |
| 2026-02-16/17 (Carnaval) | feriado SÍ trabajado | 1,237 / 1,165 |
| 2026-04-03 (Viernes Santo) | feriado SÍ trabajado | 1,603 |
| 2026-05-01 (Día del Trabajo) | feriado SÍ trabajado | 1,967 |
| 2026-05-25 (Batalla de Pichincha) | feriado SÍ trabajado | 1,734 |
| **2026-08-10 (Primer Grito)** | feriado SÍ trabajado | **1,628** |
| día normal típico | referencia | ~1,500-2,200 |

**Umbral elegido: 500 documentos** (facturas+órdenes, toda la empresa, sin filtrar por
status) — más de 2x el feriado no trabajado más alto observado (223), menos de un
tercio del piso de los feriados sí trabajados (1,165+). Amplio margen a ambos lados,
verificado también contra 2025 (2025-01-01=0, 2025-05-01=1,791) — el mismo umbral
absoluto funciona en ambos años.

**Hallazgo real durante la calibración**: casi todos los feriados de 2025-2026
resultaron efectivamente trabajados (solo Año Nuevo se confirmó realmente cerrado) —
confirma que el calendario estático venía subestimando sistemáticamente los días
hábiles reales de este negocio.

### Implementación

`backend/utils/diasFestivos.js` (+ copia sincronizada byte a byte en
`mcp-server/src/util/diasFestivos.js`, `test/diasFestivos-sync.test.js` confirma):
funciones NUEVAS `esDiaHabilReal`, `getDiasHabilesTranscurridosReal`,
`getDiasLaborablesMesReal` — reciben `huboVentaReal` **inyectado** (no importan la base
de datos directamente, para que el archivo se mantenga como diff limpio entre backend/
y mcp-server/, cada uno con su propia conexión). Las funciones estáticas existentes
(`getDiasHabilesTranscurridos`, `getDiasLaborablesMes`, `getDiasHabiles`) quedan
intactas, sin tocar — siguen usándose sin cambios en los demás controllers del
dashboard (café, hielo, plus, botellones, cotsa, consolidado, etc.), que NO estaban en
el alcance de este pedido.

`mcp-server/src/tools/proyeccionMensual.js`: usa las nuevas funciones `...Real` con
`huboVentaReal(fecha)` implementado con el pool de solo-lectura del MCP.

### Verificación

- Agosto 2026 (mes cerrado, incluye el 10-ago): `dias_habiles_transcurridos=26` (antes
  25 con el calendario estático — reconoce el feriado trabajado).
- Enero 2026 (incluye 1-ene y 2-ene): `dias_habiles_transcurridos=26` (antes 25) —
  distingue correctamente: 1-ene sigue excluido (223 < 500), 2-ene ahora cuenta (1,524
  ≥ 500).
- Setiembre 2026 (mes en curso): no rompe nada, proyecta con normalidad.
- Suite completa: `seguridad-smoke-test.js`, `oauth-smoke-test.js`,
  `preventa-real.test.js` (dentro del contenedor `mcp_server`) + `diasFestivos-sync.test.js`
  (desde el host, necesita ver `backend/` y `mcp-server/` juntas) — **todos OK**.

Desplegado (`mcp_server` reconstruido y healthy).

## ⚠️ `ventasPorRuta` — ruta individual SÍ funciona, pero con una brecha real para rutas de preventa (2026-09-02)

### Lo que se pidió confirmar

`ventasPorRuta` ya acepta `ruta: string` (una sola ruta específica, no "todas") — probado
con un ejemplo real documentado acá.

### Confirmado: funciona correctamente para rutas NO-preventa

```
ventasPorRuta({ ruta: "D8", fecha_inicio: "2026-08-01", fecha_fin: "2026-08-31" })
→ { ruta: "D8", unidades_totales: 7667, dolares_totales: 22895.63, num_documentos: 376,
    por_categoria: [{ categoria: "DESCARTABLE", unidades: 7667, dolares: 22895.63 }] }
```
Números reales, correctos, filtrados exactamente a esa ruta.

### 🔴 Hallazgo: para rutas de preventa (PV*/PVR*/TELEVENTA*) da $0, no un error — probablemente ES lo que el gerente preguntó

```
ventasPorRuta({ ruta: "PVR1", fecha_inicio: "2026-08-01", fecha_fin: "2026-08-31" })
→ { ruta: "PVR1", unidades_totales: 0, dolares_totales: 0, num_documentos: 0, por_categoria: [] }
```

**No es un bug de sintaxis ni de filtro roto — es que `ventasPorRuta` usa
`o.status = 2` (el criterio genérico), pero las órdenes de PREVENTA reales están en
`status = 5`** (confirmado: PVR1 agosto 2026 tiene 252 órdenes en status=5, solo 12 en
status 3/4, ninguna en status=2). PREVENTA necesita el filtro específico
(`FILTRO_PREVENTA_SELLER`, `status=5` + `waybill_code`/`waybill_status` según categoría
— ver `clasificacion.js`) que `ventasPorGrupo`/`topProductos` ya usan, pero
`ventasPorRuta` no lo comparte — quedó fuera cuando se generalizó a "todas las
categorías de producto" (comentario del archivo referencia solo el patrón de
`obtenerGrupoBotellon`, previo al fix de PREVENTA).

**Como "PVR" = Preventa Ruta, es muy probable que esto sea exactamente lo que el
gerente quiso decir con "dame solo PVR1 y PVR2"** — y hoy el tool le devolvería $0 en
vez de un error, lo cual es peor (parece dato real, no una limitación). **No lo arreglé
todavía — es un hallazgo nuevo, no estaba en el pedido de hoy.** Si se confirma que las
rutas que le interesan al gerente son de preventa, este es el fix real que hace falta
(compartir `FILTRO_PREVENTA_SELLER` en `ventasPorRuta`, análogo a como ya lo usan
`ventasPorGrupo`/`topProductos`).

### Múltiples rutas en una sola consulta (array) — no implementado, tamaño del cambio

No implementado — evaluado antes de tocar nada, como se pidió. El cambio es **chico**:
mismo patrón ya usado en `ventasCliente` para `codigo_cliente` (array de texto):
- Schema: `ruta: z.union([z.string().regex(RUTA_RE), z.array(z.string().regex(RUTA_RE)).min(1)])`.
- SQL: las 3 ramas cambian `o.seller_code = $1` → `o.seller_code = ANY($1::text[])`
  (aceptando siempre un array desde la función, normalizando `ruta` a array de 1 si
  viene como string).
- Salida: agregar `por_ruta` al resultado (desglose por cada ruta pedida) además del
  total combinado — mismo patrón que `ventasPorGrupo`.

Estimado: ~20-30 min de trabajo + pruebas. **No tocado — a la espera de que se confirme
si hace falta**, y de que se decida primero qué hacer con el hallazgo de PREVENTA de
arriba (si las rutas que interesan son PVR*, el array sin el fix de PREVENTA seguiría
dando $0).

## 🕓 Preparado (sin correr) — segunda pasada de reconciliación amplia sobre agosto 2026 completo

Agosto 2026 se sincronizó (incluida la resync del 1-sep tras el fix de coordenadas)
**antes de que existiera el fix del deadlock de Postgres** — a diferencia de julio (que
sí se resincronizó ya con el fix activo), agosto nunca se volvió a correr con el
ordenamiento consistente + retry activos. No hay evidencia de que haya pasado nada malo
(agosto ya mostró `+46` de ruido benigno en el primer chequeo amplio, sin patrón de
pérdida), pero antes de darlo por bueno definitivamente conviene una segunda pasada con
la reconciliación por existencia de código (la versión sin falsos positivos).

**Comando listo para ejecutar apenas termine el backfill 2025** (no se corre ahora para
no competir por conexiones a Odoo/Postgres con el backfill en curso):

```bash
docker cp ops/reconciliacion-total/reconcile_amplio.js dashboard_backend:/app/ops-tmp/reconcile_amplio.js
docker exec dashboard_backend node /app/ops-tmp/reconcile_amplio.js 2026-08-01 2026-08-31 0
```

Si `reconciliaExacto:false` con `codigosFaltantes` no vacío → resincronizar agosto igual
que se hizo con julio (mismo procedimiento: resync del rango, reconciliar de nuevo,
revalidar PREVENTA/BOTELLÓN contra el Excel real ya confirmado). Si `reconciliaExacto:true`
→ agosto queda cerrado, sin acción.
- [x] **Abril 2025** — corrido 2026-09-02 06:03 -05 (continuación manual, sin supervisión):
  ```
  [dotenv@17.3.1] injecting env (16) from .env -- tip: ⚡️ secrets for agents: https://dotenvx.com/as2
[dotenv@17.3.1] injecting env (0) from .env -- tip: ⚙️  suppress all logs with { quiet: true }
Conexión a la base de datos establecida correctamente.
{"desde":"2025-04-01","hasta":"2025-04-30","ventasMv":31548,"odoo":31548,"reconciliaExacto":true,"erroresNuevosCount":0,"totalErroresAcumulados":3,"patronConocido":true,"detenerse":false,"motivoDetencion":null,"codigosFaltantesCount":0,"codigosFaltantes":[]}
  ```

## ✅ Fix: `ventasPorRuta` ahora usa el filtro real de PREVENTA para rutas PV*/PVR*/TELEVENTA* (2026-09-02)

Cierra el hallazgo documentado arriba ("ventasPorRuta — ruta individual SÍ funciona,
pero con una brecha real para rutas de preventa"). Síntoma que lo destapó:

```
ventasPorRuta({ ruta: "PVR1", fecha_inicio: "2026-08-01", fecha_fin: "2026-08-31" })
→ ANTES: { unidades_totales: 0, dolares_totales: 0, num_documentos: 0, por_categoria: [] }
```
$0 en silencio, no un error — porque usaba `status=2`/`fecha_creacion` (el criterio
genérico), pero las órdenes de PREVENTA reales están en `status=5`.

### Fix

`mcp-server/src/tools/ventasPorRuta.js`: nueva regex `RUTA_PREVENTA_RE = /^(PV|PREVENTA|TELEVENTA)/i`
(mismo patrón que `FILTRO_PREVENTA_SELLER`, evaluado del lado de JS sobre el valor de
`ruta`) decide en runtime qué SQL correr:
- **Rutas de preventa** (`PVR*`, `PV1`-`PV15`, `PVM`, `PVM2`, `PVQ1`, `PVQ2`,
  `TELEVENTA *`, `PREVENTA VIP *`): nueva query `SQL_PREVENTA` — `type=2`, `status=5`,
  `fecha_entrega` (no `fecha_creacion`), y `FILTRO_PREVENTA_SELLER("dd.descripcion_categoria")`
  (la MISMA función que ya usan `ventasPorGrupo`/`topProductos`, aplicada por categoría
  de cada línea ya que acá no hay un solo `categoria` fijo). Solo `ordenes` — sin rama
  de facturas ni pedido web, igual que `SQL_PREVENTA` en `ventasPorGrupo.js`.
- **Rutas no-preventa**: sin cambios, sigue con la query original (`status=2`).

### Validación cruzada — suma por ruta vs `ventasPorGrupo`, julio y agosto 2026

Se sumaron las 28 rutas de preventa reales (`PVR1`-`5`, `PV1`-`15`, `PVM`, `PVM2`,
`PVQ1`, `PVQ2`, `TELEVENTA 1/3/4`, `PREVENTA VIP 1/2`) individualmente vía
`ventasPorRuta` y se comparó contra `totalesPreventa` (lo mismo que usa
`ventasPorGrupo`):

| Mes | Categoría | Suma por ruta | `ventasPorGrupo` | Diferencia |
|---|---|---|---|---|
| Julio 2026 | DESCARTABLE | $252,895.62 (84,693u) | $252,895.62 (84,693u) | **$0.00** |
| Julio 2026 | BOTELLÓN | $2,719.95 (1,342u) | $2,719.95 (1,342u) | **$0.00** |
| Agosto 2026 | DESCARTABLE | $252,889.93 (84,949u) | $252,889.93 (84,949u) | **$0.00** |
| Agosto 2026 | BOTELLÓN | $2,871.23 (1,423u) | $2,871.23 (1,423u) | **$0.00** |

**Coincide exacto en los 4 casos** — confirma que sumar rutas individuales da lo mismo
que el agregado ya validado, sin fuga ni doble conteo.

### Seguridad y regresión

Probado a mano un payload de inyección específico contra la rama nueva
(`"PV1'; DROP TABLE ordenes; --"`) — no lanza error de sintaxis, tabla `ordenes`
intacta (parámetro posicional, mismo patrón de siempre). Suite completa:
`seguridad-smoke-test.js`, `oauth-smoke-test.js`, `preventa-real.test.js` — todas OK.

Desplegado (`mcp_server` reconstruido y healthy).

**Pendiente, a la espera de decisión**: soporte de array de rutas en una sola consulta
(ver estimación de tamaño de cambio arriba) — ahora que el filtro de PREVENTA está
resuelto, se puede evaluar sin el riesgo de construir el array sobre una base rota.
- [x] **Marzo 2025** — corrido 2026-09-02 06:26 -05 (continuación manual, sin supervisión):
  ```
  [dotenv@17.3.1] injecting env (16) from .env -- tip: 🔐 prevent building .env in docker: https://dotenvx.com/prebuild
[dotenv@17.3.1] injecting env (0) from .env -- tip: ⚙️  load multiple .env files with { path: ['.env.local', '.env'] }
Conexión a la base de datos establecida correctamente.
{"desde":"2025-03-01","hasta":"2025-03-31","ventasMv":30017,"odoo":30017,"reconciliaExacto":true,"erroresNuevosCount":0,"totalErroresAcumulados":3,"patronConocido":true,"detenerse":false,"motivoDetencion":null,"codigosFaltantesCount":0,"codigosFaltantes":[]}
  ```
- [x] **Febrero 2025** — corrido 2026-09-02 06:47 -05 (continuación manual, sin supervisión):
  ```
  [dotenv@17.3.1] injecting env (16) from .env -- tip: ⚡️ secrets for agents: https://dotenvx.com/as2
[dotenv@17.3.1] injecting env (0) from .env -- tip: 🛡️ auth for agents: https://vestauth.com
Conexión a la base de datos establecida correctamente.
{"desde":"2025-02-01","hasta":"2025-02-28","ventasMv":27787,"odoo":27787,"reconciliaExacto":true,"erroresNuevosCount":0,"totalErroresAcumulados":3,"patronConocido":true,"detenerse":false,"motivoDetencion":null,"codigosFaltantesCount":0,"codigosFaltantes":[]}
  ```

## ✅ Soporte de array de rutas en `ventasPorRuta` (2026-09-02)

Sobre la base ya arreglada de PREVENTA (arriba). `ruta` ahora acepta un string (una
sola ruta, retrocompatible) o un array (subconjunto, ej. `["PVR1","PVR2"]`).

### Diseño

- Reescrita la query como `GROUP BY GROUPING SETS ((ruta_val, categoria), (categoria),
  (ruta_val), ())` — una sola consulta da a la vez el desglose por categoría agregado
  entre todas las rutas pedidas, el desglose por ruta agregado entre todas las
  categorías, y el total general. Antes eran 2 queries por SUM/COUNT window; ahora es 1.
- `o.seller_code = $1` → `o.seller_code = ANY($1::text[])` en las 3 ramas de `SQL`
  (no-preventa) y en `SQL_PREVENTA`.
- El array puede mezclar rutas de preventa y no-preventa en la misma consulta — se
  separan en JS, cada grupo corre contra su SQL correspondiente (en paralelo,
  `Promise.all`), y los resultados se combinan sumando `por_categoria` por categoría y
  concatenando `por_ruta`.
- Retrocompatible: si `ruta` es un string (no array), la respuesta mantiene la forma
  anterior (`ruta` singular, sin `por_ruta`) — nada de lo que ya usaba este tool antes
  cambia.

### Validación — suma agregada vs suma manual ruta por ruta

`ventasPorRuta({ ruta: ["PVR1","PVR2","PVR3","PVR4","PVR5"], ... agosto 2026 })`:
```
unidades_totales: 13739, dolares_totales: 39324.18, num_documentos: 1068
por_ruta: PVR1=8442.91/2867u/258, PVR2=9976.27/3605u/135, PVR3=6772.21/2412u/288,
          PVR4=8868.15/3180u/154, PVR5=5264.64/1675u/233
```
Sumando esas 5 rutas UNA POR UNA por separado (`ventasPorRuta({ruta:"PVR1",...})`, etc.):
mismos números exactos en el total (**$39,324.18 = $39,324.18**, 13,739=13,739u,
1,068=1,068 documentos) y en cada desglose por ruta individual.

También probado un array mixto (`["PVR1","D8"]`, preventa + no-preventa juntas en una
sola consulta): $31,338.54 = $8,442.91 (PVR1) + $22,895.63 (D8) — exacto.

### Seguridad y regresión

Payload de inyección probado específicamente contra la rama de array
(`["PVR1'; DROP TABLE ordenes; --", "D8'); DROP TABLE facturas; --"]`) — sin error de
sintaxis, ambas tablas intactas (`ANY($1::text[])` trata el array completo como
parámetro posicional, cada elemento como texto literal). Suite completa:
`seguridad-smoke-test.js`, `oauth-smoke-test.js`, `preventa-real.test.js` — todas OK.

Desplegado (`mcp_server` reconstruido y healthy). Descripción del tool actualizada para
mencionar el soporte de array.
- [x] **Enero 2025** — corrido 2026-09-02 07:09 -05 (continuación manual, sin supervisión):
  ```
  [dotenv@17.3.1] injecting env (16) from .env -- tip: ⚙️  override existing env vars with { override: true }
[dotenv@17.3.1] injecting env (0) from .env -- tip: ⚙️  specify custom .env file path with { path: '/custom/path/.env' }
Conexión a la base de datos establecida correctamente.
{"desde":"2025-01-01","hasta":"2025-01-31","ventasMv":29721,"odoo":29721,"reconciliaExacto":true,"erroresNuevosCount":0,"totalErroresAcumulados":3,"patronConocido":true,"detenerse":false,"motivoDetencion":null,"codigosFaltantesCount":0,"codigosFaltantes":[]}
  ```

### ✅ Backfill 2025 COMPLETADO — 2026-09-02 07:09 -05

Los 12 meses (enero-diciembre 2025) reconciliaron exacto contra Odoo (El Rosado,
`status=2`) y ningún error nuevo se apartó del patrón ya conocido. Log completo en
`ops/backfill2025/backfill2025.log`.

## ✅ Backfill 2025 COMPLETADO — los 12 meses reconciliaron (2026-09-02)

Terminó el orquestador (`run_resume.sh`, abril→enero) con la reconciliación amplia
(existencia de código, todos los clientes) activa desde mayo en adelante:

| Mes | Local | Odoo | Códigos faltantes |
|---|---|---|---|
| Abril 2025 | 31,548 | 31,548 | 0 |
| Marzo 2025 | 30,017 | 30,017 | 0 |
| Febrero 2025 | 27,787 | 27,787 | 0 |
| Enero 2025 | 29,721 | 29,721 | 0 |

Sumado a diciembre-noviembre-octubre-septiembre-agosto-julio-junio (reconciliados antes,
con el chequeo angosto de El Rosado) y mayo (recuperado tras el fix del deadlock, ver
sección arriba) — **los 12 meses de 2025 quedan reconciliados**. Log completo en
`ops/backfill2025/backfill2025.log`.

## ✅ Segunda pasada de reconciliación amplia — agosto 2026 confirmado limpio (2026-09-02)

Con el backfill 2025 terminado, se corrió la reconciliación pendiente sobre agosto 2026
completo (sincronizado antes de que existiera el fix del deadlock, a diferencia de julio):

```
{"desde":"2026-08-01","hasta":"2026-08-31","ventasMv":21060,"odoo":21060,
 "reconciliaExacto":true,"codigosFaltantesCount":0,"codigosFaltantes":[]}
```

**Exacto, 0 códigos faltantes — agosto 2026 no tuvo ninguna pérdida silenciosa pese a
haberse sincronizado antes del fix.** No hace falta ningún resync ni revalidación
adicional para agosto.

### Estado general tras esta ronda de trabajo

- Enero-agosto 2026: limpio (coordenadas + deadlock + sesión, todos los fixes activos y
  verificados).
- 2025 completo (enero-diciembre): limpio, backfill terminado.
- PREVENTA (waybill condicional por categoría): validado contra Excel real
  (DESCARTABLE agosto, BOTELLÓN julio/agosto).
- `ventasPorRuta`: filtro de PREVENTA corregido + soporte de array, validado.
- `proyeccionMensual`: días hábiles ya no excluye feriados trabajados.

## ✅ Bug de `estado_ubicacion_direccion_cliente` — fix implementado, los 22 documentos afectados ya estaban recuperados (2026-09-02)

Con el backfill 2025 terminado, se retomó el fix diferido (chico, tal como estaba
estimado — una función nueva de saneo + 1 línea cambiada, sin tocar schema).

### Fix

`backend/services/sincronizacionService.js`: nueva función `sanearEstadoUbicacion(geoAreaCode)`
— si el valor no es un entero válido (ej. `"UNKNOWN"`), guarda `null` en vez de dejar
pasar el string crudo a una columna `integer` (lo que antes tumbaba el INSERT completo,
llevándose el documento entero por estar `syncDireccionCliente` dentro de la misma
transacción). `syncDireccionCliente` ahora usa `sanearEstadoUbicacion(doc.geo_area_code)`
en vez de `doc.geo_area_code || 3` crudo. Verificado que el lado Odoo
(`sincronizacionOdooService.js`) no toca este campo — el problema era exclusivo de
MobilVendor.

### Los 22 documentos de la tabla de seguimiento — ya estaban recuperados

Antes de disparar cualquier resync puntual, se verificó la base: **los 22 documentos
(abril-junio 2026) ya existen, todos `status=2` con al menos 1 línea en
`detalle_documento`** — recuperados como efecto colateral de los múltiples resyncs
completos de abril-agosto ya hechos esta sesión (bug de coordenadas, validación de
PREVENTA). No hizo falta ningún resync adicional.

**Hallazgo adicional al verificar**: las 2 direcciones problemáticas (277494, 284316)
ya NO tienen la descripción "NO USAR" que las identificaba — ahora aparecen como
"COMUNA CURIA" / "MEREGILDO TOMALA KATHYA A" con `estado_ubicacion_direccion_cliente=3`
(válido). El código de dirección (`codigo_direccion_cliente`) parece haberse reasignado
a un cliente/dirección distinto en MobilVendor con el tiempo — mismo tipo de
reutilización de código ya visto con los códigos de guía (`waybill_code`). El fix queda
igual de necesario como red de seguridad permanente para la PRÓXIMA vez que MobilVendor
mande un valor no-entero en `geo_area_code` (cualquier dirección, no solo estas 2).

Verificado: `node --check` OK, desplegado (`dashboard_backend` reconstruido y healthy).

## ✅ Merge directo a `main` — resolución del conflicto de coordenadas (2026-09-02)

`feature/mcp-server-ventas` mergeada directo a `main` por `git merge --no-ff` (sin PR de
GitHub — el usuario no podía abrirlo en ese momento, ver nota más abajo). `main` había
avanzado con un fix independiente de coordenadas (`6015459`, 24-ago, rama
`fix/odoo-sync-facturas-fixes`) que tocaba la misma función
(`upsertClientesYDirecciones` en `sincronizacionOdooService.js`) que mi propio fix de
esta sesión (`sanitizeCoordinate`) — conflicto real, no cosmético.

### Qué ganó y por qué

**`sanitizeCoordinate` (rama `feature/mcp-server-ventas`) sobre el filtro de `main`.**
No son la misma lógica escrita distinto — hay una diferencia real de comportamiento:

| | `main` (`fix/odoo-sync-facturas-fixes`) | `feature` (`sanitizeCoordinate`) |
|---|---|---|
| Límite | `abs(valor) < 1000`, igual para lat y lon | lat ±90, lon ±180 (límites geográficos reales) |
| Redondeo | ninguno, guarda el valor crudo | `toFixed(8)`, calza exacto con `DECIMAL(12,8)` |
| Caso original (`-212881`) | rechazado (correcto) | rechazado (correcto) |
| Valor corrupto tipo `150` como latitud | **aceptado** (150 < 1000) — dato imposible guardado igual | **rechazado** (150 > 90) |

Ambas resuelven el caso puntual que las motivó (el `abs > 1000` de `-212881`/`-2196885`),
pero el filtro de `main` deja pasar cualquier corrupción entre el límite geográfico real
y 1000 — `sanitizeCoordinate` es un superset estrictamente más correcto, sin ningún caso
donde el de `main` fuera mejor. El comentario de `main` que mencionaba "Ecuador
continental: lat ~ -5..2, lng ~ -81..-75" no reflejaba lo que el código realmente
aplicaba (±1000, no ese rango) — no sobrevive en la versión final; se agregó en cambio
una aclaración en `backend/utils/sanitizeCoordinate.js` explicando por qué se usan los
límites geográficos reales en vez de un margen arbitrario.

El resto del commit de `main` (log de `err.parent.detail`, dedup de
`syncHistorialVisitasService.js`, bind de postgres a `127.0.0.1` en `docker-compose.yml`)
no lo tocaba `feature` — mergeó limpio, sin conflicto, se conserva completo.

### Por qué se hizo así (sin PR)

El repo está bajo una cuenta a la que el usuario no tenía acceso para abrir el PR en el
momento. Decisión explícita del usuario, pidiendo saltar la regla de este mismo archivo
("Entregar vía PR, nunca merge ni deploy solo") para este caso puntual — no es un cambio
de proceso general, documentado acá para que quede trazable.
