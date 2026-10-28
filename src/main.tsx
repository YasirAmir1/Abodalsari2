import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppDialogProvider } from './components/AppDialogProvider';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <AppDialogProvider>
    <App />
  </AppDialogProvider>
);
