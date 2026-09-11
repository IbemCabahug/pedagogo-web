/**
 * Pedagogo Desk: Field Study (FS 1 & FS 2) Guided Observation Notebook 🏫📝
 * Aligned with CHED CMO No. 74 & 75, s. 2017 & DepEd PPST Domains.
 */

export class FieldStudyNotebook {
  static STORAGE_KEY = 'pedagogo_fs_entries';

  constructor() {
    this.entries = this.loadEntries();
    this.activeFilter = 'ALL'; // ALL, FS_1, FS_2
    this.activeDomainFilter = 'ALL';

    this.container = document.getElementById('view-field-study');
    if (this.container) {
      this.render();
    }
  }

  loadEntries() {
    const saved = localStorage.getItem(FieldStudyNotebook.STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse FS entries, using starter model', e);
      }
    }
    const starter = this.getStarterEntries();
    this.saveEntries(starter);
    return starter;
  }

  saveEntries(entriesToSave = this.entries) {
    localStorage.setItem(FieldStudyNotebook.STORAGE_KEY, JSON.stringify(entriesToSave));
  }

  getStarterEntries() {
    return [
      {
        id: 'fs-model-1',
        course: 'FS_1',
        episodeTitle: 'Episode 1: The School as a Learner-Friendly Learning Environment',
        schoolName: 'Mabolo National High School',
        gradeSection: 'Grade 8 - Rizal (45 Students)',
        cooperatingTeacher: 'Mrs. Elena Cruz (Master Teacher I)',
        observationDate: new Date().toISOString().split('T')[0],
        durationHours: 3,
        ppstDomain: 'Domain 2: Learning Environment',
        guidedNotes: {
          physicalClimate: 'Classroom has natural cross-ventilation with 4 ceiling fans. Seating is arranged into 5 collaborative clusters (pods of 9). Bulletin boards display student literary outputs, class rules with positive phrasing ("We listen with care"), and an emergency evacuation map.',
          learnerEngagement: 'Learners actively raised hands during the motivational game ("Word Web"). 3 students in the back corner initially appeared disengaged, but CT relocated near their cluster and asked guiding prompt questions to re-anchor their attention.',
          teacherStrategies: 'CT used non-verbal proximity control, positive reinforcement stamps on activity sheets, and a 3-count clap routine ("1-2-Eyes on You") to smoothly transition from cluster discussion to whole-class synthesis.'
        },
        reflection: {
          description: 'Observed a 60-minute reading comprehension lesson on Philippine folklore. The physical layout strongly promoted peer scaffolding.',
          pedagogicalInsight: 'Directly confirmed Vygotsky\'s Socio-Cultural Theory and Wong\'s principle of proactive classroom routines. When rules are stated positively and routines are predictable, disciplinary friction drops to near zero.',
          futureApplication: 'In my future demonstration teaching, I will arrange student desks into collaborative learning pods rather than rigid straight rows, and establish a consistent non-verbal clapping transition cue.'
        },
        createdAt: new Date().toISOString()
      },
      {
        id: 'fs-model-2',
        course: 'FS_1',
        episodeTitle: 'Episode 2: Learner Diversity & Addressing Learning Needs',
        schoolName: 'Mabolo National High School',
        gradeSection: 'Grade 7 - Bonifacio (42 Students)',
        cooperatingTeacher: 'Mr. Roberto Tan (Teacher III)',
        observationDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
        durationHours: 3,
        ppstDomain: 'Domain 3: Diversity of Learners',
        guidedNotes: {
          physicalClimate: 'Traditional row seating, but aisles are wide and clear. Two visually impaired learners are seated in the front center row near the blackboard.',
          learnerEngagement: 'Teacher utilized multimodal presentation: oral explanation, colored chalk diagrams, and hands-on flashcards to address auditory, visual, and tactile learning modalities.',
          teacherStrategies: 'Differentiated assessment: Fast finishers were given an enrichment creative synthesis prompt while struggling learners received paired peer tutoring.'
        },
        reflection: {
          description: 'Observed how the teacher accommodated students with varying processing speeds during a grammar exercise.',
          pedagogicalInsight: 'Gardner\'s Multiple Intelligences and PPST Indicator 3.1 (Teacher addresses learner diversity through differentiated learning experiences).',
          futureApplication: 'I will prepare tiered activity sheets (Basic, Intermediate, Enrichment) for every lesson to ensure no student experiences boredom or insurmountable cognitive frustration.'
        },
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
      }
    ];
  }

  render() {
    if (!this.container) return;

    const totalHours = this.entries.reduce((sum, e) => sum + (e.durationHours || 0), 0);
    const fs1Count = this.entries.filter(e => e.course === 'FS_1').length;
    const fs2Count = this.entries.filter(e => e.course === 'FS_2').length;

    const filtered = this.entries.filter(e => {
      if (this.activeFilter !== 'ALL' && e.course !== this.activeFilter) return false;
      if (this.activeDomainFilter !== 'ALL' && !e.ppstDomain.includes(this.activeDomainFilter)) return false;
      return true;
    });

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="section-title">Field Study (FS 1 &amp; FS 2) Observation Notebook 🏫📝</h2>
          <p class="section-desc">PPST-aligned guided observation documentation for pre-service experiential learning courses.</p>
        </div>
        <div class="header-actions">
          <button class="btn-primary" id="btn-new-fs-entry">
            <span>➕ New Observation Entry</span>
          </button>
        </div>
      </div>

      <!-- Field Study Metrics Banner -->
      <div class="fs-metrics-banner">
        <div class="fs-stat-pill">
          <span class="stat-num">${totalHours}h</span>
          <span class="stat-label">Observation Hours Logged</span>
        </div>
        <div class="fs-stat-pill">
          <span class="stat-num">${fs1Count}</span>
          <span class="stat-label">FS 1 Episodes (Observation)</span>
        </div>
        <div class="fs-stat-pill">
          <span class="stat-num">${fs2Count}</span>
          <span class="stat-label">FS 2 Episodes (Assistantship)</span>
        </div>
        <div class="fs-curriculum-badge">
          <span>✓ Aligned with CHED CMO 74/75, s. 2017 &amp; PPST 7 Domains</span>
        </div>
      </div>

      <!-- Filters & Template Controls -->
      <div class="fs-control-bar">
        <div class="fs-filter-pills">
          <button class="filter-pill ${this.activeFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">All Field Studies (${this.entries.length})</button>
          <button class="filter-pill ${this.activeFilter === 'FS_1' ? 'active' : ''}" data-filter="FS_1">FS 1: Observations</button>
          <button class="filter-pill ${this.activeFilter === 'FS_2' ? 'active' : ''}" data-filter="FS_2">FS 2: Assistantship</button>
        </div>
        <div class="fs-domain-select-wrapper">
          <select id="fs-domain-filter" class="form-input-sm">
            <option value="ALL">All PPST Domains</option>
            <option value="Domain 1">Domain 1: Content Knowledge &amp; Pedagogy</option>
            <option value="Domain 2">Domain 2: Learning Environment</option>
            <option value="Domain 3">Domain 3: Diversity of Learners</option>
            <option value="Domain 4">Domain 4: Curriculum &amp; Planning</option>
            <option value="Domain 5">Domain 5: Assessment &amp; Reporting</option>
          </select>
        </div>
      </div>

      <!-- Entries Stream -->
      <div class="fs-entries-grid">
        ${filtered.map(entry => `
          <div class="fs-entry-card" id="fs-entry-${entry.id}">
            <div class="fs-entry-header">
              <div class="fs-course-badge-wrap">
                <span class="badge-category badge-${entry.course}">${entry.course === 'FS_1' ? 'FS 1 Observation' : 'FS 2 Assistantship'}</span>
                <span class="ppst-tag">${this.escapeHtml(entry.ppstDomain)}</span>
              </div>
              <span class="fs-date-badge">🗓️ ${entry.observationDate} (${entry.durationHours} hrs)</span>
            </div>

            <h3 class="fs-episode-title">${this.escapeHtml(entry.episodeTitle)}</h3>

            <div class="fs-meta-bar">
              <span>🏫 <strong>${this.escapeHtml(entry.schoolName)}</strong></span>
              <span>👥 ${this.escapeHtml(entry.gradeSection)}</span>
              <span>🧑‍🏫 CT: ${this.escapeHtml(entry.cooperatingTeacher)}</span>
            </div>

            <!-- Guided Observations Accordion Summary -->
            <div class="fs-guided-snippets">
              <div class="guided-snippet-item">
                <span class="snippet-label">🪑 Physical Climate:</span>
                <p>${this.escapeHtml(entry.guidedNotes.physicalClimate)}</p>
              </div>
              <div class="guided-snippet-item">
                <span class="snippet-label">🙋 Learner Engagement:</span>
                <p>${this.escapeHtml(entry.guidedNotes.learnerEngagement)}</p>
              </div>
              <div class="guided-snippet-item">
                <span class="snippet-label">🎯 Teacher Strategies:</span>
                <p>${this.escapeHtml(entry.guidedNotes.teacherStrategies)}</p>
              </div>
            </div>

            <!-- Gibbs Reflective Insight -->
            <div class="fs-reflection-box">
              <div class="reflection-label">💭 Pedagogical Synthesis &amp; Application</div>
              <p><strong>Theory:</strong> ${this.escapeHtml(entry.reflection.pedagogicalInsight)}</p>
              <p><strong>My Action Plan:</strong> ${this.escapeHtml(entry.reflection.futureApplication)}</p>
            </div>

            <!-- Card Actions -->
            <div class="fs-card-footer">
              <button class="btn-subtle btn-print-fs-entry" data-entry-id="${entry.id}">
                🖨️ <span>Print Sign-off Sheet</span>
              </button>
              <button class="btn-subtle-danger btn-delete-fs-entry" data-entry-id="${entry.id}" title="Delete observation log">
                ✕ Remove
              </button>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Empty State -->
      ${filtered.length === 0 ? `
        <div class="sub-card empty-tasks-state">
          <div class="empty-icon">🏫</div>
          <h4>No Field Study Entries in this Filter</h4>
          <p>Click "New Observation Entry" to document your classroom observations or assistantship tasks.</p>
        </div>
      ` : ''}
    `;

    this.bindOverviewEvents();
  }

  bindOverviewEvents() {
    document.getElementById('btn-new-fs-entry')?.addEventListener('click', () => {
      this.openNewEntryModal();
    });

    // Course filters
    document.querySelectorAll('.fs-filter-pills .filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        this.activeFilter = pill.dataset.filter;
        this.render();
      });
    });

    // Domain dropdown filter
    const domainSelect = document.getElementById('fs-domain-filter');
    if (domainSelect) {
      domainSelect.value = this.activeDomainFilter;
      domainSelect.addEventListener('change', (e) => {
        this.activeDomainFilter = e.target.value;
        this.render();
      });
    }

    // Print sign-off sheet
    document.querySelectorAll('.btn-print-fs-entry').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.entryId;
        this.printSignoffSheet(id);
      });
    });

    // Delete entry
    document.querySelectorAll('.btn-delete-fs-entry').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.entryId;
        if (confirm('Delete this Field Study observation log?')) {
          this.entries = this.entries.filter(e => e.id !== id);
          this.saveEntries();
          this.render();
        }
      });
    });
  }

  openNewEntryModal() {
    let modal = document.getElementById('fs-entry-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'fs-entry-modal';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card fs-modal-card">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <span class="modal-icon">🏫</span>
            <h3>Log Field Study Observation / Assistantship</h3>
          </div>
          <button class="modal-close" id="btn-close-fs-modal">✕</button>
        </div>

        <div class="modal-body fs-modal-scroll">
          <!-- Template Preset Selector -->
          <div class="form-group template-preset-box">
            <label>⚡ Quick Episode Template:</label>
            <div class="template-pill-group">
              <button type="button" class="btn-template-preset active" data-preset="CLIMATE">FS 1: Climate &amp; Facilities</button>
              <button type="button" class="btn-template-preset" data-preset="DIVERSITY">FS 1: Learner Diversity</button>
              <button type="button" class="btn-template-preset" data-preset="DISCIPLINE">FS 1: Classroom Management</button>
              <button type="button" class="btn-template-preset" data-preset="ASSISTANTSHIP">FS 2: IMs Assistantship</button>
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label>Course Track:</label>
              <select id="modal-fs-course" class="form-input">
                <option value="FS_1">Field Study 1 (Observations)</option>
                <option value="FS_2">Field Study 2 (Teaching Assistantship)</option>
              </select>
            </div>
            <div class="form-group">
              <label>PPST Target Domain:</label>
              <select id="modal-fs-ppst" class="form-input">
                <option value="Domain 2: Learning Environment">Domain 2: Learning Environment</option>
                <option value="Domain 3: Diversity of Learners">Domain 3: Diversity of Learners</option>
                <option value="Domain 1: Content &amp; Pedagogy">Domain 1: Content &amp; Pedagogy</option>
                <option value="Domain 4: Curriculum &amp; Planning">Domain 4: Curriculum &amp; Planning</option>
                <option value="Domain 5: Assessment &amp; Reporting">Domain 5: Assessment &amp; Reporting</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Episode Title:</label>
            <input type="text" id="modal-fs-title" class="form-input" value="Episode 1: The School as a Learner-Friendly Learning Environment">
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label>Cooperating School:</label>
              <input type="text" id="modal-fs-school" class="form-input" placeholder="e.g. Mabolo National High School">
            </div>
            <div class="form-group">
              <label>Grade &amp; Section:</label>
              <input type="text" id="modal-fs-section" class="form-input" placeholder="e.g. Grade 8 - Rizal">
            </div>
            <div class="form-group">
              <label>Cooperating Teacher (CT):</label>
              <input type="text" id="modal-fs-ct" class="form-input" placeholder="e.g. Mrs. Elena Cruz">
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label>Observation Date:</label>
              <input type="date" id="modal-fs-date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
              <label>Hours Logged:</label>
              <input type="number" id="modal-fs-hours" class="form-input" min="1" max="8" value="3">
            </div>
          </div>

          <!-- Section: Guided Observation Prompts -->
          <div class="fs-form-divider">
            <span>🔎 Guided Observation Focus</span>
          </div>

          <div class="form-group">
            <label>1. Physical Classroom Environment &amp; Layout:</label>
            <textarea id="modal-fs-climate" class="form-input" rows="2" placeholder="Ventilation, lighting, seating arrangement (clusters, rows), safety, bulletin board themes..."></textarea>
          </div>

          <div class="form-group">
            <label>2. Learner Engagement &amp; Interaction Dynamics:</label>
            <textarea id="modal-fs-engagement" class="form-input" rows="2" placeholder="Level of student participation, attention triggers, off-task behaviors, peer interactions..."></textarea>
          </div>

          <div class="form-group">
            <label>3. Teacher's Management &amp; Instructional Strategies:</label>
            <textarea id="modal-fs-strategies" class="form-input" rows="2" placeholder="Transitions, positive discipline routines, questioning methods, visual aids used..."></textarea>
          </div>

          <!-- Section: Gibbs Reflective Cycle -->
          <div class="fs-form-divider">
            <span>💭 Gibbs' Reflective Synthesis</span>
          </div>

          <div class="form-group">
            <label>Pedagogical Theory Connection (Why does this work?):</label>
            <textarea id="modal-fs-theory" class="form-input" rows="2" placeholder="Connect to Piaget, Vygotsky, Bruner, Positive Discipline, or Bloom's Taxonomy..."></textarea>
          </div>

          <div class="form-group">
            <label>Future Demonstration Teaching Application (How will I teach this?):</label>
            <textarea id="modal-fs-application" class="form-input" rows="2" placeholder="Specific routine, seating plan, or strategy you will adopt in your own classroom..."></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-subtle" id="btn-cancel-fs-modal">Cancel</button>
          <button class="btn-primary" id="btn-save-fs-modal">Save Observation Log</button>
        </div>
      </div>
    `;

    modal.classList.add('active');

    const closeModal = () => modal.classList.remove('active');
    document.getElementById('btn-close-fs-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-fs-modal')?.addEventListener('click', closeModal);

    // Preset template switching
    document.querySelectorAll('.btn-template-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-template-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const preset = btn.dataset.preset;

        const titleEl = document.getElementById('modal-fs-title');
        const courseEl = document.getElementById('modal-fs-course');
        const ppstEl = document.getElementById('modal-fs-ppst');
        const climateEl = document.getElementById('modal-fs-climate');
        const engagementEl = document.getElementById('modal-fs-engagement');
        const strategiesEl = document.getElementById('modal-fs-strategies');

        if (preset === 'CLIMATE') {
          titleEl.value = 'Episode 1: The School as a Learner-Friendly Learning Environment';
          courseEl.value = 'FS_1';
          ppstEl.value = 'Domain 2: Learning Environment';
          climateEl.placeholder = 'Natural ventilation, collaborative seating clusters, classroom safety rules...';
        } else if (preset === 'DIVERSITY') {
          titleEl.value = 'Episode 2: Learner Diversity & Accommodating Individual Needs';
          courseEl.value = 'FS_1';
          ppstEl.value = 'Domain 3: Diversity of Learners';
          engagementEl.placeholder = 'Notice varying learning styles, gender sensitivity, pacing differences...';
        } else if (preset === 'DISCIPLINE') {
          titleEl.value = 'Episode 3: Classroom Management & Positive Non-Violent Discipline';
          courseEl.value = 'FS_1';
          ppstEl.value = 'Domain 2: Learning Environment';
          strategiesEl.placeholder = 'Non-verbal cues, transition routines, restorative problem-solving...';
        } else if (preset === 'ASSISTANTSHIP') {
          titleEl.value = 'Episode 4: Assisting the Cooperating Teacher in Preparing Visual Aids';
          courseEl.value = 'FS_2';
          ppstEl.value = 'Domain 4: Curriculum & Planning';
          strategiesEl.placeholder = 'Preparing flashcards, realia, slide deck pacing, formative worksheets...';
        }
      });
    });

    // Save entry
    document.getElementById('btn-save-fs-modal')?.addEventListener('click', () => {
      const course = document.getElementById('modal-fs-course').value;
      const ppstDomain = document.getElementById('modal-fs-ppst').value;
      const episodeTitle = document.getElementById('modal-fs-title').value.trim() || 'Untitled Observation Episode';
      const schoolName = document.getElementById('modal-fs-school').value.trim() || 'Cooperating School';
      const gradeSection = document.getElementById('modal-fs-section').value.trim() || 'Grade Section';
      const cooperatingTeacher = document.getElementById('modal-fs-ct').value.trim() || 'Cooperating Teacher';
      const observationDate = document.getElementById('modal-fs-date').value;
      const durationHours = parseFloat(document.getElementById('modal-fs-hours').value) || 3;

      const physicalClimate = document.getElementById('modal-fs-climate').value.trim() || 'Desks arranged neatly with natural lighting.';
      const learnerEngagement = document.getElementById('modal-fs-engagement').value.trim() || 'Active participation observed throughout the lesson.';
      const teacherStrategies = document.getElementById('modal-fs-strategies').value.trim() || 'Proactive routines and positive verbal reinforcement.';
      const pedagogicalInsight = document.getElementById('modal-fs-theory').value.trim() || 'Reinforced learner-centered pedagogical principles.';
      const futureApplication = document.getElementById('modal-fs-application').value.trim() || 'Will integrate predictable routines in demo teaching.';

      const newEntry = {
        id: 'fs-' + Date.now(),
        course,
        episodeTitle,
        schoolName,
        gradeSection,
        cooperatingTeacher,
        observationDate,
        durationHours,
        ppstDomain,
        guidedNotes: {
          physicalClimate,
          learnerEngagement,
          teacherStrategies
        },
        reflection: {
          description: `Observed at ${schoolName} with ${gradeSection}.`,
          pedagogicalInsight,
          futureApplication
        },
        createdAt: new Date().toISOString()
      };

      this.entries.unshift(newEntry);
      this.saveEntries();
      closeModal();
      this.render();
    });
  }

  /**
   * Generates a formal, printable Field Study Verification & Sign-off sheet.
   */
  printSignoffSheet(entryId) {
    const entry = this.entries.find(e => e.id === entryId);
    if (!entry) return;

    let printContainer = document.getElementById('fs-print-signoff-sheet');
    if (!printContainer) {
      printContainer = document.createElement('div');
      printContainer.id = 'fs-print-signoff-sheet';
      printContainer.className = 'print-only-container';
      document.body.appendChild(printContainer);
    }

    printContainer.innerHTML = `
      <div class="fs-formal-print-document">
        <div class="print-header">
          <h3>Republic of the Philippines • Department of Teacher Education</h3>
          <h2>EXPERIENTIAL LEARNING COURSE OBSERVATION REPORT</h2>
          <p class="course-subtitle">${entry.course === 'FS_1' ? 'Field Study 1: Observations of Teaching-Learning in Actual School Environment' : 'Field Study 2: Participation and Teaching Assistantship'}</p>
        </div>

        <div class="print-meta-table">
          <div class="meta-row">
            <span><strong>Pre-Service Teacher:</strong> _____________________________</span>
            <span><strong>Date of Observation:</strong> ${entry.observationDate}</span>
          </div>
          <div class="meta-row">
            <span><strong>Cooperating School:</strong> ${this.escapeHtml(entry.schoolName)}</span>
            <span><strong>Duration:</strong> ${entry.durationHours} Hours Logged</span>
          </div>
          <div class="meta-row">
            <span><strong>Grade Level &amp; Section:</strong> ${this.escapeHtml(entry.gradeSection)}</span>
            <span><strong>Cooperating Teacher:</strong> ${this.escapeHtml(entry.cooperatingTeacher)}</span>
          </div>
          <div class="meta-row">
            <span><strong>Target PPST Competency:</strong> ${this.escapeHtml(entry.ppstDomain)}</span>
          </div>
        </div>

        <div class="print-section">
          <h4>I. EPISODE TITLE &amp; FOCUS</h4>
          <p><strong>${this.escapeHtml(entry.episodeTitle)}</strong></p>
        </div>

        <div class="print-section">
          <h4>II. GUIDED OBSERVATION NARRATIVE</h4>
          <div class="print-sub-block">
            <strong>A. Physical Learning Environment &amp; Classroom Setup:</strong>
            <p>${this.escapeHtml(entry.guidedNotes.physicalClimate)}</p>
          </div>
          <div class="print-sub-block">
            <strong>B. Learner Engagement &amp; Interaction Dynamics:</strong>
            <p>${this.escapeHtml(entry.guidedNotes.learnerEngagement)}</p>
          </div>
          <div class="print-sub-block">
            <strong>C. Teacher's Management &amp; Instructional Delivery:</strong>
            <p>${this.escapeHtml(entry.guidedNotes.teacherStrategies)}</p>
          </div>
        </div>

        <div class="print-section">
          <h4>III. GIBBS' REFLECTIVE SYNTHESIS &amp; PEDAGOGICAL INSIGHT</h4>
          <p><strong>Educational Theory Connection:</strong> ${this.escapeHtml(entry.reflection.pedagogicalInsight)}</p>
          <p><strong>Future Demonstration Teaching Action Plan:</strong> ${this.escapeHtml(entry.reflection.futureApplication)}</p>
        </div>

        <div class="print-signatures-block">
          <div class="signature-col">
            <div class="sig-line"></div>
            <p class="sig-name">Pre-Service Teacher (Observer)</p>
            <p class="sig-title">Date Signed: _______________</p>
          </div>
          <div class="signature-col">
            <div class="sig-line"></div>
            <p class="sig-name">${this.escapeHtml(entry.cooperatingTeacher)}</p>
            <p class="sig-title">Cooperating Teacher (CT)</p>
          </div>
          <div class="signature-col">
            <div class="sig-line"></div>
            <p class="sig-name">College Field Study Supervisor</p>
            <p class="sig-title">University Faculty In-Charge</p>
          </div>
        </div>
      </div>
    `;

    document.body.classList.add('printing-fs-sheet');
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-fs-sheet');
    }, { once: true });

    window.print();
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
