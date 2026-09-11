/**
 * Pedagogo Desk: Main Web Entry Point
 * Orchestrates Tabs, Today's Rhythm, Spark Quotes, Timetable, and Peer Sync
 */

import { SyncManager } from './sync-manager.js';
import { LessonPlanStudio } from './lesson-plan-studio.js';
import { TimetableView } from './timetable-view.js';
import { ClassManager } from './class-manager.js';
import { TaskStudio } from './task-studio.js';
import { DocumentDesk } from './document-desk.js';
import { ReviewerStudio } from './reviewer-studio.js';
import { FieldStudyNotebook } from './field-study-notebook.js';
import { AttendanceTracker } from './attendance-tracker.js';
import { showToast } from './toast.js';

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
    this.initPerspective();
    this.initSpark();
    this.initTodayView();

    this.timetableView = new TimetableView(this.scheduleData);
    this.lessonPlanStudio = new LessonPlanStudio();
    this.classManager = new ClassManager();
    this.attendanceTracker = new AttendanceTracker(this.classManager);
    this.taskStudio = new TaskStudio();
    this.documentDesk = new DocumentDesk();
    this.reviewerStudio = new ReviewerStudio();
    this.fieldStudyNotebook = new FieldStudyNotebook();
    this.syncManager = new SyncManager((newData) => {
      this.onScheduleUpdated(newData);
    });

    // Cross-link: import questions from Reading Desk into Reviewer Studio
    window.addEventListener('pedagogo:save-questions-to-reviewer', (e) => {
      if (this.reviewerStudio && e.detail) {
        this.reviewerStudio.importQuestionsFromReadingDesk(e.detail.questions, e.detail.title);
      }
    });

    // Full Desk Data Restored Listener (from Unified Backup Hub)
    window.addEventListener('pedagogo:data-restored', () => {
      this.handleGlobalDataRestored();
    });

    this.initClassroomUI();
    this.initTaskStudioUI();

    const btnQuickSync = document.getElementById('btn-quick-sync-today');
    if (btnQuickSync) {
      btnQuickSync.addEventListener('click', () => {
        this.switchTab('sync');
      });
    }
  }

  handleGlobalDataRestored() {
    // 1. Reload schedule & Today's Rhythm
    this.scheduleData = this.loadInitialSchedule();
    this.initTodayView();
    if (this.timetableView) {
      this.timetableView.updateData(this.scheduleData);
    }

    // 2. Reload Tasks & IMs
    if (this.taskStudio) {
      this.taskStudio.tasks = this.taskStudio.loadTasks();
      this.renderTasksList();
      this.updateTodayTaskWidget();
    }

    // 3. Reload Classrooms & Student Rosters
    if (this.classManager) {
      this.classManager.classes = this.classManager.load(this.classManager.storageKeys.classes, []);
      this.classManager.students = this.classManager.load(this.classManager.storageKeys.students, []);
      this.classManager.enrollments = this.classManager.load(this.classManager.storageKeys.enrollments, []);
      this.classManager.selectedClassId = this.classManager.classes.length > 0 ? this.classManager.classes[0].id : null;
      this.renderClassroomView();
    }

    // 3b. Reload Attendance Tracker (SF2 roll calls)
    if (this.attendanceTracker) {
      this.attendanceTracker.store = this.attendanceTracker.loadStore();
      this.attendanceTracker.selectedClassId = this.classManager?.selectedClassId || this.attendanceTracker.selectedClassId;
      this.attendanceTracker.activeSessionId = this.attendanceTracker.getSessionsForClass(this.attendanceTracker.selectedClassId)[0]?.id || null;
      if (this.attendanceTracker.container) {
        this.attendanceTracker.render();
      }
    }

    // 4. Reload Reviewer Studio
    if (this.reviewerStudio) {
      this.reviewerStudio.cards = this.reviewerStudio.loadCards();
      this.reviewerStudio.render();
    }

    // 5. Reload Field Study Notebook
    if (this.fieldStudyNotebook) {
      this.fieldStudyNotebook.entries = this.fieldStudyNotebook.loadEntries();
      this.fieldStudyNotebook.render();
    }

    // 6. Reload Lesson Plan Studio
    if (this.lessonPlanStudio) {
      this.lessonPlanStudio.restoreSavedPlan();
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

    // Refresh attendance view so it follows the latest roster/section selection
    if (tabKey === 'attendance' && this.attendanceTracker) {
      this.attendanceTracker.selectedClassId = this.classManager?.selectedClassId || this.attendanceTracker.selectedClassId;
      if (this.attendanceTracker.container) {
        this.attendanceTracker.render();
      }
    }
  }

  initPerspective() {
    const savedPerspective = localStorage.getItem('pedagogo_perspective') || 'STUDENT';
    this.setPerspective(savedPerspective, false);

    const pillStudent = document.getElementById('pill-student');
    const pillEducator = document.getElementById('pill-educator');

    if (pillStudent) {
      pillStudent.addEventListener('click', () => this.setPerspective('STUDENT'));
    }
    if (pillEducator) {
      pillEducator.addEventListener('click', () => this.setPerspective('EDUCATOR'));
    }
  }

  setPerspective(perspective, autoSwitchTab = true) {
    this.currentPerspective = perspective;
    localStorage.setItem('pedagogo_perspective', perspective);

    const isStudent = perspective === 'STUDENT';
    document.body.classList.toggle('perspective-student', isStudent);
    document.body.classList.toggle('perspective-educator', !isStudent);

    const pillStudent = document.getElementById('pill-student');
    const pillEducator = document.getElementById('pill-educator');
    if (pillStudent) {
      pillStudent.classList.toggle('active', isStudent);
      pillStudent.setAttribute('aria-selected', isStudent ? 'true' : 'false');
    }
    if (pillEducator) {
      pillEducator.classList.toggle('active', !isStudent);
      pillEducator.setAttribute('aria-selected', !isStudent ? 'true' : 'false');
    }

    // Dynamic brand badge update
    const brandBadge = document.querySelector('.brand-badge');
    if (brandBadge) {
      brandBadge.textContent = isStudent ? '🎓 Student Sanctuary' : '🌿 Practicum Cockpit';
    }

    // Check if current tab is hidden in newly chosen perspective
    if (autoSwitchTab) {
      const activeTab = document.querySelector('.nav-tab.active');
      const activePerspective = activeTab ? activeTab.dataset.perspective : 'ALL';
      if (activePerspective !== 'ALL' && activePerspective !== perspective) {
        const defaultTab = isStudent ? 'today' : 'classrooms';
        this.switchTab(defaultTab);
      }
    }
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
          showToast('Please paste or enter at least one student name.', 'warning');
          return;
        }
        if (!this.classManager.selectedClassId) {
          showToast('Please create or select an active class first.', 'warning');
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
      showToast('Please select an active class first to print clipboard sheet.', 'warning');
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

  // =========================================================
  // Academic Tasks & IMs Studio Orchestration
  // =========================================================

  initTaskStudioUI() {
    // 1. Filter buttons
    const filterBtns = document.querySelectorAll('.task-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.taskStudio.activeFilter = btn.dataset.filter;
        this.renderTasksList();
      });
    });

    // 2. Modals setup (Task modal & Breathing modal)
    const setupModal = (modalId, closeBtnId, cancelBtnId) => {
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

    setupModal('modal-task', 'btn-close-task-modal', 'btn-cancel-task-modal');
    setupModal('modal-breathing', 'btn-close-breathing', 'btn-finish-breathing');

    // Open Task Modal
    const btnCreateTask = document.getElementById('btn-create-task-modal');
    const btnEmptyCreate = document.getElementById('btn-empty-create-task');
    [btnCreateTask, btnEmptyCreate].forEach(btn => {
      if (btn) btn.addEventListener('click', () => this.openTaskModal());
    });

    // Save Task Form
    const formTask = document.getElementById('form-task');
    if (formTask) {
      formTask.addEventListener('submit', (e) => {
        e.preventDefault();
        const taskId = document.getElementById('input-task-id').value;
        const data = {
          title: document.getElementById('input-task-title').value,
          subjectCode: document.getElementById('input-task-subject').value,
          category: document.getElementById('input-task-category').value,
          dueDate: document.getElementById('input-task-due').value,
          estimatedMinutes: document.getElementById('input-task-minutes').value,
          materials: document.getElementById('input-task-materials').value,
          notes: document.getElementById('input-task-notes').value
        };

        if (taskId) {
          this.taskStudio.updateTask(taskId, data);
        } else {
          this.taskStudio.addTask(data);
        }

        document.getElementById('modal-task').style.display = 'none';
        this.renderTasksList();
      });
    }

    // 3. Timer Mode Buttons (Focus vs Rest)
    const btnModeFocus = document.getElementById('btn-mode-focus');
    const btnModeBreak = document.getElementById('btn-mode-break');
    if (btnModeFocus && btnModeBreak) {
      btnModeFocus.addEventListener('click', () => {
        btnModeFocus.classList.add('active');
        btnModeBreak.classList.remove('active');
        this.taskStudio.setTimerMode('FOCUS');
        this.updateTimerDisplay();
      });
      btnModeBreak.addEventListener('click', () => {
        btnModeBreak.classList.add('active');
        btnModeFocus.classList.remove('active');
        this.taskStudio.setTimerMode('BREAK');
        this.updateTimerDisplay();
      });
    }

    // 4. Timer Controls (Start/Pause, Reset)
    const btnTimerToggle = document.getElementById('btn-timer-toggle');
    const btnTimerReset = document.getElementById('btn-timer-reset');

    if (btnTimerToggle) {
      btnTimerToggle.addEventListener('click', () => {
        if (this.taskStudio.isTimerRunning) {
          this.taskStudio.pauseTimer();
          this.updateTimerControlsState(false);
        } else {
          this.taskStudio.startTimer(
            () => {
              this.updateTimerDisplay();
            },
            (completedMode) => {
              this.updateTimerControlsState(false);
              const isFocus = completedMode === 'FOCUS';
              showToast(isFocus ? 'Splendid work! Your 25-minute study block is complete. Stretch and take a restorative breath.' : 'Rest break complete! Ready to nurture your next task?', 'celebrate', 6000);
              if (isFocus && btnModeBreak) {
                btnModeBreak.click();
              } else if (btnModeFocus) {
                btnModeFocus.click();
              }
            }
          );
          this.updateTimerControlsState(true);
        }
      });
    }

    if (btnTimerReset) {
      btnTimerReset.addEventListener('click', () => {
        this.taskStudio.resetTimer();
        this.updateTimerControlsState(false);
        this.updateTimerDisplay();
      });
    }

    // 5. Ambient Sound Controls
    const ambientBtns = document.querySelectorAll('.btn-ambient');
    const ambientBadge = document.getElementById('ambient-active-badge');
    ambientBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.ambient;
        const active = this.taskStudio.toggleAmbient(mode);

        ambientBtns.forEach(b => b.classList.toggle('active', b.dataset.ambient === active));
        if (ambientBadge) {
          ambientBadge.textContent = active === 'OFF' ? 'Off' : active;
        }
      });
    });

    // 6. 1-Minute Centering Breath Guide
    const btnBreathing = document.getElementById('btn-start-breathing');
    if (btnBreathing) {
      btnBreathing.addEventListener('click', () => {
        this.startBreathingGuide();
      });
    }

    // 7. Zen Fullscreen Focus Mode
    const btnZen = document.getElementById('btn-zen-fullscreen');
    if (btnZen) {
      btnZen.addEventListener('click', () => this.enterZenMode());
    }

    const btnZenExit = document.getElementById('btn-zen-exit');
    if (btnZenExit) {
      btnZenExit.addEventListener('click', () => this.exitZenMode());
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('zen-fullscreen-overlay')?.style.display !== 'none') {
        this.exitZenMode();
      }
    });

    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && document.getElementById('zen-fullscreen-overlay')?.style.display !== 'none') {
        this.exitZenMode();
      }
    });

    // Zen Timer Mirror Controls
    const btnZenToggle = document.getElementById('btn-zen-timer-toggle');
    if (btnZenToggle) {
      btnZenToggle.addEventListener('click', () => {
        document.getElementById('btn-timer-toggle')?.click();
      });
    }

    const btnZenReset = document.getElementById('btn-zen-timer-reset');
    if (btnZenReset) {
      btnZenReset.addEventListener('click', () => {
        document.getElementById('btn-timer-reset')?.click();
      });
    }

    // Zen Ambient Sound Buttons
    const zenAmbientBtns = document.querySelectorAll('.zen-ambient-btn');
    zenAmbientBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.ambient;
        const active = this.taskStudio.toggleAmbient(mode);

        document.querySelectorAll('.btn-ambient, .zen-ambient-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.ambient === active);
        });
        const ambientBadge = document.getElementById('ambient-active-badge');
        if (ambientBadge) {
          ambientBadge.textContent = active === 'OFF' ? 'Off' : active;
        }
      });
    });

    // Initial render
    this.renderTasksList();
    this.updateTimerDisplay();
  }

  enterZenMode() {
    const overlay = document.getElementById('zen-fullscreen-overlay');
    const zenTitle = document.getElementById('zen-task-title');
    if (!overlay) return;

    const allTasks = this.taskStudio.getAllTasks();
    const focusTask = allTasks.find(t => t.id === this.taskStudio.selectedTaskIdForFocus) || allTasks.find(t => !t.completed);
    if (zenTitle) {
      zenTitle.textContent = focusTask ? `${focusTask.subjectCode} — ${focusTask.title}` : 'General Study & Reflection';
    }

    overlay.style.display = 'flex';
    this.updateTimerDisplay();
    this.updateTimerControlsState(this.taskStudio.isTimerRunning);

    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {
      // Browser full screen fallback
    }
  }

  exitZenMode() {
    const overlay = document.getElementById('zen-fullscreen-overlay');
    if (overlay) overlay.style.display = 'none';

    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) {
      // Browser exit fullscreen fallback
    }
  }

  updateTimerControlsState(running) {
    const icon = document.getElementById('timer-toggle-icon');
    const label = document.getElementById('timer-toggle-label');
    const status = document.getElementById('timer-status-text');

    const zenIcon = document.getElementById('zen-timer-toggle-icon');
    const zenLabel = document.getElementById('zen-timer-toggle-label');
    const zenStatus = document.getElementById('zen-timer-status');

    if (icon) icon.textContent = running ? '⏸️' : '▶️';
    if (label) label.textContent = running ? 'Pause' : (this.taskStudio.timerRemaining < this.taskStudio.timerDuration ? 'Resume' : 'Start Session');
    if (status) status.textContent = running ? (this.taskStudio.timerMode === 'FOCUS' ? 'Deep Study Flow' : 'Restorative Pause') : 'Paused';

    if (zenIcon) zenIcon.textContent = running ? '⏸️' : '▶️';
    if (zenLabel) zenLabel.textContent = running ? 'Pause' : (this.taskStudio.timerRemaining < this.taskStudio.timerDuration ? 'Resume' : 'Start Session');
    if (zenStatus) zenStatus.textContent = running ? (this.taskStudio.timerMode === 'FOCUS' ? 'Deep Study Flow' : 'Restorative Pause') : 'Paused';
  }

  updateTimerDisplay() {
    const display = document.getElementById('timer-display');
    const circle = document.getElementById('timer-progress-circle');
    const zenDigits = document.getElementById('zen-timer-digits');
    const zenCircle = document.getElementById('zen-timer-progress');

    const formatted = this.taskStudio.formatTime(this.taskStudio.timerRemaining);
    if (display) display.textContent = formatted;
    if (zenDigits) zenDigits.textContent = formatted;

    const percent = this.taskStudio.timerRemaining / this.taskStudio.timerDuration;

    if (circle) {
      const circumference = 2 * Math.PI * 70; // 439.82
      const offset = circumference * (1 - percent);
      circle.style.strokeDashoffset = offset;
    }

    if (zenCircle) {
      const zenCircumference = 2 * Math.PI * 105; // 659.73
      const zenOffset = zenCircumference * (1 - percent);
      zenCircle.style.strokeDashoffset = zenOffset;
    }
  }

  startBreathingGuide() {
    const modal = document.getElementById('modal-breathing');
    const instruction = document.getElementById('breathing-instruction-text');
    const sub = document.getElementById('breathing-sub-text');
    const secondsEl = document.getElementById('breathing-seconds-left');
    if (!modal) return;

    modal.style.display = 'flex';
    let timeLeft = 60;
    if (secondsEl) secondsEl.textContent = timeLeft;

    const phases = [
      { text: "Breathe in gently...", sub: "Inhale calm through your nose (4s)" },
      { text: "Hold peacefully...", sub: "Rest in the gentle stillness (4s)" },
      { text: "Release slowly...", sub: "Exhale through your mouth and relax your shoulders (4s)" },
      { text: "Rest and soften...", sub: "Feel your heart rhythm settle (4s)" }
    ];

    if (this.taskStudio.breathingInterval) {
      clearInterval(this.taskStudio.breathingInterval);
    }

    let phaseIndex = 0;
    const updatePhase = () => {
      const p = phases[phaseIndex % phases.length];
      if (instruction) instruction.textContent = p.text;
      if (sub) sub.textContent = p.sub;
    };
    updatePhase();

    this.taskStudio.breathingInterval = setInterval(() => {
      timeLeft--;
      if (secondsEl) secondsEl.textContent = timeLeft;

      if ((60 - timeLeft) % 4 === 0) {
        phaseIndex++;
        updatePhase();
      }

      if (timeLeft <= 0) {
        clearInterval(this.taskStudio.breathingInterval);
        this.taskStudio.breathingInterval = null;
        if (instruction) instruction.textContent = "Centered & Ready 🌿";
        if (sub) sub.textContent = "Your mind is clear and grounded. Nurture your work with joy.";
      }
    }, 1000);
  }

  renderTasksList() {
    const container = document.getElementById('tasks-list-container');
    const emptyState = document.getElementById('empty-tasks-state');
    const balanceText = document.getElementById('task-balance-text');
    const targetTitle = document.getElementById('focus-current-task-title');
    if (!container) return;

    const allTasks = this.taskStudio.getAllTasks();
    const filtered = this.taskStudio.getFilteredTasks();

    // Update Balance Text
    const completedCount = allTasks.filter(t => t.completed).length;
    if (balanceText) {
      balanceText.textContent = `${completedCount} of ${allTasks.length} studio tasks nurtured • Pace yourself with kindness.`;
    }

    // Update active target focus
    const focusTask = allTasks.find(t => t.id === this.taskStudio.selectedTaskIdForFocus) || allTasks.find(t => !t.completed);
    if (targetTitle) {
      targetTitle.textContent = focusTask ? `${focusTask.subjectCode} — ${focusTask.title}` : 'Desk clear! Choose a task to nurture.';
    }

    if (filtered.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    container.innerHTML = '';

    filtered.forEach(task => {
      const card = document.createElement('div');
      card.className = `task-card ${task.completed ? 'completed' : ''}`;

      const catBadgeClass = this.getCategoryBadgeClass(task.category);
      const catLabel = this.getCategoryLabel(task.category);

      let materialsHtml = '';
      if (task.materials && task.materials.length > 0) {
        materialsHtml = `
          <div class="task-materials-row">
            ${task.materials.map(m => `<span class="material-chip">✂️ ${m}</span>`).join('')}
          </div>
        `;
      }

      card.innerHTML = `
        <div class="task-checkbox-wrapper">
          <button class="btn-task-check ${task.completed ? 'checked' : ''}" title="${task.completed ? 'Mark incomplete' : 'Mark complete'}">
            ${task.completed ? '✓' : ''}
          </button>
        </div>
        <div class="task-content">
          <div class="task-meta-row">
            <span class="badge-subj">${task.subjectCode}</span>
            <span class="${catBadgeClass}">${catLabel}</span>
          </div>
          <h4 class="task-title">${task.title}</h4>
          ${materialsHtml}
          ${task.notes ? `<p class="task-notes-text">${task.notes}</p>` : ''}
          <div class="task-footer-row">
            <div class="task-meta-chips">
              <span>🗓️ Due ${this.formatDueDate(task.dueDate)}</span>
              <span>⏱️ ${task.estimatedMinutes} mins</span>
            </div>
            <div class="task-actions-group">
              <button class="btn-focus-task" title="Focus on this task in the study companion">🎯 Focus</button>
              <button class="btn-task-action btn-edit-task" title="Edit task">✏️</button>
              <button class="btn-task-action btn-delete-task text-danger" title="Delete task">🗑️</button>
            </div>
          </div>
        </div>
      `;

      // Event Handlers
      const checkBtn = card.querySelector('.btn-task-check');
      if (checkBtn) {
        checkBtn.addEventListener('click', () => {
          this.taskStudio.toggleTaskCompletion(task.id);
          this.renderTasksList();
        });
      }

      const focusBtn = card.querySelector('.btn-focus-task');
      if (focusBtn) {
        focusBtn.addEventListener('click', () => {
          this.taskStudio.selectedTaskIdForFocus = task.id;
          if (targetTitle) {
            targetTitle.textContent = `${task.subjectCode} — ${task.title}`;
          }
          const focusCard = document.querySelector('.focus-card');
          if (focusCard) {
            focusCard.style.outline = '2px solid var(--sage-primary)';
            setTimeout(() => { focusCard.style.outline = ''; }, 1000);
          }
        });
      }

      const editBtn = card.querySelector('.btn-edit-task');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          this.openTaskModal(task);
        });
      }

      const deleteBtn = card.querySelector('.btn-delete-task');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          if (confirm(`Remove "${task.title}"?`)) {
            this.taskStudio.deleteTask(task.id);
            this.renderTasksList();
          }
        });
      }

      container.appendChild(card);
    });
  }

  getCategoryBadgeClass(cat) {
    switch (cat) {
      case 'IMS_PREP': return 'badge-cat-ims';
      case 'REFLECTION': return 'badge-cat-reflection';
      case 'DEMO_REHEARSAL': return 'badge-cat-demo';
      case 'EXAM_READING': return 'badge-cat-exam';
      default: return 'badge-cat-ims';
    }
  }

  getCategoryLabel(cat) {
    switch (cat) {
      case 'IMS_PREP': return '✂️ IMs & Visual Aids';
      case 'REFLECTION': return '📝 Field Reflection';
      case 'DEMO_REHEARSAL': return '🎭 Demo Rehearsal';
      case 'EXAM_READING': return '📚 Exam & Readings';
      default: return 'Task';
    }
  }

  formatDueDate(dateStr) {
    if (!dateStr) return 'Flexible';
    const due = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  openTaskModal(taskToEdit = null) {
    const modal = document.getElementById('modal-task');
    const titleEl = document.getElementById('modal-task-title');
    if (!modal) return;

    document.getElementById('input-task-id').value = taskToEdit ? taskToEdit.id : '';
    document.getElementById('input-task-title').value = taskToEdit ? taskToEdit.title : '';
    document.getElementById('input-task-subject').value = taskToEdit ? taskToEdit.subjectCode : 'ED 204';
    document.getElementById('input-task-category').value = taskToEdit ? taskToEdit.category : 'IMS_PREP';
    document.getElementById('input-task-due').value = taskToEdit ? (taskToEdit.dueDate || '') : this.taskStudio.getRelativeDate(1);
    document.getElementById('input-task-minutes').value = taskToEdit ? (taskToEdit.estimatedMinutes || 45) : 45;
    document.getElementById('input-task-materials').value = taskToEdit ? (taskToEdit.materials || []).join(', ') : '';
    document.getElementById('input-task-notes').value = taskToEdit ? (taskToEdit.notes || '') : '';

    if (titleEl) {
      titleEl.textContent = taskToEdit ? 'Edit Academic Task' : 'Add Academic Task';
    }

    modal.style.display = 'flex';
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.pedagogoApp = new PedagogoDeskApp();
});
