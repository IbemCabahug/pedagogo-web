/**
 * Pedagogo Desk: Academic Task & IMs Prep Studio with Mindful Study Companion 🌿
 * 
 * Tailored specifically for the undergraduate life of an Education Student:
 * - Categories: IMs & Visual Aids, Field Study Reflections, Demo Rehearsal, Exam & Theory Readings
 * - Materials checklist tracking for hands-on teaching aids
 * - Mindful Focus Timer (25 min Focus / 5 min Rest)
 * - Procedural Web Audio Ambient Sound (Gentle Rain / Peaceful Hum - 100% on-device, zero assets)
 * - 1-minute Centering Breathing Guide
 */

export class TaskStudio {
  constructor() {
    this.storageKey = 'pedagogo_academic_tasks';
    this.tasks = this.loadTasks();

    if (!this.tasks || this.tasks.length === 0) {
      this.seedInitialTasks();
    }

    this.activeFilter = 'ALL';
    this.selectedTaskIdForFocus = this.tasks.length > 0 ? this.tasks[0].id : null;

    // Timer State (25 minutes default)
    this.timerDuration = 25 * 60;
    this.timerRemaining = this.timerDuration;
    this.timerInterval = null;
    this.isTimerRunning = false;
    this.timerMode = 'FOCUS'; // 'FOCUS' or 'BREAK'

    // Web Audio Synthesizer for Ambient Sound & Chimes
    this.audioCtx = null;
    this.ambientSource = null;
    this.ambientGain = null;
    this.currentAmbientMode = 'OFF'; // 'OFF', 'RAIN', 'BREEZE'

    // Breathing guide state
    this.breathingActive = false;
    this.breathingSeconds = 60;
    this.breathingInterval = null;
  }

  loadTasks() {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to parse academic tasks', e);
      return null;
    }
  }

  saveTasks() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.tasks));
  }

  seedInitialTasks() {
    this.tasks = [
      {
        id: 'task_' + Date.now() + '_1',
        title: 'Craft 4As Chart & Motivation Flashcards for Demo Teaching',
        subjectCode: 'ENG 302',
        category: 'IMS_PREP',
        dueDate: this.getRelativeDate(1), // Tomorrow
        estimatedMinutes: 60,
        materials: ['Manila paper / Cartolina', 'Double-sided tape', 'Permanent markers', 'Flashcard cards'],
        notes: 'Prepare visual aid for the literature lesson "The Centipede". Include color-coded Activity and Analysis charts.',
        completed: false,
        completedAt: null,
        createdAt: new Date().toISOString()
      },
      {
        id: 'task_' + Date.now() + '_2',
        title: 'Write FS 1 Episode 2 Reflection: Observing Diverse Learners in Grade 6',
        subjectCode: 'FS 1',
        category: 'REFLECTION',
        dueDate: this.getRelativeDate(2),
        estimatedMinutes: 45,
        materials: ['Observation notebook', 'PPST Domain 3 guide'],
        notes: 'Reflect on how Cooperating Teacher accommodates auditory vs visual learners in Grade 6 - Mabolo Elem.',
        completed: false,
        completedAt: null,
        createdAt: new Date().toISOString()
      },
      {
        id: 'task_' + Date.now() + '_3',
        title: 'Rehearse 15-Minute Micro-Teaching Hook with Timer',
        subjectCode: 'ENG 302',
        category: 'DEMO_REHEARSAL',
        dueDate: this.getRelativeDate(3),
        estimatedMinutes: 30,
        materials: ['Timer / Stopwatch', 'Printed Lesson Plan', 'Props bag'],
        notes: 'Practice eye contact, voice modulation, and clear instruction delivery within the 15-minute time cap.',
        completed: false,
        completedAt: null,
        createdAt: new Date().toISOString()
      },
      {
        id: 'task_' + Date.now() + '_4',
        title: 'Review Constructivism: Piaget Cognitive Stages vs. Vygotsky ZPD',
        subjectCode: 'ED 204',
        category: 'EXAM_READING',
        dueDate: this.getRelativeDate(4),
        estimatedMinutes: 50,
        materials: ['Prof Ed textbook', 'Highlighter', 'Summary matrix'],
        notes: 'Key focus on Scaffolding, Assimilation/Accommodation, and implications for learner-centered teaching.',
        completed: true,
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }
    ];
    this.saveTasks();
  }

  getRelativeDate(daysAhead) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  }

  // --- Task CRUD ---

  getAllTasks() {
    return this.tasks;
  }

  getFilteredTasks() {
    if (this.activeFilter === 'ALL') {
      return this.tasks;
    }
    return this.tasks.filter(t => t.category === this.activeFilter);
  }

  addTask(data) {
    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      title: data.title?.trim() || 'Untitled Academic Task',
      subjectCode: data.subjectCode?.trim() || 'GENERAL',
      category: data.category || 'IMS_PREP',
      dueDate: data.dueDate || this.getRelativeDate(1),
      estimatedMinutes: parseInt(data.estimatedMinutes, 10) || 30,
      materials: Array.isArray(data.materials) ? data.materials : this.parseMaterialsString(data.materials),
      notes: data.notes?.trim() || '',
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString()
    };
    this.tasks.unshift(newTask);
    this.saveTasks();
    if (!this.selectedTaskIdForFocus) {
      this.selectedTaskIdForFocus = newTask.id;
    }
    return newTask;
  }

  updateTask(id, data) {
    const idx = this.tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    this.tasks[idx] = {
      ...this.tasks[idx],
      ...data,
      materials: Array.isArray(data.materials) ? data.materials : this.parseMaterialsString(data.materials),
      updatedAt: new Date().toISOString()
    };
    this.saveTasks();
    return this.tasks[idx];
  }

  toggleTaskCompletion(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return null;
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    this.saveTasks();
    return task;
  }

  deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.saveTasks();
    if (this.selectedTaskIdForFocus === id) {
      this.selectedTaskIdForFocus = this.tasks.length > 0 ? this.tasks[0].id : null;
    }
  }

  parseMaterialsString(str) {
    if (!str) return [];
    if (Array.isArray(str)) return str;
    return str.split(/[,\n•;]+/).map(s => s.trim()).filter(Boolean);
  }

  // --- Mindful Focus Timer ---

  setTimerMode(mode) {
    this.timerMode = mode;
    this.timerDuration = mode === 'FOCUS' ? 25 * 60 : 5 * 60;
    this.timerRemaining = this.timerDuration;
    this.isTimerRunning = false;
    clearInterval(this.timerInterval);
    this.timerInterval = null;
  }

  startTimer(onTick, onComplete) {
    if (this.isTimerRunning) return;
    this.isTimerRunning = true;
    this.playSoftChime(528); // 528 Hz Solfeggio clarity frequency

    this.timerInterval = setInterval(() => {
      if (this.timerRemaining > 0) {
        this.timerRemaining--;
        if (onTick) onTick(this.timerRemaining, this.timerDuration);
      } else {
        this.pauseTimer();
        this.playSoftChime(432); // 432 Hz Calm completion chime
        if (onComplete) onComplete(this.timerMode);
      }
    }, 1000);
  }

  pauseTimer() {
    this.isTimerRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  resetTimer() {
    this.pauseTimer();
    this.timerRemaining = this.timerDuration;
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // --- Procedural Web Audio Ambient Sound Generator ---

  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playSoftChime(freq = 528) {
    try {
      this.initAudio();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.audioCtx.currentTime + 1.2);

      gain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, this.audioCtx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 2.5);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 2.6);
    } catch (e) {
      console.log('Audio chime unavailable', e);
    }
  }

  toggleAmbient(mode) {
    this.initAudio();

    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
        this.ambientSource.disconnect();
      } catch (e) {
        // Source already stopped
      }
      this.ambientSource = null;
    }

    if (mode === 'OFF' || this.currentAmbientMode === mode) {
      this.currentAmbientMode = 'OFF';
      return 'OFF';
    }

    this.currentAmbientMode = mode;

    // Generate 4 seconds of seamless pink/white noise buffer for rain/breeze
    const bufferSize = this.audioCtx.sampleRate * 3;
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (mode === 'RAIN') {
        // Pink noise approximation for rain drops
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      } else {
        // Soft wind / breeze with low-pass roll-off
        b0 = 0.98 * b0 + white * 0.08;
        output[i] = b0 * 0.06;
      }
    }

    this.ambientSource = this.audioCtx.createBufferSource();
    this.ambientSource.buffer = noiseBuffer;
    this.ambientSource.loop = true;

    // Filter to make it silky and non-harsh
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = mode === 'RAIN' ? 'lowpass' : 'bandpass';
    filter.frequency.value = mode === 'RAIN' ? 900 : 450;
    filter.Q.value = 1.0;

    this.ambientGain = this.audioCtx.createGain();
    this.ambientGain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);

    this.ambientSource.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(this.audioCtx.destination);

    this.ambientSource.start();
    return this.currentAmbientMode;
  }
}
