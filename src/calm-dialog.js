/**
 * Pedagogo Desk: Serene Calm Confirmation Dialog 🌿
 * Non-blocking, Promise-based modal replacing native window.confirm().
 * Grounded in Calm UX: gentle tones, frosted glass backdrop, keyboard accessibility (Esc/Enter).
 */

export function showCalmConfirm({
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Keep',
  tone = 'danger' // 'danger' (terracotta) | 'warning' (honey) | 'calm' (sage)
} = {}) {
  return new Promise((resolve) => {
    // Existing dialog cleanup if any
    const existing = document.getElementById('calm-dialog-backdrop');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'calm-dialog-backdrop';
    backdrop.className = 'calm-dialog-backdrop active';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');

    const toneClasses = {
      danger: 'tone-danger',
      warning: 'tone-warning',
      calm: 'tone-calm'
    };

    const toneIcons = {
      danger: '🗑️',
      warning: '⚠️',
      calm: '🌿'
    };

    const toneClass = toneClasses[tone] || 'tone-danger';
    const toneIcon = toneIcons[tone] || '🌿';

    backdrop.innerHTML = `
      <div class="calm-dialog-card ${toneClass}" tabindex="-1">
        <div class="calm-dialog-header">
          <div class="calm-dialog-icon">${toneIcon}</div>
          <h3 class="calm-dialog-title">${escapeDialogHtml(title)}</h3>
        </div>
        <div class="calm-dialog-body">
          <p class="calm-dialog-msg">${escapeDialogHtml(message)}</p>
        </div>
        <div class="calm-dialog-actions">
          <button type="button" class="btn-subtle" id="calm-dialog-btn-cancel">
            ${escapeDialogHtml(cancelText)}
          </button>
          <button type="button" class="btn-calm-confirm ${toneClass}" id="calm-dialog-btn-confirm">
            ${escapeDialogHtml(confirmText)}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const card = backdrop.querySelector('.calm-dialog-card');
    const btnCancel = backdrop.querySelector('#calm-dialog-btn-cancel');
    const btnConfirm = backdrop.querySelector('#calm-dialog-btn-confirm');

    // Auto-focus cancel by default for psychological safety
    btnCancel?.focus();

    const cleanup = (confirmed) => {
      document.removeEventListener('keydown', handleKeyDown);
      backdrop.classList.remove('active');
      setTimeout(() => backdrop.remove(), 180);
      resolve(confirmed);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup(false);
      } else if (e.key === 'Enter' && document.activeElement === btnConfirm) {
        e.preventDefault();
        cleanup(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    btnCancel?.addEventListener('click', () => cleanup(false));
    btnConfirm?.addEventListener('click', () => cleanup(true));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup(false);
    });
  });
}

function escapeDialogHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
