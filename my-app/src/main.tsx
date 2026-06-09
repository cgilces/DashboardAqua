import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import LoginScreen from "./pages/Login";
import RegistroScreen from "./pages/Registro";

import Dashboardconsolidado from "./pages/pagesConsolidado/Dashboardconsolidado";

import DashboardPreventa from "./pages/pagesPreventa/DashboardPreventa";
import DetallePreventasPage from "./pages/pagesPreventa/DetallePreventasPage";
import ConfigurarMetas from "./pages/pagesPreventa/ConfigurarMetas";
import DetalleRuta from "./pages/pagesPreventa/DetalleRuta";
import DetalleRutaDescartable from "./pages/pagesPreventa/DetalleRutaDescartable";
import DetalleCOTTSAPage from "./pages/pagesPreventa/DetalleCOTTSAPage";
import DetalleDescartableOdooPage from "./pages/pagesPreventa/DetalleDescartableOdooPage";
import DetalleClientesCanalDescartablePage from "./pages/pagesPreventa/DetalleClientesCanalDescartablePage";

import DashboardBotellon from "./pages/pagesBotellon/DashboardBotellon";
import DetalleBotellonPage from "./pages/pagesBotellon/DetalleBotellonPage";
import DetalleVipBotellonPage from "./pages/pagesBotellon/DetalleVipBotellonPage";
import VipClientesPorTipoPage from "./pages/pagesBotellon/VipClientesPorTipoPage";
import VipDetalleClientePage from "./pages/pagesBotellon/VipDetalleClientePage";
import EmpresasClientesPorTipoPage from "./pages/pagesBotellon/EmpresasClientesPorTipoPage";
import EmpresasDetalleClientePage from "./pages/pagesBotellon/EmpresasDetalleClientePage";
import DetalleClientesDomicilioPage from "./pages/pagesBotellon/DetalleClientesDomicilioPage";
import DetalleClientesEmpresasPage from "./pages/pagesBotellon/DetalleClientesEmpresasPage";
import DetalleClientesCanalBotellonPage from "./pages/pagesBotellon/DetalleClientesCanalBotellonPage";
import ConfigurarMetasBotellon from "./pages/pagesBotellon/ConfigurarMetasBotellon";

import DashboardHielo from "./pages/pagesHielo/DashboardHielo";
import DetalleHieloPage from "./pages/pagesHielo/DetalleHieloPage";
import DetalleHieloOdooPage from "./pages/pagesHielo/DetalleHieloOdooPage";

import DashboardPlus from "./pages/pagesPlus/DashboardPlus";
import DetallePlusOdooPage from "./pages/pagesPlus/DetallePlusOdooPage";

import DashboardCafe from "./pages/pagesCafe/DashboardCafe";
import DetalleClientesCafePage from "./pages/pagesCafe/DetalleClientesCafePage";

import DashboardRutasVisitas from "./pages/pagesRutasVisitas/DashboardRutasVisitas";

import DashboardGerencia from "./pages/pagesGerencia/DashboardGerencia";
import DashboardPromos from "./pages/pagesPromos/DashboardPromos";

import { AuthProvider } from "./components/auth/AuthContext";
import { SyncProvider } from "./context/SyncContext";

import { Toaster } from "react-hot-toast";
import ChatGlobal from "./components/elements/ChatGlobal";

import "./index.css";
import DashboardClientes from "./pages/pagesClientesGeneral/DashboardClientes";
import EmpresaDetalle from "./pages/pagesClientesGeneral/EmpresaDetalle";
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
            <Route path="/registro" element={<RegistroScreen />} />

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
              path="/COTTSA/clientes/:anio/:mes"
              element={<DetalleCOTTSAPage />}
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
              path="/vip-botellon/tipo/:tipo/:anio/:mes"
              element={<VipClientesPorTipoPage />}
            />
            <Route
              path="/vip-botellon/cliente/:clienteCode/:anio/:mes"
              element={<VipDetalleClientePage />}
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
              path="/empresas-botellon/tipo/:tipo/:anio/:mes"
              element={<EmpresasClientesPorTipoPage />}
            />
            <Route
              path="/empresas-botellon/cliente/:clienteCode/:anio/:mes"
              element={<EmpresasDetalleClientePage />}
            />
            <Route
              path="/quito-botellon/clientes/:anio/:mes"
              element={<DetalleClientesCanalBotellonPage
                titulo="Clientes Quito — Botellón"
                endpoint="clientes-quito"
                excelSheet="Quito Botellón"
                excelFile="clientes_quito_botellon" />}
            />
            <Route
              path="/website-botellon/clientes/:anio/:mes"
              element={<DetalleClientesCanalBotellonPage
                titulo="Clientes Website — Botellón"
                endpoint="clientes-website"
                excelSheet="Website Botellón"
                excelFile="clientes_website_botellon" />}
            />
            <Route
              path="/mayorista-botellon/clientes/:anio/:mes"
              element={<DetalleClientesCanalBotellonPage
                titulo="Clientes Mayorista — Botellón"
                endpoint="clientes-mayorista"
                excelSheet="Mayorista Botellón"
                excelFile="clientes_mayorista_botellon" />}
            />
            <Route
              path="/tiendas-botellon/clientes/:anio/:mes"
              element={<DetalleClientesCanalBotellonPage
                titulo="Clientes Tiendas — Botellón"
                endpoint="clientes-tiendas"
                excelSheet="Tiendas Botellón"
                excelFile="clientes_tiendas_botellon" />}
            />
            <Route
              path="/tiendas-vip-botellon/clientes/:anio/:mes"
              element={<DetalleClientesCanalBotellonPage
                titulo="Clientes Tiendas VIP — Botellón"
                endpoint="clientes-tiendas-vip"
                excelSheet="Tiendas VIP Botellón"
                excelFile="clientes_tiendas_vip_botellon" />}
            />
            <Route
              path="/rural-botellon/clientes/:anio/:mes"
              element={<DetalleClientesCanalBotellonPage
                titulo="Clientes Rural — Botellón"
                endpoint="clientes-rural"
                excelSheet="Rural Botellón"
                excelFile="clientes_rural_botellon" />}
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
            <Route
              path="/hielo-odoo/clientes/:anio/:mes"
              element={<DetalleHieloOdooPage />}
            />

            {/* PLUS ELECTROLYTES */}
            <Route
              path="/dashboard/plus"
              element={<DashboardPlus />}
            />
            <Route
              path="/plus-odoo/clientes/:anio/:mes"
              element={<DetallePlusOdooPage />}
            />

            {/* CAFÉ — IIBC S.A. */}
            <Route
              path="/dashboard/cafe"
              element={<DashboardCafe />}
            />
            <Route
              path="/cafe/clientes/:anio/:mes"
              element={<DetalleClientesCafePage />}
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
            <Route
              path="/dashboard/empresa/:ruc"
              element={<EmpresaDetalle />}
            />

             {/* Clientes */}
            <Route
              path="/dashboard/crearusuarios"
              element={<CreacionUsuario/>}
            />

            {/* GERENCIA */}
            <Route
              path="/dashboard/gerencia"
              element={<DashboardGerencia />}
            />

            {/* PROMOCIONES */}
            <Route
              path="/dashboard/promociones"
              element={<DashboardPromos />}
            />
          </Routes>

          {/* CHAT GLOBAL (FUERA DE ROUTES) */}
          <ChatGlobal />

        </SyncProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);