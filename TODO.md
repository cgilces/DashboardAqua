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

### Pendiente / fase 2
- [ ] Inventario *asignado* por prendedor (`users_in_promos`): requiere que MobilVendor habilite ese
      schema en el web-service para el contexto `grupoAqua`. Solo entonces el sync ya existente lo levanta.
- [ ] Arreglo overflow `varchar(100)` en tablas de promo → ampliado a `TEXT` (hecho en rama de fix previa).
