/**
 * Pedagogo Sync & Backup Manager
 * 1. Zero-Cost Peer-to-Peer QR Handshake via WebRTC DataChannel (Phone to Desk)
 * 2. Unified Offline Data Backup & Restore Hub (100% Local Archive Preservation)
 */
import QRCode from 'qrcode';
import Peer from 'peerjs';
import { showToast } from './toast.js';

const PeerClass = Peer?.Peer || Peer;

export class SyncManager {
  constructor(onDataReceived) {
    this.onDataReceived = onDataReceived;
    this.peer = null;
    this.activeConn = null;
    this.sessionId = this.generateSessionId();

    this.initElements();
    this.initPeer();
    this.initFileDrop();
    this.renderBackupStats();

    // Re-render stats if any data changed or restored
    window.addEventListener('pedagogo:data-restored', () => this.renderBackupStats());
  }

  generateSessionId() {
    return 'pedagogo-' + Math.random().toString(36).substring(2, 9);
  }

  initElements() {
    this.qrCanvas = document.getElementById('sync-qr-canvas');
    this.qrSpinner = document.getElementById('qr-loading-spinner');
    this.sessionCodeDisplay = document.getElementById('session-code-display');
    this.btnRefreshSession = document.getElementById('btn-refresh-session');
    this.syncStatusPill = document.getElementById('sync-status-pill');
    this.syncStatusText = document.getElementById('sync-status-text');

    this.dropzone = document.getElementById('file-dropzone');
    this.manualFileInput = document.getElementById('manual-file-input');
    this.btnExportFullBackup = document.getElementById('btn-export-full-backup');
    this.btnExportJson = document.getElementById('btn-export-json');
    this.inventoryStrip = document.getElementById('backup-inventory-strip');

    if (this.btnRefreshSession) {
      this.btnRefreshSession.addEventListener('click', () => this.refreshSession());
    }

    if (this.btnExportFullBackup) {
      this.btnExportFullBackup.addEventListener('click', () => this.exportFullBackup());
    }

    if (this.btnExportJson) {
      this.btnExportJson.addEventListener('click', () => this.exportScheduleOnly());
    }
  }

  initPeer() {
    if (this.qrSpinner) this.qrSpinner.style.display = 'flex';
    if (this.sessionCodeDisplay) this.sessionCodeDisplay.textContent = 'Connecting...';

    try {
      // Connect to free, public WebRTC signaling broker (zero server costs)
      this.peer = new PeerClass(this.sessionId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        this.sessionId = id;
        if (this.sessionCodeDisplay) this.sessionCodeDisplay.textContent = id;
        this.renderQrCode(id);
      });

      this.peer.on('connection', (conn) => {
        this.activeConn = conn;
        this.updateStatus('📱 Phone Connected!', '#10B981');

        conn.on('data', (payload) => {
          this.handleIncomingPayload(payload);
          conn.send({ status: 'OK', receivedAt: new Date().toISOString() });
        });

        conn.on('close', () => {
          this.updateStatus('Local Storage Active', '#10B981');
        });
      });

      this.peer.on('error', (err) => {
        console.warn('WebRTC signaling note:', err);
        this.renderOfflineQrCode();
      });
    } catch (e) {
      console.error('Peer init fallback:', e);
      this.renderOfflineQrCode();
    }
  }

  renderQrCode(sessionId) {
    if (!this.qrCanvas || typeof this.qrCanvas.getContext !== 'function') return;
    if (this.qrSpinner) this.qrSpinner.style.display = 'none';

    // Pairing URI format that the Pedagogo Android app scans
    const pairingUri = `pedagogo://sync?session=${encodeURIComponent(sessionId)}&ts=${Date.now()}`;

    QRCode.toCanvas(this.qrCanvas, pairingUri, {
      width: 200,
      margin: 1,
      color: {
        dark: '#242B25',
        light: '#FFFFFF'
      }
    }, (error) => {
      if (error) console.error('QR Render Error:', error);
    });
  }

  renderOfflineQrCode() {
    if (!this.qrCanvas || typeof this.qrCanvas.getContext !== 'function') return;
    if (this.qrSpinner) this.qrSpinner.style.display = 'none';
    if (this.sessionCodeDisplay) this.sessionCodeDisplay.textContent = 'OFFLINE-READY';

    QRCode.toCanvas(this.qrCanvas, 'pedagogo://sync?offline=true', {
      width: 200,
      margin: 1,
      color: { dark: '#3B6347', light: '#FFFFFF' }
    });
  }

  refreshSession() {
    if (this.peer) {
      this.peer.destroy();
    }
    this.sessionId = this.generateSessionId();
    this.initPeer();
  }

  // =========================================================
  // File Drop & Unified Data Backup Hub Logic
  // =========================================================

  initFileDrop() {
    if (this.dropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        this.dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          this.dropzone.classList.add('hover');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        this.dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          this.dropzone.classList.remove('hover');
        }, false);
      });

      this.dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) this.readFile(files[0]);
      });
    }

    if (this.manualFileInput) {
      this.manualFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) this.readFile(e.target.files[0]);
      });
    }
  }

  readFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        this.handleIncomingPayload(data);
      } catch (err) {
        showToast('Invalid file format. Please drop a valid Pedagogo JSON or .pedagogo backup file.', 'warning');
      }
    };
    reader.readAsText(file);
  }

  handleIncomingPayload(rawPayload) {
    try {
      const data = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
      if (!data) throw new Error('Empty payload');

      // CASE 1: Full System Backup Archive
      if (data.stores || data.app === 'Pedagogo Desk' || (data.version && data.version >= 2)) {
        const stores = data.stores || {};
        let restoredCount = 0;

        Object.entries(stores).forEach(([key, val]) => {
          if (val !== undefined && val !== null) {
            localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
            restoredCount++;
          }
        });

        this.updateStatus('✅ Full Archive Restored!', '#10B981');
        this.renderBackupStats();

        // Dispatch notification so main.js and components refresh
        window.dispatchEvent(new CustomEvent('pedagogo:data-restored', { detail: data }));

        if (stores.pedagogo_schedule && typeof this.onDataReceived === 'function') {
          const sched = typeof stores.pedagogo_schedule === 'string'
            ? JSON.parse(stores.pedagogo_schedule)
            : stores.pedagogo_schedule;
          this.onDataReceived(sched);
        }

        const summary = data.summary || {};
        showToast(
          `Pedagogo Desk Archive Restored!\n` +
          `• ${summary.flashcards ?? 0} LET Flashcards • ${summary.fieldStudyEntries ?? 0} FS Episodes\n` +
          `• ${summary.tasks ?? 0} Tasks • ${summary.classrooms ?? 0} Classes • ${summary.subjects ?? 0} Subjects`,
          'success',
          5500
        );
        return;
      }

      // CASE 2: Legacy Timetable Schedule Payload (from phone QR or older backup)
      if (data.subjects || data.slots) {
        localStorage.setItem('pedagogo_schedule', JSON.stringify(data));
        this.updateStatus('✅ Schedule Synced!', '#10B981');
        this.renderBackupStats();

        if (typeof this.onDataReceived === 'function') {
          this.onDataReceived(data);
        }

        window.dispatchEvent(new CustomEvent('pedagogo:data-restored', { detail: { stores: { pedagogo_schedule: data } } }));

        showToast(`Schedule data received! Updated ${data.subjects ? data.subjects.length : 0} subjects.`, 'success');
        return;
      }

      showToast('Unrecognized backup format. Please select a valid Pedagogo backup.', 'warning');
    } catch (e) {
      console.error('Failed to parse incoming payload:', e);
      showToast('Could not parse file. Please verify it is a valid Pedagogo backup.', 'warning');
    }
  }

  /**
   * Generates a single, comprehensive .json archive of all local storage modules
   * (schedule, tasks, classrooms, rosters, LET cards, FS logs, lesson plans, reading history, and SF2 attendance roll calls).
   */
  exportFullBackup() {
    const parseKey = (key, fallback) => {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      try { return JSON.parse(raw); } catch { return raw; }
    };

    const schedule = parseKey('pedagogo_schedule', this.getMockSchedule());
    const tasks = parseKey('pedagogo_tasks', []);
    const classrooms = parseKey('pedagogo_classrooms', []);
    const students = parseKey('pedagogo_students', []);
    const enrollments = parseKey('pedagogo_enrollments', []);
    const flashcards = parseKey('pedagogo_flashcards', []);
    const fsEntries = parseKey('pedagogo_fs_entries', []);
    const savedLp = parseKey('pedagogo_saved_lp', null);
    const readingHistory = parseKey('pedagogo_reading_history', []);
    const attendance = parseKey('pedagogo_attendance_sessions', null);
    const theme = localStorage.getItem('pedagogo_theme') || 'light';
    const perspective = localStorage.getItem('pedagogo_perspective') || 'STUDENT';

    const attendanceSessionCount = attendance && Array.isArray(attendance.sessions) ? attendance.sessions.length : 0;
    const attendanceEntryCount = attendance && Array.isArray(attendance.entries) ? attendance.entries.length : 0;

    const fullArchive = {
      app: 'Pedagogo Desk',
      version: 2,
      exportedAt: new Date().toISOString(),
      summary: {
        subjects: schedule.subjects ? schedule.subjects.length : 0,
        slots: schedule.slots ? schedule.slots.length : 0,
        tasks: Array.isArray(tasks) ? tasks.length : 0,
        classrooms: Array.isArray(classrooms) ? classrooms.length : 0,
        students: Array.isArray(students) ? students.length : 0,
        flashcards: Array.isArray(flashcards) ? flashcards.length : 0,
        fieldStudyEntries: Array.isArray(fsEntries) ? fsEntries.length : 0,
        attendanceSessions: attendanceSessionCount,
        attendanceEntries: attendanceEntryCount,
        hasLessonPlan: !!savedLp
      },
      stores: {
        pedagogo_schedule: schedule,
        pedagogo_tasks: tasks,
        pedagogo_classrooms: classrooms,
        pedagogo_students: students,
        pedagogo_enrollments: enrollments,
        pedagogo_flashcards: flashcards,
        pedagogo_fs_entries: fsEntries,
        pedagogo_saved_lp: savedLp,
        pedagogo_reading_history: readingHistory,
        pedagogo_attendance_sessions: attendance,
        pedagogo_theme: theme,
        pedagogo_perspective: perspective
      }
    };

    const blob = new Blob([JSON.stringify(fullArchive, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.download = `pedagogo-full-backup-${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Full system backup archive downloaded safely!', 'success');
  }

  /**
   * Exports only the timetable schedule for quick pairing with the Android app.
   */
  exportScheduleOnly() {
    const currentData = localStorage.getItem('pedagogo_schedule') || JSON.stringify(this.getMockSchedule(), null, 2);
    const blob = new Blob([currentData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.download = `pedagogo-schedule-${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Schedule exported for phone sync!', 'success');
  }

  renderBackupStats() {
    if (!this.inventoryStrip) {
      this.inventoryStrip = document.getElementById('backup-inventory-strip');
    }
    if (!this.inventoryStrip) return;

    const countItems = (key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return 0;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.length;
        if (parsed && parsed.subjects) return parsed.subjects.length;
        return 1;
      } catch {
        return 0;
      }
    };

    const flashcardsCount = countItems('pedagogo_flashcards');
    const fsCount = countItems('pedagogo_fs_entries');
    const tasksCount = countItems('pedagogo_tasks');
    const classesCount = countItems('pedagogo_classrooms');
    const subjectsCount = countItems('pedagogo_schedule');

    let attendanceCount = 0;
    try {
      const attRaw = localStorage.getItem('pedagogo_attendance_sessions');
      const att = attRaw ? JSON.parse(attRaw) : null;
      attendanceCount = att && Array.isArray(att.sessions) ? att.sessions.length : 0;
    } catch {
      attendanceCount = 0;
    }

    this.inventoryStrip.innerHTML = `
      <div class="inventory-header">
        <span>📦 Current In-Browser Data Inventory</span>
        <span class="inventory-status">● 100% Stored Locally</span>
      </div>
      <div class="inventory-pills">
        <span class="inv-pill"><strong>${flashcardsCount}</strong> LET Cards</span>
        <span class="inv-pill"><strong>${fsCount}</strong> FS Episodes</span>
        <span class="inv-pill"><strong>${tasksCount}</strong> Tasks &amp; IMs</span>
        <span class="inv-pill"><strong>${classesCount}</strong> Classes</span>
        <span class="inv-pill"><strong>${attendanceCount}</strong> Roll Calls</span>
        <span class="inv-pill"><strong>${subjectsCount}</strong> Subjects</span>
      </div>
    `;
  }

  updateStatus(text, color) {
    if (this.syncStatusText) this.syncStatusText.textContent = text;
    if (this.syncStatusPill) {
      const dot = this.syncStatusPill.querySelector('.status-dot');
      if (dot && color) dot.style.background = color;
    }
  }

  getMockSchedule() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      subjects: [
        { id: 1, code: 'ED 204', title: 'Facilitating Learner-Centered Teaching', instructor: 'Prof. Santos', category: 'LECTURE', colorHex: '#3B6347', prepOffsetMinutes: 30 },
        { id: 2, code: 'FS 1', title: 'Field Study: Learner Development & Environment', instructor: 'CT Mrs. Cruz', category: 'FIELD_STUDY', colorHex: '#2F6F80', prepOffsetMinutes: 45 },
        { id: 3, code: 'ENG 302', title: 'Teaching English Language & Literature', instructor: 'Dr. Morales', category: 'DEMO_TEACHING', colorHex: '#D4683B', prepOffsetMinutes: 45 }
      ],
      slots: [
        { id: 101, subjectId: 1, dayOfWeek: 1, startHour: 8, startMinute: 30, endHour: 10, endMinute: 30, room: 'Room 304' },
        { id: 102, subjectId: 2, dayOfWeek: 3, startHour: 13, startMinute: 0, endHour: 16, endMinute: 0, room: 'Mabolo Elem Gr. 6' },
        { id: 103, subjectId: 3, dayOfWeek: 5, startHour: 10, startMinute: 0, endHour: 12, endMinute: 0, room: 'Auditorium Lab' }
      ]
    };
  }
}
