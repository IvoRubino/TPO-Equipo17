const jwt = require('jsonwebtoken');

exports.verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return res.status(401).json({ message: 'Token requerido o malformado' });
}

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido o expirado' });

    req.user = user; // user.id, user.tipo
    next();
  });
};