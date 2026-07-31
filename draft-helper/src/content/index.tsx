import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../panels/App';
import { getActiveAdapter } from './adapters';

const ROOT_ID = 'draft-helper-root';

function inject() {
  if (document.getElementById(ROOT_ID)) return;

  const adapter = getActiveAdapter();
  console.log('[DraftHelper] inject() called');

  adapter.ui.injectPageStyles();

  const host = document.createElement('div');
  host.id = ROOT_ID;

  const mountPoint = adapter.ui.findMountPoint();
  if (!mountPoint) {
    console.log(`[DraftHelper] No ${adapter.label} layout found, retrying in 1s`);
    setTimeout(inject, 1000);
    return;
  }
  adapter.ui.placeMount(host, mountPoint);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #101820;
      background: #edf2f5;
      border: 1px solid #c9d6de;
      border-radius: 14px;
      padding: 16px;
      margin: 0;
      min-height: 50px;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.65);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    button, input {
      font: inherit;
    }
    button:focus-visible,
    input:focus-visible {
      outline: 2px solid #1570d6;
      outline-offset: 2px;
    }
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
      margin: 0;
    }
  `;
  shadow.appendChild(style);

  const mount = document.createElement('div');
  shadow.appendChild(mount);

  const root = createRoot(mount);
  root.render(React.createElement(App));
  console.log('[DraftHelper] Mounted');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inject);
} else {
  inject();
}
