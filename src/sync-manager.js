/**
 * Pedagogo Sync Manager
 * Zero-Cost Peer-to-Peer QR Handshake via WebRTC DataChannel + Local File Backup
 */
import QRCode from 'qrcode';
import { Peer } from 'peerjs';

export class SyncManager {
  constructor(onDataReceived) {
    this.onDataReceived = onDataReceived;
    this.peer = null;
    this.activeConn = null;
    this.sessionId = this.generateSessionId();

    this.initElements();
    this.initPeer();
    this.initFileDrop();
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

    if (this.btnRefreshSession) {
      this.btnRefreshSession.addEventListener('click', () => this.refreshSession());
    }
  }

  initPeer() {
    if (this.qrSpinner) this.qrSpinner.style.display = 'flex';
    if (this.sessionCodeDisplay) this.sessionCodeDisplay.textContent = 'Connecting...';

    try {
      // Connect to free, public WebRTC signaling broker (zero server costs)
      this.peer = new Peer(this.sessionId, {
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
          this.updateStatus('Local Storage', '#10B981');
        });
      });

      this.peer.on('error', (err) => {
        console.warn('WebRTC signaling note:', err);
        // Fallback to offline pairing QR payload
        this.renderOfflineQrCode();
      });
    } catch (e) {
      console.error('Peer init fallback:', e);
      this.renderOfflineQrCode();
    }
  }

  renderQrCode(sessionId) {
    if (!this.qrCanvas) return;
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
    if (!this.qrCanvas) return;
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

  handleIncomingPayload(rawPayload) {
    try {
      const data = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
      if (data && (data.subjects || data.slots)) {
        localStorage.setItem('pedagogo_schedule', JSON.stringify(data));
        this.updateStatus('✅ Synced Successfully!', '#10B981');
        
        if (typeof this.onDataReceived === 'function') {
          this.onDataReceived(data);
        }

        // Trigger flash notification
        alert(`🌿 Great news, Teacher! Successfully received ${data.subjects ? data.subjects.length : 0} subjects and schedule slots from your mobile app.`);
      }
    } catch (e) {
      console.error('Failed to parse incoming payload:', e);
      alert('Received data format was not recognized.');
    }
  }

  initFileDrop() {
    const dropzone = document.getElementById('file-dropzone');
    const manualFileInput = document.getElementById('manual-file-input');
    const btnExportJson = document.getElementById('btn-export-json');

    if (dropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.add('hover');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.remove('hover');
        }, false);
      });

      dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) this.readFile(files[0]);
      });
    }

    if (manualFileInput) {
      manualFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) this.readFile(e.target.files[0]);
      });
    }

    if (btnExportJson) {
      btnExportJson.addEventListener('click', () => this.exportCurrentSchedule());
    }
  }

  readFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        this.handleIncomingPayload(data);
      } catch (err) {
        alert('Invalid JSON file. Please drop a valid Pedagogo backup.');
      }
    };
    reader.readAsText(file);
  }

  exportCurrentSchedule() {
    const currentData = localStorage.getItem('pedagogo_schedule') || JSON.stringify(this.getMockSchedule());
    const blob = new Blob([currentData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedagogo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
