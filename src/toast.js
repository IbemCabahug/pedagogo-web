/**
 * Pedagogo Desk: Serene Pedagogical Toast Notification System 🌿
 * Non-blocking, peaceful feedback toasts that replace disruptive browser alerts.
 */

export function showToast(message, type = 'info', duration = 4500) {
  let container = document.getElementById('pedagogo-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'pedagogo-toast-container';
    container.className = 'pedagogo-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `pedagogo-toast toast-${type}`;

  const icon = type === 'success' ? '🌿' : type === 'warning' ? '⚠️' : type === 'celebrate' ? '🎉' : '✨';
  
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-content">${escapeHtml(message).replace(/\n/g, '<br>')}</div>
    <button class="toast-close" title="Dismiss">✕</button>
  `;

  container.appendChild(toast);

  // Trigger entrance animation
  const raf = typeof requestAnimationFrame === 'function' 
    ? requestAnimationFrame 
    : (cb) => setTimeout(cb, 16);

  raf(() => {
    toast.classList.add('toast-visible');
  });

  let timer = null;
  const dismiss = () => {
    if (timer) clearTimeout(timer);
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');
    setTimeout(() => {
      if (typeof toast.remove === 'function') {
        toast.remove();
      } else if (toast.parentNode && typeof toast.parentNode.removeChild === 'function') {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  };

  toast.querySelector('.toast-close')?.addEventListener('click', dismiss);
  timer = setTimeout(dismiss, duration);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

if (typeof window !== 'undefined') {
  window.showToast = showToast;
}
