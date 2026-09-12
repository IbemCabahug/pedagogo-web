/**
 * Pedagogo Desk: Document Reading Desk & Cornell Note Studio 📖🌿
 * Orchestrates client-side file reading, search, 5-part pedagogical synthesis,
 * and classic Walter Pauk Cornell Study Sheets with "Fold & Test" active recall.
 */

import { DocumentParser } from './document-parser.js';
import { DocumentSummarizer } from './document-summarizer.js';
import { showToast } from './toast.js';

export class DocumentDesk {
  constructor() {
    this.currentDoc = null;
    this.currentAnalysis = null;
    this.activeSubTab = 'synthesis'; // 'synthesis', 'cornell', or 'verbatim'
    this.searchQuery = '';
    this.isProcessing = false;
    this.isCornellFolded = false; // "Fold & Test" active recall state
    this.termBankMisses = new Map(); // term -> { meaning, anchor } starred as "couldn't recall"
    this.isSplitView = localStorage.getItem('pedagogo_reader_split_view') === 'true';
    this.originSubTab = 'synthesis';
    this.originScrollY = 0;

    this.container = document.getElementById('view-reading-desk');
    if (this.container) {
      this.render();
    }
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
    const hasKey = DocumentSummarizer.hasApiKey();
    const isUsingDefault = DocumentSummarizer.isUsingDefaultKey();
    const hasCustom = Boolean(DocumentSummarizer.getCustomKey());

    let keyBadgeIcon = '🔑';
    let keyBadgeText = 'Setup Free Gemini Key';
    if (hasCustom) {
      keyBadgeIcon = '🔑';
      keyBadgeText = 'Custom Key Configured ✓';
    } else if (isUsingDefault) {
      keyBadgeIcon = '✨';
      keyBadgeText = 'Gemini AI Ready (Project Key) ✓';
    }

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="section-title">Smart Pedagogical Reading Desk 📖🌿</h2>
          <p class="section-desc">Upload course readings, DepEd orders, or slide decks to extract verbatim text and generate research-backed Cornell study sheets.</p>
        </div>
        <div class="header-actions">
          <button class="btn-subtle" id="btn-open-gemini-modal">
            <span>${keyBadgeIcon} ${keyBadgeText}</span>
          </button>
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

      <!-- Processing Modal / Indicator -->
      <div class="reader-loading-overlay" id="reader-loading-overlay" style="display: none;">
        <div class="loading-box">
          <div class="loading-spinner"></div>
          <h4 id="loading-status-title">Reading Document...</h4>
          <p id="loading-status-desc">Extracting word-for-word text page by page...</p>
        </div>
      </div>
    `;

    this.bindUploadEvents();
  }

  renderActiveWorkspace() {
    const doc = this.currentDoc;
    const analysis = this.currentAnalysis;
    const wordCount = doc.rawText.split(/\s+/).filter(Boolean).length;
    const engineBadge = analysis?.modelName 
      ? `<span class="chip chip-engine" title="Analyzed with ${this.escapeHtml(analysis.modelName)}">${analysis.source === 'GEMINI_API' ? '✨ ' : '⚡ '}${this.escapeHtml(analysis.modelName)}${analysis.isMultimodal ? ' (Multimodal)' : ''}</span>`
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
        </div>
      </div>

      <!-- Main Dual-View Body -->
      <div class="reading-view-body ${this.isSplitView ? 'split-active' : ''}" id="reading-view-body">
        <!-- View A: Pedagogical Synthesis -->
        <div class="synthesis-panel" id="synthesis-panel" style="${(this.activeSubTab === 'synthesis' || (this.isSplitView && this.activeSubTab !== 'cornell')) ? 'display: block;' : 'display: none;'}">
          <div class="synthesis-meta-strip">
            <span class="synthesis-source-tag">
              🌱 ${analysis?.source === 'GEMINI_API' 
                ? 'Analyzed via Gemini Flash AI' 
                : (analysis?.source === 'LOCAL_EXTRACTIVE_NLP' 
                  ? 'Local In-Browser Extractive Synthesis (From Your Document)' 
                  : 'Built-in Educational Sample')}
            </span>
            <span class="synthesis-frameworks-badge">
              ✓ Cornell Notes • ✓ Cognitive Chunking • ✓ Feynman Analogy • ✓ Contrastive Matrix • ✓ LET Practice
            </span>
            ${analysis?.source === 'LOCAL_EXTRACTIVE_NLP' ? `
              <button class="btn-subtle" id="btn-upgrade-gemini-pill" style="margin-left: auto; font-size: 11.5px; padding: 3px 10px;">
                ⚡ <span>Connect Free Gemini Key for Generative AI</span>
              </button>
            ` : ''}
          </div>
          <div class="synthesis-content-render" id="synthesis-rendered-area">
            ${this.renderSynthesisMarkdown(analysis?.markdown || '')}
          </div>
        </div>

        <!-- View B: Interactive Walter Pauk Cornell Note View -->
        <div class="cornell-panel" id="cornell-panel" style="${this.activeSubTab === 'cornell' ? 'display: block;' : 'display: none;'}">
          ${this.renderCornellSheet(analysis?.markdown || '', doc)}
        </div>

        <!-- View C: Verbatim Word-for-Word Reader -->
        <div class="verbatim-panel" id="verbatim-panel" style="${(this.activeSubTab === 'verbatim' || this.isSplitView) ? 'display: block;' : 'display: none;'}">
          <!-- Jump Return Banner Slot -->
          <div id="verbatim-jump-banner-slot"></div>

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
          </div>
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
      return `<div class="pedagogical-card card-cornell"><h3 class="card-header-cornell">1. 🎓 Cornell Synthesis &amp; Active Cues</h3><div class="card-body-content">${this.simpleMarkdown(c.replace('1. 🎓 Cornell Synthesis & Active Cues', ''))}</div></div>`;
    });

    html = html.replace(/### (2\. 🧩 Structured Concept Chunks[\s\S]*?)(?=### 3\.|$)/, (m, c) => {
      return `<div class="pedagogical-card card-chunks"><h3 class="card-header-chunks">2. 🧩 Structured Concept Chunks</h3><div class="card-body-content">${this.renderTermBankSection(c.replace('2. 🧩 Structured Concept Chunks', ''), md)}</div></div>`;
    });

    html = html.replace(/### (3\. 🧑‍🏫 "Teach It Simply"[\s\S]*?)(?=### 4\.|$)/, (m, c) => {
      return `<div class="pedagogical-card card-feynman"><h3 class="card-header-feynman">3. 🧑‍🏫 "Teach It Simply" (Classroom Analogy)</h3><div class="card-body-content">${this.simpleMarkdown(c.replace('3. 🧑‍🏫 "Teach It Simply" (Classroom Translation)', ''))}</div></div>`;
    });

    html = html.replace(/### (4\. ⚖️ Contrastive Analysis Matrix[\s\S]*?)(?=### 5\.|$)/, (m, c) => {
      return `<div class="pedagogical-card card-contrastive"><h3 class="card-header-contrastive">4. ⚖️ Contrastive Analysis Matrix</h3><div class="card-body-content">${this.simpleMarkdown(c.replace('4. ⚖️ Contrastive Analysis Matrix', ''))}</div></div>`;
    });

    html = html.replace(/### (5\. 🎯 Licensure[\s\S]*?)$/, (m, c) => {
      return `
        <div class="pedagogical-card card-retrieval">
          <div class="retrieval-header-bar">
            <h3 class="card-header-retrieval">5. 🎯 Licensure (LET) Retrieval Practice</h3>
            <button class="btn-primary btn-save-questions-to-reviewer" id="btn-save-questions-to-reviewer" title="Save MCQs + term drills to your LET reviewer deck (spaced 1d / 3d / 7d)">
              <span>➕ Save to LET Reviewer</span>
            </button>
          </div>
          <div class="card-body-content retrieval-body">${this.renderInteractiveQuiz(c)}</div>
        </div>
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

    const beforeMarkdown = sectionRaw.slice(0, firstStart).trim();
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

    return doc.units.map(unit => {
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
        this.switchSubTab('verbatim');
      });
    }

    const btnToggleSplit = document.getElementById('btn-toggle-split-view');
    if (btnToggleSplit) {
      btnToggleSplit.addEventListener('click', () => {
        this.toggleSplitView();
      });
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
        this.jumpToUnit(targetUnit, unitType, detail);
      }
    });

    // Fold / Unfold active recall toggle
    const handleToggleFold = () => {
      this.isCornellFolded = !this.isCornellFolded;
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

    // Unit jump pills
    document.querySelectorAll('.unit-jump-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.unit-jump-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const unitNum = pill.dataset.unit;
        if (unitNum === 'all') {
          document.querySelectorAll('.verbatim-unit-card').forEach(card => card.style.display = 'block');
        } else {
          document.querySelectorAll('.verbatim-unit-card').forEach(card => {
            card.style.display = card.dataset.unit === unitNum ? 'block' : 'none';
          });
        }
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

      this.updateLoadingDesc('Running 5-Part Pedagogical Synthesis (Cornell, Chunks, Feynman, Matrix, LET)...');

      const analysis = await DocumentSummarizer.summarize(extractedDoc);
      
      this.currentDoc = extractedDoc;
      this.currentAnalysis = analysis;
      this.activeSubTab = 'synthesis';
      this.hideLoading();
      this.render();

      if (analysis.source === 'LOCAL_EXTRACTIVE_NLP') {
        showToast(`🌱 Analyzed "${extractedDoc.filename}" from its actual text! (Connect free Gemini key anytime for generative AI synthesis)`, 'info');
      } else if (analysis.source === 'GEMINI_API') {
        showToast(`✨ Document "${extractedDoc.filename}" synthesized via Gemini Flash AI!`, 'success');
      } else {
        showToast(`Document "${extractedDoc.filename}" loaded successfully!`, 'success');
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

  jumpToUnit(unitNum, unitType = 'Page', detail = '') {
    if (!this.currentDoc) return;

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
    const targetCard = document.getElementById(`unit-card-${unitNum}`);
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

  showLoading(title, desc) {
    const overlay = document.getElementById('reader-loading-overlay');
    const tEl = document.getElementById('loading-status-title');
    const dEl = document.getElementById('loading-status-desc');
    if (tEl) tEl.textContent = title;
    if (dEl) dEl.textContent = desc;
    if (overlay) overlay.style.display = 'flex';
  }

  updateLoadingDesc(desc) {
    const dEl = document.getElementById('loading-status-desc');
    if (dEl) dEl.textContent = desc;
  }

  hideLoading() {
    const overlay = document.getElementById('reader-loading-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  openGeminiModal() {
    let modal = document.getElementById('gemini-settings-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'gemini-settings-modal';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    const currentKey = DocumentSummarizer.getApiKey();
    const currentModel = DocumentSummarizer.getSelectedModel();
    const availableModels = DocumentSummarizer.getAvailableModels();

    modal.innerHTML = `
      <div class="modal-card gemini-modal-card">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <span class="modal-icon">🔑</span>
            <h3>Google Gemini AI Setup &amp; Model Selection</h3>
          </div>
          <button class="modal-close" id="btn-close-gemini-modal">✕</button>
        </div>
        <div class="modal-body">
          <p class="gemini-modal-desc">
            Generate research-backed, high-retention pedagogical study sheets for your own documents at <strong>$0.00 cost</strong> using Google Gemini.
          </p>

          <div class="gemini-steps-card">
            <h4>How to get your free key in 30 seconds:</h4>
            <ol>
              <li>Go to <a href="https://aistudio.google.com/" target="_blank" rel="noopener">Google AI Studio (aistudio.google.com)</a></li>
              <li>Sign in with any Google account.</li>
              <li>Click <strong>"Get API Key"</strong> &gt; <strong>"Create API Key"</strong>.</li>
              <li>Paste it below. It is stored <em>only in your browser's localStorage</em>.</li>
            </ol>
            <div class="gemini-free-limits-badge">
              ✓ Free Tier: 15 requests/min • 1,500 requests/day • 1,000,000 token context window
            </div>
          </div>

          <div class="form-group">
            <label for="gemini-model-select">Active AI Model Tier:</label>
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
            <label for="gemini-api-key-input">Your Gemini API Key:</label>
            <input type="password" id="gemini-api-key-input" class="form-input" placeholder="AIzaSy..." value="${this.escapeHtml(currentKey)}">
            <span class="input-hint">Your key is never sent to our servers. All requests go directly from your browser to Google's API.</span>
          </div>
        </div>
        <div class="modal-footer">
          ${currentKey ? '<button class="btn-subtle btn-danger-subtle" id="btn-remove-gemini-key">Remove Key</button>' : ''}
          <div class="footer-actions-right">
            <button class="btn-subtle" id="btn-cancel-gemini-modal">Cancel</button>
            <button class="btn-primary" id="btn-save-gemini-key">Save Settings</button>
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

    if (saveBtn && inputKey) {
      saveBtn.addEventListener('click', () => {
        DocumentSummarizer.setApiKey(inputKey.value);
        if (modelSelect) {
          DocumentSummarizer.setSelectedModel(modelSelect.value);
        }
        closeModal();
        this.render();
        const activeModelName = availableModels.find(m => m.id === (modelSelect?.value || currentModel))?.name || 'Gemini 2.0 Flash';
        showToast(`${activeModelName} settings saved! High-accuracy auto-summarization is active.`, 'success');
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        DocumentSummarizer.setApiKey('');
        closeModal();
        this.render();
        showToast('Gemini API Key removed. Offline mode active.', 'info');
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
