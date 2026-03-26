import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import LoginScreen from "./pages/Login";

import Dashboardconsolidado from "./pages/pagesConsolidado/Dashboardconsolidado";

import DashboardPreventa from "./pages/pagesPreventa/DashboardPreventa";
import DetallePreventasPage from "./pages/pagesPreventa/DetallePreventasPage";
import ConfigurarMetas from "./pages/pagesPreventa/ConfigurarMetas";
import DetalleRuta from "./pages/pagesPreventa/DetalleRuta";
import DetalleRutaDescartable from "./pages/pagesPreventa/DetalleRutaDescartable";
import DetalleCotsaPage from "./pages/pagesPreventa/DetalleCotsaPage";
import DetalleDescartableOdooPage from "./pages/pagesPreventa/DetalleDescartableOdooPage";
import DetalleClientesCanalDescartablePage from "./pages/pagesPreventa/DetalleClientesCanalDescartablePage";

import DashboardBotellon from "./pages/pagesBotellon/DashboardBotellon";
import DetalleBotellonPage from "./pages/pagesBotellon/DetalleBotellonPage";
import DetalleVipBotellonPage from "./pages/pagesBotellon/DetalleVipBotellonPage";
import DetalleClientesDomicilioPage from "./pages/pagesBotellon/DetalleClientesDomicilioPage";
import DetalleClientesEmpresasPage from "./pages/pagesBotellon/DetalleClientesEmpresasPage";
import ConfigurarMetasBotellon from "./pages/pagesBotellon/ConfigurarMetasBotellon";

import DashboardHielo from "./pages/pagesHielo/DashboardHielo";
import DetalleHieloPage from "./pages/pagesHielo/DetalleHieloPage";

import DashboardRutasVisitas from "./pages/pagesRutasVisitas/DashboardRutasVisitas";

import { AuthProvider } from "./components/auth/AuthContext";
import { SyncProvider } from "./context/SyncContext";

import { Toaster } from "react-hot-toast";
import ChatGlobal from "./components/elements/ChatGlobal";

import "./index.css";
import DashboardClientes from "./pages/pagesClientesGeneral/DashboardClientes";
import CreacionUsuario from "./pages/pageCreacionUsuario/CreacionUsuario";


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster position="top-right" reverseOrder={false} />

      <AuthProvider>
        <SyncProvider>

          {/* RUTAS */}
          <Routes>
            <Route path="/" element={<LoginScreen />} />

            {/* CONSOLIDADO */}
            <Route
              path="/dashboard/consolidado"
              element={<Dashboardconsolidado />}
            />

            {/* PREVENTA */}
            <Route
              path="/dashboard/preventa"
              element={<DashboardPreventa />}
            />
            <Route
              path="/detalle-ruta/:ruta/:anio/:mes"
              element={<DetallePreventasPage />}
            />
            <Route
              path="/configurar-metas"
              element={<ConfigurarMetas />}
            />
            <Route
              path="/ruta/:usuario"
              element={<DetalleRuta />}
            />
            <Route
              path="/ruta2/:usuario"
              element={<DetalleRutaDescartable />}
            />
            <Route
              path="/cotsa/clientes/:anio/:mes"
              element={<DetalleCotsaPage />}
            />
            <Route
              path="/descartable-odoo/clientes/:anio/:mes"
              element={<DetalleDescartableOdooPage />}
            />
            <Route
              path="/descartable-canal/:canal/clientes/:anio/:mes"
              element={<DetalleClientesCanalDescartablePage />}
            />

            {/* BOTELLONES */}
            <Route
              path="/dashboard/botellon"
              element={<DashboardBotellon />}
            />
            <Route
              path="/dashboard/botellon/:usuario"
              element={<DetalleBotellonPage />}
            />
            <Route
              path="/vip-botellon/clientes/:anio/:mes"
              element={<DetalleVipBotellonPage />}
            />
            <Route
              path="/domicilio-botellon/clientes/:anio/:mes"
              element={<DetalleClientesDomicilioPage />}
            />
            <Route
              path="/empresas-botellon/clientes/:anio/:mes"
              element={<DetalleClientesEmpresasPage />}
            />
            <Route
              path="/configurar-metas-botellon/:seccion"
              element={<ConfigurarMetasBotellon />}
            />

            {/* HIELO */}
            <Route
              path="/dashboard/hielo"
              element={<DashboardHielo />}
            />
            <Route
              path="/detalle-hielo/:ruta/:anio/:mes"
              element={<DetalleHieloPage />}
            />

            {/* VISITAS */}
            <Route
              path="/dashboard/rutas-visitas"
              element={<DashboardRutasVisitas />}
            />

            {/* Clientes */}
            <Route
              path="/dashboard/clientes"
              element={<DashboardClientes />}
            />

             {/* Clientes */}
            <Route
              path="/dashboard/crearusuarios"
              element={<CreacionUsuario/>}
            />
          </Routes>

          {/* CHAT GLOBAL (FUERA DE ROUTES) */}
          <ChatGlobal />

        </SyncProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);