import axios from "axios";

const URL_API = "http://localhost:5000/api";

// Obtener cabeceras de facturas (ventas)
export const obtenerCabeceras = async () => {
  try {
    const respuesta = await axios.get(`${URL_API}/headers`);
    return respuesta.data;
  } catch (error) {
    console.error("Error al obtener cabeceras:", error);
    return [];
  }
};

// Obtener detalles de facturas (productos)
export const obtenerDetalles = async () => {
  try {
    const respuesta = await axios.get(`${URL_API}/details`);
    return respuesta.data;
  } catch (error) {
    console.error("Error al obtener detalles:", error);
    return [];
  }
};
