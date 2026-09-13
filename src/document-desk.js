/**
 * Pedagogo Desk: Document Reading Desk & Cornell Note Studio 📖🌿
 * Orchestrates client-side file reading, search, 5-part pedagogical synthesis,
 * and classic Walter Pauk Cornell Study Sheets with "Fold & Test" active recall.
 */

import { DocumentParser } from './document-parser.js';
import { DocumentSummarizer } from './document-summarizer.js';
import { showToast } from './toast.js';
import { ReadingTelemetry } from './reading-telemetry.js';
import { SyncManager } from './sync-manager.js';

export class DocumentDesk {
  static SESSIONS_KEY = 'pedagogo_reading_sessions';
  static SYNC_KEY = 'pedagogo_reading_sync';

  constructor() {
    this.currentDoc = null;
    this.currentAnalysis = null;
    this.activeSubTab = 'synthesis'; // 'synthesis', 'cornell', or 'verbatim'
    this.activeSummaryType = null;   // 'study' | 'quick' | 'reviewer' — Sprint B goal choice
    this.verbatimVisibleCount = 25;  // Sprint B: lazy-render Verbatim to protect school-laptop perf
    this.searchQuery = '';
    this.verbatimView = 'transcript'; // 'transcript' | 'original' — dual-view Verbatim (research-backed)
    this.originalObjectUrl = null; // in-memory blob URL for Original view; never persisted
    this.isProcessing = false;
    this.isCornellFolded = false; // "Fold & Test" active recall state
    this.termBankMisses = new Map(); // term -> { meaning, anchor } starred as "couldn't recall"
    this.isSplitView = localStorage.getItem('pedagogo_reader_split_view') === 'true';
    this.originSubTab = 'synthesis';
    this.originScrollY = 0;
    this.citationTapCount = 0; // Sprint A telemetry: taps this session
    this.groundTruthDismissed = sessionStorage.getItem('pedagogo_guard_dismissed') === '1';

    this.container = document.getElementById('view-reading-desk');
    if (this.container) {
      this.claimInviteKey();
      this.render();
      // Sprint B risk fix: a restored backup archive adds desk sessions (resume
      // strip appears), and a fresh export flips the desk chip to "Backed up".
      window.addEventListener('pedagogo:data-restored', () => { if (this.container) this.render(); });
      window.addEventListener('pedagogo:backup-exported', () => { if (this.container && this.currentDoc) this.render(); });
      // Flush pending session save before the tab sleeps/closes (risk-fix: no lost tail)
      window.addEventListener('pagehide', () => this.flushSession());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flushSession();
      });
    }
  }

  // Sprint A.5 — magic invite link: pedagogo.html?key=AIza... (or #key=...)
  // Claims once into localStorage, strips the param so the key never lingers
  // in history/screenshots, then re-renders so the badge flips to Ready.
  claimInviteKey() {
    try {
      const url = new URL(window.location.href);
      let k = (url.searchParams.get('key') || '').trim();
      if (!k && window.location.hash) {
        const m = window.location.hash.match(/key=([^&]+)/);
        if (m) k = decodeURIComponent(m[1]).trim();
      }
      const forcedBasic = url.searchParams.get('basic') === '1';
      if (forcedBasic) { try { sessionStorage.setItem('pedagogo_force_basic', '1'); } catch (e) {} }
      if (!k || k.length < 10) return false;
      // Provider-pack format: "stepfun:BASE|MODEL|KEY" or plain Gemini key.
      if (k.startsWith('stepfun:')) {
        const parts = k.slice('stepfun:'.length).split('|');
        if (parts.length === 3) {
          DocumentSummarizer.setProvider('openai_compat');
          DocumentSummarizer.setOpenAIBaseUrl(parts[0] || 'https://api.stepfun.com/v1');
          DocumentSummarizer.setOpenAIModel(parts[1] || 'step-3.7-flash');
          DocumentSummarizer.setOpenAIKey(parts[2]);
        }
      } else if (k.startsWith('openai_compat:')) {
        const parts = k.slice('openai_compat:'.length).split('|');
        if (parts.length === 3) {
          DocumentSummarizer.setProvider('openai_compat');
          DocumentSummarizer.setOpenAIBaseUrl(parts[0]);
          DocumentSummarizer.setOpenAIModel(parts[1]);
          DocumentSummarizer.setOpenAIKey(parts[2]);
        }
      } else {
        DocumentSummarizer.setProvider('gemini');
        try { localStorage.setItem(DocumentSummarizer.STORAGE_KEY, k); } catch (e) {}
      }
      try { ReadingTelemetry.log('invite_key_claimed'); } catch (e) {}
      url.searchParams.delete('key');
      url.searchParams.delete('basic');
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash.replace(/key=[^&]+&?/, ''));
      try { showToast('AI is ready — just drop a file to start.', 'success'); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }

  // ============================================================
  // Sprint B — Session continuity + honest sync status (risk fixes)
  // "Web is a tool" model: desk work lives in this browser until the
  // user exports a backup or syncs to the phone. Chip + resume strip
  // + backup button make that contract visible and cheap to meet.
  // ============================================================

  // Stable id per document (filename + unit count + text length)
  makeDocId(doc) {
    try {
      return `${doc.filename || 'doc'}::${doc.totalUnits || 0}::${(doc.rawText || '').length}`;
    } catch (e) { return `doc::${Date.now()}`; }
  }

  loadSyncRecord() {
    try { return JSON.parse(localStorage.getItem(this.SYNC_KEY) || 'null'); } catch (e) { return null; }
  }

  loadDeskSessions(asMap = false) {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.SESSIONS_KEY) || '{}');
      if (asMap) return parsed;
      if (!parsed || typeof parsed !== 'object') return [];
      return Object.values(parsed).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    } catch (e) { return asMap ? {} : []; }
  }

  persistSession() {
    // Debounced: tab switches / split toggles shouldn't stringify megabytes on every click
    if (this._persistTimer) clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(() => this._persistSessionNow(), 400);
  }

  flushSession() {
    if (this._persistTimer) { clearTimeout(this._persistTimer); this._persistTimer = null; }
    this._persistSessionNow();
  }

  _persistSessionNow() {
    if (!this.currentDoc || !this.currentDocId) return;
    try {
      const sessions = this.loadDeskSessions(true) || {};
      const docCopy = Object.assign({}, this.currentDoc);
      // Never persist live File handles, blob URLs, or heavy render helpers.
      delete docCopy.sourceFile;
      delete docCopy.originalObjectUrl;
      if (docCopy.formattedHtml && docCopy.formattedHtml.length > 200000) {
        // Keep session restores light; transcript units + rawText always survive.
        delete docCopy.formattedHtml;
      }
      if (docCopy.base64Data) {
        // Multimodal bytes are too large for localStorage; resumable text survives.
        docCopy.multimodalAvailable = true;
        delete docCopy.base64Data;
      }
      const entry = {
        id: this.currentDocId,
        filename: this.currentDoc.filename,
        fileType: this.currentDoc.fileType,
        totalUnits: this.currentDoc.totalUnits,
        unitLabel: this.currentDoc.unitLabel,
        savedAt: this.currentSessionSavedAt,
        doc: docCopy,
        analysis: this.currentAnalysis,
        activeSubTab: this.activeSubTab,
        activeSummaryType: this.activeSummaryType,
        verbatimView: this.verbatimView,
        isSplitView: this.isSplitView,
        isCornellFolded: this.isCornellFolded,
        verbatimVisibleCount: this.verbatimVisibleCount
      };
      sessions[entry.id] = entry;

      // Bound storage: keep at most the 3 most recent desk sessions
      const entries = Object.values(sessions).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      while (entries.length > 3) {
        const oldest = entries.pop();
        if (oldest && oldest.id !== entry.id) delete sessions[oldest.id];
      }

      try {
        localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
      } catch (quotaErr) {
        // Quota exceeded (huge doc): keep only this session and retry once
        const trimmed = {};
        trimmed[entry.id] = entry;
        localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(trimmed));
      }

      if (!this._loggedSaveIds) this._loggedSaveIds = new Set();
      if (!this._loggedSaveIds.has(entry.id)) {
        this._loggedSaveIds.add(entry.id);
        try { ReadingTelemetry.log('session_auto_saved'); } catch (e) {}
      }
    } catch (e) { /* persistence is best-effort; never block the desk */ }
  }

  resumeSession(id) {
    const sessions = this.loadDeskSessions(true) || {};
    const s = sessions[id];
    if (!s || !s.doc) return;
    const originalSavedAt = s.savedAt;
    this.currentDoc = s.doc;
    this.currentAnalysis = s.analysis || null;
    this.activeSubTab = s.activeSubTab || 'synthesis';
    this.activeSummaryType = s.activeSummaryType || null;
    this.verbatimView = s.verbatimView === 'original' ? 'original' : 'transcript';
    this.ensureOriginalObjectUrl();
    this.isSplitView = Boolean(s.isSplitView);
    this.isCornellFolded = Boolean(s.isCornellFolded);
    this.verbatimVisibleCount = s.verbatimVisibleCount || 25;
    this.currentDocId = s.id;
    this.currentSessionSavedAt = new Date().toISOString(); // touch → recency
    try { ReadingTelemetry.log('session_resumed'); } catch (e) {}
    if (!this._loggedSaveIds) this._loggedSaveIds = new Set();
    this._loggedSaveIds.add(s.id); // don't double-log auto-save for a resumed doc
    this.persistSession();
    this.render();
    showToast(`Resumed "${s.filename}" — right where you left it.`, 'success');
    const last = this.loadSyncRecord()?.lastBackupAt;
    if (!last || new Date(last) < new Date(originalSavedAt)) {
      setTimeout(() => showToast(`Last backup: ${this.relTime(last)} — consider the 💾 Backup button so a cleared browser can't lose this.`, 'info', 6000), 1200);
    }
  }

  deleteSession(id) {
    try {
      const sessions = this.loadDeskSessions(true) || {};
      delete sessions[id];
      localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
    } catch (e) {}
    if (!this.currentDoc) this.render();
  }

  relTime(iso) {
    try {
      const ms = Date.now() - new Date(iso).getTime();
      if (!isFinite(ms) || ms < 45000) return 'just now';
      const m = Math.round(ms / 60000);
      if (m < 60) return `${m}m ago`;
      const h = Math.round(m / 60);
      if (h < 24) return `${h}h ago`;
      return `${Math.round(h / 24)}d ago`;
    } catch (e) { return 'a while ago'; }
  }

  // Honest status chip: is this reading saved only in this browser, or backed up?
  syncChipHtml() {
    if (!this.currentSessionSavedAt) return '';
    const last = this.loadSyncRecord()?.lastBackupAt;
    const backedUp = last && new Date(last) >= new Date(this.currentSessionSavedAt);
    if (backedUp) {
      return `<span class="chip chip-sync-ok" title="Included in your latest backup file.">🟢 Backed up ${this.relTime(last)}</span>`;
    }
    return `<span class="chip chip-sync-warn" title="Saved in this browser only. Use 💾 Backup (or sync to your phone) so a cleared browser or a new device can't lose it.">🟠 This browser only</span>`;
  }

  renderResumeStrip(sessions) {
    return `
      <div class="desk-resume-strip">
        <div class="resume-strip-header">
          <span>🕐 Pick up where you left off</span>
          <span class="resume-sub">saved in this browser</span>
        </div>
        <div class="resume-cards">
          ${sessions.map(s => `
            <div class="desk-resume-card">
              <div class="resume-card-top">
                <span class="doc-type-badge ${String(s.fileType || '').toLowerCase()}">${this.escapeHtml(s.fileType || 'DOC')}</span>
                <button class="btn-resume-delete" data-resume-delete="${this.escapeHtml(s.id)}" title="Forget this session">✕</button>
              </div>
              <p class="resume-filename" title="${this.escapeHtml(s.filename)}">${this.escapeHtml(s.filename)}</p>
              <p class="resume-meta">${s.totalUnits || 0} ${this.escapeHtml(s.unitLabel || 'pages')} · ${s.analysis ? 'summary ready' : 'not summarized yet'} · ${this.relTime(s.savedAt)}</p>
              <button class="btn-primary btn-resume-session" data-resume="${this.escapeHtml(s.id)}">Resume ↗</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  exportDeskBackup() {
    this.flushSession(); // make sure the archive includes the latest state
    try { ReadingTelemetry.log('desk_backup_exported'); } catch (e) {}
    SyncManager.downloadFullBackup(SyncManager.buildFullArchive());
    if (this.currentDoc) this.render(); // chip flips to 🟢 Backed up
  }

  render() {
    if (!this.container) return;

    if (!this.currentDoc) {
      this.renderUploadState();
    } else {
      this.renderActiveWorkspace();
    }
  }

  renderUploadState() {
    const prov = DocumentSummarizer.getProvider();
    const isUsingDefault = DocumentSummarizer.isUsingDefaultKey();
    const hasGeminiCustom = Boolean(DocumentSummarizer.getGeminiCustomKey());
    const hasOpenAI = prov === 'openai_compat' && Boolean(DocumentSummarizer.getOpenAIKey());
    const deskSessions = this.loadDeskSessions();

    // Managed-deployment rule: the header pill is a call-to-action, not a status.
    // Show it ONLY when the user must do something (no usable key). Otherwise hide.
    let showKeyPill = false;
    let keyBadgeIcon = '';
    let keyBadgeText = '';
    if (prov === 'openai_compat' && !hasOpenAI) {
      showKeyPill = true;
      keyBadgeIcon = '🔌';
      keyBadgeText = 'Connect Your Access Key';
    } else if (prov !== 'openai_compat' && !DocumentSummarizer.hasApiKey()) {
      showKeyPill = true;
      keyBadgeIcon = '🔑';
      keyBadgeText = 'Setup Full Study Mode';
    }

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="section-title">Smart Pedagogical Reading Desk 📖🌿</h2>
          <p class="section-desc">Upload course readings, DepEd orders, or slide decks to extract verbatim text and generate research-backed Cornell study sheets.</p>
        </div>
        <div class="header-actions">
          ${showKeyPill ? `
          <button class="btn-subtle" id="btn-open-gemini-modal">
            <span>${keyBadgeIcon} ${keyBadgeText}</span>
          </button>` : ''}
        </div>
      </div>

      <!-- Research Foundation Banner -->
      <div class="reading-research-banner">
        <div class="research-icon">🧠</div>
        <div class="research-content">
          <h4>Engineered on 5 Pillars of Learning Science</h4>
          <p>Every analysis is structured using Walter Pauk's <strong>Cornell Note System</strong>, Sweller's <strong>Cognitive Load Chunking</strong>, Dunlosky's <strong>Elaborative Feynman Analogies</strong>, Gentner's <strong>Contrastive Matrices</strong>, and Roediger &amp; Karpicke's <strong>Retrieval Testing Effect</strong>.</p>
        </div>
      </div>

      <!-- Drag & Drop Upload Arena -->
      <div class="document-dropzone" id="document-dropzone">
        <input type="file" id="file-document-input" accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp" style="display: none;">
        <div class="dropzone-icon">📥</div>
        <h3 class="dropzone-title">Drop your educational reading here</h3>
        <p class="dropzone-hint">Supports <strong>PDF</strong> (2-column spatial reconstruction), Word (<strong>.docx</strong>), PowerPoint (<strong>.pptx</strong>), plain text, or visual scans/images. 100% parsed locally in your browser.</p>
        
        <div class="dropzone-cta-group">
          <button class="btn-primary" id="btn-browse-file">
            <span>📁 Select File from Computer</span>
          </button>
          <span class="cta-divider">— or —</span>
          <button class="btn-secondary" id="btn-load-sample-doc">
            <span>✨ Try Sample: Piaget vs. Vygotsky</span>
          </button>
        </div>

        <div class="dropzone-format-tags">
          <span class="format-pill">📕 PDF Spatial Reconstruction</span>
          <span class="format-pill">📘 Word DOCX (Headings &amp; Tables)</span>
          <span class="format-pill">📙 PowerPoint Slides &amp; Notes</span>
          <span class="format-pill">🖼️ Images &amp; Scans</span>
          <span class="format-pill">🔒 100% Private (No Cloud Storage)</span>
        </div>
      </div>

      ${deskSessions.length ? this.renderResumeStrip(deskSessions) : ''}

      <!-- Processing overlay moved out of this template (2026-09-13 root-cause fix):
           it used to live here and was destroyed by renderActiveWorkspace()'s
           innerHTML swap, so showLoading() silently no-op'd during AI synthesis
           (the reported "plain white, then text appears" bug). It is now a
           body-level lazy singleton — see ensureLoadingOverlay(). -->
    `;

    this.bindUploadEvents();
  }

  renderActiveWorkspace() {
    const doc = this.currentDoc;
    const analysis = this.currentAnalysis;
    const wordCount = doc.rawText.split(/\s+/).filter(Boolean).length;
    const engineBadge = analysis?.modelName 
      ? `<span class="chip chip-engine" title="Analyzed with ${this.escapeHtml(analysis.modelName)}">${analysis.source === 'GEMINI_API' ? '✨ ' : (analysis.source === 'OPENAI_COMPAT_API' ? '🔌 ' : '⚡ ')}${this.escapeHtml(analysis.modelName)}${analysis.isMultimodal ? ' (Multimodal)' : ''}</span>`
      : '';

    this.container.innerHTML = `
      <!-- Workspace Header -->
      <div class="workspace-header-bar">
        <div class="doc-meta-badge-group">
          <button class="btn-subtle btn-back-upload" id="btn-back-upload" title="Upload another document">
            ← <span>Back to Upload</span>
          </button>
          <div class="doc-title-box">
            <span class="doc-type-badge ${doc.fileType.toLowerCase()}">${doc.fileType}</span>
            <h3 class="doc-filename" title="${doc.filename}">${doc.filename}</h3>
          </div>
          <div class="doc-stats-chips">
            <span class="chip">📄 ${doc.totalUnits} ${doc.unitLabel}</span>
            <span class="chip">🔤 ~${wordCount.toLocaleString()} words</span>
            ${engineBadge}
            ${this.syncChipHtml()}
          </div>
        </div>

        <!-- Sub-tab Perspective Switcher: Synthesis vs Cornell vs Verbatim -->
        <div class="reading-subtabs">
          <button class="reading-subtab ${this.activeSubTab === 'synthesis' ? 'active' : ''}" data-subtab="synthesis" id="btn-subtab-synthesis">
            <span>💡 Pedagogical Synthesis</span>
          </button>
          <button class="reading-subtab ${this.activeSubTab === 'cornell' ? 'active' : ''}" data-subtab="cornell" id="btn-subtab-cornell">
            <span>📝 Cornell Study Sheet</span>
          </button>
          <button class="reading-subtab ${this.activeSubTab === 'verbatim' ? 'active' : ''}" data-subtab="verbatim" id="btn-subtab-verbatim">
            <span>📖 Verbatim Transcript</span>
          </button>
        </div>

        <!-- Actions -->
        <div class="workspace-actions">
          <button class="btn-primary btn-summarize-main" id="btn-summarize-main" title="Generate a summary from this document">
            <span>✨ ${this.currentAnalysis ? 'Re-summarize' : 'Summarize'}</span>
          </button>
          <button class="btn-subtle btn-toggle-split" id="btn-toggle-split-view" title="Toggle side-by-side view (Notes on left, Original document on right)">
            <span>${this.isSplitView ? '📖 Single View' : '📑 Split View'}</span>
          </button>
          ${this.activeSubTab === 'cornell' ? `
            <button class="btn-subtle" id="btn-toggle-fold-notes" title="Cover or reveal notes column for active recall practice">
              ${this.isCornellFolded ? '👁️ <span>Reveal Notes</span>' : '🙈 <span>Fold &amp; Test</span>'}
            </button>
            <button class="btn-subtle" id="btn-export-cornell-doc" title="Download formatted Cornell Sheet for Microsoft Word">
              📄 <span>Export Word (.doc)</span>
            </button>
          ` : `
            <button class="btn-subtle" id="btn-copy-reading-text" title="Copy active view text">
              📋 <span>Copy</span>
            </button>
          `}
          <button class="btn-subtle" id="btn-print-reading-guide" title="Print this study sheet for physical binder">
            🖨️ <span>Print</span>
          </button>
          <button class="btn-subtle" id="btn-desk-backup" title="Download a full backup file — restores on any device, and works with the phone app's Backup Downloader">
            💾 <span>Backup</span>
          </button>
        </div>
      </div>

      <!-- Main Dual-View Body -->
      <div class="reading-view-body ${this.isSplitView ? 'split-active' : ''}" id="reading-view-body">
        <!-- View A: Pedagogical Synthesis -->
        <div class="synthesis-panel" id="synthesis-panel" style="${(this.activeSubTab === 'synthesis' || (this.isSplitView && this.activeSubTab !== 'cornell')) ? 'display: block;' : 'display: none;'}">
          ${!this.currentAnalysis ? this.renderSummarizeEmptyState('synthesis') : `
          <div class="synthesis-meta-strip">
            <span class="synthesis-source-tag">
              🌱 ${analysis?.source === 'QUICK_LOOK'
                ? 'Quick Look — what this file says' + (!DocumentSummarizer.hasApiKey() ? ' (Basic Mode)' : '')
                : (analysis?.source === 'OPENAI_COMPAT_API'
                ? 'Analyzed via your access key (' + this.escapeHtml(analysis.modelName || 'custom provider') + ')'
                : (analysis?.source === 'GEMINI_API'
                ? 'Analyzed with Full Study Mode (built-in)'
                : (['LOCAL_EXTRACTIVE_NLP', 'LOCAL_TEXTRANK_ENGINE'].includes(analysis?.source)
                  ? 'Offline extract — keyword scaffolding, enable Full Study Mode for accuracy'
                  : 'Built-in Educational Sample (Basic Offline Mode — quality limited without Full Study Mode)')))})
            </span>
            <span class="synthesis-frameworks-badge">
              ${this.activeSummaryType === 'quick'
                ? '✓ TL;DR ✓ Key Points ✓ Citations ✓ Study Next'
                : '✓ Cornell Notes ✓ Cognitive Chunking ✓ Feynman Analogy ✓ Contrastive Matrix ✓ LET Practice'}
            </span>
            ${['LOCAL_EXTRACTIVE_NLP', 'LOCAL_TEXTRANK_ENGINE'].includes(analysis?.source) && !DocumentSummarizer.hasApiKey() ? `
              <button class="btn-subtle" id="btn-upgrade-gemini-pill" style="margin-left: auto; font-size: 11.5px; padding: 3px 10px;">
                ⚡ <span>Enable Full Study Mode (free)</span>
              </button>
            ` : ''}
          </div>
          ${this.groundTruthDismissed ? '' : `
          <div class="ground-truth-guard" id="ground-truth-guard" role="alert">
            <div class="guard-icon">🔍</div>
            <div class="guard-body">
              <strong>Before you trust this — tap one citation to verify it.</strong>
              <span>Summaries can sound confident even when wrong. One tap on [Page X] jumps to the exact words in your file.</span>
            </div>
            <div class="guard-actions">
              <button class="btn-subtle" id="btn-guard-verify">Verify a claim now</button>
              <button class="btn-subtle guard-dismiss" id="btn-guard-dismiss" aria-label="Dismiss for this session">Dismiss for this session</button>
            </div>
          </div>
          `}
          <div class="synthesis-content-render" id="synthesis-rendered-area">
            ${this.activeSummaryType === 'quick' ? this.renderQuickLook(analysis?.markdown || '') : this.renderSynthesisMarkdown(analysis?.markdown || '')}
          </div>
        </div>
          `}

        <!-- View B: Interactive Walter Pauk Cornell Note View -->
        <div class="cornell-panel" id="cornell-panel" style="${this.activeSubTab === 'cornell' ? 'display: block;' : 'display: none;'}">
          ${!this.currentAnalysis ? this.renderSummarizeEmptyState('cornell') : this.renderCornellSheet(analysis?.markdown || '', doc)}
        </div>

        <!-- View C: Verbatim Word-for-Word Reader -->
        <div class="verbatim-panel" id="verbatim-panel" style="${(this.activeSubTab === 'verbatim' || this.isSplitView) ? 'display: block;' : 'display: none;'}">
          <!-- Jump Return Banner Slot -->
          <div id="verbatim-jump-banner-slot"></div>

          <!-- Dual-view switcher: Transcript (study) vs Original (visual truth) -->
          <div class="verbatim-view-toggle" role="tablist" aria-label="Verbatim view">
            <button type="button" role="tab" aria-selected="${this.verbatimView !== 'original'}" class="verbatim-view-btn ${this.verbatimView !== 'original' ? 'active' : ''}" data-verbatim-view="transcript" title="Searchable word-for-word text with copy and citation jumps">📖 Transcript</button>
            <button type="button" role="tab" aria-selected="${this.verbatimView === 'original'}" class="verbatim-view-btn ${this.verbatimView === 'original' ? 'active' : ''}" data-verbatim-view="original" title="Original file layout, read-only">🖼️ Original</button>
          </div>

          ${this.verbatimView === 'original' ? `
          <!-- Original View -->
          <div class="verbatim-original" id="verbatim-original">
            ${this.renderOriginalView(doc)}
          </div>` : `
          <!-- Search & Unit Filter Toolbar -->
          <div class="verbatim-toolbar">
            <div class="verbatim-search-box">
              <span class="search-icon">🔍</span>
              <input type="text" id="verbatim-search-input" placeholder="Search word-for-word text in this ${doc.fileType}..." value="${this.escapeHtml(this.searchQuery)}">
              ${this.searchQuery ? '<button class="btn-clear-search" id="btn-clear-search">✕</button>' : ''}
            </div>
            <div class="verbatim-unit-pills" id="verbatim-unit-pills">
              <button class="unit-jump-pill active" data-unit="all">All ${doc.unitLabel}</button>
              ${doc.units.map(u => `<button class="unit-jump-pill" data-unit="${u.unitNumber}">${u.title}</button>`).join('')}
            </div>
          </div>

          <!-- Verbatim Text Stream -->
          <div class="verbatim-stream" id="verbatim-stream">
            ${this.renderVerbatimUnits(doc)}
          </div>`}
        </div>
      </div>
    `;

    this.bindWorkspaceEvents();
  }

  /**
   * Walter Pauk Spatial Cornell Architecture:
   * Header -> Left Cue Column (30%) + Right Notes Column (70%) -> Bottom Summary Row
   */
  renderCornellSheet(md, doc) {
    if (!md) return '<p class="empty-text">No document analysis available.</p>';

    // Extract Cues, Synthesis, Notes, Analogies, and Chunks
    let summaryText = 'Distill core ideas from reading into an enduring takeaway.';
    const sumMatch = md.match(/(?:TL;DR|Macro-Synthesis)[^\n:]*:\*\*\s*([^\n]+)/i);
    if (sumMatch) summaryText = sumMatch[1];

    // Extract Active Recall Cues
    const cues = [];
    const cueMatches = md.matchAll(/(?:Active Recall Cue Questions|Recall Cues)[^\n]*\n([\s\S]*?)(?=### 2\.|$)/gi);
    for (const match of cueMatches) {
      const lines = match[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•') || /^\d+\./.test(l.trim()));
      lines.forEach(l => {
        const clean = l.replace(/^[-•\d.]\s*/, '').trim();
        if (clean) cues.push(clean);
      });
    }

    if (cues.length === 0) {
      cues.push('What is the central pedagogical premise?');
      cues.push('How does this translate into concrete classroom practice?');
      cues.push('What are the key contrasting concepts?');
    }

    // Extract Structured Notes (Chunks & Analogies)
    let notesMarkdown = '';
    const chunksMatch = md.match(/### 2\. 🧩 Structured Concept Chunks[\s\S]*?(?=### 4\.|$)/);
    if (chunksMatch) {
      notesMarkdown = chunksMatch[0];
    } else {
      notesMarkdown = md;
    }

    const dateFormatted = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <div class="cornell-sheet-container" id="cornell-sheet-container">
        <!-- Top Binder Header Strip -->
        <div class="cornell-sheet-header">
          <div class="cornell-header-cell">
            <span class="cornell-label">COURSE / SUBJECT:</span>
            <span class="cornell-val">Pre-Service Professional Education</span>
          </div>
          <div class="cornell-header-cell">
            <span class="cornell-label">TOPIC / MODULE:</span>
            <span class="cornell-val">${this.escapeHtml(doc.filename.replace(/\.[^/.]+$/, ''))}</span>
          </div>
          <div class="cornell-header-cell">
            <span class="cornell-label">DATE:</span>
            <span class="cornell-val">${dateFormatted}</span>
          </div>
          <div class="cornell-header-cell">
            <span class="cornell-label">SOURCE:</span>
            <span class="cornell-val">${doc.fileType} (${doc.totalUnits} ${doc.unitLabel})</span>
          </div>
        </div>

        <!-- Instructions Banner -->
        <div class="cornell-instructions-strip">
          <span class="cornell-inst-badge">Walter Pauk Method</span>
          <span class="cornell-inst-desc">
            <strong>Active Recall Practice:</strong> Cover the right column and recite the concepts aloud using only the cues on the left.
          </span>
          <button class="btn-subtle btn-toggle-fold-inline" id="btn-toggle-fold-inline">
            ${this.isCornellFolded ? '👁️ Unfold Notes' : '🙈 Fold Notes to Test Yourself'}
          </button>
        </div>

        <!-- 2-Column Spatial Core -->
        <div class="cornell-two-column-body">
          <!-- Left Column: Cues, Recall Prompts, Keywords (~30%) -->
          <div class="cornell-cues-column">
            <div class="cues-column-header">
              <h4>RECALL CUES &amp; PROMPTS</h4>
              <span class="cues-sub">(Questions, Keywords, Formulas)</span>
            </div>

            <div class="cues-list">
              ${cues.map((cue, idx) => `
                <div class="cue-item-card">
                  <span class="cue-bullet">Q${idx + 1}</span>
                  <p class="cue-text">${this.simpleMarkdown(cue)}</p>
                </div>
              `).join('')}

              <div class="cue-item-card prompt-card">
                <span class="cue-bullet">🎯</span>
                <p class="cue-text"><strong>Classroom Translation:</strong> How will I execute this in a real high school classroom?</p>
              </div>

              <div class="cue-item-card prompt-card">
                <span class="cue-bullet">⚖️</span>
                <p class="cue-text"><strong>Contrastive Focus:</strong> What distinguishing attributes separate these core theories?</p>
              </div>
            </div>
          </div>

          <!-- Right Column: Main Notes, Concept Outlines & Analogies (~70%) -->
          <div class="cornell-notes-column ${this.isCornellFolded ? 'cornell-folded' : ''}" id="cornell-notes-column">
            ${this.isCornellFolded ? `
              <div class="cornell-fold-overlay" id="cornell-fold-overlay">
                <div class="fold-overlay-box">
                  <span class="fold-icon">🙈</span>
                  <h4>Notes are Folded for Active Recall</h4>
                  <p>Read each cue question on the left and recite the explanation aloud from memory.</p>
                  <button class="btn-primary" id="btn-reveal-folded-notes">
                    👁️ Click to Check Your Memory
                  </button>
                </div>
              </div>
            ` : ''}

            <div class="notes-column-header">
              <h4>DETAILED CLASS NOTES &amp; CONCEPTUAL CHUNKS</h4>
              <span class="notes-sub">(Outlines, Definitions, Concrete Analogies, and Frameworks)</span>
            </div>

            <div class="notes-content-stream">
              ${this.renderSynthesisMarkdown(notesMarkdown)}
            </div>
          </div>
        </div>

        <!-- Bottom Row: Overarching Macro-Synthesis Summary -->
        <div class="cornell-summary-block">
          <div class="summary-header">
            <h4>SUMMARY &amp; ENDURING UNDERSTANDING</h4>
            <span class="summary-sub">(Brief 2-3 sentence cognitive synthesis answering: "What is the core takeaway?")</span>
          </div>
          <div class="summary-text-box">
            <p>${this.simpleMarkdown(summaryText)}</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generates formatted Microsoft Word (.doc) Cornell Note Sheet
   */
  exportCornellToWord() {
    const doc = this.currentDoc;
    const analysis = this.currentAnalysis;
    if (!doc || !analysis) {
      showToast('Please open or analyze a document first.', 'warning');
      return;
    }

    const md = analysis.markdown || '';
    const dateFormatted = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Extract Summary (v1 TL;DR + legacy Macro-Synthesis)
    let summaryText = 'Distill core ideas into an enduring understanding.';
    const sumMatch = md.match(/(?:TL;DR|Macro-Synthesis)[^\n:]*:\*\*\s*([^\n]+)/i);
    if (sumMatch) summaryText = sumMatch[1];

    // Extract Cues
    const cues = [];
    const cueMatches = md.matchAll(/(?:Active Recall Cue Questions|Recall Cues)[^\n]*\n([\s\S]*?)(?=### 2\.|$)/gi);
    for (const match of cueMatches) {
      const lines = match[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•') || /^\d+\./.test(l.trim()));
      lines.forEach(l => {
        const clean = l.replace(/^[-•\d.]\s*/, '').trim();
        if (clean) cues.push(clean);
      });
    }
    if (cues.length === 0) {
      cues.push('What are the foundational principles of this text?');
      cues.push('How does this apply to classroom instruction and assessment?');
      cues.push('What are common misconceptions students have?');
    }

    // Extract Notes
    let notesSnippet = '';
    const chunksMatch = md.match(/### 2\. 🧩 Structured Concept Chunks[\s\S]*?(?=### 4\.|$)/);
    if (chunksMatch) {
      notesSnippet = chunksMatch[0];
    } else {
      notesSnippet = md;
    }

    const wordHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" 
            xmlns:w="urn:schemas-microsoft-com:office:word" 
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>Cornell Note Study Sheet - ${this.escapeHtml(doc.filename)}</title>
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.35; color: #1a1a1a; margin: 20px; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1.5pt solid #3B6347; }
          .header-table td { padding: 6px 10px; font-size: 10pt; border: 0.5pt solid #ccc; }
          .header-table th { background-color: #F4F7F4; color: #3B6347; font-weight: bold; text-align: left; padding: 6px 10px; border: 0.5pt solid #ccc; font-size: 10pt; }
          
          .cornell-main-table { width: 100%; border-collapse: collapse; border: 2pt solid #3B6347; }
          .col-cues { width: 30%; vertical-align: top; background-color: #FAFBF9; border-right: 2pt solid #3B6347; padding: 14px; }
          .col-notes { width: 70%; vertical-align: top; background-color: #FFFFFF; padding: 14px; }
          
          .section-title { font-size: 11pt; font-weight: bold; text-transform: uppercase; color: #3B6347; border-bottom: 1pt solid #3B6347; padding-bottom: 4px; margin-bottom: 10px; }
          .cue-box { margin-bottom: 14px; background-color: #F0F4F1; border-left: 3pt solid #3B6347; padding: 6px 8px; font-size: 9.5pt; }
          
          .row-summary { background-color: #FAF8F3; border-top: 2pt solid #3B6347; padding: 12px 14px; }
          .summary-title { font-size: 11pt; font-weight: bold; color: #BF5F3E; text-transform: uppercase; margin-bottom: 5px; }
          .summary-body { font-size: 10pt; color: #222; font-style: italic; }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <th width="20%">SUBJECT / COURSE:</th>
            <td width="30%">Pre-Service Professional Education</td>
            <th width="20%">DATE:</th>
            <td width="30%">${dateFormatted}</td>
          </tr>
          <tr>
            <th>TOPIC / MODULE:</th>
            <td><strong>${this.escapeHtml(doc.filename.replace(/\.[^/.]+$/, ''))}</strong></td>
            <th>DOCUMENT SOURCE:</th>
            <td>${doc.fileType} (${doc.totalUnits} ${doc.unitLabel})</td>
          </tr>
        </table>

        <table class="cornell-main-table">
          <tr>
            <td class="col-cues">
              <div class="section-title">RECALL CUES &amp; PROMPTS</div>
              <p style="font-size: 8.5pt; color: #666; margin-bottom: 12px;">(Self-quizzing triggers &amp; key terms)</p>
              ${cues.map((c, i) => `
                <div class="cue-box">
                  <strong>Q${i + 1}:</strong> ${this.escapeHtml(c)}
                </div>
              `).join('')}
            </td>
            <td class="col-notes">
              <div class="section-title">DETAILED CLASSROOM NOTES &amp; CONCEPTS</div>
              <p style="font-size: 8.5pt; color: #666; margin-bottom: 12px;">(Outlines, analogies, and core definitions)</p>
              <div style="font-size: 10pt; line-height: 1.45;">
                ${this.simpleMarkdown(notesSnippet)}
              </div>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="row-summary">
              <div class="summary-title">SUMMARY &amp; ENDURING UNDERSTANDING</div>
              <div class="summary-body">${this.escapeHtml(summaryText)}</div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const cleanFilename = doc.filename.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const blob = new Blob([wordHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cleanFilename}_Cornell_Notes.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('📄 Cornell Study Sheet downloaded as Word (.doc) file!', 'success');
  }

  renderSynthesisMarkdown(md) {
    if (!md) return '<p class="empty-text">No analysis available.</p>';

    let html = md;

    // Convert Markdown tables to styled HTML tables
    html = html.replace(/\|(.+)\|\n\|(?:\s*[-:]+[-| :]*)\|\n((?:\|.*\|\n?)*)/g, (match, headerRow, bodyRows) => {
      const headers = headerRow.split('|').map(h => h.trim()).filter(Boolean);
      const rows = bodyRows.trim().split('\n').map(row => {
        const cells = row.split('|').map(c => c.trim()).filter(Boolean);
        return `<tr>${cells.map(c => `<td>${this.simpleMarkdown(c)}</td>`).join('')}</tr>`;
      }).join('');

      return `
        <div class="pedagogical-table-wrapper">
          <table class="contrastive-matrix-table">
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    });

    // Headings to rich cards
    html = html.replace(/### (1\. 🎓 Cornell Synthesis[\s\S]*?)(?=### 2\.|$)/, (m, c) => {
      return `<div class="pedagogical-card card-cornell card-open-default"><h3 class="card-header-cornell">1. 🎓 Cornell Synthesis &amp; Active Cues</h3><div class="card-body-content">${this.simpleMarkdown(c.replace('1. 🎓 Cornell Synthesis & Active Cues', ''))}</div></div>`;
    });

    html = html.replace(/### (2\. 🧩 Structured Concept Chunks[\s\S]*?)(?=### 3\.|$)/, (m, c) => {
      return `<details class="pedagogical-card card-chunks card-collapsible" open><summary class="card-summary-header card-header-chunks">2. 🧩 Structured Concept Chunks</summary><div class="card-body-content">${this.renderTermBankSection(c.replace('2. 🧩 Structured Concept Chunks', ''), md)}</div></details>`;
    });

    html = html.replace(/### (3\. 🧑‍🏫 "Teach It Simply"[\s\S]*?)(?=### 4\.|$)/, (m, c) => {
      return `<details class="pedagogical-card card-feynman card-collapsible"><summary class="card-summary-header card-header-feynman">3. 🧑‍🏫 "Teach It Simply" (Classroom Analogy)</summary><div class="card-body-content">${this.simpleMarkdown(c.replace('3. 🧑‍🏫 "Teach It Simply" (Classroom Translation)', ''))}</div></details>`;
    });

    html = html.replace(/### (4\. ⚖️ Contrastive Analysis Matrix[\s\S]*?)(?=### 5\.|$)/, (m, c) => {
      return `<details class="pedagogical-card card-contrastive card-collapsible"><summary class="card-summary-header card-header-contrastive">4. ⚖️ Contrastive Analysis Matrix</summary><div class="card-body-content">${this.simpleMarkdown(c.replace('4. ⚖️ Contrastive Analysis Matrix', ''))}</div></details>`;
    });

    html = html.replace(/### (5\. 🎯 Licensure[\s\S]*?)$/, (m, c) => {
      return `
        <details class="pedagogical-card card-retrieval card-collapsible" open>
          <summary class="card-summary-header card-header-retrieval">5. 🎯 Licensure (LET) Retrieval Practice</summary>
            <button class="btn-primary btn-save-questions-to-reviewer" id="btn-save-questions-to-reviewer" title="Save MCQs + term drills to your LET reviewer deck (spaced 1d / 3d / 7d)">
              <span>➕ Save to LET Reviewer</span>
            <span class="retrieval-save-hint">Save drills to LET Reviewer below</span>
            <button class="btn-primary btn-save-questions-to-reviewer" id="btn-save-questions-to-reviewer" title="Save MCQs + term drills to your LET reviewer deck (spaced 1d / 3d / 7d)">
              <span>Save to LET Reviewer</span>
            </button>
          </summary>
          <div class="card-body-content retrieval-body">${this.renderInteractiveQuiz(c)}</div>
          <p class="verify-counter-line" id="cite-verify-counter" aria-live="polite">No claim verified yet - tap a [Page X] badge to check one.</p>
        </details>
      `;
    });

    return html;
  }

  simpleMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[((?:Page|Slide|Section|Unit)\s+(\d+)(?::\s*([^\]]+))?|Primary Text Extraction)\]/gi, (match, fullText, num, detail) => {
        if (!num) {
          return '<span class="citation-pill citation-primary-badge" title="Grounded verbatim from document text">📌 Primary Source</span>';
        }
        const unitType = (fullText.match(/^(?:Page|Slide|Section|Unit)/i) || ['Page'])[0];
        const capitalizedType = unitType.charAt(0).toUpperCase() + unitType.slice(1).toLowerCase();
        const cleanDetail = detail ? detail.trim() : '';
        const labelText = `${capitalizedType} ${num}${cleanDetail ? ': ' + cleanDetail : ''}`;
        const escapedLabel = this.escapeHtml(labelText);
        const escapedDetail = this.escapeHtml(cleanDetail);

        return `<button type="button" class="citation-pill citation-jump-btn" data-target-unit="${num}" data-unit-type="${capitalizedType}" data-detail="${escapedDetail}" title="Jump to ${capitalizedType} ${num} in source transcript">
          <span class="citation-pin">📌</span>
          <span class="citation-text">${escapedLabel}</span>
          <span class="citation-jump-arrow" aria-hidden="true">↗</span>
        </button>`;
      })
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '<br><br>');
  }

  renderInteractiveQuiz(rawQuizText) {
    // v1.3: Section 5 has Part A (2 scenario MCQs) + Part B (3 fill-ins) + Part C (Study Next).
    // Split on both **Question N:** and **Fill-in N:** markers, keep legacy behavior for old 3-MCQ output.
    const blocks = [];
    const splitter = /\*\*(Question \d+|Fill-in \d+):\*\*/g;
    let lastIdx = 0;
    let lastLabel = null;
    let m;
    while ((m = splitter.exec(rawQuizText)) !== null) {
      if (lastLabel !== null) {
        blocks.push({ label: lastLabel, body: rawQuizText.slice(lastIdx, m.index) });
      }
      lastLabel = m[1];
      lastIdx = m.index + m[0].length;
    }
    if (lastLabel !== null) {
      blocks.push({ label: lastLabel, body: rawQuizText.slice(lastIdx) });
    }
    const questionBlocks = blocks.length > 0
      ? blocks
      : rawQuizText.split(/\*\*Question \d+:\*\*/g).filter(b => b.trim().length > 0).map((body, i) => ({ label: `Question ${i + 1}`, body }));

    // Study Next recommendation → call-to-action card (Part C)
    let studyNextHtml = '';
    const studyNextMatch = rawQuizText.match(/\*\*Study Next:\*\*\s*([^\n]+)/i);
    if (studyNextMatch) {
      const reco = studyNextMatch[1].trim();
      const typeMatch = reco.match(/\b(Familiarize|Understand|Memorize)\b/i);
      const type = typeMatch ? typeMatch[1] : 'Memorize';
      studyNextHtml = `
        <div class=\"study-next-card\" data-study-type=\"${type.toLowerCase()}\">
          <div class=\"study-next-head\">
            <span class=\"study-next-badge\">🔁 Study Next — ${type}</span>
          </div>
          <p class=\"study-next-reco\">${this.simpleMarkdown(reco)}</p>
          <div class=\"study-next-actions\">
            <button type=\"button\" class=\"btn-study-next btn-study-next-familiarize\" title=\"Cover the Term Bank and recall each meaning aloud\">🙈 Test Term Bank</button>
            <button type=\"button\" class=\"btn-study-next btn-study-next-push\" title=\"Import all MCQs + fill-in drills into your LET Reviewer (spaced 1d / 3d / 7d)\">📥 Push All Drills</button>
            <button type=\"button\" class=\"btn-study-next btn-study-next-misses\" style=\"display:none\" title=\"Import only the terms you starred as misses\">⭐ Push Missed Terms (0)</button>
          </div>
        </div>`;
    }

    return this._renderSynthesisCards(questionBlocks, rawQuizText) + studyNextHtml;
  }


  /**
   * Renders the MCQ + fill-in drill cards for Section 5 (Part A + Part B).
   * Extracted from renderInteractiveQuiz so the Study Next card can append after it.
   */
  _renderSynthesisCards(questionBlocks, rawQuizText) {
    let fillCounter = 0;
    const cards = questionBlocks.map((item, idx) => {
      const isFillIn = /^Fill-in/i.test(item.label || '');
      const block = item.body || '';
      if (isFillIn) {
        fillCounter += 1;
        const fNum = fillCounter;
        const ansMatch = block.match(/\*\*Answer:\*\*\s*([^\n]+)/i);
        const whyMatch = block.match(/\*\*Why:\*\*\s*([\s\S]*?)(?=(?:\*\*(?:Question|Fill-in|Study Next)|$))/i);
        const answer = ansMatch ? ansMatch[1].trim() : 'See Term Bank';
        const why = whyMatch ? whyMatch[1].trim() : 'Recall the in-text meaning from the Term Bank.';
        const stem = block
          .replace(/\*\*Answer:\*\*[\s\S]*$/, '')
          .trim();
        return `
        <div class="quiz-question-card quiz-fill-in-card" data-qindex="fill-${fNum}">
          <div class="question-header">
            <span class="q-badge">Fill-in ${fNum}</span>
            <span class="q-type-label">Term Drill</span>
          </div>
          <div class="question-body">
            ${this.simpleMarkdown(stem)}
          </div>
          <div class="question-actions">
            <button class="btn-reveal-answer" data-target="fill-rationale-${fNum}">
              👁️ <span>Reveal Answer &amp; Why</span>
            </button>
          </div>
          <div class="question-rationale-box" id="fill-rationale-${fNum}" style="display: none;">
            <div class="rationale-answer-pill">Answer: ${this.simpleMarkdown(answer)}</div>
            <p class="rationale-text"><strong>Why:</strong> ${this.simpleMarkdown(why)}</p>
          </div>
        </div>
        `;
      }
      const qNum = idx + 1;
      const answerMatch = block.match(/\*\*Correct Answer:\*\*\s*([A-D])/i);
      const answer = answerMatch ? answerMatch[1].toUpperCase() : 'A';
      const rationaleMatch = block.match(/\*\*Pedagogical Rationalization:\*\*\s*([\s\S]*?)(?=(?:\*\*(?:Question|Fill-in|Study Next)|$))/i);
      const rationale = rationaleMatch ? rationaleMatch[1].trim() : 'Active recall tests deep conceptual alignment.';

      const promptAndOptions = block
        .replace(/\*\*Correct Answer:\*\*[\s\S]*$/, '')
        .trim();

      return `
        <div class="quiz-question-card" data-qindex="${qNum}">
          <div class="question-header">
            <span class="q-badge">Question ${qNum}</span>
            <span class="q-type-label">LET Scenario</span>
          </div>
          <div class="question-body">
            ${this.simpleMarkdown(promptAndOptions)}
          </div>
          <div class="question-actions">
            <button class="btn-reveal-answer" data-target="rationale-${qNum}">
              👁️ <span>Reveal Answer &amp; Rationalization</span>
            </button>
          </div>
          <div class="question-rationale-box" id="rationale-${qNum}" style="display: none;">
            <div class="rationale-answer-pill">Correct Answer: Option ${answer}</div>
            <p class="rationale-text"><strong>Why this is correct:</strong> ${this.simpleMarkdown(rationale)}</p>
          </div>
        </div>
      `;
    }).join('');
    return cards;
  }

  /**
   * Parses current synthesis Section 5 into reviewer-ready question items
   * (Part A scenario MCQs + Part B term fill-ins). Legacy 3-MCQ output still parses.
   */
  collectReviewerQuestions() {
    const md = this.currentAnalysis?.markdown || '';
    const qSection = md.split(/### 5\. 🎯 Licensure/i)[1] || '';
    const itemSplitter = /\*\*(Question \d+|Fill-in \d+):\*\*/g;
    const rawItems = [];
    let lastLabel = null;
    let lastPos = 0;
    let im;
    while ((im = itemSplitter.exec(qSection)) !== null) {
      if (lastLabel !== null) rawItems.push({ label: lastLabel, block: qSection.slice(lastPos, im.index) });
      lastLabel = im[1];
      lastPos = im.index + im[0].length;
    }
    if (lastLabel !== null) rawItems.push({ label: lastLabel, block: qSection.slice(lastPos) });
    if (rawItems.length === 0) {
      qSection.split(/\*\*Question \d+:\*\*/g).filter(b => b.trim().length > 0)
        .forEach((block, i) => rawItems.push({ label: `Question ${i + 1}`, block }));
    }

    return rawItems.map(({ label, block }) => {
      if (/^Fill-in/i.test(label)) {
        const ansMatch = block.match(/\*\*Answer:\*\*\s*([^\n]+)/i);
        const whyMatch = block.match(/\*\*Why:\*\*\s*([\s\S]*?)(?=(?:\*\*(?:Question|Fill-in|Study Next)|$))/i);
        const snippet = (block.replace(/\*\*Answer:\*\*[\s\S]*$/, '').trim() || '').slice(0, 500);
        return {
          question: `${label}: ${snippet}`,
          front: `${label}: ${snippet}`,
          answer: ansMatch ? ansMatch[1].trim() : 'See Term Bank',
          correctAnswer: ansMatch ? ansMatch[1].trim() : '',
          rationalization: whyMatch ? whyMatch[1].trim() : 'Recall the in-text meaning from the Term Bank.',
          explanation: whyMatch ? whyMatch[1].trim() : '',
          options: [],
          cardKind: 'TERM_FILL_IN'
        };
      }
      const ansMatch = block.match(/\*\*Correct Answer:\*\*\s*([A-D])/i);
      const rationaleMatch = block.match(/\*\*Pedagogical Rationalization:\*\*\s*([\s\S]*?)(?=(?:\*\*(?:Question|Fill-in|Study Next)|$))/i);
      const prompt = block.replace(/\*\*Correct Answer:\*\*[\s\S]*$/, '').trim();

      const options = [];
      const optLines = block.match(/- [A-D]\) .+/g);
      if (optLines) {
        optLines.forEach(l => options.push(l.replace(/^- /, '')));
      }

      return {
        question: prompt,
        front: prompt,
        prompt,
        options,
        correctAnswer: ansMatch ? ansMatch[1].toUpperCase() : 'A',
        rationale: rationaleMatch ? rationaleMatch[1].trim() : 'Active recall practice',
        rationalization: rationaleMatch ? rationaleMatch[1].trim() : 'Active recall practice',
        explanation: rationaleMatch ? rationaleMatch[1].trim() : '',
        cardKind: 'SCENARIO_MCQ'
      };
    });
  }

  /**
   * Builds TERM_FILL_IN cards only for the terms the learner starred as misses
   * while self-testing the Term Bank (push-the-misses flow).
   */
  buildMissedTermCards() {
    const cards = [];
    this.termBankMisses.forEach((meta, term) => {
      cards.push({
        cardKind: 'TERM_FILL_IN',
        question: `Define: ${term}`,
        front: `Define: ${term}`,
        answer: term,
        correctAnswer: term,
        rationalization: `${meta.meaning || 'Recall the in-text meaning.'}${meta.anchor ? ' — ' + meta.anchor : ''}`,
        explanation: meta.meaning || '',
        options: []
      });
    });
    return cards;
  }

  /**
   * Dispatches reviewer import + flips the button into a saved state.
   */
  dispatchReviewerImport(questions) {
    if (!questions || questions.length === 0) return;
    const event = new CustomEvent('pedagogo:save-questions-to-reviewer', {
      detail: {
        questions,
        title: this.currentDoc?.filename || 'Uploaded Reading Document'
      }
    });
    window.dispatchEvent(event);
  }

  /**
   * Refreshes the "Push Missed Terms (N)" button visibility + count.
   */
  updateMissedPushButton() {
    const btn = document.getElementById('btn-study-next-misses');
    if (!btn) return;
    const n = this.termBankMisses.size;
    btn.style.display = n > 0 ? '' : 'none';
    btn.innerHTML = `⭐ <span>Push Missed Terms (${n})</span>`;
  }

  /**
   * v1.3 Term Bank — the "Familiarize FIRST" phase of the reading desk.
   * Parses the 4-column markdown table (Term | In-Text Meaning | Memory Anchor | Source)
   * that lives inside Section 2 and renders it as an interactive cover-to-recall grid.
   * If no term bank table is present, renders the section content verbatim.
   */
  renderTermBankSection(convertedHtml, rawMd) {
    const raw = (rawMd || '').match(/### 2\. 🧩 Structured Concept Chunks[\s\S]*?(?=### 3\.|$)/);
    const sectionRaw = raw ? raw[0] : '';

    // Match only term rows: | **Term** | meaning | anchor | [citation] |  (term may or may not be bolded)
    const rows = [];
    const rowRe = /^\|\s*(?:\*\*)?(.+?)(?:\*\*)?\s*\|(.+?)\|(.+?)\|(.+?)\|\s*$/gm;
    let r;
    while ((r = rowRe.exec(sectionRaw)) !== null) {
      const term = r[1].trim();
      const meaning = r[2].trim();
      const anchor = r[3].trim();
      const source = r[4].trim();
      // Skip header / separator rows
      if (!term || /^(In-Text Meaning|Term|:?-)/i.test(term)) continue;
      if (/^\s*:?-/.test(meaning) && /^\s*:?-/.test(anchor)) continue;
      rows.push({ term, meaning, anchor, source, start: r.index, end: r.index + r[0].length });
    }

    if (rows.length < 3) {
      return this.simpleMarkdown(convertedHtml);
    }

    const firstStart = rows[0].start;
    const lastEnd = rows[rows.length - 1].end;

    // Trust fix: beforeMarkdown still contained the "### 2." heading, the
    // Part A intro, and the raw "| Term | In-Text Meaning ..." header +
    // "| :--- |" separator lines. simpleMarkdown() has no table handling, so
    // those leaked as visible pipe-garbage + a duplicate heading inside the
    // card. Strip them before rendering.
    const beforeMarkdown = sectionRaw.slice(0, firstStart)
      .split('\n')
      .filter(l => {
        const t = l.trim();
        if (!t) return false;
        if (/^###?\s*\d/.test(t)) return false;
        if (/^\|/.test(t)) return false;
        return true;
      })
      .join('\n')
      .trim();
    const afterMarkdown = sectionRaw.slice(lastEnd).trim();

    const termRowsHtml = rows.map((t, i) => {
      const sourceHtml = this.simpleMarkdown(t.source);
      const escTerm = this.escapeHtml(t.term);
      return `
        <div class="term-bank-row">
          <div class="term-bank-term">
            <button type="button" class="btn-term-miss" data-term="${escTerm}" data-meaning="${this.escapeHtml(t.meaning)}" data-anchor="${this.escapeHtml(t.anchor)}" aria-pressed="false" title="Mark this term as a miss if you couldn't recall its meaning">☆</button>
            <span class="term-bank-term-label">${escTerm}</span>
          </div>
          <div class="term-bank-meaning">${this.simpleMarkdown(t.meaning)}</div>
          <div class="term-bank-anchor">${this.simpleMarkdown(t.anchor)}</div>
          <div class="term-bank-source">${sourceHtml}</div>
        </div>`;
    }).join('');

    const beforeHtml = beforeMarkdown ? `<div class="term-bank-intro">${this.simpleMarkdown(beforeMarkdown)}</div>` : '';
    const afterHtml = afterMarkdown ? `<div class="term-bank-after">${this.simpleMarkdown(afterMarkdown)}</div>` : '';

    return `
      <div class="term-bank-block">
        ${beforeHtml}
        <div class="term-bank-toolbar">
          <span class="term-bank-hint">Familiarize first — cover the meanings, recall each term aloud, then reveal.</span>
          <button type="button" class="btn-term-bank-cover" id="btn-term-bank-cover" aria-pressed="false">🙈 <span>Cover Meanings — Test Yourself</span></button>
        </div>
        <div class="term-bank-wrap" id="term-bank-wrap">
          <div class="term-bank-grid term-bank-grid-head">
            <span>Term</span><span>In-Text Meaning</span><span>Memory Anchor</span><span>Source</span>
          </div>
          ${termRowsHtml}
        </div>
        ${afterHtml}
      </div>`;
  }

  renderVerbatimUnits(doc) {
    const query = this.searchQuery.toLowerCase().trim();
    const allUnits = doc.units || [];

    // Trust fix: empty parse (TXT/DOCX with no sections) showed a blank panel
    // with zero feedback. Surface an actionable empty state instead.
    if (allUnits.length === 0) {
      return `<div class="verbatim-empty-state">
        <div class="verbatim-empty-icon">📄</div>
        <p class="verbatim-empty-title">No extractable text found in this file</p>
        <p class="verbatim-empty-desc">The parser could not detect any readable sections. If this is an image-only scan, switch to 🖼️ Original above — or re-upload as a text-based <strong>.docx</strong> / searchable PDF.</p>
      </div>`;
    }

    // Sprint B: lazy-render. Search bypasses pagination; otherwise render up to the visible count.
    const maxShown = query ? allUnits.length : Math.max(1, this.verbatimVisibleCount || 25);
    const visible = allUnits.slice(0, maxShown);
    const hasMore = allUnits.length > maxShown;
    const html = visible.map(unit => {
      let content = this.escapeHtml(unit.text);

      if (query) {
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        content = content.replace(regex, '<mark class="search-highlight">$1</mark>');
      }

      return `
        <div class="verbatim-unit-card" id="unit-card-${unit.unitNumber}" data-unit="${unit.unitNumber}">
          <div class="verbatim-unit-header">
            <span class="unit-marker">${unit.title}</span>
            <button class="btn-copy-unit" data-unit-text="${encodeURIComponent(unit.text)}" title="Copy this unit">📋 Copy</button>
          </div>
          <div class="verbatim-unit-text">${content || '<em class="empty-unit">No text found on this unit.</em>'}</div>
        </div>
      `;
    }).join('');

    return html + (hasMore ? `
      <button type="button" class="btn-subtle btn-verbatim-load-more" id="btn-verbatim-load-more" data-next="${maxShown + 25}">
        ↓ Load more (${allUnits.length - maxShown} more ${(doc.unitLabel || 'Pages').toLowerCase()})
      </button>` : '');
  }

  bindUploadEvents() {
    const dropzone = document.getElementById('document-dropzone');
    const fileInput = document.getElementById('file-document-input');
    const btnBrowse = document.getElementById('btn-browse-file');
    const btnSample = document.getElementById('btn-load-sample-doc');
    const btnOpenGemini = document.getElementById('btn-open-gemini-modal');

    if (btnBrowse && fileInput) {
      btnBrowse.addEventListener('click', () => fileInput.click());
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.processUploadedFile(e.target.files[0]);
        }
      });
    }

    if (dropzone) {
      ['dragenter', 'dragover'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.processUploadedFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (btnSample) {
      btnSample.addEventListener('click', () => {
        const sample = DocumentSummarizer.getBuiltinSamples()[0];
        this.loadSample(sample);
      });
    }

    if (btnOpenGemini) {
      btnOpenGemini.addEventListener('click', () => {
        this.openGeminiModal();
      });
    }

    // Sprint B: resume-strip session cards (upload state)
    this.container.querySelectorAll('.btn-resume-session').forEach(btn => {
      btn.addEventListener('click', () => this.resumeSession(btn.dataset.resume));
    });
    this.container.querySelectorAll('.btn-resume-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteSession(btn.dataset.resumeDelete);
        showToast('Session forgotten from this browser.', 'info');
      });
    });
  }

  bindWorkspaceEvents() {
    const btnBack = document.getElementById('btn-back-upload');
    const subtabSynthesis = document.getElementById('btn-subtab-synthesis');
    const subtabCornell = document.getElementById('btn-subtab-cornell');
    const subtabVerbatim = document.getElementById('btn-subtab-verbatim');
    const searchInput = document.getElementById('verbatim-search-input');
    const btnClearSearch = document.getElementById('btn-clear-search');
    const btnCopy = document.getElementById('btn-copy-reading-text');
    const btnPrint = document.getElementById('btn-print-reading-guide');
    const btnToggleFold = document.getElementById('btn-toggle-fold-notes');
    const btnToggleFoldInline = document.getElementById('btn-toggle-fold-inline');
    const btnRevealFolded = document.getElementById('btn-reveal-folded-notes');
    const btnExportCornell = document.getElementById('btn-export-cornell-doc');

    if (btnBack) {
      btnBack.addEventListener('click', () => {
        this.currentDoc = null;
        this.currentAnalysis = null;
        this.searchQuery = '';
        this.verbatimView = 'transcript';
        this.revokeOriginalObjectUrl();
        this.render();
      });
    }

    if (subtabSynthesis) {
      subtabSynthesis.addEventListener('click', () => {
        this.switchSubTab('synthesis');
      });
    }

    if (subtabCornell) {
      subtabCornell.addEventListener('click', () => {
        this.switchSubTab('cornell');
      });
    }

    if (subtabVerbatim) {
      subtabVerbatim.addEventListener('click', () => {
        // 10-persona audit F2: count DIRECT Verbatim opens (Cora-style readers
        // who read the transcript without ever tapping a citation — those are
        // already counted by citation_tap, so never log both for one action).
        try { ReadingTelemetry.log('verbatim_open'); } catch (e) {}
        this.switchSubTab('verbatim');
      });
    }

    // Dual-view Verbatim toggle (delegated: buttons re-render with the panel)
    this.container.querySelectorAll('[data-verbatim-view]').forEach(btn => {
      btn.addEventListener('click', () => this.setVerbatimView(btn.dataset.verbatimView));
    });

    const btnToggleSplit = document.getElementById('btn-toggle-split-view');
    if (btnToggleSplit) {
      btnToggleSplit.addEventListener('click', () => {
        this.toggleSplitView();
      });
    }

    const btnDeskBackup = document.getElementById('btn-desk-backup');
    if (btnDeskBackup) {
      btnDeskBackup.addEventListener('click', () => this.exportDeskBackup());
    }

    // Delegated click handler for interactive citation buttons
    this.container.addEventListener('click', (e) => {
      const jumpBtn = e.target.closest('.citation-jump-btn');
      if (jumpBtn) {
        e.preventDefault();
        e.stopPropagation();
        const targetUnit = parseInt(jumpBtn.dataset.targetUnit, 10);
        const unitType = jumpBtn.dataset.unitType || 'Page';
        const detail = jumpBtn.dataset.detail || '';
        this.citationTapCount = (this.citationTapCount || 0) + 1;
        try { ReadingTelemetry.log('citation_tap'); } catch (e) {}
        this.updateCitationCounter();
        this.dismissGroundTruthGuard(true);
        this.jumpToUnit(targetUnit, unitType, detail);
      }
    });

    // Fold / Unfold active recall toggle
    const handleToggleFold = () => {
      this.isCornellFolded = !this.isCornellFolded;
      this.persistSession();
      this.render();
      if (this.isCornellFolded) {
        showToast('🙈 Notes folded! Use the cues on the left to test your active recall.', 'info');
      }
    };

    if (btnToggleFold) btnToggleFold.addEventListener('click', handleToggleFold);
    if (btnToggleFoldInline) btnToggleFoldInline.addEventListener('click', handleToggleFold);
    if (btnRevealFolded) btnRevealFolded.addEventListener('click', handleToggleFold);

    // Export Word .doc
    if (btnExportCornell) {
      btnExportCornell.addEventListener('click', () => {
        this.exportCornellToWord();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        const stream = document.getElementById('verbatim-stream');
        if (stream && this.currentDoc) {
          stream.innerHTML = this.renderVerbatimUnits(this.currentDoc);
          this.bindCopyUnitButtons();
        }
      });
    }

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        this.searchQuery = '';
        this.render();
      });
    }

    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        const textToCopy = this.activeSubTab === 'synthesis' 
          ? (this.currentAnalysis?.markdown || '')
          : (this.currentDoc?.rawText || '');
        navigator.clipboard.writeText(textToCopy).then(() => {
          btnCopy.innerHTML = '✓ <span>Copied!</span>';
          setTimeout(() => { btnCopy.innerHTML = '📋 <span>Copy</span>'; }, 2000);
        });
      });
    }

    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        window.print();
      });
    }

    const btnSaveQuestions = document.getElementById('btn-save-questions-to-reviewer');
    if (btnSaveQuestions) {
      btnSaveQuestions.addEventListener('click', () => {
        const parsedQuestions = this.collectReviewerQuestions();
        if (parsedQuestions.length === 0) {
          showToast('No practice items found in this analysis.', 'info');
          return;
        }
        this.dispatchReviewerImport(parsedQuestions);

        btnSaveQuestions.innerHTML = '✓ <span>Saved to LET Reviewer!</span>';
        setTimeout(() => {
          btnSaveQuestions.innerHTML = '<span>➕ Save to LET Reviewer</span>';
        }, 2200);
      });
    }

    // Sprint B: choose-summary CTA + Verbatim lazy-load
    const btnSummarizeMain = document.getElementById('btn-summarize-main');
    if (btnSummarizeMain) {
      btnSummarizeMain.addEventListener('click', () => {
        try { ReadingTelemetry.log('summarize_cta_click'); } catch (e) {}
        this.openSummaryChooser();
      });
    }
    document.querySelectorAll('[id^="btn-summarize-empty-"]').forEach(b => {
      b.addEventListener('click', () => this.openSummaryChooser());
    });

    const btnLoadMore = document.getElementById('btn-verbatim-load-more');
    if (btnLoadMore) {
      btnLoadMore.addEventListener('click', () => {
        this.verbatimVisibleCount = parseInt(btnLoadMore.dataset.next, 10) || this.verbatimVisibleCount + 25;
        const stream = document.getElementById('verbatim-stream');
        if (stream && this.currentDoc) {
          stream.innerHTML = this.renderVerbatimUnits(this.currentDoc);
          this.bindCopyUnitButtons();
        }
      });
    }

    // Unit jump pills
    document.querySelectorAll('.unit-jump-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.unit-jump-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const unitNum = pill.dataset.unit;
        let changed = false;
        if (unitNum === 'all') {
          this.verbatimVisibleCount = (this.currentDoc?.units || []).length;
          changed = true;
        } else if (parseInt(unitNum, 10) > this.verbatimVisibleCount) {
          this.verbatimVisibleCount = parseInt(unitNum, 10);
          changed = true;
        }
        if (changed) {
          const stream = document.getElementById('verbatim-stream');
          if (stream && this.currentDoc) {
            stream.innerHTML = this.renderVerbatimUnits(this.currentDoc);
            this.bindCopyUnitButtons();
          }
        }
        document.querySelectorAll('.verbatim-unit-card').forEach(card => {
          card.style.display = unitNum === 'all' || card.dataset.unit === unitNum ? 'block' : 'none';
        });
      });
    });

    // Reveal answer buttons
    document.querySelectorAll('.btn-reveal-answer').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const rationaleEl = document.getElementById(targetId);
        if (rationaleEl) {
          const isHidden = rationaleEl.style.display === 'none';
          rationaleEl.style.display = isHidden ? 'block' : 'none';
          btn.innerHTML = isHidden ? '🙈 <span>Hide Answer</span>' : '👁️ <span>Reveal Answer & Rationalization</span>';
        }
      });
    });

    // Term Bank cover/uncover (Familiarize phase — self-test term meanings)
    const btnTermBankCover = document.getElementById('btn-term-bank-cover');
    if (btnTermBankCover) {
      btnTermBankCover.addEventListener('click', () => {
        const wrap = document.getElementById('term-bank-wrap');
        if (!wrap) return;
        const covered = wrap.classList.toggle('term-bank-covered');
        btnTermBankCover.setAttribute('aria-pressed', String(covered));
        btnTermBankCover.innerHTML = covered ? '👁️ <span>Reveal Meanings</span>' : '🙈 <span>Cover Meanings — Test Yourself</span>';
      });
    }

    // Term Bank miss-starring: mark terms you couldn't recall while covered
    document.querySelectorAll('.btn-term-miss').forEach(btn => {
      btn.addEventListener('click', () => {
        const term = btn.dataset.term;
        const row = btn.closest('.term-bank-row');
        if (!term || !row) return;
        if (this.termBankMisses.has(term)) {
          this.termBankMisses.delete(term);
          row.classList.remove('term-bank-missed');
          btn.setAttribute('aria-pressed', 'false');
          btn.textContent = '☆';
        } else {
          this.termBankMisses.set(term, { meaning: btn.dataset.meaning || '', anchor: btn.dataset.anchor || '' });
          row.classList.add('term-bank-missed');
          btn.setAttribute('aria-pressed', 'true');
          btn.textContent = '★';
        }
        this.updateMissedPushButton();
      });
    });

    // Study Next card CTA: Familiarize (Test Term Bank)
    const btnSnFamiliarize = document.getElementById('btn-study-next-familiarize');
    if (btnSnFamiliarize) {
      btnSnFamiliarize.addEventListener('click', () => {
        const wrap = document.getElementById('term-bank-wrap');
        const coverBtn = document.getElementById('btn-term-bank-cover');
        if (wrap && coverBtn && !wrap.classList.contains('term-bank-covered')) {
          coverBtn.click();
        }
        const target = wrap || document.querySelector('.card-chunks');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast('🌱 Familiarize: recall each meaning aloud. Star (★) the ones you miss!', 'info');
      });
    }

    // Study Next card CTA: Memorize (Push All Drills)
    const btnSnPush = document.getElementById('btn-study-next-push');
    if (btnSnPush) {
      btnSnPush.addEventListener('click', () => {
        const parsed = this.collectReviewerQuestions();
        if (parsed.length === 0) {
          showToast('No drills found in this analysis.', 'info');
          return;
        }
        this.dispatchReviewerImport(parsed);
        btnSnPush.innerHTML = '✓ <span>Pushed!</span>';
        setTimeout(() => { btnSnPush.innerHTML = '📥 <span>Push All Drills</span>'; }, 2200);
      });
    }

    // Study Next card CTA: Push only the missed terms
    const btnSnMisses = document.getElementById('btn-study-next-misses');
    if (btnSnMisses) {
      btnSnMisses.addEventListener('click', () => {
        if (this.termBankMisses.size === 0) return;
        const parsed = this.buildMissedTermCards();
        this.dispatchReviewerImport(parsed);
        // Clear the stars — those terms are now loaded in the reviewer's Box 1.
        this.termBankMisses.clear();
        document.querySelectorAll('.term-bank-row.term-bank-missed').forEach(row => {
          row.classList.remove('term-bank-missed');
          const star = row.querySelector('.btn-term-miss');
          if (star) { star.textContent = '☆'; star.setAttribute('aria-pressed', 'false'); }
        });
        this.updateMissedPushButton();
        btnSnMisses.innerHTML = '✓ <span>Pushed!</span>';
        setTimeout(() => { this.updateMissedPushButton(); }, 2200);
      });
    }
    this.updateMissedPushButton();

    // Upgrade Gemini pill
    const btnUpgradeGemini = document.getElementById('btn-upgrade-gemini-pill');
    const btnGuardVerify = document.getElementById('btn-guard-verify');
    if (btnGuardVerify) {
      btnGuardVerify.addEventListener('click', () => {
        try { ReadingTelemetry.log('guard_verify_click'); } catch (e) {}
        const firstCite = document.querySelector('.citation-jump-btn');
        if (firstCite) { firstCite.click(); } else { this.switchSubTab('verbatim'); showToast('No citation found — compare the top claim against the Verbatim text word-for-word.', 'info'); }
      });
    }
    const btnGuardDismiss = document.getElementById('btn-guard-dismiss');
    if (btnGuardDismiss) {
      btnGuardDismiss.addEventListener('click', () => this.dismissGroundTruthGuard());
    }
    this.updateCitationCounter();

    if (btnUpgradeGemini) {
      btnUpgradeGemini.addEventListener('click', () => {
        this.openGeminiModal();
      });
    }

    this.bindCopyUnitButtons();
  }

  bindCopyUnitButtons() {
    document.querySelectorAll('.btn-copy-unit').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = decodeURIComponent(btn.dataset.unitText || '');
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = '✓ Copied';
          setTimeout(() => { btn.textContent = '📋 Copy'; }, 1800);
        });
      });
    });
  }

  setVerbatimView(view) {
    this.verbatimView = view === 'original' ? 'original' : 'transcript';
    this.ensureOriginalObjectUrl();
    this.persistSession();
    this.render();
  }

  revokeOriginalObjectUrl() {
    try {
      if (this.originalObjectUrl) URL.revokeObjectURL(this.originalObjectUrl);
    } catch (e) {}
    this.originalObjectUrl = null;
  }

  ensureOriginalObjectUrl() {
    try {
      if (this.originalObjectUrl) return this.originalObjectUrl;
      const doc = this.currentDoc;
      if (!doc) return null;
      if (doc.originalObjectUrl) { this.originalObjectUrl = doc.originalObjectUrl; return this.originalObjectUrl; }
      const src = doc.sourceFile;
      if (this.isPreviewableBlobType(doc) && typeof URL !== 'undefined' && URL.createObjectURL && src) {
        this.originalObjectUrl = URL.createObjectURL(src);
        doc.originalObjectUrl = this.originalObjectUrl;
        return this.originalObjectUrl;
      }
      if (this.isPreviewableBlobType(doc) && doc.base64Data && typeof URL !== 'undefined' && URL.createObjectURL) {
        const bin = atob(doc.base64Data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: doc.mimeType || this.mimeForType(doc.fileType) });
        this.originalObjectUrl = URL.createObjectURL(blob);
        doc.originalObjectUrl = this.originalObjectUrl;
        return this.originalObjectUrl;
      }
      return null;
    } catch (e) { return null; }
  }

  isPreviewableBlobType(doc) {
    const t = String(doc?.fileType || '').toUpperCase();
    return t === 'PDF' || t === 'IMAGE' || t === 'TXT' || t === 'MARKDOWN';
  }

  mimeForType(fileType) {
    const t = String(fileType || '').toUpperCase();
    if (t === 'PDF') return 'application/pdf';
    if (t === 'TXT' || t === 'MARKDOWN') return 'text/plain';
    if (t === 'IMAGE') return 'image/*';
    return 'application/octet-stream';
  }

  hasOriginalContent(doc) {
    if (!doc) return false;
    const t = String(doc.fileType || '').toUpperCase();
    if (t === 'PDF' || t === 'IMAGE' || t === 'TXT' || t === 'MARKDOWN') {
      return Boolean(this.ensureOriginalObjectUrl());
    }
    if (t === 'DOCX') return Boolean((doc.formattedHtml || '').trim());
    if (t === 'PPTX') return Boolean((doc.units || []).length);
    return false;
  }

  renderOriginalView(doc) {
    const t = String(doc.fileType || '').toUpperCase();
    const url = this.ensureOriginalObjectUrl();
    if (t === 'PDF') {
      if (!url) return this.renderOriginalMissing(doc);
      return `<div class="original-frame-wrap">
        <iframe class="original-frame" title="Original PDF" src="${url}" loading="lazy"></iframe>
        <p class="original-hint">Original layout, read-only. Search, copy, and citation jumps live in Transcript.</p>
      </div>`;
    }
    if (t === 'IMAGE') {
      const src = url || (doc.base64Data ? `data:${doc.mimeType || 'image/jpeg'};base64,${doc.base64Data}` : null);
      if (!src) return this.renderOriginalMissing(doc);
      return `<div class="original-image-wrap">
        <img class="original-image" src="${src}" alt="Original">
        <p class="original-hint">Original visual, as uploaded.</p>
      </div>`;
    }
    if (t === 'TXT' || t === 'MARKDOWN') {
      if (!url) return this.renderOriginalMissing(doc);
      return `<div class="original-frame-wrap">
        <iframe class="original-frame original-text-frame" title="Original text" src="${url}" loading="lazy"></iframe>
        <p class="original-hint">Original plain text, untouched.</p>
      </div>`;
    }
    if (t === 'DOCX') return this.renderOriginalDocx(doc);
    if (t === 'PPTX') return this.renderOriginalSlides(doc);
    return this.renderOriginalMissing(doc);
  }

  renderOriginalMissing(doc) {
    return `<div class="original-empty">
      <p><strong>Original isn't available in this restored session.</strong></p>
      <p class="original-hint">Previews live in memory only for privacy — re-upload to see the original again. Transcript + summary are intact.</p>
      <button type="button" class="btn-subtle" data-verbatim-view="transcript">Back to Transcript</button>
    </div>`;
  }

  sanitizeDocxHtml(html) {
    try {
      const tpl = document.createElement('template');
      tpl.innerHTML = String(html || '');
      tpl.content.querySelectorAll('script, style, iframe, object, embed, form, link, meta').forEach(n => n.remove());
      return tpl.innerHTML;
    } catch (e) { return ''; }
  }

  renderOriginalSlides(doc) {
    const slides = (doc.units || []).map(u => this.renderOriginalSlideCard(u)).join('');
    if (!slides.trim()) return this.renderOriginalMissing(doc);
    return `<div class="original-slides" tabindex="0">${slides}
      <p class="original-hint">Slide order, titles, bullets and speaker notes preserved; transitions and backgrounds dropped for study clarity.</p>
    </div>`;
  }

  renderOriginalSlideCard(u) {
    const raw = String(u.text || '');
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const titleLine = lines.find(l => l.startsWith('**') && l.endsWith('**'));
    const title = titleLine ? titleLine.replace(/^\*\*|\*\*$/g, '') : (u.title || `Slide ${u.unitNumber}`);
    const bullets = lines.filter(l => l.startsWith('•')).map(l => l.replace(/^•\s*/, ''));
    const noteLine = lines.find(l => /^\*?\[Speaker Note\]/i.test(l));
    const note = noteLine ? noteLine.replace(/^\*?\[Speaker Note\]\*?:?\s*/i, '') : '';
    const isVisual = /visual content \/ diagram slide/i.test(raw);
    const body = bullets.length
      ? `<ul class="original-slide-bullets">${bullets.map(b => `<li>${this.escapeHtml(b)}</li>`).join('')}</ul>`
      : (isVisual ? `<p class="original-slide-visual">Visual / diagram slide — see the uploaded deck for graphics.</p>` : '');
    return `<article class="original-slide-card">
      <header class="original-slide-head"><span class="original-slide-num">Slide ${u.unitNumber}</span><h4>${this.escapeHtml(title)}</h4></header>
      ${body}
      ${note ? `<p class="original-slide-note"><span>Speaker note:</span> ${this.escapeHtml(note)}</p>` : ''}
    </article>`;
  }

  renderOriginalDocx(doc) {
    const clean = this.sanitizeDocxHtml(doc.formattedHtml || '');
    if (!clean.trim()) return this.renderOriginalMissing(doc);
    return `<div class="original-docx" tabindex="0">${clean}
      <p class="original-hint">Formatted view — headings, tables and emphasis preserved; pagination may differ from Word.</p>
    </div>`;
  }

  async processUploadedFile(file) {
    this.showLoading('Extracting Document Text...', `Reading ${file.name} word-for-word in browser...`);

    try {
      const extractedDoc = await DocumentParser.parseFile(file);

      // Verify readable text was actually extracted or visual data is present for multimodal processing
      const cleanContent = (extractedDoc.rawText || '').replace(/--- \[Page \d+ of \d+\] ---/g, '').trim();
      const hasVisualData = Boolean(extractedDoc.base64Data);

      if (!cleanContent || cleanContent.length < 5) {
        if (hasVisualData) {
          extractedDoc.rawText = `[Visual Educational Document: ${file.name}]\nVisual document prepared for multimodal pedagogical analysis.`;
        } else {
          throw new Error(`No readable digital text could be found in "${file.name}". If this is a scanned photocopy or image-only PDF, please upload a document with digital selectable text, or a Word (.docx) file.`);
        }
      }

      this.updateLoadingDesc('Document loaded — everything stays on this device until you choose a summary type.');

      // Sprint B: file-first. Show the source verbatim, do NOT auto-summarize.
      this.currentDoc = extractedDoc;
      this.currentAnalysis = null;
      this.activeSummaryType = null;
      this.activeSubTab = 'verbatim';
      this.verbatimVisibleCount = 25;
      // Research rule: transcript default when text exists; auto-Original when visual-only.
      const hasText = cleanContent && cleanContent.length >= 10;
      this.verbatimView = hasText ? 'transcript' : 'original';
      this.revokeOriginalObjectUrl();
      this.ensureOriginalObjectUrl();
      this.currentDocId = this.makeDocId(extractedDoc);
      this.currentSessionSavedAt = new Date().toISOString();
      this.persistSession();
      this.hideLoading();
      this.render();
      showToast(`"${extractedDoc.filename}" is loaded — review the source, then choose a summary.`, 'info');
      if (typeof this.openSummaryChooser === 'function') {
        this.openSummaryChooser();
      }
    } catch (err) {
      this.hideLoading();
      showToast(`${err.message}`, 'warning');
    }
  }

  switchSubTab(tabName) {
    this.activeSubTab = tabName;
    const synthPanel = document.getElementById('synthesis-panel');
    const cornellPanel = document.getElementById('cornell-panel');
    const verbatimPanel = document.getElementById('verbatim-panel');

    if (this.isSplitView) {
      if (tabName === 'verbatim') {
        if (verbatimPanel) verbatimPanel.scrollIntoView({ behavior: 'smooth' });
      } else {
        if (synthPanel) synthPanel.style.display = tabName === 'synthesis' ? 'block' : 'none';
        if (cornellPanel) cornellPanel.style.display = tabName === 'cornell' ? 'block' : 'none';
        if (verbatimPanel) verbatimPanel.style.display = 'block';
      }
    } else {
      if (synthPanel) synthPanel.style.display = tabName === 'synthesis' ? 'block' : 'none';
      if (cornellPanel) cornellPanel.style.display = tabName === 'cornell' ? 'block' : 'none';
      if (verbatimPanel) verbatimPanel.style.display = tabName === 'verbatim' ? 'block' : 'none';
    }

    this.updateSubtabButtons();
    this.updateWorkspaceActions();
    this.persistSession();
  }

  updateSubtabButtons() {
    document.querySelectorAll('.reading-subtab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.subtab === this.activeSubTab);
    });
  }

  updateWorkspaceActions() {
    const foldBtn = document.getElementById('btn-toggle-fold-notes');
    const exportDocBtn = document.getElementById('btn-export-cornell-doc');
    const copyBtn = document.getElementById('btn-copy-reading-text');

    if (foldBtn) foldBtn.style.display = this.activeSubTab === 'cornell' ? 'inline-flex' : 'none';
    if (exportDocBtn) exportDocBtn.style.display = this.activeSubTab === 'cornell' ? 'inline-flex' : 'none';
    if (copyBtn) copyBtn.style.display = this.activeSubTab !== 'cornell' ? 'inline-flex' : 'none';
  }

  toggleSplitView() {
    this.isSplitView = !this.isSplitView;
    localStorage.setItem('pedagogo_reader_split_view', String(this.isSplitView));
    this.persistSession();

    const body = document.getElementById('reading-view-body');
    const btn = document.getElementById('btn-toggle-split-view');

    if (body) {
      body.classList.toggle('split-active', this.isSplitView);
    }

    if (btn) {
      btn.innerHTML = `<span>${this.isSplitView ? '📖 Single View' : '📑 Split View'}</span>`;
    }

    const synthPanel = document.getElementById('synthesis-panel');
    const cornellPanel = document.getElementById('cornell-panel');
    const verbatimPanel = document.getElementById('verbatim-panel');

    if (this.isSplitView) {
      if (this.activeSubTab === 'verbatim') {
        this.activeSubTab = this.originSubTab || 'synthesis';
      }
      if (synthPanel) synthPanel.style.display = this.activeSubTab === 'synthesis' ? 'block' : 'none';
      if (cornellPanel) cornellPanel.style.display = this.activeSubTab === 'cornell' ? 'block' : 'none';
      if (verbatimPanel) verbatimPanel.style.display = 'block';
      showToast('📑 Split View enabled: Notes on left, Document on right', 'info');
    } else {
      if (synthPanel) synthPanel.style.display = this.activeSubTab === 'synthesis' ? 'block' : 'none';
      if (cornellPanel) cornellPanel.style.display = this.activeSubTab === 'cornell' ? 'block' : 'none';
      if (verbatimPanel) verbatimPanel.style.display = this.activeSubTab === 'verbatim' ? 'block' : 'none';
      showToast('📖 Single View enabled', 'info');
    }

    this.updateSubtabButtons();
    this.updateWorkspaceActions();
  }

  updateCitationCounter() {
    const el = document.getElementById('cite-verify-counter');
    if (el) {
      const n = this.citationTapCount || 0;
      el.textContent = n === 0 ? 'No claim verified yet — tap a [Page X] badge to check one.' : `Verified ${n} claim${n === 1 ? '' : 's'} this session — nice, keep going.`;
    }
  }

  dismissGroundTruthGuard(silent = false) {
    if (this.groundTruthDismissed && !silent) return;
    this.groundTruthDismissed = true;
    try { sessionStorage.setItem('pedagogo_guard_dismissed', '1'); } catch (e) {}
    if (!silent) { try { ReadingTelemetry.log('guard_dismiss'); } catch (e) {} }
    const g = document.getElementById('ground-truth-guard');
    if (g) g.style.display = 'none';
  }

  jumpToUnit(unitNum, unitType = 'Page', detail = '') {
    if (!this.currentDoc) return;

    // Citation verification always lands on searchable Transcript, never Original.
    if (this.verbatimView === 'original') {
      this.verbatimView = 'transcript';
      this.persistSession();
      this.render();
    }

    if (this.isSplitView) {
      this.ensureUnitCardVisible(unitNum);
      const unitCard = document.getElementById(`unit-card-${unitNum}`);
      if (unitCard) {
        unitCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.pulseUnitCard(unitCard, detail);
      }
      showToast(`📍 Scrolled to ${unitType} ${unitNum} in preview panel`, 'info');
      return;
    }

    // In Single View, remember origin
    this.originSubTab = this.activeSubTab;
    this.originScrollY = window.scrollY;

    // Switch to verbatim
    this.switchSubTab('verbatim');
    this.ensureUnitCardVisible(unitNum);

    // Mount return banner
    this.showReturnBanner(unitNum, unitType);

    // Scroll to target
    setTimeout(() => {
      const targetCard = document.getElementById(`unit-card-${unitNum}`);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.pulseUnitCard(targetCard, detail);
      }
    }, 60);

    showToast(`📍 Jumped to ${unitType} ${unitNum}. Click "Return" when finished.`, 'info');
  }

  ensureUnitCardVisible(unitNum) {
    // Sprint B: if the target unit is beyond the lazy-render window, load it first.
    let targetCard = document.getElementById(`unit-card-${unitNum}`);
    if (!targetCard && this.currentDoc) {
      this.verbatimVisibleCount = Math.max(this.verbatimVisibleCount || 25, unitNum);
      const stream = document.getElementById('verbatim-stream');
      if (stream) {
        stream.innerHTML = this.renderVerbatimUnits(this.currentDoc);
        this.bindCopyUnitButtons();
      }
      targetCard = document.getElementById(`unit-card-${unitNum}`);
    }
    if (targetCard && targetCard.style.display === 'none') {
      document.querySelectorAll('.verbatim-unit-card').forEach(c => {
        c.style.display = 'block';
      });
      document.querySelectorAll('.unit-jump-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.unit === 'all');
      });
    }
  }

  pulseUnitCard(card, detail = '') {
    card.classList.remove('citation-target-pulse');
    void card.offsetWidth; // force CSS reflow
    card.classList.add('citation-target-pulse');
  }

  showReturnBanner(unitNum, unitType) {
    const slot = document.getElementById('verbatim-jump-banner-slot');
    if (!slot) return;

    const returnLabel = this.originSubTab === 'cornell' ? '📝 Cornell Study Sheet' : '💡 Pedagogical Synthesis';

    slot.innerHTML = `
      <div class="verbatim-return-banner" id="verbatim-return-banner">
        <div class="return-banner-info">
          <span class="return-badge">📌 Viewing ${this.escapeHtml(unitType)} ${unitNum}</span>
          <span class="return-hint">Grounded verbatim text cited in your study notes</span>
        </div>
        <button class="btn-primary btn-return-from-jump" id="btn-return-from-jump" title="Return to where you were reading">
          ← Return to ${returnLabel}
        </button>
      </div>
    `;

    const btnReturn = document.getElementById('btn-return-from-jump');
    if (btnReturn) {
      btnReturn.addEventListener('click', () => {
        this.switchSubTab(this.originSubTab);
        window.scrollTo({ top: this.originScrollY, behavior: 'smooth' });
        slot.innerHTML = '';
        showToast('Returned to your study notes 🌿', 'info');
      });
    }
  }

  loadSample(sample) {
    let units = [];
    if (sample.rawText && sample.rawText.includes('--- [')) {
      const parts = sample.rawText.split(/--- \[Page (\d+) of \d+\] ---\n?/);
      for (let i = 1; i < parts.length; i += 2) {
        const pageNum = parseInt(parts[i], 10);
        const pageText = (parts[i + 1] || '').trim();
        units.push({
          unitNumber: pageNum,
          title: `Page ${pageNum}`,
          text: pageText
        });
      }
    }
    if (units.length === 0) {
      units = [
        {
          unitNumber: 1,
          title: 'Page 1',
          text: 'Module 3: Child and Adolescent Development\nCognitive Development Foundations: Jean Piaget and Lev Vygotsky\n\nIntroduction:\nPre-service teachers must understand how human cognition unfolds in order to design developmentally appropriate instruction. Two foundational theorists dominate modern pedagogical discourse: Jean Piaget (1896–1980) and Lev Vygotsky (1896–1934). While both reject behaviorist transmission models and view learners as active meaning-makers (constructivists), they diverge profoundly on the origin, mechanism, and trajectory of cognitive growth.'
        },
        {
          unitNumber: 2,
          title: 'Page 2',
          text: 'Jean Piaget: Cognitive Constructivism & Stages\nPiaget proposed that cognitive development originates from within the individual through autonomous physical and mental manipulation of the environment. Knowledge is organized into cognitive structures known as schemas. When a child encounters new stimuli, they experience cognitive disequilibrium. To restore equilibrium, the learner either assimilates the information into an existing schema or accommodates by modifying the schema. Piaget asserted that development precedes learning across four stages:\n1. Sensorimotor (0–2 years): Object permanence.\n2. Preoperational (2–7 years): Egocentrism, symbolic play, lack of conservation.\n3. Concrete Operational (7–11 years): Conservation, reversibility, classification.\n4. Formal Operational (11+ years): Abstract reasoning, hypothetical-deductive logic.'
        },
        {
          unitNumber: 3,
          title: 'Page 3',
          text: 'Lev Vygotsky: Socio-Cultural Theory & The ZPD\nIn contrast, Lev Semionovich Vygotsky posited that cognitive development originates externally through social interaction and cultural tools, particularly language. Vygotsky rejected universal biological stages, arguing instead that learning precedes development. Children internalize interpersonal dialogues into intrapersonal inner speech, which subsequently directs thought.\nCentral to Vygotsky\'s pedagogy is the Zone of Proximal Development (ZPD): the distance between a learner\'s actual development level and their potential development level under guidance or with more capable peers (MKO). Jerome Bruner later operationalized this through Scaffolding: temporary, calibrated pedagogical support gradually dismantled as the learner achieves autonomy.'
        }
      ];
    }

    this.currentDoc = {
      filename: sample.title + '.' + sample.fileType.toLowerCase(),
      fileType: sample.fileType,
      totalUnits: sample.totalUnits || units.length,
      unitLabel: sample.unitLabel || 'Pages',
      rawText: sample.rawText,
      units: units
    };

    this.currentAnalysis = {
      source: 'LOCAL_PEDAGOGICAL_ENGINE',
      modelName: 'Built-in Educational Benchmark',
      markdown: sample.synthesis,
      analyzedAt: new Date().toISOString()
    };

    this.activeSubTab = 'synthesis';
    this.render();
  }

  /**
   * Sprint UX fix — the loading overlay must exist on EVERY screen and survive
   * re-renders. Previously it was part of the upload-screen template, so clicking
   * Summarize on the workspace screen found no #reader-loading-overlay in the DOM
   * and showLoading()/updateLoadingDesc() silently did nothing (the reported
   * "plain white, then text appears" bug). Body-level singleton, same pattern
   * as the summary-chooser modal.
   */
  ensureLoadingOverlay() {
    let overlay = document.getElementById('reader-loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'reader-loading-overlay';
      overlay.className = 'reader-loading-overlay';
      overlay.style.display = 'none';
      overlay.innerHTML = `
        <div class="loading-box">
          <div class="loading-spinner"></div>
          <h4 id="loading-status-title">Working…</h4>
          <p id="loading-status-desc"></p>
          <p class="loading-elapsed" id="loading-status-elapsed" hidden></p>
          <button type="button" class="btn-subtle loading-cancel" id="loading-cancel-btn" hidden>✕ Cancel</button>
        </div>`;
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  showLoading(title, desc, opts = {}) {
    const overlay = this.ensureLoadingOverlay();
    const tEl = document.getElementById('loading-status-title');
    const dEl = document.getElementById('loading-status-desc');
    if (tEl) tEl.textContent = title;
    if (dEl) dEl.textContent = desc;
    // Sprint UX (Nielsen 1993 / Maister 1985): waits >10 s need running feedback
    // (elapsed + expected band) and a clearly signposted way to interrupt.
    this._loadingStartedAt = Date.now();
    const eEl = document.getElementById('loading-status-elapsed');
    const cBtn = document.getElementById('loading-cancel-btn');
    if (cBtn) { cBtn.hidden = !opts.cancellable; cBtn.onclick = opts.onCancel || null; }
    clearInterval(this._loadingTicker);
    this._loadingTicker = null;
    if (eEl) {
      eEl.hidden = !opts.showTimer;
      if (opts.showTimer) eEl.textContent = '0s — ' + (opts.timeHint || '');
      if (opts.showTimer) {
        this._loadingTicker = setInterval(() => {
          const s = Math.max(0, Math.round((Date.now() - this._loadingStartedAt) / 1000));
          const mm = Math.floor(s / 60);
          eEl.textContent = (mm > 0 ? mm + 'm ' : '') + (s % 60) + 's — ' + (opts.timeHint || '');
        }, 1000);
      }
    }
    if (overlay) overlay.style.display = 'flex';
  }

  updateLoadingDesc(desc) {
    const dEl = document.getElementById('loading-status-desc');
    if (dEl) dEl.textContent = desc;
  }

  hideLoading() {
    const overlay = document.getElementById('reader-loading-overlay');
    if (overlay) overlay.style.display = 'none';
    clearInterval(this._loadingTicker);
    this._loadingTicker = null;
  }

  /**
   * Sprint B — file-first empty state shown in Synthesis/Cornell tabs before any summary exists.
   */
  renderSummarizeEmptyState(panelKey) {
    return `
      <div class="summarize-empty-state">
        <div class="empty-state-icon">🧠</div>
        <h3>Ready for a summary?</h3>
        <p>Your file is loaded — the <strong>Verbatim</strong> tab shows the original, word-for-word. Tell me what you need it for.</p>
        <button class="btn-primary" id="btn-summarize-empty-${panelKey}">✨ Choose Summary Type</button>
      </div>`;
  }

  /**
   * Sprint B — Quick Look renderer (markdown that is NOT the 5-part contract).
   */
  renderQuickLook(md) {
    if (!md) return '<p class="empty-text">No analysis available.</p>';
    return `<div class="pedagogical-card card-quick-look"><div class="card-body-content">${this.simpleMarkdown(md)}</div></div>`;
  }

  /**
   * Sprint B — 3-goal summary chooser (goal-scaffold, not a menu for its own sake).
   * Smart default pre-selected via DocumentSummarizer.getRecommendedSummaryType().
   */
  openSummaryChooser() {
    if (!this.currentDoc) return;
    const types = DocumentSummarizer.SUMMARY_TYPES || [];
    const recommended = DocumentSummarizer.getRecommendedSummaryType(this.currentDoc);
    let modal = document.getElementById('summary-chooser-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'summary-chooser-modal';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card summary-chooser-card" role="dialog" aria-modal="true" aria-label="Choose a summary type">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <span class="modal-icon" aria-hidden="true">✦</span>
            <h3>What do you need from this file?</h3>
          </div>
          <button type="button" class="modal-close" id="btn-close-summary-chooser" aria-label="Close">×</button>
        </div>
        <div class="modal-body">
          <p class="gemini-modal-desc">Already loaded — you can scroll it in the <strong>Verbatim</strong> tab anytime. Pick the summary that fits your goal.</p>
          <div class="summary-type-list">
            ${types.map(t => `
              <label class="summary-type-card${t.id === recommended ? ' recommended active' : ''}" data-type="${t.id}">
                <input type="radio" name="summary-type" value="${t.id}" ${t.id === recommended ? 'checked' : ''}>
                <span class="summary-type-icon">${t.icon}</span>
                <span class="summary-type-meta">
                  <span class="summary-type-title">${t.title}${t.id === recommended ? ' <span class="recommended-badge">Recommended</span>' : ''}</span>
                  <span class="summary-type-desc">${t.desc}</span>
                  <span class="summary-type-why">${t.why}</span>
                </span>
              </label>`).join('')}
          </div>
          <p class="gemini-test-status" id="summary-chooser-status" aria-live="polite"></p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-subtle" id="btn-cancel-summary-chooser">Not now — just browse</button>
          <button type="button" class="btn-primary" id="btn-generate-summary">✦ Generate</button>
        </div>
      </div>`;

    modal.classList.add('active');
    // Trust fix: "Not now / X / backdrop / Escape" must land on readable
    // source — never on an empty Synthesis/Cornell panel.
    const landOnVerbatim = () => {
      this.activeSubTab = 'verbatim';
      try { this.persistSession(); } catch (e) {}
      try { this.render(); } catch (e) { try { this.switchSubTab('verbatim'); } catch (e2) {} }
      showToast('File kept in 📖 Verbatim — pick Synthesis when ready.', 'info');
    };
    const closeModal = (withLanding = false) => {
      modal.classList.remove('active');
      modal.innerHTML = '';
      if (withLanding) landOnVerbatim();
    };
    const closeHandler = modal.querySelector('#btn-close-summary-chooser');
    if (closeHandler) closeHandler.replaceWith(closeHandler.cloneNode(true));
    modal.querySelector('#btn-close-summary-chooser')?.addEventListener('click', () => closeModal(true));
    const cancelHandler = modal.querySelector('#btn-cancel-summary-chooser');
    if (cancelHandler) cancelHandler.replaceWith(cancelHandler.cloneNode(true));
    modal.querySelector('#btn-cancel-summary-chooser')?.addEventListener('click', () => {
      try { ReadingTelemetry.log('summary_dialog_aborted'); } catch (e) {}
      closeModal(true);
    });
    modal.onclick = (e) => { if (e.target === modal) closeModal(true); };
    modal.onkeydown = (e) => { if (e.key === 'Escape') closeModal(true); };
    const firstBtn = modal.querySelector('#btn-close-summary-chooser');
    if (firstBtn) { try { firstBtn.focus({ preventScroll: true }); } catch (e) {} }
    modal.querySelectorAll('.summary-type-card').forEach(card => {
      card.addEventListener('click', () => {
        const input = card.querySelector('input');
        if (input) input.checked = true;
        modal.querySelectorAll('.summary-type-card').forEach(c2 => c2.classList.toggle('active', c2 === card));
      });
    });
    const gen = modal.querySelector('#btn-generate-summary');
    if (gen) gen.replaceWith(gen.cloneNode(true));
    modal.querySelector('#btn-generate-summary')?.addEventListener('click', () => {
        const btn = modal.querySelector('#btn-generate-summary');
        const chosen = (modal.querySelector('input[name="summary-type"]:checked')?.value) || recommended;
        if (btn) btn.disabled = true;
        closeModal();
        this.runSummaryForType(chosen);
    });
  }

/**
   * Sprint B — runs the chosen summary type against the current doc.
   * 'study' + 'reviewer' share the full synthesis (reviewer adds a push-to-Reviewer
   * confirmation gate with an inline mini-quiz ready to scroll to).
   */
  async runSummaryForType(type) {
    if (!this.currentDoc) return;
    try { ReadingTelemetry.log('summary_type_' + (type || 'study')); } catch (e) {}

    let forceBasic = false;
    try { forceBasic = sessionStorage.getItem('pedagogo_force_basic') === '1'; } catch (e) {}

    const label = type === 'quick' ? 'Quick Look' : (type === 'reviewer' ? 'Reviewer Pack' : 'Study Sheet');
    this.showLoading(`Generating ${label}...`, 'Reading the file and preparing the analysis…', {
      showTimer: true,
      timeHint: 'This usually takes 15–60 s (longer for large files)',
      cancellable: true,
      onCancel: () => {
        try { ReadingTelemetry.log('summary_cancelled'); } catch (e) {}
        DocumentSummarizer.cancelActive();
        this.updateLoadingDesc('Cancelling — your PDF stays unchanged…');
      }
    });
    const onStage = (msg) => this.updateLoadingDesc(msg);

    try {
      let analysis;
      if (type === 'quick') {
        analysis = await DocumentSummarizer.summarizeQuick(this.currentDoc, onStage);
      } else if (forceBasic) {
        analysis = await DocumentSummarizer.extractPedagogicalAnalysis(this.currentDoc);
        analysis.source = 'LOCAL_EXTRACTIVE_NLP';
      } else {
        analysis = await DocumentSummarizer.summarize(this.currentDoc, onStage);
      }
      this.currentAnalysis = analysis;
      this.activeSummaryType = analysis.source === 'QUICK_LOOK' ? 'quick' : type;
      this.activeSubTab = 'synthesis';
      this.currentSessionSavedAt = new Date().toISOString();
      this.persistSession();
      this.hideLoading();
      this.render();

      const name = this.currentDoc.filename;
      if (analysis.source === 'QUICK_LOOK') {
        showToast(`⚡ Quick Look for "${name}" is ready!`, 'success');
      } else if (analysis.source === 'OPENAI_COMPAT_API') {
        showToast(`✨ Your ${label} for "${name}" is ready!`, 'success');
      } else if (analysis.source === 'GEMINI_API') {
        showToast(`✨ Your ${label} for "${name}" is ready!`, 'success');
      } else {
        // Trust fix: honest offline label — the old "from its actual text"
        // hid that TextRank scaffolding is lower quality than AI.
        if (analysis.quotaNotice) {
          // Honest quota UX (2026-09-13): a 429 no longer degrades silently.
          try { ReadingTelemetry.log('quota_notice_shown'); } catch (e) {}
          showToast('🕒 Daily limit reached — showing the offline extract. Your own access key has its own limit, or retry tomorrow.', 'info');
        } else {
          const needsKey = !DocumentSummarizer.hasApiKey();
          showToast(needsKey
            ? `📝 Offline extract for "${name}" — turn on Full Study Mode in Settings for full accuracy.`
            : `📝 Offline extract for "${name}" — Full Study Mode unreachable, verify against Verbatim.`, 'info');
        }
      }

      if ((analysis.source === 'GEMINI_API' || analysis.source === 'OPENAI_COMPAT_API') && DocumentSummarizer.shouldSuggestPro(this.currentDoc)) {
        try { ReadingTelemetry.log('pro_nudge_shown'); } catch (e) {}
        setTimeout(() => showToast('Long/dense file — for deeper reasoning, try a deeper quality tier in Settings.', 'info'), 2500);
      }

      if (type === 'reviewer') {
        const qs = this.collectReviewerQuestions();
        if (qs && qs.length) this.openReviewerGate(qs);
      }
    } catch (err) {
      this.hideLoading();
      const cancelled = (err && err.name === 'AbortError') || /cancel|abort/i.test((err && err.message) || '');
      showToast(cancelled
        ? 'Summary cancelled — your PDF is unchanged and safe.'
        : `${err.message}`, cancelled ? 'info' : 'warning');
    }
  }

  /**
   * Sprint B — confirmation gate before bulk-importing practice items to LET Reviewer
   * (pilot guard from enhancement plan §8.3: no blind bulk import). Mini-quiz is already
   * on screen in Section 5 of the synthesis — this offers the spaced 1d/3d/7d push.
   */
  openReviewerGate(questions) {
    const mcqs = questions.filter(q => q.cardKind === 'SCENARIO_MCQ').length;
    const fills = questions.filter(q => q.cardKind === 'TERM_FILL_IN').length;
    let modal = document.getElementById('reviewer-gate-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'reviewer-gate-modal';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="modal-card reviewer-gate-card" role="dialog" aria-modal="true" aria-label="Push drills to LET Reviewer">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <span class="modal-icon">🎯</span>
            <h3>Practice found — push to LET Reviewer?</h3>
          </div>
          <button class="modal-close" id="btn-close-reviewer-gate" aria-label="Close">✕</button>
        </div>
        <div class="modal-body">
          <p class="reviewer-gate-counts">This reading produced <strong>${mcqs} scenario question${mcqs === 1 ? '' : 's'}</strong> and <strong>${fills} term drill${fills === 1 ? '' : 's'}</strong>.</p>
          <p class="gemini-modal-desc">You can practice them right here in Section 5 (scroll down). Push them to the LET Reviewer to get them back on a <strong>1d / 3d / 7d</strong> spaced schedule.</p>
        </div>
        <div class="modal-footer">
          <button class="btn-subtle" id="btn-review-gate-skip">Practice here first</button>
          <button class="btn-primary" id="btn-review-gate-push">📥 Push ${questions.length} to LET Reviewer</button>
        </div>
      </div>`;
    modal.classList.add('active');
    const close = () => {
      modal.classList.remove('active');
      modal.innerHTML = '';
    };
    modal.onclick = (e) => { if (e.target === modal) close(); };
    modal.onkeydown = (e) => { if (e.key === 'Escape') close(); };
    modal.querySelector('#btn-close-reviewer-gate')?.addEventListener('click', close);
    modal.querySelector('#btn-review-gate-skip')?.addEventListener('click', () => {
      try { ReadingTelemetry.log('reviewer_push_skip'); } catch (e) {}
      close();
    });
    modal.querySelector('#btn-review-gate-push')?.addEventListener('click', () => {
      try { ReadingTelemetry.log('reviewer_push_confirm'); } catch (e) {}
      this.dispatchReviewerImport(questions);
      close();
      showToast(`✓ ${questions.length} drills pushed to LET Reviewer (1d / 3d / 7d).`, 'success');
    });
  }

openGeminiModal() {
    let modal = document.getElementById('gemini-settings-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'gemini-settings-modal';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    const activeProvider = DocumentSummarizer.getProvider();
    const geminiKey = DocumentSummarizer.getGeminiCustomKey();
    const currentModel = DocumentSummarizer.getSelectedModel();
    const availableModels = DocumentSummarizer.getAvailableModels();
    const openAIKey = DocumentSummarizer.getOpenAIKey();
    const openAIBase = DocumentSummarizer.getOpenAIBaseUrl();
    const openAIModel = DocumentSummarizer.getOpenAIModel();
    const openAIPresets = DocumentSummarizer.getOpenAIPresets();

    modal.innerHTML = `
      <div class="modal-card gemini-modal-card">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <span class="modal-icon">🔑</span>
            <h3>Full Study Mode — Settings</h3>
          </div>
          <button class="modal-close" id="btn-close-gemini-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="ai-provider-tabs" role="tablist" aria-label="AI provider">
            <button type="button" class="ai-provider-tab${activeProvider === 'gemini' ? ' active' : ''}" data-provider="gemini" role="tab" aria-selected="${activeProvider === 'gemini' ? 'true' : 'false'}">✨ Built-in (Default)</button>
            <button type="button" class="ai-provider-tab${activeProvider === 'openai_compat' ? ' active' : ''}" data-provider="openai_compat" role="tab" aria-selected="${activeProvider === 'openai_compat' ? 'true' : 'false'}">🔌 Own Access Key</button>
          </div>
          <p class="gemini-modal-desc" id="ai-modal-desc">
            ${activeProvider === 'openai_compat'
              ? 'Use your own compatible service (OpenAI-compatible endpoints, Groq, OpenRouter, DeepSeek, or a local server). Same study sheets, your provider.'
              : 'Generate research-backed study sheets with the <strong>built-in tier</strong> — no cost, daily limits apply. Or paste your own access key anytime.'}
          </p>

          <div class="gemini-steps-card">
            <h4>How to enable it free in 30 seconds:</h4>
            <ol>
              <li>Open <a href="https://aistudio.google.com/" target="_blank" rel="noopener">the key portal (aistudio.google.com)</a></li>
              <li>Sign in with any Google account.</li>
              <li>Click <strong>"Get API Key"</strong> &gt; <strong>"Create API Key"</strong>.</li>
              <li>Paste it below. It is stored <em>only in your browser's localStorage</em>.</li>
            </ol>
            <div class="gemini-free-limits-badge">
              ✓ Built-in tier: no cost • daily limits apply
            </div>
            <span class="input-hint" style="display:block; margin-top:6px;">ℹ️ Privacy note (per the key provider): content sent with a free key may be used to improve their services — paid keys disable that. Keep confidential documents off free keys.</span>
          </div>

          <div class="ai-pane" id="ai-pane-gemini" style="${activeProvider === 'gemini' ? '' : 'display:none;'}">
          <div class="form-group">
            <label for="gemini-model-select">Quality Tier:</label>
            <select id="gemini-model-select" class="form-input form-select" style="font-weight: 600; cursor: pointer;">
              ${availableModels.map(m => `
                <option value="${m.id}" ${m.id === currentModel ? 'selected' : ''}>
                  ${this.escapeHtml(m.name)}
                </option>
              `).join('')}
            </select>
            <span class="input-hint" id="gemini-model-desc-hint">${availableModels.find(m => m.id === currentModel)?.desc || ''}</span>
          </div>

          <div class="form-group">
            <label for="gemini-api-key-input">Access key (optional — overrides the built-in tier):</label>
            <div class="gemini-key-row">
              <input type="password" id="gemini-api-key-input" class="form-input" placeholder="Paste your access key (leave empty for the built-in tier)" value="${this.escapeHtml(geminiKey)}" autocomplete="off" spellcheck="false">
              <button type="button" class="btn-subtle" id="btn-test-gemini-key" title="Verify this key before saving">Test Key</button>
            </div>
            <span class="input-hint">Leave empty to use the built-in tier. Stored only in this browser — requests go directly to the key provider, never to our servers.</span>
            <p class="gemini-test-status" id="gemini-key-test-status" aria-live="polite"></p>
          </div>
          </div>
          <div class="ai-pane" id="ai-pane-openai" style="${activeProvider === 'openai_compat' ? '' : 'display:none;'}">
            <div class="form-group">
              <label for="openai-preset-select">Provider preset:</label>
              <select id="openai-preset-select" class="form-input form-select" style="font-weight:600;cursor:pointer;">
                <option value="custom">Custom endpoint…</option>
                ${openAIPresets.map(pr => `<option value="${this.escapeHtml(pr.baseUrl)}" data-model="${this.escapeHtml(pr.model)}" ${pr.baseUrl === openAIBase ? 'selected' : ''}>${this.escapeHtml(pr.name)}</option>`).join('')}
              </select>
              <span class="input-hint">Pick a preset to fill the endpoint + model, or choose Custom for Ollama / LM Studio / proxies.</span>
            </div>
            <div class="form-group">
              <label for="openai-base-url-input">Compatible endpoint (Base URL):</label>
              <input type="text" id="openai-base-url-input" class="form-input" spellcheck="false" autocomplete="off" placeholder="https://api.openai.com/v1" value="${this.escapeHtml(openAIBase)}">
              <span class="input-hint">Must end in <code>/v1</code> for cloud APIs (e.g. Groq: https://api.groq.com/openai/v1). Local: http://localhost:11434/v1</span>
            </div>
            <div class="form-group">
              <label for="openai-model-input">Model name:</label>
              <input type="text" id="openai-model-input" class="form-input" spellcheck="false" autocomplete="off" placeholder="gpt-4o-mini" value="${this.escapeHtml(openAIModel)}">
              <span class="input-hint">Examples: gpt-4o-mini • llama-3.3-70b-versatile (Groq) • deepseek-chat • llama3.1 (Ollama)</span>
            </div>
            <div class="form-group">
              <label for="openai-api-key-input">Your API key for this endpoint:</label>
              <div class="gemini-key-row">
                <input type="password" id="openai-api-key-input" class="form-input" placeholder="sk-... / gsk-... / ollama (local can be anything)" value="${this.escapeHtml(openAIKey)}" autocomplete="off" spellcheck="false">
                <button type="button" class="btn-subtle" id="btn-test-openai-key" title="Verify this endpoint + key before saving">Test Key</button>
              </div>
              <span class="input-hint">Stored only in this browser. For local Ollama/LM Studio any non-empty value works.</span>
              <p class="gemini-test-status" id="openai-key-test-status" aria-live="polite"></p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          ${(activeProvider === 'gemini' ? geminiKey : openAIKey) ? '<button class="btn-subtle btn-danger-subtle" id="btn-remove-gemini-key">Remove Key</button>' : ''}
          <div class="footer-actions-right">
            <button class="btn-subtle" id="btn-cancel-gemini-modal">Cancel</button>
            <button class="btn-primary" id="btn-save-gemini-key">Test &amp; Save Settings</button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('active');

    const closeBtn = document.getElementById('btn-close-gemini-modal');
    const cancelBtn = document.getElementById('btn-cancel-gemini-modal');
    const saveBtn = document.getElementById('btn-save-gemini-key');
    const removeBtn = document.getElementById('btn-remove-gemini-key');
    const inputKey = document.getElementById('gemini-api-key-input');
    const modelSelect = document.getElementById('gemini-model-select');
    const modelHint = document.getElementById('gemini-model-desc-hint');

    if (modelSelect && modelHint) {
      modelSelect.addEventListener('change', () => {
        const found = availableModels.find(m => m.id === modelSelect.value);
        if (found) modelHint.textContent = found.desc;
      });
    }

    const closeModal = () => modal.classList.remove('active');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    let modalProvider = activeProvider;
    const paneGemini = document.getElementById('ai-pane-gemini');
    const paneOpenAI = document.getElementById('ai-pane-openai');
    const modalDesc = document.getElementById('ai-modal-desc');
    const providerTabs = modal.querySelectorAll('.ai-provider-tab');
    const paintProvider = (pid) => {
      modalProvider = pid;
      providerTabs.forEach(b => {
        const on = b.dataset.provider === pid;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      if (paneGemini) paneGemini.style.display = pid === 'gemini' ? '' : 'none';
      if (paneOpenAI) paneOpenAI.style.display = pid === 'openai_compat' ? '' : 'none';
    };
    providerTabs.forEach(b => b.addEventListener('click', () => paintProvider(b.dataset.provider)));
    const presetSelect = document.getElementById('openai-preset-select');
    const baseInput = document.getElementById('openai-base-url-input');
    const modelInput = document.getElementById('openai-model-input');
    const openKeyInput = document.getElementById('openai-api-key-input');
    if (presetSelect) presetSelect.addEventListener('change', () => {
      if (presetSelect.value === 'custom' || !baseInput) return;
      baseInput.value = presetSelect.value;
      const opt = presetSelect.selectedOptions && presetSelect.selectedOptions[0];
      const pm = opt && opt.dataset ? opt.dataset.model : '';
      if (pm && modelInput && !modelInput.value.trim()) modelInput.value = pm;
    });
    const testBtn = document.getElementById('btn-test-gemini-key');
    const testStatus = document.getElementById('gemini-key-test-status');
    const setTestStatus = (msg, kind) => {
      if (!testStatus) return;
      testStatus.textContent = msg;
      testStatus.dataset.kind = kind || '';
    };
    if (testBtn && inputKey) {
      testBtn.addEventListener('click', async () => {
        const keyVal = (inputKey.value || '').trim();
        const modelVal = modelSelect ? modelSelect.value : currentModel;
        if (!keyVal) { setTestStatus('Paste a key first, or leave empty to use the project default on Save.', 'warn'); return; }
        testBtn.disabled = true;
        const orig = testBtn.innerHTML;
        testBtn.innerHTML = 'Testing...';
        setTestStatus('Verifying your key…', 'pending');
        const result = await DocumentSummarizer.testApiKey(keyVal, modelVal);
        testBtn.disabled = false;
        testBtn.innerHTML = orig;
        if (result.ok) {
          setTestStatus('Key verified - tap Save to activate Full Study Mode.', 'ok');
          try { ReadingTelemetry.log('byok_test_ok'); } catch (e) {}
          showToast('Access key verified. Tap Save to activate.', 'success');
        } else {
          setTestStatus(`Key check failed: ${result.message}`, 'fail');
          try { ReadingTelemetry.log('byok_test_fail'); } catch (e) {}
        }
      });
    }

    const openTestBtn = document.getElementById('btn-test-openai-key');
    const openTestStatus = document.getElementById('openai-key-test-status');
    const setOpenStatus = (msg, kind) => {
      if (!openTestStatus) return;
      openTestStatus.textContent = msg;
      openTestStatus.dataset.kind = kind || '';
    };
    if (openTestBtn) {
      openTestBtn.addEventListener('click', async () => {
        const k = (openKeyInput ? openKeyInput.value : '').trim();
        const b = (baseInput ? baseInput.value : '').trim();
        const m = (modelInput ? modelInput.value : '').trim();
        if (!k) { setOpenStatus('Paste your key first, then tap Test.', 'warn'); return; }
        openTestBtn.disabled = true;
        openTestBtn.innerHTML = 'Testing...';
        setOpenStatus('Contacting your endpoint to verify key + model...', 'pending');
        const result = await DocumentSummarizer.testOpenAIKey(k, b, m);
        openTestBtn.disabled = false;
        openTestBtn.innerHTML = 'Test Key';
        if (result.ok) {
          setOpenStatus('Endpoint verified - tap Save to activate your access key.', 'ok');
          try { ReadingTelemetry.log('custom_ai_test_ok'); } catch (e) {}
        } else {
          setOpenStatus('Check failed: ' + result.message, 'fail');
          try { ReadingTelemetry.log('custom_ai_test_fail'); } catch (e) {}
        }
      });
    };

    if (saveBtn && inputKey) {
      saveBtn.addEventListener('click', async () => {
        DocumentSummarizer.setProvider(modalProvider);
        if (modalProvider === 'openai_compat') {
          const k = (openKeyInput ? openKeyInput.value : '').trim();
          const b = (baseInput ? baseInput.value : '').trim();
          const m = (modelInput ? modelInput.value : '').trim();
          saveBtn.disabled = true;
          saveBtn.innerHTML = 'Verifying & Saving...';
          if (!k) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Test &amp; Save Settings';
            setOpenStatus('Paste your key, or switch back to Built-in (Default).', 'warn');
            try { ReadingTelemetry.log('custom_ai_save_blocked'); } catch (e) {}
            return;
          }
          const oresult = await DocumentSummarizer.testOpenAIKey(k, b, m);
          if (!oresult.ok) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Test &amp; Save Settings';
            setOpenStatus('Could not verify: ' + oresult.message + '. Fix it or switch to Built-in (Default).', 'fail');
            try { ReadingTelemetry.log('custom_ai_save_blocked'); } catch (e) {}
            return;
          }
          DocumentSummarizer.setOpenAIKey(k);
          DocumentSummarizer.setOpenAIBaseUrl(b);
          DocumentSummarizer.setOpenAIModel(m);
          try { ReadingTelemetry.log('custom_ai_saved'); } catch (e) {}
          saveBtn.disabled = false;
          closeModal();
          this.render();
          showToast('Access key connected! Study sheets now use your provider.', 'success');
          return;
        }
        const keyVal = (inputKey.value || '').trim();
        const modelVal = modelSelect ? modelSelect.value : currentModel;
        saveBtn.disabled = true;
        const origSave = saveBtn.innerHTML;
        saveBtn.innerHTML = 'Verifying & Saving...';
        if (keyVal) {
          const result = await DocumentSummarizer.testApiKey(keyVal, modelVal);
          if (!result.ok) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = origSave;
            setTestStatus(`Could not verify key: ${result.message}. Fix it or tap Cancel to stay offline.`, 'fail');
            try { ReadingTelemetry.log('byok_save_blocked'); } catch (e) {}
            showToast('Key not verified - not saved. Check the key and retry.', 'info');
            return;
          }
        }
        try { localStorage.removeItem(DocumentSummarizer.STORAGE_KEY); } catch (e) {}
        if (keyVal) DocumentSummarizer.setApiKey(keyVal);
        if (modelSelect) {
          DocumentSummarizer.setSelectedModel(modelVal);
        }
        try { ReadingTelemetry.log(keyVal ? 'byok_saved' : 'byok_cleared'); } catch (e) {}
        saveBtn.disabled = false;
        saveBtn.innerHTML = origSave;
        closeModal();
        this.render();
        const activeModelName = availableModels.find(m => m.id === modelVal)?.name || 'Built-in tier';
        showToast(keyVal ? `${activeModelName} settings saved! High-accuracy auto-summarization is active.` : 'Key cleared. Offline mode active.', 'success');
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        if (modalProvider === 'openai_compat') {
          DocumentSummarizer.setOpenAIKey('');
          try { ReadingTelemetry.log('custom_ai_cleared'); } catch (e) {}
          showToast('Access key removed.', 'info');
        } else {
          try { localStorage.removeItem(DocumentSummarizer.STORAGE_KEY); } catch (e) {}
          try { ReadingTelemetry.log('byok_cleared'); } catch (e) {}
          showToast('Access key removed. Built-in tier (if any) is active.', 'info');
        }
        closeModal();
        this.render();
      });
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
