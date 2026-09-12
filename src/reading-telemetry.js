/**
 * Pedagogo Desk: Reading Desk Telemetry (local-only, no network) 📊🌿
 * Sprint A — lightweight counters in localStorage so the pilot can answer:
 * "did the guard raise citation taps?" without any server or tracking.
 * Keys: pedagogo_reader_telemetry_v1 -> { eventName: count, ... }
 */

const TELEMETRY_KEY = 'pedagogo_reader_telemetry_v1';

function loadAll() {
  try {
    const raw = localStorage.getItem(TELEMETRY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};
  }
}

function saveAll(data) {
  try {
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify(data));
  } catch {
    /* storage full / private mode — telemetry is best-effort */
  }
}

export const ReadingTelemetry = {
  log(eventName, increment = 1) {
    if (!eventName) return;
    const all = loadAll();
    all[eventName] = (Number(all[eventName]) || 0) + increment;
    saveAll(all);
  },

  get(eventName) {
    const all = loadAll();
    return Number(all[eventName]) || 0;
  },

  getAll() {
    return loadAll();
  },

  reset() {
    try { localStorage.removeItem(TELEMETRY_KEY); } catch { /* noop */ }
  }
};

if (typeof window !== 'undefined') {
  window.ReadingTelemetry = window.ReadingTelemetry || ReadingTelemetry;
}
