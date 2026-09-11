/**
 * Pedagogo Desk: Licensure (LET) Flashcard & Mastery Studio 🎯📚
 * Grounded in Spaced Repetition (Leitner System) and Active Retrieval.
 */
import { showToast } from './toast.js';

export class ReviewerStudio {
  static STORAGE_KEY = 'pedagogo_let_cards';

  constructor() {
    this.cards = this.loadCards();
    this.activeFilter = 'ALL'; // ALL, PROFED, GENED, MAJOR
    this.activeMode = 'DECK'; // DECK, STUDY_CARDS, MOCK_QUIZ
    
    // Flashcard study state
    this.currentCardIndex = 0;
    this.isCardFlipped = false;
    this.studyDeck = [];

    // Mock quiz state
    this.quizDeck = [];
    this.quizCurrentIndex = 0;
    this.quizSelectedAnswer = null;
    this.quizScore = 0;

    this.container = document.getElementById('view-reviewer');
    if (this.container) {
      this.render();
    }
  }

  loadCards() {
    const saved = localStorage.getItem(ReviewerStudio.STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
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
          'A) Summative Assessment',
          'B) Diagnostic / Formative Assessment',
          'C) Criterion-Referenced Final Test',
          'D) Norm-Referenced Placement Exam'
        ],
        correctAnswer: 'B',
        rationalization: 'Diagnostic and formative assessments are administered before or during the instructional process to identify learning gaps and adjust pedagogical pacing, rather than assigning final evaluative marks.',
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
      }
    ];
  }

  render() {
    if (!this.container) return;

    if (this.activeMode === 'STUDY_CARDS') {
      this.renderStudyArena();
    } else if (this.activeMode === 'MOCK_QUIZ') {
      this.renderMockQuizArena();
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
          <p class="section-desc">Active retrieval &amp; Leitner spaced repetition system for pre-service board exam success.</p>
        </div>
        <div class="header-actions">
          <button class="btn-primary" id="btn-start-flashcard-session">
            <span>🎴 Start Flashcard Session</span>
          </button>
          <button class="btn-secondary" id="btn-start-mock-quiz">
            <span>📝 Timed Mock Quiz</span>
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

  renderMockQuizArena() {
    const mcqCards = this.cards.filter(c => c.type === 'SCENARIO_MCQ' && c.options && c.options.length > 0);
    if (mcqCards.length === 0) {
      showToast('No scenario multiple-choice questions found in deck. Add or generate questions from the Reading Desk first!', 'warning');
      this.activeMode = 'DECK';
      this.render();
      return;
    }

    if (this.quizDeck.length === 0) {
      this.quizDeck = [...mcqCards].sort(() => Math.random() - 0.5);
      this.quizCurrentIndex = 0;
      this.quizSelectedAnswer = null;
      this.quizScore = 0;
    }

    const card = this.quizDeck[this.quizCurrentIndex];
    if (!card) {
      this.renderQuizResults();
      return;
    }

    const qNum = this.quizCurrentIndex + 1;
    const totalQ = this.quizDeck.length;

    this.container.innerHTML = `
      <div class="study-arena-header">
        <button class="btn-subtle" id="btn-exit-quiz">
          ← <span>Exit Mock Quiz</span>
        </button>
        <div class="study-progress-counter">
          <span>Question <strong>${qNum}</strong> of <strong>${totalQ}</strong></span>
          <span class="chip">Score: ${this.quizScore} / ${this.quizCurrentIndex}</span>
        </div>
      </div>

      <div class="mock-quiz-container">
        <div class="quiz-question-card quiz-active-card">
          <div class="question-header">
            <span class="q-badge">Question ${qNum}</span>
            <span class="badge-category badge-${card.category}">${card.category}</span>
            <span class="competency-tag">${this.escapeHtml(card.competency)}</span>
          </div>

          <h3 class="mock-scenario-text">${this.escapeHtml(card.front)}</h3>

          <div class="quiz-options-list">
            ${(card.options || []).map(opt => {
              const letter = opt.trim().charAt(0);
              let optionClass = '';
              if (this.quizSelectedAnswer) {
                if (letter === card.correctAnswer) optionClass = 'correct';
                else if (letter === this.quizSelectedAnswer) optionClass = 'incorrect';
                else optionClass = 'disabled';
              }

              return `
                <button class="quiz-option-btn ${optionClass}" data-letter="${letter}" ${this.quizSelectedAnswer ? 'disabled' : ''}>
                  <span class="opt-letter">${letter}</span>
                  <span class="opt-text">${this.escapeHtml(opt.replace(/^[A-D]\)\s*/, ''))}</span>
                </button>
              `;
            }).join('')}
          </div>

          <!-- Rationalization Box -->
          ${this.quizSelectedAnswer ? `
            <div class="question-rationale-box">
              <div class="rationale-answer-pill">
                ${this.quizSelectedAnswer === card.correctAnswer ? '✓ Correct! Well reasoned.' : `✕ Option ${this.quizSelectedAnswer} is incorrect. Correct answer is Option ${card.correctAnswer}.`}
              </div>
              <p class="rationale-text">${this.simpleMarkdown(card.rationalization || card.back)}</p>
            </div>

            <div class="quiz-next-bar">
              <button class="btn-primary" id="btn-next-quiz-q">
                <span>${qNum < totalQ ? 'Next Question →' : 'View Final Score 🏆'}</span>
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this.bindQuizEvents();
  }

  renderQuizResults() {
    const totalQ = this.quizDeck.length;
    const pct = Math.round((this.quizScore / (totalQ || 1)) * 100);

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="section-title">Mock Board Exam Results 🏆</h2>
          <p class="section-desc">Diagnostic mastery breakdown for this session.</p>
        </div>
      </div>

      <div class="quiz-results-card">
        <div class="results-score-circle">
          <span class="results-score-pct">${pct}%</span>
          <span class="results-score-label">${this.quizScore} of ${totalQ} Correct</span>
        </div>

        <div class="results-feedback-message">
          ${pct >= 75 
            ? '🌿 <strong>Excellent Work!</strong> You are demonstrating ProfEd mastery well above the 75% LET licensure passing threshold.'
            : '🌱 <strong>Keep Nurturing Your Concepts:</strong> Review the rationalizations in Box 1 and test active recall to fortify your understanding.'}
        </div>

        <div class="results-actions">
          <button class="btn-primary" id="btn-restart-quiz">
            <span>🔄 Retake Mock Quiz</span>
          </button>
          <button class="btn-secondary" id="btn-back-to-deck">
            <span>← Back to Reviewer Deck</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-restart-quiz')?.addEventListener('click', () => {
      this.quizDeck = [];
      this.renderMockQuizArena();
    });

    document.getElementById('btn-back-to-deck')?.addEventListener('click', () => {
      this.activeMode = 'DECK';
      this.render();
    });
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
      this.quizDeck = [];
      this.activeMode = 'MOCK_QUIZ';
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
    window.addEventListener('keydown', this.boundKeyHandler, { once: true });
  }

  bindQuizEvents() {
    document.getElementById('btn-exit-quiz')?.addEventListener('click', () => {
      this.activeMode = 'DECK';
      this.render();
    });

    document.querySelectorAll('.quiz-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.quizSelectedAnswer) return;
        const letter = btn.dataset.letter;
        this.quizSelectedAnswer = letter;
        const card = this.quizDeck[this.quizCurrentIndex];
        if (letter === card.correctAnswer) {
          this.quizScore++;
          card.box = Math.min(3, (card.box || 1) + 1);
        } else {
          card.box = 1; // reset to Box 1 on error
        }
        this.saveCards();
        this.render();
      });
    });

    document.getElementById('btn-next-quiz-q')?.addEventListener('click', () => {
      this.quizCurrentIndex++;
      this.quizSelectedAnswer = null;
      this.render();
    });
  }

  openAddCardModal() {
    let modal = document.getElementById('add-card-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'add-card-modal';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <span class="modal-icon">🎯</span>
            <h3>Add Pre-Service Reviewer Card</h3>
          </div>
          <button class="modal-close" id="btn-close-card-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Card Type:</label>
            <select id="modal-card-type" class="form-input">
              <option value="FLASHCARD">🎴 Concept Flashcard</option>
              <option value="SCENARIO_MCQ">📝 Scenario Multiple Choice</option>
            </select>
          </div>

          <div class="form-group">
            <label>Domain Category:</label>
            <select id="modal-card-category" class="form-input">
              <option value="PROFED">Professional Education</option>
              <option value="GENED">General Education</option>
              <option value="MAJOR">Specialization / Major</option>
            </select>
          </div>

          <div class="form-group">
            <label>Competency / Topic Tag:</label>
            <input type="text" id="modal-card-competency" class="form-input" placeholder="e.g. Assessment of Learning, RA 7836">
          </div>

          <div class="form-group">
            <label>Front / Question Stem:</label>
            <textarea id="modal-card-front" class="form-input" rows="3" placeholder="Enter term, concept, or scenario question..."></textarea>
          </div>

          <div class="form-group">
            <label>Back / Rationalization &amp; Analogy:</label>
            <textarea id="modal-card-back" class="form-input" rows="3" placeholder="Enter definition, key insight, or classroom analogy..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-subtle" id="btn-cancel-card-modal">Cancel</button>
          <button class="btn-primary" id="btn-save-new-card">Save Card to Deck</button>
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
      showToast('New flashcard created and added to Leitner Box 1!', 'success');
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
