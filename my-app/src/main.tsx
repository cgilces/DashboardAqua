import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import DashboardPreventa from "./pages/pagesPreventa/DashboardPreventa";
import DetallePreventasPage from "./pages/pagesPreventa/DetallePreventasPage";
import ConfigurarMetas from "./pages/pagesPreventa/ConfigurarMetas";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPreventa />} />
        <Route path="/dashboard/preventa" element={<DashboardPreventa />} />
        <Route path="/detalle-ruta/:ruta/:anio/:mes" element={<DetallePreventasPage />} />
        <Route path="/configurar-metas" element={<ConfigurarMetas />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
