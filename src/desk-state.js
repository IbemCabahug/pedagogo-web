/**
 * Pedagogo Desk: Today-tab desk-state helpers 🌿
 * (Sprint B §7.2 continuity + 10-persona audit F6 "due-ness on the default tab")
 *
 * Pure functions only — no DOM, no storage access — so the logic is verifiable
 * headlessly (scratch/verify_today_strip.mjs). Callers in main.js read
 * localStorage and pass plain data in.
 */

const SUBTAB_LABELS = {
  synthesis: 'Study Sheet',
  cornell: 'Cornell Study Sheet',
  verbatim: 'Verbatim Transcript'
};

/**
 * Cards due for review right now.
 * Missing/invalid dueDate counts as due — same rule as ReviewerStudio.isDue().
 */
export function computeDueTodayCount(cards, now = Date.now()) {
  if (!Array.isArray(cards)) return 0;
  return cards.filter((card) => {
    if (!card || typeof card !== 'object') return false;
    if (!card.dueDate) return true;
    const t = new Date(card.dueDate).getTime();
    return Number.isFinite(t) ? t <= now : true;
  }).length;
}

/** Most recent saved desk session, with human labels for the Today strip. */
export function pickResumeSession(sessions, now = Date.now()) {
  if (!sessions || typeof sessions !== 'object') return null;
  let best = null;
  for (const id of Object.keys(sessions)) {
    const s = sessions[id];
    if (!s || typeof s !== 'object' || !s.filename) continue;
    const t = new Date(s.savedAt || 0).getTime();
    if (!Number.isFinite(t)) continue;
    if (!best || t > best.t) {
      best = { id, filename: String(s.filename), subTab: s.activeSubTab || 'synthesis', savedAt: s.savedAt, t };
    }
  }
  if (!best) return null;
  const ageMs = Math.max(0, now - best.t);
  const ageLabel = ageMs < 60000 ? 'just now'
    : ageMs < 3600000 ? `${Math.round(ageMs / 60000)} min ago`
    : ageMs < 86400000 ? `${Math.round(ageMs / 3600000)}h ago`
    : `${Math.round(ageMs / 86400000)}d ago`;
  return {
    id: best.id,
    filename: best.filename,
    subTab: best.subTab,
    subTabLabel: SUBTAB_LABELS[best.subTab] || 'Study Sheet',
    ageLabel
  };
}

/** One call for the Today strip: { dueCount, resume }. Render only if either exists. */
export function buildTodayDeskStrip({ cards, sessions, now = Date.now() } = {}) {
  return {
    dueCount: computeDueTodayCount(cards, now),
    resume: pickResumeSession(sessions, now)
  };
}
