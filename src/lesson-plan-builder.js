/**
 * Pedagogo Desk: Lesson Plan Builder 🌱 — 3-Stage Backward-Design Wizard
 * (Roadmap Phase 4 — Future Module E)
 *
 * For pre-service teachers writing DLP/DLL lesson plans for Field Study (FS 2)
 * and Practice Teaching — the highest daily-value module. Cognitive-load-aware:
 * a structured wizard scaffold frees novice working memory for actual
 * pedagogical thinking instead of format compliance (Sweller; Wiggins & McTighe).
 *
 * 3 Guided Stages (gently enforces backward design order):
 *   1. Desired Outcomes    — objectives with Bloom's verb picker + MELC fields
 *   2. Acceptable Evidence — assessment plan (formative / summative, type)
 *   3. Learning Activities — DepEd DLP parts + per-part PPST annotation
 *
 * Also includes:
 * - Gentle Alignment Checker (nudge, never error) across the three stages
 * - Reusable Plan Library (save per subject/grade, duplicate & adapt)
 * - 🖨️ 1-click printable DepEd DLP with signature blocks (same print pipeline
 *   as the SF2 / Class Record sheets) + editable Word (.doc) export
 * - Post-lesson reflection journal (ready-made FS 2 episode material)
 * - 100% localStorage (`pedagogo_lp_plans`), joins the Unified Backup Hub,
 *   restores via `pedagogo:data-restored`, can never leak to a cloud.
 */

import { showToast } from './toast.js';

export class LessonPlanBuilder {
  static STORAGE_KEY = 'pedagogo_lp_plans';

  static STAGES = [
    { key: 'outcomes', icon: '🎯', label: 'Outcomes', color: '#3B6347',
      hint: 'Decide what learners should know and be able to do — before thinking about activities. This order is the heart of backward design (Wiggins & McTighe).' },
    { key: 'evidence', icon: '🧭', label: 'Evidence', color: '#2F6F80',
      hint: 'Plan how you will SEE the outcomes happen — what learners will say, make, or do — before designing any activity.' },
    { key: 'activities', icon: '🛤️', label: 'Activities', color: '#B08A3E',
      hint: 'Now design the experiences that bridge outcomes and evidence. Approximate minutes and PPST strands here flow into your printed DLP.' }
  ];

  static BLOOMS_LEVELS = [
    { id: 'remembering', label: 'Remembering', icon: '🧠', color: '#7C9885',
      verbs: ['Define', 'Identify', 'List', 'Name', 'Recall', 'Recognize', 'State'],
      evidenceHint: 'Recall checks fit here: oral Q&A, short factual quiz, matching type, labeling a diagram.' },
    { id: 'understanding', label: 'Understanding', icon: '💡', color: '#5B8A72',
      verbs: ['Classify', 'Describe', 'Discuss', 'Explain', 'Interpret', 'Summarize', 'Paraphrase'],
      evidenceHint: 'Explain-backs, one-sentence summaries, concept maps, or sorting examples show understanding.' },
    { id: 'applying', label: 'Applying', icon: '🛠️', color: '#3B6347',
      verbs: ['Apply', 'Demonstrate', 'Illustrate', 'Practice', 'Solve', 'Use', 'Compute'],
      evidenceHint: 'Guided practice, worked examples, performance demonstrations, or problem sets assess applying.' },
    { id: 'analyzing', label: 'Analyzing', icon: '🔍', color: '#2F6F80',
      verbs: ['Analyze', 'Compare', 'Contrast', 'Differentiate', 'Examine', 'Categorize', 'Deconstruct'],
      evidenceHint: 'Comparison charts, error-spotting tasks, graphic organizers, or case dissections assess analysis.' },
    { id: 'evaluating', label: 'Evaluating', icon: '⚖️', color: '#B08A3E',
      verbs: ['Assess', 'Critique', 'Defend', 'Evaluate', 'Judge', 'Justify', 'Appraise'],
      evidenceHint: 'Debates, defend-a-choice tasks, rubric-based peer review, or critique slots assess evaluating.' },
    { id: 'creating', label: 'Creating', icon: '🎨', color: '#8A5A83',
      verbs: ['Compose', 'Construct', 'Design', 'Develop', 'Formulate', 'Synthesize', 'Produce'],
      evidenceHint: 'Rubric-scored outputs — original composition, portfolio entry, design task — assess creating.' }
  ];

  // Affective "heart words" — common in objectives, hard to assess with quizzes
  static AFFECTIVE_HINTS = ['appreciate', 'value', 'enjoy', 'treasure', 'internalize', 'show interest', 'be grateful'];

  static DRAFT_KEY = 'pedagogo_lp_draft';

  // Which evidence types naturally honor each Bloom level (alignment checker)
  static BLOOM_EVIDENCE_FIT = {
    remembering: ['Quiz', 'Discussion'],
    understanding: ['Quiz', 'Discussion', 'Product'],
    applying: ['Performance', 'Product'],
    analyzing: ['Performance', 'Discussion', 'Product'],
    evaluating: ['Discussion', 'Product', 'Performance'],
    creating: ['Product', 'Performance']
  };

  static ASSESSMENT_TYPES = [
    { value: '', label: '— Not planned yet —' },
    { value: 'Quiz', label: 'Quiz / Paper-and-pencil test' },
    { value: 'Performance', label: 'Performance task / Demonstration' },
    { value: 'Product', label: 'Product / Portfolio output' },
    { value: 'Reflection', label: 'Reflection / Journal output' },
    { value: 'Discussion', label: 'Recitation / Guided discussion' }
  ];

  static PART_ORDER = ['review', 'motivation', 'presentation', 'practice', 'application', 'generalization', 'evaluation', 'assignment'];
  static PART_META = {
    review: { icon: '🔁', label: 'Review / Drill', hint: 'Recall of the previous lesson or prerequisite skill' },
    motivation: { icon: '✨', label: 'Motivation', hint: 'A hook that captures learner curiosity' },
    presentation: { icon: '📖', label: 'Presentation', hint: 'The core concept — direct instruction or guided discovery' },
    practice: { icon: '🤝', label: 'Guided Practice', hint: 'Practice with teacher scaffolding and feedback' },
    application: { icon: '🌍', label: 'Application', hint: 'Independent, contextualized, real-world task' },
    generalization: { icon: '💡', label: 'Generalization', hint: 'Processing questions that let learners state the big idea' },
    evaluation: { icon: '✅', label: 'Evaluation', hint: 'The formative check against your Stage 1 objectives' },
    assignment: { icon: '🏠', label: 'Assignment / Enrichment', hint: 'A home task that extends the learning' }
  };

  static PPST_STRANDS = [
    { value: '1.5', label: 'PPST 1.5 — Critical & creative thinking (HOTS)' },
    { value: '2.2', label: 'PPST 2.2 — Fair learning environment' },
    { value: '2.3', label: 'PPST 2.3 — Management of classroom structure & activities' },
    { value: '2.6', label: 'PPST 2.6 — Management of learner behavior' },
    { value: '3.1', label: 'PPST 3.1 — Learner gender, needs, strengths & interests' },
    { value: '3.2', label: 'PPST 3.2 — Linguistic, cultural & socio-economic backgrounds' },
    { value: '3.4', label: 'PPST 3.4 — Learner participation' },
    { value: '3.5', label: 'PPST 3.5 — Higher-order thinking skills' },
    { value: '4.1', label: 'PPST 4.1 — Planning & management of teaching-learning process' },
    { value: '4.2', label: 'PPST 4.2 — Learning outcomes aligned with competencies' },
    { value: '4.5', label: 'PPST 4.5 — Teaching-learning resources & IMs' },
    { value: '5.1', label: 'PPST 5.1 — Diagnostic, formative & summative assessment strategies' },
    { value: '5.2', label: 'PPST 5.2 — Monitoring & evaluating learner progress' },
    { value: '5.4', label: 'PPST 5.4 — Learner feedback' }
  ];

  static FRAMEWORK_META = {
    DLP: { icon: '📜', label: 'DLP — Detailed Lesson Plan' },
    DLL: { icon: '🗓️', label: 'DLL — Daily Lesson Log' }
  };

  constructor(classManager = null) {
    this.classManager = classManager;
    this.container = document.getElementById('view-plan-builder');
    this.store = this.loadStore();
    this.draft = this.loadDraft();
    this.wizardStage = 1; // 1 Outcomes → 2 Evidence → 3 Activities
    this.activePlanId = this.store.plans.some(p => p.id === this.draft.id) ? this.draft.id : null;
    this.nudges = this.computeAlignmentNudges();

    if (this.container) {
      this.render();
      this.bindEvents();
    }

    // Restore flow: Backup Hub / phone sync re-renders the builder
    window.addEventListener('pedagogo:data-restored', () => {
      this.store = this.loadStore();
      this.draft = this.loadDraft();
      this.activePlanId = this.store.plans.some(p => p.id === this.draft.id) ? this.draft.id : null;
      this.nudges = this.computeAlignmentNudges();
      if (this.container) this.render();
    });
  }

  // =========================================================
  // Data Layer (normalized Plan store — 100% localStorage)
  // =========================================================

  loadStore() {
    const raw = localStorage.getItem(LessonPlanBuilder.STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.plans)) return { plans: parsed.plans };
      } catch (e) {
        console.warn('Failed to parse lesson plan library', e);
      }
    }
    return { plans: [] };
  }

  loadDraft() {
    const raw = localStorage.getItem(LessonPlanBuilder.DRAFT_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return this.normalizePlan(parsed);
      } catch (e) {
        console.warn('Failed to parse lesson plan draft', e);
      }
    }
    return this.newPlan();
  }

  saveStore() {
    localStorage.setItem(LessonPlanBuilder.STORAGE_KEY, JSON.stringify(this.store));
  }

  saveDraft() {
    this.draft.updatedAt = new Date().toISOString();
    localStorage.setItem(LessonPlanBuilder.DRAFT_KEY, JSON.stringify(this.draft));
  }

  newPlan() {
    const cls = this.classManager?.classes?.[0] || null;
    return {
      id: 'lp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
      title: '',
      classId: cls?.id || null,
      subjectCode: cls?.subjectCode || '',
      gradeLevel: cls?.gradeLevel || '',
      quarter: '',
      topic: '',
      materials: '',
      framework: 'DLP',
      // Stage 1 — Desired Outcomes
      melcCode: '',
      contentStandard: '',
      performanceStandard: '',
      objectives: '',
      bloomLevel: '',
      // Stage 2 — Acceptable Evidence
      formativeType: '',
      formativeDetails: '',
      summativeType: '',
      summativeDetails: '',
      // Stage 3 — Learning Activities
      parts: Object.fromEntries(LessonPlanBuilder.PART_ORDER.map(p => [p, ''])),
      partMinutes: Object.fromEntries(LessonPlanBuilder.PART_ORDER.map(p => [p, ''])),
      ppst: Object.fromEntries(LessonPlanBuilder.PART_ORDER.map(p => [p, ''])),
      reflection: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  normalizePlan(plan) {
    const base = this.newPlan();
    const merged = { ...base, ...plan };
    merged.id = plan.id || base.id;
    merged.parts = { ...base.parts, ...(plan.parts || {}) };
    merged.partMinutes = { ...base.partMinutes, ...(plan.partMinutes || {}) };
    merged.ppst = { ...base.ppst, ...(plan.ppst || {}) };
    merged.framework = ['DLP', 'DLL'].includes(plan.framework) ? plan.framework : 'DLP';
    return merged;
  }

  getPlan(planId) {
    return this.store.plans.find(p => p.id === planId) || null;
  }

  getLinkedClass() {
    if (!this.draft?.classId || !this.classManager) return null;
    return this.classManager.classes.find(c => c.id === this.draft.classId) || null;
  }

  getPlanTitle(plan) {
    return (plan.title && plan.title.trim()) || (plan.topic && plan.topic.trim()) || 'Untitled Lesson Plan';
  }

  // =========================================================
  // 🌿 Gentle Alignment Checker (nudge, never error)
  // =========================================================
  // Mechanical, supportive checks across the three stages. Framed as a
  // friendly "heads-up" — never a red banner, never a failing grade.

  computeAlignmentNudges() {
    const d = this.draft;
    if (!d) return [];
    const nudges = [];
    const objectives = (d.objectives || '').toLowerCase();
    const evidenceTypes = [d.formativeType, d.summativeType].filter(Boolean);
    const activitiesText = LessonPlanBuilder.PART_ORDER
      .map(p => d.parts[p] || '').join('').trim();

    // 1. Backward-design inversion — the classic Field Study markdown reason
    if (activitiesText.length > 80 && objectives.trim().length < 20) {
      nudges.push({
        icon: '🧭',
        text: 'Your Stage 3 is blooming while Stage 1 is still a seed. Backward design works best in order: outcomes → evidence → activities. A quick visit to Stage 1 will make every activity more purposeful.'
      });
    }

    // 2. Affective "heart words" assessed with a paper quiz
    const affective = LessonPlanBuilder.AFFECTIVE_HINTS.find(w => objectives.includes(w));
    if (affective && [d.formativeType, d.summativeType].includes('Quiz')) {
      nudges.push({
        icon: '💭',
        text: `Heads-up: your objective says learners will "${affective}" — would a reflection or journal output assess that better than a paper quiz?`
      });
    }

    // 3. Bloom level declared but never honored by the evidence
    const bloom = LessonPlanBuilder.BLOOMS_LEVELS.find(b => b.id === d.bloomLevel);
    if (bloom && evidenceTypes.length > 0) {
      const fit = LessonPlanBuilder.BLOOM_EVIDENCE_FIT[bloom.id] || [];
      const honored = evidenceTypes.some(t => fit.includes(t));
      if (!honored) {
        nudges.push({
          icon: '⚖️',
          text: `You declared "${bloom.label}" in Stage 1, but your Stage 2 evidence is paper-based. ${bloom.evidenceHint}`
        });
      }
    }

    // 4. Outcomes with no evidence at all
    if (objectives.trim().length > 20 && evidenceTypes.length === 0) {
      nudges.push({
        icon: '🪴',
        text: 'Stage 2 is still empty — even one quick exit ticket makes your outcomes measurable. What will learners say, make, or do to show they learned?'
      });
    }

    return nudges;
  }

  // =========================================================
  // Rendering
  // =========================================================

  render() {
    if (!this.container) return;
    const stageMeta = LessonPlanBuilder.STAGES[this.wizardStage - 1];
    const fw = LessonPlanBuilder.FRAMEWORK_META[this.draft.framework];
    const savedCount = this.store.plans.length;

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="section-title">Backward-Design Plan Builder</h2>
          <p class="section-desc">Wiggins &amp; McTighe order — Outcomes → Evidence → Activities • DepEd DLP/DLL ready</p>
        </div>
        <div class="header-actions">
          <div class="framework-toggle" role="tablist" aria-label="Plan format">
            <button class="framework-btn ${this.draft.framework === 'DLP' ? 'active' : ''}" data-action="set-framework" data-value="DLP" title="Detailed Lesson Plan (full DepEd format)">📜 DLP</button>
            <button class="framework-btn ${this.draft.framework === 'DLL' ? 'active' : ''}" data-action="set-framework" data-value="DLL" title="Daily Lesson Log (compact DepEd format)">🗓️ DLL</button>
          </div>
          <button class="btn-secondary" data-action="new-plan" title="Start a fresh plan">🌱 New Plan</button>
          <button class="btn-primary" data-action="save-plan" title="Save this plan to your reusable library">💾 Save to Library</button>
        </div>
      </div>

      ${this.renderLibraryStrip()}

      <div class="lpb-rail" role="tablist" aria-label="Wizard stages">
        ${LessonPlanBuilder.STAGES.map((s, idx) => `
          <button class="lpb-rail-step ${idx + 1 === this.wizardStage ? 'active' : ''} ${idx + 1 < this.wizardStage ? 'done' : ''}"
                  data-action="go-stage" data-stage="${idx + 1}" role="tab"
                  aria-selected="${idx + 1 === this.wizardStage}"
                  style="--step-color: ${s.color};">
            <span class="lpb-rail-icon">${s.icon}</span>
            <span class="lpb-rail-text"><strong>Stage ${idx + 1} — ${s.label}</strong></span>
          </button>
          ${idx < LessonPlanBuilder.STAGES.length - 1 ? '<span class="lpb-rail-connector">→</span>' : ''}
        `).join('')}
      </div>

      <div class="lpb-stage-hint" id="lpb-stage-hint">${stageMeta.hint}</div>

      <div class="lpb-alignment-zone" id="lpb-alignment-zone">${this.renderAlignmentCard()}</div>

      <div class="lpb-stage" id="lpb-stage-panel">${this.renderStagePanel()}</div>

      <div class="lpb-nav">
        <button class="btn-secondary" data-action="prev-stage" ${this.wizardStage === 1 ? 'disabled' : ''}>← Back</button>
        <span class="lpb-nav-progress">Stage ${this.wizardStage} of 3 • ${fw.icon} ${fw.label.split('—')[0].trim()}${savedCount ? ` • ${savedCount} plan${savedCount > 1 ? 's' : ''} in library` : ''}</span>
        <button class="btn-primary" data-action="next-stage" ${this.wizardStage === 3 ? 'disabled' : ''}>Next →</button>
      </div>
    `;
  }

  renderLibraryStrip() {
    const plans = [...this.store.plans].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    if (plans.length === 0) {
      return `
        <div class="lpb-library lpb-library-empty">
          <span>📚 Your Plan Library is a blank page — save your first plan and reuse it across sections. Interns teach the same content repeatedly; a saved plan is the biggest single time-saver.</span>
        </div>
      `;
    }
    return `
      <div class="lpb-library">
        <div class="lpb-library-header"><span>📚 Plan Library</span><span class="lpb-library-sub">Open • duplicate &amp; adapt • per subject &amp; grade</span></div>
        <div class="lpb-library-cards">
          ${plans.map(p => {
            const fwMeta = LessonPlanBuilder.FRAMEWORK_META[p.framework] || LessonPlanBuilder.FRAMEWORK_META.DLP;
            const active = p.id === this.activePlanId;
            return `
              <div class="lpb-library-card ${active ? 'active' : ''}" title="${this.escapeHtml(this.getPlanTitle(p))}">
                <div class="lpb-card-badge">${fwMeta.icon} ${fwMeta.label.split('—')[0].trim()}</div>
                <div class="lpb-card-title">${this.escapeHtml(this.getPlanTitle(p))}</div>
                <div class="lpb-card-meta">${this.escapeHtml([p.subjectCode, p.gradeLevel, p.quarter].filter(Boolean).join(' • ') || 'No subject set yet')}</div>
                <div class="lpb-card-actions">
                  <button class="lpb-card-btn" data-action="open-plan" data-id="${p.id}" title="Open &amp; edit this plan">Open</button>
                  <button class="lpb-card-btn" data-action="duplicate-plan" data-id="${p.id}" title="Duplicate &amp; adapt">Copy</button>
                  <button class="lpb-card-btn danger" data-action="delete-plan" data-id="${p.id}" title="Delete this plan">✕</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderAlignmentCard() {
    if (!this.nudges || this.nudges.length === 0) {
      return `
        <div class="lpb-harmony">
          <span class="lpb-harmony-icon">🌿</span>
          <div><strong>All in gentle harmony.</strong> Your outcomes, evidence, and activities are walking the same direction.</div>
        </div>
      `;
    }
    return `
      <div class="lpb-alignment-card">
        <div class="lpb-alignment-title">🌿 Gentle Alignment Check <span class="lpb-alignment-sub">a supportive heads-up, not an error</span></div>
        ${this.nudges.map(n => `
          <div class="lpb-nudge"><span class="lpb-nudge-icon">${n.icon}</span><span>${this.escapeHtml(n.text)}</span></div>
        `).join('')}
      </div>
    `;
  }

  /* M2 — Stage panels (Outcomes → Evidence → Activities) */

  renderStagePanel() {
    if (this.wizardStage === 1) return this.renderStageOutcomes();
    if (this.wizardStage === 2) return this.renderStageEvidence();
    return this.renderStageActivities();
  }

  classOptionsHtml(selectedId) {
    const classes = this.classManager?.classes || [];
    if (classes.length === 0) return `<option value="">— No sections yet —</option>`;
    return classes.map(c => `
      <option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>
        ${this.escapeHtml(`${c.subjectCode || ''} — ${c.sectionName || ''}`.trim())}
      </option>`).join('');
  }

  /* M3 — Stage 1: Desired Outcomes (identity + objectives + Bloom) */

  renderStageOutcomes() {
    const d = this.draft;
    return `
      <div class="lpb-meta-card">
        <div class="lpb-meta-row">
          <div class="lpb-field lpb-field-grow">
            <label for="lpb-title">Lesson title</label>
            <input type="text" id="lpb-title" data-lpb-field="title" maxlength="140"
                   placeholder="e.g., Elements of a Short Story" value="${this.escapeHtml(d.title || '')}">
          </div>
          <div class="lpb-field lpb-field-grow">
            <label for="lpb-class">Linked section</label>
            <select id="lpb-class" data-lpb-field="classId">${this.classOptionsHtml(d.classId)}</select>
          </div>
        </div>
        <div class="lpb-meta-row">
          <div class="lpb-field"><label for="lpb-subject">Subject code</label><input type="text" id="lpb-subject" data-lpb-field="subjectCode" placeholder="ENG 8" value="${this.escapeHtml(d.subjectCode || '')}"></div>
          <div class="lpb-field"><label for="lpb-grade">Grade / level</label><input type="text" id="lpb-grade" data-lpb-field="gradeLevel" placeholder="Grade 8" value="${this.escapeHtml(d.gradeLevel || '')}"></div>
          <div class="lpb-field"><label for="lpb-quarter">Quarter / term</label><input type="text" id="lpb-quarter" data-lpb-field="quarter" placeholder="Quarter 1" value="${this.escapeHtml(d.quarter || '')}"></div>
          <div class="lpb-field lpb-field-grow"><label for="lpb-topic">Topic</label><input type="text" id="lpb-topic" data-lpb-field="topic" placeholder="e.g., Plot structure" value="${this.escapeHtml(d.topic || '')}"></div>
        </div>
        <div class="lpb-meta-row">
          <div class="lpb-field"><label for="lpb-melc">MELC / CG code</label><input type="text" id="lpb-melc" data-lpb-field="melcCode" placeholder="EN8LT-Ia-8" value="${this.escapeHtml(d.melcCode || '')}"></div>
          <div class="lpb-field lpb-field-grow"><label for="lpb-materials">Materials / IMs</label><input type="text" id="lpb-materials" data-lpb-field="materials" placeholder="e.g., handout, chart, markers" value="${this.escapeHtml(d.materials || '')}"></div>
        </div>
        <div class="lpb-meta-row">
          <div class="lpb-field lpb-field-grow"><label for="lpb-content">Content Standard</label><textarea id="lpb-content" data-lpb-field="contentStandard" rows="2" placeholder="What learners should understand…">${this.escapeHtml(d.contentStandard || '')}</textarea></div>
          <div class="lpb-field lpb-field-grow"><label for="lpb-perf">Performance Standard</label><textarea id="lpb-perf" data-lpb-field="performanceStandard" rows="2" placeholder="What learners should produce…">${this.escapeHtml(d.performanceStandard || '')}</textarea></div>
        </div>
      </div>
      <div class="lpb-field">
        <label for="lpb-objectives">Learning objectives <span class="lpb-hint-inline">— start each with a Bloom verb</span></label>
        <textarea id="lpb-objectives" data-lpb-field="objectives" rows="4" placeholder="At the end of the lesson, learners will be able to:&#10;1. Identify the five parts of a plot…">${this.escapeHtml(d.objectives || '')}</textarea>
      </div>
      <div class="lpb-bloom-block">
        <div class="lpb-bloom-title">Bloom's verb picker <span class="lpb-hint-inline">— tap a verb to append it</span></div>
        <div class="lpb-bloom-levels">
          ${LessonPlanBuilder.BLOOMS_LEVELS.map(b => `
            <div class="lpb-bloom-level" style="--bloom-color:${b.color};">
              <div class="lpb-bloom-head"><span>${b.icon} ${b.label}</span></div>
              <div class="lpb-verb-cloud">
                ${b.verbs.map(v => `<button class="lpb-verb-chip" data-action="bloom-verb" data-verb="${v}" data-level="${b.id}">${v}</button>`).join('')}
              </div>
              <label class="lpb-bloom-radio"><input type="radio" name="lpb-bloom" data-action="bloom-level" value="${b.id}" ${d.bloomLevel === b.id ? 'checked' : ''}> Declare as my Bloom focus</label>
            </div>`).join('')}
        </div>
      </div>
    `;
  }

  /* M4 — Stage 2: Acceptable Evidence (assessment plan) */

  renderStageEvidence() {
    const d = this.draft;
    const typeOptions = (sel) => LessonPlanBuilder.ASSESSMENT_TYPES
      .map(t => `<option value="${t.value}" ${t.value === sel ? 'selected' : ''}>${t.label}</option>`).join('');
    return `
      <div class="lpb-evidence-grid">
        <div class="lpb-evidence-card">
          <div class="lpb-evidence-title">Formative check <span class="lpb-hint-inline">— during the lesson</span></div>
          <div class="lpb-field"><label for="lpb-form-type">Type</label><select id="lpb-form-type" data-lpb-field="formativeType">${typeOptions(d.formativeType)}</select></div>
          <div class="lpb-field"><label for="lpb-form-details">What learners will say, make, or do</label><textarea id="lpb-form-details" data-lpb-field="formativeDetails" rows="3" placeholder="e.g., exit ticket: label the plot parts…">${this.escapeHtml(d.formativeDetails || '')}</textarea></div>
        </div>
        <div class="lpb-evidence-card">
          <div class="lpb-evidence-title">Summative artifact <span class="lpb-hint-inline">— after the lesson</span></div>
          <div class="lpb-field"><label for="lpb-sum-type">Type</label><select id="lpb-sum-type" data-lpb-field="summativeType">${typeOptions(d.summativeType)}</select></div>
          <div class="lpb-field"><label for="lpb-sum-details">Product / performance / reflection</label><textarea id="lpb-sum-details" data-lpb-field="summativeDetails" rows="3" placeholder="e.g., group story-map poster with rubric…">${this.escapeHtml(d.summativeDetails || '')}</textarea></div>
        </div>
      </div>
      <p class="att-launcher-hint">Tip: match evidence to the verb — identify fits a quiz; compose deserves a product, not paper-and-pencil.</p>
    `;
  }

  /* M5 — Stage 3: Learning Activities (8 DepEd DLP parts) */

  renderStageActivities() {
    const d = this.draft;
    const totalMin = LessonPlanBuilder.PART_ORDER.reduce((s, p) => s + (parseInt(d.partMinutes[p], 10) || 0), 0);
    return `
      <div class="lpb-time-strip">Planned activity time: <strong>${totalMin} min</strong> — flows into your printed DLP</div>
      <div class="lpb-parts">
        ${LessonPlanBuilder.PART_ORDER.map((key, idx) => {
          const meta = LessonPlanBuilder.PART_META[key];
          return `
          <div class="lpb-part-card">
            <div class="lpb-part-head">
              <span class="lpb-part-step">${idx + 1}. ${meta.icon} ${meta.label}</span>
              <span class="lpb-part-tools">
                <input type="number" class="lpb-min-input" data-lpb-min="${key}" min="0" max="120" placeholder="min" value="${this.escapeHtml(d.partMinutes[key] || '')}">
                <select class="lpb-ppst-select" data-lpb-ppst="${key}">
                  <option value="">PPST…</option>
                  ${LessonPlanBuilder.PPST_STRANDS.map(s => `<option value="${s.value}" ${(d.ppst[key] || '') === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
                </select>
              </span>
            </div>
            <div class="lpb-part-hint">${meta.hint}</div>
            <textarea data-lpb-part="${key}" rows="2" placeholder="What you and learners will do here…">${this.escapeHtml(d.parts[key] || '')}</textarea>
          </div>`;
        }).join('')}
      </div>
      <div class="lpb-field">
        <label for="lpb-reflection">Post-lesson reflection <span class="lpb-hint-inline">— FS 2 episode material</span></label>
        <textarea id="lpb-reflection" data-lpb-field="reflection" rows="3" placeholder="What worked? What will you adjust…">${this.escapeHtml(d.reflection || '')}</textarea>
      </div>
      <div class="lpb-export-row">
        <button class="btn-secondary" data-action="print-plan">Print DLP Sheet</button>
        <button class="btn-secondary" data-action="export-word">Export Word (.doc)</button>
      </div>
    `;
  }

  /* M6 — Event wiring (delegation — survives re-renders) */

  bindEvents() {
    if (!this.container || this.container.dataset.lpbBound === 'true') return;
    this.container.dataset.lpbBound = 'true';
    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!btn || !this.container.contains(btn)) return;
      this.handleAction(btn.dataset.action, btn.dataset, btn);
    });
    this.container.addEventListener('input', (e) => {
      const t = e.target;
      if (!t.dataset) return;
      if (t.dataset.lpbField) { this.draft[t.dataset.lpbField] = t.value; this.afterDraftEdit(false); }
      else if (t.dataset.lpbPart) { this.draft.parts[t.dataset.lpbPart] = t.value; this.afterDraftEdit(false); }
      else if (t.hasAttribute && t.hasAttribute('data-lpb-min')) { this.draft.partMinutes[t.getAttribute('data-lpb-min')] = t.value; this.afterDraftEdit(false); }
    });
    this.container.addEventListener('change', (e) => {
      const t = e.target;
      if (!t.dataset) return;
      if (t.dataset.lpbField) {
        this.draft[t.dataset.lpbField] = t.value;
        if (t.dataset.lpbField === 'classId' && this.classManager) {
          const cls = this.classManager.classes.find(c => c.id === t.value) || null;
          if (cls) {
            if (!this.draft.subjectCode) this.draft.subjectCode = cls.subjectCode || '';
            if (!this.draft.gradeLevel) this.draft.gradeLevel = cls.gradeLevel || '';
            this.render();
          }
        }
        this.afterDraftEdit(true);
      } else if (t.hasAttribute && t.hasAttribute('data-lpb-ppst')) {
        this.draft.ppst[t.getAttribute('data-lpb-ppst')] = t.value;
        this.afterDraftEdit(false);
      } else if (t.dataset.action === 'bloom-level') {
        this.draft.bloomLevel = t.value;
        this.afterDraftEdit(true);
      }
    });
  }

  afterDraftEdit(refreshNudges) {
    this.saveDraft();
    if (refreshNudges) {
      this.nudges = this.computeAlignmentNudges();
      const zone = this.container ? this.container.querySelector('#lpb-alignment-zone') : null;
      if (zone) zone.innerHTML = this.renderAlignmentCard();
    }
  }

  handleAction(action, data = {}, el = null) {
    switch (action) {
      case 'go-stage': { const s = parseInt(data.stage, 10); if (s >= 1 && s <= 3) { this.wizardStage = s; this.render(); } break; }
      case 'prev-stage': if (this.wizardStage > 1) { this.wizardStage -= 1; this.render(); } break;
      case 'next-stage': if (this.wizardStage < 3) { this.wizardStage += 1; this.render(); } break;
      case 'set-framework': this.draft.framework = data.value === 'DLL' ? 'DLL' : 'DLP'; this.saveDraft(); this.render(); break;
      case 'bloom-verb': {
        const verb = data.verb || '';
        const cur = (this.draft.objectives || '').trim();
        this.draft.objectives = cur ? `${cur} ${verb}` : verb;
        if (data.level) this.draft.bloomLevel = data.level;
        this.saveDraft(); this.nudges = this.computeAlignmentNudges(); this.render();
        break;
      }
      case 'new-plan':
        this.draft = this.newPlan(); this.activePlanId = null; this.wizardStage = 1;
        this.saveDraft(); this.nudges = this.computeAlignmentNudges(); this.render();
        break;
      case 'save-plan': this.savePlanToLibrary(); break;
      case 'open-plan': this.openPlan(data.id); break;
      case 'duplicate-plan': this.duplicatePlan(data.id); break;
      case 'delete-plan':
        this.store.plans = this.store.plans.filter(p => p.id !== data.id);
        if (this.activePlanId === data.id) this.activePlanId = null;
        this.saveStore(); this.render();
        break;
      case 'print-plan': this.printPlan(); break;
      case 'export-word': this.exportWord(); break;
    }
  }

  /* M7 — Plan Library CRUD (reusable across sections) */

  snapshotDraft() { return JSON.parse(JSON.stringify(this.draft)); }

  savePlanToLibrary() {
    const snap = this.snapshotDraft();
    snap.updatedAt = new Date().toISOString();
    const idx = this.store.plans.findIndex(p => p.id === snap.id);
    if (idx >= 0) this.store.plans[idx] = snap;
    else this.store.plans.unshift(snap);
    this.activePlanId = snap.id;
    this.saveStore(); this.saveDraft(); this.render();
  }

  openPlan(id) {
    const p = this.getPlan(id);
    if (!p) return;
    this.draft = this.normalizePlan(JSON.parse(JSON.stringify(p)));
    this.activePlanId = p.id; this.wizardStage = 1;
    this.saveDraft(); this.nudges = this.computeAlignmentNudges(); this.render();
  }

  duplicatePlan(id) {
    const p = this.getPlan(id);
    if (!p) return;
    const copy = this.normalizePlan(JSON.parse(JSON.stringify(p)));
    copy.id = 'lp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    copy.title = (p.title || p.topic || 'Untitled Lesson Plan') + ' (copy)';
    copy.updatedAt = new Date().toISOString();
    this.store.plans.unshift(copy);
    this.activePlanId = copy.id;
    this.draft = this.normalizePlan(JSON.parse(JSON.stringify(copy)));
    this.saveStore(); this.saveDraft();
    this.nudges = this.computeAlignmentNudges(); this.render();
  }

  totalMinutes() {
    return LessonPlanBuilder.PART_ORDER.reduce((s, p) => s + (parseInt(this.draft.partMinutes[p], 10) || 0), 0);
  }

  /* M8 — Printable DepEd DLP sheet (same pipeline as SF2) */

  printPlan() {
    const d = this.draft;
    const cls = this.getLinkedClass();
    const fw = LessonPlanBuilder.FRAMEWORK_META[d.framework] || LessonPlanBuilder.FRAMEWORK_META.DLP;
    let box = document.getElementById('lpb-print-sheet');
    if (!box) {
      box = document.createElement('div');
      box.id = 'lpb-print-sheet';
      box.className = 'print-only-container';
      document.body.appendChild(box);
    }
    const ppstTag = (k) => (d.ppst[k] ? ` <em>(PPST ${this.escapeHtml(d.ppst[k])})</em>` : '');
    box.innerHTML = `
      <div class="lpb-print-document">
        <div class="print-header">
          <h3>Republic of the Philippines • Department of Education</h3>
          <h2>${fw.label.toUpperCase()} — ${this.escapeHtml(this.getPlanTitle(d)).toUpperCase()}</h2>
          <p class="course-subtitle">Pre-Service Teacher Practicum Plan — Pedagogo Desk</p>
        </div>
        <div class="att-print-meta">
          <div><strong>Subject:</strong> ${this.escapeHtml(d.subjectCode || cls?.subjectCode || '—')}</div>
          <div><strong>Section:</strong> ${this.escapeHtml(cls?.sectionName || '—')} ${this.escapeHtml(d.gradeLevel || '')}</div>
          <div><strong>School:</strong> ${this.escapeHtml(cls?.schoolName || '—')}</div>
          <div><strong>Quarter:</strong> ${this.escapeHtml(d.quarter || '—')} • <strong>MELC:</strong> ${this.escapeHtml(d.melcCode || '—')}</div>
          <div><strong>Topic:</strong> ${this.escapeHtml(d.topic || '—')} • <strong>Time:</strong> ${this.totalMinutes()} min</div>
        </div>
        <div class="lpb-print-sec"><h4>I. OBJECTIVES</h4>
          <p><strong>Content:</strong> ${this.escapeHtml(d.contentStandard || '—')}</p>
          <p><strong>Performance:</strong> ${this.escapeHtml(d.performanceStandard || '—')}</p>
          <p>${this.escapeHtml(d.objectives || '—').replace(/\n/g, '<br>')}</p>
        </div>
        <div class="lpb-print-sec"><h4>II. ASSESSMENT PLAN</h4>
          <p><strong>Formative (${this.escapeHtml(d.formativeType || '—')}):</strong> ${this.escapeHtml(d.formativeDetails || '—')}</p>
          <p><strong>Summative (${this.escapeHtml(d.summativeType || '—')}):</strong> ${this.escapeHtml(d.summativeDetails || '—')}</p>
        </div>
        <div class="lpb-print-sec"><h4>III. PROCEDURE</h4>
          <table><thead><tr><th style="width:32px;">#</th><th>Part</th><th>Episodes</th><th style="width:52px;">Min</th></tr></thead>
          <tbody>${LessonPlanBuilder.PART_ORDER.map((k, i) => `
            <tr><td style="text-align:center;">${i + 1}</td>
                <td><strong>${LessonPlanBuilder.PART_META[k].label}</strong>${ppstTag(k)}</td>
                <td>${this.escapeHtml(d.parts[k] || '—').replace(/\n/g, '<br>')}</td>
                <td style="text-align:center;">${this.escapeHtml(d.partMinutes[k] || '—')}</td></tr>`).join('')}
          </tbody></table>
        </div>
        <div class="att-print-signatures">
          <div class="sig-item"><div class="line"></div><span>Pre-Service Teacher (Intern)</span></div>
          <div class="sig-item"><div class="line"></div><span>Cooperating Teacher (CT)</span></div>
          <div class="sig-item"><div class="line"></div><span>School Head / Principal</span></div>
        </div>
      </div>`;
    document.body.classList.add('printing-lpb-sheet');
    try { window.print(); } finally { document.body.classList.remove('printing-lpb-sheet'); }
  }

  /* M9 — Word (.doc) export for CT review */

  exportWord() {
    const d = this.draft;
    const cls = this.getLinkedClass();
    const fw = LessonPlanBuilder.FRAMEWORK_META[d.framework] || LessonPlanBuilder.FRAMEWORK_META.DLP;
    const safe = (s) => (s || 'plan').replace(/[^\w\-]+/g, '_').slice(0, 40);
    const fileName = `${safe(d.subjectCode)}-${safe(d.topic)}.doc`;
    const body = `
      <div style="text-align:center;"><p>Republic of the Philippines • Department of Education</p>
      <h2>${fw.label} — ${this.escapeHtml(this.getPlanTitle(d))}</h2></div>
      <table border="1" cellspacing="0" cellpadding="6" width="100%">
        <tr><td><strong>Subject</strong></td><td>${this.escapeHtml(d.subjectCode || '')}</td><td><strong>Section</strong></td><td>${this.escapeHtml(cls?.sectionName || '')}</td></tr>
        <tr><td><strong>Topic</strong></td><td colspan="3">${this.escapeHtml(d.topic || '')}</td></tr>
        <tr><td><strong>Materials</strong></td><td colspan="3">${this.escapeHtml(d.materials || '')}</td></tr>
      </table>
      <h3>I. OBJECTIVES</h3><p>${this.escapeHtml(d.objectives || '').replace(/\n/g, '<br>')}</p>
      <h3>II. ASSESSMENT</h3>
      <p><strong>Formative:</strong> ${this.escapeHtml(d.formativeDetails || '')}</p>
      <p><strong>Summative:</strong> ${this.escapeHtml(d.summativeDetails || '')}</p>
      <h3>III. PROCEDURE</h3>
      ${LessonPlanBuilder.PART_ORDER.map((k, i) => `<p><strong>${i + 1}. ${LessonPlanBuilder.PART_META[k].label}:</strong><br>${this.escapeHtml(d.parts[k] || '').replace(/\n/g, '<br>')}</p>`).join('')}
      <br><table width="100%"><tr>
        <td align="center">_______________<br>Intern</td>
        <td align="center">_______________<br>Cooperating Teacher</td>
        <td align="center">_______________<br>School Head</td>
      </tr></table>`;
    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body>${body}</body></html>`;
    const blob = new Blob(['\ufeff', doc], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* M10 — shared helpers */

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
}
