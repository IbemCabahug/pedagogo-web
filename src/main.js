/**
 * Pedagogo Desk: Main Web Entry Point
 * Orchestrates Tabs, Today's Rhythm, Spark Quotes, Timetable, and Peer Sync
 */

import { SyncManager } from './sync-manager.js';
import { LessonPlanStudio } from './lesson-plan-studio.js';
import { TimetableView } from './timetable-view.js';

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
    this.syncManager = new SyncManager((newData) => {
      this.onScheduleUpdated(newData);
    });

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
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.pedagogoApp = new PedagogoDeskApp();
});
