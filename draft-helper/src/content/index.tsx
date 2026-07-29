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
      padding: 2px;
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
      color: #e0e0e0;
      background: #1e1e1e;
      border-radius: 8px;
      padding: 12px;
      margin: 8px 0;
      min-height: 50px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
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
