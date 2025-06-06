const multer = require('multer');
const path = require('path');
const fs = require('fs');

function crearMiddlewareMulter(tipoCarpeta, opciones = {}) {
  const extensionesPermitidas = opciones.extensiones || []; // ej: ['.jpg', '.jpeg', '.png']

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const destino = path.join('uploads', tipoCarpeta);
      if (!fs.existsSync(destino)) {
        fs.mkdirSync(destino, { recursive: true });
      }
      cb(null, destino);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const nombreUnico = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, nombreUnico);
    }
  });

  const fileFilter = (req, file, cb) => {
    if (extensionesPermitidas.length > 0) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!extensionesPermitidas.includes(ext)) {
        return cb(new Error(`Tipo de archivo no permitido: ${ext}`));
      }
    }
    cb(null, true);
  };

  return multer({ storage, fileFilter });
}

module.exports = crearMiddlewareMulter;