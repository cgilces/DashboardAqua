# DashboardAqua — Guía para Claude

## Flujo de trabajo autónomo (rama + PR)

El usuario (cgilces, dev solo) autoriza mejoras **autónomas pero siempre revisadas**.
Regla de oro: **autónomo para proponer, humano para aprobar.**

1. **Fuente de verdad = `TODO.md`.** Solo se trabajan tareas que estén ahí en estado
   `[ ]` (pendiente). No inventar trabajo fuera del backlog; si detecto algo crítico
   (bug/riesgo), lo agrego a `TODO.md`, lo marco y aviso — no lo ejecuto sin que esté listado.
2. **Una tarea = una rama.** Nunca trabajar ni commitear en `main`.
   Nombre: `feature/<slug>` o `fix/<slug>`.
3. **Verificar antes de entregar.** Como mínimo `node --check` en los archivos tocados;
   si hay tests, correrlos. No entregar nada que no compile.
4. **Entregar vía PR, nunca merge ni deploy solo.**
   Como `gh` no está instalado: `git push -u origin <rama>` y pasar al usuario el link
   `https://github.com/cgilces/DashboardAqua/compare/main...<rama>` para que abra y revise el PR.
5. **Cerrar el ciclo.** Al entregar, marcar la tarea en `TODO.md` como `[x]` con la rama/PR.
6. **Confirmar acciones de una vía** (push, borrar, tocar producción) salvo que el usuario
   ya lo haya autorizado para esa tarea.

## Contexto del proyecto

- **Backend:** Node + Express + Sequelize (PostgreSQL). Arranque crea la BD solo vía
  `backend/sql/000_schema.sql` (idempotente) + `sequelize.sync()`.
- **Frontend:** `my-app/` (React + TS).
- **Integraciones:** MobilVendor (ventas, clientes, rutas, promociones) y Odoo. Sync por
  botón y por cron (12 AM / 12 PM, zona America/Guayaquil).
- **Chatbot IA:** motor = Claude (`backend/services/chatbotservicio/claude.client.js`).
  Filosofía: el chatbot reutiliza funciones deterministas del dashboard para que las cifras
  cuadren, en vez de SQL generado por el LLM.

## Comandos útiles

```powershell
cd backend; node --check <archivo>      # validar sintaxis
cd backend; node scripts/syncPromos.js  # probar sync de promociones aislado
```
