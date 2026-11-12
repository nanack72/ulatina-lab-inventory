const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middlewares/authMiddleware');

const {
  obtenerHistorialGeneral
} = require('../controllers/historialGeneralController');

router.use(verificarToken);

router.get('/', obtenerHistorialGeneral);

module.exports = router;
