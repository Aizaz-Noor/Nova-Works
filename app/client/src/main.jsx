import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './erp-shell.css';
import './premium-ui.css';
import './apple-ui.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
