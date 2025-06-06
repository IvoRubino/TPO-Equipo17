module.exports = (req, res, next) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      message: 'El cuerpo de la solicitud no puede estar vacío'
    });
  }

  next();
};