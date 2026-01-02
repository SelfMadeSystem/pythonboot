/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */
import App from './FloatingApp';
import { createRoot } from 'react-dom/client';

declare global {
  interface Window {
    CDN: boolean;
    MAIN: boolean;
  }
}

// Check if the script is being served from a different host than the page
const scriptUrl =
  import.meta?.url ?? (document.currentScript as HTMLScriptElement)?.src; // put .meta?. to avoid bundler polyfill
const scriptHost = new URL(scriptUrl).host;
const pageHost = window.location.host;
window.CDN = scriptHost !== pageHost;
window.MAIN = !window.CDN;

function start() {
  const root = createRoot(
    window.MAIN ? document.getElementById('root')! : document.body,
  );
  root.render(<App />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
