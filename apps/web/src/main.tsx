import '@skin/fonts';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './styles.css';
import './motion.css';
import './select.css';
import { dismissLoader } from './loader';
import { brand } from './brand';
const SiteShell = React.lazy(() => import('./SiteShell'));
// Mounts only after the lazy app shell has loaded, which is when the loading screen can go.
function LoaderReady() {
  React.useEffect(() => dismissLoader(), []);
  return null;
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <React.Suspense
        fallback={
          <main className="state-screen" aria-label="Loading">
            <img src={brand.assets.emblem} alt={brand.name} width="70" height="75" />
          </main>
        }
      >
        <LoaderReady />
        <Routes>
          <Route path="*" element={<SiteShell />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  </React.StrictMode>,
);
if ('serviceWorker' in navigator && import.meta.env.PROD)
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
