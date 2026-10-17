const express = require('express');
const router = express.Router();

const {
  obtenerEstados
} = require('../controllers/estadosController');

router.get('/', obtenerEstados);

module.exports = router;