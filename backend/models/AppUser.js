const { DataTypes } = require('sequelize');
const sequelize = require('../db'); // Asegúrate de que la ruta al archivo de conexión sea correcta

const AppUser = sequelize.define('AppUser', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  usuario: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  clave: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  rol: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['ADMIN', 'VENDEDOR', 'DESPACHADOR', 'SUPERVISOR']],
    },
  },
  rutas_asignadas: {
    type: DataTypes.ARRAY(DataTypes.STRING), // Almacena las rutas asignadas como un array de strings
    defaultValue: [],  // Si no se asigna ninguna ruta, se almacenará un array vacío
  },
  // Módulos del dashboard que el usuario puede ver (privilegios editables desde la UI).
  // Vacío = usa los permisos por defecto del rol/canal. Con valores = lista explícita.
  modulos_permitidos: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
  // Secciones permitidas por módulo: { "/dashboard/botellon": ["TIENDAS"], ... }.
  // Módulo concedido sin secciones aquí = ve todo ese módulo.
  modulo_secciones: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  creado_en: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  actualizado_en: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'app_users', // Nombre de la tabla en la base de datos
  timestamps: false, // Desactivamos los timestamps automáticos si no los necesitamos
});

module.exports = AppUser;
