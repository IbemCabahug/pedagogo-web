/**
 * Pedagogo Desk: Anecdotal Records & Learner Observation Journal 🌿📔
 * (Roadmap Future Module C — Practicum Portfolio & DepEd Positive Discipline)
 *
 * Grounded in:
 * 1. DepEd Child Protection Policy (DepEd Order No. 40, s. 2012) & Positive Discipline
 * 2. PPST Domain 2 (Learning Environment — Strand 2.6 Positive Discipline) & Domain 3 (Diversity of Learners)
 * 3. The ABC Observation Model (Antecedent / Trigger -> Observable Behavior -> Restorative Intervention -> Learner Response)
 * 4. Republic Act 10173 (Data Privacy Act of 2012) — 100% on-device with 1-click Portfolio Privacy Masking
 */

import { showToast } from './toast.js';
import { showCalmConfirm } from './calm-dialog.js';

export class AnecdotalRecordTracker {
  static STORAGE_KEY = 'pedagogo_anecdotal_records';

  static TAGS = [
    { id: 'ACADEMIC_BREAKTHROUGH', label: 'Academic Breakthrough', icon: '💡', color: '#3B6347', desc: 'Breakthrough in comprehension or mastery' },
    { id: 'STRENGTHS_TALENTS', label: 'Strengths & Talents', icon: '✨', color: '#D98326', desc: 'Exceptional creativity, leadership, or unique gift' },
    { id: 'BEHAVIORAL_SUPPORT', label: 'Behavioral Support', icon: '🌱', color: '#BF5F3E', desc: 'Needs gentle coaching or restorative routine adjustment' },
    { id: 'SOCIAL_EMOTIONAL', label: 'Social & Emotional', icon: '🤝', color: '#2F6F80', desc: 'Peer interaction, self-regulation, empathy, or adjustment' },
    { id: 'PARENT_CONSULTATION', label: 'Parent / Guardian Consultation', icon: '🏡', color: '#8A5A83', desc: 'Notes from homeroom dialogue or PTA follow-up' }
  ];

  static SETTINGS = [
    'Classroom Recitation & Discussion',
    'Collaborative Group Activity',
    'Individual Seatwork / Practice',
    'Laboratory / Demonstration Work',
    'Morning Homeroom / Routine',
    'Recess / Unstructured School Climate',
    'Co-Curricular / School Event'
  ];

  static PPST_DOMAINS = [
    'Domain 2: Learning Environment (Strand 2.6 Positive Discipline)',
    'Domain 3: Diversity of Learners (Strand 3.1 Needs & Strengths)',
    'Domain 3: Diversity of Learners (Strand 3.4 Giftedness & Talents)',
    'Domain 1: Content Knowledge and Pedagogy (HOTS & Engagement)',
    'Domain 6: Community Linkages & Parent Engagement'
  ];

  constructor(classManager = null) {
    this.classManager = classManager;
    this.container = document.getElementById('view-anecdotal');
    this.entries = this.loadStore();
    this.selectedClassId = classManager?.selectedClassId || classManager?.classes?.[0]?.id || null;
    this.selectedStudentId = 'ALL'; // 'ALL' or studentId
    this.selectedTagFilter = 'ALL';
    this.anonymizePortfolio = false; // RA 10173 Privacy Mask for prints/exports

    if (this.container) {
      this.render();
      this.bindEvents();
    }

    // Synchronize when a classroom is deleted
    window.addEventListener('pedagogo:class-deleted', (e) => {
      const deletedId = e.detail?.classId;
      this.entries = this.loadStore();
      if (this.selectedClassId === deletedId) {
        this.selectedClassId = this.classManager?.classes?.[0]?.id || null;
        this.selectedStudentId = 'ALL';
      }
      if (this.container) this.render();
    });
  }

  // =========================================================
  // Data Persistence Layer
  // =========================================================

  loadStore() {
    const raw = localStorage.getItem(AnecdotalRecordTracker.STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Failed to load anecdotal records:', e);
      }
    }
    return this.getStarterEntries();
  }

  saveStore() {
    localStorage.setItem(AnecdotalRecordTracker.STORAGE_KEY, JSON.stringify(this.entries));
  }

  getStarterEntries() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    return [
      {
        id: 'anec_' + Date.now() + '_init1',
        classId: this.selectedClassId || 'cls_sample',
        studentId: 'stu_sample_1',
        studentName: 'Dela Cruz, Juan P.',
        date: dateStr,
        time: '09:40 AM',
        setting: 'Collaborative Group Activity',
        tag: 'ACADEMIC_BREAKTHROUGH',
        ppstStrand: 'Domain 3: Diversity of Learners (Strand 3.1 Needs & Strengths)',
        contextAntecedent: 'During science group experiment on soil layers, student was initially hesitant to join the discussion.',
        observedBehavior: 'Took initiative to organize the sample jars neatly and sketched the stratum layers accurately for his groupmates.',
        pedagogicalActionTaken: 'Affirmed his visual rendering in front of the team and invited him to be the group presenter.',
        outcomeResponse: 'Smiled, stood tall, and explained the differences between topsoil and subsoil with noticeable confidence.',
        createdAt: new Date().toISOString()
      },
      {
        id: 'anec_' + Date.now() + '_init2',
        classId: this.selectedClassId || 'cls_sample',
        studentId: 'stu_sample_2',
        studentName: 'Santos, Maria C.',
        date: dateStr,
        time: '01:15 PM',
        setting: 'Classroom Recitation & Discussion',
        tag: 'BEHAVIORAL_SUPPORT',
        ppstStrand: 'Domain 2: Learning Environment (Strand 2.6 Positive Discipline)',
        contextAntecedent: 'Transition between Math problem set and English reading comprehension; classroom was somewhat noisy.',
        observedBehavior: 'Tapped her ruler loudly on the desk and sighed repeatedly, expressing frustration that she could not find her workbook.',
        pedagogicalActionTaken: 'Conducted a gentle 1-minute calming breath check with the whole class, knelt beside her desk, and helped her locate the workbook under her seatmate’s shared basket.',
        outcomeResponse: 'Regained composure, thanked the teacher quietly, and completed the first reading task without further anxiety.',
        createdAt: new Date().toISOString()
      }
    ];
  }

  // =========================================================
  // Query & Operations
  // =========================================================

  getEntriesForClass(classId) {
    if (!classId) return [];
    return this.entries.filter(e => e.classId === classId);
  }

  getEntriesForStudent(studentId) {
    if (!studentId || studentId === 'ALL') return this.entries;
    return this.entries.filter(e => e.studentId === studentId);
  }

  createEntry(data) {
    const entry = {
      id: 'anec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      classId: data.classId,
      studentId: data.studentId,
      studentName: data.studentName || 'Learner',
      date: data.date || new Date().toISOString().split('T')[0],
      time: data.time?.trim() || '',
      setting: data.setting || AnecdotalRecordTracker.SETTINGS[0],
      tag: data.tag || 'BEHAVIORAL_SUPPORT',
      ppstStrand: data.ppstStrand || AnecdotalRecordTracker.PPST_DOMAINS[0],
      contextAntecedent: data.contextAntecedent?.trim() || '',
      observedBehavior: data.observedBehavior?.trim() || '',
      pedagogicalActionTaken: data.pedagogicalActionTaken?.trim() || '',
      outcomeResponse: data.outcomeResponse?.trim() || '',
      createdAt: new Date().toISOString()
    };
    this.entries.unshift(entry);
    this.saveStore();
    return entry;
  }

  updateEntry(id, data) {
    const idx = this.entries.findIndex(e => e.id === id);
    if (idx === -1) return null;
    this.entries[idx] = {
      ...this.entries[idx],
      ...data,
      updatedAt: new Date().toISOString()
    };
    this.saveStore();
    return this.entries[idx];
  }

  deleteEntry(id) {
    this.entries = this.entries.filter(e => e.id !== id);
    this.saveStore();
  }

  maskName(name) {
    if (!name) return 'Learner';
    // If format is "LastName, FirstName Middle", produce "Learner L.F."
    const parts = name.replace(/,/g, '').split(' ').filter(Boolean);
    if (parts.length >= 2) {
      const initials = parts.map(p => p[0].toUpperCase() + '.').join('');
      return `Learner ${initials}`;
    }
    return `Learner ${name.charAt(0).toUpperCase()}.`;
  }

  // =========================================================
  // Rendering
  // =========================================================

  render() {
    if (!this.container) return;

    const hasClasses = (this.classManager?.classes || []).length > 0;
    const activeClass = this.classManager?.getClassroom(this.selectedClassId);

    let html = `
      <div class="view-header">
        <div>
          <h2 class="section-title">Anecdotal Records &amp; Observation Journal 🌿📔</h2>
          <p class="section-desc">Grounded in DepEd Positive Discipline &amp; PPST Domains — authentic, non-judgmental learner case notes for your Practicum Portfolio.</p>
        </div>
        <div class="header-actions">
          <button class="btn-subtle" id="btn-anec-toggle-privacy" title="Mask real names for public exhibition portfolios (RA 10173 compliance)">
            <span>${this.anonymizePortfolio ? '🔒 Privacy Mask: ON (e.g. Learner J.D.)' : '🔓 Privacy Mask: OFF (Full Names)'}</span>
          </button>
          <button class="btn-subtle" id="btn-anec-print-portfolio" title="Print DepEd Case Record for Practicum Portfolio">
            <span>🖨️ Print Portfolio Sheet</span>
          </button>
          <button class="btn-primary" id="btn-anec-new-entry" ${!hasClasses ? 'disabled' : ''}>
            <span>➕ Log New Observation</span>
          </button>
        </div>
      </div>
    `;

    if (!hasClasses) {
      html += `
        <div class="sub-card att-empty-card">
          <div class="empty-icon">🌱</div>
          <h4>No Teaching Sections Configured</h4>
          <p>Anecdotal observations are anchored to your learners. Create a section and enroll learners in Classrooms to begin your observation journal.</p>
          <div class="empty-actions">
            <button class="btn-primary" id="btn-anec-goto-classrooms">👥 Go to Classrooms</button>
          </div>
        </div>
      `;
      this.container.innerHTML = html;
      this.bindEvents();
      return;
    }

    // Metrics Banner
    const classEntries = this.getEntriesForClass(this.selectedClassId);
    const uniqueLearners = new Set(classEntries.map(e => e.studentId)).size;
    const strengthsCount = classEntries.filter(e => e.tag === 'STRENGTHS_TALENTS' || e.tag === 'ACADEMIC_BREAKTHROUGH').length;
    const supportCount = classEntries.filter(e => e.tag === 'BEHAVIORAL_SUPPORT' || e.tag === 'SOCIAL_EMOTIONAL').length;

    html += `
      <div class="fs-metrics-banner anec-metrics-banner">
        <div class="fs-stat-pill">
          <span class="stat-num">${classEntries.length}</span>
          <span class="stat-label">Observation Notes</span>
        </div>
        <div class="fs-stat-pill">
          <span class="stat-num">${uniqueLearners}</span>
          <span class="stat-label">Learners Observed</span>
        </div>
        <div class="fs-stat-pill">
          <span class="stat-num" style="color: #3B6347;">${strengthsCount}</span>
          <span class="stat-label">Strengths &amp; Breakthroughs</span>
        </div>
        <div class="fs-stat-pill">
          <span class="stat-num" style="color: #D98326;">${supportCount}</span>
          <span class="stat-label">Restorative Supports</span>
        </div>
        <div class="fs-curriculum-badge">
          <span>✓ DepEd Order 40 Positive Discipline • PPST Domains 2 &amp; 3 Aligned</span>
        </div>
      </div>
    `;

    // Filter Controls Card
    const classOptions = (this.classManager.classes || []).map(c => `
      <option value="${c.id}" ${c.id === this.selectedClassId ? 'selected' : ''}>
        ${this.escapeHtml(`${c.subjectCode || ''} — ${c.sectionName || ''}`.trim())}
      </option>
    `).join('');

    const enrolledStudents = this.classManager.getEnrolledStudents(this.selectedClassId, true).all || [];
    const studentOptions = `
      <option value="ALL" ${this.selectedStudentId === 'ALL' ? 'selected' : ''}>All Learners in Section (${enrolledStudents.length})</option>
      ${enrolledStudents.map(s => `
        <option value="${s.id}" ${s.id === this.selectedStudentId ? 'selected' : ''}>
          ${this.escapeHtml(this.anonymizePortfolio ? this.maskName(`${s.lastName}, ${s.firstName}`) : `${s.lastName}, ${s.firstName}`)}
        </option>
      `).join('')}
    `;

    html += `
      <div class="sub-card anec-controls-card">
        <div class="anec-filter-row">
          <div class="anec-field">
            <label for="anec-class-select">Teaching Section</label>
            <select id="anec-class-select">${classOptions}</select>
          </div>
          <div class="anec-field anec-field-grow">
            <label for="anec-student-select">Filter by Specific Learner</label>
            <select id="anec-student-select">${studentOptions}</select>
          </div>
          <div class="anec-field">
            <label for="anec-tag-select">Observation Tag</label>
            <select id="anec-tag-select">
              <option value="ALL" ${this.selectedTagFilter === 'ALL' ? 'selected' : ''}>All Categories</option>
              ${AnecdotalRecordTracker.TAGS.map(t => `<option value="${t.id}" ${t.id === this.selectedTagFilter ? 'selected' : ''}>${t.icon} ${t.label}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    `;

    // Timeline Stream
    let filteredEntries = classEntries;
    if (this.selectedStudentId !== 'ALL') {
      filteredEntries = filteredEntries.filter(e => e.studentId === this.selectedStudentId);
    }
    if (this.selectedTagFilter !== 'ALL') {
      filteredEntries = filteredEntries.filter(e => e.tag === this.selectedTagFilter);
    }

    if (filteredEntries.length === 0) {
      html += `
        <div class="sub-card att-empty-card" style="margin-top: 1rem;">
          <div class="empty-icon">📔</div>
          <h4>No Anecdotal Entries Match Your Filter</h4>
          <p>Every learner has unique moments of growth and developmental shifts. Tap <strong>➕ Log New Observation</strong> to record a factual, supportive entry.</p>
        </div>
      `;
    } else {
      html += `<div class="anec-timeline-stream">`;
      filteredEntries.forEach(entry => {
        const tagMeta = AnecdotalRecordTracker.TAGS.find(t => t.id === entry.tag) || AnecdotalRecordTracker.TAGS[2];
        const displayName = this.anonymizePortfolio ? this.maskName(entry.studentName) : entry.studentName;

        html += `
          <div class="anec-card" data-entry-id="${entry.id}">
            <div class="anec-card-header">
              <div class="anec-learner-chip">
                <span class="learner-icon">👤</span>
                <span class="learner-name">${this.escapeHtml(displayName)}</span>
                <span class="setting-pill">📍 ${this.escapeHtml(entry.setting)}</span>
              </div>
              <div class="anec-header-meta">
                <span class="anec-tag-pill" style="border-color: ${tagMeta.color}; color: ${tagMeta.color};">
                  ${tagMeta.icon} ${tagMeta.label}
                </span>
                <span class="anec-date-pill">🗓️ ${this.escapeHtml(entry.date)} ${entry.time ? '• ' + this.escapeHtml(entry.time) : ''}</span>
                <button class="btn-subtle btn-delete-anec" data-entry-id="${entry.id}" title="Remove entry">✕</button>
              </div>
            </div>

            <div class="anec-card-body">
              <div class="anec-strand-banner">
                <span>📘 ${this.escapeHtml(entry.ppstStrand)}</span>
              </div>

              <div class="anec-abc-grid">
                <!-- A: Antecedent / Trigger -->
                <div class="anec-abc-cell">
                  <div class="abc-label">A • Antecedent / Trigger</div>
                  <p class="abc-text">${this.escapeHtml(entry.contextAntecedent || '— Regular classroom routine —')}</p>
                </div>

                <!-- B: Observable Behavior -->
                <div class="anec-abc-cell highlight-b">
                  <div class="abc-label">B • Factual Observation (Behavior)</div>
                  <p class="abc-text">${this.escapeHtml(entry.observedBehavior)}</p>
                </div>

                <!-- C: Restorative Action & Response -->
                <div class="anec-abc-cell">
                  <div class="abc-label">C • Restorative Intervention &amp; Action</div>
                  <p class="abc-text">${this.escapeHtml(entry.pedagogicalActionTaken)}</p>
                </div>

                <!-- Outcome / Learner Response -->
                <div class="anec-abc-cell">
                  <div class="abc-label">Response &amp; Progress</div>
                  <p class="abc-text">${this.escapeHtml(entry.outcomeResponse || 'Observed constructively.')}</p>
                </div>
              </div>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    this.container.innerHTML = html;
    this.bindEvents();
  }

  // =========================================================
  // Modal: Add Observation Record
  // =========================================================

  openNewEntryModal() {
    let modal = document.getElementById('modal-anec-entry');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-anec-entry';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    const enrolled = this.classManager?.getEnrolledStudents(this.selectedClassId, true).all || [];
    const studentOptions = enrolled.map(s => `
      <option value="${s.id}" data-name="${this.escapeHtml(`${s.lastName}, ${s.firstName} ${s.middleInitial || ''}`.trim())}">
        ${this.escapeHtml(`${s.lastName}, ${s.firstName} ${s.middleInitial ? s.middleInitial + '.' : ''}`)}
      </option>
    `).join('');

    const tagOptions = AnecdotalRecordTracker.TAGS.map(t => `
      <option value="${t.id}">${t.icon} ${t.label} — ${t.desc}</option>
    `).join('');

    const settingOptions = AnecdotalRecordTracker.SETTINGS.map(s => `
      <option value="${s}">${s}</option>
    `).join('');

    const ppstOptions = AnecdotalRecordTracker.PPST_DOMAINS.map(p => `
      <option value="${p}">${p}</option>
    `).join('');

    const todayStr = new Date().toISOString().split('T')[0];

    modal.innerHTML = `
      <div class="modal-card modal-card-wide">
        <div class="modal-header">
          <div class="modal-title-group">
            <h3>Log Anecdotal Learner Observation 🌿</h3>
            <span class="modal-subtitle">Grounded in Positive Discipline (DepEd Order 40, s. 2012) • Factual &amp; Supportive</span>
          </div>
          <button class="btn-subtle" id="btn-close-anec-modal">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-row">
            <div class="form-group" style="flex: 2;">
              <label for="anec-modal-student">Learner Name *</label>
              <select id="anec-modal-student" class="form-control">
                ${studentOptions.length > 0 ? studentOptions : '<option value="">No learners enrolled yet</option>'}
              </select>
            </div>
            <div class="form-group" style="flex: 1;">
              <label for="anec-modal-date">Observation Date *</label>
              <input type="date" id="anec-modal-date" class="form-control" value="${todayStr}">
            </div>
            <div class="form-group" style="flex: 1;">
              <label for="anec-modal-time">Time / Period</label>
              <input type="text" id="anec-modal-time" class="form-control" placeholder="e.g. 09:30 AM / Recess">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex: 1;">
              <label for="anec-modal-setting">Observation Setting *</label>
              <select id="anec-modal-setting" class="form-control">
                ${settingOptions}
              </select>
            </div>
            <div class="form-group" style="flex: 1;">
              <label for="anec-modal-tag">Developmental Category *</label>
              <select id="anec-modal-tag" class="form-control">
                ${tagOptions}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="anec-modal-ppst">PPST Domain Alignment *</label>
            <select id="anec-modal-ppst" class="form-control">
              ${ppstOptions}
            </select>
          </div>

          <!-- ABC Framework Guidance Strip -->
          <div class="anec-guidance-callout">
            <span class="callout-icon">💡</span>
            <span class="callout-text">
              <strong>Calm Teacher Guidance:</strong> Record <em>what the learner said or did</em> without labels. Instead of "Juan was disobedient," write "Juan stood up and tapped his notebook while others were writing."
            </span>
          </div>

          <div class="form-group">
            <label for="anec-modal-antecedent">A • Context / Antecedent Trigger</label>
            <textarea id="anec-modal-antecedent" class="form-control" rows="2" placeholder="What activity or event immediately preceded this moment? (e.g. During oral board drill; following transition from recess)"></textarea>
          </div>

          <div class="form-group">
            <label for="anec-modal-behavior">B • Factual Observable Behavior *</label>
            <textarea id="anec-modal-behavior" class="form-control" rows="3" placeholder="Describe the objective, observable actions or words of the learner without subjective labels..."></textarea>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex: 1;">
              <label for="anec-modal-action">C • Restorative Intervention / Action Taken *</label>
              <textarea id="anec-modal-action" class="form-control" rows="2" placeholder="What positive discipline or pedagogical scaffolding did you or the Cooperating Teacher apply?"></textarea>
            </div>
            <div class="form-group" style="flex: 1;">
              <label for="anec-modal-outcome">Learner Response / Developmental Note</label>
              <textarea id="anec-modal-outcome" class="form-control" rows="2" placeholder="How did the learner respond? What constructive shift was noted?"></textarea>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-subtle" id="btn-cancel-anec-modal">Cancel</button>
          <button class="btn-primary" id="btn-save-anec-modal">
            <span>💾 Save Observation Entry</span>
          </button>
        </div>
      </div>
    `;

    modal.classList.add('active');

    const closeModal = () => modal.classList.remove('active');
    modal.querySelector('#btn-close-anec-modal')?.addEventListener('click', closeModal);
    modal.querySelector('#btn-cancel-anec-modal')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelector('#btn-save-anec-modal')?.addEventListener('click', () => {
      const studentSelect = modal.querySelector('#anec-modal-student');
      const studentId = studentSelect?.value;
      const studentName = studentSelect?.selectedOptions[0]?.dataset?.name || 'Learner';
      const date = modal.querySelector('#anec-modal-date')?.value;
      const time = modal.querySelector('#anec-modal-time')?.value;
      const setting = modal.querySelector('#anec-modal-setting')?.value;
      const tag = modal.querySelector('#anec-modal-tag')?.value;
      const ppstStrand = modal.querySelector('#anec-modal-ppst')?.value;
      const antecedent = modal.querySelector('#anec-modal-antecedent')?.value;
      const behavior = modal.querySelector('#anec-modal-behavior')?.value;
      const action = modal.querySelector('#anec-modal-action')?.value;
      const outcome = modal.querySelector('#anec-modal-outcome')?.value;

      if (!studentId) {
        showToast('Please select a learner for this observation.', 'warning');
        return;
      }
      if (!behavior || behavior.trim().length < 5) {
        showToast('Please describe the factual observed behavior.', 'warning');
        return;
      }
      if (!action || action.trim().length < 5) {
        showToast('Please note the pedagogical intervention or positive discipline action taken.', 'warning');
        return;
      }

      this.createEntry({
        classId: this.selectedClassId,
        studentId,
        studentName,
        date,
        time,
        setting,
        tag,
        ppstStrand,
        contextAntecedent: antecedent,
        observedBehavior: behavior,
        pedagogicalActionTaken: action,
        outcomeResponse: outcome
      });

      closeModal();
      showToast('Anecdotal observation recorded peacefully. 🌿', 'success');
      this.render();
    });
  }

  // =========================================================
  // Printable Portfolio Report & Word Export
  // =========================================================

  generatePortfolioHtml() {
    const activeClass = this.classManager?.getClassroom(this.selectedClassId);
    const classEntries = this.getEntriesForClass(this.selectedClassId);
    let entries = classEntries;
    if (this.selectedStudentId !== 'ALL') {
      entries = entries.filter(e => e.studentId === this.selectedStudentId);
    }

    const schoolName = activeClass?.schoolName || 'Cooperating Practicum School';
    const sectionName = `${activeClass?.subjectCode || ''} — ${activeClass?.sectionName || ''}`.trim();
    const sy = activeClass?.schoolYear || 'SY 2026–2027';

    const rows = entries.map((e, idx) => {
      const name = this.anonymizePortfolio ? this.maskName(e.studentName) : e.studentName;
      const tagMeta = AnecdotalRecordTracker.TAGS.find(t => t.id === e.tag) || AnecdotalRecordTracker.TAGS[2];
      return `
        <tr>
          <td style="width: 40px; text-align: center;">${idx + 1}</td>
          <td style="width: 140px;">
            <strong>${this.escapeHtml(name)}</strong><br>
            <span style="font-size: 11px; color: #555;">${this.escapeHtml(e.date)} ${e.time ? '(' + this.escapeHtml(e.time) + ')' : ''}</span><br>
            <span style="font-size: 11px; color: #666;">📍 ${this.escapeHtml(e.setting)}</span>
          </td>
          <td style="width: 110px;">
            <span style="font-size: 11px; font-weight: bold; color: ${tagMeta.color};">${tagMeta.label}</span><br>
            <span style="font-size: 10px; color: #777;">${this.escapeHtml(e.ppstStrand)}</span>
          </td>
          <td>
            ${e.contextAntecedent ? `<em>Trigger:</em> ${this.escapeHtml(e.contextAntecedent)}<br>` : ''}
            <strong>Observation:</strong> ${this.escapeHtml(e.observedBehavior)}
          </td>
          <td>
            <strong>Action:</strong> ${this.escapeHtml(e.pedagogicalActionTaken)}<br>
            ${e.outcomeResponse ? `<em>Response:</em> ${this.escapeHtml(e.outcomeResponse)}` : ''}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Anecdotal Learner Observation Report — ${this.escapeHtml(sectionName)}</title>
        <style>
          @page { size: portrait; margin: 1.5cm; }
          body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.35; color: #111; margin: 0; padding: 20px; }
          .header-box { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 18px; }
          .header-box h2 { margin: 0 0 4px 0; font-size: 14pt; text-transform: uppercase; letter-spacing: 0.5px; }
          .header-box h3 { margin: 0 0 4px 0; font-size: 12pt; font-weight: normal; }
          .header-box p { margin: 0; font-size: 10pt; color: #444; }
          .meta-grid { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 10.5pt; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th, td { border: 1px solid #444; padding: 6px 8px; vertical-align: top; font-size: 10pt; }
          th { background: #EFEFEF; text-align: left; font-size: 10pt; text-transform: uppercase; }
          .privacy-notice { font-size: 9pt; font-style: italic; color: #666; margin-bottom: 16px; }
          .sig-grid { display: flex; justify-content: space-between; margin-top: 36px; page-break-inside: avoid; }
          .sig-box { width: 30%; text-align: center; }
          .sig-line { border-top: 1px solid #111; margin-top: 45px; padding-top: 4px; font-weight: bold; font-size: 10pt; }
          .sig-role { font-size: 9pt; color: #555; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h2>Republic of the Philippines • Department of Education</h2>
          <h3>FIELD STUDY &amp; TEACHING INTERNSHIP PORTFOLIO</h3>
          <p><strong>ANECDOTAL RECORD &amp; LEARNER OBSERVATION LOG</strong></p>
          <p style="font-size: 9.5pt; margin-top: 2px;">Grounded in Positive Discipline (DepEd Order No. 40, s. 2012) &amp; PPST Domains 2 &amp; 3</p>
        </div>

        <div class="meta-grid">
          <div>
            <strong>School:</strong> ${this.escapeHtml(schoolName)}<br>
            <strong>Class/Section:</strong> ${this.escapeHtml(sectionName)}
          </div>
          <div style="text-align: right;">
            <strong>School Year:</strong> ${this.escapeHtml(sy)}<br>
            <strong>Date Exported:</strong> ${new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        ${this.anonymizePortfolio ? `
          <div class="privacy-notice">
            🔒 <strong>Data Privacy Compliance (RA 10173):</strong> Student identifiable names have been anonymized with initial aliases for exhibition and accreditation portfolio submission.
          </div>
        ` : ''}

        <table>
          <thead>
            <tr>
              <th style="text-align: center;">#</th>
              <th>Learner &amp; Setting</th>
              <th>Category &amp; PPST</th>
              <th>Antecedent &amp; Factual Observation</th>
              <th>Restorative Action &amp; Response</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length > 0 ? rows : '<tr><td colspan="5" style="text-align: center; padding: 20px;">No observation notes recorded for this selection.</td></tr>'}
          </tbody>
        </table>

        <div class="sig-grid">
          <div class="sig-box">
            <div class="sig-line">PRE-SERVICE TEACHER</div>
            <div class="sig-role">Observer / Teaching Intern</div>
          </div>
          <div class="sig-box">
            <div class="sig-line">COOPERATING TEACHER</div>
            <div class="sig-role">Cooperating Teacher (CT) / Mentor</div>
          </div>
          <div class="sig-box">
            <div class="sig-line">COLLEGE SUPERVISOR</div>
            <div class="sig-role">TEI Practicum Supervisor</div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  printPortfolioSheet() {
    const html = this.generatePortfolioHtml();
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Please allow popups to generate the printable portfolio sheet.', 'warning');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  }

  // =========================================================
  // Event Delegation
  // =========================================================

  bindEvents() {
    if (!this.container || !this.container.dataset || this.container.dataset.anecBound === 'true') return;
    this.container.dataset.anecBound = 'true';

    // Click actions
    this.container.addEventListener('click', async (e) => {
      // New Entry Modal
      if (e.target.closest('#btn-anec-new-entry')) {
        this.openNewEntryModal();
        return;
      }

      // Toggle Privacy Mask
      if (e.target.closest('#btn-anec-toggle-privacy')) {
        this.anonymizePortfolio = !this.anonymizePortfolio;
        showToast(
          this.anonymizePortfolio
            ? '🔒 Privacy Mask ON: Learner names masked (e.g. Learner J.D.) for public portfolios.'
            : '🔓 Privacy Mask OFF: Full learner names displayed.',
          'info'
        );
        this.render();
        return;
      }

      // Print Portfolio
      if (e.target.closest('#btn-anec-print-portfolio')) {
        this.printPortfolioSheet();
        return;
      }

      // Go to Classrooms
      if (e.target.closest('#btn-anec-goto-classrooms')) {
        window.dispatchEvent(new CustomEvent('pedagogo:switch-tab', { detail: { tab: 'classrooms' } }));
        return;
      }

      // Delete Entry
      const btnDelete = e.target.closest('.btn-delete-anec');
      if (btnDelete) {
        const id = btnDelete.dataset.entryId;
        if (!id) return;
        const confirmed = await showCalmConfirm({
          title: 'Delete Observation Entry?',
          message: 'Delete this anecdotal case note? This will remove the observation and restorative intervention history.',
          confirmText: 'Delete Note',
          cancelText: 'Keep Note',
          tone: 'danger'
        });
        if (confirmed) {
          this.deleteEntry(id);
          showToast('Observation note removed.', 'info');
          this.render();
        }
        return;
      }
    });

    // Dropdown filters
    this.container.addEventListener('change', (e) => {
      if (e.target.id === 'anec-class-select') {
        this.selectedClassId = e.target.value;
        this.selectedStudentId = 'ALL';
        this.render();
      } else if (e.target.id === 'anec-student-select') {
        this.selectedStudentId = e.target.value;
        this.render();
      } else if (e.target.id === 'anec-tag-select') {
        this.selectedTagFilter = e.target.value;
        this.render();
      }
    });
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
