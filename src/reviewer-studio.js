/**
 * Pedagogo Desk: Licensure (LET) Flashcard & Mastery Studio 🎯📚
 * Phase 5 — LET Review Trainer (Spaced-Repetition Question Bank & Daily Drill)
 * Grounded in Spaced Repetition (Leitner 5-Box System), Active Retrieval Practice,
 * PPST 7 Domains Alignment, and Realistic PRC Board Licensure Examination Simulation.
 */
import { showToast } from './toast.js';
import { showCalmConfirm } from './calm-dialog.js';

export class ReviewerStudio {
  static STORAGE_KEY = 'pedagogo_let_cards';
  static FLAGS_KEY = 'pedagogo_let_flags';
  static LOGS_KEY = 'pedagogo_let_logs';

  // Leitner 5-box intervals in milliseconds
  static INTERVALS = {
    1: 1 * 24 * 60 * 60 * 1000,   // Box 1: 1 day (Emerging)
    2: 3 * 24 * 60 * 60 * 1000,   // Box 2: 3 days (Familiar)
    3: 7 * 24 * 60 * 60 * 1000,   // Box 3: 7 days (Developing)
    4: 14 * 24 * 60 * 60 * 1000,  // Box 4: 14 days (Proficient)
    5: 30 * 24 * 60 * 60 * 1000   // Box 5: 30 days (Mastered)
  };

  static BOX_METADATA = {
    1: { label: 'Emerging', interval: '1 day', icon: '🌱', color: '#D4683B', description: 'Daily active review' },
    2: { label: 'Familiar', interval: '3 days', icon: '🌿', color: '#D98326', description: 'Review every 3 days' },
    3: { label: 'Developing', interval: '7 days', icon: '🍃', color: '#B5942F', description: 'Weekly reinforcement' },
    4: { label: 'Proficient', interval: '14 days', icon: '🌳', color: '#5C8463', description: 'Bi-weekly retention' },
    5: { label: 'Mastered', interval: '30 days', icon: '🌲', color: '#3B6347', description: 'Monthly permanent recall' }
  };

  static PPST_DOMAINS = [
    'Domain 1: Content Knowledge and Pedagogy',
    'Domain 2: Learning Environment',
    'Domain 3: Diversity of Learners',
    'Domain 4: Curriculum and Planning',
    'Domain 5: Assessment and Reporting',
    'Domain 6: Community Linkages and Professional Engagement',
    'Domain 7: Personal Growth and Professional Development'
  ];

  constructor() {
    this.cards = this.loadCards();
    this.logs = this.loadLogs();
    this.flaggedQuestions = this.loadFlags(); // Set of card IDs (persisted)
    this.activeFilter = 'ALL'; // ALL, PROFED, GENED, MAJOR
    this.activeMode = 'DECK'; // DECK, DAILY_DRILL, STUDY_CARDS, EXAM_SETUP, EXAM_ARENA, EXAM_DIAGNOSTICS, PRINT_PAPER

    // Daily Drill state (Phase 5)
    this.dailyDrillDeck = [];
    this.dailyDrillCurrentIndex = 0;
    this.dailyDrillRevealed = false;
    this.dailyDrillSelectedChoice = null;
    this.dailyDrillStats = { promoted: 0, demoted: 0, totalSession: 0 };

    // Printable Paper Reviewer state
    this.paperFilter = 'ALL';
    this.paperShowAnswers = true;

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

  /* =========================================================================
   * DATA PERSISTENCE & SCHEMA NORMALIZATION (5-Box & PPST Upgrades)
   * ========================================================================= */

  loadCards() {
    const saved = localStorage.getItem(ReviewerStudio.STORAGE_KEY);
    let cards = [];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cards = parsed;
        }
      } catch (e) {
        console.warn('Failed to parse saved LET cards, using starter deck', e);
      }
    }

    if (cards.length === 0) {
      cards = this.getCuratedStarterDeck();
    }

    // Normalization: clamp box 1..5, ensure dueDate, assign ppstStrand
    const now = Date.now();
    let hasModifications = false;
    cards = cards.map(c => {
      let mod = false;
      const normalized = { ...c };

      const boxNum = parseInt(normalized.box, 10);
      if (isNaN(boxNum) || boxNum < 1 || boxNum > 5) {
        normalized.box = Math.min(5, Math.max(1, boxNum || 1));
        mod = true;
      }

      normalized.reviewCount = parseInt(normalized.reviewCount, 10) || 0;

      if (!normalized.dueDate) {
        if (normalized.lastReviewedAt) {
          const lastReviewTime = new Date(normalized.lastReviewedAt).getTime();
          const interval = ReviewerStudio.INTERVALS[normalized.box] || ReviewerStudio.INTERVALS[1];
          normalized.dueDate = new Date(lastReviewTime + interval).toISOString();
        } else {
          // Unreviewed cards are due immediately for initial practice
          normalized.dueDate = new Date(now).toISOString();
        }
        mod = true;
      }

      if (!normalized.ppstStrand) {
        normalized.ppstStrand = this.inferPpstStrand(normalized);
        mod = true;
      }

      if (mod) hasModifications = true;
      return normalized;
    });

    if (hasModifications || !saved) {
      this.saveCards(cards);
    }
    return cards;
  }

  saveCards(cardsToSave = this.cards) {
    this.cards = cardsToSave;
    localStorage.setItem(ReviewerStudio.STORAGE_KEY, JSON.stringify(cardsToSave));
  }

  loadFlags() {
    const saved = localStorage.getItem(ReviewerStudio.FLAGS_KEY);
    if (saved) {
      try {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) return new Set(arr);
      } catch (e) { /* ignore */ }
    }
    return new Set();
  }

  saveFlags() {
    localStorage.setItem(ReviewerStudio.FLAGS_KEY, JSON.stringify([...this.flaggedQuestions]));
  }

  toggleFlag(cardId) {
    if (this.flaggedQuestions.has(cardId)) {
      this.flaggedQuestions.delete(cardId);
    } else {
      this.flaggedQuestions.add(cardId);
    }
    this.saveFlags();
  }

  loadLogs() {
    const saved = localStorage.getItem(ReviewerStudio.LOGS_KEY);
    if (saved) {
      try {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) return arr;
      } catch (e) { /* ignore */ }
    }
    return [];
  }

  saveLogs(logsToSave = this.logs) {
    this.logs = logsToSave;
    localStorage.setItem(ReviewerStudio.LOGS_KEY, JSON.stringify(logsToSave));
  }

  logReview(cardId, result, fromBox, toBox) {
    const logEntry = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      cardId,
      date: new Date().toISOString(),
      result, // 'GotIt' | 'ReviewAgain'
      fromBox,
      toBox
    };
    this.logs.unshift(logEntry);
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(0, 500); // Ring buffer
    }
    this.saveLogs();
  }

  isDue(card) {
    if (!card.dueDate) return true;
    return new Date(card.dueDate).getTime() <= Date.now();
  }

  getDueCards(filterCategory = 'ALL') {
    return this.cards.filter(c => {
      if (filterCategory !== 'ALL' && c.category !== filterCategory) return false;
      return this.isDue(c);
    });
  }

  inferPpstStrand(card) {
    const text = ((card.competency || '') + ' ' + (card.front || '') + ' ' + (card.back || '')).toLowerCase();
    if (text.includes('assess') || text.includes('rubric') || text.includes('test') || text.includes('quiz') || text.includes('grade') || text.includes('bloom')) {
      return 'Domain 5: Assessment and Reporting';
    }
    if (text.includes('diversity') || text.includes('piaget') || text.includes('vygotsky') || text.includes('zpd') || text.includes('special needs') || text.includes('indigenous') || text.includes('inclusive') || text.includes('kohlberg')) {
      return 'Domain 3: Diversity of Learners';
    }
    if (text.includes('child protection') || text.includes('safe') || text.includes('positive discipline') || text.includes('management') || text.includes('routine') || text.includes('bullying')) {
      return 'Domain 2: Learning Environment';
    }
    if (text.includes('curriculum') || text.includes('melc') || text.includes('spiral') || text.includes('lesson plan') || text.includes('4as') || text.includes('7es') || text.includes('matatag')) {
      return 'Domain 4: Curriculum and Planning';
    }
    if (text.includes('ethics') || text.includes('ra 7836') || text.includes('professional') || text.includes('code of ethics') || text.includes('action research') || text.includes('republic act')) {
      return 'Domain 7: Personal Growth and Professional Development';
    }
    if (text.includes('community') || text.includes('parent') || text.includes('pta') || text.includes('stakeholder') || text.includes('brigada')) {
      return 'Domain 6: Community Linkages and Professional Engagement';
    }
    return 'Domain 1: Content Knowledge and Pedagogy';
  }

  getDomainStats() {
    const domains = ['PROFED', 'GENED', 'MAJOR'];
    const stats = {};
    domains.forEach(d => {
      const items = this.cards.filter(c => c.category === d);
      const total = items.length;
      const mastered = items.filter(c => c.box >= 4).length; // Box 4 & 5
      const due = items.filter(c => this.isDue(c)).length;
      const rate = total > 0 ? Math.round((mastered / total) * 100) : 0;
      stats[d] = { total, mastered, due, rate };
    });
    return stats;
  }

  getPpstDomainStats() {
    const stats = {};
    ReviewerStudio.PPST_DOMAINS.forEach(dom => {
      const items = this.cards.filter(c => c.ppstStrand === dom);
      const total = items.length;
      const mastered = items.filter(c => c.box >= 4).length;
      const due = items.filter(c => this.isDue(c)).length;
      const rate = total > 0 ? Math.round((mastered / total) * 100) : 0;
      stats[dom] = { total, mastered, due, rate };
    });
    return stats;
  }

  /* =========================================================================
   * STARTER DECK (20 Realistic LET Items with PPST Tags & Spaced Scheduling)
   * ========================================================================= */

  getCuratedStarterDeck() {
    const now = Date.now();
    return [
      {
        id: 'let-1',
        type: 'FLASHCARD',
        category: 'PROFED',
        competency: 'Facilitating Learner-Centered Teaching',
        ppstStrand: 'Domain 1: Content Knowledge and Pedagogy',
        front: 'Zone of Proximal Development (ZPD)',
        back: 'The cognitive distance between what a learner can achieve independently and what they can achieve with guidance from an adult or More Knowledgeable Other (MKO).\n\n💡 Classroom Analogy: Running alongside an apprentice cyclist holding the back of the saddle until their balance matures.',
        box: 1,
        reviewCount: 0,
        lastReviewedAt: null,
        dueDate: new Date(now).toISOString()
      },
      {
        id: 'let-2',
        type: 'FLASHCARD',
        category: 'PROFED',
        competency: 'Child & Adolescent Development',
        ppstStrand: 'Domain 3: Diversity of Learners',
        front: 'Piagetian Accommodation vs. Assimilation',
        back: '• Assimilation: Fitting new stimuli into an existing schema without changing the rule (e.g. seeing a golden retriever and saying "doggy").\n• Accommodation: Modifying or creating a new schema because new information contradicts the old rule (e.g. learning that a whale is a mammal, not a fish).',
        box: 2,
        reviewCount: 1,
        lastReviewedAt: new Date(now - 86400000).toISOString(),
        dueDate: new Date(now + 2 * 86400000).toISOString()
      },
      {
        id: 'let-3',
        type: 'SCENARIO_MCQ',
        category: 'PROFED',
        competency: 'Assessment of Learning',
        ppstStrand: 'Domain 5: Assessment and Reporting',
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
        box: 3,
        reviewCount: 2,
        lastReviewedAt: new Date(now - 4 * 86400000).toISOString(),
        dueDate: new Date(now + 3 * 86400000).toISOString()
      },
      {
        id: 'let-4',
        type: 'FLASHCARD',
        category: 'PROFED',
        competency: 'The Teaching Profession & Laws',
        ppstStrand: 'Domain 7: Personal Growth and Professional Development',
        front: 'Republic Act No. 7836',
        back: 'Philippine Teachers Professionalization Act of 1994. Mandates that all basic education teachers must possess a valid Professional Teacher Certificate / License issued by the Board for Professional Teachers (PRC) before engaging in teaching.',
        box: 1,
        reviewCount: 0,
        lastReviewedAt: null,
        dueDate: new Date(now).toISOString()
      },
      {
        id: 'let-5',
        type: 'SCENARIO_MCQ',
        category: 'PROFED',
        competency: 'DepEd Orders & Child Protection',
        ppstStrand: 'Domain 2: Learning Environment',
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
        box: 4,
        reviewCount: 3,
        lastReviewedAt: new Date(now - 86400000).toISOString(),
        dueDate: new Date(now + 13 * 86400000).toISOString()
      },
      {
        id: 'let-6',
        type: 'FLASHCARD',
        category: 'PROFED',
        competency: 'Curriculum Development',
        ppstStrand: 'Domain 4: Curriculum and Planning',
        front: 'Spiral Progression Curriculum (RA 10533)',
        back: 'Curriculum design where basic principles are introduced early, and subsequently revisited in succeeding grade levels with increasing depth and conceptual complexity (Jerome Bruner).',
        box: 2,
        reviewCount: 1,
        lastReviewedAt: new Date(now - 86400000).toISOString(),
        dueDate: new Date(now + 2 * 86400000).toISOString()
      },
      {
        id: 'let-7',
        type: 'FLASHCARD',
        category: 'PROFED',
        competency: 'Child & Adolescent Development',
        ppstStrand: 'Domain 3: Diversity of Learners',
        front: 'Kohlberg\'s Conventional Morality Stage',
        back: 'Stage of moral development where choices are governed by social conformity, the desire for peer approval ("Good Boy / Nice Girl"), and maintaining societal law and order.',
        box: 1,
        reviewCount: 0,
        lastReviewedAt: null,
        dueDate: new Date(now).toISOString()
      },
      {
        id: 'let-8',
        type: 'FLASHCARD',
        category: 'PROFED',
        competency: 'Assessment & Bloom\'s Taxonomy',
        ppstStrand: 'Domain 5: Assessment and Reporting',
        front: 'Bloom\'s Revised Highest Cognitive Level: "Creating"',
        back: 'In Anderson and Krathwohl\'s revised taxonomy, Creating (synthesizing diverse elements into a novel, coherent whole or original product) sits at the summit above Evaluating.',
        box: 5,
        reviewCount: 5,
        lastReviewedAt: new Date(now - 10 * 86400000).toISOString(),
        dueDate: new Date(now + 20 * 86400000).toISOString()
      },
      {
        id: 'let-9',
        type: 'SCENARIO_MCQ',
        category: 'PROFED',
        competency: 'Constructivist Pedagogical Frameworks',
        ppstStrand: 'Domain 1: Content Knowledge and Pedagogy',
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
        lastReviewedAt: null,
        dueDate: new Date(now).toISOString()
      },
      {
        id: 'let-10',
        type: 'SCENARIO_MCQ',
        category: 'PROFED',
        competency: 'Code of Ethics for Professional Teachers',
        ppstStrand: 'Domain 7: Personal Growth and Professional Development',
        front: 'Teacher Ronald operates a private tutorial center in his home city. A mother of three students enrolled in his regular Grade 9 public school class requests that Teacher Ronald tutor them for an agreed hourly fee. According to the Code of Ethics for Professional Teachers, what should Teacher Ronald do?',
        back: 'Politely decline tutoring his own enrolled students for compensation',
        options: [
          'A) Accept the arrangement as long as tutorials take place on weekends outside school hours',
          'B) Accept the arrangement provided a 20% discount is granted to underprivileged siblings',
          'C) Politely decline, as teachers are explicitly prohibited from accepting remuneration for tutorial services rendered to their own regular pupils',
          'D) Demand that the school principal approve the commercial contract before signing'
        ],
        correctAnswer: 'C',
        rationalization: 'Article VIII, Section 5 of the Code of Ethics explicitly prohibits a teacher from accepting remuneration for tutorial services rendered to their own regular students to prevent conflict of interest and grading bias.',
        box: 2,
        reviewCount: 1,
        lastReviewedAt: new Date(now - 86400000).toISOString(),
        dueDate: new Date(now + 2 * 86400000).toISOString()
      },
      {
        id: 'let-11',
        type: 'SCENARIO_MCQ',
        category: 'GENED',
        competency: 'English Language & Syntax',
        ppstStrand: 'Domain 1: Content Knowledge and Pedagogy',
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
        box: 3,
        reviewCount: 2,
        lastReviewedAt: new Date(now - 3 * 86400000).toISOString(),
        dueDate: new Date(now + 4 * 86400000).toISOString()
      },
      {
        id: 'let-12',
        type: 'SCENARIO_MCQ',
        category: 'GENED',
        competency: 'Philippine History & Social Sciences',
        ppstStrand: 'Domain 1: Content Knowledge and Pedagogy',
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
        box: 5,
        reviewCount: 4,
        lastReviewedAt: new Date(now - 5 * 86400000).toISOString(),
        dueDate: new Date(now + 25 * 86400000).toISOString()
      },
      {
        id: 'let-13',
        type: 'SCENARIO_MCQ',
        category: 'GENED',
        competency: 'Natural Sciences & Biology',
        ppstStrand: 'Domain 1: Content Knowledge and Pedagogy',
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
        lastReviewedAt: new Date(now - 86400000).toISOString(),
        dueDate: new Date(now + 2 * 86400000).toISOString()
      },
      {
        id: 'let-14',
        type: 'SCENARIO_MCQ',
        category: 'GENED',
        competency: 'Filipino (Wastong Gamit ng Salita)',
        ppstStrand: 'Domain 1: Content Knowledge and Pedagogy',
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
        box: 3,
        reviewCount: 2,
        lastReviewedAt: new Date(now - 2 * 86400000).toISOString(),
        dueDate: new Date(now + 5 * 86400000).toISOString()
      },
      {
        id: 'let-15',
        type: 'SCENARIO_MCQ',
        category: 'GENED',
        competency: 'Mathematics & Quantitative Reasoning',
        ppstStrand: 'Domain 1: Content Knowledge and Pedagogy',
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
        box: 1,
        reviewCount: 0,
        lastReviewedAt: null,
        dueDate: new Date(now).toISOString()
      },
      {
        id: 'let-16',
        type: 'SCENARIO_MCQ',
        category: 'MAJOR',
        competency: 'Pedagogical Content Knowledge (Specialization)',
        ppstStrand: 'Domain 1: Content Knowledge and Pedagogy',
        front: 'In teaching abstract concepts in secondary education (such as mathematical functions or chemical bonding), which instructional sequencing adheres best to Bruner\'s Representation Stages?',
        back: 'Enactive (concrete manipulation) → Iconic (visual models) → Symbolic (abstract formulas)',
        options: [
          'A) Symbolic formula drill first, followed by laboratory demonstration',
          'B) Enactive hands-on modeling → Iconic diagrammatic representation → Symbolic algebraic formulation',
          'C) Pure lecture exposition followed by peer debate',
          'D) Memorization of textbook definitions before observing phenomena'
        ],
        correctAnswer: 'B',
        rationalization: 'Jerome Bruner\'s developmental theory posits that conceptual abstraction succeeds best when learners progress from physical actions (Enactive), through visual images and models (Iconic), to abstract formal notations (Symbolic).',
        box: 1,
        reviewCount: 0,
        lastReviewedAt: null,
        dueDate: new Date(now).toISOString()
      },
      {
        id: 'let-17',
        type: 'FLASHCARD',
        category: 'PROFED',
        competency: 'Inclusive Education & Classroom Climate',
        ppstStrand: 'Domain 2: Learning Environment',
        front: 'Universal Design for Learning (UDL) Three Core Principles',
        back: '1. Multiple Means of Engagement (the "Why" of learning — motivation)\n2. Multiple Means of Representation (the "What" of learning — presenting info in diverse modalities)\n3. Multiple Means of Action and Expression (the "How" of learning — demonstrating mastery flexibly).',
        box: 2,
        reviewCount: 1,
        lastReviewedAt: new Date(now - 86400000).toISOString(),
        dueDate: new Date(now + 2 * 86400000).toISOString()
      },
      {
        id: 'let-18',
        type: 'SCENARIO_MCQ',
        category: 'PROFED',
        competency: 'School-Community Partnerships',
        ppstStrand: 'Domain 6: Community Linkages and Professional Engagement',
        front: 'Teacher Lea notices that several learners from an indigenous cultural community frequently miss class during traditional harvest seasons. Which step aligns with PPST Domain 6 regarding community responsiveness?',
        back: 'Collaborating with community elders to contextualize learning schedules and modules',
        options: [
          'A) Drop the learners immediately for accumulated unexcused absences',
          'B) Consult community elders and parents to design flexible contextualized learning delivery schedules',
          'C) Report the parents to the municipal social welfare desk for negligence',
          'D) Demand that learners choose between cultural practices and formal schooling'
        ],
        correctAnswer: 'B',
        rationalization: 'PPST Domain 6 and DepEd Indigenous Peoples Education (IPEd) policies mandate building constructive alliances with indigenous elders and community leaders to contextualize curricula and accommodate cultural rhythms.',
        box: 1,
        reviewCount: 0,
        lastReviewedAt: null,
        dueDate: new Date(now).toISOString()
      },
      {
        id: 'let-19',
        type: 'FLASHCARD',
        category: 'PROFED',
        competency: 'Reflective Teaching & Action Research',
        ppstStrand: 'Domain 7: Personal Growth and Professional Development',
        front: 'Action Research Cycle in Philippine Basic Education (DepEd Order 16, s. 2017)',
        back: 'Context and Rationale → Action Research Questions → Proposed Innovation / Intervention / Strategy → Action Research Methods (Participants, Data Gathering, Analysis) → Work Plan and Timelines → Cost Estimates → Action Plan for Dissemination and Utilization.',
        box: 4,
        reviewCount: 3,
        lastReviewedAt: new Date(now - 2 * 86400000).toISOString(),
        dueDate: new Date(now + 12 * 86400000).toISOString()
      },
      {
        id: 'let-20',
        type: 'SCENARIO_MCQ',
        category: 'GENED',
        competency: 'Information & Communications Technology (ICT)',
        ppstStrand: 'Domain 1: Content Knowledge and Pedagogy',
        front: 'Under the SAMR model for educational technology integration, when a teacher uses an interactive online collaborative whiteboard where learners co-design dynamic concept maps simultaneously with peers across branches, at which level is technology operating?',
        back: 'Modification or Redefinition (Transformation Level)',
        options: [
          'A) Substitution',
          'B) Augmentation',
          'C) Modification',
          'D) Elimination'
        ],
        correctAnswer: 'C',
        rationalization: 'The SAMR model progresses from Enhancement (Substitution, Augmentation) to Transformation (Modification, Redefinition). Significant task redesign enabling real-time multi-peer co-construction represents Modification.',
        box: 2,
        reviewCount: 1,
        lastReviewedAt: new Date(now - 86400000).toISOString(),
        dueDate: new Date(now + 2 * 86400000).toISOString()
      }
    ];
  }

  /* =========================================================================
   * VIEW ROUTING
   * ========================================================================= */

  render() {
    if (!this.container) return;

    if (this.activeMode === 'DAILY_DRILL') {
      this.renderDailyDrillArena();
    } else if (this.activeMode === 'STUDY_CARDS') {
      this.renderStudyArena();
    } else if (this.activeMode === 'EXAM_SETUP') {
      this.renderExamSetup();
    } else if (this.activeMode === 'EXAM_ARENA') {
      this.renderExamArena();
    } else if (this.activeMode === 'EXAM_DIAGNOSTICS') {
      this.renderExamDiagnosticReport();
    } else if (this.activeMode === 'PRINT_PAPER') {
      this.renderPrintablePaperReviewer();
    } else {
      this.renderDeckOverview();
    }
  }

  /* =========================================================================
   * SCREEN 1: DECK OVERVIEW & READINESS ANALYTICS (Leitner 5-Box Distribution)
   * ========================================================================= */

  renderDeckOverview() {
    const total = this.cards.length;
    const boxCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    this.cards.forEach(c => {
      const b = c.box || 1;
      if (boxCounts[b] !== undefined) boxCounts[b]++;
    });

    const masteredCount = boxCounts[4] + boxCounts[5];
    const masteryPct = total > 0 ? Math.round((masteredCount / total) * 100) : 0;
    const dueCards = this.getDueCards(this.activeFilter);
    const dueCount = dueCards.length;

    const domainStats = this.getDomainStats();
    const ppstStats = this.getPpstDomainStats();

    const filtered = this.cards.filter(c => {
      if (this.activeFilter === 'ALL') return true;
      return c.category === this.activeFilter;
    });

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="section-title">Licensure (LET) Flashcard &amp; Mastery Studio 🎯📚</h2>
          <p class="section-desc">Active retrieval practice, Leitner 5-box spaced repetition, and PRC board exam simulations for future educators.</p>
        </div>
        <div class="header-actions">
          <button class="btn-primary btn-pulse-subtle" id="btn-start-daily-drill">
            <span>🌿 Daily Drill (${dueCount} due)</span>
          </button>
          <button class="btn-secondary" id="btn-start-flashcard-session">
            <span>🎴 Flashcards</span>
          </button>
          <button class="btn-secondary" id="btn-start-mock-quiz">
            <span>⏱️ Board Exam</span>
          </button>
          <button class="btn-subtle" id="btn-open-paper-reviewer">
            <span>🖨️ Paper Reviewer</span>
          </button>
          <button class="btn-subtle" id="btn-open-add-card-modal">
            <span>➕ Add Card</span>
          </button>
        </div>
      </div>

      <!-- Daily Drill Invite Nudge (Phase 5) -->
      ${dueCount > 0 ? `
        <div class="daily-drill-invite-banner">
          <div class="drill-invite-content">
            <div class="drill-invite-icon">🌿</div>
            <div>
              <h4 class="drill-invite-title">${dueCount} Cards Ready for Daily Retrieval Practice</h4>
              <p class="drill-invite-desc">Dunlosky et al. (2013) confirmed distributed retrieval practice is the #1 highest-utility learning technique. Spend 5 tranquil minutes strengthening your recall pathways today.</p>
            </div>
          </div>
          <button class="btn-primary btn-start-drill-pill" id="btn-banner-start-drill">
            Start Daily Drill (${Math.min(15, dueCount)} Cards)
          </button>
        </div>
      ` : `
        <div class="daily-drill-invite-banner serene">
          <div class="drill-invite-content">
            <div class="drill-invite-icon">✨</div>
            <div>
              <h4 class="drill-invite-title">All Spaced Review Quotas Nurtured Today!</h4>
              <p class="drill-invite-desc">Your Leitner retention boxes are in harmony. Cards have been scheduled for their next distributed intervals. You may review ahead or explore full decks anytime.</p>
            </div>
          </div>
          <button class="btn-subtle btn-start-drill-pill" id="btn-banner-review-ahead">
            Review Ahead (10 Cards)
          </button>
        </div>
      `}

      <!-- Leitner 5-Box Mastery Banner -->
      <div class="leitner-mastery-banner">
        <div class="mastery-stat-card">
          <div class="stat-ring-box">
            <span class="mastery-number">${masteryPct}%</span>
            <span class="mastery-label">Long-Term Mastery</span>
            <span class="mastery-subtext">Box 4 &amp; 5 Proficient</span>
          </div>
          <div class="mastery-progress-track">
            <div class="progress-fill-box5" style="width: ${(boxCounts[5] / (total || 1)) * 100}%;" title="Box 5 Mastered: ${boxCounts[5]}"></div>
            <div class="progress-fill-box4" style="width: ${(boxCounts[4] / (total || 1)) * 100}%;" title="Box 4 Proficient: ${boxCounts[4]}"></div>
            <div class="progress-fill-box3" style="width: ${(boxCounts[3] / (total || 1)) * 100}%;" title="Box 3 Developing: ${boxCounts[3]}"></div>
            <div class="progress-fill-box2" style="width: ${(boxCounts[2] / (total || 1)) * 100}%;" title="Box 2 Familiar: ${boxCounts[2]}"></div>
            <div class="progress-fill-box1" style="width: ${(boxCounts[1] / (total || 1)) * 100}%;" title="Box 1 Emerging: ${boxCounts[1]}"></div>
          </div>
        </div>

        <div class="leitner-boxes-row five-boxes">
          ${Object.entries(ReviewerStudio.BOX_METADATA).map(([boxNum, meta]) => {
            const count = boxCounts[boxNum] || 0;
            return `
              <div class="leitner-box-pill box-${boxNum}">
                <span class="box-icon">${meta.icon}</span>
                <div class="box-text">
                  <strong>Box ${boxNum}: ${meta.label}</strong>
                  <span>${count} cards • Every ${meta.interval}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Readiness Analytics & PPST Coverage Map Section -->
      <div class="readiness-analytics-section">
        <div class="analytics-header">
          <h3 class="analytics-title">📊 LET Domain Readiness &amp; PPST Alignment Map</h3>
          <span class="analytics-sub">Grounded in CHED CMO 74/75 &amp; DepEd PPST 7 Domains</span>
        </div>

        <div class="domain-readiness-grid">
          <div class="domain-card profed-card">
            <div class="domain-card-head">
              <span class="badge-category badge-PROFED">PROFED</span>
              <span class="domain-rate">${domainStats.PROFED.rate}% Mastered</span>
            </div>
            <div class="domain-name">Professional Education</div>
            <div class="domain-bar">
              <div class="domain-fill" style="width: ${domainStats.PROFED.rate}%;"></div>
            </div>
            <div class="domain-footer">
              <span>${domainStats.PROFED.total} Items Total</span>
              <span class="${domainStats.PROFED.due > 0 ? 'due-nudge' : 'calm-nudge'}">● ${domainStats.PROFED.due} Due Today</span>
            </div>
          </div>

          <div class="domain-card gened-card">
            <div class="domain-card-head">
              <span class="badge-category badge-GENED">GENED</span>
              <span class="domain-rate">${domainStats.GENED.rate}% Mastered</span>
            </div>
            <div class="domain-name">General Education</div>
            <div class="domain-bar">
              <div class="domain-fill" style="width: ${domainStats.GENED.rate}%;"></div>
            </div>
            <div class="domain-footer">
              <span>${domainStats.GENED.total} Items Total</span>
              <span class="${domainStats.GENED.due > 0 ? 'due-nudge' : 'calm-nudge'}">● ${domainStats.GENED.due} Due Today</span>
            </div>
          </div>

          <div class="domain-card major-card">
            <div class="domain-card-head">
              <span class="badge-category badge-MAJOR">MAJOR</span>
              <span class="domain-rate">${domainStats.MAJOR.rate}% Mastered</span>
            </div>
            <div class="domain-name">Specialization / Major</div>
            <div class="domain-bar">
              <div class="domain-fill" style="width: ${domainStats.MAJOR.rate}%;"></div>
            </div>
            <div class="domain-footer">
              <span>${domainStats.MAJOR.total} Items Total</span>
              <span class="${domainStats.MAJOR.due > 0 ? 'due-nudge' : 'calm-nudge'}">● ${domainStats.MAJOR.due} Due Today</span>
            </div>
          </div>
        </div>

        <!-- PPST 7 Domains Matrix -->
        <div class="ppst-matrix-card">
          <div class="ppst-matrix-title">PPST 7 Domains Retrieval Coverage</div>
          <div class="ppst-domains-list">
            ${ReviewerStudio.PPST_DOMAINS.map((dom, i) => {
              const st = ppstStats[dom] || { total: 0, mastered: 0, due: 0, rate: 0 };
              const isThin = st.total < 2;
              return `
                <div class="ppst-domain-row ${isThin ? 'ppst-thin' : ''}">
                  <span class="ppst-name" title="${dom}">D${i+1}: ${dom.replace(/^Domain \d+:\s*/, '')}</span>
                  <div class="ppst-bar-wrap">
                    <div class="ppst-bar-fill" style="width: ${st.rate}%;"></div>
                  </div>
                  <span class="ppst-counts">${st.total} items (${st.rate}%)${isThin ? ' <em class="thin-chip">Light</em>' : ''}</span>
                </div>
              `;
            }).join('')}
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
        <span class="field-hint">Leitner intervals: 1d → 3d → 7d → 14d → 30d. Answer correctly to promote; review again resets to Box 1.</span>
      </div>

      <!-- Cards Grid -->
      <div class="reviewer-cards-grid">
        ${filtered.map(card => {
          const isCardDue = this.isDue(card);
          const meta = ReviewerStudio.BOX_METADATA[card.box] || ReviewerStudio.BOX_METADATA[1];
          return `
            <div class="reviewer-mini-card box-${card.box}" id="card-row-${card.id}">
              <div class="card-meta-line">
                <span class="badge-category badge-${card.category}">${card.category}</span>
                <span class="competency-tag" title="${this.escapeHtml(card.competency)}">${this.escapeHtml(card.competency)}</span>
                <span class="box-indicator box-${card.box}">Box ${card.box} ${meta.icon}</span>
              </div>
              <div class="ppst-subtag">${this.escapeHtml(card.ppstStrand || 'Pedagogical Knowledge')}</div>
              <h4 class="card-front-preview">${this.escapeHtml(card.front)}</h4>
              <p class="card-back-preview">${this.escapeHtml(card.back)}</p>
              <div class="card-footer-line">
                <span class="card-type-chip">${card.type === 'SCENARIO_MCQ' ? '📝 Board MCQ' : card.type === 'TERM_FILL_IN' ? '🔤 Term Drill' : '🎴 Flashcard'}</span>
                <span class="due-status-chip ${isCardDue ? 'is-due' : 'is-scheduled'}">
                  ${isCardDue ? '🌿 Due today' : 'Scheduled in Box ' + card.box}
                </span>
                <button class="btn-subtle-danger btn-delete-card" data-card-id="${card.id}" title="Remove card">✕</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    this.bindOverviewEvents();
  }

  /* =========================================================================
   * SCREEN 2: DAILY DRILL ARENA (Low-Stakes Retrieval Practice, Phase 5)
   * ========================================================================= */

  startDailyDrill(count = 15, forceAll = false) {
    let candidateCards = this.cards.filter(c => this.isDue(c));
    if (candidateCards.length === 0 || forceAll) {
      // If no due cards or forced, sort by lowest box and earliest due date
      candidateCards = [...this.cards].sort((a, b) => {
        const boxDiff = (a.box || 1) - (b.box || 1);
        if (boxDiff !== 0) return boxDiff;
        const timeA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const timeB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return timeA - timeB;
      });
    } else {
      // Shuffle due cards to avoid order bias
      candidateCards = candidateCards.sort(() => Math.random() - 0.5);
    }

    this.dailyDrillDeck = candidateCards.slice(0, count);
    this.dailyDrillCurrentIndex = 0;
    this.dailyDrillRevealed = false;
    this.dailyDrillSelectedChoice = null;
    this.dailyDrillStats = { promoted: 0, demoted: 0, totalSession: this.dailyDrillDeck.length };
    this.activeMode = 'DAILY_DRILL';
    this.render();
  }

  renderDailyDrillArena() {
    if (this.dailyDrillDeck.length === 0 || this.dailyDrillCurrentIndex >= this.dailyDrillDeck.length) {
      this.renderDailyDrillComplete();
      return;
    }

    const card = this.dailyDrillDeck[this.dailyDrillCurrentIndex];
    const currentNum = this.dailyDrillCurrentIndex + 1;
    const totalNum = this.dailyDrillDeck.length;
    const meta = ReviewerStudio.BOX_METADATA[card.box] || ReviewerStudio.BOX_METADATA[1];

    this.container.innerHTML = `
      <div class="drill-arena-header">
        <button class="btn-subtle" id="btn-exit-drill">
          ← <span>Exit to Decks</span>
        </button>
        <div class="drill-progress-info">
          <span>🌿 Retrieval Session: <strong>${currentNum}</strong> of <strong>${totalNum}</strong></span>
          <span class="box-indicator box-${card.box}">Box ${card.box} (${meta.label}) ${meta.icon}</span>
        </div>
        <div class="drill-header-meta">
          <span class="badge-category badge-${card.category}">${card.category}</span>
          <span class="competency-tag">${this.escapeHtml(card.competency)}</span>
        </div>
      </div>

      <div class="drill-card-container">
        <div class="drill-main-card ${this.dailyDrillRevealed ? 'revealed' : ''}">
          <div class="drill-card-top">
            <span class="drill-ppst-tag">${this.escapeHtml(card.ppstStrand || 'Pedagogical Knowledge')}</span>
            <span class="card-type-pill">${card.type === 'SCENARIO_MCQ' ? '📝 PRC Scenario MCQ' : card.type === 'TERM_FILL_IN' ? '🔤 Term Fill-in Drill' : '🎴 Key Concept Flashcard'}</span>
          </div>

          <!-- Question Prompt -->
          <div class="drill-prompt-box">
            <h3 class="drill-question-text">${this.escapeHtml(card.front)}</h3>
          </div>

          <!-- Multiple Choice Options or Flashcard Area -->
          ${card.type === 'SCENARIO_MCQ' && card.options && card.options.length > 0 ? `
            <div class="drill-mcq-options">
              ${card.options.map(opt => {
                const optLetter = opt.trim().charAt(0).toUpperCase();
                const isSelected = this.dailyDrillSelectedChoice === optLetter;
                const isCorrect = optLetter === (card.correctAnswer || '').trim().toUpperCase();

                let optClass = 'drill-choice-btn';
                if (this.dailyDrillRevealed) {
                  if (isCorrect) optClass += ' correct-highlight';
                  else if (isSelected) optClass += ' selected-contrast';
                }

                return `
                  <button class="${optClass}" data-letter="${optLetter}" ${this.dailyDrillRevealed ? 'disabled' : ''}>
                    <span class="choice-letter">${optLetter}</span>
                    <span class="choice-text">${this.escapeHtml(opt.replace(/^[A-D]\)\s*/, ''))}</span>
                  </button>
                `;
              }).join('')}
            </div>
          ` : `
            ${!this.dailyDrillRevealed ? `
              <div class="drill-reveal-prompt">
                <p>Recall the pedagogical explanation, legal basis, or analogy mentally before revealing.</p>
                <button class="btn-primary" id="btn-drill-reveal-flashcard">
                  <span>🔄 Reveal Pedagogical Answer (Space)</span>
                </button>
              </div>
            ` : ''}
          `}

          <!-- Pedagogical Rationalization Feedback (Revealed) -->
          ${this.dailyDrillRevealed ? `
            <div class="drill-feedback-container">
              <div class="feedback-banner">
                <span class="feedback-icon">💡</span>
                <strong>Pedagogical Core &amp; Rationalization:</strong>
              </div>
              <div class="feedback-body">
                ${card.rationalization ? `
                  <p class="feedback-rationalization">${this.escapeHtml(card.rationalization)}</p>
                ` : ''}
                <div class="feedback-answer-markdown">
                  ${this.simpleMarkdown(card.back)}
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Spaced Repetition Action Bar (Revealed) -->
          ${this.dailyDrillRevealed ? `
            <div class="drill-action-footer">
              <p class="calm-instruction">How did your retrieval feel? Mistakes are simply signals for tomorrow\'s review.</p>
              <div class="drill-action-buttons">
                <button class="btn-drill-demote" id="btn-drill-review-again" title="Demote to Box 1 for tomorrow\'s review">
                  <span class="btn-icon">🔄</span>
                  <div class="btn-label-group">
                    <strong>Review Again</strong>
                    <small>Reset to Box 1 (1 day)</small>
                  </div>
                  <kbd>1</kbd>
                </button>

                <button class="btn-drill-promote" id="btn-drill-got-it" title="Advance card to the next spaced box">
                  <span class="btn-icon">🌿</span>
                  <div class="btn-label-group">
                    <strong>Got It!</strong>
                    <small>Promote to Box ${Math.min(5, (card.box || 1) + 1)} (${ReviewerStudio.BOX_METADATA[Math.min(5, (card.box || 1) + 1)].interval})</small>
                  </div>
                  <kbd>2</kbd>
                </button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this.bindDailyDrillEvents();
  }

  bindDailyDrillEvents() {
    const card = this.dailyDrillDeck[this.dailyDrillCurrentIndex];
    if (!card) return;

    // Exit drill
    document.getElementById('btn-exit-drill')?.addEventListener('click', () => {
      this.activeMode = 'DECK';
      this.render();
    });

    // MCQ choices
    document.querySelectorAll('.drill-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.dailyDrillRevealed) return;
        const letter = btn.dataset.letter;
        this.dailyDrillSelectedChoice = letter;
        this.dailyDrillRevealed = true;
        this.renderDailyDrillArena();
      });
    });

    // Flashcard reveal button
    document.getElementById('btn-drill-reveal-flashcard')?.addEventListener('click', () => {
      this.dailyDrillRevealed = true;
      this.renderDailyDrillArena();
    });

    // "Got It!" Promotion Handler
    const handlePromote = () => {
      if (!this.dailyDrillRevealed) return;
      const oldBox = card.box || 1;
      const nextBox = Math.min(5, oldBox + 1);
      const nextInterval = ReviewerStudio.INTERVALS[nextBox] || ReviewerStudio.INTERVALS[5];
      const nextDueDate = new Date(Date.now() + nextInterval).toISOString();

      card.box = nextBox;
      card.dueDate = nextDueDate;
      card.reviewCount = (card.reviewCount || 0) + 1;
      card.lastReviewedAt = new Date().toISOString();

      // Update in main deck
      const match = this.cards.find(c => c.id === card.id);
      if (match) {
        match.box = nextBox;
        match.dueDate = nextDueDate;
        match.reviewCount = card.reviewCount;
        match.lastReviewedAt = card.lastReviewedAt;
      }

      this.logReview(card.id, 'GotIt', oldBox, nextBox);
      this.dailyDrillStats.promoted++;
      this.saveCards();

      this.dailyDrillCurrentIndex++;
      this.dailyDrillRevealed = false;
      this.dailyDrillSelectedChoice = null;
      this.render();
    };

    // "Review Again" Demotion Handler
    const handleDemote = () => {
      if (!this.dailyDrillRevealed) return;
      const oldBox = card.box || 1;
      const nextBox = 1;
      const nextInterval = ReviewerStudio.INTERVALS[1];
      const nextDueDate = new Date(Date.now() + nextInterval).toISOString();

      card.box = nextBox;
      card.dueDate = nextDueDate;
      card.reviewCount = (card.reviewCount || 0) + 1;
      card.lastReviewedAt = new Date().toISOString();

      // Update in main deck
      const match = this.cards.find(c => c.id === card.id);
      if (match) {
        match.box = nextBox;
        match.dueDate = nextDueDate;
        match.reviewCount = card.reviewCount;
        match.lastReviewedAt = card.lastReviewedAt;
      }

      this.logReview(card.id, 'ReviewAgain', oldBox, nextBox);
      this.dailyDrillStats.demoted++;
      this.saveCards();

      this.dailyDrillCurrentIndex++;
      this.dailyDrillRevealed = false;
      this.dailyDrillSelectedChoice = null;
      this.render();
    };

    document.getElementById('btn-drill-got-it')?.addEventListener('click', handlePromote);
    document.getElementById('btn-drill-review-again')?.addEventListener('click', handleDemote);

    // Keyboard shortcuts: Space to reveal; 1 Demote, 2 Promote
    this.boundDrillKeyHandler = (e) => {
      if (this.activeMode !== 'DAILY_DRILL') return;
      if (e.code === 'Space' && !this.dailyDrillRevealed) {
        e.preventDefault();
        this.dailyDrillRevealed = true;
        this.renderDailyDrillArena();
      } else if (this.dailyDrillRevealed) {
        if (e.key === '1') {
          handleDemote();
        } else if (e.key === '2') {
          handlePromote();
        }
      }
    };

    window.removeEventListener('keydown', this.boundDrillKeyHandler);
    window.addEventListener('keydown', this.boundDrillKeyHandler, { once: true });
  }

  renderDailyDrillComplete() {
    this.container.innerHTML = `
      <div class="drill-complete-container">
        <div class="complete-card">
          <div class="complete-badge-ring">🌿</div>
          <h2 class="complete-title">Daily Retrieval Drill Complete!</h2>
          <p class="complete-subtitle">You\'ve exercised active recall on ${this.dailyDrillStats.totalSession} key competencies without punitive stress.</p>

          <div class="complete-stats-row">
            <div class="stat-pill promoted">
              <span class="pill-number">+${this.dailyDrillStats.promoted}</span>
              <span class="pill-label">Advanced to Higher Retention Boxes</span>
            </div>
            <div class="stat-pill demoted">
              <span class="pill-number">${this.dailyDrillStats.demoted}</span>
              <span class="pill-label">Scheduled for Tomorrow\'s Review</span>
            </div>
          </div>

          <div class="science-quote-card">
            <span class="quote-icon">🔬</span>
            <p>"Retrieval practice is not a tool to measure what you know; it is the primary engine of long-term memory formation. Every time you pull an answer from memory, the neural pathway is consolidated against forgetting." — <em>Dunlosky et al., 2013</em></p>
          </div>

          <div class="complete-actions">
            <button class="btn-primary" id="btn-complete-back-deck">Return to Deck Overview</button>
            <button class="btn-secondary" id="btn-complete-drill-again">Review Another 10 Items</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-complete-back-deck')?.addEventListener('click', () => {
      this.activeMode = 'DECK';
      this.render();
    });

    document.getElementById('btn-complete-drill-again')?.addEventListener('click', () => {
      this.startDailyDrill(10, true);
    });
  }

  /* =========================================================================
   * SCREEN 3: PRINTABLE PAPER REVIEWER SET (Offline Self-Drill)
   * ========================================================================= */

  renderPrintablePaperReviewer() {
    const items = this.cards.filter(c => {
      if (this.paperFilter === 'ALL') return true;
      return c.category === this.paperFilter;
    });

    this.container.innerHTML = `
      <div class="paper-reviewer-toolbar no-print">
        <button class="btn-subtle" id="btn-exit-paper-reviewer">
          ← <span>Exit to Studio</span>
        </button>
        <div class="toolbar-middle">
          <label>Category Filter:</label>
          <select id="paper-category-select" class="paper-select">
            <option value="ALL" ${this.paperFilter === 'ALL' ? 'selected' : ''}>All Categories (${this.cards.length})</option>
            <option value="PROFED" ${this.paperFilter === 'PROFED' ? 'selected' : ''}>Professional Education</option>
            <option value="GENED" ${this.paperFilter === 'GENED' ? 'selected' : ''}>General Education</option>
            <option value="MAJOR" ${this.paperFilter === 'MAJOR' ? 'selected' : ''}>Specialization / Major</option>
          </select>
          <label class="checkbox-toggle">
            <input type="checkbox" id="check-toggle-answers" ${this.paperShowAnswers ? 'checked' : ''} />
            <span>Include Answer Key &amp; Rationalizations</span>
          </label>
        </div>
        <div class="toolbar-actions">
          <button class="btn-secondary" id="btn-export-paper-doc">
            📄 <span>Export Word (.doc)</span>
          </button>
          <button class="btn-primary" id="btn-print-paper-sheet">
            🖨️ <span>Print Paper Sheet</span>
          </button>
        </div>
      </div>

      <!-- Printable Exam Document Layout -->
      <div class="printable-paper-sheet" id="printable-exam-sheet">
        <div class="prc-exam-header">
          <div class="prc-republic">Republic of the Philippines</div>
          <div class="prc-agency">PROFESSIONAL REGULATION COMMISSION (PRC)</div>
          <div class="prc-board">BOARD FOR PROFESSIONAL TEACHERS</div>
          <div class="prc-doc-title">LICENSURE EXAMINATION FOR TEACHERS (LET) — COMPREHENSIVE PAPER REVIEWER</div>
          <div class="prc-meta-line">
            <span>Subject: ${this.paperFilter === 'ALL' ? 'Comprehensive (ProfEd & GenEd)' : this.paperFilter}</span>
            <span>Total Items: ${items.length}</span>
            <span>Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>

        <div class="paper-general-instructions">
          <strong>GENERAL INSTRUCTIONS:</strong> Read each scenario or question carefully. Choose the letter of the correct answer from the four options given. Avoid erasure on your clipboard sheet. Review the detailed pedagogical rationalizations provided at the end of this examination set.
        </div>

        <div class="paper-items-list">
          ${items.map((item, idx) => `
            <div class="paper-exam-item">
              <div class="item-stem">
                <strong>${idx + 1}.</strong> [${item.category} • ${this.escapeHtml(item.ppstStrand || item.competency)}] ${this.escapeHtml(item.front)}
              </div>
              ${item.options && item.options.length > 0 ? `
                <div class="item-choices-grid">
                  ${item.options.map(opt => `
                    <div class="choice-line">${this.escapeHtml(opt)}</div>
                  `).join('')}
                </div>
              ` : `
                <div class="item-flashcard-space">
                  <em>[Concept Recall: Write your definitions and classroom analogies on your answer sheet]</em>
                </div>
              `}
            </div>
          `).join('')}
        </div>

        ${this.paperShowAnswers ? `
          <div class="paper-page-break"></div>
          <div class="paper-answer-key-section">
            <div class="answer-key-header">
              <h3>ANSWER KEY &amp; PEDAGOGICAL RATIONALIZATION SHEET</h3>
              <p>For independent self-checking and formative reflection.</p>
            </div>
            <div class="answer-key-items">
              ${items.map((item, idx) => `
                <div class="key-item-row">
                  <div class="key-item-number">Item ${idx + 1}:</div>
                  <div class="key-item-details">
                    <strong>Correct Answer: ${item.correctAnswer ? '(' + item.correctAnswer + ')' : 'Recall Standard'}</strong>
                    <p class="key-rationalization">${this.escapeHtml(item.rationalization || item.back)}</p>
                    <span class="key-strand-tag">PPST Alignment: ${this.escapeHtml(item.ppstStrand || item.competency)}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    this.bindPaperReviewerEvents(items);
  }

  bindPaperReviewerEvents(items) {
    document.getElementById('btn-exit-paper-reviewer')?.addEventListener('click', () => {
      this.activeMode = 'DECK';
      this.render();
    });

    document.getElementById('paper-category-select')?.addEventListener('change', (e) => {
      this.paperFilter = e.target.value;
      this.renderPrintablePaperReviewer();
    });

    document.getElementById('check-toggle-answers')?.addEventListener('change', (e) => {
      this.paperShowAnswers = e.target.checked;
      this.renderPrintablePaperReviewer();
    });

    document.getElementById('btn-print-paper-sheet')?.addEventListener('click', () => {
      window.print();
    });

    document.getElementById('btn-export-paper-doc')?.addEventListener('click', () => {
      this.exportPaperReviewerToWord(items);
    });
  }

  exportPaperReviewerToWord(items) {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const docContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>LET Paper Reviewer - ${this.paperFilter}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.35; margin: 1in; }
          .header { text-align: center; margin-bottom: 20pt; }
          .title { font-size: 13pt; font-weight: bold; }
          .item { margin-bottom: 14pt; }
          .stem { font-weight: bold; margin-bottom: 4pt; }
          .choice { margin-left: 20pt; margin-bottom: 2pt; }
          .page-break { page-break-before: always; }
          .answer-header { text-align: center; font-weight: bold; margin-top: 20pt; margin-bottom: 12pt; border-bottom: 1pt solid #333; }
          .key-row { margin-bottom: 10pt; font-size: 10.5pt; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>Republic of the Philippines</div>
          <div><strong>PROFESSIONAL REGULATION COMMISSION (PRC)</strong></div>
          <div>BOARD FOR PROFESSIONAL TEACHERS</div>
          <div class="title">LICENSURE EXAMINATION FOR TEACHERS (LET) REVIEWER</div>
          <div>Category: ${this.paperFilter} • Items: ${items.length} • ${dateStamp}</div>
        </div>

        <div style="margin-bottom: 16pt; font-style: italic;">
          INSTRUCTIONS: Select the best answer for each question. Mark your choice before checking the rationalizations at the end.
        </div>

        ${items.map((item, idx) => `
          <div class="item">
            <div class="stem">${idx + 1}. [${item.category} • ${this.escapeHtml(item.ppstStrand || item.competency)}] ${this.escapeHtml(item.front)}</div>
            ${item.options && item.options.length > 0 ? item.options.map(opt => `
              <div class="choice">${this.escapeHtml(opt)}</div>
            `).join('') : '<div class="choice"><em>[Concept recall item]</em></div>'}
          </div>
        `).join('')}

        <div class="page-break"></div>
        <div class="answer-header">
          ANSWER KEY &amp; PEDAGOGICAL RATIONALIZATIONS
        </div>
        ${items.map((item, idx) => `
          <div class="key-row">
            <strong>${idx + 1}. Correct Answer: ${item.correctAnswer ? '(' + item.correctAnswer + ')' : 'Standard'}</strong><br/>
            <span>${this.escapeHtml(item.rationalization || item.back)}</span><br/>
            <small style="color: #555;">PPST Alignment: ${this.escapeHtml(item.ppstStrand || item.competency)}</small>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    const blob = new Blob([docContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LET_Reviewer_${this.paperFilter}_${dateStamp}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('📄 Printable Paper Reviewer exported as Word (.doc)!', 'success');
  }

  /* =========================================================================
   * SCREEN 4: FLASHCARD STUDY ARENA (5-Box Spaced Repetition Upgraded)
   * ========================================================================= */

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
    const meta = ReviewerStudio.BOX_METADATA[card.box] || ReviewerStudio.BOX_METADATA[1];

    this.container.innerHTML = `
      <div class="study-arena-header">
        <button class="btn-subtle" id="btn-exit-study">
          ← <span>Exit to Deck</span>
        </button>
        <div class="study-progress-counter">
          <span>Card <strong>${currentNum}</strong> of <strong>${totalNum}</strong></span>
          <span class="box-indicator box-${card.box}">Current: Box ${card.box} (${meta.label})</span>
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
              <span class="hint-text">${this.escapeHtml(card.ppstStrand || 'Test active recall')}</span>
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
              <span class="hint-text">Select your retention interval below:</span>
            </div>
          </div>
        </div>

        <!-- Leitner 5-Box Progression Buttons -->
        <div class="leitner-action-bar five-box-actions">
          <button class="btn-leitner btn-leitner-box1" id="btn-rate-box1" title="Still learning; review tomorrow">
            🌱 <span>Box 1</span>
            <small>1 day</small>
          </button>
          <button class="btn-leitner btn-leitner-box2" id="btn-rate-box2" title="Familiar; review in 3 days">
            🌿 <span>Box 2</span>
            <small>3 days</small>
          </button>
          <button class="btn-leitner btn-leitner-box3" id="btn-rate-box3" title="Developing; review in 7 days">
            🍃 <span>Box 3</span>
            <small>7 days</small>
          </button>
          <button class="btn-leitner btn-leitner-box4" id="btn-rate-box4" title="Proficient; review in 14 days">
            🌳 <span>Box 4</span>
            <small>14 days</small>
          </button>
          <button class="btn-leitner btn-leitner-box5" id="btn-rate-box5" title="Mastered; permanent retention">
            🌲 <span>Box 5</span>
            <small>30 days</small>
          </button>
        </div>

        <div class="keyboard-shortcuts-strip">
          <span>Keyboard shortcuts:</span>
          <kbd>Space</kbd> Flip card • <kbd>1</kbd>–<kbd>5</kbd> Rate Box 1 to 5
        </div>
      </div>
    `;

    this.bindStudyEvents();
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

    // Rating buttons (1..5)
    const handleRating = (targetBox) => {
      const card = this.studyDeck[this.currentCardIndex];
      if (card) {
        const oldBox = card.box || 1;
        const interval = ReviewerStudio.INTERVALS[targetBox] || ReviewerStudio.INTERVALS[1];
        const nextDueDate = new Date(Date.now() + interval).toISOString();

        card.box = targetBox;
        card.dueDate = nextDueDate;
        card.reviewCount = (card.reviewCount || 0) + 1;
        card.lastReviewedAt = new Date().toISOString();

        // Update in main cards list
        const match = this.cards.find(c => c.id === card.id);
        if (match) {
          match.box = targetBox;
          match.dueDate = nextDueDate;
          match.reviewCount = card.reviewCount;
          match.lastReviewedAt = card.lastReviewedAt;
        }

        this.logReview(card.id, targetBox >= oldBox ? 'GotIt' : 'ReviewAgain', oldBox, targetBox);
        this.saveCards();
      }

      this.currentCardIndex++;
      this.isCardFlipped = false;
      this.render();
    };

    document.getElementById('btn-rate-box1')?.addEventListener('click', () => handleRating(1));
    document.getElementById('btn-rate-box2')?.addEventListener('click', () => handleRating(2));
    document.getElementById('btn-rate-box3')?.addEventListener('click', () => handleRating(3));
    document.getElementById('btn-rate-box4')?.addEventListener('click', () => handleRating(4));
    document.getElementById('btn-rate-box5')?.addEventListener('click', () => handleRating(5));

    // Keyboard navigation
    this.boundKeyHandler = (e) => {
      if (this.activeMode !== 'STUDY_CARDS') return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggleFlip();
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        handleRating(parseInt(e.key, 10));
      }
    };

    window.removeEventListener('keydown', this.boundKeyHandler);
    window.addEventListener('keydown', this.boundKeyHandler, { once: true });
  }

  /* =========================================================================
   * SCREEN 5, 6, 7: BOARD EXAM SIMULATOR, ARENA & DIAGNOSTICS
   * ========================================================================= */

  renderExamSetup() {
    const mcqs = this.cards.filter(c => c.type === 'SCENARIO_MCQ' && c.options && c.options.length > 0);
    const profEdCount = mcqs.filter(c => c.category === 'PROFED').length;
    const genEdCount = mcqs.filter(c => c.category === 'GENED').length;
    const box1Count = mcqs.filter(c => c.box === 1).length;

    this.container.innerHTML = `
      <div class="exam-setup-container">
        <button class="btn-subtle" id="btn-back-from-setup">
          ← <span>Exit to Studio</span>
        </button>

        <div class="setup-hero-card">
          <div class="setup-icon">⚖️</div>
          <h2>PRC Board Licensure Examination Simulator</h2>
          <p>Experience realistic, timed board examination conditions based on Philippine Professional Standards for Teachers (PPST) and official PRC Table of Specifications (TOS).</p>
        </div>

        <div class="setup-form-card">
          <!-- Step 1: Examination Category -->
          <div class="setup-group">
            <label class="setup-label">1. Select Examination Area / Sub-Deck</label>
            <div class="setup-option-pills" id="setup-category-pills">
              <button class="setup-pill active" data-cat="ALL">
                <span>All Decks</span>
                <small>(${mcqs.length} MCQs)</small>
              </button>
              <button class="setup-pill" data-cat="PROFED">
                <span>Professional Education</span>
                <small>(${profEdCount} MCQs)</small>
              </button>
              <button class="setup-pill" data-cat="GENED">
                <span>General Education</span>
                <small>(${genEdCount} MCQs)</small>
              </button>
              <button class="setup-pill" data-cat="BOX1">
                <span>Box 1: Emerging Focus</span>
                <small>(${box1Count} MCQs)</small>
              </button>
            </div>
          </div>

          <!-- Step 2: Item Count -->
          <div class="setup-group">
            <label class="setup-label">2. Test Item Quantity</label>
            <div class="setup-option-pills" id="setup-count-pills">
              <button class="setup-pill active" data-count="10">10 Items (10 mins)</button>
              <button class="setup-pill" data-count="20">20 Items (20 mins)</button>
              <button class="setup-pill" data-count="50">50 Items (50 mins)</button>
            </div>
          </div>

          <!-- Step 3: Pacing & Delivery Mode -->
          <div class="setup-group">
            <label class="setup-label">3. Simulation Condition</label>
            <div class="setup-mode-cards">
              <label class="mode-card active" id="mode-card-timed">
                <input type="radio" name="exam-mode-choice" value="TIMED" checked />
                <div class="mode-info">
                  <strong>⏱️ Official Board Timed Condition (Recommended)</strong>
                  <p>Strict 60s per item countdown. Answers locked until final submission. Simulates authentic PRC pressure with zero cognitive distraction.</p>
                </div>
              </label>
              <label class="mode-card" id="mode-card-practice">
                <input type="radio" name="exam-mode-choice" value="PRACTICE" />
                <div class="mode-info">
                  <strong>💡 Formative Practice Mode</strong>
                  <p>Untimed exploration. Instant rationalization feedback after each response with zero stress.</p>
                </div>
              </label>
            </div>
          </div>

          <div class="setup-action-row">
            <button class="btn-primary btn-start-exam-large" id="btn-launch-exam">
              <span>Begin Examination Simulation ▶</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindExamSetupEvents(mcqs);
  }

  bindExamSetupEvents(mcqs) {
    document.getElementById('btn-back-from-setup')?.addEventListener('click', () => {
      this.activeMode = 'DECK';
      this.render();
    });

    document.querySelectorAll('#setup-category-pills .setup-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#setup-category-pills .setup-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.examConfig.category = pill.dataset.cat;
      });
    });

    document.querySelectorAll('#setup-count-pills .setup-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#setup-count-pills .setup-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.examConfig.itemCount = parseInt(pill.dataset.count, 10);
      });
    });

    const timedCard = document.getElementById('mode-card-timed');
    const practiceCard = document.getElementById('mode-card-practice');

    timedCard?.addEventListener('click', () => {
      timedCard.classList.add('active');
      practiceCard?.classList.remove('active');
      this.examConfig.mode = 'TIMED';
    });

    practiceCard?.addEventListener('click', () => {
      practiceCard.classList.add('active');
      timedCard?.classList.remove('active');
      this.examConfig.mode = 'PRACTICE';
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
      showToast('No scenario multiple-choice questions found in this category. Showing all MCQs instead.', 'warning');
      pool = this.cards.filter(c => c.type === 'SCENARIO_MCQ' && c.options && c.options.length > 0);
    }

    // Shuffle
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    this.examDeck = shuffled.slice(0, Math.min(this.examConfig.itemCount, shuffled.length));

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
      if (!this.examIsPaused) {
        this.examSecondsRemaining--;
        this.updateTimerDisplay();

        if (this.examSecondsRemaining <= 0) {
          this.clearExamTimer();
          showToast('⏱️ Examination time has expired! Auto-submitting responses...', 'warning');
          this.finishExam(true);
        }
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
    const el = document.getElementById('exam-timer-text');
    if (!el) return;

    const mins = Math.floor(Math.max(0, this.examSecondsRemaining) / 60);
    const secs = Math.max(0, this.examSecondsRemaining) % 60;
    el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (this.examSecondsRemaining <= 60) {
      el.classList.add('timer-warning-pulse');
    } else {
      el.classList.remove('timer-warning-pulse');
    }
  }

  renderExamArena() {
    const card = this.examDeck[this.examCurrentIndex];
    if (!card) {
      this.finishExam(false);
      return;
    }

    const currentNum = this.examCurrentIndex + 1;
    const totalNum = this.examDeck.length;
    const answeredCount = Object.keys(this.userAnswers).length;
    const selectedAnswer = this.userAnswers[card.id] || null;
    const isPractice = this.examConfig.mode === 'PRACTICE';
    const hasAnsweredCurrent = !!selectedAnswer;
    const isFlagged = this.flaggedQuestions.has(card.id);

    const mins = Math.floor(Math.max(0, this.examSecondsRemaining) / 60);
    const secs = Math.max(0, this.examSecondsRemaining) % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    this.container.innerHTML = `
      <div class="exam-arena-container">
        <!-- Arena Header Bar -->
        <div class="exam-header-bar">
          <div class="exam-header-left">
            <span class="exam-badge-tag">PRC LET SIMULATION</span>
            <span class="exam-category-chip">${card.category}</span>
            <span class="exam-competency-chip">${this.escapeHtml(card.competency)}</span>
          </div>

          <div class="exam-header-center">
            ${!isPractice ? `
              <div class="exam-timer-box">
                <span class="timer-icon">⏱️</span>
                <span class="timer-val" id="exam-timer-text">${timeStr}</span>
                <button class="btn-subtle btn-pause-toggle" id="btn-pause-exam" title="Pause / Resume">
                  ${this.examIsPaused ? '▶️' : '⏸️'}
                </button>
              </div>
            ` : `
              <span class="practice-pill">💡 Formative Practice Mode</span>
            `}
          </div>

          <div class="exam-header-right">
            <button class="btn-subtle btn-flag-question ${isFlagged ? 'active-flag' : ''}" id="btn-toggle-flag" title="Bookmark question for review">
              ${isFlagged ? '🚩 Flagged for Review' : '🏳️ Flag for Review'}
            </button>
            <button class="btn-primary btn-submit-early" id="btn-submit-exam-early">
              <span>Submit Exam (${answeredCount}/${totalNum})</span>
            </button>
          </div>
        </div>

        <div class="exam-workspace-split">
          <!-- Main Question & Options Area -->
          <div class="exam-main-panel">
            <div class="question-stem-card">
              <div class="question-header">
                <span class="question-num">Item ${currentNum} of ${totalNum}</span>
                <span class="box-indicator box-${card.box}">Box ${card.box}</span>
              </div>
              <h3 class="question-text">${this.escapeHtml(card.front)}</h3>
            </div>

            <!-- Choices -->
            <div class="options-container" id="exam-options-container">
              ${(card.options || []).map(opt => {
                const letter = opt.trim().charAt(0).toUpperCase();
                const isSelected = selectedAnswer === letter;
                const isCorrect = letter === (card.correctAnswer || '').trim().toUpperCase();

                let optionClass = 'exam-option-card';
                if (isSelected) optionClass += ' selected';

                if (isPractice && hasAnsweredCurrent) {
                  if (isCorrect) optionClass += ' practice-correct';
                  else if (isSelected) optionClass += ' practice-incorrect';
                }

                return `
                  <button class="${optionClass}" data-letter="${letter}">
                    <span class="option-letter">${letter}</span>
                    <span class="option-content">${this.escapeHtml(opt.replace(/^[A-D]\)\s*/, ''))}</span>
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Instant Rationalization (Practice Mode only) -->
            ${isPractice && hasAnsweredCurrent ? `
              <div class="practice-feedback-banner">
                <div class="feedback-head">
                  <strong>${selectedAnswer === card.correctAnswer ? '🌿 Correct Answer!' : '💡 Pedagogical Insight:'}</strong>
                  <span>Key: (${card.correctAnswer})</span>
                </div>
                <p class="feedback-rationalization">${this.escapeHtml(card.rationalization || card.back)}</p>
              </div>
            ` : ''}

            <!-- Navigation Bar -->
            <div class="exam-nav-bar">
              <button class="btn-subtle" id="btn-prev-item" ${this.examCurrentIndex === 0 ? 'disabled' : ''}>
                ← Previous Item
              </button>
              <span class="nav-hint">Or click any square in the Question Matrix to jump</span>
              <button class="btn-primary" id="btn-next-item">
                ${this.examCurrentIndex === totalNum - 1 ? 'Review & Submit →' : 'Next Item →'}
              </button>
            </div>
          </div>

          <!-- Question Matrix Jump Grid -->
          <aside class="exam-sidebar-matrix">
            <div class="matrix-card">
              <div class="matrix-head">
                <h4>Question Matrix</h4>
                <small>${answeredCount} answered of ${totalNum}</small>
              </div>
              <div class="matrix-grid">
                ${this.examDeck.map((item, idx) => {
                  const isCur = idx === this.examCurrentIndex;
                  const isAns = !!this.userAnswers[item.id];
                  const isFlg = this.flaggedQuestions.has(item.id);

                  let cellClass = 'matrix-cell';
                  if (isCur) cellClass += ' current';
                  if (isAns) cellClass += ' answered';
                  if (isFlg) cellClass += ' flagged';

                  return `
                    <button class="${cellClass}" data-jump-index="${idx}" title="Jump to item ${idx + 1}">
                      ${idx + 1}
                      ${isFlg ? '<span class="matrix-flag-dot">🚩</span>' : ''}
                    </button>
                  `;
                }).join('')}
              </div>

              <div class="matrix-legend">
                <div class="legend-item"><span class="legend-dot current"></span> Current</div>
                <div class="legend-item"><span class="legend-dot answered"></span> Answered</div>
                <div class="legend-item"><span class="legend-dot flagged"></span> Flagged</div>
                <div class="legend-item"><span class="legend-dot empty"></span> Unanswered</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    `;

    this.bindExamArenaEvents(card);
  }

  bindExamArenaEvents(card) {
    const totalNum = this.examDeck.length;

    // Option clicks
    document.querySelectorAll('#exam-options-container .exam-option-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const letter = btn.dataset.letter;
        this.userAnswers[card.id] = letter;
        this.renderExamArena();
      });
    });

    // Flag toggle
    document.getElementById('btn-toggle-flag')?.addEventListener('click', () => {
      this.toggleFlag(card.id);
      this.renderExamArena();
    });

    // Pause toggle
    document.getElementById('btn-pause-exam')?.addEventListener('click', () => {
      this.examIsPaused = !this.examIsPaused;
      this.renderExamArena();
    });

    // Previous item
    document.getElementById('btn-prev-item')?.addEventListener('click', () => {
      if (this.examCurrentIndex > 0) {
        this.examCurrentIndex--;
        this.renderExamArena();
      }
    });

    // Next item
    document.getElementById('btn-next-item')?.addEventListener('click', () => {
      if (this.examCurrentIndex < totalNum - 1) {
        this.examCurrentIndex++;
        this.renderExamArena();
      } else {
        this.promptSubmitExam();
      }
    });

    // Submit early
    document.getElementById('btn-submit-exam-early')?.addEventListener('click', () => {
      this.promptSubmitExam();
    });

    // Jump Matrix clicks
    document.querySelectorAll('.matrix-grid .matrix-cell').forEach(btn => {
      btn.addEventListener('click', () => {
        const jumpIdx = parseInt(btn.dataset.jumpIndex, 10);
        if (!isNaN(jumpIdx) && jumpIdx >= 0 && jumpIdx < totalNum) {
          this.examCurrentIndex = jumpIdx;
          this.renderExamArena();
        }
      });
    });
  }

  async promptSubmitExam() {
    const answeredCount = Object.keys(this.userAnswers).length;
    const totalCount = this.examDeck.length;
    const unanswered = totalCount - answeredCount;

    let title = 'Submit Board Exam?';
    let msg = 'Are you ready to submit your exam simulation and generate the diagnostic report?';
    let tone = 'calm';
    if (unanswered > 0) {
      title = 'Unanswered Questions';
      msg = `You still have ${unanswered} unanswered question(s). Are you sure you want to submit now?`;
      tone = 'warning';
    }

    const confirmed = await showCalmConfirm({
      title,
      message: msg,
      confirmText: 'Submit Exam',
      cancelText: 'Continue Answering',
      tone
    });

    if (confirmed) {
      this.finishExam(false);
    }
  }

  finishExam(autoTimedOut = false) {
    this.clearExamTimer();
    this.examDurationTaken = Math.round((Date.now() - (this.examStartTime || Date.now())) / 1000);

    // Compute diagnostics
    let correctCount = 0;
    const breakdownByCategory = { PROFED: { correct: 0, total: 0 }, GENED: { correct: 0, total: 0 } };
    const itemsDiagnostic = [];

    this.examDeck.forEach(card => {
      const userAns = this.userAnswers[card.id] || null;
      const isCorrect = userAns && userAns.trim().toUpperCase() === (card.correctAnswer || '').trim().toUpperCase();
      const wasFlagged = this.flaggedQuestions.has(card.id);

      if (isCorrect) correctCount++;

      const cat = card.category || 'PROFED';
      if (!breakdownByCategory[cat]) breakdownByCategory[cat] = { correct: 0, total: 0 };
      breakdownByCategory[cat].total++;
      if (isCorrect) breakdownByCategory[cat].correct++;

      itemsDiagnostic.push({
        card,
        userAnswer: userAns,
        isCorrect,
        isFlagged
      });
    });

    const totalItems = this.examDeck.length;
    const percentageScore = totalItems > 0 ? ((correctCount / totalItems) * 100).toFixed(1) : 0;
    const passedPrBenchmark = percentageScore >= 75.0; // Official 75.0% PRC passing rate

    this.examResultDiagnostics = {
      score: correctCount,
      total: totalItems,
      percentage: percentageScore,
      passed: passedPrBenchmark,
      durationSeconds: this.examDurationTaken,
      autoTimedOut,
      breakdown: breakdownByCategory,
      items: itemsDiagnostic,
      submittedAt: new Date().toISOString()
    };

    this.activeMode = 'EXAM_DIAGNOSTICS';
    this.render();
  }

  renderExamDiagnosticReport() {
    if (!this.examResultDiagnostics) {
      this.activeMode = 'DECK';
      this.render();
      return;
    }

    const diag = this.examResultDiagnostics;
    const mins = Math.floor(diag.durationSeconds / 60);
    const secs = diag.durationSeconds % 60;
    const timeSpent = `${mins}m ${secs}s`;

    const filteredItems = diag.items.filter(item => {
      if (this.diagnosticFilter === 'INCORRECT') return !item.isCorrect;
      if (this.diagnosticFilter === 'FLAGGED') return item.isFlagged;
      return true;
    });

    const incorrectItems = diag.items.filter(item => !item.isCorrect);

    this.container.innerHTML = `
      <div class="exam-diagnostics-container">
        <!-- Hero Header -->
        <div class="diagnostics-hero ${diag.passed ? 'passed' : 'remedial'}">
          <div class="hero-status-row">
            <span class="status-badge">${diag.passed ? '🌟 PRC LET BENCHMARK MET' : '🌱 READINESS IN PROGRESS'}</span>
            <span class="submitted-date">Simulation Date: ${new Date(diag.submittedAt).toLocaleDateString()}</span>
          </div>
          <div class="hero-score-split">
            <div class="score-callout">
              <h1 class="percentage-display">${diag.percentage}%</h1>
              <p class="score-subtext">${diag.score} / ${diag.total} Correct Responses • Official PRC Passing Benchmark: 75.0%</p>
            </div>
            <div class="hero-actions-box">
              <button class="btn-primary" id="btn-export-diagnostic-word">
                <span>📄 Download Word (.doc) Report</span>
              </button>
              ${incorrectItems.length > 0 ? `
                <button class="btn-secondary" id="btn-remediate-box1">
                  <span>🌱 Move ${incorrectItems.length} Missed Items to Box 1</span>
                </button>
              ` : ''}
              <button class="btn-subtle" id="btn-exit-diagnostics">
                <span>← Back to Decks</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Competency & Domain Breakdown Cards -->
        <div class="diagnostics-meta-grid">
          <div class="diag-card">
            <h4>Pacing &amp; Speed Analysis</h4>
            <div class="diag-metric">
              <span class="metric-val">${timeSpent}</span>
              <span class="metric-lbl">Total Time Taken</span>
            </div>
            <p class="meta-hint">Average: ${Math.round(diag.durationSeconds / (diag.total || 1))}s per item (PRC limit: 60s)</p>
          </div>

          ${Object.entries(diag.breakdown).map(([cat, stats]) => {
            const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
            return `
              <div class="diag-card">
                <h4>${cat === 'PROFED' ? 'Professional Education' : cat === 'GENED' ? 'General Education' : cat}</h4>
                <div class="diag-metric">
                  <span class="metric-val">${pct}%</span>
                  <span class="metric-lbl">${stats.correct} / ${stats.total} Passed</span>
                </div>
                <div class="mini-progress-track">
                  <div class="mini-progress-fill" style="width: ${pct}%;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Question Review Filter Bar -->
        <div class="diagnostics-filter-bar">
          <div class="filter-title">
            <h3>Detailed Item Analysis &amp; Pedagogical Rationalizations</h3>
          </div>
          <div class="filter-pills">
            <button class="filter-pill ${this.diagnosticFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">All Items (${diag.items.length})</button>
            <button class="filter-pill ${this.diagnosticFilter === 'INCORRECT' ? 'active' : ''}" data-filter="INCORRECT">Missed Items (${incorrectItems.length})</button>
            <button class="filter-pill ${this.diagnosticFilter === 'FLAGGED' ? 'active' : ''}" data-filter="FLAGGED">Flagged (${diag.items.filter(i => i.isFlagged).length})</button>
          </div>
        </div>

        <!-- Detailed Item Stream -->
        <div class="diagnostics-items-list">
          ${filteredItems.map((item, idx) => {
            const card = item.card;
            return `
              <div class="diag-item-card ${item.isCorrect ? 'item-correct' : 'item-incorrect'}">
                <div class="diag-item-header">
                  <div class="item-left-meta">
                    <span class="result-pill ${item.isCorrect ? 'correct' : 'incorrect'}">
                      ${item.isCorrect ? '✓ Correct' : '✗ Missed'}
                    </span>
                    <span class="badge-category badge-${card.category}">${card.category}</span>
                    <span class="competency-tag">${this.escapeHtml(card.competency)}</span>
                  </div>
                  ${item.isFlagged ? '<span class="flagged-chip">🚩 Flagged</span>' : ''}
                </div>

                <h4 class="diag-question-text">${this.escapeHtml(card.front)}</h4>

                <!-- Choices Comparison -->
                <div class="diag-choices-box">
                  ${(card.options || []).map(opt => {
                    const letter = opt.trim().charAt(0).toUpperCase();
                    const isUserPick = item.userAnswer === letter;
                    const isKey = letter === (card.correctAnswer || '').trim().toUpperCase();

                    let pillClass = 'diag-choice-pill';
                    if (isKey) pillClass += ' key-answer';
                    if (isUserPick && !isKey) pillClass += ' user-wrong';

                    return `
                      <div class="${pillClass}">
                        <span class="opt-letter">${letter}</span>
                        <span class="opt-text">${this.escapeHtml(opt.replace(/^[A-D]\)\s*/, ''))}</span>
                        ${isKey ? '<span class="status-chip-correct">✓ Correct Key</span>' : ''}
                        ${isUserPick && !isKey ? '<span class="status-chip-wrong">✗ Your Response</span>' : ''}
                      </div>
                    `;
                  }).join('')}
                </div>

                <!-- Pedagogical Rationale -->
                <div class="diag-rationale-box">
                  <div class="rationale-header">
                    <span class="rationale-icon">💡</span>
                    <strong>Pedagogical Core &amp; Explanation:</strong>
                  </div>
                  <p class="rationale-text">${this.escapeHtml(card.rationalization || card.back)}</p>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.bindDiagnosticEvents(incorrectItems);
  }

  bindDiagnosticEvents(incorrectItems) {
    document.getElementById('btn-exit-diagnostics')?.addEventListener('click', () => {
      this.activeMode = 'DECK';
      this.render();
    });

    document.getElementById('btn-export-diagnostic-word')?.addEventListener('click', () => {
      this.exportDiagnosticToWord();
    });

    document.getElementById('btn-remediate-box1')?.addEventListener('click', () => {
      let count = 0;
      incorrectItems.forEach(item => {
        const c = this.cards.find(card => card.id === item.card.id);
        if (c) {
          c.box = 1;
          c.dueDate = new Date(Date.now() + ReviewerStudio.INTERVALS[1]).toISOString();
          count++;
        }
      });
      this.saveCards();
      showToast(`🌱 ${count} missed item(s) scheduled in Box 1 for daily spaced retrieval!`, 'success');
      this.render();
    });

    document.querySelectorAll('.diagnostics-filter-bar .filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        this.diagnosticFilter = pill.dataset.filter;
        this.renderExamDiagnosticReport();
      });
    });
  }

  exportDiagnosticToWord() {
    if (!this.examResultDiagnostics) return;
    const diag = this.examResultDiagnostics;

    const docContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>LET Diagnostic Assessment Report</title>
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.4; margin: 1in; color: #1E293B; }
          .header { text-align: center; border-bottom: 2pt solid #3B6347; padding-bottom: 12pt; margin-bottom: 16pt; }
          .title { font-size: 16pt; font-weight: bold; color: #3B6347; }
          .subtitle { font-size: 11pt; color: #64748B; margin-top: 4pt; }
          .score-banner { background: #F8FAFC; border: 1pt solid #E2E8F0; padding: 14pt; border-radius: 8pt; margin-bottom: 16pt; }
          .score-num { font-size: 24pt; font-weight: bold; color: ${diag.passed ? '#3B6347' : '#D4683B'}; }
          .table-stat { width: 100%; border-collapse: collapse; margin-bottom: 16pt; }
          .table-stat th, .table-stat td { border: 1pt solid #CBD5E1; padding: 8pt; text-align: left; }
          .table-stat th { background: #F1F5F9; font-weight: bold; }
          .item-block { border: 1pt solid #E2E8F0; padding: 10pt; margin-bottom: 12pt; border-radius: 6pt; page-break-inside: avoid; }
          .correct { border-left: 4pt solid #3B6347; }
          .incorrect { border-left: 4pt solid #D4683B; }
          .rationale { background: #F0FDF4; border-left: 3pt solid #10B981; padding: 8pt; margin-top: 8pt; font-size: 10pt; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">PRC LET BOARD EXAMINATION SIMULATOR — DIAGNOSTIC REPORT</div>
          <div class="subtitle">Pedagogo Desk • Competency Mastery &amp; Spaced Retrieval Assessment</div>
          <div class="subtitle">Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>

        <div class="score-banner">
          <div>Overall Performance Rating:</div>
          <div class="score-num">${diag.percentage}% — ${diag.passed ? 'BENCHMARK MET (Passed PRC Threshold)' : 'READINESS IN PROGRESS'}</div>
          <div>Total Score: ${diag.score} out of ${diag.total} Items (${Math.round(diag.durationSeconds / 60)} minutes elapsed)</div>
        </div>

        <h3>Domain Breakdown</h3>
        <table class="table-stat">
          <thead>
            <tr>
              <th>Examination Domain</th>
              <th>Correct Items</th>
              <th>Total Items</th>
              <th>Score Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(diag.breakdown).map(([cat, st]) => `
              <tr>
                <td>${cat === 'PROFED' ? 'Professional Education' : cat === 'GENED' ? 'General Education' : cat}</td>
                <td>${st.correct}</td>
                <td>${st.total}</td>
                <td>${st.total > 0 ? Math.round((st.correct / st.total) * 100) : 0}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h3>Item-by-Item Diagnostic Rationalization</h3>
        ${diag.items.map((it, idx) => `
          <div class="item-block ${it.isCorrect ? 'correct' : 'incorrect'}">
            <div><strong>Item ${idx + 1}: [${it.card.category} • ${this.escapeHtml(it.card.competency)}]</strong></div>
            <div style="margin: 6pt 0;">${this.escapeHtml(it.card.front)}</div>
            <div style="font-size: 10pt; color: #475569;">
              Candidate Response: <strong>${it.userAnswer || 'Unanswered'}</strong> | Correct Key: <strong>${it.card.correctAnswer}</strong> | Status: ${it.isCorrect ? 'PASSED' : 'REMEDIAL NEEDED'}
            </div>
            <div class="rationale">
              <strong>Pedagogical Rationale:</strong> ${this.escapeHtml(it.card.rationalization || it.card.back)}
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

  /* =========================================================================
   * EVENT BINDING: DECK OVERVIEW
   * ========================================================================= */

  bindOverviewEvents() {
    // Daily Drill Actions
    document.getElementById('btn-start-daily-drill')?.addEventListener('click', () => {
      this.startDailyDrill(15);
    });

    document.getElementById('btn-banner-start-drill')?.addEventListener('click', () => {
      this.startDailyDrill(15);
    });

    document.getElementById('btn-banner-review-ahead')?.addEventListener('click', () => {
      this.startDailyDrill(10, true);
    });

    // Flashcards
    document.getElementById('btn-start-flashcard-session')?.addEventListener('click', () => {
      this.studyDeck = [...this.cards].sort(() => Math.random() - 0.5);
      this.currentCardIndex = 0;
      this.isCardFlipped = false;
      this.activeMode = 'STUDY_CARDS';
      this.render();
    });

    // Mock Board Exam
    document.getElementById('btn-start-mock-quiz')?.addEventListener('click', () => {
      this.activeMode = 'EXAM_SETUP';
      this.render();
    });

    // Paper Reviewer
    document.getElementById('btn-open-paper-reviewer')?.addEventListener('click', () => {
      this.activeMode = 'PRINT_PAPER';
      this.render();
    });

    // Add Card Modal
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
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.cardId;
        const confirmed = await showCalmConfirm({
          title: 'Remove Reviewer Card?',
          message: 'Remove this item from your LET question bank? Spaced scheduling history for this item will be removed.',
          confirmText: 'Remove Card',
          cancelText: 'Keep Card',
          tone: 'danger'
        });
        if (confirmed) {
          this.cards = this.cards.filter(c => c.id !== id);
          this.saveCards();
          this.render();
          showToast('Card removed from reviewer deck.', 'info');
        }
      });
    });
  }

  /* =========================================================================
   * MODALS & READING DESK QUESTION IMPORT
   * ========================================================================= */

  openAddCardModal() {
    let modal = document.getElementById('modal-add-let-card');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-add-let-card';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3>Add New LET Card or Scenario MCQ 🎴</h3>
          <button class="btn-subtle" id="btn-close-add-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Card Type</label>
            <select id="modal-card-type" class="form-control">
              <option value="FLASHCARD">🎴 Concept Flashcard (Front &amp; Back)</option>
              <option value="SCENARIO_MCQ">📝 Scenario Multiple-Choice Question (MCQ)</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex: 1;">
              <label>Category</label>
              <select id="modal-card-category" class="form-control">
                <option value="PROFED">Professional Education</option>
                <option value="GENED">General Education</option>
                <option value="MAJOR">Specialization / Major</option>
              </select>
            </div>
            <div class="form-group" style="flex: 1;">
              <label>PPST 7 Domains Tag</label>
              <select id="modal-card-ppst" class="form-control">
                ${ReviewerStudio.PPST_DOMAINS.map(d => `<option value="${d}">${d}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Competency / Topic Tag</label>
            <input type="text" id="modal-card-competency" class="form-control" placeholder="e.g. Assessment of Learning, Child Development..." />
          </div>

          <div class="form-group">
            <label id="lbl-modal-front">Front / Question Prompt</label>
            <textarea id="modal-card-front" class="form-control" rows="3" placeholder="Enter term, prompt, or pedagogical board exam scenario..."></textarea>
          </div>

          <!-- MCQ Option Fields -->
          <div id="modal-mcq-fields" style="display: none;">
            <div class="form-group">
              <label>Option A</label>
              <input type="text" id="modal-opt-a" class="form-control" placeholder="Choice A..." />
            </div>
            <div class="form-group">
              <label>Option B</label>
              <input type="text" id="modal-opt-b" class="form-control" placeholder="Choice B..." />
            </div>
            <div class="form-group">
              <label>Option C</label>
              <input type="text" id="modal-opt-c" class="form-control" placeholder="Choice C..." />
            </div>
            <div class="form-group">
              <label>Option D</label>
              <input type="text" id="modal-opt-d" class="form-control" placeholder="Choice D..." />
            </div>
            <div class="form-group">
              <label>Correct Answer</label>
              <select id="modal-opt-correct" class="form-control">
                <option value="A">Option A</option>
                <option value="B">Option B</option>
                <option value="C">Option C</option>
                <option value="D">Option D</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label id="lbl-modal-back">Back Answer / Pedagogical Rationale</label>
            <textarea id="modal-card-back" class="form-control" rows="3" placeholder="Explain the theoretical foundation or classroom analogy..."></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-subtle" id="btn-cancel-add-card">Cancel</button>
          <button class="btn-primary" id="btn-save-new-card">Save to Deck</button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    const typeSelect = document.getElementById('modal-card-type');
    const mcqFields = document.getElementById('modal-mcq-fields');
    typeSelect?.addEventListener('change', () => {
      const isMcq = typeSelect.value === 'SCENARIO_MCQ';
      if (mcqFields) mcqFields.style.display = isMcq ? 'block' : 'none';
    });

    const closeModal = () => {
      modal.style.display = 'none';
    };

    document.getElementById('btn-close-add-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-add-card')?.addEventListener('click', closeModal);

    document.getElementById('btn-save-new-card')?.addEventListener('click', () => {
      const type = typeSelect.value;
      const category = document.getElementById('modal-card-category').value;
      const ppstStrand = document.getElementById('modal-card-ppst').value;
      const competency = document.getElementById('modal-card-competency').value.trim() || 'General Pedagogy';
      const front = document.getElementById('modal-card-front').value.trim();
      const back = document.getElementById('modal-card-back').value.trim();

      if (!front) {
        showToast('Please provide a front prompt or question for the card.', 'warning');
        return;
      }

      const newCard = {
        id: 'card-' + Date.now(),
        type,
        category,
        ppstStrand,
        competency,
        front,
        back: back || front,
        box: 1,
        reviewCount: 0,
        lastReviewedAt: null,
        dueDate: new Date().toISOString()
      };

      if (type === 'SCENARIO_MCQ') {
        const optA = document.getElementById('modal-opt-a').value.trim();
        const optB = document.getElementById('modal-opt-b').value.trim();
        const optC = document.getElementById('modal-opt-c').value.trim();
        const optD = document.getElementById('modal-opt-d').value.trim();
        const correct = document.getElementById('modal-opt-correct').value;

        if (!optA || !optB) {
          showToast('Please provide at least Options A and B for multiple-choice questions.', 'warning');
          return;
        }

        newCard.options = [
          `A) ${optA}`,
          `B) ${optB}`,
          optC ? `C) ${optC}` : 'C) N/A',
          optD ? `D) ${optD}` : 'D) N/A'
        ];
        newCard.correctAnswer = correct;
        newCard.rationalization = back;
      }

      this.cards.unshift(newCard);
      this.saveCards();
      closeModal();
      showToast('Card added to your LET review studio!', 'success');
      this.render();
    });
  }

  importQuestionsFromReadingDesk(questionsArray, docTitle = 'Uploaded Reading Document') {
    if (!Array.isArray(questionsArray) || questionsArray.length === 0) return;

    let importedCount = 0;
    let termCount = 0;
    const now = Date.now();
    questionsArray.forEach((q, idx) => {
      const isTermDrill = q.cardKind === 'TERM_FILL_IN' || ((q.options || []).length === 0 && (q.answer || '').length > 0 && (q.answer || '').length < 60);
      if (isTermDrill) termCount += 1;
      const card = {
        id: 'import-' + now + '-' + idx,
        type: isTermDrill ? 'TERM_FILL_IN' : 'SCENARIO_MCQ',
        category: 'PROFED',
        competency: docTitle,
        ppstStrand: 'Domain 1: Content Knowledge and Pedagogy',
        front: q.front || q.question || 'Review Item',
        back: isTermDrill
          ? `${q.answer || 'See Term Bank'}${q.rationalization ? ' — ' + q.rationalization : ''}`
          : (q.rationalization || q.explanation || q.answer || 'Refer to curriculum synthesis'),
        options: q.options || (q.choices ? q.choices.map((c, i) => `${String.fromCharCode(65 + i)}) ${c}`) : []),
        correctAnswer: isTermDrill
          ? (q.answer || q.correctAnswer || '').trim()
          : (q.correctAnswer || q.answer || 'A').trim().toUpperCase(),
        rationalization: q.rationalization || q.explanation || '',
        box: 1,
        reviewCount: 0,
        lastReviewedAt: null,
        dueDate: new Date(now).toISOString()
      };
      this.cards.unshift(card);
      importedCount++;
    });
    const isTermDrillPresent = termCount > 0;

    this.saveCards();
    const summary = isTermDrillPresent
      ? `📥 Imported ${importedCount - termCount} scenario MCQ(s) + ${termCount} term drill(s) into your LET Reviewer (Box 1 — re-test in 1 day).`
      : `📥 Successfully imported ${importedCount} board question(s) into your LET review studio!`;
    showToast(summary, 'success');
    this.render();
  }

  /* =========================================================================
   * UTILITIES
   * ========================================================================= */

  simpleMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
