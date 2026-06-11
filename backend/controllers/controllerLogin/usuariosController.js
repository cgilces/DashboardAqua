const bcrypt = require('bcryptjs');
const { AppUser } = require('../../models');

/* =============================
   CREAR USUARIO
============================= */

const crearUsuario = async (req, res) => {
  try {
    let { usuario, clave, rol, rutas_asignadas, modulos_permitidos } = req.body;

    console.log("Creando usuario:", { usuario, clave, rol, rutas_asignadas });

    // Normalizar para aceptar ambos formatos
    const rutasFinales = (rutas_asignadas && rutas_asignadas.length > 0) ? rutas_asignadas : null;  // Asignar null si rutas_asignadas está vacío
    console.log("Rutas finales:", rutasFinales);

    if (!usuario || !clave || !rol) {
      console.log("Campos faltantes: Usuario, clave y rol son obligatorios.");
      return res.status(400).json({
        ok: false,
        msg: "Usuario, clave y rol son obligatorios"
      });
    }

    usuario = usuario.toString().trim().toUpperCase();
    clave = clave.toString().trim();

    // Verificar si el usuario ya existe
    const existente = await AppUser.findOne({ where: { usuario } });
    console.log("Usuario existente:", existente);

    if (existente) {
      return res.status(409).json({
        ok: false,
        msg: "El usuario ya existe"
      });
    }

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const claveHasheada = await bcrypt.hash(clave, salt);
    console.log("Contraseña encriptada:", claveHasheada);

    // Crear usuario
    const nuevo = await AppUser.create({
      usuario,
      clave: claveHasheada,
      rol,
      rutas_asignadas: rutasFinales,  // Se inserta NULL si rutas está vacío
      modulos_permitidos: Array.isArray(modulos_permitidos) ? modulos_permitidos : []
    });
    console.log("Nuevo usuario creado:", nuevo);

    return res.status(201).json({
      ok: true,
      msg: "Usuario creado exitosamente",
      user: {
        id: nuevo.id,
        usuario: nuevo.usuario,
        rol: nuevo.rol,
        rutas_asignadas: nuevo.rutas_asignadas
      }
    });

  } catch (error) {
    console.error("Error al crear usuario:", error);
    return res.status(500).json({
      ok: false,
      msg: "Error interno del servidor"
    });
  }
};




/* =============================
   OBTENER TODOS LOS USUARIOS
============================= */
const obtenerUsuarios = async (req, res) => {
  try {
    const usuarios = await AppUser.findAll({
      attributes: ["id", "usuario", "rol", "rutas_asignadas", "modulos_permitidos"],

      order: [['id', 'ASC']]
    });

    return res.status(200).json({
      ok: true,
      total: usuarios.length,
      usuarios
    });

  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    return res.status(500).json({
      ok: false,
      msg: "Error interno del servidor"
    });
  }
};


/* =============================
   EDITAR USUARIO
============================= */
const editarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    let { usuario, clave, rol, rutas_asignadas, modulos_permitidos } = req.body;

    const user = await AppUser.findByPk(id);

    if (!user) {
      return res.status(404).json({
        ok: false,
        msg: "Usuario no encontrado"
      });
    }

    // Si viene un nuevo usuario, validarlo
    if (usuario) {
      usuario = usuario.toString().trim().toUpperCase();

      // verificar duplicado
      const duplicado = await AppUser.findOne({
        where: { usuario },
      });

      if (duplicado && duplicado.id != id) {
        return res.status(409).json({
          ok: false,
          msg: "Ese nombre de usuario ya existe"
        });
      }

      user.usuario = usuario;
    }

    // Si clave vino, entonces re-hashearla
    if (clave && clave.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      user.clave = await bcrypt.hash(clave.trim(), salt);
    }

    if (rol) user.rol = rol;
    let rutasFinales = rutas_asignadas ?? req.body.rutasAsignadas;

    if (rutasFinales) {
      user.rutas_asignadas = rutasFinales;
    }

    // Privilegios de módulos: se acepta array vacío (para limpiar permisos explícitos).
    if (Array.isArray(modulos_permitidos)) {
      user.modulos_permitidos = modulos_permitidos;
    }

    await user.save();

    return res.status(200).json({
      ok: true,
      msg: "Usuario actualizado exitosamente",
      usuario: user
    });

  } catch (error) {
    console.error("Error al editar usuario:", error);
    return res.status(500).json({
      ok: false,
      msg: "Error interno del servidor"
    });
  }
};


/* =============================
   ELIMINAR USUARIO
============================= */
const eliminarUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await AppUser.findByPk(id);

    if (!user) {
      return res.status(404).json({
        ok: false,
        msg: "Usuario no encontrado"
      });
    }

    await user.destroy();

    return res.status(200).json({
      ok: true,
      msg: "Usuario eliminado correctamente"
    });

  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    return res.status(500).json({
      ok: false,
      msg: "Error interno del servidor"
    });
  }
};



module.exports = {
  crearUsuario,
  obtenerUsuarios,
  editarUsuario,
  eliminarUsuario
};
