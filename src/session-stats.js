/**
 * Pedagogo Desk: session-aware pacing (plan §7.1 — "fatigue-aware recall pass") 🌿
 *
 * Tracks per-day analysis activity ({ analysesToday, docsToday, lastAnalysisAt })
 * and decides when the ONE calm pacing nudge is earned: a 2nd+ analysis within
 * 90 minutes usually means momentum is better spent on recall (Term Bank →
 * star misses → push) than on another full new read.
 *
 * Pure functions only — no DOM, no storage access — so the logic is verifiable
 * headlessly (scratch/verify_fatigue_nudge.mjs). Callers in document-desk.js
 * read localStorage and pass plain data in. The one-nudge-per-session rule
 * lives in the caller (an in-memory flag — a reload may offer it once more,
 * but it never nags within a session).
 */

export const SESSION_STATS_KEY = 'pedagogo_session_stats';
/** A 2nd analysis counts as "still studying" only inside this window. */
export const NUDGE_WINDOW_MS = 90 * 60 * 1000;

/** Local calendar-day key, so counters reset on the student's own midnight. */
export function localDayKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses persisted stats and applies the calendar-day rollover: counters are
 * per day ("tonight"), so a stale day resets to zero. Never throws — foreign
 * or malformed data degrades to a fresh, quiet day (no nudge).
 */
export function parseSessionStats(raw, now = new Date()) {
  let stats = null;
  try { stats = JSON.parse(raw || '{}') || null; } catch (e) { stats = null; }
  const day = localDayKey(now);
  const valid = stats && typeof stats === 'object' && stats.day === day;
  return {
    day,
    analysesToday: valid ? Math.max(0, Number(stats.analysesToday) || 0) : 0,
    docsToday: valid ? Math.max(0, Number(stats.docsToday) || 0) : 0,
    lastAnalysisAt: (valid && typeof stats.lastAnalysisAt === 'string') ? stats.lastAnalysisAt : null,
    docIds: (valid && Array.isArray(stats.docIds))
      ? stats.docIds.filter((d) => typeof d === 'string' && d).slice(0, 50)
      : []
  };
}

/**
 * Records one finished analysis. Returns the NEXT stats plus the nudge
 * decision measured against the PREVIOUS lastAnalysisAt (a 2nd+ analysis
 * within the 90-minute window is the one that earns the offer — the just-
 * finished analysis trivially is "now", so measuring after the update would
 * always be inside the window). Never throws.
 */
export function bumpSessionStats(stats, { docId = '', now = new Date() } = {}) {
  const day = localDayKey(now);
  const prev = (stats && typeof stats === 'object') ? stats : {};
  const staleDay = prev.day !== day;
  const prevIds = staleDay ? [] : (Array.isArray(prev.docIds) ? prev.docIds : []);
  const ids = prevIds.filter((d) => typeof d === 'string' && d).slice(0, 50);
  const prevAt = (staleDay || !prev.lastAnalysisAt) ? NaN : new Date(prev.lastAnalysisAt).getTime();
  const delta = now.getTime() - prevAt;
  const withinWindow = Number.isFinite(prevAt) && delta >= 0 && delta <= NUDGE_WINDOW_MS;
  const isNewDoc = Boolean(docId) && !ids.includes(docId);
  if (docId && isNewDoc) ids.push(docId);
  const analysesToday = (staleDay ? 0 : Math.max(0, Number(prev.analysesToday) || 0)) + 1;
  const docsToday = Math.max(
    (staleDay ? 0 : Math.max(0, Number(prev.docsToday) || 0)) + (isNewDoc ? 1 : 0),
    ids.length
  );
  return {
    stats: { day, analysesToday, docsToday, lastAnalysisAt: now.toISOString(), docIds: ids },
    decision: { nudge: withinWindow && analysesToday >= 2, docsToday }
  };
}

/** "tonight" for evening/late sessions, "today" otherwise (banner copy). */
export function sessionWord(now = new Date()) {
  const h = now.getHours();
  return (h >= 17 || h < 5) ? 'tonight' : 'today';
}