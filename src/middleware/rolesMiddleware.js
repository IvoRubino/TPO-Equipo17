exports.permitirRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    const usuario = req.user;

    if (!usuario || !rolesPermitidos.includes(usuario.tipo)) {
      return res.status(403).json({ message: 'No tenés permiso para acceder a esta ruta' });
    }

    next();
  };
};