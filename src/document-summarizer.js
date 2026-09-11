/**
 * Pedagogo Desk: Pedagogical Document Summarizer & AI Engine 🧠🌿
 * Grounded in Cognitive Psychology & Learning Sciences:
 * 1. Cornell Synthesis Header (Pauk, Cornell University)
 * 2. Structured Concept Chunks (Sweller's Cognitive Load Theory)
 * 3. "Teach It Simply" Classroom Analogy (Dunlosky et al. / Feynman Technique)
 * 4. Contrastive Analysis Matrix (Gentner's Structure-Mapping Theory)
 * 5. Licensure (LET) Retrieval Practice (Roediger & Karpicke Testing Effect)
 */

export class DocumentSummarizer {
  static STORAGE_KEY = 'pedagogo_gemini_key';

  static getApiKey() {
    return localStorage.getItem(this.STORAGE_KEY) || '';
  }

  static setApiKey(key) {
    if (key) {
      localStorage.setItem(this.STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  static hasApiKey() {
    const key = this.getApiKey();
    return Boolean(key && key.length > 10);
  }

  /**
   * Research-grounded system prompt engineered specifically for pre-service teachers
   */
  static getSystemPrompt() {
    return `You are Pedagogo AI, a world-class cognitive learning specialist and master teacher educator.
Your mission is to transform dense educational, academic, and pedagogical reading materials (curriculum guides, textbook chapters, developmental theories, DepEd orders, or lecture slides) into an exemplary, high-retention study guide for pre-service teachers and education students.

You MUST structure your response into EXACTLY five markdown sections, adhering strictly to the research-backed frameworks below:

### 1. 🎓 Cornell Synthesis & Active Cues
*Grounded in Walter Pauk's Cornell System for spatial metacognition and post-reading recall.*
- **Macro-Synthesis (2–3 sentences):** Distill the central premise, purpose, and enduring understanding of the text.
- **Active Recall Cue Questions:** List 3 high-leverage trigger questions that test deep comprehension (not trivial factoids).

### 2. 🧩 Structured Concept Chunks
*Grounded in John Sweller's Cognitive Load Theory (1988).*
- Break down the core principles into 3 to 5 digestible thematic chunks.
- Use **bolded keywords** and concise, structured bullet points to minimize extraneous cognitive load.
- If applicable, explicitly note the Bloom's Taxonomy cognitive domain or curriculum alignment (DepEd K-12/MATATAG, CHED).

### 3. 🧑‍🏫 "Teach It Simply" (Classroom Translation)
*Grounded in Dunlosky et al. (2013) on Elaborative Interrogation and the Feynman Technique.*
- **In Plain Words:** Explain the core idea without high-brow academic jargon, as if explaining to a curious high school student or intern peer.
- **The Concrete Analogy:** Provide a relatable, real-world metaphor or classroom scenario that makes the abstract concept unforgettable.
- **Novice Misconception Alert:** Point out the common mistake or misconception pre-service teachers make about this topic.

### 4. ⚖️ Contrastive Analysis Matrix
*Grounded in Dedre Gentner's Structure-Mapping Theory (1983) and Bransford et al. (How People Learn).*
- Automatically identify the opposing, complementary, or contrasting concepts within the text (e.g., Theory A vs. Theory B, Formative vs. Summative, Inductive vs. Deductive, Teacher-Centered vs. Learner-Centered).
- Present a Markdown comparison table contrasting them across alignable dimensions:
  | Comparison Dimension | Concept / Approach A | Concept / Approach B |
  | :--- | :--- | :--- |
  | **Core Premise** | ... | ... |
  | **Teacher's Role** | ... | ... |
  | **Student's Activity** | ... | ... |
  | **Authentic Classroom Example**| ... | ... |
  | **When to Use** | ... | ... |

### 5. 🎯 Licensure (LET) Retrieval Practice Checkpoint
*Grounded in Roediger & Karpicke (2006) on the Testing Effect and Active Retrieval.*
- Generate 3 scenario-based multiple choice questions modeled after actual Professional Education (ProfEd) Licensure Examination for Teachers (LET) questions.
- Format each question cleanly:
  **Question 1:** [Scenario-based stem]
  - A) [Option]
  - B) [Option]
  - C) [Option]
  - D) [Option]
  - **Correct Answer:** [Letter]
  - **Pedagogical Rationalization:** [Clear explanation of why this answer is correct and why common distractors are incorrect based on pedagogical principles].

Maintain a warm, encouraging, and academically rigorous tone throughout.`;
  }

  /**
   * Run pedagogical analysis on extracted text using Google Gemini Flash API.
   * If no key is set or offline demo is requested, returns pre-computed research sample.
   */
  static async summarize(extractedDoc) {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      // Return sample matching the document or standard educational sample
      return this.generateFallbackAnalysis(extractedDoc);
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    // Format prompt with verbatim document contents
    const promptPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${this.getSystemPrompt()}\n\nHere is the document to analyze:\n**Document Title:** ${extractedDoc.filename} (${extractedDoc.fileType})\n\n**Verbatim Text:**\n${extractedDoc.rawText.slice(0, 80000)}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.95,
        maxOutputTokens: 4096
      }
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promptPayload)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${response.status} ${response.statusText}`;
        throw new Error(`Gemini API Error: ${errMsg}`);
      }

      const data = await response.json();
      const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        throw new Error('Gemini API returned an empty response. Please verify your prompt or try again.');
      }

      return {
        source: 'GEMINI_API',
        markdown: generatedText,
        analyzedAt: new Date().toISOString()
      };
    } catch (err) {
      console.warn('Gemini API request failed, falling back to educational sample engine:', err);
      // If user provided an invalid key, rethrow with friendly guidance
      if (err.message.includes('API_KEY_INVALID') || err.message.includes('API key not valid')) {
        throw new Error('Your Google Gemini API Key appears to be invalid. Please check your key in Settings or test with our built-in Sample Document.');
      }
      throw err;
    }
  }

  /**
   * Pre-computed, research-grade sample analyses for immediate zero-config demonstration.
   */
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
- **Macro-Synthesis:** While both Piaget and Vygotsky agree that learners construct their own understanding rather than passively receiving data, Piaget argues that **biological maturation precedes learning** through internal equilibration, whereas Vygotsky proves that **social and cultural interaction precedes and pulls cognitive development forward**.
- **Active Recall Cue Questions:**
  1. *What distinguishes Piaget's concept of assimilation from accommodation during cognitive disequilibrium?*
  2. *How does Vygotsky's Zone of Proximal Development (ZPD) transform the traditional teacher-centered classroom into a collaborative learning environment?*
  3. *Why is language considered the primary psychological tool in Vygotskian cognitive development?*

---

### 2. 🧩 Structured Concept Chunks
- **Piagetian Cognitive Constructivism:**
  - **Schema & Equilibration:** Mental filing cabinets reorganized via *Assimilation* (fitting new data into existing boxes) and *Accommodation* (building new boxes).
  - **Development Precedes Learning:** Biological readiness is an absolute prerequisite; pushing formal logic onto a preoperational child causes rote compliance rather than true cognitive assimilation.
- **Vygotskian Socio-Cultural Constructivism:**
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
| **Primary Driver of Growth** | Individual exploration & biological maturation | Social interaction, dialogue, & cultural tools |
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
- **Pedagogical Rationalization:** Joshua's ability to solve the problem with guided peer collaboration that he could not solve alone perfectly exemplifies performance within the Zone of Proximal Development (ZPD). Option A is Piagetian and biologically inappropriate for an 8-year-old.

**Question 2:** In an elementary science class, Teacher Ben introduces the concept of mammals. A student insists that whales cannot be mammals because "they live in water like fish." Teacher Ben then shows a video explaining that whales breathe air and nurse their young, causing the student to adjust their mental definition of mammals. In Piaget's terminology, what process just took place?
- A) Assimilation
- B) Accommodation
- C) Object Permanence
- D) Classical Conditioning
- **Correct Answer:** **B**
- **Pedagogical Rationalization:** Accommodation occurs when a learner modifies an existing schema (or creates a new one) because new conflicting information cannot fit into the current framework. Assimilation (A) would only apply if the new fact fit without changing the category rule.

**Question 3:** Which teaching practice reflects a misinterpretation of Jerome Bruner's concept of educational scaffolding?
- A) Providing sentence frames during an essay pre-writing session.
- B) Modeling the first problem on the board before asking students to try problem two.
- C) Keeping permanent cue cards taped to student desks throughout the entire school year.
- D) Gradually withdrawing graphic organizers as students demonstrate mastery.
- **Correct Answer:** **C**
- **Pedagogical Rationalization:** The fundamental pedagogical criterion of scaffolding is that it is **temporary** and intentionally dismantled as learner independence increases. Leaving permanent cue cards (C) creates learned helplessness rather than true cognitive autonomy.`
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
- **Macro-Synthesis:** DepEd Order No. 40, s. 2012 establishes an unequivocal **zero-tolerance mandate against child abuse, exploitation, and corporal punishment** in Philippine schools, institutionalizing school-level Child Protection Committees (CPCs) and requiring educators to practice proactive, positive discipline.
- **Active Recall Cue Questions:**
  1. *What specific practices constitute illegal corporal punishment under DepEd regulations?*
  2. *Who are the mandatory multi-sectoral members of a school's Child Protection Committee (CPC)?*
  3. *How does positive discipline distinguish between managing behavior and inflicting punitive humiliation?*

---

### 2. 🧩 Structured Concept Chunks
- **Zero-Tolerance Stance:**
  - Absolute prohibition of corporal punishment, harsh verbal reprimands, and discriminatory practices across all public and private basic education institutions.
- **Child Protection Committee (CPC) Structure:**
  - Chaired by School Head, joined by Guidance Counselor/Designee, Faculty Rep, PTA President, Barangay Council Rep, and Supreme Pupil/Student Government President.
- **Positive Non-Violent Discipline:**
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
| **Underlying Motivation** | Driven by teacher frustration, anger, or coercion | Driven by teaching self-regulation and empathy |
| **Learner's Emotional State** | Fear, shame, resentment, avoidance | Felt safety, accountability, mutual respect |
| **Long-Term Behavioral Impact** | Increases aggression and covert misbehavior | Develops internal moral compass and self-control |
| **DepEd Administrative Status** | **Strictly prohibited; grounds for dismissal** | **Mandated professional standard (PPST Domain 2)** |
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
- **Pedagogical Rationalization:** The Child Protection Committee operates at the school-community level and includes the School Head, Guidance Counselor, Faculty Representative, PTA President, Barangay Council Representative, and Student Council President. High-level political officials like the Mayor or Congressman (C) are not part of the school CPC.`
      }
    ];
  }

  static generateFallbackAnalysis(extractedDoc) {
    const samples = this.getBuiltinSamples();
    const matched = samples.find(s => s.title.toLowerCase().includes(extractedDoc.filename.toLowerCase())) || samples[0];

    return {
      source: 'LOCAL_PEDAGOGICAL_ENGINE',
      markdown: matched.synthesis,
      analyzedAt: new Date().toISOString()
    };
  }
}
