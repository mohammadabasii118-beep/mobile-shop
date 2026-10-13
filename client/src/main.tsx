import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startMusic } from './music';
import './styles.css';

startMusic(); // موسیقی از همان لحظه‌ی باز شدن بازی

createRoot(document.getElementById('root')!).render(<App />);
