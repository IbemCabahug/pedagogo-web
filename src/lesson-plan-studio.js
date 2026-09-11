/**
 * Pedagogo Lesson Plan Studio (4As & 7Es Frameworks + Bloom's Taxonomy)
 * Designed for Education Students & Pre-Service Teachers
 * Official DepEd K-12 & MATATAG Standards Alignment
 */

export class LessonPlanStudio {
  constructor() {
    this.currentFramework = '4AS'; // '4AS' or '7ES'

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

    // Listen for data restore from Backup Hub
    window.addEventListener('pedagogo:data-restored', () => {
      this.restoreSavedPlan();
    });
  }

  initElements() {
    this.bloomsContainer = document.getElementById('blooms-container');
    this.objectivesInput = document.getElementById('lp-objectives');
    this.btnLoadSample = document.getElementById('btn-load-sample-lp');
    this.btnPrint = document.getElementById('btn-print-lp');
    this.btnExportWord = document.getElementById('btn-export-docx-lp');

    this.btnSwitch4As = document.getElementById('btn-switch-4as');
    this.btnSwitch7Es = document.getElementById('btn-switch-7es');
    this.container4As = document.getElementById('procedure-4as-container');
    this.container7Es = document.getElementById('procedure-7es-container');

    // Comprehensive list of fields for DepEd MATATAG / 4As / 7Es
    this.fields = [
      'lp-subject', 'lp-topic', 'lp-target-grade', 'lp-duration',
      'lp-content-standard', 'lp-perf-standard', 'lp-melc-code',
      'lp-objectives', 'lp-materials',
      // 4As fields
      'lp-activity', 'lp-analysis', 'lp-abstraction', 'lp-application',
      // 7Es fields
      'lp-7e-elicit', 'lp-7e-engage', 'lp-7e-explore', 'lp-7e-explain',
      'lp-7e-elaborate', 'lp-7e-evaluate', 'lp-7e-extend',
      // Final sections
      'lp-evaluation', 'lp-assignment'
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

    if (this.btnExportWord) {
      this.btnExportWord.addEventListener('click', () => this.exportToWord());
    }

    if (this.btnSwitch4As) {
      this.btnSwitch4As.addEventListener('click', () => this.setFramework('4AS'));
    }

    if (this.btnSwitch7Es) {
      this.btnSwitch7Es.addEventListener('click', () => this.setFramework('7ES'));
    }

    // Auto-save on every keystroke
    this.fields.forEach(fieldId => {
      const el = document.getElementById(fieldId);
      if (el) {
        el.addEventListener('input', () => this.saveCurrentPlan());
      }
    });
  }

  setFramework(framework) {
    this.currentFramework = framework;
    if (this.btnSwitch4As && this.btnSwitch7Es) {
      this.btnSwitch4As.classList.toggle('active', framework === '4AS');
      this.btnSwitch7Es.classList.toggle('active', framework === '7ES');
    }
    if (this.container4As && this.container7Es) {
      this.container4As.style.display = framework === '4AS' ? 'block' : 'none';
      this.container7Es.style.display = framework === '7ES' ? 'block' : 'none';
    }
    this.saveCurrentPlan();
  }

  saveCurrentPlan() {
    const data = {
      framework: this.currentFramework,
      updatedAt: new Date().toISOString()
    };
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
        if (data.framework) {
          this.setFramework(data.framework);
        }
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

  getFieldValue(id, fallback = '') {
    const el = document.getElementById(id);
    return el && el.value.trim() ? el.value.trim() : fallback;
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

  /**
   * Generates a formal DepEd Semi-Detailed Lesson Plan in Microsoft Word (.doc) format.
   * Uses the standard Microsoft Office XML/HTML namespace for full fidelity in Word & Google Docs.
   */
  exportToWord() {
    const subject = this.getFieldValue('lp-subject', 'English 8');
    const topic = this.getFieldValue('lp-topic', 'Lesson Plan');
    const targetGrade = this.getFieldValue('lp-target-grade', 'Grade 8 - Rizal');
    const duration = this.getFieldValue('lp-duration', '60 Minutes • Quarter 1');
    const contentStd = this.getFieldValue('lp-content-standard', 'The learner demonstrates communicative competence through understanding of literary text types.');
    const perfStd = this.getFieldValue('lp-perf-standard', 'The learner transfers learning by producing collaborative creative outputs.');
    const melcCode = this.getFieldValue('lp-melc-code', 'Determine the meaning of words and expressions that reflect the local culture (EN8V-If-6)');
    const objectives = this.getFieldValue('lp-objectives', 'By the end of the lesson, students will be able to demonstrate mastery of the lesson concepts.');
    const materials = this.getFieldValue('lp-materials', 'References: DepEd Curriculum Guide; Materials: Slide presentation, handouts, cue cards.');
    const evaluation = this.getFieldValue('lp-evaluation', 'Formative assessment: 5-item evaluation administered via exit slip.');
    const assignment = this.getFieldValue('lp-assignment', 'Journal Reflection: Write a 4-sentence reflection connecting today\'s lesson to daily communication.');

    const is4As = this.currentFramework === '4AS';

    let procedureHtml = '';
    if (is4As) {
      procedureHtml = `
        <div class="section-title">III. PROCEDURE (4As FRAMEWORK)</div>
        <table class="proc-table">
          <tr>
            <td class="proc-cell">
              <div class="stage-label">A. Activity (Engage &amp; Hook)</div>
              <p>${this.escapeHtml(this.getFieldValue('lp-activity', 'Introductory motivational activity.')).replace(/\n/g, '<br>')}</p>
            </td>
          </tr>
          <tr>
            <td class="proc-cell">
              <div class="stage-label">B. Analysis (Guiding Critical Questions)</div>
              <p>${this.escapeHtml(this.getFieldValue('lp-analysis', 'Processing questions connecting activity to core concept.')).replace(/\n/g, '<br>')}</p>
            </td>
          </tr>
          <tr>
            <td class="proc-cell">
              <div class="stage-label">C. Abstraction (Core Concept &amp; Generalization)</div>
              <p>${this.escapeHtml(this.getFieldValue('lp-abstraction', 'Direct pedagogical instruction, definitions, and rules.')).replace(/\n/g, '<br>')}</p>
            </td>
          </tr>
          <tr>
            <td class="proc-cell">
              <div class="stage-label">D. Application (Hands-on Practice &amp; Differentiated Tasks)</div>
              <p>${this.escapeHtml(this.getFieldValue('lp-application', 'Authentic group exercises and contextualized tasks.')).replace(/\n/g, '<br>')}</p>
            </td>
          </tr>
        </table>
      `;
    } else {
      procedureHtml = `
        <div class="section-title">III. PROCEDURE (7Es CONSTRUCTIVIST FRAMEWORK)</div>
        <table class="proc-table">
          <tr><td class="proc-cell"><div class="stage-label">1. Elicit (Prior Knowledge)</div><p>${this.escapeHtml(this.getFieldValue('lp-7e-elicit', 'Recall prior knowledge.')).replace(/\n/g, '<br>')}</p></td></tr>
          <tr><td class="proc-cell"><div class="stage-label">2. Engage (Captivate Curiosity)</div><p>${this.escapeHtml(this.getFieldValue('lp-7e-engage', 'Hook student curiosity.')).replace(/\n/g, '<br>')}</p></td></tr>
          <tr><td class="proc-cell"><div class="stage-label">3. Explore (Hands-on Investigation)</div><p>${this.escapeHtml(this.getFieldValue('lp-7e-explore', 'Collaborative group inquiry.')).replace(/\n/g, '<br>')}</p></td></tr>
          <tr><td class="proc-cell"><div class="stage-label">4. Explain (Clarify &amp; Define Concepts)</div><p>${this.escapeHtml(this.getFieldValue('lp-7e-explain', 'Formal definition and rules.')).replace(/\n/g, '<br>')}</p></td></tr>
          <tr><td class="proc-cell"><div class="stage-label">5. Elaborate (Deepen &amp; Transfer)</div><p>${this.escapeHtml(this.getFieldValue('lp-7e-elaborate', 'Students apply concept in new scenarios.')).replace(/\n/g, '<br>')}</p></td></tr>
          <tr><td class="proc-cell"><div class="stage-label">6. Evaluate (Assess Grasp)</div><p>${this.escapeHtml(this.getFieldValue('lp-7e-evaluate', 'Formative check against objectives.')).replace(/\n/g, '<br>')}</p></td></tr>
          <tr><td class="proc-cell"><div class="stage-label">7. Extend (Real-World Enrichment)</div><p>${this.escapeHtml(this.getFieldValue('lp-7e-extend', 'Real world challenge.')).replace(/\n/g, '<br>')}</p></td></tr>
        </table>
      `;
    }

    const docContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page {
            size: letter portrait;
            margin: 1.0in 1.0in 1.0in 1.0in;
            mso-header-margin: 0.5in;
            mso-footer-margin: 0.5in;
          }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 11pt;
            line-height: 1.35;
            color: #111;
          }
          .deped-header {
            text-align: center;
            margin-bottom: 14pt;
          }
          .deped-header h4 {
            margin: 0;
            font-size: 10pt;
            font-weight: normal;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
          }
          .deped-header h3 {
            margin: 2pt 0;
            font-size: 11pt;
            font-weight: bold;
            text-transform: uppercase;
          }
          .deped-header h2 {
            margin: 4pt 0;
            font-size: 13pt;
            font-weight: bold;
            letter-spacing: 0.5pt;
          }
          .header-line {
            border-bottom: 2pt solid #000;
            margin-top: 6pt;
            margin-bottom: 12pt;
          }
          table.meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14pt;
          }
          table.meta-table td, table.meta-table th {
            border: 1pt solid #000;
            padding: 4pt 6pt;
            font-size: 10pt;
            vertical-align: top;
          }
          table.meta-table th {
            background-color: #f2f2f2;
            width: 25%;
            font-weight: bold;
          }
          .standards-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14pt;
          }
          .standards-table td, .standards-table th {
            border: 1pt solid #444;
            padding: 4pt 6pt;
            font-size: 9.5pt;
            vertical-align: top;
          }
          .standards-table th {
            background-color: #ebebeb;
            width: 28%;
            font-weight: bold;
          }
          .section-title {
            font-size: 11pt;
            font-weight: bold;
            text-transform: uppercase;
            background-color: #f0f0f0;
            border-left: 4pt solid #3B6347;
            padding: 3pt 6pt;
            margin-top: 14pt;
            margin-bottom: 6pt;
          }
          .section-body {
            margin-left: 10pt;
            margin-bottom: 10pt;
            font-size: 10.5pt;
          }
          .proc-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12pt;
          }
          .proc-cell {
            border: 1pt solid #aaa;
            padding: 6pt 8pt;
            margin-bottom: 6pt;
            background-color: #fafafa;
          }
          .stage-label {
            font-weight: bold;
            font-size: 10pt;
            color: #000;
            margin-bottom: 3pt;
            text-transform: uppercase;
          }
          .sig-table {
            width: 100%;
            margin-top: 40pt;
            border-collapse: collapse;
            page-break-inside: avoid;
          }
          .sig-table td {
            width: 33.3%;
            text-align: center;
            vertical-align: top;
            padding: 0 10pt;
          }
          .sig-line {
            border-bottom: 1pt solid #000;
            height: 35pt;
            margin-bottom: 4pt;
          }
          .sig-name {
            font-weight: bold;
            font-size: 10pt;
          }
          .sig-role {
            font-size: 8.5pt;
            color: #555;
          }
        </style>
      </head>
      <body>
        <div class="deped-header">
          <h4>Republic of the Philippines • Department of Education</h4>
          <h3>Teacher Education Experiential Learning Portfolio</h3>
          <h2>SEMI-DETAILED LESSON PLAN (MATATAG / K-12 ALIGNED)</h2>
          <div class="header-line"></div>
        </div>

        <table class="meta-table">
          <tr>
            <th>Cooperating School:</th>
            <td>Mabolo National High School</td>
            <th>Grade Level &amp; Section:</th>
            <td>${this.escapeHtml(targetGrade)}</td>
          </tr>
          <tr>
            <th>Pre-Service Teacher:</th>
            <td>(Pre-Service Student Teacher)</td>
            <th>Learning Area / Subject:</th>
            <td>${this.escapeHtml(subject)}</td>
          </tr>
          <tr>
            <th>Teaching Dates &amp; Time:</th>
            <td>${this.escapeHtml(duration)}</td>
            <th>Quarter / Term:</th>
            <td>Quarter 1</td>
          </tr>
        </table>

        <!-- Curriculum Standards -->
        <table class="standards-table">
          <tr>
            <th>A. Content Standard:</th>
            <td>${this.escapeHtml(contentStd)}</td>
          </tr>
          <tr>
            <th>B. Performance Standard:</th>
            <td>${this.escapeHtml(perfStd)}</td>
          </tr>
          <tr>
            <th>C. Learning Competency &amp; MELC Code:</th>
            <td><strong>${this.escapeHtml(melcCode)}</strong></td>
          </tr>
        </table>

        <!-- Section I -->
        <div class="section-title">I. LEARNING OBJECTIVES</div>
        <div class="section-body">
          <p>${this.escapeHtml(objectives).replace(/\n/g, '<br>')}</p>
        </div>

        <!-- Section II -->
        <div class="section-title">II. SUBJECT MATTER &amp; INSTRUCTIONAL MATERIALS</div>
        <div class="section-body">
          <p><strong>Topic / Lesson Focus:</strong> ${this.escapeHtml(topic)}</p>
          <p>${this.escapeHtml(materials).replace(/\n/g, '<br>')}</p>
        </div>

        <!-- Section III -->
        ${procedureHtml}

        <!-- Section IV -->
        <div class="section-title">IV. EVALUATION / FORMATIVE ASSESSMENT</div>
        <div class="section-body">
          <p>${this.escapeHtml(evaluation).replace(/\n/g, '<br>')}</p>
        </div>

        <!-- Section V -->
        <div class="section-title">V. ASSIGNMENT / AGREEMENT</div>
        <div class="section-body">
          <p>${this.escapeHtml(assignment).replace(/\n/g, '<br>')}</p>
        </div>

        <!-- Tripartite Signatures -->
        <table class="sig-table">
          <tr>
            <td>
              <div class="sig-line"></div>
              <div class="sig-name">Pre-Service Teacher</div>
              <div class="sig-role">Prepared by (Demo Teacher)</div>
            </td>
            <td>
              <div class="sig-line"></div>
              <div class="sig-name">Cooperating Teacher (CT)</div>
              <div class="sig-role">Checked &amp; Reviewed by</div>
            </td>
            <td>
              <div class="sig-line"></div>
              <div class="sig-name">School Principal / Department Head</div>
              <div class="sig-role">Noted by</div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const cleanFilename = topic.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30) || 'DepEd_Lesson_Plan';
    const blob = new Blob([docContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cleanFilename}_Lesson_Plan.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  loadSamplePlan() {
    const sample = {
      'lp-subject': 'English 8 (Afro-Asian Literature)',
      'lp-topic': 'Determining Meaning through Context Clues',
      'lp-target-grade': 'Grade 8 - Rizal (Junior High)',
      'lp-duration': '60 Minutes • Quarter 1',
      'lp-content-standard': 'The learner demonstrates communicative competence through his/ her understanding of Afro-Asian literature and other text types for a deeper appreciation of Philippine and global cultures.',
      'lp-perf-standard': 'The learner transfers learning by composing a short reflective narrative utilizing context-appropriate vocabulary and transitional markers.',
      'lp-melc-code': 'Determine the meaning of words and expressions that reflect the local culture by noting context clues (EN8V-If-6)',
      'lp-objectives': 'At the end of this 60-minute session, 85% of the students will be able to:\n1. Identify the 4 types of context clues (definition, synonym, antonym, explanation) used in authentic sentences;\n2. Differentiate between contrasting and restatement context markers;\n3. Demonstrate active collaboration during the differentiated vocabulary group challenge.',
      'lp-materials': 'References: DepEd English 8 Curriculum Guide, Quarter 1 - Module 2.\nInstructional Materials (IMs): Printed mystery envelopes, Manila paper, color markers, slide deck, cue cards.',
      'lp-activity': '“Mystery Envelopes” Game (10 Minutes):\nStudents are grouped into 4 teams. Each team receives an envelope containing an excerpt from an Afro-Asian folktale with three bolded unfamiliar words. Groups have 4 minutes to deduce their meanings by analyzing surrounding sentence hints and present their guesses to class.',
      'lp-analysis': 'Processing & Guiding Questions (10 Minutes):\n1. What were the specific keywords in the sentences that helped you unlock the unfamiliar word?\n2. Did the sentence provide an opposite word, a definition, or an example?\n3. Why is using context clues more practical during rapid reading than stopping to look up every single word in a dictionary?',
      'lp-abstraction': 'Explicit Pedagogical Discussion (20 Minutes):\nTeacher provides clear definitions and authentic examples of the 4 Common Context Clues:\n• Definition / Restatement Clue (punctuation markers like dashes, commas, or "that is")\n• Synonym / Comparison Clue\n• Antonym / Contrast Clue (transitional signals like "however", "unlike", "whereas")\n• Cause-and-Effect / Explanation Clue\nStudents provide their own sample sentences on the board.',
      'lp-application': 'Differentiated Group Tasks (12 Minutes):\n• Group 1 (Linguistic): Compose a 4-line poem embedding 2 context clues.\n• Group 2 (Visual): Create a mini comic strip illustrating a word clue.\n• Group 3 (Practical): Formulate a short dialogue between friends solving a clue.',
      'lp-7e-elicit': 'Diagnostic prompt: Teacher asks: "Have you ever encountered a word in a book that you had never seen before? What clues in the sentence helped you guess what it meant?"',
      'lp-7e-engage': 'Show an encrypted message where 3 key words are replaced with unknown tribal words; students decipher the story using surrounding hints.',
      'lp-7e-explore': 'In pairs, students analyze 4 sample sentences on flashcards, circling the clue words and identifying the relationship.',
      'lp-7e-explain': 'Teams report their findings. Teacher introduces the formal terms: Definition, Synonym, Antonym, and Explanation clues.',
      'lp-7e-elaborate': 'Students write sentences describing their own favorite Filipino foods using antonym clues (e.g. "Unlike sweet halo-halo, sinigang is distinctly sour.").',
      'lp-7e-evaluate': '5-item formative multiple choice quiz on identifying the clue category.',
      'lp-7e-extend': 'Enrichment Journal: Find 1 unfamiliar word in your favorite song lyrics and write down how the context explains its meaning.',
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
    alert('🌿 Sample DepEd MATATAG / 4As Lesson Plan loaded! Click "📄 Export Word (.doc)" to download or "🖨️ Print / PDF" to print.');
  }
}
