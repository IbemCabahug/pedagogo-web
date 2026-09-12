/**
 * Pedagogo Desk: Global Cross-Module Search 🌿 (Ctrl+K command palette)
 * Safety-net module — find any record across every localStorage module from one
 * calm, keyboard-first overlay and jump straight to the owning view.
 *
 * Sources indexed (all local, zero cloud):
 *   Reading Desk sessions • LET cards • Lesson Plan Library • Tasks & IMs •
 *   Field Study episodes • Anecdotal notes • Assessments • Classes •
 *   Schedule subjects • Attendance roll calls
 */

const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return String(iso).slice(0, 10); }
};

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
};

const snippetOf = (text, max = 120) => String(text || '')
  .replace(/\s+/g, ' ').trim().slice(0, max);

const TAB_PERSPECTIVE = {
  'reading-desk': 'STUDENT', reviewer: 'STUDENT', tasks: 'STUDENT',
  'field-study': 'STUDENT', timetable: 'STUDENT',
  'plan-builder': 'EDUCATOR', assessments: 'EDUCATOR', classrooms: 'EDUCATOR',
  anecdotal: 'EDUCATOR', attendance: 'EDUCATOR'
};

export class GlobalSearch {
  constructor() {
    this.overlay = null;
    this.input = null;
    this.resultsEl = null;
    this.results = [];      // flat list of { group, title, subtitle, snippet, tab, perspective, icon, deep }
    this.activeIndex = -1;  // index within selectable items
    this.debounceTimer = null;
    this.keyHandler = (e) => this.handleGlobalKey(e);
    this.cardKeyHandler = (e) => this.handleCardKey(e);
  }

  /** Wire keyboard shortcut + the header button. Call once from main.js. */
  init() {
    window.addEventListener('keydown', this.keyHandler);

    const btn = document.getElementById('btn-global-search');
    if (btn) btn.addEventListener('click', () => this.toggle());
    // Also expose a secondary trigger for other in-app buttons.
    window.addEventListener('pedagogo:open-search', () => this.open());
  }

  toggle() {
    if (this.overlay && this.overlay.classList.contains('active')) this.close();
    else this.open();
  }

  open() {
    if (!this.overlay) this.buildOverlay();
    this.overlay.classList.add('active');
    document.body.appendChild(this.overlay);
    setTimeout(() => {
      this.input?.focus();
      this.input?.select();
    }, 30);
    this.runSearch(this.input?.value || '');
  }

  close() {
    if (!this.overlay) return;
    this.overlay.classList.remove('active');
    this.overlay.remove();
    this.activeIndex = -1;
  }

  buildOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'global-search-modal';
    this.overlay.className = 'modal-backdrop active gs-backdrop';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-label', 'Search across Desk');
    this.overlay.innerHTML = `
      <div class="modal-card gs-card">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <span class="modal-icon">🔍</span>
            <h3>Search across Desk</h3>
          </div>
          <span class="gs-kbd-hint">↑↓ navigate • Enter jump • Esc close</span>
          <button class="modal-close" id="gs-close" aria-label="Close search">✕</button>
        </div>
        <div class="gs-body">
          <input type="search" id="gs-input" class="gs-input"
            placeholder="Search readings, LET cards, lesson plans, tasks, learners…"
            autocomplete="off" spellcheck="false" aria-label="Search query" />
          <div class="gs-results" id="gs-results" role="listbox"></div>
        </div>
      </div>`;

    this.input = this.overlay.querySelector('#gs-input');
    this.resultsEl = this.overlay.querySelector('#gs-results');

    this.input.addEventListener('input', () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.runSearch(this.input.value), 120);
    });
    this.input.addEventListener('keydown', this.cardKeyHandler);

    const closeBtn = this.overlay.querySelector('#gs-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    this.overlay.addEventListener('mousedown', (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  handleGlobalKey(e) {
    const isK = e.key === 'k' || e.key === 'K';
    if (isK && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.toggle();
      return;
    }
    if (e.key === 'Escape' && this.overlay && this.overlay.classList.contains('active')) {
      this.close();
    }
  }

  handleCardKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
    const selectableCount = this.results.length;
    if (selectableCount === 0) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIndex = e.key === 'ArrowDown'
        ? (this.activeIndex + 1) % selectableCount
        : (this.activeIndex - 1 + selectableCount) % selectableCount;
      this.paintActive();
      this.scrollActiveIntoView();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.activeIndex >= 0 && this.activeIndex < selectableCount) {
        this.goTo(this.results[this.activeIndex]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault(); // keep focus trapped in the palette
    }
  }

  /** Build the searchable flat record list (in module order), then filter + group. */
  collectEntries() {
    const entries = [];

    const readingSessions = readJSON('pedagogo_reading_sessions', {});
    Object.values(readingSessions || {})
      .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0))
      .forEach((s) => {
        entries.push({
          group: 'Reading Sessions',
          title: s.filename || s.doc?.filename || 'Reading',
          subtitle: `${s.fileType || 'Document'} • ${fmtDate(s.savedAt)}`,
          snippet: snippetOf(s.doc?.rawText || s.rawText),
          tab: 'reading-desk',
          perspective: 'STUDENT',
          icon: '📖'
        });
      });

    const cards = readJSON('pedagogo_let_cards', []);
    (Array.isArray(cards) ? cards : []).forEach((c) => {
      entries.push({
        group: 'LET Cards',
        title: c.front || c.question || 'LET Card',
        subtitle: `LET Card • ${esc(c.competency || c.category || 'Study Drill')}`,
        snippet: snippetOf(c.back || c.answer),
        tab: 'reviewer',
        perspective: 'STUDENT',
        icon: '📝'
      });
    });

    const plansStore = readJSON('pedagogo_lp_plans', null);
    const plans = Array.isArray(plansStore) ? plansStore : ((plansStore && plansStore.plans) || []);
    plans.forEach((p) => {
      const outcomes = p.outcomes;
      const outcomesTxt = Array.isArray(outcomes) ? outcomes.join(' ') : (typeof outcomes === 'string' ? outcomes : '');
      entries.push({
        group: 'Lesson Plans',
        title: p.title || p.topic || p.subjectTitle || 'Lesson Plan',
        subtitle: `${p.subjectCode || p.gradeLevel || ''} • ${fmtDate(p.updatedAt || p.createdAt)}`,
        snippet: snippetOf([p.topic, p.objective, outcomesTxt].filter(Boolean).join(' ')),
        tab: 'plan-builder',
        perspective: 'EDUCATOR',
        icon: '🌱',
        deep: { event: 'pedagogo:plan-open', get: () => ({ id: p.id }) }
      });
    });

    const tasks = readJSON('pedagogo_academic_tasks', null) || readJSON('pedagogo_tasks', []);
    (Array.isArray(tasks) ? tasks : []).forEach((t) => {
      entries.push({
        group: 'Tasks & IMs',
        title: t.title || t.name || 'Task',
        subtitle: `${t.subjectCode || ''} • ${t.category || ''} • due ${fmtDate(t.dueDate)}`,
        snippet: snippetOf(t.notes || t.description),
        tab: 'tasks',
        perspective: 'STUDENT',
        icon: '✏️'
      });
    });

    const fsEntries = readJSON('pedagogo_fs_entries', []);
    (Array.isArray(fsEntries) ? fsEntries : []).forEach((f) => {
      entries.push({
        group: 'Field Study',
        title: f.episodeTitle || 'FS Episode',
        subtitle: `${f.schoolName || ''} • ${fmtDate(f.observationDate)}`,
        snippet: snippetOf(f.description || f.pedagogicalInsight),
        tab: 'field-study',
        perspective: 'STUDENT',
        icon: '🏫'
      });
    });

    const anecRecords = readJSON('pedagogo_anecdotal_records', []);
    (Array.isArray(anecRecords) ? anecRecords : []).forEach((a) => {
      entries.push({
        group: 'Anecdotal Notes',
        title: a.studentName || 'Learner',
        subtitle: `${fmtDate(a.date)} • ${(a.tag || '').replace(/_/g, ' ').toLowerCase()}`,
        snippet: snippetOf(a.observedBehavior || a.contextAntecedent),
        tab: 'anecdotal',
        perspective: 'EDUCATOR',
        icon: '📔'
      });
    });

    const asmStore = readJSON('pedagogo_assessments', null);
    const assessments = (asmStore && Array.isArray(asmStore.assessments)) ? asmStore.assessments : [];
    assessments.forEach((a) => {
      entries.push({
        group: 'Assessments',
        title: a.title || 'Score Sheet',
        subtitle: `${a.subjectCode || ''} • ${a.component || ''} • ${fmtDate(a.date)}`,
        snippet: `Max ${a.maxScore || 0} pts`,
        tab: 'assessments',
        perspective: 'EDUCATOR',
        icon: '📊'
      });
    });

    const classes = readJSON('pedagogo_classrooms', []);
    (Array.isArray(classes) ? classes : []).forEach((c) => {
      entries.push({
        group: 'Classes',
        title: c.subjectTitle || 'Class',
        subtitle: `${c.subjectCode || ''} • ${c.sectionName || ''}`,
        snippet: snippetOf(c.notes || c.scheduleNote || `${c.room || ''} ${c.schedule || ''}`),
        tab: 'classrooms',
        perspective: 'EDUCATOR',
        icon: '👥'
      });
    });

    const schedule = readJSON('pedagogo_schedule', null);
    const subjects = (schedule && Array.isArray(schedule.subjects)) ? schedule.subjects : [];
    subjects.forEach((s) => {
      entries.push({
        group: 'Weekly Grid',
        title: s.code || s.title || 'Subject',
        subtitle: `${s.title || ''} • ${s.instructor || ''} • ${(s.category || '').replace(/_/g, ' ').toLowerCase()}`,
        snippet: `Scheduled ${s.slots || 0} slot${(s.slots === 1 ? '' : 's')} this week`,
        tab: 'timetable',
        perspective: 'STUDENT',
        icon: '🗓️'
      });
    });

    const classMap = new Map();
    (Array.isArray(classes) ? classes : []).forEach((c) => classMap.set(c.id, c));
    const attStore = readJSON('pedagogo_attendance_sessions', null);
    const attSessions = (attStore && Array.isArray(attStore.sessions)) ? attStore.sessions : [];
    const attEntries = (attStore && Array.isArray(attStore.entries)) ? attStore.entries : [];
    attSessions.forEach((s) => {
      const cls = classMap.get(s.classId);
      const count = attEntries.filter((en) => en.sessionId === s.id).length;
      entries.push({
        group: 'Roll Calls',
        title: `${fmtDate(s.date)} • ${cls ? `${cls.subjectCode} ${cls.sectionName}` : 'Roll call'}`,
        subtitle: `${count} learner${count === 1 ? '' : 's'} marked`,
        snippet: `Created ${fmtDate(s.createdAt)}`,
        tab: 'attendance',
        perspective: 'EDUCATOR',
        icon: '📋'
      });
    });

    return entries;
  }

  runSearch(query) {
    const q = String(query || '').trim().toLowerCase();
    const all = this.collectEntries();

    let matches;
    if (!q) {
      // Empty query = "recent" feed: module order, newest readings first.
      matches = all;
    } else {
      const tokens = q.split(/\s+/).filter(Boolean);
      const scored = [];
      for (const entry of all) {
        const title = String(entry.title || '').toLowerCase();
        const subtitle = String(entry.subtitle || '').toLowerCase();
        const snippet = String(entry.snippet || '').toLowerCase();
        const group = String(entry.group || '').toLowerCase();
        if (tokens.every((tok) => title.includes(tok) || subtitle.includes(tok) || snippet.includes(tok) || group.includes(tok))) {
          let score = 0;
          tokens.forEach((tok) => {
            if (title.includes(tok)) score += 4;
            if (subtitle.includes(tok)) score += 2;
            if (snippet.includes(tok)) score += 1;
          });
          scored.push({ entry, score });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      matches = scored.map((s) => s.entry);
    }

    // Cap per group to keep the palette calm.
    const groupCounts = new Map();
    const capped = [];
    for (const entry of matches) {
      const n = groupCounts.get(entry.group) || 0;
      if (n >= 6) continue;
      groupCounts.set(entry.group, n + 1);
      capped.push(entry);
      if (capped.length >= 32) break;
    }

    this.results = capped;
    this.activeIndex = capped.length > 0 ? 0 : -1;
    this.renderResults();
  }

  renderResults() {
    if (!this.resultsEl) return;
    if (this.results.length === 0) {
      this.resultsEl.innerHTML = `
        <div class="gs-empty">
          <span class="gs-empty-icon">🕊️</span>
          <p><strong>Nothing found.</strong> Try a shorter word, or a filename / student name.</p>
        </div>`;
      return;
    }

    let currentGroup = null;
    let html = '';
    let idx = 0;
    for (const r of this.results) {
      if (r.group !== currentGroup) {
        currentGroup = r.group;
        html += `<div class="gs-group-label">${esc(r.group)}</div>`;
      }
      const activeCls = idx === this.activeIndex ? ' active' : '';
      html += `
        <button type="button" class="gs-item${activeCls}" data-idx="${idx}" role="option" aria-selected="${idx === this.activeIndex ? 'true' : 'false'}">
          <span class="gs-item-icon">${esc(r.icon || '📄')}</span>
          <span class="gs-item-texts">
            <strong>${esc(r.title)}</strong>
            <em>${esc(r.subtitle || '')}</em>
            <small>${esc(r.snippet || '')}</small>
          </span>
          <span class="gs-item-go">↪ ${esc(r.tab)}</span>
        </button>`;
      idx++;
    }
    this.resultsEl.innerHTML = html;

    [...this.resultsEl.querySelectorAll('.gs-item')].forEach((el) => {
      el.addEventListener('click', () => {
        const i = parseInt(el.dataset.idx, 10);
        if (i >= 0 && i < this.results.length) this.goTo(this.results[i]);
      });
      el.addEventListener('mouseenter', () => {
        this.activeIndex = parseInt(el.dataset.idx, 10);
        this.paintActive();
      });
    });
  }

  paintActive() {
    [...this.resultsEl.querySelectorAll('.gs-item')].forEach((el) => {
      const on = parseInt(el.dataset.idx, 10) === this.activeIndex;
      el.classList.toggle('active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  scrollActiveIntoView() {
    const el = [...this.resultsEl.querySelectorAll('.gs-item')].find((e) => parseInt(e.dataset.idx, 10) === this.activeIndex);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  goTo(entry) {
    this.close();
    const perspective = TAB_PERSPECTIVE[entry.tab] || entry.perspective || 'ALL';
    window.dispatchEvent(new CustomEvent('pedagogo:switch-tab', {
      detail: { tab: entry.tab, perspective }
    }));

    if (entry.deep) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(entry.deep.event, { detail: entry.deep.get(entry.record) }));
      }, 90);
    }
  }
}