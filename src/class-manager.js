/**
 * Pedagogo Desk: Classroom & Learner Management Engine 🌿
 * 
 * Provides local-first, zero-cost classroom management tailored for Pre-Service Teachers:
 * - Classroom & Section Profiles (Subject, Section, School Year, Term, Room, Color)
 * - Normalized Student Masterlist (with optional LRN, Biometric/RFID ID, Pedagogical Tags)
 * - ClassEnrollment junction table
 * - 🇵🇭 DepEd School Form 1 (SF1) Sorting (Boys alphabetically, then Girls alphabetically)
 * - 📋 Smart Bulk Roster Importer (Parses raw pasted text from Messenger/Word/Excel)
 * - 🖨️ Printable Clipboard Attendance & Recitation Masterlist
 */

export class ClassManager {
  constructor() {
    this.storageKeys = {
      classes: 'pedagogo_classrooms',
      students: 'pedagogo_students',
      enrollments: 'pedagogo_enrollments'
    };

    this.classes = this.load(this.storageKeys.classes, null);
    this.students = this.load(this.storageKeys.students, null);
    this.enrollments = this.load(this.storageKeys.enrollments, null);

    // If first time launching, seed with realistic pre-service teacher demo data
    if (!this.classes || !this.students || !this.enrollments) {
      this.seedInitialData();
    }

    this.selectedClassId = this.classes.length > 0 ? this.classes[0].id : null;
    this.sf1SortActive = true; // Default to DepEd SF1 standard
  }

  load(key, fallback) {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`Failed to parse ${key}`, e);
      return fallback;
    }
  }

  save() {
    localStorage.setItem(this.storageKeys.classes, JSON.stringify(this.classes));
    localStorage.setItem(this.storageKeys.students, JSON.stringify(this.students));
    localStorage.setItem(this.storageKeys.enrollments, JSON.stringify(this.enrollments));
  }

  seedInitialData() {
    const classId = 'cls_' + Date.now();
    this.classes = [
      {
        id: classId,
        subjectCode: 'EDUC 101',
        subjectTitle: 'Introduction to Teaching',
        sectionName: 'Section 2A',
        gradeLevel: 'College 2nd Year',
        schoolYear: '2026–2027',
        term: '1st Semester',
        schoolName: 'College of Teacher Education',
        room: 'Room 204',
        colorHex: '#3B6347',
        createdAt: new Date().toISOString()
      },
      {
        id: 'cls_demo_fs2',
        subjectCode: 'ENG 8',
        subjectTitle: 'English Communication & Literature',
        sectionName: 'Grade 8 - Rizal',
        gradeLevel: 'Junior High School',
        schoolYear: '2026–2027',
        term: 'Quarter 1',
        schoolName: 'Mabolo National High School (Cooperating School)',
        room: 'Building B - Room 102',
        colorHex: '#BF5F3E',
        createdAt: new Date().toISOString()
      }
    ];

    // Seed realistic student cohort with diverse pedagogical accommodation tags
    const sampleStudents = [
      // Male learners
      { lastName: 'Abad', firstName: 'Joshua', middleInitial: 'M.', gender: 'Male', lrn: '109823451001', notes: 'Visual Learner • High Recitation Potential' },
      { lastName: 'Bautista', firstName: 'Carl Gabriel', middleInitial: 'R.', gender: 'Male', lrn: '109823451002', notes: 'Prefers diagrammatic notes • Sits Front Row' },
      { lastName: 'Dela Cruz', firstName: 'Mark Angelo', middleInitial: 'S.', gender: 'Male', lrn: '109823451003', notes: 'Auditory learner • Enthusiastic group leader' },
      { lastName: 'Mercado', firstName: 'Rafael', middleInitial: 'T.', gender: 'Male', lrn: '109823451004', notes: 'Kinesthetic • Needs frequent engagement checks' },
      { lastName: 'Villanueva', firstName: 'Ethan James', middleInitial: 'P.', gender: 'Male', lrn: '109823451005', notes: 'Soft-spoken • Excels in written reflections' },

      // Female learners
      { lastName: 'Aquino', firstName: 'Princess Sarah', middleInitial: 'B.', gender: 'Female', lrn: '109823451006', notes: 'Active listener • Peer tutor for literature' },
      { lastName: 'Castro', firstName: 'Beatriz Maria', middleInitial: 'L.', gender: 'Female', lrn: '109823451007', notes: 'Creative thinker • Strong graphic organizer skills' },
      { lastName: 'Flores', firstName: 'Hannah Nicole', middleInitial: 'C.', gender: 'Female', lrn: '109823451008', notes: 'Sits near board for visual accommodation' },
      { lastName: 'Reyes', firstName: 'Danielle Joy', middleInitial: 'D.', gender: 'Female', lrn: '109823451009', notes: 'Consistent homework completer • Calm presence' },
      { lastName: 'Santos', firstName: 'Alyssa Mae', middleInitial: 'G.', gender: 'Female', lrn: '109823451010', notes: 'Confident speaker • Facilitator during 4As activity' }
    ];

    this.students = [];
    this.enrollments = [];

    sampleStudents.forEach((st, idx) => {
      const studentId = 'stu_' + (idx + 1);
      this.students.push({
        id: studentId,
        lastName: st.lastName,
        firstName: st.firstName,
        middleInitial: st.middleInitial,
        gender: st.gender,
        lrn: st.lrn,
        biometricId: '', // Optional ZKTeco fingerprint ID
        rfidTag: '',     // Optional RFID badge serial
        pedagogicalNotes: st.notes,
        contactNumber: '',
        createdAt: new Date().toISOString()
      });

      // Enroll in EDUC 101
      this.enrollments.push({
        id: 'enr_' + (idx + 1),
        classId: classId,
        studentId: studentId,
        seatNumber: idx + 1,
        status: 'Active',
        enrolledAt: new Date().toISOString()
      });

      // Also enroll the first 6 in Grade 8 - Rizal demo
      if (idx < 6) {
        this.enrollments.push({
          id: 'enr_fs_' + (idx + 1),
          classId: 'cls_demo_fs2',
          studentId: studentId,
          seatNumber: idx + 1,
          status: 'Active',
          enrolledAt: new Date().toISOString()
        });
      }
    });

    this.save();
  }

  // --- Classroom Management ---

  getAllClassrooms() {
    return this.classes;
  }

  getClassroom(classId) {
    return this.classes.find(c => c.id === classId) || null;
  }

  addClassroom(data) {
    const newClass = {
      id: 'cls_' + Date.now(),
      subjectCode: data.subjectCode?.trim() || 'NEW SUBJ',
      subjectTitle: data.subjectTitle?.trim() || 'Untitled Class',
      sectionName: data.sectionName?.trim() || 'Section 1',
      gradeLevel: data.gradeLevel?.trim() || '',
      schoolYear: data.schoolYear?.trim() || '2026–2027',
      term: data.term?.trim() || '1st Semester',
      schoolName: data.schoolName?.trim() || '',
      room: data.room?.trim() || '',
      colorHex: data.colorHex || '#3B6347',
      createdAt: new Date().toISOString()
    };
    this.classes.unshift(newClass);
    this.save();
    this.selectedClassId = newClass.id;
    return newClass;
  }

  updateClassroom(id, data) {
    const idx = this.classes.findIndex(c => c.id === id);
    if (idx === -1) return null;
    this.classes[idx] = {
      ...this.classes[idx],
      ...data,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.classes[idx];
  }

  deleteClassroom(id) {
    this.classes = this.classes.filter(c => c.id !== id);
    // Cascade remove enrollments
    this.enrollments = this.enrollments.filter(e => e.classId !== id);
    this.save();
    if (this.selectedClassId === id) {
      this.selectedClassId = this.classes.length > 0 ? this.classes[0].id : null;
    }
  }

  // --- Student & Enrollment Operations ---

  getEnrolledStudents(classId, applySf1Sort = this.sf1SortActive) {
    const classEnrollments = this.enrollments.filter(e => e.classId === classId);
    const studentMap = new Map(this.students.map(s => [s.id, s]));

    let enrolled = classEnrollments
      .map(enr => {
        const student = studentMap.get(enr.studentId);
        if (!student) return null;
        return {
          ...student,
          enrollmentId: enr.id,
          seatNumber: enr.seatNumber,
          status: enr.status
        };
      })
      .filter(Boolean);

    if (applySf1Sort) {
      // DepEd SF1 Ordering: All Males alphabetically by lastName, then all Females alphabetically
      const males = enrolled.filter(s => s.gender === 'Male').sort(this.compareAlphabetical);
      const females = enrolled.filter(s => s.gender === 'Female').sort(this.compareAlphabetical);
      const others = enrolled.filter(s => s.gender !== 'Male' && s.gender !== 'Female').sort(this.compareAlphabetical);
      return {
        all: [...males, ...females, ...others],
        males,
        females,
        others
      };
    }

    return {
      all: enrolled.sort(this.compareAlphabetical),
      males: enrolled.filter(s => s.gender === 'Male'),
      females: enrolled.filter(s => s.gender === 'Female'),
      others: []
    };
  }

  compareAlphabetical(a, b) {
    const nameA = `${a.lastName || ''} ${a.firstName || ''}`.trim().toLowerCase();
    const nameB = `${b.lastName || ''} ${b.firstName || ''}`.trim().toLowerCase();
    return nameA.localeCompare(nameB);
  }

  addStudentToClass(classId, studentData) {
    const studentId = 'stu_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const newStudent = {
      id: studentId,
      lastName: studentData.lastName?.trim() || '',
      firstName: studentData.firstName?.trim() || '',
      middleInitial: studentData.middleInitial?.trim() || '',
      gender: studentData.gender || 'Male',
      lrn: studentData.lrn?.trim() || '',
      biometricId: studentData.biometricId?.trim() || '',
      rfidTag: studentData.rfidTag?.trim() || '',
      pedagogicalNotes: studentData.pedagogicalNotes?.trim() || '',
      contactNumber: studentData.contactNumber?.trim() || '',
      createdAt: new Date().toISOString()
    };

    this.students.push(newStudent);

    const newEnrollment = {
      id: 'enr_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      classId: classId,
      studentId: studentId,
      seatNumber: null,
      status: 'Active',
      enrolledAt: new Date().toISOString()
    };

    this.enrollments.push(newEnrollment);
    this.save();
    return newStudent;
  }

  updateStudent(studentId, data) {
    const idx = this.students.findIndex(s => s.id === studentId);
    if (idx === -1) return null;
    this.students[idx] = {
      ...this.students[idx],
      ...data,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.students[idx];
  }

  removeStudentFromClass(classId, studentId) {
    this.enrollments = this.enrollments.filter(e => !(e.classId === classId && e.studentId === studentId));
    this.save();
  }

  // --- Smart Bulk Roster Parser ---

  /**
   * Intelligently parses raw text pasted from Messenger, Excel, Word, or Google Sheets.
   * Handles:
   * - Numbering ("1.", "1)", "1 -")
   * - Gender headers ("MALE", "BOYS", "FEMALE", "GIRLS")
   * - Comma separated ("Lastname, Firstname M.")
   * - Space separated ("Firstname Lastname")
   * - Bracketed notes or LRNs
   */
  parseBulkRosterText(rawText, defaultGender = 'Male') {
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed = [];
    let currentGender = defaultGender;

    for (let line of lines) {
      const upper = line.toUpperCase();
      // Check for gender section demarcators
      if (upper === 'MALE' || upper === 'MALES' || upper === 'BOYS' || upper === 'BOY') {
        currentGender = 'Male';
        continue;
      }
      if (upper === 'FEMALE' || upper === 'FEMALES' || upper === 'GIRLS' || upper === 'GIRL') {
        currentGender = 'Female';
        continue;
      }

      // Clean leading indices like "1.", "1)", "1 - ", "01."
      let clean = line.replace(/^\d+[\.\)\-:\s]+/, '').trim();
      if (!clean) continue;

      // Extract bracketed annotations if any (e.g., "[Visual]", "(LRN: 102938)")
      let notes = '';
      let lrn = '';
      const bracketMatch = clean.match(/[\(\[](.*?)[\)\]]/);
      if (bracketMatch) {
        const annotation = bracketMatch[1];
        if (annotation.toLowerCase().includes('lrn')) {
          lrn = annotation.replace(/[^0-9]/g, '');
        } else {
          notes = annotation;
        }
        clean = clean.replace(bracketMatch[0], '').trim();
      }

      let lastName = '';
      let firstName = '';
      let middleInitial = '';

      if (clean.includes(',')) {
        // "Lastname, Firstname M." format
        const parts = clean.split(',').map(p => p.trim());
        lastName = parts[0] || '';
        const firstParts = (parts[1] || '').split(/\s+/);
        if (firstParts.length > 1 && firstParts[firstParts.length - 1].length <= 2) {
          middleInitial = firstParts.pop().replace('.', '') + '.';
        }
        firstName = firstParts.join(' ');
      } else if (clean.includes('\t')) {
        // Tab-separated from Excel (e.g., LastName \t FirstName)
        const parts = clean.split('\t').map(p => p.trim());
        lastName = parts[0] || '';
        firstName = parts[1] || '';
        if (parts[2]) middleInitial = parts[2];
      } else {
        // "Firstname Lastname" format
        const parts = clean.split(/\s+/);
        if (parts.length === 1) {
          firstName = parts[0];
          lastName = '';
        } else if (parts.length === 2) {
          firstName = parts[0];
          lastName = parts[1];
        } else {
          lastName = parts.pop();
          if (parts[parts.length - 1].length <= 2) {
            middleInitial = parts.pop().replace('.', '') + '.';
          }
          firstName = parts.join(' ');
        }
      }

      if (firstName || lastName) {
        parsed.push({
          lastName,
          firstName,
          middleInitial,
          gender: currentGender,
          lrn,
          pedagogicalNotes: notes || 'Pasted from roster'
        });
      }
    }

    return parsed;
  }

  importBulkStudents(classId, parsedStudents) {
    let count = 0;
    parsedStudents.forEach(st => {
      this.addStudentToClass(classId, st);
      count++;
    });
    return count;
  }
}
