/**
 * Pedagogo Desk: Licensure (LET) Flashcard & Mastery Studio 🎯📚
 * Grounded in Spaced Repetition (Leitner System), Active Retrieval,
 * and Realistic PRC Board Licensure Examination Simulation.
 */
import { showToast } from './toast.js';

export class ReviewerStudio {
  static STORAGE_KEY = 'pedagogo_let_cards';
  static FLAGS_KEY = 'pedagogo_let_flags';

  constructor() {
    this.cards = this.loadCards();
    this.activeFilter = 'ALL'; // ALL, PROFED, GENED, MAJOR
    this.activeMode = 'DECK'; // DECK, STUDY_CARDS, EXAM_SETUP, EXAM_ARENA, EXAM_DIAGNOSTICS
    
    // Flashcard study state
    this.currentCardIndex = 0;
    this.isCardFlipped = false;
    this.studyDeck = [];

    // Board Exam Simulator state
    this.examConfig = {
      mode: 'TIMED', // TIMED (PRC Board conditions) or PRACTICE (Instant feedback)
      category: 'ALL', // ALL, PROFED, GENED, BOX1
      itemCount: 10,
      timePerItemSeconds: 60
    };
    this.examDeck = [];
    this.examCurrentIndex = 0;
    this.userAnswers = {}; // { [cardId]: 'A' | 'B' | 'C' | 'D' }
    this.flaggedQuestions = this.loadFlags(); // Set of card IDs (persisted)
    this.examSecondsRemaining = 0;
    this.examTimerInterval = null;
    this.examIsPaused = false;
    this.examStartTime = null;
    this.examDurationTaken = 0;
    this.examResultDiagnostics = null;
    this.diagnosticFilter = 'ALL'; // ALL, INCORRECT, FLAGGED

    this.container = document.getElementById('view-reviewer');
    if (this.container) {
      this.render();
    }
  }

  loadCards() {
    const saved = localStorage.getItem(ReviewerStudio.STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse saved LET cards, using starter deck', e);
      }
    }
    const starter = this.getCuratedStarterDeck();
    this.saveCards(starter);
    return starter;
  }

  saveCards(cardsToSave = this.cards) {
    localStorage.setItem(ReviewerStudio.STORAGE_KEY, JSON.stringify(cardsToSave));
  }

  getCuratedStarterDeck() {
    return [
      {
        id: 'let-1',
        type: 'FLASHCARD',
        category: 'PROFED',
        competency: 'Facilitating Learner-Centered Teaching',
        front: 'Zone of Proximal Development (ZPD)',
        back: 'The cognitive distance between what a learner can achieve independently and what they can achieve with guidance from an adult or More Knowledgeable Other (MKO).\n\n💡 Classroom Analogy: Running alongside an apprentice cyclist holding the back of the saddle until their balance matures.',
        box: 1,
        reviewCount: 0,
        lastReviewedAt: null
      },
      {
        id: 'let-2',
        type: 'FLASHCARD',
        category: 'PROFED',
        competency: 'Child & Adolescent Development',
        front: 'Piagetian Accommodation vs. Assimilation',
        back: '• Assimilation: Fitting new stimuli into an existing schema without changing the rule (e.g. seeing a golden retriever and saying "doggy").\n• Accommodation: Modifying or creating a new schema because new information contradicts the old rule (e.g. learning that a whale is a mammal, not a fish).',
        box: 2,
        reviewCount: 1,
        lastReviewedAt: null
      },
      {
        id: 'let-3',
        type: 'SCENARIO_MCQ',
        category: 'PROFED',
        competency: 'Assessment of Learning',
        front: 'Teacher Angela conducts a 5-item diagnostic quiz at the beginning of the unit on photosynthesis to identify student misconceptions before planning her activities. Which type of assessment did Teacher Angela administer?',
        back: 'Diagnostic / Formative Assessment for Learning',
        options: [
          'A) Summative Assessment for Accountability',
          'B) Diagnostic Assessment for Learning',
          'C) Criterion-Referenced Final Test',
          'D) Norm-Referenced Placement Exam'
        ],
        correctAnswer: 'B',
        rationalization: 'Diagnostic assessments are administered before instructional units to detect learning gaps and baseline misconceptions, guiding lesson pacing rather than evaluating terminal grades.',
        box: 2,
        reviewCount: 1,
        lastReviewedAt: null
      },
      {
        id: 'let-4',
        type: 'FLASHCARD',
        category: 'PROFED',
        competency: 'The Teaching Profession & Laws',
        front: 'Republic Act No. 7836',
        back: 'Philippine Teachers Professionalization Act of 1994. Mandates that all basic education teachers must possess a valid Professional Teacher Certificate / License issued by the Board for Professional Teachers (PRC) before engaging in teaching.',
        box: 1,
        reviewCount: 0,
        lastReviewedAt: null
      },
      {
        id: 'let-5',
        type: 'SCENARIO_MCQ',
        category: 'PROFED',
        competency: 'DepEd Orders & Child Protection',
        front: 'Under DepEd Order No. 40, s. 2012 (Child Protection Policy), which practice is considered non-punitive positive discipline?',
        back: 'Guided behavioral reflection with logical restitution',
        options: [
          'A) Requiring a misbehaving pupil to kneel on coarse salt for 15 minutes',
          'B) Making sarcastic remarks about a learner\'s intelligence in front of classmates',
          'C) Holding a private conference to establish logical restitution and behavioral goals',
          'D) Excluding the student from attending physical education class permanently'
        ],
        correctAnswer: 'C',
        rationalization: 'Positive discipline emphasizes clear expectations, emotional self-regulation, and logical restitution in a felt environment of safety. Options A, B, and D constitute prohibited corporal and psychological degradation.',
        box: 3,
        reviewCount: 2,
        lastReviewedAt: null
      },
      {
        id: 'let-6',
        type: 'FLASHCARD',
        category: 'PROFED',
        competency: 'Curriculum Development',
        front: 'Spiral Progression Curriculum (RA 10533)',
        back: 'Curriculum design where basic principles are introduced early, and subsequently revisited in succeeding grade levels with increasing depth and conceptual complexity (Jerome Bruner).',
        box: 2,
        reviewCount: 1,
        lastReviewedAt: null
      },
      {
        id: 'let-7',
        type: 'FLASHCARD',
        category: 'PROFED',
        competency: 'Child & Adolescent Development',
        front: 'Kohlberg\'s Conventional Morality Stage',
        back: 'Stage of moral development where choices are governed by social conformity, the desire for peer approval ("Good Boy / Nice Girl"), and maintaining societal law and order.',
        box: 1,
        reviewCount: 0,
        lastReviewedAt: null
      },
      {
        id: 'let-8',
        type: 'FLASHCARD',
        category: 'PROFED',
        competency: 'Assessment & Bloom\'s Taxonomy',
        front: 'Bloom\'s Revised Highest Cognitive Level: "Creating"',
        back: 'In Anderson and Krathwohl\'s revised taxonomy, Creating (synthesizing diverse elements into a novel, coherent whole or original product) sits at the summit above Evaluating.',
        box: 3,
        reviewCount: 3,
        lastReviewedAt: null
      },
      {
        id: 'let-9',
        type: 'SCENARIO_MCQ',
        category: 'PROFED',
        competency: 'Constructivist Pedagogical Frameworks',
        front: 'During the 4As lesson cycle in Science, Teacher Marco asks: "Why did the blue litmus paper turn red in vinegar but remain blue in soapy water? What common property explains this?" In which phase of the 4As is Teacher Marco\'s class actively engaged?',
        back: 'Analysis (Reflective Processing)',
        options: [
          'A) Activity',
          'B) Analysis',
          'C) Abstraction',
          'D) Application'
        ],
        correctAnswer: 'B',
        rationalization: 'Analysis is the cognitive processing phase where learners dissect observations gathered during the Activity stage to uncover underlying relationships before generalizing theories in Abstraction.',
        box: 1,
        reviewCount: 0,
        lastReviewedAt: null
      },
      {
        id: 'let-10',
        type: 'SCENARIO_MCQ',
        category: 'PROFED',
        competency: 'Code of Ethics for Professional Teachers',
        front: 'Teacher Ronald operates a private tutorial center in his home city. A mother of three students enrolled in his regular Grade 9 public school class requests that Teacher Ronald tutor them for an agreed hourly fee. According to the Code of Ethics for Professional Teachers, what should Teacher Ronald do?',
        back: 'Politely decline tutoring his own enrolled students for compensation',
        options: [
          'A) Accept the arrangement as long as tutorials take place on weekends outside school hours',
          'B) Accept the arrangement provided a 20% discount is granted to underprivileged siblings',
          'C) Politely decline, as teachers are explicitly prohibited from accepting remuneration for tutoring their own regular pupils',
          'D) Demand that the school principal approve the commercial contract before signing'
        ],
        correctAnswer: 'C',
        rationalization: 'Article VIII, Section 5 of the Code of Ethics explicitly prohibits a teacher from accepting remuneration for tutorial services rendered to their own regular students to prevent conflict of interest and grading bias.',
        box: 1,
        reviewCount: 0,
        lastReviewedAt: null
      },
      {
        id: 'let-11',
        type: 'SCENARIO_MCQ',
        category: 'GENED',
        competency: 'English Language & Syntax',
        front: 'Select the sentence that demonstrates impeccable grammatical agreement according to standard academic syntax:',
        back: 'Subject-Verb Agreement with Intervening Parenthetical Phrase',
        options: [
          'A) The lead researcher, along with her two graduate assistants, have submitted the paper.',
          'B) The lead researcher, along with her two graduate assistants, has submitted the paper.',
          'C) Either the principal or the teachers is going to attend the division symposium.',
          'D) Ten thousand pesos are a reasonable stipend for the pre-service teaching internship.'
        ],
        correctAnswer: 'B',
        rationalization: 'Parenthetical phrases introduced by "along with", "as well as", or "together with" do not alter the number of the subject ("The lead researcher", singular), requiring the singular verb "has submitted".',
        box: 2,
        reviewCount: 1,
        lastReviewedAt: null
      },
      {
        id: 'let-12',
        type: 'SCENARIO_MCQ',
        category: 'GENED',
        competency: 'Philippine History & Social Sciences',
        front: 'Which symbolic act performed by Andres Bonifacio and the Katipuneros in August 1896 marked the definitive repudiation of Spanish colonial sovereignty?',
        back: 'Tearing of the Cedulas Personales during the Cry of Balintawak/Pugad Lawin',
        options: [
          'A) Promulgation of the Malolos Constitution',
          'B) The signing of the Pact of Biak-na-Bato',
          'C) The tearing of cedulas personales (residence certificates)',
          'D) The execution of GOMBURZA in Bagumbayan'
        ],
        correctAnswer: 'C',
        rationalization: 'The tearing of community residence certificates (cedulas personales) was the physical proclamation that Filipinos no longer recognized Spanish vassalage or colonial tax submission.',
        box: 3,
        reviewCount: 2,
        lastReviewedAt: null
      },
      {
        id: 'let-13',
        type: 'SCENARIO_MCQ',
        category: 'GENED',
        competency: 'Natural Sciences & Biology',
        front: 'During aerobic cellular respiration, which cellular organelle functions as the primary site of oxidative phosphorylation and adenosine triphosphate (ATP) synthesis?',
        back: 'Mitochondrion (Mitochondria)',
        options: [
          'A) Ribosome',
          'B) Golgi Apparatus',
          'C) Mitochondrion',
          'D) Lysosome'
        ],
        correctAnswer: 'C',
        rationalization: 'Mitochondria generate over 90% of cellular ATP via the electron transport chain and ATP synthase across their inner folded cristae, earning their reputation as the cellular powerhouse.',
        box: 2,
        reviewCount: 1,
        lastReviewedAt: null
      },
      {
        id: 'let-14',
        type: 'SCENARIO_MCQ',
        category: 'GENED',
        competency: 'Filipino (Wastong Gamit ng Salita)',
        front: 'Piliin ang pangungusap na nagpapakita ng tamang paggamit ng salitang "nang" ayon sa Balarila ng Wikang Pambansa:',
        back: 'Paggamit ng "nang" bilang pang-abay o pag-uulit ng pandiwa',
        options: [
          'A) Kumain nang masarap na mangga ang mga mag-aaral kaninang umaga.',
          'B) Tumakbo nang tumakbo ang bata hanggang sa mapagod at huminto.',
          'C) Ang hawak nang guro ay talaan ng mga marka sa pagsusulit.',
          'D) Dumating ang panauhin nang walang pasabi sa tanggapan.'
        ],
        correctAnswer: 'B',
        rationalization: 'Ginagamit ang "nang" sa pag-uulit ng pandiwa (tumakbo nang tumakbo), bilang pang-abay na naglalarawan kung paano ginawa ang kilos, o bilang kasingkahulugan ng "upang" o "noong". Sa A at C, "ng" ang dapat gamitin.',
        box: 2,
        reviewCount: 1,
        lastReviewedAt: null
      },
      {
        id: 'let-15',
        type: 'SCENARIO_MCQ',
        category: 'GENED',
        competency: 'Mathematics & Quantitative Reasoning',
        front: 'In a class of 40 pre-service education students, 24 students passed the diagnostic math quiz. What percentage of the class failed or needs remedial intervention?',
        back: 'Percentage & Complement Calculation: 40%',
        options: [
          'A) 35%',
          'B) 40%',
          'C) 60%',
          'D) 65%'
        ],
        correctAnswer: 'B',
        rationalization: 'If 24 passed out of 40, then 40 - 24 = 16 students failed. (16 / 40) × 100 = 40%. (Complementary to 24/40 = 60% passing rate).',
        box: 2,
        reviewCount: 1,
        lastReviewedAt: null
      }
    ];
  }

  render() {
    if (!this.container) return;

    if (this.activeMode === 'STUDY_CARDS') {
      this.renderStudyArena();
    } else if (this.activeMode === 'EXAM_SETUP') {
      this.renderExamSetup();
    } else if (this.activeMode === 'EXAM_ARENA') {
      this.renderExamArena();
    } else if (this.activeMode === 'EXAM_DIAGNOSTICS') {
      this.renderExamDiagnosticReport();
    } else {
      this.renderDeckOverview();
    }
  }

  renderDeckOverview() {
    const total = this.cards.length;
    const box1 = this.cards.filter(c => c.box === 1).length;
    const box2 = this.cards.filter(c => c.box === 2).length;
    const box3 = this.cards.filter(c => c.box === 3).length;
    const masteryPct = total > 0 ? Math.round((box3 / total) * 100) : 0;

    const filtered = this.cards.filter(c => {
      if (this.activeFilter === 'ALL') return true;
      return c.category === this.activeFilter;
    });

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="section-title">Licensure (LET) Flashcard &amp; Mastery Studio 🎯📚</h2>
          <p class="section-desc">Active retrieval, Leitner spaced repetition, and timed PRC board exam simulations for future teachers.</p>
        </div>
        <div class="header-actions">
          <button class="btn-primary" id="btn-start-flashcard-session">
            <span>🎴 Flashcard Session</span>
          </button>
          <button class="btn-secondary" id="btn-start-mock-quiz">
            <span>⏱️ Mock Board Exam Simulator</span>
          </button>
          <button class="btn-subtle" id="btn-open-add-card-modal">
            <span>➕ Add Card</span>
          </button>
        </div>
      </div>

      <!-- Leitner Mastery Banner -->
      <div class="leitner-mastery-banner">
        <div class="mastery-stat-card">
          <div class="stat-ring-box">
            <span class="mastery-number">${masteryPct}%</span>
            <span class="mastery-label">Long-Term Mastery</span>
          </div>
          <div class="mastery-progress-track">
            <div class="progress-fill-box3" style="width: ${(box3 / (total || 1)) * 100}%;" title="Box 3 Mastered"></div>
            <div class="progress-fill-box2" style="width: ${(box2 / (total || 1)) * 100}%;" title="Box 2 Reviewing"></div>
            <div class="progress-fill-box1" style="width: ${(box1 / (total || 1)) * 100}%;" title="Box 1 Emerging"></div>
          </div>
        </div>

        <div class="leitner-boxes-row">
          <div class="leitner-box-pill box-1">
            <span class="box-icon">🌱</span>
            <div class="box-text">
              <strong>Box 1: Emerging</strong>
              <span>${box1} cards • Daily active review</span>
            </div>
          </div>
          <div class="leitner-box-pill box-2">
            <span class="box-icon">🌿</span>
            <div class="box-text">
              <strong>Box 2: Familiar</strong>
              <span>${box2} cards • Review every 3 days</span>
            </div>
          </div>
          <div class="leitner-box-pill box-3">
            <span class="box-icon">🌳</span>
            <div class="box-text">
              <strong>Box 3: Mastered</strong>
              <span>${box3} cards • Permanent recall bank</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Filter Controls & Card Stream -->
      <div class="reviewer-control-bar">
        <div class="reviewer-filter-pills">
          <button class="filter-pill ${this.activeFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">All Decks (${total})</button>
          <button class="filter-pill ${this.activeFilter === 'PROFED' ? 'active' : ''}" data-filter="PROFED">Professional Education</button>
          <button class="filter-pill ${this.activeFilter === 'GENED' ? 'active' : ''}" data-filter="GENED">General Education</button>
          <button class="filter-pill ${this.activeFilter === 'MAJOR' ? 'active' : ''}" data-filter="MAJOR">Specialization / Major</button>
        </div>
        <span class="field-hint">Spaced repetition interval: correct answers advance boxes; incorrect resets to Box 1.</span>
      </div>

      <!-- Cards Grid -->
      <div class="reviewer-cards-grid">
        ${filtered.map(card => `
          <div class="reviewer-mini-card box-${card.box}" id="card-row-${card.id}">
            <div class="card-meta-line">
              <span class="badge-category badge-${card.category}">${card.category}</span>
              <span class="competency-tag">${this.escapeHtml(card.competency)}</span>
              <span class="box-indicator box-${card.box}">Box ${card.box}</span>
            </div>
            <h4 class="card-front-preview">${this.escapeHtml(card.front)}</h4>
            <p class="card-back-preview">${this.escapeHtml(card.back)}</p>
            <div class="card-footer-line">
              <span class="card-type-chip">${card.type === 'SCENARIO_MCQ' ? '📝 Board MCQ' : '🎴 Flashcard'}</span>
              <button class="btn-subtle-danger btn-delete-card" data-card-id="${card.id}" title="Remove card">✕</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    this.bindOverviewEvents();
  }

  renderStudyArena() {
    if (this.studyDeck.length === 0) {
      this.studyDeck = [...this.cards];
      this.currentCardIndex = 0;
    }

    const card = this.studyDeck[this.currentCardIndex];
    if (!card) {
      this.activeMode = 'DECK';
      this.render();
      return;
    }

    const currentNum = this.currentCardIndex + 1;
    const totalNum = this.studyDeck.length;

    this.container.innerHTML = `
      <div class="study-arena-header">
        <button class="btn-subtle" id="btn-exit-study">
          ← <span>Exit to Deck</span>
        </button>
        <div class="study-progress-counter">
          <span>Card <strong>${currentNum}</strong> of <strong>${totalNum}</strong></span>
          <span class="box-indicator box-${card.box}">Current: Box ${card.box}</span>
        </div>
        <button class="btn-subtle" id="btn-shuffle-study">
          🔀 <span>Shuffle</span>
        </button>
      </div>

      <div class="study-card-container">
        <!-- 3D Tactile Flip Card -->
        <div class="flip-card ${this.isCardFlipped ? 'flipped' : ''}" id="active-study-card">
          <!-- Card Front -->
          <div class="card-face card-face-front">
            <div class="face-header">
              <span class="badge-category badge-${card.category}">${card.category}</span>
              <span class="competency-tag">${this.escapeHtml(card.competency)}</span>
              <span class="flip-hint">👆 Click or press Space to flip</span>
            </div>
            <div class="face-body">
              <h3 class="face-prompt">${this.escapeHtml(card.front)}</h3>
            </div>
            <div class="face-footer">
              <span class="hint-text">Test active recall before flipping</span>
              <button class="btn-primary btn-flip-action" id="btn-flip-card">
                🔄 <span>Flip Card</span>
              </button>
            </div>
          </div>

          <!-- Card Back -->
          <div class="card-face card-face-back">
            <div class="face-header">
              <span class="answer-label">Pedagogical Core &amp; Explanation</span>
              <span class="flip-hint">👆 Click to flip front</span>
            </div>
            <div class="face-body">
              <div class="face-answer-text">${this.simpleMarkdown(card.back)}</div>
            </div>
            <div class="face-footer">
              <span class="hint-text">How confident were you?</span>
            </div>
          </div>
        </div>

        <!-- Leitner Progression Buttons -->
        <div class="leitner-action-bar">
          <button class="btn-leitner btn-leitner-box1" id="btn-rate-box1" title="Still learning; reset to Box 1">
            🌱 <span>Needs Practice</span>
            <small>Reset to Box 1</small>
          </button>
          <button class="btn-leitner btn-leitner-box2" id="btn-rate-box2" title="Familiar; advance to Box 2">
            🌿 <span>Familiar</span>
            <small>Advance to Box 2</small>
          </button>
          <button class="btn-leitner btn-leitner-box3" id="btn-rate-box3" title="Mastered; advance to Box 3">
            🌳 <span>Mastered!</span>
            <small>Lock in Box 3</small>
          </button>
        </div>

        <div class="keyboard-shortcuts-strip">
          <span>Keyboard shortcuts:</span>
          <kbd>Space</kbd> Flip card • <kbd>1</kbd> Box 1 • <kbd>2</kbd> Box 2 • <kbd>3</kbd> Box 3
        </div>
      </div>
    `;

    this.bindStudyEvents();
  }

  /**
   * Screen 1: Exam Configuration & Mode Selection
   */
  renderExamSetup() {
    const mcqs = this.cards.filter(c => c.type === 'SCENARIO_MCQ' && c.options && c.options.length > 0);
    const profEdCount = mcqs.filter(c => c.category === 'PROFED').length;
    const genEdCount = mcqs.filter(c => c.category === 'GENED').length;
    const box1Count = mcqs.filter(c => c.box === 1).length;

    this.container.innerHTML = `
      <div class="study-arena-header">
        <button class="btn-subtle" id="btn-exit-exam-setup">
          ← <span>Back to Reviewer Deck</span>
        </button>
        <span class="chip">PRC Licensure Test Bank: ${mcqs.length} Scenario MCQs</span>
      </div>

      <div class="exam-setup-card">
        <div class="exam-setup-hero">
          <div class="exam-setup-icon">⏱️</div>
          <h2>PRC Licensure Board Exam Simulator</h2>
          <p>Model the official Philippine Board Licensure Examination for Professional Teachers (LET) environment with strict timing, question navigation grids, and post-exam diagnostic analytics.</p>
        </div>

        <div class="exam-setup-form">
          <div class="setup-form-group">
            <label class="setup-label">1. Simulation Atmosphere</label>
            <div class="setup-toggle-grid">
              <label class="setup-radio-card ${this.examConfig.mode === 'TIMED' ? 'active' : ''}">
                <input type="radio" name="exam-mode" value="TIMED" ${this.examConfig.mode === 'TIMED' ? 'checked' : ''}>
                <div class="radio-card-content">
                  <span class="card-title">⏳ Strict PRC Timed Simulation</span>
                  <span class="card-desc">60 seconds per item countdown. Answers revealed only after submission on your Diagnostic Report.</span>
                </div>
              </label>
              <label class="setup-radio-card ${this.examConfig.mode === 'PRACTICE' ? 'active' : ''}">
                <input type="radio" name="exam-mode" value="PRACTICE" ${this.examConfig.mode === 'PRACTICE' ? 'checked' : ''}>
                <div class="radio-card-content">
                  <span class="card-title">💡 Study Sprint Practice</span>
                  <span class="card-desc">Untimed open drill. View instant rationalizations and correct answers immediately upon clicking.</span>
                </div>
              </label>
            </div>
          </div>

          <div class="setup-form-group">
            <label class="setup-label">2. Target Examination Domain</label>
            <div class="setup-pill-selector" id="exam-domain-pills">
              <button class="setup-pill ${this.examConfig.category === 'ALL' ? 'active' : ''}" data-cat="ALL">
                Comprehensive Mix (${mcqs.length})
              </button>
              <button class="setup-pill ${this.examConfig.category === 'PROFED' ? 'active' : ''}" data-cat="PROFED">
                ProfEd Specialty (${profEdCount})
              </button>
              <button class="setup-pill ${this.examConfig.category === 'GENED' ? 'active' : ''}" data-cat="GENED">
                GenEd Foundation (${genEdCount})
              </button>
              <button class="setup-pill ${this.examConfig.category === 'BOX1' ? 'active' : ''}" data-cat="BOX1">
                Leitner Box 1 High-Risk (${box1Count})
              </button>
            </div>
          </div>

          <div class="setup-form-group">
            <label class="setup-label">3. Number of Examination Items</label>
            <div class="setup-pill-selector" id="exam-count-pills">
              <button class="setup-pill ${this.examConfig.itemCount === 5 ? 'active' : ''}" data-count="5">5 Items (5 mins)</button>
              <button class="setup-pill ${this.examConfig.itemCount === 10 ? 'active' : ''}" data-count="10">10 Items (10 mins)</button>
              <button class="setup-pill ${this.examConfig.itemCount === 15 ? 'active' : ''}" data-count="15">15 Items (15 mins)</button>
              <button class="setup-pill ${this.examConfig.itemCount === 999 ? 'active' : ''}" data-count="999">All Available (${mcqs.length})</button>
            </div>
          </div>

          <div class="exam-setup-cta">
            <button class="btn-primary btn-large" id="btn-launch-exam">
              <span>🚀 Begin Board Examination</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindExamSetupEvents();
  }

  bindExamSetupEvents() {
    document.getElementById('btn-exit-exam-setup')?.addEventListener('click', () => {
      this.activeMode = 'DECK';
      this.render();
    });

    document.querySelectorAll('input[name="exam-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.examConfig.mode = e.target.value;
        this.renderExamSetup();
      });
    });

    document.querySelectorAll('#exam-domain-pills .setup-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        this.examConfig.category = pill.dataset.cat;
        this.renderExamSetup();
      });
    });

    document.querySelectorAll('#exam-count-pills .setup-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        this.examConfig.itemCount = parseInt(pill.dataset.count, 10);
        this.renderExamSetup();
      });
    });

    document.getElementById('btn-launch-exam')?.addEventListener('click', () => {
      this.startExam();
    });
  }

  startExam() {
    let pool = this.cards.filter(c => c.type === 'SCENARIO_MCQ' && c.options && c.options.length > 0);

    if (this.examConfig.category === 'PROFED') {
      pool = pool.filter(c => c.category === 'PROFED');
    } else if (this.examConfig.category === 'GENED') {
      pool = pool.filter(c => c.category === 'GENED');
    } else if (this.examConfig.category === 'BOX1') {
      pool = pool.filter(c => c.box === 1);
    }

    if (pool.length === 0) {
      showToast('No questions match this domain filter. Try selecting "Comprehensive Mix".', 'warning');
      return;
    }

    // Shuffle pool
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const count = Math.min(this.examConfig.itemCount, shuffled.length);
    this.examDeck = shuffled.slice(0, count);

    this.examCurrentIndex = 0;
    this.userAnswers = {};
    this.examIsPaused = false;
    this.examStartTime = Date.now();

    if (this.examConfig.mode === 'TIMED') {
      this.examSecondsRemaining = this.examDeck.length * this.examConfig.timePerItemSeconds;
      this.startExamTimer();
    } else {
      this.examSecondsRemaining = 0;
      this.clearExamTimer();
    }

    this.activeMode = 'EXAM_ARENA';
    this.render();
  }

  startExamTimer() {
    this.clearExamTimer();
    this.examTimerInterval = setInterval(() => {
      if (this.examIsPaused) return;

      this.examSecondsRemaining--;
      this.updateTimerDisplay();

      if (this.examSecondsRemaining <= 0) {
        this.clearExamTimer();
        showToast('⏰ Time is up! Submitting your examination answers for diagnostic scoring.', 'warning');
        this.finishExam(true);
      }
    }, 1000);
  }

  clearExamTimer() {
    if (this.examTimerInterval) {
      clearInterval(this.examTimerInterval);
      this.examTimerInterval = null;
    }
  }

  updateTimerDisplay() {
    const el = document.getElementById('exam-live-timer');
    if (!el) return;

    const mins = Math.floor(Math.max(0, this.examSecondsRemaining) / 60);
    const secs = Math.max(0, this.examSecondsRemaining) % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    el.textContent = formatted;
    if (this.examSecondsRemaining <= 120) {
      el.classList.add('timer-urgent');
    } else {
      el.classList.remove('timer-urgent');
    }
  }

  /**
   * Screen 2: Board Exam Simulator Arena
   */
  renderExamArena() {
    const card = this.examDeck[this.examCurrentIndex];
    if (!card) {
      this.finishExam();
      return;
    }

    const qNum = this.examCurrentIndex + 1;
    const totalQ = this.examDeck.length;
    const selectedAnswer = this.userAnswers[card.id] || null;
    const isFlagged = this.flaggedQuestions.has(card.id);
    const answeredCount = Object.keys(this.userAnswers).length;

    const mins = Math.floor(Math.max(0, this.examSecondsRemaining) / 60);
    const secs = Math.max(0, this.examSecondsRemaining) % 60;
    const timerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    this.container.innerHTML = `
      <!-- Live Exam Top Bar -->
      <div class="exam-arena-header">
        <div class="exam-header-left">
          <button class="btn-subtle" id="btn-abort-exam" title="Exit exam and return to deck">
            ✕ <span>Exit</span>
          </button>
          <span class="exam-badge-type">${this.examConfig.mode === 'TIMED' ? '⏱️ PRC Timed Simulation' : '💡 Practice Drill'}</span>
        </div>

        ${this.examConfig.mode === 'TIMED' ? `
          <div class="exam-timer-cluster">
            <span class="timer-icon">⏳</span>
            <span class="live-timer-digits ${this.examSecondsRemaining <= 120 ? 'timer-urgent' : ''}" id="exam-live-timer">${timerText}</span>
            <button class="btn-timer-pause" id="btn-toggle-pause" title="Pause or resume timer">
              ${this.examIsPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
          </div>
        ` : `
          <div class="exam-practice-tag">Practice Mode • No Timer Pressure</div>
        `}

        <div class="exam-header-right">
          <button class="btn-flag-question ${isFlagged ? 'flagged' : ''}" id="btn-toggle-flag" title="Flag this question to review before submitting">
            🔖 <span>${isFlagged ? 'Flagged for Review' : 'Flag Question'}</span>
          </button>
          <button class="btn-primary btn-submit-exam" id="btn-submit-exam">
            <span>✓ Finish &amp; Submit (${answeredCount}/${totalQ})</span>
          </button>
        </div>
      </div>

      <!-- Main Dual Split: Question Workspace + Question Jump Grid -->
      <div class="exam-split-layout">
        <!-- Main Question Area -->
        <div class="exam-main-stage">
          <div class="exam-card-shell">
            <div class="question-header">
              <span class="q-badge">Item ${qNum} of ${totalQ}</span>
              <span class="badge-category badge-${card.category}">${card.category}</span>
              <span class="competency-tag">${this.escapeHtml(card.competency)}</span>
              ${isFlagged ? '<span class="chip chip-flagged">🔖 Marked for Review</span>' : ''}
            </div>

            <h3 class="exam-question-stem">${this.escapeHtml(card.front)}</h3>

            <!-- Options List -->
            <div class="exam-options-grid">
              ${(card.options || []).map(opt => {
                const letter = opt.trim().charAt(0);
                const textOnly = opt.replace(/^[A-D]\)\s*/, '');
                const isSelected = selectedAnswer === letter;
                
                let optionClasses = 'exam-option-choice';
                if (isSelected) optionClasses += ' selected';

                // In Practice mode, highlight immediately
                if (this.examConfig.mode === 'PRACTICE' && selectedAnswer) {
                  if (letter === card.correctAnswer) optionClasses += ' practice-correct';
                  else if (isSelected) optionClasses += ' practice-incorrect';
                  else optionClasses += ' practice-dim';
                }

                return `
                  <button class="${optionClasses}" data-letter="${letter}">
                    <span class="choice-bubble">${letter}</span>
                    <span class="choice-text">${this.escapeHtml(textOnly)}</span>
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Instant Rationale in Practice Mode -->
            ${this.examConfig.mode === 'PRACTICE' && selectedAnswer ? `
              <div class="practice-rationale-box">
                <div class="rationale-header">
                  ${selectedAnswer === card.correctAnswer 
                    ? '<span class="status-correct">✓ Correct Choice!</span>' 
                    : `<span class="status-incorrect">✕ Selected ${selectedAnswer}. Correct Answer is ${card.correctAnswer}.</span>`}
                </div>
                <p class="rationale-body">${this.simpleMarkdown(card.rationalization || card.back)}</p>
              </div>
            ` : ''}

            <!-- Bottom Navigation Bar -->
            <div class="exam-bottom-nav">
              <button class="btn-subtle" id="btn-prev-q" ${this.examCurrentIndex === 0 ? 'disabled' : ''}>
                ← <span>Previous Item</span>
              </button>
              ${selectedAnswer ? `
                <button class="btn-subtle-danger" id="btn-clear-answer">
                  <span>Clear Selection</span>
                </button>
              ` : '<span></span>'}
              <button class="btn-secondary" id="btn-next-q">
                <span>${qNum < totalQ ? 'Next Item →' : 'Review & Submit ✓'}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Question Navigator Jump Grid -->
        <div class="exam-navigator-drawer">
          <div class="navigator-header">
            <h4>Question Matrix</h4>
            <span class="nav-count">${answeredCount} / ${totalQ} Answered</span>
          </div>

          <div class="navigator-legend">
            <span class="legend-item"><span class="legend-dot current"></span> Current</span>
            <span class="legend-item"><span class="legend-dot answered"></span> Answered</span>
            <span class="legend-item"><span class="legend-dot flagged"></span> Flagged</span>
            <span class="legend-item"><span class="legend-dot unanswered"></span> Blank</span>
          </div>

          <div class="navigator-grid">
            ${this.examDeck.map((item, idx) => {
              const isCurr = idx === this.examCurrentIndex;
              const isAns = Boolean(this.userAnswers[item.id]);
              const isFlg = this.flaggedQuestions.has(item.id);
              
              let classes = 'nav-cell';
              if (isCurr) classes += ' current';
              if (isAns) classes += ' answered';
              if (isFlg) classes += ' flagged';

              return `
                <button class="${classes}" data-index="${idx}" title="Jump to question ${idx + 1}">
                  ${idx + 1}
                  ${isFlg ? '<span class="flag-dot"></span>' : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    this.bindExamArenaEvents();
  }

  bindExamArenaEvents() {
    const card = this.examDeck[this.examCurrentIndex];
    if (!card) return;

    // Option Selection
    document.querySelectorAll('.exam-option-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        const letter = btn.dataset.letter;
        this.userAnswers[card.id] = letter;
        this.renderExamArena();
      });
    });

    // Clear Answer
    document.getElementById('btn-clear-answer')?.addEventListener('click', () => {
      delete this.userAnswers[card.id];
      this.renderExamArena();
    });

    // Flag toggle
    document.getElementById('btn-toggle-flag')?.addEventListener('click', () => {
      this.toggleFlag(card.id);
      this.renderExamArena();
    });

    // Previous / Next
    document.getElementById('btn-prev-q')?.addEventListener('click', () => {
      if (this.examCurrentIndex > 0) {
        this.examCurrentIndex--;
        this.renderExamArena();
      }
    });

    document.getElementById('btn-next-q')?.addEventListener('click', () => {
      if (this.examCurrentIndex < this.examDeck.length - 1) {
        this.examCurrentIndex++;
        this.renderExamArena();
      } else {
        this.promptSubmitExam();
      }
    });

    // Matrix Jump Grid
    document.querySelectorAll('.navigator-grid .nav-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        this.examCurrentIndex = parseInt(cell.dataset.index, 10);
        this.renderExamArena();
      });
    });

    // Toggle pause
    document.getElementById('btn-toggle-pause')?.addEventListener('click', () => {
      this.examIsPaused = !this.examIsPaused;
      showToast(this.examIsPaused ? 'Timer paused. Take a mindful breath.' : 'Timer resumed. Keep your focus!', 'info');
      this.renderExamArena();
    });

    // Submit button
    document.getElementById('btn-submit-exam')?.addEventListener('click', () => {
      this.promptSubmitExam();
    });

    // Abort button
    document.getElementById('btn-abort-exam')?.addEventListener('click', () => {
      if (confirm('Exit this exam session? Any unsubmitted responses will be discarded.')) {
        this.clearExamTimer();
        this.activeMode = 'DECK';
        this.render();
      }
    });
  }

  promptSubmitExam() {
    const totalQ = this.examDeck.length;
    const answeredCount = Object.keys(this.userAnswers).length;
    const unansweredCount = totalQ - answeredCount;

    if (unansweredCount > 0) {
      if (confirm(`You have ${unansweredCount} unanswered question(s). Are you sure you want to finish and submit your exam now?`)) {
        this.finishExam();
      }
    } else {
      this.finishExam();
    }
  }

  finishExam(autoTimedOut = false) {
    this.clearExamTimer();
    const elapsedSeconds = Math.round((Date.now() - (this.examStartTime || Date.now())) / 1000);
    this.examDurationTaken = Math.max(1, elapsedSeconds);

    let totalScore = 0;
    let profEdScore = 0;
    let profEdTotal = 0;
    let genEdScore = 0;
    let genEdTotal = 0;

    const questionResults = this.examDeck.map(card => {
      const userChoice = this.userAnswers[card.id] || null;
      const isCorrect = userChoice === card.correctAnswer;
      const wasFlagged = this.flaggedQuestions.has(card.id);

      if (isCorrect) totalScore++;

      if (card.category === 'PROFED') {
        profEdTotal++;
        if (isCorrect) profEdScore++;
      } else if (card.category === 'GENED') {
        genEdTotal++;
        if (isCorrect) genEdScore++;
      }

      return {
        card,
        userChoice,
        correctAnswer: card.correctAnswer,
        isCorrect,
        wasFlagged
      };
    });

    const totalQ = this.examDeck.length || 1;
    const overallPct = Math.round((totalScore / totalQ) * 100);
    const profEdPct = profEdTotal > 0 ? Math.round((profEdScore / profEdTotal) * 100) : 0;
    const genEdPct = genEdTotal > 0 ? Math.round((genEdScore / genEdTotal) * 100) : 0;
    const isPassed = overallPct >= 75; // Official PRC 75.0% passing benchmark

    this.examResultDiagnostics = {
      timestamp: new Date().toISOString(),
      overallScore: totalScore,
      totalQuestions: totalQ,
      overallPercentage: overallPct,
      isPassed,
      profEdScore,
      profEdTotal,
      profEdPercentage: profEdPct,
      genEdScore,
      genEdTotal,
      genEdPercentage: genEdPct,
      durationSeconds: this.examDurationTaken,
      avgPacePerItem: Math.round(this.examDurationTaken / totalQ),
      questionResults,
      autoTimedOut
    };

    this.activeMode = 'EXAM_DIAGNOSTICS';
    this.diagnosticFilter = 'ALL';
    this.render();
  }

  /**
   * Screen 3: Diagnostic Assessment & Analytics Report
   */
  renderExamDiagnosticReport() {
    const diag = this.examResultDiagnostics;
    if (!diag) {
      this.activeMode = 'DECK';
      this.render();
      return;
    }

    const mins = Math.floor(diag.durationSeconds / 60);
    const secs = diag.durationSeconds % 60;
    const durationStr = `${mins}m ${secs}s`;

    const missedCount = diag.questionResults.filter(q => !q.isCorrect).length;
    const flaggedCount = diag.questionResults.filter(q => q.wasFlagged).length;

    // Filtered results for the review list
    const filteredReview = diag.questionResults.filter(r => {
      if (this.diagnosticFilter === 'INCORRECT') return !r.isCorrect;
      if (this.diagnosticFilter === 'FLAGGED') return r.wasFlagged;
      return true;
    });

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="section-title">Board Exam Diagnostic Assessment 🏆</h2>
          <p class="section-desc">Formal PRC Licensure Performance Analytics &amp; Pedagogical Rationales.</p>
        </div>
        <div class="header-actions">
          <button class="btn-subtle" id="btn-export-diagnostic-doc">
            📄 <span>Export Report (.doc)</span>
          </button>
          <button class="btn-subtle" id="btn-print-diagnostic">
            🖨️ <span>Print Score Sheet</span>
          </button>
          <button class="btn-primary" id="btn-new-exam-session">
            <span>🔄 New Simulation</span>
          </button>
        </div>
      </div>

      <!-- Diagnostic Executive Summary -->
      <div class="diagnostic-summary-card ${diag.isPassed ? 'passed-card' : 'needs-work-card'}">
        <div class="score-circle-cluster">
          <div class="diagnostic-circle">
            <span class="circle-pct">${diag.overallPercentage}%</span>
            <span class="circle-label">${diag.overallScore} of ${diag.totalQuestions} Items</span>
          </div>
          <div class="prc-threshold-indicator">
            <span class="threshold-badge ${diag.isPassed ? 'badge-passed' : 'badge-remedial'}">
              ${diag.isPassed ? '✓ PRC LICENSURE PASSED' : '🌱 BELOW PRC THRESHOLD (75%)'}
            </span>
            <p class="threshold-note">
              ${diag.isPassed 
                ? '🌿 <strong>Exemplary Demonstration:</strong> Your performance satisfies the Professional Regulation Commission (PRC) passing standard of 75.0% across foundational competencies.'
                : '🌱 <strong>Nurturing Phase:</strong> The PRC licensure passing threshold is 75.0%. Review the pedagogical rationalizations below and advance missed items into your daily Leitner cycle.'}
            </p>
          </div>
        </div>

        <!-- Metrics Row -->
        <div class="diagnostic-metrics-grid">
          <div class="metric-block">
            <span class="metric-label">Professional Education</span>
            <span class="metric-val">${diag.profEdScore} / ${diag.profEdTotal} (${diag.profEdPercentage}%)</span>
            <div class="metric-bar"><div class="metric-fill" style="width: ${diag.profEdPercentage}%;"></div></div>
          </div>
          <div class="metric-block">
            <span class="metric-label">General Education</span>
            <span class="metric-val">${diag.genEdScore} / ${diag.genEdTotal} (${diag.genEdPercentage}%)</span>
            <div class="metric-bar"><div class="metric-fill" style="width: ${diag.genEdPercentage}%;"></div></div>
          </div>
          <div class="metric-block">
            <span class="metric-label">Session Duration</span>
            <span class="metric-val">${durationStr}</span>
            <span class="metric-sub">Pace: ~${diag.avgPacePerItem}s / item</span>
          </div>
        </div>

        <!-- Leitner Remediation Action Strip -->
        <div class="diagnostic-remediation-bar">
          <div class="remediation-text">
            <strong>Spaced Repetition Integration:</strong>
            <span>You have ${missedCount} concept(s) requiring remediation. Add them immediately to Leitner Box 1 for active daily recall.</span>
          </div>
          <button class="btn-secondary" id="btn-queue-box1" ${missedCount === 0 ? 'disabled' : ''}>
            🌱 <span>Queue ${missedCount} Missed in Box 1</span>
          </button>
        </div>
      </div>

      <!-- Question-by-Question Rationale Review Section -->
      <div class="diagnostic-review-header">
        <div class="diagnostic-filter-tabs">
          <button class="filter-tab ${this.diagnosticFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">
            All Questions (${diag.questionResults.length})
          </button>
          <button class="filter-tab ${this.diagnosticFilter === 'INCORRECT' ? 'active' : ''}" data-filter="INCORRECT">
            Missed Concepts (${missedCount})
          </button>
          <button class="filter-tab ${this.diagnosticFilter === 'FLAGGED' ? 'active' : ''}" data-filter="FLAGGED">
            Flagged Items (${flaggedCount})
          </button>
        </div>
      </div>

      <!-- Review List -->
      <div class="diagnostic-questions-stream">
        ${filteredReview.map((res, idx) => {
          const card = res.card;
          return `
            <div class="diagnostic-review-item ${res.isCorrect ? 'item-correct' : 'item-incorrect'}">
              <div class="item-header">
                <span class="item-index-badge">${res.isCorrect ? '✓ Item' : '✕ Item'} ${idx + 1}</span>
                <span class="badge-category badge-${card.category}">${card.category}</span>
                <span class="competency-tag">${this.escapeHtml(card.competency)}</span>
                ${res.wasFlagged ? '<span class="chip">🔖 Flagged</span>' : ''}
              </div>

              <h4 class="item-stem">${this.escapeHtml(card.front)}</h4>

              <div class="item-options-breakdown">
                ${(card.options || []).map(opt => {
                  const letter = opt.trim().charAt(0);
                  const isUserPick = res.userChoice === letter;
                  const isRightAns = card.correctAnswer === letter;

                  let optClass = 'review-option-line';
                  if (isRightAns) optClass += ' right-answer';
                  if (isUserPick && !isRightAns) optClass += ' wrong-user-pick';

                  return `
                    <div class="${optClass}">
                      <span class="opt-bullet">${isRightAns ? '✓' : (isUserPick ? '✕' : letter)}</span>
                      <span class="opt-text">${this.escapeHtml(opt)}</span>
                      ${isUserPick ? '<span class="tag-user-pick">(Your Answer)</span>' : ''}
                      ${isRightAns ? '<span class="tag-correct-answer">(Correct Key)</span>' : ''}
                    </div>
                  `;
                }).join('')}
              </div>

              <div class="item-rationale-box">
                <strong>Pedagogical Rationale:</strong>
                <p>${this.simpleMarkdown(card.rationalization || card.back)}</p>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="diagnostic-footer-nav">
        <button class="btn-subtle" id="btn-back-deck-from-diag">
          ← <span>Return to Reviewer Deck</span>
        </button>
      </div>
    `;

    this.bindDiagnosticEvents();
  }

  bindDiagnosticEvents() {
    document.getElementById('btn-new-exam-session')?.addEventListener('click', () => {
      this.activeMode = 'EXAM_SETUP';
      this.render();
    });

    document.getElementById('btn-back-deck-from-diag')?.addEventListener('click', () => {
      this.activeMode = 'DECK';
      this.render();
    });

    document.getElementById('btn-print-diagnostic')?.addEventListener('click', () => {
      window.print();
    });

    document.getElementById('btn-export-diagnostic-doc')?.addEventListener('click', () => {
      this.exportDiagnosticToWord();
    });

    // Filter tabs
    document.querySelectorAll('.diagnostic-filter-tabs .filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.diagnosticFilter = tab.dataset.filter;
        this.renderExamDiagnosticReport();
      });
    });

    // 1-Click Queue Missed in Box 1
    document.getElementById('btn-queue-box1')?.addEventListener('click', () => {
      const missed = this.examResultDiagnostics?.questionResults.filter(q => !q.isCorrect) || [];
      if (missed.length === 0) return;

      let updatedCount = 0;
      missed.forEach(res => {
        const found = this.cards.find(c => c.id === res.card.id);
        if (found) {
          found.box = 1;
          found.reviewCount = (found.reviewCount || 0) + 1;
          found.lastReviewedAt = new Date().toISOString();
          updatedCount++;
        }
      });

      this.saveCards();
      showToast(`🌱 Successfully placed ${updatedCount} missed concepts into Leitner Box 1 for daily active recall!`, 'success');
      const btn = document.getElementById('btn-queue-box1');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '✓ <span>Queued in Box 1!</span>';
      }
    });
  }

  /**
   * Generates official Word (.doc) diagnostic assessment sheet
   */
  exportDiagnosticToWord() {
    const diag = this.examResultDiagnostics;
    if (!diag) return;

    const dateStr = new Date(diag.timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const docContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" 
            xmlns:w="urn:schemas-microsoft-com:office:word" 
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>PRC Licensure Examination for Teachers - Diagnostic Assessment</title>
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.35; color: #1a1a1a; margin: 20px; }
          .inst-header { text-align: center; border-bottom: 2pt solid #3B6347; padding-bottom: 8px; margin-bottom: 14px; }
          .inst-title { font-size: 14pt; font-weight: bold; color: #3B6347; text-transform: uppercase; }
          .inst-sub { font-size: 10pt; color: #555; }
          .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          .summary-table td, .summary-table th { border: 1pt solid #ccc; padding: 6px 10px; font-size: 10pt; }
          .summary-table th { background-color: #F4F7F4; text-align: left; }
          .score-banner { font-size: 13pt; font-weight: bold; color: ${diag.isPassed ? '#3B6347' : '#BF5F3E'}; }
          .q-block { margin-bottom: 14px; page-break-inside: avoid; border-bottom: 0.5pt solid #eee; padding-bottom: 10px; }
          .q-stem { font-weight: bold; margin-bottom: 4px; font-size: 10.5pt; }
          .opt-row { margin-left: 15px; font-size: 10pt; }
          .correct-row { color: #2E5638; font-weight: bold; }
          .wrong-row { color: #BF5F3E; }
          .rationale { background-color: #FAF8F3; border-left: 3pt solid #3B6347; padding: 6px 10px; margin-top: 6px; font-size: 9.5pt; }
        </style>
      </head>
      <body>
        <div class="inst-header">
          <div class="inst-title">PRC Board Licensure Examination for Teachers (LET)</div>
          <div class="inst-sub">Pre-Service Teacher Diagnostic Simulation &amp; Competency Report • Pedagogo Desk 🌿</div>
        </div>

        <table class="summary-table">
          <tr>
            <th width="25%">Examination Date:</th>
            <td width="25%">${dateStr}</td>
            <th width="25%">PRC Benchmark Status:</th>
            <td width="25%" class="score-banner">${diag.isPassed ? 'PASSED (≥ 75.0%)' : 'BELOW 75.0% THRESHOLD'}</td>
          </tr>
          <tr>
            <th>Overall Diagnostic Score:</th>
            <td><strong>${diag.overallScore} / ${diag.totalQuestions} (${diag.overallPercentage}%)</strong></td>
            <th>Examination Pace:</th>
            <td>~${diag.avgPacePerItem} seconds / item</td>
          </tr>
          <tr>
            <th>Professional Education:</th>
            <td>${diag.profEdScore} / ${diag.profEdTotal} (${diag.profEdPercentage}%)</td>
            <th>General Education:</th>
            <td>${diag.genEdScore} / ${diag.genEdTotal} (${diag.genEdPercentage}%)</td>
          </tr>
        </table>

        <h3 style="color: #3B6347; border-bottom: 1pt solid #3B6347; padding-bottom: 4px;">Item-by-Item Pedagogical Rationalizations</h3>

        ${diag.questionResults.map((r, i) => `
          <div class="q-block">
            <div class="q-stem">${i + 1}. [${r.card.category}] ${this.escapeHtml(r.card.front)}</div>
            ${(r.card.options || []).map(opt => {
              const letter = opt.trim().charAt(0);
              const isRight = letter === r.card.correctAnswer;
              const isUser = letter === r.userChoice;
              let cls = 'opt-row';
              let suffix = '';
              if (isRight) { cls += ' correct-row'; suffix = ' ✓ (Correct)'; }
              if (isUser && !isRight) { cls += ' wrong-row'; suffix = ' ✕ (Your Answer)'; }
              return `<div class="${cls}">${this.escapeHtml(opt)}${suffix}</div>`;
            }).join('')}
            <div class="rationale">
              <strong>Rationalization:</strong> ${this.escapeHtml(r.card.rationalization || r.card.back)}
            </div>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    const blob = new Blob([docContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LET_Diagnostic_Report_${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('📄 LET Diagnostic Assessment Report downloaded successfully!', 'success');
  }

  bindOverviewEvents() {
    document.getElementById('btn-start-flashcard-session')?.addEventListener('click', () => {
      this.studyDeck = [...this.cards].sort(() => Math.random() - 0.5);
      this.currentCardIndex = 0;
      this.isCardFlipped = false;
      this.activeMode = 'STUDY_CARDS';
      this.render();
    });

    document.getElementById('btn-start-mock-quiz')?.addEventListener('click', () => {
      this.activeMode = 'EXAM_SETUP';
      this.render();
    });

    document.getElementById('btn-open-add-card-modal')?.addEventListener('click', () => {
      this.openAddCardModal();
    });

    // Filter pills
    document.querySelectorAll('.reviewer-filter-pills .filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        this.activeFilter = pill.dataset.filter;
        this.render();
      });
    });

    // Delete card
    document.querySelectorAll('.btn-delete-card').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.cardId;
        if (confirm('Remove this card from your LET reviewer deck?')) {
          this.cards = this.cards.filter(c => c.id !== id);
          this.saveCards();
          this.render();
        }
      });
    });
  }

  bindStudyEvents() {
    const cardEl = document.getElementById('active-study-card');
    const btnFlip = document.getElementById('btn-flip-card');
    const btnExit = document.getElementById('btn-exit-study');
    const btnShuffle = document.getElementById('btn-shuffle-study');

    const toggleFlip = () => {
      this.isCardFlipped = !this.isCardFlipped;
      if (cardEl) cardEl.classList.toggle('flipped', this.isCardFlipped);
    };

    if (cardEl) cardEl.addEventListener('click', toggleFlip);
    if (btnFlip) btnFlip.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFlip();
    });

    if (btnExit) btnExit.addEventListener('click', () => {
      this.activeMode = 'DECK';
      this.render();
    });

    if (btnShuffle) btnShuffle.addEventListener('click', () => {
      this.studyDeck.sort(() => Math.random() - 0.5);
      this.currentCardIndex = 0;
      this.isCardFlipped = false;
      this.render();
    });

    // Rating buttons
    const handleRating = (targetBox) => {
      const card = this.studyDeck[this.currentCardIndex];
      if (card) {
        card.box = targetBox;
        card.reviewCount = (card.reviewCount || 0) + 1;
        card.lastReviewedAt = new Date().toISOString();
        
        // Update in main cards list
        const match = this.cards.find(c => c.id === card.id);
        if (match) {
          match.box = targetBox;
          match.reviewCount = card.reviewCount;
          match.lastReviewedAt = card.lastReviewedAt;
        }
        this.saveCards();
      }

      this.currentCardIndex++;
      this.isCardFlipped = false;
      this.render();
    };

    document.getElementById('btn-rate-box1')?.addEventListener('click', () => handleRating(1));
    document.getElementById('btn-rate-box2')?.addEventListener('click', () => handleRating(2));
    document.getElementById('btn-rate-box3')?.addEventListener('click', () => handleRating(3));

    // Keyboard navigation
    this.boundKeyHandler = (e) => {
      if (this.activeMode !== 'STUDY_CARDS') return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggleFlip();
      } else if (e.key === '1') {
        handleRating(1);
      } else if (e.key === '2') {
        handleRating(2);
      } else if (e.key === '3') {
        handleRating(3);
      }
    };

    window.removeEventListener('keydown', this.boundKeyHandler);
    window.addEventListener('keydown', this.boundKeyHandler, { once: true });
  }

  openAddCardModal() {
    let modal = document.getElementById('modal-add-let-card');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-add-let-card';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Create Pre-Service Study Card</h3>
          <button class="modal-close" id="btn-close-card-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group flex-1">
              <label>Format</label>
              <select id="modal-card-type">
                <option value="FLASHCARD">🎴 Spaced Retrieval Flashcard</option>
                <option value="SCENARIO_MCQ">📝 LET Scenario Multiple Choice</option>
              </select>
            </div>
            <div class="form-group flex-1">
              <label>Category</label>
              <select id="modal-card-category">
                <option value="PROFED">Professional Education</option>
                <option value="GENED">General Education</option>
                <option value="MAJOR">Specialization / Major</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Competency / Topic Tag</label>
            <input type="text" id="modal-card-competency" placeholder="e.g. Assessment of Learning, Child Development, RA 7836">
          </div>
          <div class="form-group">
            <label>Front Prompt / Question Scenario</label>
            <textarea id="modal-card-front" rows="3" placeholder="Enter term, concept, or scenario-based board question..."></textarea>
          </div>
          <div class="form-group">
            <label>Back Explanation / Rationalization</label>
            <textarea id="modal-card-back" rows="4" placeholder="Enter conceptual breakdown, classroom analogy, or why the answer is correct..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-subtle" id="btn-cancel-card-modal">Cancel</button>
          <button class="btn-primary" id="btn-save-new-card">Add to Leitner Box 1</button>
        </div>
      </div>
    `;

    modal.classList.add('active');

    const closeModal = () => modal.classList.remove('active');
    document.getElementById('btn-close-card-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-card-modal')?.addEventListener('click', closeModal);

    document.getElementById('btn-save-new-card')?.addEventListener('click', () => {
      const type = document.getElementById('modal-card-type').value;
      const category = document.getElementById('modal-card-category').value;
      const competency = document.getElementById('modal-card-competency').value.trim() || 'General Pedagogy';
      const front = document.getElementById('modal-card-front').value.trim();
      const back = document.getElementById('modal-card-back').value.trim();

      if (!front || !back) {
        showToast('Please fill in both the Front and Back of the card.', 'warning');
        return;
      }

      const newCard = {
        id: 'card-' + Date.now(),
        type,
        category,
        competency,
        front,
        back,
        box: 1,
        reviewCount: 0,
        lastReviewedAt: new Date().toISOString()
      };

      this.cards.unshift(newCard);
      this.saveCards();
      closeModal();
      this.render();
      showToast('New study card created and added to Leitner Box 1!', 'success');
    });
  }

  /**
   * Import scenario questions generated in Reading Desk into student's permanent reviewer deck.
   */
  importQuestionsFromReadingDesk(questionsArray, docTitle) {
    if (!questionsArray || questionsArray.length === 0) return 0;

    let addedCount = 0;
    questionsArray.forEach((q, idx) => {
      const card = {
        id: 'let-import-' + Date.now() + '-' + idx,
        type: 'SCENARIO_MCQ',
        category: 'PROFED',
        competency: docTitle || 'Course Reading',
        front: q.prompt,
        back: q.rationale,
        options: q.options || [],
        correctAnswer: q.correctAnswer || 'A',
        rationalization: q.rationale,
        box: 1,
        reviewCount: 0,
        lastReviewedAt: new Date().toISOString()
      };
      this.cards.unshift(card);
      addedCount++;
    });

    this.saveCards();
    this.render();
    showToast(`Saved ${addedCount} LET practice questions to your study deck!`, 'success');
    return addedCount;
  }

  simpleMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '<br><br>');
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
}
