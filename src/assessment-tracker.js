/**
 * Pedagogo Desk: Assessment & Quiz Tracker 🌿📊
 * (Roadmap Phase 3 — "ECR Foundation", Future Module B)
 *
 * Gives pre-service teachers a calm, private grade-recording sheet for their
 * practicum sections:
 * - Normalized Assessment / StudentScore relational stores (100% localStorage)
 * - DepEd class-record vocabulary: Written Work / Performance Task / Quarterly Assessment
 * - Positive defaults: scores save silently per keystroke, unrecorded learners are
 *   shown as "—" (never a zero), and there is no punitive red anywhere
 * - Gentle per-learner & per-section running averages in sage tones
 * - 🖨️ 1-click printable DepEd-style Class Record Sheet with signature blocks
 * - Fully offline: joins the Unified Backup Hub and can never leak to a cloud
 * - The low-stakes score-entry interaction defined here is the shared UI pattern
 *   reused by the Lesson Plan Builder (Phase 4) and LET Review Trainer (Phase 5)
 */

import { showToast } from './toast.js';
import { showCalmConfirm } from './calm-dialog.js';

export class AssessmentTracker {
  static STORAGE_KEY = 'pedagogo_assessments';

  static COMPONENT_META = {
    WrittenWork: { icon: '✏️', label: 'Written Work' },
    PerformanceTask: { icon: '🎭', label: 'Performance Task' },
    QuarterlyAssessment: { icon: '📜', label: 'Quarterly Assessment' }
  };

  static COMPONENT_ORDER = ['WrittenWork', 'PerformanceTask', 'QuarterlyAssessment'];

  constructor(classManager = null) {
    this.classManager = classManager;
    this.container = document.getElementById('view-assessments');
    this.store = this.loadStore();
    this.selectedClassId = classManager?.selectedClassId || classManager?.classes?.[0]?.id || null;
    this.assessmentDate = this.localDateStr();
    this.activeAssessmentId = this.getAssessmentsForClass(this.selectedClassId)[0]?.id || null;

    if (this.container) {
      this.render();
      this.bindEvents();
    }

    window.addEventListener('pedagogo:class-deleted', (e) => {
      const deletedId = e.detail?.classId;
      this.store = this.loadStore();
      if (this.selectedClassId === deletedId) {
        this.selectedClassId = this.classManager?.classes?.[0]?.id || null;
        this.activeAssessmentId = this.getAssessmentsForClass(this.selectedClassId)[0]?.id || null;
      }
      if (this.container) this.render();
    });
  }

  // =========================================================
  // Data Layer (normalized Assessment + StudentScore)
  // =========================================================

  loadStore() {
    const raw = localStorage.getItem(AssessmentTracker.STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.assessments)) {
          return {
            assessments: parsed.assessments,
            scores: Array.isArray(parsed.scores) ? parsed.scores : []
          };
        }
      } catch (e) {
        console.warn('Failed to parse assessment store', e);
      }
    }
    return { assessments: [], scores: [] };
  }

  save() {
    localStorage.setItem(AssessmentTracker.STORAGE_KEY, JSON.stringify(this.store));
  }

  getAssessmentsForClass(classId) {
    if (!classId) return [];
    return this.store.assessments
      .filter(a => a.classId === classId)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  getAssessment(assessmentId) {
    return this.store.assessments.find(a => a.id === assessmentId) || null;
  }

  getScoresForAssessment(assessmentId) {
    return this.store.scores.filter(s => s.assessmentId === assessmentId);
  }

  getScore(assessmentId, studentId) {
    return this.store.scores.find(s => s.assessmentId === assessmentId && s.studentId === studentId) || null;
  }

  localDateStr(date = new Date()) {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().split('T')[0];
  }

  formatDate(dateStr) {
    try {
      return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-PH', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  }


  // --- Score Sheet Lifecycle ---

  startScoreSheet(classId, component, title, maxScore, date) {
    if (!classId || !date) return null;

    // Gently resume an identical sheet (same class + title + date) instead of duplicating
    const existing = this.store.assessments.find(a =>
      a.classId === classId && (a.title || '') === (title || '') && a.date === date
    );
    if (existing) {
      this.activeAssessmentId = existing.id;
      return { assessment: existing, created: false };
    }

    const cls = this.classManager?.getClassroom ? this.classManager.getClassroom(classId) : null;
    const assessment = {
      id: 'asm_' + Date.now(),
      classId,
      title: title || '',
      component: AssessmentTracker.COMPONENT_META[component] ? component : 'WrittenWork',
      maxScore: Number(maxScore) > 0 ? Number(maxScore) : 100,
      date,
      term: cls?.term || '',
      sectionName: cls?.sectionName || '',
      subjectCode: cls?.subjectCode || '',
      schoolName: cls?.schoolName || '',
      createdAt: new Date().toISOString()
    };
    this.store.assessments.unshift(assessment);
    this.save();
    this.activeAssessmentId = assessment.id;
    return { assessment, created: true };
  }

  setRawScore(assessmentId, studentId, rawScore) {
    const asm = this.getAssessment(assessmentId);
    if (!asm) return;

    const trimmed = String(rawScore ?? '').trim();
    const entry = this.getScore(assessmentId, studentId);

    // Blank input = "not yet recorded" (never recorded as zero)
    if (trimmed === '') {
      if (entry) {
        this.store.scores = this.store.scores.filter(
          s => !(s.assessmentId === assessmentId && s.studentId === studentId)
        );
        this.save();
      }
      return;
    }

    const value = Number(trimmed);
    if (Number.isNaN(value)) return;
    const clamped = Math.max(0, Math.min(value, asm.maxScore));

    if (entry) {
      entry.rawScore = clamped;
      entry.updatedAt = new Date().toISOString();
    } else {
      this.store.scores.push({
        id: 'score_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        assessmentId,
        studentId,
        rawScore: clamped,
        recordedAt: new Date().toISOString()
      });
    }
    this.save();
  }

  markAllFull(assessmentId) {
    const asm = this.getAssessment(assessmentId);
    if (!asm) return;
    const enrolled = this.classManager?.getEnrolledStudents
      ? this.classManager.getEnrolledStudents(asm.classId, true).all : [];
    enrolled.forEach(st => {
      const entry = this.getScore(assessmentId, st.id);
      if (entry) {
        entry.rawScore = asm.maxScore;
        entry.updatedAt = new Date().toISOString();
      } else {
        this.store.scores.push({
          id: 'score_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          assessmentId,
          studentId: st.id,
          rawScore: asm.maxScore,
          recordedAt: new Date().toISOString()
        });
      }
    });
    this.save();
  }

  closeAssessment(assessmentId) {
    const asm = this.getAssessment(assessmentId);
    if (asm && !asm.closedAt) {
      asm.closedAt = new Date().toISOString();
    }
    if (this.activeAssessmentId === assessmentId) {
      this.activeAssessmentId = null;
    }
    this.save();
  }

  deleteAssessment(assessmentId) {
    this.store.assessments = this.store.assessments.filter(a => a.id !== assessmentId);
    this.store.scores = this.store.scores.filter(s => s.assessmentId !== assessmentId);
    if (this.activeAssessmentId === assessmentId) this.activeAssessmentId = null;
    this.save();
  }

  // =========================================================
  // Gentle Analytics (sage tones, never guilt)
  // =========================================================

  getAssessmentSummary(assessmentId) {
    const asm = this.getAssessment(assessmentId);
    const scores = this.getScoresForAssessment(assessmentId);
    const recorded = scores.length;
    const sum = scores.reduce((acc, s) => acc + (Number(s.rawScore) || 0), 0);
    const percentage = recorded > 0 ? Math.round((sum / (recorded * (asm?.maxScore || 1))) * 100) : null;
    return { recorded, sum, percentage, maxScore: asm?.maxScore || 0 };
  }


  getClassAverageMap(classId) {
    // Percentage-based average per learner across all assessments of the class
    const map = new Map();
    this.getAssessmentsForClass(classId).forEach(a => {
      this.getScoresForAssessment(a.id).forEach(sc => {
        const rec = map.get(sc.studentId) || { sum: 0, recorded: 0 };
        rec.recorded++;
        rec.sum += (Number(sc.rawScore) || 0) / (a.maxScore || 100);
        map.set(sc.studentId, rec);
      });
    });
    map.forEach((rec) => {
      rec.average = rec.recorded > 0 ? Math.round((rec.sum / rec.recorded) * 100) : null;
    });
    return map;
  }

  getTotalStats() {
    const learners = new Set();
    this.store.scores.forEach(s => learners.add(s.studentId));
    return {
      assessments: this.store.assessments.length,
      scores: this.store.scores.length,
      learners: learners.size
    };
  }

  // =========================================================
  // Rendering
  // =========================================================

  render() {
    if (!this.container) return;

    const activeClass = this.classManager?.getClassroom ? this.classManager.getClassroom(this.selectedClassId) : null;
    const hasClasses = (this.classManager?.classes || []).length > 0;
    const totals = this.getTotalStats();

    let html = `
      <div class="view-header">
        <div>
          <h2 class="section-title">Assessment &amp; Quiz Tracker 📊🌿</h2>
          <p class="section-desc">DepEd-aligned score sheets for your practicum sections — gentle, private, and always on-device.</p>
        </div>
      </div>
    `;

    if (!hasClasses) {
      html += `
        <div class="sub-card att-empty-card">
          <div class="empty-icon">🌱</div>
          <h4>No Teaching Sections Yet</h4>
          <p>Create a section and enroll your learners in Classrooms first — then your score sheets will bloom here.</p>
          <div class="empty-actions">
            <button class="btn-primary" data-asm-action="goto-classrooms">👥 Manage Sections</button>
          </div>
        </div>
      `;
      this.container.innerHTML = html;
      return;
    }

    const classOptions = (this.classManager.classes || []).map(c => `
      <option value="${c.id}" ${c.id === this.selectedClassId ? 'selected' : ''}>
        ${escapeHtml(`${c.subjectCode || ''} — ${c.sectionName || ''}`.trim())}
      </option>
    `).join('');

    const componentOptions = AssessmentTracker.COMPONENT_ORDER.map(comp => {
      const meta = AssessmentTracker.COMPONENT_META[comp];
      return `<option value="${comp}" ${comp === 'WrittenWork' ? 'selected' : ''}>${meta.icon} ${meta.label}</option>`;
    }).join('');

    // Launcher Card
    html += `
      <div class="sub-card att-launcher-card">
        <div class="att-launcher-row asm-launcher-row">
          <div class="att-field att-field-grow">
            <label for="asm-class-select">Teaching Section</label>
            <select id="asm-class-select">${classOptions}</select>
          </div>
          <div class="att-field">
            <label for="asm-component-select">Assessment Component</label>
            <select id="asm-component-select">${componentOptions}</select>
          </div>
          <div class="att-field">
            <label for="asm-max-score">Highest Possible Score</label>
            <input type="number" id="asm-max-score" min="1" max="1000" value="30">
          </div>
          <div class="att-field">
            <label for="asm-assessment-date">Date Given</label>
            <input type="date" id="asm-assessment-date" value="${this.assessmentDate}">
          </div>
          <button class="btn-primary" data-asm-action="open-sheet">
            <span>📊 Open Score Sheet</span>
          </button>
        </div>
        <input type="text" class="asm-title-input" id="asm-title-input" placeholder="Gentle title, e.g., Quiz 1 — Elements of a Short Story (optional)" maxlength="120">
        <p class="att-launcher-hint">🌿 Unrecorded learners appear as <strong>—</strong> (never a zero). Type each score and it saves itself peacefully as you go.</p>
      </div>
    `;

    // Active Score Sheet Card
    const assessment = this.activeAssessmentId ? this.getAssessment(this.activeAssessmentId) : null;
    if (assessment) {
      html += this.renderAssessmentCard(assessment);
    } else {
      html += `
        <div class="sub-card att-empty-card att-session-card">
          <div class="empty-icon">🌤️</div>
          <h4>No Score Sheet Open</h4>
          <p>Choose a section, component, and date above, then open a score sheet. Past records stay peacefully archived below.</p>
        </div>
      `;
    }

    // History
    html += this.renderHistory(activeClass);

    this.container.innerHTML = html;
  }



  renderAssessmentCard(assessment) {
    const summary = this.getAssessmentSummary(assessment.id);
    const enrolled = this.classManager?.getEnrolledStudents ? this.classManager.getEnrolledStudents(assessment.classId, true).all : [];
    const avgMap = this.getClassAverageMap(assessment.classId);
    const compMeta = AssessmentTracker.COMPONENT_META[assessment.component] || AssessmentTracker.COMPONENT_META.WrittenWork;

    const recordedPct = enrolled.length > 0 ? Math.round((summary.recorded / enrolled.length) * 100) : 0;
    const avgChip = summary.percentage === null
      ? `<span class="att-chip chip-writtenwork">🌱 No scores recorded yet</span>`
      : `<span class="att-chip chip-present">🌿 Section Average: <strong>${summary.percentage}%</strong></span>`;

    const rows = enrolled.map((st, idx) => {
      const entry = this.getScore(assessment.id, st.id);
      const mi = st.middleInitial ? ` ${st.middleInitial}` : '';
      const fullName = `${st.lastName}, ${st.firstName}${mi}`;
      const rec = avgMap.get(st.id);
      const runningLine = rec && rec.recorded > 0
        ? `<div class="att-student-rate">🌿 ${rec.recorded} record${rec.recorded > 1 ? 's' : ''} • running ${rec.average}%</div>`
        : `<div class="att-student-rate">🌱 First record</div>`;

      return `
        <tr>
          <td style="font-weight:700; color:var(--text-muted);">${idx + 1}</td>
          <td>
            <div class="student-name-cell">
              <span>${st.gender === 'Male' ? '👦' : '👧'}</span>
              <span>${escapeHtml(fullName)}</span>
            </div>
            ${runningLine}
          </td>
          <td>
            <input type="number" class="asm-score-input" data-asm-score data-student-id="${st.id}"
                   value="${entry ? entry.rawScore : ''}" min="0" max="${assessment.maxScore}"
                   placeholder="—" step="0.01">
            <span class="asm-max-hint">/ ${assessment.maxScore}</span>
          </td>
        </tr>
      `;
    }).join('');

    const closedBadge = assessment.closedAt ? `<span class="att-closed-badge">✅ Sheet Closed</span>` : '';

    return `
      <div class="sub-card att-session-card">
        <div class="att-session-header">
          <div>
            <h3 class="att-session-title">${compMeta.icon} ${escapeHtml(assessment.title || compMeta.label)} — ${this.formatDate(assessment.date)} ${closedBadge}</h3>
            <div class="att-summary-chips">
              <span class="att-chip chip-writtenwork">${compMeta.icon} ${compMeta.label}</span>
              <span class="att-chip chip-excused">📝 Recorded: <strong>${summary.recorded}</strong> of ${enrolled.length}</span>
              ${avgChip}
            </div>
          </div>
          <div class="att-session-actions">
            <button class="btn-subtle" data-asm-action="mark-all-full" title="Gently record the highest possible score for everyone">🌿 Mark All Highest</button>
            <button class="btn-secondary" data-asm-action="print-sheet" title="Print DepEd-style Class Record">🖨️ Print Class Record</button>
            <button class="btn-subtle" data-asm-action="close-sheet" title="Archive this score sheet">✅ Close Sheet</button>
            <button class="btn-subtle text-danger" data-asm-action="delete-sheet" title="Delete this score sheet">🗑️</button>
          </div>
        </div>
        <div class="att-rate-bar" title="${recordedPct}% of learners recorded">
          <div class="att-rate-fill" style="width:${recordedPct}%;"></div>
        </div>
        <div class="att-rate-caption">🌿 ${summary.recorded} of ${enrolled.length} learners recorded so far — no rush, the sheet saves every keystroke.</div>
        ${enrolled.length === 0 ? `
          <div class="att-empty">
            <div class="empty-icon">🌱</div>
            <h4>No Learners in This Section Yet</h4>
            <p>Add learners or paste a roster in Classrooms, then reopen this score sheet.</p>
            <div class="empty-actions">
              <button class="btn-primary" data-asm-action="goto-classrooms">👥 Manage Roster</button>
            </div>
          </div>
        ` : `
          <div class="table-responsive">
            <table class="roster-table att-table">
              <thead>
                <tr>
                  <th style="width:50px;">#</th>
                  <th>Learner</th>
                  <th style="width:220px;">Raw Score</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  renderHistory(activeClass) {
    const assessments = this.getAssessmentsForClass(this.selectedClassId);
    const sectionName = activeClass?.sectionName || 'this section';

    let inner;
    if (assessments.length === 0) {
      inner = `
        <div class="att-empty">
          <div class="empty-icon">🗓️</div>
          <p>No score sheets recorded for ${escapeHtml(sectionName)} yet. Your first one is a single tap away above.</p>
        </div>
      `;
    } else {
      inner = `
        <div class="att-history-grid">
          ${assessments.map(a => {
            const sum = this.getAssessmentSummary(a.id);
            const isActive = a.id === this.activeAssessmentId;
            const compMeta = AssessmentTracker.COMPONENT_META[a.component] || AssessmentTracker.COMPONENT_META.WrittenWork;
            return `
              <div class="att-history-card ${isActive ? 'active-session' : ''}">
                <div class="att-history-date">${this.formatDate(a.date)}</div>
                <div class="asm-history-title">${compMeta.icon} ${escapeHtml(a.title || compMeta.label)}</div>
                <div class="att-history-counts">
                  <span class="att-mini-chip mini-present">📝 ${sum.recorded} recorded</span>
                  <span class="att-mini-chip mini-tardy">🎯 Highest: ${a.maxScore}</span>
                </div>
                <div class="att-history-rate">${sum.percentage === null ? 'No scores recorded yet' : `🌿 ${sum.percentage}% section average`}</div>
                <div class="att-history-actions">
                  <button class="btn-subtle" data-asm-action="open-history" data-assessment-id="${a.id}">📖 Open</button>
                  <button class="btn-subtle text-danger" data-asm-action="delete-history" data-assessment-id="${a.id}" title="Delete this score sheet">🗑️</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    return `
      <div class="att-history-block">
        <div class="section-heading-sm">
          <span>🗓️ Score Sheet History — ${escapeHtml(sectionName)}</span>
        </div>
        ${inner}
      </div>
    `;
  }

  // =========================================================
  // Event Wiring (event delegation — survives re-renders)
  // =========================================================

  bindEvents() {
    if (!this.container || this.container.dataset.asmBound === 'true') return;
    this.container.dataset.asmBound = 'true';

    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest ? e.target.closest('[data-asm-action]') : null;
      if (!btn) return;
      this.handleAction(btn.dataset.asmAction, btn.dataset);
    });

    // Scores save silently on every keystroke (no re-render, keeps typing focus)
    this.container.addEventListener('input', (e) => {
      if (!e.target.hasAttribute || !e.target.hasAttribute('data-asm-score')) return;
      if (!this.activeAssessmentId) return;
      this.setRawScore(this.activeAssessmentId, e.target.dataset.studentId, e.target.value);
    });

    this.container.addEventListener('change', (e) => {
      if (e.target.id === 'asm-class-select') {
        this.selectedClassId = e.target.value;
        this.activeAssessmentId = this.getAssessmentsForClass(this.selectedClassId)[0]?.id || null;
        this.render();
      } else if (e.target.id === 'asm-assessment-date') {
        this.assessmentDate = e.target.value || this.localDateStr();
      }
    });
  }

  async handleAction(action, data = {}) {
    switch (action) {
      case 'open-sheet': {
        if (!this.selectedClassId) return;
        const title = document.getElementById('asm-title-input')?.value || '';
        const component = document.getElementById('asm-component-select')?.value || 'WrittenWork';
        const maxScore = document.getElementById('asm-max-score')?.value || 100;
        const result = this.startScoreSheet(this.selectedClassId, component, title, maxScore, this.assessmentDate);
        showToast(result?.created ? 'Score sheet opened. Record gently — blanks stay blank, never zeros. 🌿' : 'That sheet is already open — resuming it. 🌿', 'success');
        this.render();
        break;
      }
      case 'mark-all-full': {
        if (!this.activeAssessmentId) return;
        this.markAllFull(this.activeAssessmentId);
        showToast('Highest possible score recorded for everyone. Adjust the exceptions as needed. 🌿', 'success');
        this.render();
        break;
      }
      case 'print-sheet': {
        if (this.activeAssessmentId) this.printClassRecord(this.activeAssessmentId);
        break;
      }
      case 'close-sheet': {
        if (!this.activeAssessmentId) return;
        this.closeAssessment(this.activeAssessmentId);
        showToast('Score sheet archived peacefully. Rest easy, Teacher. 🌿', 'info');
        this.render();
        break;
      }
      case 'delete-sheet':
      case 'delete-history': {
        const id = data.assessmentId;
        if (!id) return;
        const confirmed = await showCalmConfirm({
          title: 'Delete Score Sheet?',
          message: 'Delete this score sheet and its recorded scores? This cannot be undone.',
          confirmText: 'Delete Sheet',
          cancelText: 'Keep Sheet',
          tone: 'danger'
        });
        if (confirmed) {
          this.deleteAssessment(id);
          showToast('Score sheet removed.', 'info');
          this.render();
        }
        break;
      }
      case 'open-history': {
        const id = data.assessmentId;
        if (!id) return;
        const asm = this.getAssessment(id);
        if (!asm) return;
        this.selectedClassId = asm.classId;
        this.assessmentDate = asm.date;
        this.activeAssessmentId = id;
        this.render();
        break;
      }
      case 'goto-classrooms': {
        const tab = document.getElementById('tab-classrooms');
        if (tab && typeof tab.click === 'function') tab.click();
        break;
      }
    }
  }



  // =========================================================
  // 🖨️ DepEd-Style Printable Class Record
  // =========================================================

  printClassRecord(assessmentId) {
    const asm = this.getAssessment(assessmentId);
    if (!asm) return;

    const summary = this.getAssessmentSummary(assessmentId);
    const cls = this.classManager?.getClassroom ? this.classManager.getClassroom(asm.classId) : null;
    const enrolled = this.classManager?.getEnrolledStudents ? this.classManager.getEnrolledStudents(asm.classId, true).all : [];
    const avgMap = this.getClassAverageMap(asm.classId);
    const compMeta = AssessmentTracker.COMPONENT_META[asm.component] || AssessmentTracker.COMPONENT_META.WrittenWork;

    let printContainer = document.getElementById('asm-print-sheet');
    if (!printContainer) {
      printContainer = document.createElement('div');
      printContainer.id = 'asm-print-sheet';
      printContainer.className = 'print-only-container';
      document.body.appendChild(printContainer);
    }

    const rows = enrolled.map((st, idx) => {
      const entry = this.getScore(assessmentId, st.id);
      const mi = st.middleInitial ? ` ${st.middleInitial}` : '';
      const fullName = `${st.lastName}, ${st.firstName}${mi}`;
      const rec = avgMap.get(st.id);
      const pct = entry ? `${Math.round((entry.rawScore / (asm.maxScore || 1)) * 100)}%` : '';
      const running = rec && rec.recorded > 0 ? `${rec.average}%` : '';
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>${escapeHtml(fullName)}</td>
          <td style="text-align:center; font-weight:700;">${entry ? entry.rawScore : '—'}</td>
          <td style="text-align:center;">${pct}</td>
          <td style="text-align:center;">${running}</td>
        </tr>
      `;
    }).join('');

    printContainer.innerHTML = `
      <div class="asm-print-document">
        <div class="print-header">
          <h3>Republic of the Philippines • Department of Education</h3>
          <h2>CLASS RECORD — ${compMeta.label.toUpperCase()}</h2>
          <p class="course-subtitle">Pre-Service Teacher Practicum Assessment Sheet — Pedagogo Desk</p>
        </div>
        <div class="att-print-meta">
          <div><strong>Subject:</strong> ${escapeHtml(cls?.subjectCode || asm.subjectCode || '—')}${asm.title ? ` — ${escapeHtml(asm.title)}` : ''}</div>
          <div><strong>Section &amp; Grade:</strong> ${escapeHtml(cls?.sectionName || asm.sectionName || '—')} ${escapeHtml(cls?.gradeLevel || '')}</div>
          <div><strong>School:</strong> ${escapeHtml(cls?.schoolName || asm.schoolName || '—')}</div>
          <div><strong>School Year / Term:</strong> ${escapeHtml(cls?.schoolYear || '—')} • ${escapeHtml(cls?.term || asm.term || '—')}</div>
          <div><strong>Date Given:</strong> ${this.formatDate(asm.date)}</div>
          <div><strong>Highest Possible Score:</strong> ${asm.maxScore}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:30px;">#</th>
              <th>Learner Full Name</th>
              <th style="width:90px;">Raw Score</th>
              <th style="width:80px;">Pct.</th>
              <th style="width:110px;">Running Avg.</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="att-print-summary">
          <strong>Sheet Summary:</strong>
          ${summary.recorded} of ${enrolled.length} learners recorded
          ${summary.percentage !== null ? `• Section Average: ${summary.percentage}%` : '• No scores recorded yet'}
        </div>
        <div class="att-print-signatures">
          <div class="sig-item"><div class="line"></div><span>Pre-Service Teacher (Intern)</span></div>
          <div class="sig-item"><div class="line"></div><span>Cooperating Teacher (CT)</span></div>
          <div class="sig-item"><div class="line"></div><span>School Head / Principal</span></div>
        </div>
      </div>
    `;

    document.body.classList.add('printing-asm-sheet');
    try {
      window.print();
    } finally {
      document.body.classList.remove('printing-asm-sheet');
    }
  }
}

// --- Small shared helpers ---

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
