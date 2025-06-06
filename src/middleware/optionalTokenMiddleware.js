const jwt = require('jsonwebtoken');

exports.verificarTokenOpcional = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return next(); // No hay token → continuar como usuario anónimo

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (!err) req.user = user;
    next(); // Siempre continuar
  });
};