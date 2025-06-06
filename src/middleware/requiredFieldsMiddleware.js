module.exports = (camposRequeridos) => {
  return (req, res, next) => {
    const faltantes = camposRequeridos.filter((campo) => !req.body?.[campo]);

    if (faltantes.length > 0) {
      return res.status(400).json({
        message: `Faltan campos obligatorios: ${faltantes.join(', ')}`
      });
    }

    next();
  };
};