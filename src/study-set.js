/**
 * Pedagogo Desk: cross-doc "study set" orchestration (plan §7.3) 🌿
 *
 * Lets documents collect into a current study set ("2 of 3 analyzed") and,
 * once at least two docs are in the set, emits a cross-doc Study Next — the
 * app making the 21:02 decision Ana used to make by hand ("one deck across
 * Piaget + Vygotsky, spaced 1d/3d/7d").
 *
 * Pure functions only — no DOM, no storage access — so the logic is verifiable
 * headlessly (scratch/verify_study_set.mjs). Callers in document-desk.js read
 * localStorage and pass plain data in.
 */

export const STUDY_SET_KEY = 'pedagogo_study_set';
/** Bound like reading sessions: keep only the N most recently analyzed docs. */
export const STUDY_SET_CAP = 3;

/**
 * Adds/updates one analyzed document in the study set (keyed by its stable id).
 * Dedupes by id, sums nothing (latest analysis wins), refreshes analyzedAt,
 * and bounds the set to the most recent STUDY_SET_CAP entries.
 */
export function addAnalyzedDoc(set, entry) {
  if (!set || typeof set !== 'object') set = {};
  if (!entry || typeof entry !== 'object') return set;
  const id = entry.id || entry.filename;
  if (!id) return set;
  const next = Object.assign({}, set);
  next[id] = {
    id,
    filename: String(entry.filename || 'document'),
    missedTerms: Math.max(0, Number(entry.missedTerms) || 0),
    drills: Math.max(0, Number(entry.drills) || 0),
    mcqs: Math.max(0, Number(entry.mcqs) || 0),
    analyzedAt: entry.analyzedAt || new Date().toISOString()
  };
  // Bound by recency (most recent analyzedAt first).
  const ids = Object.keys(next).sort(
    (a, b) => new Date(next[b].analyzedAt).getTime() - new Date(next[a].analyzedAt).getTime()
  );
  while (ids.length > STUDY_SET_CAP) {
    const drop = ids.pop();
    if (drop) delete next[drop];
  }
  return next;
}

/** { analyzed, total } for the "N of M analyzed" chip. */
export function studySetChip(set) {
  if (!set || typeof set !== 'object') return { analyzed: 0, total: STUDY_SET_CAP };
  let analyzed = 0;
  for (const k of Object.keys(set)) {
    const e = set[k];
    if (e && e.analyzedAt && Number.isFinite(new Date(e.analyzedAt).getTime())) analyzed += 1;
  }
  return { analyzed, total: STUDY_SET_CAP };
}

/**
 * Cross-doc Study Next recommendation.
 * Returns null until at least TWO valid (analyzedAt parseable) docs are in the
 * set; otherwise aggregates missed terms + drills + MCQs across the set and
 * names the docs — the payload behind the "All N analyzed … one deck" card.
 */
export function crossDocStudyNext(set) {
  if (!set || typeof set !== 'object') return null;
  const entries = Object.keys(set)
    .map((k) => set[k])
    .filter((e) => e && e.analyzedAt && Number.isFinite(new Date(e.analyzedAt).getTime()));
  if (entries.length < 2) return null;
  const sum = (key) => entries.reduce((acc, e) => acc + (Number(e[key]) || 0), 0);
  const missedTerms = sum('missedTerms');
  const drills = sum('drills');
  const mcqs = sum('mcqs');
  return {
    analyzedCount: entries.length,
    total: STUDY_SET_CAP,
    missedTerms,
    drills,
    mcqs,
    deckSize: drills + mcqs,
    spacing: '1d / 3d / 7d',
    files: entries.map((e) => e.filename)
  };
}
