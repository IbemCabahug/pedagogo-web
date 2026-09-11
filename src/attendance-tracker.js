/**
 * Pedagogo Desk: DepEd SF2-Aligned Daily Attendance Tracker 🌿📋
 *
 * Gives pre-service teachers a calm, private roll call for their practicum sections:
 * - Normalized AttendanceSession / AttendanceEntry relational stores (100% localStorage)
 * - DepEd SF2 vocabulary: Present / Tardy / Excused / Absent (+ gentle remarks)
 * - Positive defaults: every learner starts Present — the intern only adjusts exceptions
 * - Per-learner & per-section attendance insights in sage tones (zero punitive red)
 * - 🖨️ 1-click printable SF2-style Daily Attendance Report with signature blocks
 * - Fully offline: joins the Unified Backup Hub and can never leak to a cloud
 */

import { showToast } from './toast.js';

export class AttendanceTracker {
  static STORAGE_KEY = 'pedagogo_attendance_sessions';

  static STATUS_META = {
    Present: { icon: '✓', label: 'Present' },
    Tardy: { icon: '⏰', label: 'Tardy' },
    Excused: { icon: '📝', label: 'Excused' },
    Absent: { icon: '🍃', label: 'Absent' }
  };

  static STATUS_ORDER = ['Present', 'Tardy', 'Excused', 'Absent'];

  constructor(classManager = null) {
    this.classManager = classManager;
    this.container = document.getElementById('view-attendance');
    this.store = this.loadStore();
    this.selectedClassId = classManager?.selectedClassId || classManager?.classes?.[0]?.id || null;
    this.sessionDate = this.localDateStr();
    this.activeSessionId = this.getSessionsForClass(this.selectedClassId)[0]?.id || null;

    if (this.container) {
      this.render();
      this.bindEvents();
    }
  }

  // =========================================================
  // Data Layer (normalized AttendanceSession + AttendanceEntry)
  // =========================================================

  loadStore() {
    const raw = localStorage.getItem(AttendanceTracker.STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.sessions)) {
          return {
            sessions: parsed.sessions,
            entries: Array.isArray(parsed.entries) ? parsed.entries : []
          };
        }
      } catch (e) {
        console.warn('Failed to parse attendance sessions', e);
      }
    }
    return { sessions: [], entries: [] };
  }

  save() {
    localStorage.setItem(AttendanceTracker.STORAGE_KEY, JSON.stringify(this.store));
  }

  getSessionsForClass(classId) {
    if (!classId) return [];
    return this.store.sessions
      .filter(s => s.classId === classId)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  getSession(sessionId) {
    return this.store.sessions.find(s => s.id === sessionId) || null;
  }

  getEntriesForSession(sessionId) {
    return this.store.entries.filter(e => e.sessionId === sessionId);
  }

  getEntry(sessionId, studentId) {
    return this.store.entries.find(e => e.sessionId === sessionId && e.studentId === studentId) || null;
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
  // --- Roll Call Lifecycle ---

  startRollCall(classId, date) {
    if (!classId || !date) return null;

    const existing = this.store.sessions.find(s => s.classId === classId && s.date === date);
    if (existing) {
      this.activeSessionId = existing.id;
      return { session: existing, created: false };
    }

    const cls = this.classManager?.getClassroom ? this.classManager.getClassroom(classId) : null;
    const session = {
      id: 'att_' + Date.now(),
      classId,
      date,
      term: cls?.term || '',
      sectionName: cls?.sectionName || '',
      subjectCode: cls?.subjectCode || '',
      schoolName: cls?.schoolName || '',
      createdAt: new Date().toISOString(),
      closedAt: null
    };
    this.store.sessions.unshift(session);

    // Enrolled learners follow DepEd SF1 ordering (Boys first, then Girls)
    const enrolled = this.classManager?.getEnrolledStudents ? this.classManager.getEnrolledStudents(classId, true).all : [];
    enrolled.forEach((st, idx) => {
      this.store.entries.push({
        id: 'ente_' + Date.now() + '_' + idx,
        sessionId: session.id,
        studentId: st.id,
        status: 'Present', // Calm positive default: the intern only adjusts the exceptions
        remarks: '',
        updatedAt: new Date().toISOString()
      });
    });

    this.save();
    this.activeSessionId = session.id;
    return { session, created: true };
  }

  markStudent(sessionId, studentId, status) {
    const entry = this.getEntry(sessionId, studentId);
    if (!entry) return;
    entry.status = status;
    entry.updatedAt = new Date().toISOString();
    this.save();
  }

  setRemarks(sessionId, studentId, remarks) {
    const entry = this.getEntry(sessionId, studentId);
    if (!entry) return;
    entry.remarks = remarks || '';
    entry.updatedAt = new Date().toISOString();
    this.save();
  }

  markAllPresent(sessionId) {
    this.store.entries.forEach(e => {
      if (e.sessionId === sessionId) {
        e.status = 'Present';
        e.updatedAt = new Date().toISOString();
      }
    });
    this.save();
  }

  closeSession(sessionId) {
    const session = this.getSession(sessionId);
    if (session && !session.closedAt) {
      session.closedAt = new Date().toISOString();
    }
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
    this.save();
  }

  deleteSession(sessionId) {
    this.store.sessions = this.store.sessions.filter(s => s.id !== sessionId);
    this.store.entries = this.store.entries.filter(e => e.sessionId !== sessionId);
    if (this.activeSessionId === sessionId) this.activeSessionId = null;
    this.save();
  }

  // =========================================================
  // Gentle Analytics (sage tones, never guilt)
  // =========================================================

  getSessionSummary(sessionId) {
    const entries = this.getEntriesForSession(sessionId);
    const counts = { Present: 0, Tardy: 0, Excused: 0, Absent: 0 };
    entries.forEach(e => {
      if (counts[e.status] !== undefined) counts[e.status]++;
    });
    const total = entries.length;
    const attended = counts.Present + counts.Tardy; // Tardy learners did arrive
    return { ...counts, total, attended, rate: total > 0 ? Math.round((attended / total) * 100) : null };
  }
  getClassRateSummary(classId) {
    const sessions = this.getSessionsForClass(classId);
    const counts = { Present: 0, Tardy: 0, Excused: 0, Absent: 0 };
    let total = 0;
    sessions.forEach(s => {
      this.getEntriesForSession(s.id).forEach(e => {
        if (counts[e.status] !== undefined) counts[e.status]++;
        total++;
      });
    });
    const attended = counts.Present + counts.Tardy;
    return {
      ...counts, total, attended, sessions: sessions.length,
      rate: total > 0 ? Math.round((attended / total) * 100) : null
    };
  }

  getStudentRateMap(classId) {
    const map = new Map();
    this.getSessionsForClass(classId).forEach(s => {
      this.getEntriesForSession(s.id).forEach(e => {
        const rec = map.get(e.studentId) || { attended: 0, total: 0 };
        rec.total++;
        if (e.status === 'Present' || e.status === 'Tardy') rec.attended++;
        map.set(e.studentId, rec);
      });
    });
    return map;
  }

  getTotalStats() {
    let marks = 0;
    let present = 0;
    const learners = new Set();
    this.store.entries.forEach(e => {
      marks++;
      if (e.status === 'Present' || e.status === 'Tardy') present++;
      learners.add(e.studentId);
    });
    return {
      sessions: this.store.sessions.length,
      marks,
      learners: learners.size,
      rate: marks > 0 ? Math.round((present / marks) * 100) : null
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
          <h2 class="section-title">Daily Attendance Tracker 📋🌿</h2>
          <p class="section-desc">DepEd SF2-aligned roll call for your practicum sections — gentle, private, and always on-device.</p>
        </div>
        <div class="header-actions">
          <button class="btn-primary" data-att-action="quick-open" title="Open roll call for today">
            <span>📋 Open Today's Roll Call</span>
          </button>
        </div>
      </div>

      <div class="fs-metrics-banner">
        <div class="fs-stat-pill">
          <span class="stat-num">${totals.sessions}</span>
          <span class="stat-label">Roll Call Sessions</span>
        </div>
        <div class="fs-stat-pill">
          <span class="stat-num">${totals.rate === null ? '—' : totals.rate + '%'}</span>
          <span class="stat-label">Present Rate (All Sections)</span>
        </div>
        <div class="fs-stat-pill">
          <span class="stat-num">${totals.learners}</span>
          <span class="stat-label">Learners Tracked</span>
        </div>
        <div class="fs-curriculum-badge">
          <span>✓ DepEd SF2-Aligned • Present / Tardy / Excused / Absent</span>
        </div>
      </div>
    `;

    if (!hasClasses) {
      html += `
        <div class="sub-card att-empty-card">
          <div class="empty-icon">🌱</div>
          <h4>No Teaching Sections Yet</h4>
          <p>Attendance grows from your classroom rosters. Create your first section in Classrooms, add learners (or paste a roster), and your roll calls will bloom from there.</p>
          <div class="empty-actions">
            <button class="btn-primary" data-att-action="goto-classrooms">👥 Go to Classrooms</button>
          </div>
        </div>
      `;
      this.container.innerHTML = html;
      return;
    }
    // Roll Call Launcher
    const classOptions = (this.classManager.classes || [])
      .map(c => `<option value="${c.id}" ${c.id === this.selectedClassId ? 'selected' : ''}>${escapeHtml(c.subjectCode)} — ${escapeHtml(c.sectionName)}</option>`)
      .join('');

    html += `
      <div class="sub-card att-launcher-card">
        <div class="att-launcher-row">
          <div class="att-field att-field-grow">
            <label for="att-class-select">Teaching Section</label>
            <select id="att-class-select">${classOptions}</select>
          </div>
          <div class="att-field">
            <label for="att-session-date">Session Date</label>
            <input type="date" id="att-session-date" value="${this.sessionDate}">
          </div>
          <button class="btn-primary" data-att-action="open-session">
            <span>📋 Open Roll Call for This Date</span>
          </button>
        </div>
        <p class="att-launcher-hint">🌿 Opening a roll call gently marks every enrolled learner <strong>Present</strong> by default — you only adjust the exceptions. No guilt, just peaceful bookkeeping.</p>
      </div>
    `;

    // Active Session Card
    const session = this.activeSessionId ? this.getSession(this.activeSessionId) : null;
    if (session) {
      html += this.renderSessionCard(session);
    } else {
      html += `
        <div class="sub-card att-empty-card att-session-card">
          <div class="empty-icon">🌤️</div>
          <h4>No Roll Call Open</h4>
          <p>Pick a section and date above, then open a roll call. Past sessions stay peacefully archived below.</p>
        </div>
      `;
    }

    // Session History
    html += this.renderHistory(activeClass);

    this.container.innerHTML = html;
  }

  renderSessionCard(session) {
    const summary = this.getSessionSummary(session.id);
    const rate = summary.rate === null ? 0 : summary.rate;
    const cls = this.classManager?.getClassroom ? this.classManager.getClassroom(session.classId) : null;
    const sectionName = cls?.sectionName || session.sectionName || 'Section';
    const enrolled = this.classManager?.getEnrolledStudents ? this.classManager.getEnrolledStudents(session.classId, true).all : [];
    const rateMap = this.getStudentRateMap(session.classId);

    const chips = AttendanceTracker.STATUS_ORDER.map(st => {
      const meta = AttendanceTracker.STATUS_META[st];
      const count = summary[st] || 0;
      const dim = count === 0 ? ' style="opacity:0.45;"' : '';
      return `<span class="att-chip chip-${st.toLowerCase()}"${dim}>${meta.icon} ${meta.label}: <strong>${count}</strong></span>`;
    }).join('');

    const rows = enrolled.map((st, idx) => {
      const entry = this.getEntry(session.id, st.id) || { status: 'Present', remarks: '' };
      const mi = st.middleInitial ? ` ${st.middleInitial}` : '';
      const fullName = `${st.lastName}, ${st.firstName}${mi}`;
      const rec = rateMap.get(st.id);

      const segButtons = AttendanceTracker.STATUS_ORDER.map(stt => {
        const meta = AttendanceTracker.STATUS_META[stt];
        const isActive = entry.status === stt ? ' active' : '';
        return `<button class="att-seg-btn seg-${stt.toLowerCase()}${isActive}" data-att-action="mark" data-student-id="${st.id}" data-status="${stt}" title="${meta.label}">${meta.icon} ${meta.label}</button>`;
      }).join('');

      const rateLine = rec && rec.total > 0
        ? `<div class="att-student-rate">🌿 ${rec.attended}/${rec.total} days attended</div>`
        : `<div class="att-student-rate">🌱 First roll call</div>`;

      return `
        <tr>
          <td style="font-weight:700; color:var(--text-muted);">${idx + 1}</td>
          <td>
            <div class="student-name-cell">
              <span>${st.gender === 'Male' ? '👦' : '👧'}</span>
              <span>${escapeHtml(fullName)}</span>
            </div>
            ${rateLine}
          </td>
          <td>
            <div class="att-seg-control">${segButtons}</div>
          </td>
          <td>
            <input type="text" class="att-remarks-input" data-att-remarks data-student-id="${st.id}"
                   value="${escapeHtml(entry.remarks || '')}" placeholder="Gentle note…">
          </td>
        </tr>
      `;
    }).join('');

    const closedBadge = session.closedAt ? `<span class="att-closed-badge">✅ Session Closed</span>` : '';

    return `
      <div class="sub-card att-session-card">
        <div class="att-session-header">
          <div>
            <h3 class="att-session-title">📋 ${this.formatDate(session.date)} — ${escapeHtml(sectionName)} ${closedBadge}</h3>
            <div class="att-summary-chips">${chips}</div>
          </div>
          <div class="att-session-actions">
            <button class="btn-subtle" data-att-action="mark-all-present" title="Gently return everyone to Present">🌿 Mark All Present</button>
            <button class="btn-secondary" data-att-action="print-session" title="Print DepEd SF2-style attendance report">🖨️ Print SF2 Sheet</button>
            <button class="btn-subtle" data-att-action="close-session" title="Archive this roll call">✅ Close Session</button>
            <button class="btn-subtle text-danger" data-att-action="delete-session" title="Delete this roll call">🗑️</button>
          </div>
        </div>
        <div class="att-rate-bar" title="${rate}% attended (Present + Tardy)">
          <div class="att-rate-fill" style="width:${rate}%;"></div>
        </div>
        <div class="att-rate-caption">🌿 ${summary.attended} of ${summary.total} learners attended (Present + Tardy)</div>
        ${enrolled.length === 0 ? `
          <div class="att-empty">
            <div class="empty-icon">🌱</div>
            <h4>No Learners in This Section Yet</h4>
            <p>Add learners or paste a roster in Classrooms, then reopen this roll call.</p>
            <div class="empty-actions">
              <button class="btn-primary" data-att-action="goto-classrooms">👥 Manage Roster</button>
            </div>
          </div>
        ` : `
          <div class="table-responsive">
            <table class="roster-table att-table">
              <thead>
                <tr>
                  <th style="width:50px;">#</th>
                  <th>Learner</th>
                  <th style="width:340px;">Roll Call Status</th>
                  <th style="width:220px;">Gentle Remarks</th>
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
    const sessions = this.getSessionsForClass(this.selectedClassId);
    const sectionName = activeClass?.sectionName || 'this section';

    let inner;
    if (sessions.length === 0) {
      inner = `
        <div class="att-empty">
          <div class="empty-icon">🗓️</div>
          <p>No roll calls recorded for ${escapeHtml(sectionName)} yet. Your first one is a single tap away above.</p>
        </div>
      `;
    } else {
      inner = `
        <div class="att-history-grid">
          ${sessions.map(s => {
            const sum = this.getSessionSummary(s.id);
            const isActive = s.id === this.activeSessionId;
            return `
              <div class="att-history-card ${isActive ? 'active-session' : ''}">
                <div class="att-history-date">${this.formatDate(s.date)}</div>
                <div class="att-history-counts">
                  <span class="att-mini-chip mini-present">✓ ${sum.Present}</span>
                  <span class="att-mini-chip mini-tardy">⏰ ${sum.Tardy}</span>
                  <span class="att-mini-chip mini-excused">📝 ${sum.Excused}</span>
                  <span class="att-mini-chip mini-absent">🍃 ${sum.Absent}</span>
                </div>
                <div class="att-history-rate">${sum.rate === null ? 'No learners enrolled at the time' : `🌿 ${sum.rate}% attended`}</div>
                <div class="att-history-actions">
                  <button class="btn-subtle" data-att-action="open-history-session" data-session-id="${s.id}">📖 Open</button>
                  <button class="btn-subtle text-danger" data-att-action="delete-history-session" data-session-id="${s.id}" title="Delete this roll call">🗑️</button>
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
          <span>🗓️ Roll Call History — ${escapeHtml(sectionName)}</span>
        </div>
        ${inner}
      </div>
    `;
  }

  // =========================================================
  // Event Wiring (event delegation — survives re-renders)
  // =========================================================

  bindEvents() {
    if (!this.container || this.container.dataset.attBound === 'true') return;
    this.container.dataset.attBound = 'true';

    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest ? e.target.closest('[data-att-action]') : null;
      if (!btn) return;
      this.handleAction(btn.dataset.attAction, btn.dataset);
    });

    // Remarks save silently on every keystroke (no re-render, keeps typing focus)
    this.container.addEventListener('input', (e) => {
      if (!e.target.hasAttribute || !e.target.hasAttribute('data-att-remarks')) return;
      if (!this.activeSessionId) return;
      this.setRemarks(this.activeSessionId, e.target.dataset.studentId, e.target.value);
    });

    this.container.addEventListener('change', (e) => {
      if (e.target.id === 'att-class-select') {
        this.selectedClassId = e.target.value;
        this.activeSessionId = this.getSessionsForClass(this.selectedClassId)[0]?.id || null;
        this.render();
      } else if (e.target.id === 'att-session-date') {
        this.sessionDate = e.target.value || this.localDateStr();
      }
    });
  }

  handleAction(action, data = {}) {
    switch (action) {
      case 'quick-open': {
        if (!this.selectedClassId) return;
        const result = this.startRollCall(this.selectedClassId, this.localDateStr());
        showToast(result?.created ? 'Roll call opened. Everyone starts Present — adjust only the exceptions. 🌿' : 'Reopened today\'s roll call. 🌿', 'success');
        this.render();
        break;
      }
      case 'open-session': {
        if (!this.selectedClassId) return;
        const result = this.startRollCall(this.selectedClassId, this.sessionDate);
        showToast(result?.created ? 'Roll call opened. Everyone starts Present — adjust only the exceptions. 🌿' : 'That date\'s roll call is already open — resuming it. 🌿', 'success');
        this.render();
        break;
      }
      case 'mark': {
        if (!this.activeSessionId || !data.studentId) return;
        this.markStudent(this.activeSessionId, data.studentId, data.status);
        this.render();
        break;
      }
      case 'mark-all-present': {
        if (!this.activeSessionId) return;
        this.markAllPresent(this.activeSessionId);
        showToast('Everyone is marked Present. A gentle fresh start. 🌿', 'success');
        this.render();
        break;
      }
      case 'print-session': {
        if (this.activeSessionId) this.printSF2Sheet(this.activeSessionId);
        break;
      }
      case 'close-session': {
        if (!this.activeSessionId) return;
        this.closeSession(this.activeSessionId);
        showToast('Roll call archived peacefully. Rest easy, Teacher. 🌿', 'info');
        this.render();
        break;
      }
      case 'delete-session':
      case 'delete-history-session': {
        const id = data.sessionId;
        if (!id) return;
        if (confirm('Delete this roll call and its attendance records?')) {
          this.deleteSession(id);
          showToast('Roll call removed.', 'info');
          this.render();
        }
        break;
      }
      case 'open-history-session': {
        const id = data.sessionId;
        if (!id) return;
        const session = this.getSession(id);
        if (!session) return;
        this.selectedClassId = session.classId;
        this.sessionDate = session.date;
        this.activeSessionId = id;
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
  // 🖨️ DepEd SF2-Style Printable Daily Attendance Report
  // =========================================================

  printSF2Sheet(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return;

    const summary = this.getSessionSummary(sessionId);
    const cls = this.classManager?.getClassroom ? this.classManager.getClassroom(session.classId) : null;
    const enrolled = this.classManager?.getEnrolledStudents ? this.classManager.getEnrolledStudents(session.classId, true).all : [];

    let printContainer = document.getElementById('att-print-sheet');
    if (!printContainer) {
      printContainer = document.createElement('div');
      printContainer.id = 'att-print-sheet';
      printContainer.className = 'print-only-container';
      document.body.appendChild(printContainer);
    }

    const rows = enrolled.map((st, idx) => {
      const entry = this.getEntry(sessionId, st.id) || { status: 'Present', remarks: '' };
      const mi = st.middleInitial ? ` ${st.middleInitial}` : '';
      const fullName = `${st.lastName}, ${st.firstName}${mi}`;
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>${escapeHtml(fullName)}</td>
          <td style="text-align:center;">${st.gender === 'Male' ? 'M' : 'F'}</td>
          <td style="text-align:center;">${escapeHtml(st.lrn || '—')}</td>
          <td style="text-align:center; font-weight:700;">${entry.status.toUpperCase()}</td>
          <td>${escapeHtml(entry.remarks || '')}</td>
        </tr>
      `;
    }).join('');

    printContainer.innerHTML = `
      <div class="att-print-document">
        <div class="print-header">
          <h3>Republic of the Philippines • Department of Education</h3>
          <h2>DAILY ATTENDANCE REPORT (SF2-ALIGNED)</h2>
          <p class="course-subtitle">Pre-Service Teacher Practicum Roll Call — Pedagogo Desk</p>
        </div>
        <div class="att-print-meta">
          <div><strong>Subject:</strong> ${escapeHtml(cls?.subjectCode || session.subjectCode || '—')} ${escapeHtml(cls?.subjectTitle || '')}</div>
          <div><strong>Section &amp; Grade:</strong> ${escapeHtml(cls?.sectionName || session.sectionName || '—')} ${escapeHtml(cls?.gradeLevel || '')}</div>
          <div><strong>School:</strong> ${escapeHtml(cls?.schoolName || session.schoolName || '—')}</div>
          <div><strong>School Year / Term:</strong> ${escapeHtml(cls?.schoolYear || '—')} • ${escapeHtml(cls?.term || session.term || '—')}</div>
          <div><strong>Date of Roll Call:</strong> ${this.formatDate(session.date)}</div>
          <div><strong>Room:</strong> ${escapeHtml(cls?.room || '—')}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:30px;">#</th>
              <th>Learner Full Name</th>
              <th style="width:40px;">Sex</th>
              <th style="width:110px;">LRN</th>
              <th style="width:90px;">Status</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="att-print-summary">
          <strong>Session Summary:</strong>
          Present: ${summary.Present} • Tardy: ${summary.Tardy} • Excused: ${summary.Excused} • Absent: ${summary.Absent}
          ${summary.rate !== null ? `• Attended: ${summary.rate}%` : ''}
        </div>
        <div class="att-print-signatures">
          <div class="sig-item"><div class="line"></div><span>Pre-Service Teacher (Intern)</span></div>
          <div class="sig-item"><div class="line"></div><span>Cooperating Teacher (CT)</span></div>
          <div class="sig-item"><div class="line"></div><span>School Head / Principal</span></div>
        </div>
      </div>
    `;

    document.body.classList.add('printing-sf2-sheet');
    try {
      window.print();
    } finally {
      document.body.classList.remove('printing-sf2-sheet');
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
