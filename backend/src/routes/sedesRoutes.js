const express = require('express');
const router = express.Router();

const { obtenerSedes } = require('../controllers/sedesController');

router.get('/', obtenerSedes);

module.exports = router;