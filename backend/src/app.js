require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./config/database');
const sedesRoutes = require('./routes/sedesRoutes');
const laboratoriosRoutes = require('./routes/laboratoriosRoutes');
const categoriasRoutes = require('./routes/categoriasRoutes');
const estadosRoutes = require('./routes/estadosRoutes');
const equiposRoutes = require('./routes/equiposRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/sedes', sedesRoutes);
app.use('/api/laboratorios', laboratoriosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/estados', estadosRoutes);
app.use('/api/equipos', equiposRoutes);

// Verificar que Express funciona
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API del Sistema de Inventario PES funcionando'
  });
});

// Verificar la conexión con PostgreSQL en Neon
app.get('/api/health/db', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT current_database() AS base_datos, current_user AS usuario'
    );

    res.json({
      success: true,
      message: 'Conexión con PostgreSQL exitosa',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error de conexión con PostgreSQL:', error.message);

    res.status(500).json({
      success: false,
      message: 'No se pudo conectar con PostgreSQL'
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor PES ejecutándose en http://localhost:${PORT}`);
});