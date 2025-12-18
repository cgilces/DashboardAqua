const express = require('express');
const router = express.Router();

const { 
  crearUsuario, 
  obtenerUsuarios,
  editarUsuario,
  eliminarUsuario
} = require('../../controllers/controllerLogin/usuariosController');

// Crear usuario
router.post('/crear', crearUsuario);

// Listar usuarios
router.get('/listausuario', obtenerUsuarios);

// Editar usuario
router.put('/editar/:id', editarUsuario);

// Eliminar usuario
router.delete('/eliminar/:id', eliminarUsuario);

module.exports = router;
