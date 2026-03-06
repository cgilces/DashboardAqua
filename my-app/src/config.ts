// Configuración global de la API
const isProd = import.meta.env.PROD;

export const API_BASE_URL = isProd
    ? 'https://api.frecuencias.aqua.com.ec'
    : 'http://localhost:5000';
