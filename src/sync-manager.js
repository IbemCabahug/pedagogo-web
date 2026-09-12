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
    this.undoSnapshot = null;   // in-memory pre-import state (session undo)
    this.undoPersisted = false; // true when a durable snapshot survived in localStorage

    this.initElements();
    this.initPeer();
    this.initFileDrop();
    this.renderBackupStats();

    // Re-render stats if any data changed or restored
    window.addEventListener('pedagogo:data-restored', () => this.renderBackupStats());

    // Re-surface the Undo bar after a reload if a durable restore snapshot survived
    try {
      if (localStorage.getItem('pedagogo_undo_snapshot_v1')) this.showUndoBar();
    } catch (e) { /* non-fatal: undo stays available for the current session */ }
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
        this.handleIncomingPayload(data, { fileName: file.name || 'backup.json' });
      } catch (err) {
        showToast('Invalid file format. Please drop a valid Pedagogo JSON or .pedagogo backup file.', 'warning');
      }
    };
    reader.readAsText(file);
  }

  handleIncomingPayload(rawPayload, meta) {
    try {
      const data = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
      if (!data) throw new Error('Empty payload');

      // CASE 1: Full System Backup Archive → preview report first (safety gate)
      if (data.stores || data.app === 'Pedagogo Desk' || (data.version && data.version >= 2)) {
        this.presentImportReport(data, meta);
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

  // =========================================================
  // Safety Net: Import Preview Report + One-Click Undo
  // =========================================================

  static STORE_META = {
    pedagogo_schedule: { label: 'Weekly Schedule', icon: '🗓️' },
    pedagogo_academic_tasks: { label: 'Tasks & IMs', icon: '✏️' },
    pedagogo_tasks: { label: 'Tasks & IMs (legacy)', icon: '✏️' },
    pedagogo_classrooms: { label: 'Classes', icon: '👥' },
    pedagogo_students: { label: 'Students', icon: '🧑‍🎓' },
    pedagogo_enrollments: { label: 'Enrollments', icon: '🔗' },
    pedagogo_let_cards: { label: 'LET Cards', icon: '📝' },
    pedagogo_flashcards: { label: 'LET Cards (legacy)', icon: '📝' },
    pedagogo_let_flags: { label: 'LET Flags', icon: '🚩' },
    pedagogo_let_logs: { label: 'Drill Logs', icon: '📈' },
    pedagogo_anecdotal_records: { label: 'Anecdotal Notes', icon: '📔' },
    pedagogo_fs_entries: { label: 'FS Episodes', icon: '🏫' },
    pedagogo_saved_lp: { label: 'Saved Lesson Plan', icon: '🌱' },
    pedagogo_reading_history: { label: 'Reading History', icon: '🕘' },
    pedagogo_reading_sessions: { label: 'Desk Sessions', icon: '📖' },
    pedagogo_reading_sync: { label: 'Sync Stamp', icon: '🔁' },
    pedagogo_attendance_sessions: { label: 'Roll Calls', icon: '📋' },
    pedagogo_assessments: { label: 'Assessments', icon: '📊' },
    pedagogo_lp_plans: { label: 'Lesson Plan Library', icon: '📚' },
    pedagogo_lp_draft: { label: 'Plan Draft', icon: '🌱' }
  };

  /** Count records inside any stored value (array, object-with-arrays, or scalar). */
  static countIncoming(value) {
    if (value === undefined || value === null) return 0;
    if (Array.isArray(value)) return value.length;
    if (typeof value === 'object') {
      for (const arrKey of ['plans', 'assessments', 'sessions', 'subjects', 'scores', 'entries']) {
        if (Array.isArray(value[arrKey])) return value[arrKey].length;
      }
      return Object.keys(value).length;
    }
    return 1;
  }

  /** Record count currently stored in Desk for a single key. */
  static countStore(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    try { return SyncManager.countIncoming(JSON.parse(raw)); } catch { return 1; }
  }

  fmtTime(iso) {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  presentImportReport(data, meta) {
    const card = document.getElementById('import-report-card');
    if (!card) return;

    const stores = data.stores || {};
    const labelMeta = SyncManager.STORE_META;
    const labelOrder = Object.keys(labelMeta);
    const dataKeys = Object.keys(stores).sort((a, b) => {
      const ia = labelOrder.indexOf(a);
      const ib = labelOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    let incomingTotal = 0;
    let overwriteCount = 0;
    let newCount = 0;
    const rows = [];
    for (const key of dataKeys) {
      const incoming = SyncManager.countIncoming(stores[key]);
      const current = SyncManager.countStore(key);
      incomingTotal += incoming;
      let action = '<span class="imp-act-skip">—</span>';
      let rowClass = '';
      if (incoming > 0 && current > 0) {
        action = '<span class="imp-act-update">🔁 Update</span>';
        rowClass = 'imp-row-warn';
        overwriteCount++;
      } else if (incoming > 0) {
        action = '<span class="imp-act-new">✨ New</span>';
        newCount++;
      }
      const meta2 = labelMeta[key] || { label: key.replace('pedagogo_', '').replace(/_/g, ' '), icon: '📄' };
      rows.push(`<tr class="${rowClass}"><td>${meta2.icon} ${this.escHtml(meta2.label)}</td><td class="imp-num">${incoming}</td><td class="imp-num">${current}</td><td>${action}</td></tr>`);
    }

    const fileName = this.escHtml(meta?.fileName || 'backup');
    const exportedAt = data.exportedAt ? this.escHtml(String(data.exportedAt).replace('T', ' ').slice(0, 19)) : 'unknown';
    const warnHtml = incomingTotal === 0
      ? `<div class="import-warning-chip imp-chip-empty">🕊️ This backup contains no records to restore — nothing would change.</div>`
      : (overwriteCount > 0
        ? `<div class="import-warning-chip">⚠️ Desk already holds data in <strong>${overwriteCount}</strong> module(s). Importing merges the file's version over those modules — nothing is deleted. A snapshot of the current Desk state is kept so you can undo afterwards.</div>`
        : `<div class="import-warning-chip imp-chip-calm">🌿 This backup adds <strong>${newCount}</strong> new module(s). Existing Desk data stays untouched — and you can still undo after.</div>`);

    card.hidden = false;
    card.innerHTML = `
      <div class="import-report-head">
        <span class="import-file-chip">📄 ${fileName}</span>
        <span class="import-meta-chip">Exported ${exportedAt} • v${this.escHtml(String(data.version || 2))} • ${incomingTotal} records incoming</span>
      </div>
      ${warnHtml}
      <table class="import-report-table">
        <thead><tr><th>Module</th><th>In this file</th><th>On Desk now</th><th>Action</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      <div class="import-report-actions">
        <button type="button" class="btn-primary" id="btn-confirm-restore">✓ Restore &amp; keep an Undo copy</button>
        <button type="button" class="btn-subtle" id="btn-cancel-import">✕ Cancel import</button>
      </div>`;

    card.querySelector('#btn-confirm-restore').addEventListener('click', () => this.applyRestore(data, meta));
    card.querySelector('#btn-cancel-import').addEventListener('click', () => {
      this.hideImportReport();
      showToast('Import canceled — nothing was changed.', 'info');
    });
  }

  hideImportReport() {
    const card = document.getElementById('import-report-card');
    if (card) { card.hidden = true; card.innerHTML = ''; }
  }

  applyRestore(data, meta) {
    const stores = data.stores || {};
    if (stores.pedagogo_tasks && !stores.pedagogo_academic_tasks) stores.pedagogo_academic_tasks = stores.pedagogo_tasks;
    if (stores.pedagogo_flashcards && !stores.pedagogo_let_cards) stores.pedagogo_let_cards = stores.pedagogo_flashcards;

    // 1. Snapshot current raw values for every key we are about to touch.
    const applyKeys = Object.keys(stores);
    const snapshot = {
      savedAt: new Date().toISOString(),
      fileName: meta?.fileName || 'backup',
      restore: {}
    };
    applyKeys.forEach((key) => { snapshot.restore[key] = localStorage.getItem(key); });
    this.undoSnapshot = snapshot;
    this.undoPersisted = false;
    try {
      localStorage.setItem('pedagogo_undo_snapshot_v1', JSON.stringify(snapshot));
      this.undoPersisted = true;
    } catch (e) {
      this.undoPersisted = false; // too large for localStorage → session-only undo
    }

    // 2. Write the archive stores.
    let restoredCount = 0;
    applyKeys.forEach((key) => {
      const val = stores[key];
      if (val !== undefined && val !== null) {
        localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
        restoredCount++;
      }
    });

    this.hideImportReport();
    this.updateStatus('✅ Full Archive Restored!', '#10B981');
    this.renderBackupStats();
    this.showUndoBar();

    window.dispatchEvent(new CustomEvent('pedagogo:data-restored', { detail: data }));

    if (stores.pedagogo_schedule && typeof this.onDataReceived === 'function') {
      const sched = typeof stores.pedagogo_schedule === 'string'
        ? JSON.parse(stores.pedagogo_schedule)
        : stores.pedagogo_schedule;
      this.onDataReceived(sched);
    }

    const summary = data.summary || {};
    const fileLabel = meta?.fileName ? `"${meta.fileName}"` : 'archive';
    showToast(
      `Desk restored from ${fileLabel}: ` +
      `${summary.flashcards ?? 0} LET • ${summary.fieldStudyEntries ?? 0} FS • ` +
      `${summary.tasks ?? 0} Tasks • ${summary.classrooms ?? 0} Classes • ${summary.readingSessions ?? 0} Sessions.` +
      (this.undoPersisted ? ' Undo kept until you decide.' : ' Session undo is ready.'),
      'success', 5500
    );
  }

  showUndoBar() {
    const bar = document.getElementById('restore-undo-bar');
    if (!bar) return;
    let snap = this.undoSnapshot;
    if (!snap) {
      try {
        const raw = localStorage.getItem('pedagogo_undo_snapshot_v1');
        snap = raw ? JSON.parse(raw) : null;
      } catch { snap = null; }
    }
    const name = this.escHtml((snap && snap.fileName) || 'a backup');
    const at = snap && snap.savedAt ? this.fmtTime(snap.savedAt) : '';
    bar.hidden = false;
    bar.innerHTML = `
      <div class="restore-undo-inner">
        <span>🔄 Imported <strong>${name}</strong>${at ? ` at ${at}` : ''} — the previous Desk state was saved. You can undo anytime.</span>
        <button type="button" class="btn-subtle" id="btn-undo-restore">↩ Undo restore</button>
      </div>`;
    bar.querySelector('#btn-undo-restore').addEventListener('click', () => this.undoLastRestore());
  }

  hideUndoBar() {
    const bar = document.getElementById('restore-undo-bar');
    if (bar) { bar.hidden = true; bar.innerHTML = ''; }
  }

  undoLastRestore() {
    let snap = this.undoSnapshot;
    if (!snap) {
      try {
        const raw = localStorage.getItem('pedagogo_undo_snapshot_v1');
        snap = raw ? JSON.parse(raw) : null;
      } catch { snap = null; }
    }
    if (!snap || !snap.restore) {
      showToast('Nothing to undo — no prior restore was found.', 'info');
      return;
    }

    let restored = 0;
    Object.entries(snap.restore).forEach(([key, rawVal]) => {
      if (rawVal === null || rawVal === undefined) {
        try { localStorage.removeItem(key); } catch { /* non-fatal */ }
      } else {
        try { localStorage.setItem(key, rawVal); restored++; } catch { /* non-fatal */ }
      }
    });

    this.undoSnapshot = null;
    try { localStorage.removeItem('pedagogo_undo_snapshot_v1'); } catch { /* non-fatal */ }
    this.undoPersisted = false;
    this.hideUndoBar();
    this.hideImportReport();
    this.updateStatus('↩ Previous Desk state restored', '#10B981');
    this.renderBackupStats();
    window.dispatchEvent(new CustomEvent('pedagogo:data-restored', { detail: { undo: true } }));
    showToast(`↩ Restored the previous Desk state${(snap.savedAt ? ` from ${this.fmtTime(snap.savedAt)}` : '')} — ${restored} module(s) rolled back.`, 'success', 4500);
  }

  /**
   * Generates a single, comprehensive .json archive of all local storage modules
   * (schedule, tasks, classrooms, rosters, LET cards, FS logs, lesson plans, reading history,
   *  SF2 attendance roll calls, and Phase 3 assessment score sheets).
   */
  exportFullBackup() {
    SyncManager.downloadFullBackup(SyncManager.buildFullArchive());
  }

  /**
   * Sprint B (risk fix): static archive builder so the Reading Desk can offer
   * "Backup now" without instantiating this class (the constructor inits PeerJS
   * and the sync-view DOM, which must not happen from the desk).
   */
  static buildFullArchive() {
    const parseKey = (key, fallback) => {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      try { return JSON.parse(raw); } catch { return raw; }
    };

    const schedule = parseKey('pedagogo_schedule', this.getMockSchedule());
    const tasks = parseKey('pedagogo_academic_tasks', parseKey('pedagogo_tasks', []));
    const classrooms = parseKey('pedagogo_classrooms', []);
    const students = parseKey('pedagogo_students', []);
    const enrollments = parseKey('pedagogo_enrollments', []);
    const flashcards = parseKey('pedagogo_let_cards', parseKey('pedagogo_flashcards', []));
    const fsEntries = parseKey('pedagogo_fs_entries', []);
    const savedLp = parseKey('pedagogo_saved_lp', null);
    const readingHistory = parseKey('pedagogo_reading_history', []);
    const readingSessions = parseKey('pedagogo_reading_sessions', {});
    const readingSync = parseKey('pedagogo_reading_sync', null);
    const attendance = parseKey('pedagogo_attendance_sessions', null);
    const assessments = parseKey('pedagogo_assessments', null);
    const planLibrary = parseKey('pedagogo_lp_plans', null);
    const planDraft = parseKey('pedagogo_lp_draft', null);
    const letFlags = parseKey('pedagogo_let_flags', []);
    const letLogs = parseKey('pedagogo_let_logs', []);
    const anecRecords = parseKey('pedagogo_anecdotal_records', []);
    const theme = localStorage.getItem('pedagogo_theme') || 'light';
    const perspective = localStorage.getItem('pedagogo_perspective') || 'STUDENT';

    const attendanceSessionCount = attendance && Array.isArray(attendance.sessions) ? attendance.sessions.length : 0;
    const attendanceEntryCount = attendance && Array.isArray(attendance.entries) ? attendance.entries.length : 0;
    const assessmentCount = assessments && Array.isArray(assessments.assessments) ? assessments.assessments.length : 0;
    const assessmentScoreCount = assessments && Array.isArray(assessments.scores) ? assessments.scores.length : 0;

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
        assessments: assessmentCount,
        assessmentScores: assessmentScoreCount,
        letFlags: Array.isArray(letFlags) ? letFlags.length : 0,
        letLogs: Array.isArray(letLogs) ? letLogs.length : 0,
        anecdotalNotes: Array.isArray(anecRecords) ? anecRecords.length : 0,
        readingSessions: Object.keys(readingSessions || {}).length,
        hasLessonPlan: !!savedLp
      },
      stores: {
        pedagogo_schedule: schedule,
        pedagogo_academic_tasks: tasks,
        pedagogo_classrooms: classrooms,
        pedagogo_students: students,
        pedagogo_enrollments: enrollments,
        pedagogo_let_cards: flashcards,
        pedagogo_let_flags: letFlags,
        pedagogo_let_logs: letLogs,
        pedagogo_anecdotal_records: anecRecords,
        pedagogo_fs_entries: fsEntries,
        pedagogo_saved_lp: savedLp,
        pedagogo_reading_history: readingHistory,
        pedagogo_reading_sessions: readingSessions,
        pedagogo_reading_sync: readingSync,
        pedagogo_attendance_sessions: attendance,
        pedagogo_assessments: assessments,
        pedagogo_lp_plans: planLibrary,
        pedagogo_lp_draft: planDraft,
        pedagogo_theme: theme,
        pedagogo_perspective: perspective
      }
    };

    return fullArchive;
  }

  /**
   * Downloads the archive file and stamps the reading-sync record so the
   * Reading Desk status chip can honestly show "backed up" vs "local only".
   */
  static downloadFullBackup(archive) {
    let stampedAt = null;
    try {
      const syncRaw = localStorage.getItem('pedagogo_reading_sync');
      const sync = syncRaw ? JSON.parse(syncRaw) : {};
      stampedAt = new Date().toISOString();
      sync.lastBackupAt = stampedAt;
      localStorage.setItem('pedagogo_reading_sync', JSON.stringify(sync));
    } catch (e) { /* non-fatal: chip just stays "local only" */ }

    const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
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
    window.dispatchEvent(new CustomEvent('pedagogo:backup-exported', { detail: { at: stampedAt } }));
    return archive;
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

    const flashcardsCount = countItems('pedagogo_let_cards') || countItems('pedagogo_flashcards');
    const letLogsCount = countItems('pedagogo_let_logs');
    const fsCount = countItems('pedagogo_fs_entries');
    const tasksCount = countItems('pedagogo_academic_tasks') || countItems('pedagogo_tasks');
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

    let assessmentCount = 0;
    try {
      const asmRaw = localStorage.getItem('pedagogo_assessments');
      const asm = asmRaw ? JSON.parse(asmRaw) : null;
      assessmentCount = asm && Array.isArray(asm.assessments) ? asm.assessments.length : 0;
    } catch {
      assessmentCount = 0;
    }

    let planLibraryCount = 0;
    try {
      const plRaw = localStorage.getItem('pedagogo_lp_plans');
      const pl = plRaw ? JSON.parse(plRaw) : null;
      planLibraryCount = pl && Array.isArray(pl.plans) ? pl.plans.length : 0;
    } catch {
      planLibraryCount = 0;
    }

    let readingSessionsCount = 0;
    try {
      const rsRaw = localStorage.getItem('pedagogo_reading_sessions');
      const rs = rsRaw ? JSON.parse(rsRaw) : null;
      readingSessionsCount = rs && typeof rs === 'object' ? Object.keys(rs).length : 0;
    } catch {
      readingSessionsCount = 0;
    }

    this.inventoryStrip.innerHTML = `
      <div class="inventory-header">
        <span>📦 Current In-Browser Data Inventory</span>
        <span class="inventory-status">● 100% Stored Locally</span>
      </div>
      <div class="inventory-pills">
        <span class="inv-pill"><strong>${flashcardsCount}</strong> LET Cards</span>
        <span class="inv-pill"><strong>${letLogsCount}</strong> Drill Logs</span>
        <span class="inv-pill"><strong>${fsCount}</strong> FS Episodes</span>
        <span class="inv-pill"><strong>${tasksCount}</strong> Tasks &amp; IMs</span>
        <span class="inv-pill"><strong>${classesCount}</strong> Classes</span>
        <span class="inv-pill"><strong>${attendanceCount}</strong> Roll Calls</span>
        <span class="inv-pill"><strong>${assessmentCount}</strong> Score Sheets</span>
        <span class="inv-pill"><strong>${countItems('pedagogo_anecdotal_records')}</strong> Anecdotal Notes</span>
        <span class="inv-pill"><strong>${planLibraryCount}</strong> Lesson Plans</span>
        <span class="inv-pill"><strong>${readingSessionsCount}</strong> Desk Sessions</span>
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

  static getMockSchedule() {
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
