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

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="section-title">Smart Pedagogical Reading Desk 📖🌿</h2>
          <p class="section-desc">Upload course readings, DepEd orders, or slide decks to extract verbatim text and generate research-backed Cornell study sheets.</p>
        </div>
        <div class="header-actions">
          <button class="btn-subtle" id="btn-open-gemini-modal">
            <span>🔑 ${hasKey ? 'Gemini Key Configured ✓' : 'Setup Free Gemini Key'}</span>
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
      <div class="reading-view-body">
        <!-- View A: Pedagogical Synthesis -->
        <div class="synthesis-panel" id="synthesis-panel" style="${this.activeSubTab === 'synthesis' ? 'display: block;' : 'display: none;'}">
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
        <div class="verbatim-panel" id="verbatim-panel" style="${this.activeSubTab === 'verbatim' ? 'display: block;' : 'display: none;'}">
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
    const sumMatch = md.match(/Macro-Synthesis[^\n:]*:\*\*\s*([^\n]+)/i);
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

    // Extract Summary
    let summaryText = 'Distill core ideas into an enduring understanding.';
    const sumMatch = md.match(/Macro-Synthesis[^\n:]*:\*\*\s*([^\n]+)/i);
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
        return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
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
      return `<div class="pedagogical-card card-chunks"><h3 class="card-header-chunks">2. 🧩 Structured Concept Chunks</h3><div class="card-body-content">${this.simpleMarkdown(c.replace('2. 🧩 Structured Concept Chunks', ''))}</div></div>`;
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
            <button class="btn-primary btn-save-questions-to-reviewer" id="btn-save-questions-to-reviewer" title="Save these practice questions to your permanent LET reviewer deck">
              <span>➕ Save Questions to Reviewer</span>
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
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[((?:Page|Slide|Section|Unit)\s+\d+(?::\s*[^\]]+)?|Primary Text Extraction)\]/gi, '<span class="citation-pill">📌 $1</span>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '<br><br>');
  }

  renderInteractiveQuiz(rawQuizText) {
    const questionBlocks = rawQuizText.split(/\*\*Question \d+:\*\*/g).filter(b => b.trim().length > 0);
    
    return questionBlocks.map((block, idx) => {
      const qNum = idx + 1;
      let answerMatch = block.match(/\*\*Correct Answer:\*\*\s*([A-D])/i);
      let answer = answerMatch ? answerMatch[1].toUpperCase() : 'A';
      let rationaleMatch = block.match(/\*\*Pedagogical Rationalization:\*\*\s*([\s\S]*?)(?=(?:Question|$))/i);
      let rationale = rationaleMatch ? rationaleMatch[1].trim() : 'Active recall tests deep conceptual alignment.';

      let promptAndOptions = block
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
        this.activeSubTab = 'synthesis';
        this.render();
      });
    }

    if (subtabCornell) {
      subtabCornell.addEventListener('click', () => {
        this.activeSubTab = 'cornell';
        this.render();
      });
    }

    if (subtabVerbatim) {
      subtabVerbatim.addEventListener('click', () => {
        this.activeSubTab = 'verbatim';
        this.render();
      });
    }

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
        const md = this.currentAnalysis?.markdown || '';
        const docTitle = this.currentDoc?.filename || 'Document Reading';
        
        // Extract question blocks
        const qSection = md.split(/### 5\. 🎯 Licensure/i)[1] || '';
        const rawQuestions = qSection.split(/\*\*Question \d+:\*\*/g).filter(b => b.trim().length > 0);
        
        const parsedQuestions = rawQuestions.map(block => {
          const ansMatch = block.match(/\*\*Correct Answer:\*\*\s*([A-D])/i);
          const rationaleMatch = block.match(/\*\*Pedagogical Rationalization:\*\*\s*([\s\S]*?)(?=(?:Question|$))/i);
          const prompt = block.replace(/\*\*Correct Answer:\*\*[\s\S]*$/, '').trim();
          
          const options = [];
          const optLines = block.match(/- [A-D]\) .+/g);
          if (optLines) {
            optLines.forEach(l => options.push(l.replace(/^- /, '')));
          }

          return {
            prompt,
            options,
            correctAnswer: ansMatch ? ansMatch[1].toUpperCase() : 'A',
            rationale: rationaleMatch ? rationaleMatch[1].trim() : 'Active recall practice'
          };
        });

        const event = new CustomEvent('pedagogo:save-questions-to-reviewer', {
          detail: {
            questions: parsedQuestions,
            title: docTitle
          }
        });
        window.dispatchEvent(event);

        btnSaveQuestions.innerHTML = '✓ <span>Saved to LET Reviewer!</span>';
        setTimeout(() => {
          btnSaveQuestions.innerHTML = '<span>➕ Save Questions to Reviewer</span>';
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

      // Verify readable text was actually extracted
      const cleanContent = (extractedDoc.rawText || '').replace(/--- \[Page \d+ of \d+\] ---/g, '').trim();
      if (!cleanContent || cleanContent.length < 5) {
        throw new Error(`No readable digital text could be found in "${file.name}". If this is a scanned photocopy or image-only PDF, please upload a document with digital selectable text, or a Word (.docx) file.`);
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

  loadSample(sample) {
    this.currentDoc = {
      filename: sample.title + '.' + sample.fileType.toLowerCase(),
      fileType: sample.fileType,
      totalUnits: sample.totalUnits,
      unitLabel: sample.unitLabel,
      rawText: sample.rawText,
      units: [
        { unitNumber: 1, title: 'Page 1', text: 'Module 3: Child and Adolescent Development\nCognitive Development Foundations: Jean Piaget and Lev Vygotsky' },
        { unitNumber: 2, title: 'Page 2', text: 'Jean Piaget: Cognitive Constructivism & Stages\nPiaget proposed that cognitive development originates from within the individual through autonomous physical and mental manipulation of the environment...' },
        { unitNumber: 3, title: 'Page 3', text: 'Lev Vygotsky: Socio-Cultural Theory & The ZPD\nIn contrast, Lev Semionovich Vygotsky posited that cognitive development originates externally through social interaction and cultural tools, particularly language...' }
      ]
    };

    this.currentAnalysis = {
      source: 'LOCAL_PEDAGOGICAL_ENGINE',
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
