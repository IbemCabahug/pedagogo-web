/**
 * Pedagogo Weekly Timetable View
 * Interactive 7-Day Curriculum & Observation Matrix
 */

export class TimetableView {
  constructor(scheduleData) {
    this.scheduleData = scheduleData;
    this.activeFilter = 'ALL';
    this.days = [
      { id: 1, name: 'Monday', short: 'Mon' },
      { id: 2, name: 'Tuesday', short: 'Tue' },
      { id: 3, name: 'Wednesday', short: 'Wed' },
      { id: 4, name: 'Thursday', short: 'Thu' },
      { id: 5, name: 'Friday', short: 'Fri' },
      { id: 6, name: 'Saturday', short: 'Sat' },
      { id: 7, name: 'Sunday', short: 'Sun' }
    ];

    this.initElements();
    this.render();
  }

  updateData(newScheduleData) {
    this.scheduleData = newScheduleData;
    this.render();
  }

  initElements() {
    this.container = document.getElementById('weekly-grid-container');
    const filterButtons = document.querySelectorAll('.filter-pill');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.filter;
        this.render();
      });
    });
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const subjects = this.scheduleData.subjects || [];
    const slots = this.scheduleData.slots || [];

    const subjectMap = new Map();
    subjects.forEach(s => subjectMap.set(s.id, s));

    this.days.forEach(day => {
      const dayCol = document.createElement('div');
      dayCol.className = 'day-column';

      const header = document.createElement('div');
      header.className = 'day-col-header';
      header.innerHTML = `
        <div class="day-name">${day.name}</div>
        <div class="day-date">${day.short}</div>
      `;
      dayCol.appendChild(header);

      // Filter slots for this day
      const daySlots = slots.filter(slot => slot.dayOfWeek === day.id)
        .sort((a, b) => (a.startHour * 60 + a.startMinute) - (b.startHour * 60 + b.startMinute));

      let renderedCount = 0;

      daySlots.forEach(slot => {
        const subject = subjectMap.get(slot.subjectId) || {
          code: 'Course',
          title: 'Scheduled Slot',
          category: 'LECTURE',
          colorHex: '#3B6347'
        };

        if (this.activeFilter !== 'ALL' && subject.category !== this.activeFilter) {
          return;
        }

        renderedCount++;
        const tile = document.createElement('div');
        tile.className = 'slot-tile';
        tile.style.borderLeftColor = subject.colorHex || '#3B6347';

        const startTime = `${String(slot.startHour).padStart(2, '0')}:${String(slot.startMinute).padStart(2, '0')}`;
        const endTime = `${String(slot.endHour).padStart(2, '0')}:${String(slot.endMinute).padStart(2, '0')}`;

        tile.innerHTML = `
          <span class="badge-category badge-${subject.category}">${this.formatCategoryName(subject.category)}</span>
          <div class="tile-code">${subject.code}</div>
          <div class="tile-time">⏰ ${startTime} – ${endTime}</div>
          <div class="tile-room">📍 ${slot.room || 'TBA'}</div>
        `;
        dayCol.appendChild(tile);
      });

      if (renderedCount === 0) {
        const emptyNotice = document.createElement('div');
        emptyNotice.style.fontSize = '12px';
        emptyNotice.style.color = 'var(--text-muted)';
        emptyNotice.style.textAlign = 'center';
        emptyNotice.style.marginTop = '20px';
        emptyNotice.textContent = 'No classes';
        dayCol.appendChild(emptyNotice);
      }

      this.container.appendChild(dayCol);
    });
  }

  formatCategoryName(cat) {
    switch (cat) {
      case 'FIELD_STUDY': return 'Field Study';
      case 'DEMO_TEACHING': return 'Demo Day';
      case 'PREP_TIME': return 'Lesson Prep';
      default: return 'Lecture';
    }
  }
}
