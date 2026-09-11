/**
 * Pedagogo Lesson Plan Studio (4As Framework + Bloom's Taxonomy)
 * Designed for Education Students / Pre-Service Teachers
 */

export class LessonPlanStudio {
  constructor() {
    this.bloomsCategories = [
      {
        level: '1. Remembering',
        verbs: ['Define', 'Identify', 'List', 'Name', 'Recall', 'Recognize', 'State']
      },
      {
        level: '2. Understanding',
        verbs: ['Classify', 'Describe', 'Discuss', 'Explain', 'Interpret', 'Summarize']
      },
      {
        level: '3. Applying',
        verbs: ['Apply', 'Demonstrate', 'Illustrate', 'Practice', 'Solve', 'Utilize']
      },
      {
        level: '4. Analyzing',
        verbs: ['Analyze', 'Compare', 'Contrast', 'Differentiate', 'Examine', 'Categorize']
      },
      {
        level: '5. Evaluating',
        verbs: ['Assess', 'Critique', 'Defend', 'Evaluate', 'Judge', 'Justify']
      },
      {
        level: '6. Creating',
        verbs: ['Compose', 'Construct', 'Design', 'Formulate', 'Develop', 'Synthesize']
      }
    ];

    this.initElements();
    this.renderBloomsVerbs();
    this.bindEvents();
    this.restoreSavedPlan();
  }

  initElements() {
    this.bloomsContainer = document.getElementById('blooms-container');
    this.objectivesInput = document.getElementById('lp-objectives');
    this.btnLoadSample = document.getElementById('btn-load-sample-lp');
    this.btnPrint = document.getElementById('btn-print-lp');

    // Input fields for auto-save
    this.fields = [
      'lp-subject', 'lp-topic', 'lp-target-grade', 'lp-duration',
      'lp-objectives', 'lp-materials', 'lp-activity', 'lp-analysis',
      'lp-abstraction', 'lp-application', 'lp-evaluation', 'lp-assignment'
    ];
  }

  renderBloomsVerbs() {
    if (!this.bloomsContainer) return;
    this.bloomsContainer.innerHTML = '';

    this.bloomsCategories.forEach(cat => {
      const group = document.createElement('div');
      group.className = 'blooms-level-group';

      const title = document.createElement('div');
      title.className = 'blooms-level-title';
      title.textContent = cat.level;
      group.appendChild(title);

      const cloud = document.createElement('div');
      cloud.className = 'verbs-cloud';

      cat.verbs.forEach(verb => {
        const chip = document.createElement('button');
        chip.className = 'verb-chip';
        chip.textContent = verb;
        chip.type = 'button';
        chip.addEventListener('click', () => this.insertVerb(verb));
        cloud.appendChild(chip);
      });

      group.appendChild(cloud);
      this.bloomsContainer.appendChild(group);
    });
  }

  insertVerb(verb) {
    if (!this.objectivesInput) return;
    const currentVal = this.objectivesInput.value;
    const bullet = currentVal.trim().length === 0 ? `1. ${verb} ` : `\n• ${verb} `;
    
    this.objectivesInput.value = currentVal + bullet;
    this.objectivesInput.focus();
    this.saveCurrentPlan();
  }

  bindEvents() {
    if (this.btnLoadSample) {
      this.btnLoadSample.addEventListener('click', () => this.loadSamplePlan());
    }

    if (this.btnPrint) {
      this.btnPrint.addEventListener('click', () => window.print());
    }

    // Auto-save on every keystroke
    this.fields.forEach(fieldId => {
      const el = document.getElementById(fieldId);
      if (el) {
        el.addEventListener('input', () => this.saveCurrentPlan());
      }
    });
  }

  saveCurrentPlan() {
    const data = {};
    this.fields.forEach(fieldId => {
      const el = document.getElementById(fieldId);
      if (el) data[fieldId] = el.value;
    });
    localStorage.setItem('pedagogo_saved_lp', JSON.stringify(data));
  }

  restoreSavedPlan() {
    const saved = localStorage.getItem('pedagogo_saved_lp');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.fields.forEach(fieldId => {
          const el = document.getElementById(fieldId);
          if (el && data[fieldId] !== undefined) {
            el.value = data[fieldId];
          }
        });
      } catch (e) {
        console.warn('Could not restore saved LP:', e);
      }
    }
  }

  loadSamplePlan() {
    const sample = {
      'lp-subject': 'English 8 (Afro-Asian Literature)',
      'lp-topic': 'Determining Meaning through Context Clues',
      'lp-target-grade': 'Grade 8 - Rizal (Junior High)',
      'lp-duration': '60 Minutes',
      'lp-objectives': 'At the end of this 60-minute session, 85% of the students will be able to:\n1. Identify the types of context clues used in selected sentences;\n2. Differentiate synonyms, antonyms, and explanation clues in context; and\n3. Demonstrate willingness to collaborate during the differentiated group challenge.',
      'lp-materials': 'References: DepEd English 8 Curriculum Guide, Quarter 1 - Module 2.\nInstructional Materials (IMs): Printed word mystery envelopes, Manila paper, colored markers, slide presentation, and context clue cue cards.',
      'lp-activity': '“Mystery Envelopes” Game (10 Minutes):\nStudents are grouped into 4 teams. Each team receives an envelope containing an excerpt from an African folk tale with three bolded unfamiliar words. Groups have 4 minutes to deduce their meanings by analyzing surrounding sentence hints and present their guesses to class.',
      'lp-analysis': 'Processing & Guiding Questions (10 Minutes):\n1. What were the specific keywords in the sentences that helped you unlock the unfamiliar word?\n2. Did the sentence provide an opposite word, a definition, or a synonym?\n3. Why is using context clues more effective during rapid reading than stopping to look up every single word?',
      'lp-abstraction': 'Explicit Pedagogical Discussion (20 Minutes):\nTeacher provides clear definitions and authentic examples of the 4 Common Context Clues:\n• Definition / Restatement Clue (e.g., punctuation markers like dashes or "that is")\n• Synonym / Comparison Clue\n• Antonym / Contrast Clue (e.g., transitional signals like "however", "unlike", "whereas")\n• Cause-and-Effect / Explanation Clue\nStudents provide their own sample sentences on the board.',
      'lp-application': 'Differentiated Group Tasks (12 Minutes):\n• Group 1 (Linguistic): Compose a 4-line poem embedding 2 context clues.\n• Group 2 (Visual): Create a mini comic strip illustrating a word clue.\n• Group 3 (Practical): Formulate a short dialogues between friends solving a clue.',
      'lp-evaluation': 'Formative Assessment (5 Minutes):\nA 5-item multiple-choice quiz administered via printed exit slips where learners identify the context clue type for underlined terms.',
      'lp-assignment': 'Journal Reflection (3 Minutes):\nIn your English notebook, write a short 4-sentence reflection on one new word you discovered today and explain how the context helped you understand it.'
    };

    this.fields.forEach(fieldId => {
      const el = document.getElementById(fieldId);
      if (el && sample[fieldId]) {
        el.value = sample[fieldId];
      }
    });

    this.saveCurrentPlan();
    alert('🌿 Sample 4As Lesson Plan loaded! You can modify any section and print whenever ready.');
  }
}
