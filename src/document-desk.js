/**
 * Pedagogo Desk: Document Reading Desk Component 📖🌿
 * Orchestrates client-side file reading, search, and research-backed 5-part pedagogical synthesis.
 */

import { DocumentParser } from './document-parser.js';
import { DocumentSummarizer } from './document-summarizer.js';

export class DocumentDesk {
  constructor() {
    this.currentDoc = null;
    this.currentAnalysis = null;
    this.activeSubTab = 'synthesis'; // 'synthesis' or 'verbatim'
    this.searchQuery = '';
    this.isProcessing = false;

    this.container = document.getElementById('view-reading-desk');
    if (this.container) {
      this.render();
      this.bindEvents();
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
          <p class="section-desc">Upload course readings, DepEd orders, or slide decks to extract word-for-word text and generate research-backed study syntheses.</p>
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
        <input type="file" id="file-document-input" accept=".pdf,.docx,.pptx,.txt,.md" style="display: none;">
        <div class="dropzone-icon">📥</div>
        <h3 class="dropzone-title">Drop your educational reading here</h3>
        <p class="dropzone-hint">Supports <strong>PDF</strong>, Word (<strong>.docx</strong>), PowerPoint (<strong>.pptx</strong>), or plain text. 100% parsed locally in your browser.</p>
        
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
          <span class="format-pill">📕 PDF Word-for-Word</span>
          <span class="format-pill">📘 Word DOCX</span>
          <span class="format-pill">📙 PowerPoint Slides &amp; Notes</span>
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
          </div>
        </div>

        <!-- Sub-tab Perspective Switcher: Verbatim vs Synthesis -->
        <div class="reading-subtabs">
          <button class="reading-subtab ${this.activeSubTab === 'synthesis' ? 'active' : ''}" data-subtab="synthesis" id="btn-subtab-synthesis">
            <span>💡 Pedagogical Synthesis (Research-Backed)</span>
          </button>
          <button class="reading-subtab ${this.activeSubTab === 'verbatim' ? 'active' : ''}" data-subtab="verbatim" id="btn-subtab-verbatim">
            <span>📖 Verbatim Transcript (Word-for-Word)</span>
          </button>
        </div>

        <!-- Actions -->
        <div class="workspace-actions">
          <button class="btn-subtle" id="btn-copy-reading-text" title="Copy active view text">
            📋 <span>Copy</span>
          </button>
          <button class="btn-subtle" id="btn-print-reading-guide" title="Print this study guide">
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
              🌱 ${analysis?.source === 'GEMINI_API' ? 'Analyzed via Gemini Flash AI' : 'Pedagogical Framework Engine'}
            </span>
            <span class="synthesis-frameworks-badge">
              ✓ Cornell Notes • ✓ Cognitive Chunking • ✓ Feynman Analogy • ✓ Contrastive Matrix • ✓ LET Practice
            </span>
          </div>
          <div class="synthesis-content-render" id="synthesis-rendered-area">
            ${this.renderSynthesisMarkdown(analysis?.markdown || '')}
          </div>
        </div>

        <!-- View B: Verbatim Word-for-Word Reader -->
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

  renderSynthesisMarkdown(md) {
    if (!md) return '<p class="empty-text">No analysis available.</p>';

    // Parse sections and render rich pedagogical cards
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

    // Parse headings
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
      return `<div class="pedagogical-card card-retrieval"><h3 class="card-header-retrieval">5. 🎯 Licensure (LET) Retrieval Practice</h3><div class="card-body-content retrieval-body">${this.renderInteractiveQuiz(c)}</div></div>`;
    });

    return html;
  }

  simpleMarkdown(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '<br><br>');
  }

  renderInteractiveQuiz(rawQuizText) {
    // Split into individual questions
    const questionBlocks = rawQuizText.split(/\*\*Question \d+:\*\*/g).filter(b => b.trim().length > 0);
    
    return questionBlocks.map((block, idx) => {
      const qNum = idx + 1;
      
      // Extract answer & rationalization
      let answerMatch = block.match(/\*\*Correct Answer:\*\*\s*([A-D])/i);
      let answer = answerMatch ? answerMatch[1].toUpperCase() : 'A';
      let rationaleMatch = block.match(/\*\*Pedagogical Rationalization:\*\*\s*([\s\S]*?)(?=(?:Question|$))/i);
      let rationale = rationaleMatch ? rationaleMatch[1].trim() : 'Active recall tests deep conceptual alignment.';

      // Strip answer lines from displayed prompt
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
    const subtabVerbatim = document.getElementById('btn-subtab-verbatim');
    const searchInput = document.getElementById('verbatim-search-input');
    const btnClearSearch = document.getElementById('btn-clear-search');
    const btnCopy = document.getElementById('btn-copy-reading-text');
    const btnPrint = document.getElementById('btn-print-reading-guide');

    if (btnBack) {
      btnBack.addEventListener('click', () => {
        this.currentDoc = null;
        this.currentAnalysis = null;
        this.searchQuery = '';
        this.render();
      });
    }

    if (subtabSynthesis && subtabVerbatim) {
      subtabSynthesis.addEventListener('click', () => {
        this.activeSubTab = 'synthesis';
        this.render();
      });
      subtabVerbatim.addEventListener('click', () => {
        this.activeSubTab = 'verbatim';
        this.render();
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

    // Unit jump pills
    document.querySelectorAll('.unit-jump-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
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
      this.updateLoadingDesc('Running 5-Part Pedagogical Synthesis (Cornell, Chunks, Feynman, Matrix, LET)...');

      const analysis = await DocumentSummarizer.summarize(extractedDoc);
      
      this.currentDoc = extractedDoc;
      this.currentAnalysis = analysis;
      this.activeSubTab = 'synthesis';
      this.hideLoading();
      this.render();
    } catch (err) {
      this.hideLoading();
      alert(`Could not process document: ${err.message}`);
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

    modal.innerHTML = `
      <div class="modal-card gemini-modal-card">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <span class="modal-icon">🔑</span>
            <h3>Google Gemini Free-Tier Setup</h3>
          </div>
          <button class="modal-close" id="btn-close-gemini-modal">✕</button>
        </div>
        <div class="modal-body">
          <p class="gemini-modal-desc">
            To generate live, unlimited pedagogical summaries for your own documents at <strong>$0.00 cost</strong>, enter your free Google Gemini API key.
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
              ✓ Free Tier: 15 requests/min • 1,500 requests/day • 1,000,000 token context
            </div>
          </div>

          <div class="form-group">
            <label for="gemini-api-key-input">Your Gemini API Key:</label>
            <input type="password" id="gemini-api-key-input" class="form-input" placeholder="AIzaSy..." value="${this.escapeHtml(currentKey)}">
            <span class="input-hint">Your key is never sent to our servers. All requests go directly to Google's API.</span>
          </div>
        </div>
        <div class="modal-footer">
          ${currentKey ? '<button class="btn-subtle btn-danger-subtle" id="btn-remove-gemini-key">Remove Key</button>' : ''}
          <div class="footer-actions-right">
            <button class="btn-subtle" id="btn-cancel-gemini-modal">Cancel</button>
            <button class="btn-primary" id="btn-save-gemini-key">Save Key</button>
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

    const closeModal = () => modal.classList.remove('active');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (saveBtn && inputKey) {
      saveBtn.addEventListener('click', () => {
        DocumentSummarizer.setApiKey(inputKey.value);
        closeModal();
        this.render();
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        DocumentSummarizer.setApiKey('');
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
