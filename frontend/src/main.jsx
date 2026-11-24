import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/tokens.css';
import './styles/componentes.css';
import App from './App.jsx';
import CentroNotificaciones from './components/comunes/CentroNotificaciones.jsx';
import './styles/estandar.css';
import './styles/selectores.css';
import './styles/insignias.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <CentroNotificaciones />
  </StrictMode>
);
