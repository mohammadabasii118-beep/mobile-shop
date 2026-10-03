import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };
const Router = import.meta.env.VITE_DEMO ? MemoryRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Router future={future} {...(import.meta.env.VITE_DEMO ? { initialEntries: [import.meta.env.VITE_START || '/'] } : {})}><App /></Router></React.StrictMode>,
);
