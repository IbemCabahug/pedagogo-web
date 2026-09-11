/**
 * Pedagogo Desk: Main Web Entry Point
 * Orchestrates Tabs, Today's Rhythm, Spark Quotes, Timetable, and Peer Sync
 */

import { SyncManager } from './sync-manager.js';
import { LessonPlanStudio } from './lesson-plan-studio.js';
import { TimetableView } from './timetable-view.js';
import { ClassManager } from './class-manager.js';

class PedagogoDeskApp {
  constructor() {
    this.sparks = [
      { quote: "Teaching is not the filling of a pail, but the lighting of a fire.", author: "William Butler Yeats" },
      { quote: "The art of teaching is the art of assisting discovery.", author: "Mark Van Doren" },
      { quote: "Children are not vessels to be filled, but lamps to be lit.", author: "Maria Montessori" },
      { quote: "Every student can learn, just not on the same day, or in the same way.", author: "George Evans" },
      { quote: "Take a slow, deep breath before stepping in. Your inner calm becomes your students' sanctuary.", author: "Teacher's Mindful Practice" },
      { quote: "You don't need to be flawless to be a wonderful teacher. Your care, presence, and listening matter most.", author: "Pre-Service Teacher Affirmation" },
      { quote: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
      { quote: "To teach is to touch a life forever.", author: "Pedagogical Wisdom" },
      { quote: "Give yourself grace today. Even the most seasoned educators were once learning how to plan their first lesson.", author: "Gentle Encouragement" }
    ];

    this.currentSparkIndex = Math.floor(Math.random() * this.sparks.length);
    this.scheduleData = this.loadInitialSchedule();

    this.initTheme();
    this.initTabs();
    this.initSpark();
    this.initTodayView();

    this.timetableView = new TimetableView(this.scheduleData);
    this.lessonPlanStudio = new LessonPlanStudio();
    this.classManager = new ClassManager();
    this.syncManager = new SyncManager((newData) => {
      this.onScheduleUpdated(newData);
    });

    this.initClassroomUI();

    const btnQuickSync = document.getElementById('btn-quick-sync-today');
    if (btnQuickSync) {
      btnQuickSync.addEventListener('click', () => {
        this.switchTab('sync');
      });
    }
  }

  loadInitialSchedule() {
    const saved = localStorage.getItem('pedagogo_schedule');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Schedule parse failed, using fallback', e);
      }
    }
    // High quality default schedule representing an education student's week
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      subjects: [
        { id: 1, code: 'ED 204', title: 'Facilitating Learner-Centered Teaching', instructor: 'Prof. Santos', category: 'LECTURE', colorHex: '#3B6347', prepOffsetMinutes: 30 },
        { id: 2, code: 'FS 1', title: 'Field Study: Observation & Learner Diversity', instructor: 'CT Mrs. Elena Cruz', category: 'FIELD_STUDY', colorHex: '#2F6F80', prepOffsetMinutes: 45 },
        { id: 3, code: 'ENG 302', title: 'Teaching Literature (Final Demo Prep)', instructor: 'Dr. Morales', category: 'DEMO_TEACHING', colorHex: '#D4683B', prepOffsetMinutes: 45 },
        { id: 4, code: 'PREP 101', title: 'Instructional Materials & Visual Aids Workshop', instructor: 'Self-Directed Studio', category: 'PREP_TIME', colorHex: '#755B8C', prepOffsetMinutes: 15 }
      ],
      slots: [
        { id: 101, subjectId: 1, dayOfWeek: 1, startHour: 8, startMinute: 30, endHour: 10, endMinute: 30, room: 'Room 304' },
        { id: 102, subjectId: 2, dayOfWeek: 2, startHour: 13, startMinute: 0, endHour: 16, endMinute: 30, room: 'Mabolo Elem Gr. 6' },
        { id: 103, subjectId: 3, dayOfWeek: 3, startHour: 9, startMinute: 0, endHour: 11, endMinute: 0, room: 'College Auditorium' },
        { id: 104, subjectId: 4, dayOfWeek: 4, startHour: 14, startMinute: 0, endHour: 16, endMinute: 0, room: 'Curriculum Resource Lab' },
        { id: 105, subjectId: 1, dayOfWeek: 5, startHour: 10, startMinute: 0, endHour: 12, endMinute: 0, room: 'Room 304' }
      ]
    };
  }

  onScheduleUpdated(newData) {
    this.scheduleData = newData;
    this.initTodayView();
    if (this.timetableView) {
      this.timetableView.updateData(newData);
    }
  }

  initTheme() {
    const toggle = document.getElementById('theme-toggle');
    const isDark = localStorage.getItem('pedagogo_theme') === 'dark';
    if (isDark) document.body.classList.add('dark-mode');

    if (toggle) {
      toggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const active = document.body.classList.contains('dark-mode');
        localStorage.setItem('pedagogo_theme', active ? 'dark' : 'light');
      });
    }
  }

  initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabKey = tab.dataset.tab;
        this.switchTab(tabKey);
      });
    });
  }

  switchTab(tabKey) {
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabKey);
    });
    document.querySelectorAll('.tab-view').forEach(v => {
      v.classList.toggle('active', v.id === `view-${tabKey}`);
    });
  }

  initSpark() {
    const quoteEl = document.getElementById('spark-quote');
    const authorEl = document.getElementById('spark-author');
    const refreshBtn = document.getElementById('btn-refresh-spark');

    const renderSpark = () => {
      const spark = this.sparks[this.currentSparkIndex];
      if (quoteEl) quoteEl.textContent = `“${spark.quote}”`;
      if (authorEl) authorEl.textContent = `— ${spark.author}`;
    };

    renderSpark();

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.currentSparkIndex = (this.currentSparkIndex + 1) % this.sparks.length;
        renderSpark();
      });
    }
  }

  initTodayView() {
    const dateDisplay = document.getElementById('current-date-display');
    const now = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    if (dateDisplay) {
      dateDisplay.textContent = now.toLocaleDateString('en-US', options);
    }

    // Determine current day (1 = Mon ... 7 = Sun)
    let currentDay = now.getDay();
    currentDay = currentDay === 0 ? 7 : currentDay;

    const subjects = this.scheduleData.subjects || [];
    const slots = this.scheduleData.slots || [];

    const subjectMap = new Map();
    subjects.forEach(s => subjectMap.set(s.id, s));

    // Slots for today sorted by time
    const todaySlots = slots
      .filter(s => s.dayOfWeek === currentDay)
      .sort((a, b) => (a.startHour * 60 + a.startMinute) - (b.startHour * 60 + b.startMinute));

    const todayCountBadge = document.getElementById('today-count-badge');
    if (todayCountBadge) {
      todayCountBadge.textContent = `${todaySlots.length} class${todaySlots.length === 1 ? '' : 'es'}`;
    }

    this.renderNextUpHero(todaySlots[0], subjectMap);
    this.renderTodayList(todaySlots, subjectMap);
  }

  renderNextUpHero(nextSlot, subjectMap) {
    const hero = document.getElementById('next-up-card');
    if (!hero) return;

    if (!nextSlot) {
      hero.innerHTML = `
        <div class="hero-header">
          <span class="badge-category badge-LECTURE">REST & RECHARGE</span>
          <span style="font-weight: 700; font-size: 13px;">🌿 All Clear</span>
        </div>
        <div>
          <div class="hero-code" style="font-size: 24px;">All clear for today, Teacher</div>
          <p class="hero-title" style="margin-top: 8px;">No further classes scheduled for today. Enjoy your peaceful study time or rest your voice.</p>
        </div>
        <div class="preflight-chips" style="margin-top: 16px;">
          <span class="preflight-chip checked">✓ Hydrate</span>
          <span class="preflight-chip checked">✓ Rest voice</span>
          <span class="preflight-chip checked">✓ Review tomorrow's lesson</span>
        </div>
      `;
      return;
    }

    const subject = subjectMap.get(nextSlot.subjectId) || {
      code: 'Subject',
      title: 'Course Title',
      category: 'LECTURE',
      prepOffsetMinutes: 30
    };

    const startTime = `${String(nextSlot.startHour).padStart(2, '0')}:${String(nextSlot.startMinute).padStart(2, '0')}`;
    const endTime = `${String(nextSlot.endHour).padStart(2, '0')}:${String(nextSlot.endMinute).padStart(2, '0')}`;

    hero.innerHTML = `
      <div>
        <div class="hero-header">
          <span class="badge-category badge-${subject.category}">${this.formatCategoryName(subject.category)}</span>
          <span style="font-weight: 700; font-size: 13px;">⏰ -${subject.prepOffsetMinutes || 30}m prep buffer</span>
        </div>
        <div class="hero-code">${subject.code}</div>
        <div class="hero-title">${subject.title}</div>
      </div>

      <div class="hero-details">
        <span>⏰ ${startTime} – ${endTime}</span>
        <span>📍 ${nextSlot.room || 'TBA'}</span>
      </div>

      <div>
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; opacity: 0.85;">
          Pre-Class Confidence Checklist:
        </div>
        <div class="preflight-chips">
          <span class="preflight-chip" onclick="this.classList.toggle('checked')">Lesson Plan</span>
          <span class="preflight-chip" onclick="this.classList.toggle('checked')">Visual Aids / IMs</span>
          <span class="preflight-chip" onclick="this.classList.toggle('checked')">Markers & Chalk</span>
        </div>
      </div>
    `;
  }

  renderTodayList(todaySlots, subjectMap) {
    const list = document.getElementById('today-class-list');
    if (!list) return;

    if (todaySlots.length === 0) {
      list.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13.5px;">
          🌿 No classes scheduled today. Head to Weekly Grid to preview the rest of your week.
        </div>
      `;
      return;
    }

    list.innerHTML = '';
    todaySlots.forEach(slot => {
      const subject = subjectMap.get(slot.subjectId) || {
        code: 'Course',
        title: 'Class',
        category: 'LECTURE'
      };

      const startTime = `${String(slot.startHour).padStart(2, '0')}:${String(slot.startMinute).padStart(2, '0')}`;
      const endTime = `${String(slot.endHour).padStart(2, '0')}:${String(slot.endMinute).padStart(2, '0')}`;

      const row = document.createElement('div');
      row.className = 'class-item-row';
      row.innerHTML = `
        <div class="class-meta">
          <span class="badge-category badge-${subject.category}" style="margin-bottom: 4px;">${this.formatCategoryName(subject.category)}</span>
          <h4>${subject.code} — ${subject.title}</h4>
          <p>📍 ${slot.room || 'TBA'}</p>
        </div>
        <div class="class-time-block">
          <div class="time-main">${startTime}</div>
          <div class="time-sub">to ${endTime}</div>
        </div>
      `;
      list.appendChild(row);
    });
  }

  formatCategoryName(cat) {
    switch (cat) {
      case 'FIELD_STUDY': return 'Field Study';
      case 'DEMO_TEACHING': return 'Demo Teaching';
      case 'PREP_TIME': return 'Lesson Prep';
      default: return 'Lecture';
    }
  }

  // =========================================================
  // Classroom & Learner Management Orchestration
  // =========================================================

  initClassroomUI() {
    // 1. Modals Backdrop click & Close buttons
    const setupModalClose = (modalId, closeBtnId, cancelBtnId) => {
      const modal = document.getElementById(modalId);
      const closeBtn = document.getElementById(closeBtnId);
      const cancelBtn = document.getElementById(cancelBtnId);
      const close = () => { if (modal) modal.style.display = 'none'; };
      if (closeBtn) closeBtn.addEventListener('click', close);
      if (cancelBtn) cancelBtn.addEventListener('click', close);
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) close();
        });
      }
    };

    setupModalClose('modal-classroom', 'btn-close-classroom-modal', 'btn-cancel-classroom-modal');
    setupModalClose('modal-student', 'btn-close-student-modal', 'btn-cancel-student-modal');
    setupModalClose('modal-bulk-roster', 'btn-close-bulk-modal', 'btn-cancel-bulk-modal');

    // 2. Open Modal Triggers
    const btnCreateClass = document.getElementById('btn-create-class-modal');
    if (btnCreateClass) {
      btnCreateClass.addEventListener('click', () => this.openClassroomModal());
    }

    const btnEditClass = document.getElementById('btn-edit-active-class');
    if (btnEditClass) {
      btnEditClass.addEventListener('click', () => {
        const activeClass = this.classManager.getClassroom(this.classManager.selectedClassId);
        if (activeClass) this.openClassroomModal(activeClass);
      });
    }

    const btnDeleteClass = document.getElementById('btn-delete-active-class');
    if (btnDeleteClass) {
      btnDeleteClass.addEventListener('click', () => {
        const activeClass = this.classManager.getClassroom(this.classManager.selectedClassId);
        if (!activeClass) return;
        if (confirm(`Are you sure you want to remove ${activeClass.subjectCode} - ${activeClass.sectionName}? All student enrollments in this section will be removed.`)) {
          this.classManager.deleteClassroom(activeClass.id);
          this.renderClassroomView();
        }
      });
    }

    const btnAddStudent = document.getElementById('btn-add-student-modal');
    const btnEmptyAddStudent = document.getElementById('btn-empty-add-student');
    [btnAddStudent, btnEmptyAddStudent].forEach(btn => {
      if (btn) btn.addEventListener('click', () => this.openStudentModal());
    });

    const btnBulkModal = document.getElementById('btn-bulk-import-modal');
    const btnEmptyBulk = document.getElementById('btn-empty-bulk-import');
    [btnBulkModal, btnEmptyBulk].forEach(btn => {
      if (btn) btn.addEventListener('click', () => this.openBulkModal());
    });

    // 3. Form Submissions
    const formClassroom = document.getElementById('form-classroom');
    if (formClassroom) {
      formClassroom.addEventListener('submit', (e) => {
        e.preventDefault();
        const classId = document.getElementById('input-class-id').value;
        const colorRadio = document.querySelector('input[name="class-color"]:checked');
        const data = {
          subjectCode: document.getElementById('input-class-code').value,
          subjectTitle: document.getElementById('input-class-title').value,
          sectionName: document.getElementById('input-class-section').value,
          gradeLevel: document.getElementById('input-class-grade').value,
          schoolYear: document.getElementById('input-class-sy').value,
          term: document.getElementById('input-class-term').value,
          schoolName: document.getElementById('input-class-school').value,
          room: document.getElementById('input-class-room').value,
          colorHex: colorRadio ? colorRadio.value : '#3B6347'
        };

        if (classId) {
          this.classManager.updateClassroom(classId, data);
        } else {
          this.classManager.addClassroom(data);
        }

        document.getElementById('modal-classroom').style.display = 'none';
        this.renderClassroomView();
      });
    }

    const formStudent = document.getElementById('form-student');
    if (formStudent) {
      formStudent.addEventListener('submit', (e) => {
        e.preventDefault();
        const studentId = document.getElementById('input-student-id').value;
        const data = {
          lastName: document.getElementById('input-student-lastname').value,
          firstName: document.getElementById('input-student-firstname').value,
          middleInitial: document.getElementById('input-student-mi').value,
          gender: document.getElementById('input-student-gender').value,
          lrn: document.getElementById('input-student-lrn').value,
          biometricId: document.getElementById('input-student-biometric').value,
          rfidTag: document.getElementById('input-student-rfid').value,
          pedagogicalNotes: document.getElementById('input-student-notes').value
        };

        if (studentId) {
          this.classManager.updateStudent(studentId, data);
        } else {
          if (this.classManager.selectedClassId) {
            this.classManager.addStudentToClass(this.classManager.selectedClassId, data);
          }
        }

        document.getElementById('modal-student').style.display = 'none';
        this.renderActiveSection();
      });
    }

    // 4. Bulk Import Logic
    const textareaBulk = document.getElementById('textarea-bulk-roster');
    const bulkParsedCount = document.getElementById('bulk-parsed-count');
    const bulkGenderSelect = document.getElementById('bulk-default-gender');
    const btnLoadSample = document.getElementById('btn-load-bulk-sample');
    const btnConfirmBulk = document.getElementById('btn-confirm-bulk-import');

    const updateBulkPreview = () => {
      if (!textareaBulk || !bulkParsedCount) return;
      const text = textareaBulk.value;
      const defGender = bulkGenderSelect ? bulkGenderSelect.value : 'Male';
      const parsed = this.classManager.parseBulkRosterText(text, defGender);
      const boys = parsed.filter(s => s.gender === 'Male').length;
      const girls = parsed.filter(s => s.gender === 'Female').length;
      bulkParsedCount.textContent = `${parsed.length} learners detected (${boys} 👦 Boys, ${girls} 👧 Girls)`;
      return parsed;
    };

    if (textareaBulk) {
      textareaBulk.addEventListener('input', updateBulkPreview);
    }
    if (bulkGenderSelect) {
      bulkGenderSelect.addEventListener('change', updateBulkPreview);
    }

    if (btnLoadSample && textareaBulk) {
      btnLoadSample.addEventListener('click', () => {
        textareaBulk.value = `MALE
1. Alcantara, Kenneth R. (Visual Learner)
2. Bernardo, Gabriel M. [Front Row]
3. Dimaculangan, Paul Vincent S. (Auditory)
4. Gutierrez, Angelo D.
5. Macaraeg, John Michael P. (Needs Recitation Encouragement)

FEMALE
1. Almeda, Stephanie Anne B. (Peer Tutor)
2. Bonifacio, Katrina Mae T. [Active Listener]
3. Crisostomo, Danica Rose L.
4. Evangelista, Maria Clara C. (Creative Graphic Organizers)
5. Mendoza, Nicole Shane F.`;
        updateBulkPreview();
      });
    }

    if (btnConfirmBulk) {
      btnConfirmBulk.addEventListener('click', () => {
        const parsed = updateBulkPreview();
        if (!parsed || parsed.length === 0) {
          alert('Please paste or enter at least one student name.');
          return;
        }
        if (!this.classManager.selectedClassId) {
          alert('Please create or select an active class first.');
          return;
        }

        this.classManager.importBulkStudents(this.classManager.selectedClassId, parsed);
        document.getElementById('modal-bulk-roster').style.display = 'none';
        this.renderActiveSection();
      });
    }

    // 5. DepEd SF1 Toggle
    const btnToggleSf1 = document.getElementById('btn-toggle-sf1');
    const sf1Label = document.getElementById('sf1-status-label');
    if (btnToggleSf1 && sf1Label) {
      btnToggleSf1.addEventListener('click', () => {
        this.classManager.sf1SortActive = !this.classManager.sf1SortActive;
        sf1Label.textContent = this.classManager.sf1SortActive ? 'Active (Boys First)' : 'Alphabetical (All)';
        btnToggleSf1.classList.toggle('active-toggle', this.classManager.sf1SortActive);
        this.renderActiveSection();
      });
    }

    // 6. Printable Clipboard Sheet
    const btnPrintRoster = document.getElementById('btn-print-clipboard-roster');
    if (btnPrintRoster) {
      btnPrintRoster.addEventListener('click', () => {
        this.printClipboardSheet();
      });
    }

    // Render initial state
    this.renderClassroomView();
  }

  renderClassroomView() {
    this.renderClassCards();
    this.renderActiveSection();
  }

  renderClassCards() {
    const container = document.getElementById('class-cards-container');
    if (!container) return;

    const classes = this.classManager.getAllClassrooms();
    if (classes.length === 0) {
      container.innerHTML = `<div class="empty-state-text" style="padding: 12px; color: var(--text-muted);">No sections created yet. Click "+ Create New Class" above.</div>`;
      return;
    }

    container.innerHTML = '';
    classes.forEach(c => {
      const isSelected = c.id === this.classManager.selectedClassId;
      const enrolled = this.classManager.getEnrolledStudents(c.id, false);
      const studentCount = enrolled.all.length;

      const card = document.createElement('div');
      card.className = `class-card ${isSelected ? 'active' : ''}`;
      card.innerHTML = `
        <div class="class-card-top">
          <span class="class-code-badge" style="background: ${c.colorHex || '#3B6347'};">${c.subjectCode}</span>
          <span class="class-card-grade">${c.gradeLevel || c.term}</span>
        </div>
        <div class="class-card-section">${c.sectionName}</div>
        <div class="class-card-title" title="${c.subjectTitle}">${c.subjectTitle}</div>
        <div class="class-card-bottom">
          <span class="class-card-count">👥 ${studentCount} Learners</span>
          <span>🚪 ${c.room || 'Room TBA'}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        this.classManager.selectedClassId = c.id;
        this.renderClassroomView();
      });

      container.appendChild(card);
    });
  }

  renderActiveSection() {
    const activeClass = this.classManager.getClassroom(this.classManager.selectedClassId);
    const hub = document.getElementById('classroom-detail-hub');
    if (!activeClass) {
      if (hub) hub.style.display = 'none';
      return;
    }
    if (hub) hub.style.display = 'flex';

    // Populate Hero Banner
    const stripe = document.getElementById('class-hero-stripe');
    const codePill = document.getElementById('class-hero-code');
    const secPill = document.getElementById('class-hero-section');
    const gradePill = document.getElementById('class-hero-grade');
    const titleEl = document.getElementById('class-hero-title');
    const schoolEl = document.getElementById('class-hero-school');
    const roomEl = document.getElementById('class-hero-room');
    const termEl = document.getElementById('class-hero-term');

    if (stripe) stripe.style.background = activeClass.colorHex || '#3B6347';
    if (codePill) {
      codePill.textContent = activeClass.subjectCode;
      codePill.style.background = activeClass.colorHex || '#3B6347';
    }
    if (secPill) secPill.textContent = activeClass.sectionName;
    if (gradePill) gradePill.textContent = activeClass.gradeLevel || 'Section Cohort';
    if (titleEl) titleEl.textContent = activeClass.subjectTitle;
    if (schoolEl) schoolEl.textContent = activeClass.schoolName || 'Cooperating School';
    if (roomEl) roomEl.textContent = activeClass.room || 'Room TBA';
    if (termEl) termEl.textContent = `${activeClass.schoolYear || ''} • ${activeClass.term || ''}`;

    // Get Enrolled Students
    const enrolled = this.classManager.getEnrolledStudents(activeClass.id, this.classManager.sf1SortActive);

    // Update Stats
    const totalEl = document.getElementById('stat-total-learners');
    const maleEl = document.getElementById('stat-male-learners');
    const femaleEl = document.getElementById('stat-female-learners');
    if (totalEl) totalEl.textContent = enrolled.all.length;
    if (maleEl) maleEl.textContent = enrolled.males.length;
    if (femaleEl) femaleEl.textContent = enrolled.females.length;

    // Populate Roster Table
    const tbody = document.getElementById('roster-table-body');
    const tableEl = document.getElementById('roster-table');
    const emptyEl = document.getElementById('empty-roster-state');

    if (enrolled.all.length === 0) {
      if (tableEl) tableEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (tableEl) tableEl.style.display = 'table';
    if (emptyEl) emptyEl.style.display = 'none';

    if (tbody) {
      tbody.innerHTML = '';
      enrolled.all.forEach((st, idx) => {
        const tr = document.createElement('tr');
        const mi = st.middleInitial ? ` ${st.middleInitial}` : '';
        const fullName = `${st.lastName}, ${st.firstName}${mi}`;
        const isMale = st.gender === 'Male';

        // Tags parsing
        let notesHtml = '';
        if (st.pedagogicalNotes) {
          const tags = st.pedagogicalNotes.split(/[•,;|]+/).map(t => t.trim()).filter(Boolean);
          notesHtml = tags.map(t => `<span class="learner-tag-chip">🌱 ${t}</span>`).join(' ');
        } else {
          notesHtml = `<span style="color: var(--text-muted); font-size: 12px; font-style: italic;">No specific accommodation notes</span>`;
        }

        tr.innerHTML = `
          <td style="font-weight: 700; color: var(--text-muted);">${idx + 1}</td>
          <td>
            <div class="student-name-cell">
              <span>${isMale ? '👦' : '👧'}</span>
              <span>${fullName}</span>
            </div>
          </td>
          <td>
            <span class="gender-pill ${isMale ? 'male' : 'female'}">${st.gender}</span>
          </td>
          <td>
            <span class="lrn-text">${st.lrn || '<span style="opacity:0.4;">—</span>'}</span>
          </td>
          <td>
            <div class="learner-tags-wrapper">
              ${notesHtml}
            </div>
          </td>
          <td style="text-align: center;">
            <button class="btn-table-action btn-edit-student" title="Edit Student">✏️</button>
            <button class="btn-table-action btn-remove-student text-danger" title="Remove from section">❌</button>
          </td>
        `;

        // Action Handlers
        const editBtn = tr.querySelector('.btn-edit-student');
        if (editBtn) {
          editBtn.addEventListener('click', () => {
            this.openStudentModal(st);
          });
        }

        const removeBtn = tr.querySelector('.btn-remove-student');
        if (removeBtn) {
          removeBtn.addEventListener('click', () => {
            if (confirm(`Remove ${fullName} from ${activeClass.sectionName}?`)) {
              this.classManager.removeStudentFromClass(activeClass.id, st.id);
              this.renderActiveSection();
              this.renderClassCards();
            }
          });
        }

        tbody.appendChild(tr);
      });
    }
  }

  openClassroomModal(classToEdit = null) {
    const modal = document.getElementById('modal-classroom');
    const titleEl = document.getElementById('modal-classroom-title');
    if (!modal) return;

    document.getElementById('input-class-id').value = classToEdit ? classToEdit.id : '';
    document.getElementById('input-class-code').value = classToEdit ? classToEdit.subjectCode : '';
    document.getElementById('input-class-title').value = classToEdit ? classToEdit.subjectTitle : '';
    document.getElementById('input-class-section').value = classToEdit ? classToEdit.sectionName : '';
    document.getElementById('input-class-grade').value = classToEdit ? (classToEdit.gradeLevel || '') : '';
    document.getElementById('input-class-sy').value = classToEdit ? (classToEdit.schoolYear || '2026–2027') : '2026–2027';
    document.getElementById('input-class-term').value = classToEdit ? (classToEdit.term || '1st Semester') : '1st Semester';
    document.getElementById('input-class-school').value = classToEdit ? (classToEdit.schoolName || '') : '';
    document.getElementById('input-class-room').value = classToEdit ? (classToEdit.room || '') : '';

    const color = classToEdit ? classToEdit.colorHex : '#3B6347';
    const radio = modal.querySelector(`input[name="class-color"][value="${color}"]`);
    if (radio) radio.checked = true;

    if (titleEl) {
      titleEl.textContent = classToEdit ? `Edit Section: ${classToEdit.sectionName}` : 'Create Teaching Section';
    }

    modal.style.display = 'flex';
  }

  openStudentModal(studentToEdit = null) {
    const modal = document.getElementById('modal-student');
    const titleEl = document.getElementById('modal-student-title');
    if (!modal) return;

    document.getElementById('input-student-id').value = studentToEdit ? studentToEdit.id : '';
    document.getElementById('input-student-lastname').value = studentToEdit ? studentToEdit.lastName : '';
    document.getElementById('input-student-firstname').value = studentToEdit ? studentToEdit.firstName : '';
    document.getElementById('input-student-mi').value = studentToEdit ? (studentToEdit.middleInitial || '') : '';
    document.getElementById('input-student-gender').value = studentToEdit ? studentToEdit.gender : 'Male';
    document.getElementById('input-student-lrn').value = studentToEdit ? (studentToEdit.lrn || '') : '';
    document.getElementById('input-student-biometric').value = studentToEdit ? (studentToEdit.biometricId || '') : '';
    document.getElementById('input-student-rfid').value = studentToEdit ? (studentToEdit.rfidTag || '') : '';
    document.getElementById('input-student-notes').value = studentToEdit ? (studentToEdit.pedagogicalNotes || '') : '';

    if (titleEl) {
      titleEl.textContent = studentToEdit ? `Edit Profile: ${studentToEdit.lastName}, ${studentToEdit.firstName}` : 'Add Learner to Class';
    }

    modal.style.display = 'flex';
  }

  openBulkModal() {
    const modal = document.getElementById('modal-bulk-roster');
    if (!modal) return;
    const textarea = document.getElementById('textarea-bulk-roster');
    const counter = document.getElementById('bulk-parsed-count');
    if (textarea) textarea.value = '';
    if (counter) counter.textContent = '0 learners ready to import';
    modal.style.display = 'flex';
  }

  printClipboardSheet() {
    const activeClass = this.classManager.getClassroom(this.classManager.selectedClassId);
    if (!activeClass) {
      alert('Please select an active class first to print clipboard sheet.');
      return;
    }

    const enrolled = this.classManager.getEnrolledStudents(activeClass.id, this.classManager.sf1SortActive);

    // Populate Print Headers
    document.getElementById('print-subj-text').textContent = `${activeClass.subjectCode} — ${activeClass.subjectTitle}`;
    document.getElementById('print-sec-text').textContent = `${activeClass.sectionName} (${activeClass.gradeLevel || 'N/A'})`;
    document.getElementById('print-sy-text').textContent = `${activeClass.schoolYear || '2026–2027'} • ${activeClass.term || '1st Sem'}`;
    document.getElementById('print-room-text').textContent = `${activeClass.schoolName || 'Cooperating School'} • ${activeClass.room || 'Room TBA'}`;

    // Populate Print Table Rows
    const tbody = document.getElementById('print-roster-tbody');
    if (tbody) {
      tbody.innerHTML = '';
      enrolled.all.forEach((st, idx) => {
        const tr = document.createElement('tr');
        const mi = st.middleInitial ? ` ${st.middleInitial}` : '';
        tr.innerHTML = `
          <td style="text-align: center;">${idx + 1}</td>
          <td><strong>${st.lastName}</strong>, ${st.firstName}${mi}</td>
          <td style="text-align: center;">${st.gender === 'Male' ? 'M' : 'F'}</td>
          <td style="text-align: center; font-family: monospace;">${st.lrn || '-'}</td>
          <td></td><td></td><td></td><td></td><td></td>
          <td></td><td></td><td></td><td></td><td></td>
          <td style="font-size: 9px; color: #444;">${st.pedagogicalNotes ? st.pedagogicalNotes.substring(0, 24) : ''}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Trigger Browser Print Dialog
    window.print();
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.pedagogoApp = new PedagogoDeskApp();
});
