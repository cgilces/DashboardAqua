import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import LoginScreen from "./pages/Login";
import DashboardPreventa from "./pages/pagesPreventa/DashboardPreventa";
import DetallePreventasPage from "./pages/pagesPreventa/DetallePreventasPage";
import ConfigurarMetas from "./pages/pagesPreventa/ConfigurarMetas";
import DetalleRuta from "./pages/pagesPreventa/DetalleRuta";
import DetalleRutaDescartable from "./pages/pagesPreventa/DetalleRutaDescartable";

import DashboardBotellon from "./pages/pagesBotellon/DashboardBotellon";

import DashboardHielo from "./pages/pagesHielo/DashboardHielo";
import DetalleHieloPage from "./pages/pagesHielo/DetalleHieloPage";

import DashboardRutasVisitas from "./pages/pagesRutasVisitas/DashboardRutasVisitas";

import { AuthProvider } from "./components/auth/AuthContext";
import { SyncProvider } from "./context/SyncContext"; // 👈 NUEVO

import { Toaster } from "react-hot-toast";


import "./index.css";
import DetalleBotellonPage from "./pages/pagesBotellon/DetalleBotellonPage";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster position="top-right" reverseOrder={false} />
      <AuthProvider>
        <SyncProvider> {/* 👈 ENVUELVE TODO */}
          <Routes>
            <Route path="/" element={<LoginScreen />} />
            {/* PREVENTA */}
            <Route path="/dashboard/preventa" element={<DashboardPreventa />} />
            <Route path="/detalle-ruta/:ruta/:anio/:mes" element={<DetallePreventasPage />} />
            <Route path="/configurar-metas" element={<ConfigurarMetas />} />
            <Route path="/ruta/:usuario" element={<DetalleRuta />} />
            <Route path="/ruta2/:usuario" element={<DetalleRutaDescartable />} />

            {/* BOTELLONES */}
            <Route path="/dashboard/botellon" element={<DashboardBotellon />} />
            <Route path="/dashboard/botellon/:usuario" element={<DetalleBotellonPage />} />


            {/* HIELO */}
            <Route path="/dashboard/hielo" element={<DashboardHielo />} />
            <Route path="/detalle-hielo/:ruta/:anio/:mes" element={<DetalleHieloPage />} />

            {/* VISITAS */}
            <Route path="/dashboard/rutas-visitas" element={<DashboardRutasVisitas />} />
          </Routes>
        </SyncProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
