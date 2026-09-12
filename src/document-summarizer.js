import synthesisPromptV1 from './prompts/reading-synthesis.v1.md?raw';
import quickPromptV1 from './prompts/summary-quick.v1.md?raw';

/**
 * Pedagogo Desk: Pedagogical Document Summarizer & AI Engine 🧠🌿
 * Grounded in Cognitive Psychology & Learning Sciences:
 * 1. Cornell Synthesis Header (Pauk, Cornell University)
 * 2. Structured Concept Chunks (Sweller's Cognitive Load Theory)
 * 3. "Teach It Simply" Classroom Analogy (Dunlosky et al. / Feynman Technique)
 * 4. Contrastive Analysis Matrix (Gentner's Structure-Mapping Theory)
 * 5. Licensure (LET) Retrieval Practice (Roediger & Karpicke Testing Effect)
 *
 * System prompt is versioned in `src/prompts/reading-synthesis.v1.md`
 * and bundled via Vite `?raw`. Embedded fallback preserved for offline safety.
 */

export class DocumentSummarizer {
  static STORAGE_KEY = 'pedagogo_gemini_key';
  static MODEL_STORAGE_KEY = 'pedagogo_gemini_model';
  static PROVIDER_STORAGE_KEY = 'pedagogo_ai_provider';
  static OPENAI_KEY_STORAGE_KEY = 'pedagogo_openai_key';
  static OPENAI_BASE_STORAGE_KEY = 'pedagogo_openai_base_url';
  static OPENAI_MODEL_STORAGE_KEY = 'pedagogo_openai_model';
  static PROMPT_VERSION = 'reading-synthesis.v1 (2026-09-12)';

  // Default project key loaded via Vite environment (VITE_GEMINI_API_KEY) or project fallback
  static DEFAULT_PROJECT_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || '';

  static getDefaultKey() {
    return this.DEFAULT_PROJECT_KEY ? this.DEFAULT_PROJECT_KEY.trim() : '';
  }

  static setDefaultKey(key) {
    this.DEFAULT_PROJECT_KEY = key ? key.trim() : '';
  }

  static getProvider() {
    try {
      const v = (localStorage.getItem(this.PROVIDER_STORAGE_KEY) || 'gemini').trim();
      return v === 'openai_compat' ? 'openai_compat' : 'gemini';
    } catch { return 'gemini'; }
  }

  static setProvider(pid) {
    try { localStorage.setItem(this.PROVIDER_STORAGE_KEY, pid === 'openai_compat' ? 'openai_compat' : 'gemini'); } catch {}
  }

  static getGeminiCustomKey() {
    try { return localStorage.getItem(this.STORAGE_KEY) || ''; } catch { return ''; }
  }

  static getOpenAIKey() {
    try { return localStorage.getItem(this.OPENAI_KEY_STORAGE_KEY) || ''; } catch { return ''; }
  }

  static setOpenAIKey(key) {
    try {
      if (key && key.trim()) localStorage.setItem(this.OPENAI_KEY_STORAGE_KEY, key.trim());
      else localStorage.removeItem(this.OPENAI_KEY_STORAGE_KEY);
    } catch {}
  }

  static getOpenAIBaseUrl() {
    try {
      const v = (localStorage.getItem(this.OPENAI_BASE_STORAGE_KEY) || 'https://api.openai.com/v1').trim().replace(/\/$/, '');
      return v || 'https://api.openai.com/v1';
    } catch { return 'https://api.openai.com/v1'; }
  }

  static setOpenAIBaseUrl(url) {
    try {
      const clean = (url || '').trim().replace(/\/$/, '');
      if (clean) localStorage.setItem(this.OPENAI_BASE_STORAGE_KEY, clean);
      else localStorage.removeItem(this.OPENAI_BASE_STORAGE_KEY);
    } catch {}
  }

  static getOpenAIModel() {
    try { return (localStorage.getItem(this.OPENAI_MODEL_STORAGE_KEY) || 'gpt-4o-mini').trim() || 'gpt-4o-mini'; }
    catch { return 'gpt-4o-mini'; }
  }

  static setOpenAIModel(model) {
    try {
      if (model && model.trim()) localStorage.setItem(this.OPENAI_MODEL_STORAGE_KEY, model.trim());
      else localStorage.removeItem(this.OPENAI_MODEL_STORAGE_KEY);
    } catch {}
  }

  static getOpenAIPresets() {
    return [
      { baseUrl: 'https://api.stepfun.com/v1', name: 'StepFun (Step 3.7 Flash)', model: 'step-3.7-flash' },
      { baseUrl: 'https://api.openai.com/v1', name: 'OpenAI', model: 'gpt-4o-mini' },
      { baseUrl: 'https://api.groq.com/openai/v1', name: 'Groq', model: 'llama-3.3-70b-versatile' },
      { baseUrl: 'https://openrouter.ai/api/v1', name: 'OpenRouter', model: 'meta-llama/llama-3.3-70b-instruct' },
      { baseUrl: 'https://api.deepseek.com/v1', name: 'DeepSeek', model: 'deepseek-chat' },
      { baseUrl: 'http://localhost:11434/v1', name: 'Ollama (local)', model: 'llama3.1' },
      { baseUrl: 'http://localhost:1234/v1', name: 'LM Studio (local)', model: 'local-model' }
    ];
  }

  static getActiveProviderLabel() {
    return this.getProvider() === 'openai_compat'
      ? ('OpenAI-Compatible (' + this.getOpenAIModel() + ')')
      : ('Gemini 2.0 (' + this.getSelectedModel() + ')');
  }

  static getCustomKey() {
    // Legacy accessor: active provider's custom key (keeps old call sites working).
    if (this.getProvider() === 'openai_compat') return this.getOpenAIKey();
    return this.getGeminiCustomKey();
  }

  static getApiKey() {
    // OpenAI-compatible slot uses its own key only (never the Gemini project key).
    if (this.getProvider() === 'openai_compat') {
      const k = this.getOpenAIKey().trim();
      return (k && k.length > 8) ? k : '';
    }
    // 1. Prioritize custom key explicitly entered by user in localStorage
    const custom = this.getGeminiCustomKey().trim();
    if (custom && custom.length > 10) {
      return custom;
    }

    // 2. Fall back to project default key (from .env or config)
    const defaultKey = this.getDefaultKey().trim();
    if (defaultKey && defaultKey.length > 10) {
      return defaultKey;
    }

    return '';
  }

  static isUsingDefaultKey() {
    if (this.getProvider() === 'openai_compat') return false;
    const custom = this.getGeminiCustomKey().trim();
    if (custom && custom.length > 10) return false;
    const defaultKey = this.getDefaultKey().trim();
    return Boolean(defaultKey && defaultKey.length > 10);
  }

  static setApiKey(key) {
    // Legacy accessor writes to the ACTIVE provider slot.
    if (this.getProvider() === 'openai_compat') { this.setOpenAIKey(key); return; }
    try {
      if (key) localStorage.setItem(this.STORAGE_KEY, key.trim());
      else localStorage.removeItem(this.STORAGE_KEY);
    } catch {}
  }

  static hasApiKey() {
    const key = this.getApiKey();
    if (this.getProvider() === 'openai_compat') return Boolean(key && key.length > 8);
    return Boolean(key && key.length > 10);
  }

  // Sprint A.5 — Gemini 2.5 Flash is the default (2.0 retired per Google 2026-09 docs).
  // 2.0/1.5 kept as silent fallbacks in summarize()'s retry chain, not in the dropdown.
  static getAvailableModels() {
    return [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recommended)', desc: 'Best balance: 1M context, stronger reasoning than 2.0, still fast + free tier' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite (Fastest)', desc: 'Cheapest/fastest; good for short readings on school WiFi' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Deep Reasoner)', desc: 'Slowest; use for dense theory / curriculum orders only' }
    ];
  }

  // Silent fallback chain for models removed from the dropdown (never shown in UI).
  static getLegacyFallbackModels() {
    return ['gemini-2.0-flash', 'gemini-1.5-flash'];
  }

  static getSelectedModel() {
    const stored = (() => { try { return localStorage.getItem(this.MODEL_STORAGE_KEY) || ''; } catch { return ''; } })();
    const valid = this.getAvailableModels().map(m => m.id);
    // Migrate stale stored values (e.g. 2.0/1.5) to the new default.
    if (stored && valid.includes(stored)) return stored;
    return 'gemini-2.5-flash';
  }

  /**
   * Sprint A — in-app BYOK test call: verifies a pasted key with a tiny
   * Gemini request before saving, so students get instant success/failure.
   * Returns { ok: true, model } or { ok: false, message }.
   */
  static async testApiKey(apiKey, modelId = 'gemini-2.5-flash') {
    const key = (apiKey || '').trim();
    if (!key || key.length < 10) {
      return { ok: false, message: 'That key looks too short — paste the full key from AI Studio.' };
    }
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(key)}`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ok' }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 8 }
        })
      });
      if (res.ok) return { ok: true, model: modelId };
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson?.error?.message || `HTTP ${res.status}`;
      return { ok: false, message: msg };
    } catch (err) {
      return { ok: false, message: (err && err.message) || 'Network error — check connection and retry.' };
    }
  }

  // --- OpenAI-compatible chat path (BYOK slot) ---
  static async testOpenAIKey(apiKey, baseUrl, model) {
    const key = (apiKey || '').trim();
    const base = (baseUrl || '').trim().replace(/\/$/, '');
    const mdl = (model || '').trim();
    if (!key || key.length < 8) return { ok: false, message: 'That key looks too short.' };
    if (!base || !/^https?:\/\//i.test(base)) return { ok: false, message: 'Base URL must start with http(s)://' };
    if (!mdl) return { ok: false, message: 'Enter a model name.' };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    try {
      const resp = await fetch(base + '/chat/completions', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({
          model: mdl,
          messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
          max_tokens: 8,
          temperature: 0
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = (data && data.error && data.error.message) ? data.error.message : ('HTTP ' + resp.status);
        return { ok: false, message: String(msg).slice(0, 220) };
      }
      const text = (((data.choices || [])[0] || {}).message || {}).content || '';
      if (!text.trim()) return { ok: false, message: 'Connected, but got an empty reply. Check the model name.' };
      return { ok: true, model: mdl };
    } catch (err) {
      if (err && err.name === 'AbortError') return { ok: false, message: 'Timed out. Check the base URL (local server running?) and retry.' };
      return { ok: false, message: 'Network error: ' + String((err && err.message) || err).slice(0, 160) };
    } finally { clearTimeout(timer); }
  }

  static async completeWithOpenAI(prompt, opts) {
    // Sprint A.5: StepFun step-* models accept `reasoning_effort` (low/medium/high).
    // Default 'medium' = recommended general reasoning; ignored by non-StepFun endpoints.
    const maxTokens = (opts && opts.maxTokens) || 8192;
    const reasoningEffort = (opts && opts.reasoningEffort) || 'medium';
    const base = this.getOpenAIBaseUrl();
    const key = this.getOpenAIKey().trim();
    const mdl = this.getOpenAIModel();
    const resp = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify((() => {
        const payload = {
          model: mdl,
          messages: [
            { role: 'system', content: 'You are an expert instructional designer for Philippine teacher education (DepEd/CHED-aligned).' },
            { role: 'user', content: prompt }
          ],
          max_tokens: maxTokens,
          temperature: 0.2
        };
        if (/^step-/i.test(mdl)) payload.reasoning_effort = reasoningEffort;
        return payload;
      })())
    });
    const data = await resp.json().catch(() => { throw new Error('Invalid JSON from AI endpoint (HTTP ' + resp.status + ')'); });
    if (!resp.ok) {
      const msg = (data && data.error && data.error.message) ? data.error.message : ('HTTP ' + resp.status);
      throw new Error(String(msg).slice(0, 300));
    }
    const text = (((data.choices || [])[0] || {}).message || {}).content || '';
    if (!text.trim()) throw new Error('AI returned an empty response. Try again or switch model.');
    return text;
  }


  static setSelectedModel(modelId) {
    localStorage.setItem(this.MODEL_STORAGE_KEY, modelId || 'gemini-2.5-flash');
  }

  /**
   * Research-grounded system prompt, versioned in `src/prompts/reading-synthesis.v1.md`.
   * Bundled at build time via Vite `?raw`. Never fetch at runtime (offline safety).
   * Falls back to the embedded contract if the bundled import is empty.
   */
  static getSystemPrompt() {
    if (typeof synthesisPromptV1 === 'string' && synthesisPromptV1.trim().length > 200) {
      return synthesisPromptV1.trim();
    }
    return this.getFallbackPrompt();
  }

  static getPromptVersion() {
    return this.PROMPT_VERSION;
  }

  /**
   * Embedded fallback — mirrors reading-synthesis.v1.md headings + budgets.
   * Used only if the bundled .md import fails (offline / bundler edge).
   */
  static getFallbackPrompt() {
    return `You are Pedagogo AI, a world-class cognitive learning specialist and master teacher educator.
Your mission is to transform dense educational, academic, and pedagogical reading materials (curriculum guides, textbook chapters, developmental theories, DepEd orders, or lecture slides) into an exemplary, high-retention study guide for pre-service teachers and education students.

CRITICAL ACCURACY & GROUNDING RULES (boundaries — never break):
1. CITATION BADGES: Every bullet in sections 1, 2, 4 ends with [Page X] / [Slide Y]. Every Term Bank row ends with one too. If unsure, write [Source unclear] — never guess.
2. STRICT GROUNDING: Stick to the text. Do NOT invent DepEd orders, authors, dates, or stats. If not stated, write "Not stated in this text."
3. TERM FIRST: Extract 5-8 load-bearing terms actually IN the text. Gloss the IN-TEXT meaning.
4. WORD BUDGETS: TL;DR <= 60 words. Each chunk 60-80 words. Each term row 25 words max. Whole response <= 1100 words. Max 3 chunks; 2 strong beats 3 weak.
5. FORMATTING CONTRACT: Output EXACTLY the five headings below, in order. Keep --- separators. Term Bank lives INSIDE Section 2 as a table. LET answers as options A-D then Correct Answer + Rationalization lines. Fill-ins as numbered blanks then Answer + Why lines.

### 1. 🎓 Cornell Synthesis & Active Cues
- **TL;DR [Primary Text Extraction]:** 2 sentences, <= 60 words.
- **Why It Matters:** 1 sentence classroom / LET transfer, PLUS which study type to start with (Familiarize / Understand / Memorize) and why in 8 words or fewer.
- **Active Recall Cue Questions:** exactly 3 open-ended Who/Why/How questions for Cornell cues.

### 2. 🧩 Structured Concept Chunks
Part A - Term Bank (familiarize FIRST): 4-column table with header Term | In-Text Meaning (15 words max) | Memory Anchor | Source. 5-8 rows, one term per row. Memory Anchor 5 words max.
Part B - Chunks (understand NEXT): Max 3 chunks, each 60-80 words, bolded title + keywords + citation. One idea per chunk.
- If only 2 ideas exist, output 2 and write "Only two load-bearing ideas in this text."

### 3. 🧑‍🏫 "Teach It Simply" (Classroom Translation)
- **In Plain Words:** 2 sentences, Grade 8 level.
- **The Concrete Analogy:** 1 classroom / Filipino-life analogy.
- **Novice Misconception Alert:** 1 sentence mistake + correction.

### 4. ⚖️ Contrastive Analysis Matrix
- ONLY if the text truly contrasts two ideas: 3-column table with header Comparison Dimension | Focus Area A | Focus Area B, 2-3 rows with citations.
- ELSE output exactly: No meaningful contrast in this text — focus on mastery of the chunks above. Never force a comparison.

### 5. 🎯 Licensure (LET) Retrieval Practice Checkpoint
Part A - 2 scenario MCQs (application): Format:
  **Question N:** [scenario stem]
  - A) [Option]
  - B) [Option]
  - C) [Option]
  - D) [Option]
  - **Correct Answer:** [Letter]
  - **Pedagogical Rationalization:** [1-2 sentences + citation].
Part B - 3 term fill-ins (terminology): Format:
  **Fill-in N:** [sentence with _____ blank + 6-word hint]
  - **Answer:** [term]
  - **Why:** [1 sentence gloss + citation].
Part C - Study Next: one line naming Familiarize / Understand / Memorize + action + spacing.

Maintain an encouraging, rigorous tone throughout. Total response <= 1100 words.`;
  }

  /**
   * Run pedagogical analysis on extracted text or native multimodal document.


   * If no key is set, runs our client-side TextRank extractive NLP engine in-browser.
   */
  // Sprint A.5 helper: long/dense docs where Pro is worth suggesting (toast only, never auto-switch).
  static shouldSuggestPro(extractedDoc) {
    try {
      const chars = (extractedDoc && extractedDoc.rawText ? extractedDoc.rawText.length : 0)
        || ((extractedDoc && extractedDoc.units) || []).reduce((s, u) => s + ((u && u.text) || '').length, 0);
      const units = (extractedDoc && extractedDoc.totalUnits) || ((extractedDoc && extractedDoc.units) || []).length || 0;
      return chars > 130000 || units > 200;
    } catch { return false; }
  }

  /**
   * Sprint B — summary type catalog ("what do you need from this file?").
   * Labelled by GOAL, not by format, so the choice scaffolds SRL forethought
   * instead of inviting choice overload.
   */
  static SUMMARY_TYPES = [
    { id: 'study', icon: '📘', title: 'Study Sheet', desc: 'Full Cornell study sheet + practice questions.', why: 'For textbook readings and chapters you must master.' },
    { id: 'quick', icon: '⚡', title: 'Quick Look', desc: 'What this file says in ~5 bullets.', why: 'For before class, or skimming an order or slide deck.' },
    { id: 'reviewer', icon: '🎯', title: 'LET Reviewer Pack', desc: 'Practice cards + instant mini-quiz, then push to LET Reviewer.', why: 'For anything you have to memorize.' }
  ];

  /**
   * Sprint B — smart default: pre-select the summary type most aligned with
   * the document's shape. The user can always override.
   */
  static getRecommendedSummaryType(extractedDoc) {
    const name = String((extractedDoc && extractedDoc.filename) || '').toLowerCase();
    if (/(order|memo|memorandum|deped|advisory)/i.test(name)) return 'reviewer';
    const ft = String((extractedDoc && extractedDoc.fileType) || '').toLowerCase();
    if (ft === 'pptx' || ft === 'ppt' || /(slide|deck|handout|notes)/i.test(name)) return 'quick';
    return 'study';
  }

  static getQuickPrompt() {
    return quickPromptV1;
  }

  /**
   * Sprint B — Quick Look: a lighter, cheaper, faster summary contract.
   * Falls back to a compact local extract when no key exists.
   */
  static async summarizeQuick(extractedDoc) {
    // OpenAI-compatible BYOK slot (incl. StepFun): quick prompt, smaller budget.
    if (this.getProvider() === 'openai_compat' && this.getOpenAIKey().trim()) {
      const text = await this.completeWithOpenAI(this.getQuickPrompt() + '\n\n' + this._buildQuickHeader(extractedDoc), { maxTokens: 2048 });
      return { source: 'QUICK_LOOK', modelName: this.getOpenAIModel(), markdown: text, analyzedAt: new Date().toISOString() };
    }
    const result = await this._runGeminiForPrompt(this.getQuickPrompt() + '\n\n' + this._buildQuickHeader(extractedDoc), extractedDoc, 2048);
    if (result) {
      return { source: 'QUICK_LOOK', modelName: result.modelName, isMultimodal: result.isMultimodal, markdown: result.text, analyzedAt: new Date().toISOString() };
    }
    return { source: 'QUICK_LOOK', modelName: 'Client-Side TextRank (Offline)', markdown: this._buildFallbackQuickLook(extractedDoc), analyzedAt: new Date().toISOString() };
  }

  static async summarize(extractedDoc) {
    // OpenAI-compatible BYOK slot: same synthesis prompt, chat-completions transport.
    if (this.getProvider() === 'openai_compat') {
      const oKey = this.getOpenAIKey().trim();
      if (!oKey) {
        if (extractedDoc.filename && (extractedDoc.filename.toLowerCase().includes('sample') || extractedDoc.filename.toLowerCase().includes('piaget'))) {
          return this.generateFallbackAnalysis(extractedDoc);
        }
        return this.extractPedagogicalAnalysis(extractedDoc);
      }
      const oModel = this.getOpenAIModel();
      const oPrompt = this.getSystemPrompt() + "\n\nHere is the educational reading material to analyze:\n**Document Title:** " + extractedDoc.filename + " (" + extractedDoc.fileType + ")\n**Total Units:** " + extractedDoc.totalUnits + " " + extractedDoc.unitLabel + "\n\n**Verbatim Document Content:**\n" + extractedDoc.rawText.slice(0, 120000);
      const synthesis = await this.completeWithOpenAI(oPrompt, { maxTokens: 8192 });
      return { source: 'OPENAI_COMPAT_API', modelName: oModel, markdown: synthesis, analyzedAt: new Date().toISOString() };
    }
    const apiKey = this.getApiKey();

    // If no key is set:
    if (!apiKey) {
      if (extractedDoc.filename && (extractedDoc.filename.toLowerCase().includes('sample') || extractedDoc.filename.toLowerCase().includes('piaget'))) {
        return this.generateFallbackAnalysis(extractedDoc);
      }
      return this.extractPedagogicalAnalysis(extractedDoc);
    }

    const selectedModel = this.getSelectedModel();
    // Sprint A.5: selected model first, then silent legacy fallbacks (2.0/1.5).
    const modelsToTry = [selectedModel, ...this.getLegacyFallbackModels().filter(m => m !== selectedModel)];

    // Build prompt payload: check if multimodal inline document is available (PDF or Image)
    const canUseMultimodal = Boolean(extractedDoc.base64Data && (extractedDoc.fileType === 'PDF' || extractedDoc.fileType === 'IMAGE'));
    
    let parts = [];
    if (canUseMultimodal) {
      parts = [
        {
          text: `${this.getSystemPrompt()}\n\nPlease perform an exhaustive, high-accuracy pedagogical analysis of the following educational document:\n**Document Title:** ${extractedDoc.filename} (${extractedDoc.fileType})\n**Total Units:** ${extractedDoc.totalUnits} ${extractedDoc.unitLabel}`
        },
        {
          inlineData: {
            mimeType: extractedDoc.mimeType || (extractedDoc.fileType === 'PDF' ? 'application/pdf' : 'image/jpeg'),
            data: extractedDoc.base64Data
          }
        }
      ];
    } else {
      // High-capacity text prompt (up to 500,000 characters)
      parts = [
        {
          text: `${this.getSystemPrompt()}\n\nHere is the educational reading material to analyze:\n**Document Title:** ${extractedDoc.filename} (${extractedDoc.fileType})\n**Total Units:** ${extractedDoc.totalUnits} ${extractedDoc.unitLabel}\n\n**Verbatim Document Content:**\n${extractedDoc.rawText.slice(0, 500000)}`
        }
      ];
    }

    const promptPayload = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.15, // Low + stable: factual, on-format, low hallucination for study sheets
        topP: 0.9, // Slightly focused nucleus sampling: fewer off-format drifts, analogy still fresh
        topK: 32, // Constrain wild token choices on long docs without flattening the analogy
        maxOutputTokens: 8192
      }
    };

    // Try primary model, then fallback if needed
    for (const model of modelsToTry) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(promptPayload)
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          const errMsg = errJson?.error?.message || `HTTP ${response.status} ${response.statusText}`;
          console.warn(`Gemini API (${model}) returned error: ${errMsg}. Trying fallback if available.`);
          continue;
        }

        const data = await response.json();
        const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (generatedText && generatedText.trim().length > 50) {
          const modelMeta = this.getAvailableModels().find(m => m.id === model);
          return {
            source: 'GEMINI_API',
            modelName: modelMeta?.name || model,
            isMultimodal: canUseMultimodal,
            markdown: generatedText,
            analyzedAt: new Date().toISOString()
          };
        }
      } catch (err) {
        console.warn(`Fetch error for model ${model}:`, err);
      }
    }

    console.warn('All Gemini API attempts exhausted. Switching to local TextRank extractive engine.');
    return this.extractPedagogicalAnalysis(extractedDoc);
  }

  /**
   * Pre-computed, research-grade sample analyses for immediate zero-config demonstration.
   */
  static _buildQuickHeader(extractedDoc) {
    return 'Here is the educational reading material for a QUICK LOOK summary:\n'
      + '**Document Title:** ' + extractedDoc.filename + ' (' + extractedDoc.fileType + ')\n'
      + '**Total Units:** ' + extractedDoc.totalUnits + ' ' + extractedDoc.unitLabel + '\n\n'
      + '**Verbatim Document Content:**\n' + extractedDoc.rawText.slice(0, 120000);
  }

  /** Shared Gemini text call used by Quick Look only (never touches summarize()). */
  static async _runGeminiForPrompt(systemPrompt, extractedDoc, maxTokens) {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;
    const selectedModel = this.getSelectedModel();
    const modelsToTry = [selectedModel, ...this.getLegacyFallbackModels().filter(m => m !== selectedModel)];
    const canUseMultimodal = Boolean(extractedDoc.base64Data && (extractedDoc.fileType === 'PDF' || extractedDoc.fileType === 'IMAGE'));
    const parts = canUseMultimodal ? [
      { text: systemPrompt },
      { inlineData: { mimeType: extractedDoc.mimeType || (extractedDoc.fileType === 'PDF' ? 'application/pdf' : 'image/jpeg'), data: extractedDoc.base64Data } }
    ] : [{ text: systemPrompt }];
    const payload = {
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.15, topP: 0.9, topK: 32, maxOutputTokens: maxTokens || 8192 }
    };
    for (const model of modelsToTry) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) continue;
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 20) {
          const modelMeta = this.getAvailableModels().find(m => m.id === model);
          return { text: text.trim(), modelName: modelMeta?.name || model, isMultimodal: canUseMultimodal };
        }
      } catch (err) {
        console.warn(`Gemini quick (${model}) fetch error:`, err);
      }
    }
    return null;
  }

  /** Compact Quick Look built locally (no key): TL;DR + top chunk names + terms. */
  static _buildFallbackQuickLook(extractedDoc) {
    const full = this.extractPedagogicalAnalysis(extractedDoc);
    const md = full.markdown || '';
    const lines = [];
    lines.push('### 1. Quick Look (Local Extract)');
    const tldrMatch = md.match(/\*\*TL;DR[^\n]*\*\*\s*([^\n]+)/i);
    lines.push('- **TL;DR:** ' + ((tldrMatch && tldrMatch[1].trim()) || 'What this document covers, extracted locally from the text.').slice(0, 220));
    lines.push('- **Key Points:**');
    // Local engine emits "#### Chunk N: Title • [Page X]"; AI contract emits "**Chunk N — Name:**".
    const chunks = (md.match(/(?:#### |\*\*)Chunk\s*\d+\s*[:：—]\s*([^*\n•]{1,80})/gi) || [])
      .map(c => {
        const m = c.match(/[:：—]\s*([^*\n•]{1,80})/);
        return m ? m[1].trim() : c.replace(/^(?:#### |\*\*)/, '').trim();
      })
      .filter(Boolean).slice(0, 3);
    // Term bank body rows (skip the header row + any header-ish cells).
    const skipHeader = /^(term|in-text meaning|memory anchor|source)$/i;
    const bankTerms = (md.match(/^\|\s*\*\*?[^|\n]+?\*\*?\s*\|/gm) || [])
      .map(r => r.replace(/^\|\s*\*+/, '').replace(/\*+\s*\|$/, '').replace(/\|$/, '').trim())
      .filter(t => Boolean(t) && !skipHeader.test(t) && !/^(term|in-text meaning|memory anchor|source)$/i.test(t))
      .slice(0, 5);
    const points = chunks.slice(0, 3);
    if (bankTerms.length) points.push('Key terms: ' + bankTerms.join(', '));
    if (points.length === 0) points.push('Verify details against the Verbatim tab before trusting any claim.');
    points.slice(0, 5).forEach(p => lines.push('  1. ' + p.replace(/\s*\[(?:Page|Slide|Section|Unit)\s*\d+\]\s*$/i, '')));
    lines.push('- **Study Next:** Familiarize — cover the term meanings above, self-test once, then restudy in 1-3 days.');
    return lines.join('\n');
  }


  static getBuiltinSamples() {
    return [
      {
        id: 'sample-piaget-vygotsky',
        title: 'Piaget vs. Vygotsky: Developmental Theories in Education',
        fileType: 'PDF',
        unitLabel: 'Pages',
        totalUnits: 3,
        rawText: `--- [Page 1 of 3] ---
Module 3: Child and Adolescent Development
Cognitive Development Foundations: Jean Piaget and Lev Vygotsky

Introduction:
Pre-service teachers must understand how human cognition unfolds in order to design developmentally appropriate instruction. Two foundational theorists dominate modern pedagogical discourse: Jean Piaget (1896–1980) and Lev Vygotsky (1896–1934). While both reject behaviorist transmission models and view learners as active meaning-makers (constructivists), they diverge profoundly on the origin, mechanism, and trajectory of cognitive growth.

--- [Page 2 of 3] ---
Jean Piaget: Cognitive Constructivism & Stages
Piaget proposed that cognitive development originates from within the individual through autonomous physical and mental manipulation of the environment. Knowledge is organized into cognitive structures known as schemas. When a child encounters new stimuli, they experience cognitive disequilibrium. To restore equilibrium, the learner either assimilates the information into an existing schema or accommodates by modifying the schema. Piaget asserted that development precedes learning: a child cannot master abstract formal operations until biological maturation and neurological readiness occur across four universal stages:
1. Sensorimotor (0–2 years): Object permanence.
2. Preoperational (2–7 years): Egocentrism, symbolic play, lack of conservation.
3. Concrete Operational (7–11 years): Conservation, reversibility, classification.
4. Formal Operational (11+ years): Abstract reasoning, hypothetical-deductive logic.

--- [Page 3 of 3] ---
Lev Vygotsky: Socio-Cultural Theory & The ZPD
In contrast, Lev Semionovich Vygotsky posited that cognitive development originates externally through social interaction and cultural tools, particularly language. Vygotsky rejected universal biological stages, arguing instead that learning precedes development. Children internalize interpersonal dialogues into intrapersonal inner speech, which subsequently directs thought.
Central to Vygotsky's pedagogy is the Zone of Proximal Development (ZPD): the distance between a learner's actual development level (what they can accomplish independently) and their potential development level (what they can accomplish under adult guidance or in collaboration with more capable peers - MKO). Jerome Bruner later operationalized this through Scaffolding: temporary, calibrated pedagogical support gradually dismantled as the learner achieves autonomy.`,
        synthesis: `### 1. 🎓 Cornell Synthesis & Active Cues
- **Macro-Synthesis [Page 1]:** While both Piaget and Vygotsky agree that learners construct their own understanding rather than passively receiving data, Piaget argues that **biological maturation precedes learning** through internal equilibration, whereas Vygotsky proves that **social and cultural interaction precedes and pulls cognitive development forward**.
- **Active Recall Cue Questions:**
  1. *What distinguishes Piaget's concept of assimilation from accommodation during cognitive disequilibrium? [Page 2]*
  2. *How does Vygotsky's Zone of Proximal Development (ZPD) transform the traditional teacher-centered classroom into a collaborative learning environment? [Page 3]*
  3. *Why is language considered the primary psychological tool in Vygotskian cognitive development? [Page 3]*

---

### 2. 🧩 Structured Concept Chunks
- **Piagetian Cognitive Constructivism [Page 2]:**
  - **Schema & Equilibration:** Mental filing cabinets reorganized via *Assimilation* (fitting new data into existing boxes) and *Accommodation* (building new boxes).
  - **Development Precedes Learning:** Biological readiness is an absolute prerequisite; pushing formal logic onto a preoperational child causes rote compliance rather than true cognitive assimilation.
- **Vygotskian Socio-Cultural Constructivism [Page 3]:**
  - **Social Origin of Mind:** Thoughts originate as social dialogue before being internalized as private inner speech.
  - **Zone of Proximal Development (ZPD):** The sweet spot where instruction must reside—neither too simple (boredom) nor too difficult (frustration).
  - **More Knowledgeable Other (MKO) & Scaffolding:** Calibrated temporary bridges provided by teachers or capable peers.

---

### 3. 🧑‍🏫 "Teach It Simply" (Classroom Translation)
- **In Plain Words:** Piaget views the child as a **solitary little scientist** exploring the laboratory of the world with their own hands. Vygotsky views the child as an **eager young apprentice** learning a craft alongside a master craftsman in a busy workshop.
- **The Concrete Analogy:** Think of teaching a child to ride a bicycle. Piaget would say: *"Let the child explore balancing on a small trike until their motor cortex matures enough to manage pedals."* Vygotsky would say: *"Hold the back of the saddle (scaffolding) right inside their ZPD, run alongside them giving vocal cues, and slowly loosen your grip as their balance takes hold."*
- **Novice Misconception Alert:** Novice teachers often think scaffolding means doing part of the homework for the student. True scaffolding means structuring the task (prompts, graphic organizers, paired modeling) so the student executes the cognitive labor themselves.

---

### 4. ⚖️ Contrastive Analysis Matrix

| Comparison Dimension | Piaget (Cognitive Constructivism) | Vygotsky (Socio-Cultural Constructivism) |
| :--- | :--- | :--- |
| **Primary Driver of Growth** | Individual exploration & biological maturation [Page 2] | Social interaction, dialogue, & cultural tools [Page 3] |
| **Relationship of Learning & Dev.**| **Development precedes learning** (must be mature) | **Learning precedes development** (pulls growth) |
| **Role of Language** | Self-directed monologue reflecting egocentrism | Primary psychological tool for thought formation |
| **Teacher's Role** | Facilitator of hands-on, rich environments | Collaborator, mediator, and scaffolding architect |
| **Ideal Classroom Activity** | Discovery learning, science experiments, manipulation | Socratic circles, peer tutoring, cooperative learning |
| **Assessment Approach** | Individual readiness checklists and stage tests | Dynamic assessment testing potential within the ZPD |

---

### 5. 🎯 Licensure (LET) Retrieval Practice Checkpoint

**Question 1:** Teacher Maria notices that when 8-year-old Joshua struggles to solve a multi-step word problem alone, he succeeds when paired with a classmate who provides guiding prompts and hints. According to Vygotsky, where is Joshua operating?
- A) Formal Operational Stage
- B) Sensorimotor Equilibrium
- C) Zone of Proximal Development
- D) Egocentric Speech Plateau
- **Correct Answer:** **C**
- **Pedagogical Rationalization:** Joshua's ability to solve the problem with guided peer collaboration that he could not solve alone perfectly exemplifies performance within the Zone of Proximal Development (ZPD) [Page 3]. Option A is Piagetian and biologically inappropriate for an 8-year-old.

**Question 2:** In an elementary science class, Teacher Ben introduces the concept of mammals. A student insists that whales cannot be mammals because "they live in water like fish." Teacher Ben then shows a video explaining that whales breathe air and nurse their young, causing the student to adjust their mental definition of mammals. In Piaget's terminology, what process just took place?
- A) Assimilation
- B) Accommodation
- C) Object Permanence
- D) Classical Conditioning
- **Correct Answer:** **B**
- **Pedagogical Rationalization:** Accommodation occurs when a learner modifies an existing schema (or creates a new one) because new conflicting information cannot fit into the current framework [Page 2]. Assimilation (A) would only apply if the new fact fit without changing the category rule.

**Question 3:** Which teaching practice reflects a misinterpretation of Jerome Bruner's concept of educational scaffolding?
- A) Providing sentence frames during an essay pre-writing session.
- B) Modeling the first problem on the board before asking students to try problem two.
- C) Keeping permanent cue cards taped to student desks throughout the entire school year.
- D) Gradually withdrawing graphic organizers as students demonstrate mastery.
- **Correct Answer:** **C**
- **Pedagogical Rationalization:** The fundamental pedagogical criterion of scaffolding is that it is **temporary** and intentionally dismantled as learner independence increases [Page 3]. Leaving permanent cue cards (C) creates learned helplessness rather than true cognitive autonomy.`
      },
      {
        id: 'sample-child-protection',
        title: 'DepEd Order No. 40, s. 2012: Child Protection Policy',
        fileType: 'DOCX',
        unitLabel: 'Sections',
        totalUnits: 2,
        rawText: `DepEd Order No. 40, s. 2012: Policy and Guidelines on Protecting Children in School from Abuse, Violence, Exploitation, Discrimination, Bullying and Other Forms of Abuse.
Pursuant to the 1987 Constitution, the United Nations Convention on the Rights of the Child, and Republic Act No. 7610, the Department of Education adopts this Child Protection Policy.
Section 1: Zero-Tolerance Policy for Child Abuse and Exploitation. All schools must ensure a child-friendly, gender-sensitive, safe, and motivating learning environment.
Section 2: Positive and Non-Violent Discipline. Corporal punishment in any form (physical blows, humiliating public ridicule, forcing pupils to stay in uncomfortable postures) is strictly prohibited and subject to administrative sanction.
Section 3: Child Protection Committee (CPC). Every elementary and secondary school shall establish a CPC composed of the School Head, Guidance Counselor, Faculty Representative, Parent-Teacher Association President, Barangay Representative, and Student Council President.`,
        synthesis: `### 1. 🎓 Cornell Synthesis & Active Cues
- **Macro-Synthesis [Section 1]:** DepEd Order No. 40, s. 2012 establishes an unequivocal **zero-tolerance mandate against child abuse, exploitation, and corporal punishment** in Philippine schools, institutionalizing school-level Child Protection Committees (CPCs) and requiring educators to practice proactive, positive discipline.
- **Active Recall Cue Questions:**
  1. *What specific practices constitute illegal corporal punishment under DepEd regulations? [Section 2]*
  2. *Who are the mandatory multi-sectoral members of a school's Child Protection Committee (CPC)? [Section 3]*
  3. *How does positive discipline distinguish between managing behavior and inflicting punitive humiliation? [Section 2]*

---

### 2. 🧩 Structured Concept Chunks
- **Zero-Tolerance Stance [Section 1]:**
  - Absolute prohibition of corporal punishment, harsh verbal reprimands, and discriminatory practices across all public and private basic education institutions.
- **Child Protection Committee (CPC) Structure [Section 3]:**
  - Chaired by School Head, joined by Guidance Counselor/Designee, Faculty Rep, PTA President, Barangay Council Rep, and Supreme Pupil/Student Government President.
- **Positive Non-Violent Discipline [Section 2]:**
  - Replacement of punitive isolation with restorative problem-solving, behavioral reflection, and clear, respectful expectations.

---

### 3. 🧑‍🏫 "Teach It Simply" (Classroom Translation)
- **In Plain Words:** A school must be an emotional and physical sanctuary. A teacher is legally and morally bound to guide students without ever raising a hand, using sarcastic insults, or humiliating a learner in front of peers.
- **The Concrete Analogy:** Think of pruning a young sapling in a garden. You don't strike or stomp on the branches (corporal punishment); you gently tie a supportive wooden stake alongside the stem to guide it toward the light (positive discipline).
- **Novice Misconception Alert:** Pre-service teachers sometimes worry that positive discipline means letting students misbehave without consequences. In reality, positive discipline enforces clear, consistent, and logical boundaries—it just eliminates anger, sarcasm, and physical humiliation from the intervention.

---

### 4. ⚖️ Contrastive Analysis Matrix

| Comparison Dimension | Punitive / Corporal Punishment | Positive & Non-Violent Discipline |
| :--- | :--- | :--- |
| **Underlying Motivation** | Driven by teacher frustration, anger, or coercion | Driven by teaching self-regulation and empathy [Section 2] |
| **Learner's Emotional State** | Fear, shame, resentment, avoidance | Felt safety, accountability, mutual respect |
| **Long-Term Behavioral Impact** | Increases aggression and covert misbehavior | Develops internal moral compass and self-control |
| **DepEd Administrative Status** | **Strictly prohibited; grounds for dismissal** [Section 1] | **Mandated professional standard (PPST Domain 2)** |
| **Typical Intervention** | Shouting, kneeling on salt, public ridicule | Private conferencing, logical restitution, reflection |

---

### 5. 🎯 Licensure (LET) Retrieval Practice Checkpoint

**Question 1:** During a Grade 7 mathematics class, a pre-service teacher becomes exasperated when a pupil repeatedly fails to solve a fractions problem. The teacher orders the student to stand in the corner facing the wall for the remaining 40 minutes while wearing a paper cone labeled "Inattentive." Under DepEd Order No. 40, s. 2012, this action is classified as:
- A) Acceptable progressive discipline
- B) Prohibited corporal punishment and psychological degradation
- C) Permissible detention within school grounds
- D) Standard classroom remediation
- **Correct Answer:** **B**
- **Pedagogical Rationalization:** Publicly humiliating a student, forcing them into uncomfortable prolonged standing, or applying shaming labels constitutes prohibited corporal and psychological punishment under Section 2 of DepEd Order 40, s. 2012.

**Question 2:** Which of the following individuals is NOT a mandatory member of a public secondary school's Child Protection Committee (CPC)?
- A) President of the Parent-Teacher Association (PTA)
- B) School Guidance Counselor or Guidance Designee
- C) Municipal Mayor or District Congressman
- D) Barangay Council Representative
- **Correct Answer:** **C**
- **Pedagogical Rationalization:** The Child Protection Committee operates at the school-community level and includes the School Head, Guidance Counselor, Faculty Representative, PTA President, Barangay Council Representative, and Student Council President [Section 3]. High-level political officials like the Mayor or Congressman (C) are not part of the school CPC.`
      }
    ];
  }

  static generateFallbackAnalysis(extractedDoc) {
    const samples = this.getBuiltinSamples();
    const matched = samples.find(s => s.title.toLowerCase().includes(extractedDoc.filename.toLowerCase())) || samples[0];

    return {
      source: 'LOCAL_PEDAGOGICAL_ENGINE',
      modelName: 'Built-in Research Benchmark',
      markdown: matched.synthesis,
      analyzedAt: new Date().toISOString()
    };
  }

  /**
   * Client-side TextRank Graph NLP & Pedagogical Pattern Extractor.
   * Genuinely analyzes the user's uploaded document text in-browser when offline.
   */
  static extractPedagogicalAnalysis(extractedDoc) {
    const raw = extractedDoc.rawText || '';
    const filename = extractedDoc.filename || 'Educational Reading';
    const cleanTitle = filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

    // Normalize text into clean sentences
    const cleanText = raw.replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
    const sentences = cleanText
      .split(/(?<=[.?!])\s+(?=[A-Z0-9"“])/)
      .map(s => s.trim())
      .filter(s => s.length >= 30 && s.length <= 400);

    // Stopwords for academic English & pedagogical boilerplate
    const stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'for', 'nor', 'so', 'yet', 'of', 'in', 'to',
      'with', 'on', 'at', 'by', 'from', 'up', 'about', 'into', 'over', 'after', 'beneath',
      'under', 'above', 'is', 'am', 'are', 'was', 'were', 'be', 'being', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'shall', 'will', 'should', 'would', 'may',
      'might', 'must', 'can', 'could', 'that', 'which', 'who', 'whom', 'this', 'these',
      'those', 'then', 'there', 'here', 'when', 'where', 'why', 'how', 'all', 'any',
      'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not',
      'only', 'own', 'same', 'than', 'too', 'very', 'page', 'slide', 'section', 'unit',
      'figure', 'table', 'chapter', 'module', 'text', 'document', 'reading', 'also'
    ]);

    // Tokenize sentences into meaningful word sets
    const sentenceWordSets = sentences.map(s => {
      const words = (s.toLowerCase().match(/\b[a-z]{3,}\b/g) || []).filter(w => !stopWords.has(w));
      return new Set(words);
    });

    // Word frequencies
    const wordCounts = {};
    for (const wSet of sentenceWordSets) {
      for (const w of wSet) {
        wordCounts[w] = (wordCounts[w] || 0) + 1;
      }
    }

    // Top salient keywords
    const sortedKeywords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));

    const keyTerm1 = sortedKeywords[0] || 'Curricular Foundation';
    const keyTerm2 = sortedKeywords[1] || 'Instructional Strategy';
    const keyTerm3 = sortedKeywords[2] || 'Assessment Practice';

    // --- TextRank Graph Algorithm (Power Iteration) ---
    const n = sentences.length;
    let scores = new Array(n).fill(1.0);

    if (n > 1) {
      // Build similarity graph
      const weights = Array.from({ length: n }, () => new Array(n).fill(0));
      const degrees = new Array(n).fill(0);

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const setA = sentenceWordSets[i];
          const setB = sentenceWordSets[j];
          if (setA.size === 0 || setB.size === 0) continue;

          let intersection = 0;
          for (const word of setA) {
            if (setB.has(word)) intersection++;
          }

          if (intersection > 0) {
            const sim = intersection / (Math.log(setA.size + 1) + Math.log(setB.size + 1));
            weights[i][j] = sim;
            weights[j][i] = sim;
            degrees[i] += sim;
            degrees[j] += sim;
          }
        }
      }

      // 15 iterations of PageRank
      const d = 0.85;
      for (let iter = 0; iter < 15; iter++) {
        const nextScores = new Array(n).fill((1 - d));
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            if (i !== j && degrees[j] > 0) {
              nextScores[i] += d * (weights[j][i] / degrees[j]) * scores[j];
            }
          }
        }
        scores = nextScores;
      }
    }

    // Rank sentences by TextRank score
    const rankedSentences = sentences.map((sentence, idx) => ({
      sentence,
      score: scores[idx] || 0,
      idx
    }));

    rankedSentences.sort((a, b) => b.score - a.score);
    const centroidSentences = rankedSentences.slice(0, 3).sort((a, b) => a.idx - b.idx);
    const macroSynthesis = centroidSentences.length > 0
      ? centroidSentences.map(s => s.sentence).join(' ')
      : `This document establishes foundational pedagogical principles in ${cleanTitle}, articulating key conceptual structures and instructional considerations for educators.`;

    // --- Pedagogical Definition Pattern Extractor ---
    const definitionMatches = [];
    const definitionRegex = /(?:([A-Z][a-zA-Z\s]{2,30})\s+(?:is defined as|refers to|can be described as|means|is characterized by)\s+([^.;]{15,180}))/gi;

    for (const s of sentences) {
      let match;
      while ((match = definitionRegex.exec(s)) !== null) {
        if (match[1] && match[2]) {
          definitionMatches.push({
            term: match[1].trim(),
            definition: match[2].trim(),
            fullSentence: s
          });
        }
      }
      if (definitionMatches.length >= 4) break;
    }

    // --- Contrastive Pattern Extractor ---
    const contrastMatches = [];
    const contrastRegex = /(?:([^,.;]{10,80})\s+(?:whereas|unlike|in contrast to|on the other hand|as opposed to|while)\s+([^,.;]{10,80}))/gi;

    for (const s of sentences) {
      let match;
      while ((match = contrastRegex.exec(s)) !== null) {
        if (match[1] && match[2]) {
          contrastMatches.push({
            partA: match[1].trim(),
            partB: match[2].trim()
          });
        }
      }
      if (contrastMatches.length >= 2) break;
    }

    // --- Unit-Aware Concept Chunks ---
    const units = extractedDoc.units || [];
    let chunksMarkdown = '';

    if (units.length > 0) {
      chunksMarkdown = units.slice(0, 4).map((u, i) => {
        const uLines = u.text.split('\n').map(l => l.trim()).filter(l => l.length > 30);
        const excerpt = uLines.slice(0, 2).join(' ') || u.text.slice(0, 240);
        const chunkTitle = sortedKeywords[i] || `Pedagogical Framework (Part ${i + 1})`;
        return `#### Chunk ${i + 1}: ${chunkTitle} • [${u.title || 'Unit ' + (i + 1)}]
- **Salient Principle:** "${excerpt}"
- **Classroom Impact:** Provides pre-service educators with direct, evidence-based guidance for structuring learning activities and managing student cognitive demand.`;
      }).join('\n\n');
    } else {
      chunksMarkdown = `#### Chunk 1: Foundations of ${keyTerm1}
- **Salient Principle:** ${centroidSentences[0]?.sentence || sentences[0]}

#### Chunk 2: Instructional Execution of ${keyTerm2}
- **Salient Principle:** ${centroidSentences[1]?.sentence || sentences[1]}`;
    }

    // --- Active Recall Cues ---
    const cueQuestions = [
      `How does the text define the scope and pedagogical rationale of **${keyTerm1}**?`,
      `What specific classroom scaffolding is required to successfully implement **${keyTerm2}**?`,
      `In what ways does **${keyTerm3}** support authentic learner growth and assessment alignment?`
    ];

    // --- Contrastive Matrix ---
    let matrixRowA = `| **Primary Orientation** | Emphasizes foundational theoretical grounding | Emphasizes practical procedural execution |`;
    let matrixRowB = `| **Instructional Dynamic** | Teacher clarifies parameters & baseline schemas | Learners collaborate & execute authentic tasks |`;

    if (contrastMatches.length > 0) {
      const c = contrastMatches[0];
      matrixRowA = `| **Differentiating Factor** | ${c.partA} | ${c.partB} |`;
    }

    // --- Grounded LET Questions ---
    const def1 = definitionMatches[0];
    const q1Stem = def1 
      ? `According to the educational principles in this reading, what is the defining characteristic of **${def1.term}**?`
      : `In applying the instructional principles outlined in "${cleanTitle}", why must an educator intentionally align learning activities with **${keyTerm1}**?`;
    
    const q1Answer = def1 ? def1.definition : `It ensures that cognitive demands align with learner readiness and curricular standards`;

    // --- v1.3 Term Bank (from regex definition extraction, fallback to top keywords) ---
    const bankTerms = [];
    for (const d of definitionMatches.slice(0, 6)) {
      const gloss = d.definition.split(/\s+/).slice(0, 14).join(' ');
      bankTerms.push(`| **${d.term.trim()}** | ${gloss} | Anchor: picture it in your future classroom | [Primary Text Extraction] |`);
    }
    if (bankTerms.length < 5) {
      for (const kw of sortedKeywords) {
        if (bankTerms.length >= 5) break;
        const label = kw.trim();
        if (bankTerms.some(t => t.includes(`**${label}**`))) continue;
        bankTerms.push(`| **${label}** | Core term this reading builds on | Anchor: link to ${keyTerm1.toLowerCase()} lesson | [Primary Text Extraction] |`);
      }
    }

    // --- v1.3 Fill-in drills (terminology retrieval) ---
    const fillDefs = definitionMatches.slice(0, 3);
    const fillBlocks = fillDefs.map((d, i) => {
      const termRe = new RegExp(d.term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const safeHint = (d.fullSentence || '').replace(termRe, '').split(/\s+/).filter(Boolean).slice(0, 6).join(' ');
      return `**Fill-in ${i + 1}:** According to this reading, _____ ${safeHint ? '(' + safeHint + ')' : ''}\n- **Answer:** ${d.term.trim()}\n- **Why:** The text uses this term for ${d.definition.split(/\s+/).slice(0, 12).join(' ')} [Primary Text Extraction]`;
    });
    while (fillBlocks.length < 3) {
      const idx = fillBlocks.length;
      const kw = sortedKeywords[idx] || keyTerm1;
      fillBlocks.push(`**Fill-in ${idx + 1}:** One load-bearing idea that recurs across this reading is _____ (hint: among the text's most salient core concepts)\n- **Answer:** ${kw}\n- **Why:** TextRank salience ranks this among the top recurring terms of the text [Primary Text Extraction]`);
    }

    const markdown = `### 1. 🎓 Cornell Synthesis & Active Cues
- **Macro-Synthesis [Primary Text Extraction]:** ${macroSynthesis}
- **Why It Matters:** This reading feeds your ${keyTerm1.toLowerCase()} lesson design and LET ProfEd items — start with Familiarize, the term bank below.
- **Active Recall Cue Questions:**
${cueQuestions.map(q => `  - ${q}`).join('\n')}

---

### 2. 🧩 Structured Concept Chunks
*Extracted via TextRank graph analysis from the ${extractedDoc.totalUnits} ${extractedDoc.unitLabel.toLowerCase()} of **${filename}**:*

**Part A — Term Bank** *(familiarize FIRST: cover the middle column, recall aloud)*

| Term | In-Text Meaning (15 words max) | Memory Anchor | Source |
| :--- | :--- | :--- | :--- |
${bankTerms.join('\n')}

**Part B — Chunks** *(understand NEXT)*

${chunksMarkdown}

---

### 3. 🧑‍🏫 "Teach It Simply" (Classroom Translation)
- **In Plain Words:** At its core, "${cleanTitle}" guides educators on how to structure **${keyTerm1}** so that lessons become clearer, more engaging, and cognitively accessible to diverse learners.
- **The Concrete Analogy:** Think of the concepts in this reading like the foundations of a school building. Without solid comprehension of **${keyTerm1}** and **${keyTerm2}**, instructional delivery risks collapsing under cognitive overload; with them, learners build sturdy, lasting mastery.
- **Novice Misconception Alert:** Pre-service teachers often assume that reading about **${keyTerm1}** is purely theoretical compliance. In reality, the standards described directly determine how you design activities, formulate questions, and assess student understanding.

---

### 4. ⚖️ Contrastive Analysis Matrix

| Comparison Dimension | Focus Area: ${keyTerm1} | Focus Area: ${keyTerm2} |
| :--- | :--- | :--- |
${matrixRowA}
${matrixRowB}
| **Evidence of Success** | Articulating principles and identifying schemas | Demonstrating transfer and solving problems |

---

### 5. 🎯 Licensure (LET) Retrieval Practice Checkpoint

**Part A — Scenario Application** *(attempt before reveal)*

**Question 1:** ${q1Stem}
- A) To satisfy administrative compliance without regard for student readiness
- B) ${q1Answer}
- C) To replace formative evaluation with mechanical memorization
- D) To eliminate differentiated instruction from lesson planning
- **Correct Answer:** **B**
- **Pedagogical Rationalization:** Effective instructional design requires aligning tasks with students' developmental readiness and evidence-based standards, preventing extraneous cognitive load and fostering authentic competence. [Primary Text Extraction]

**Question 2:** Which classroom scenario best demonstrates the appropriate pedagogical execution of **${keyTerm2}** as described in the text?
- A) Teacher facilitates collaborative inquiry and guided problem-solving before formalizing definitions
- B) Teacher lectures continuously for 60 minutes without checking for understanding
- C) Teacher assigns complex homework without modeling or scaffolding
- D) Teacher relies solely on rote recitation of factual definitions
- **Correct Answer:** **A**
- **Pedagogical Rationalization:** Learner-centered pedagogy mandates providing exploratory experiences and scaffolded dialogue before formalizing definitions. [Primary Text Extraction]

**Part B — Term Fill-in Drills** *(recall from the Term Bank)*

${fillBlocks.join('\n\n')}

**Part C — Study Next**
- **Study Next:** Memorize — attempt the fill-ins cold, push misses to the LET Reviewer (Box 1), re-test in 1 day.`;

    return {
      source: 'LOCAL_TEXTRANK_ENGINE',
      modelName: 'Client-Side TextRank NLP (Offline)',
      markdown,
      analyzedAt: new Date().toISOString()
    };
  }
}

