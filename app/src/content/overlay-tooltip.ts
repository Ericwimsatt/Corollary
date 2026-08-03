const tooltipStyle = [
  'display:none',
  'position:fixed',
  'z-index:2147483647',
  'min-width:220px',
  'max-width:320px',
  'padding:8px 10px',
  'border-radius:8px',
  'border:1px solid #b7c6d0',
  'background:#fff',
  'color:#101820',
  'box-shadow:0 12px 26px rgba(16,24,32,.28)',
  'font-size:11px',
  'font-weight:700',
  'line-height:1.35',
  'white-space:pre-line',
  'pointer-events:none',
].join(';');

export const tooltipLabelStyle = [
  'font-weight:900',
].join(';');

export function createOverlayTooltip(extraClassName = ''): HTMLDivElement {
  const tooltip = document.createElement('div');
  tooltip.className = ['dh-overlay-tooltip', extraClassName].filter(Boolean).join(' ');
  tooltip.setAttribute('style', tooltipStyle);
  document.body.appendChild(tooltip);
  return tooltip;
}

export function attachOverlayTooltip(target: HTMLElement, tooltip: HTMLElement) {
  const show = () => {
    const rect = target.getBoundingClientRect();
    tooltip.style.display = 'block';
    const tooltipRect = tooltip.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - tooltipRect.width - 8);
    const spaceAbove = rect.top - 8;
    const top = spaceAbove >= tooltipRect.height + 6
      ? rect.top - tooltipRect.height - 6
      : Math.min(rect.bottom + 6, window.innerHeight - tooltipRect.height - 8);
    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;
  };
  const hide = () => {
    tooltip.style.display = 'none';
  };

  target.addEventListener('mouseenter', show);
  target.addEventListener('mouseleave', hide);
  target.addEventListener('focusin', show);
  target.addEventListener('focusout', hide);
}
