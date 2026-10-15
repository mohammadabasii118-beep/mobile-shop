import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startMusic } from './music';
import { startClickSfx } from './sfx';
import './styles.css';

startMusic(); // موسیقی از همان لحظه‌ی باز شدن بازی
startClickSfx(); // صدای کلیک دکمه‌ها

createRoot(document.getElementById('root')!).render(<App />);
