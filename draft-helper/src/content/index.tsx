import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../panels/App';

const ROOT_ID = 'draft-helper-root';

function injectPageStyles() {
  const style = document.createElement('style');
  style.textContent = `
    [class*="SnakeDraft_snake-draft-inner-container"] {
      max-width: none !important;
    }
    #draft-helper-root {
      padding: 10px 12px 12px !important;
      margin: 10px 10px 12px 0 !important;
      background: #dfe8ee !important;
      border: 1px solid #b6c5cf !important;
      border-radius: 16px !important;
      box-shadow:
        0 0 0 2px rgba(255, 255, 255, 0.82),
        0 16px 34px rgba(16, 24, 32, 0.3) !important;
    }
    .LiveDraft_live-draft,
    .LiveDraft-Mobile_live-draft-mobile__body {
      padding: 0 24px !important;
    }
  `;
  document.head.appendChild(style);
}

function inject() {
  if (document.getElementById(ROOT_ID)) return;

  console.log('[DraftHelper] inject() called');

  injectPageStyles();

  const host = document.createElement('div');
  host.id = ROOT_ID;

  const queue = document.querySelector('[class*="LiveDraft_queue"]');
  const draftTable = document.querySelector('[class*="LiveDraft_draft-table"]');

  if (queue && draftTable) {
    console.log('[DraftHelper] Desktop layout detected');
    queue.parentNode?.insertBefore(host, draftTable);
  } else {
    const body = document.querySelector('.LiveDraft-Mobile_live-draft-mobile__body');
    if (body) {
      console.log('[DraftHelper] Mobile layout detected, appending to body');
      body.appendChild(host);
    } else {
      const draftSection = document.querySelector('.LiveDraft_live-draft');
      if (draftSection) {
        console.log('[DraftHelper] Appending to draft section');
        draftSection.appendChild(host);
      } else {
        console.log('[DraftHelper] No layout found, retrying in 1s');
        setTimeout(inject, 1000);
        return;
      }
    }
  }

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
