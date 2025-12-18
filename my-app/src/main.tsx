// import React from "react";
// import ReactDOM from "react-dom/client";
// import { BrowserRouter, Routes, Route } from "react-router-dom";

// import DashboardPreventa from "./pages/pagesPreventa/DashboardPreventa";
// import DetallePreventasPage from "./pages/pagesPreventa/DetallePreventasPage";
// import ConfigurarMetas from "./pages/pagesPreventa/ConfigurarMetas";
// import LoginScreen from "../src/pages/Login";
// import DetalleRuta from "./pages/pagesPreventa/DetalleRuta";

// // Importa el AuthProvider
// import { AuthProvider } from '../src/components/auth/AuthContext';

// import "./index.css";

// // Aquí envuelves tu aplicación con el AuthProvider
// ReactDOM.createRoot(document.getElementById("root")!).render(
//   <React.StrictMode>
//     <AuthProvider> {/* Envuelve toda tu aplicación con el AuthProvider */}
//       <BrowserRouter>
//         <Routes>
//           {/* Aquí se configura el enrutado */}
//           <Route path="/" element={<LoginScreen />} />
//           <Route path="/dashboard/preventa" element={<DashboardPreventa />} />
//           <Route path="/detalle-ruta/:ruta/:anio/:mes" element={<DetallePreventasPage />} />
//           <Route path="/configurar-metas" element={<ConfigurarMetas />} />
//           <Route path="/ruta/:usuario" element={<DetalleRuta />} />
//         </Routes>
//       </BrowserRouter>
//     </AuthProvider>
//   </React.StrictMode>
// );


import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import DashboardPreventa from "./pages/pagesPreventa/DashboardPreventa";
import DetallePreventasPage from "./pages/pagesPreventa/DetallePreventasPage";
import ConfigurarMetas from "./pages/pagesPreventa/ConfigurarMetas";
import LoginScreen from "../src/pages/Login";
import DetalleRuta from "./pages/pagesPreventa/DetalleRuta";

// Importa el AuthProvider
import { AuthProvider } from '../src/components/auth/AuthContext';

import "./index.css";

// Aquí envuelves tu aplicación con el AuthProvider y el Router
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter> {/* Asegúrate de que BrowserRouter esté arriba de AuthProvider */}
      <AuthProvider>
        <Routes>
          {/* Aquí se configura el enrutado */}
          <Route path="/" element={<LoginScreen />} />
          <Route path="/dashboard/preventa" element={<DashboardPreventa />} />
          <Route path="/detalle-ruta/:ruta/:anio/:mes" element={<DetallePreventasPage />} />
          <Route path="/configurar-metas" element={<ConfigurarMetas />} />
          <Route path="/ruta/:usuario" element={<DetalleRuta />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
