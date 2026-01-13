import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import LoginScreen from "./pages/Login";
import DashboardPreventa from "./pages/pagesPreventa/DashboardPreventa";
import DetallePreventasPage from "./pages/pagesPreventa/DetallePreventasPage";
import ConfigurarMetas from "./pages/pagesPreventa/ConfigurarMetas";
import DetalleRuta from "./pages/pagesPreventa/DetalleRuta";

import DashboardBotellon from "./pages/pagesBotellon/DashboardBotellon";
import BotellonesPorGrupo from "./pages/pagesBotellon/BotellonesPorGrupo";

import { AuthProvider } from "./components/auth/AuthContext";
import "./index.css";
import DetalleRutaDescartable from "./pages/pagesPreventa/DetalleRutaDescartable";
import DashboardHielo from "./pages/pagesHielo/DashboardHielo";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
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
          <Route path="/dashboard/botellon/grupo/:grupo" element={<BotellonesPorGrupo />}/>

          {/* HIELO */}
          <Route path="/dashboard/hielo" element={<DashboardHielo />} />




        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
