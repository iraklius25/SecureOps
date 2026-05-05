# ISO/IEC 42001:2023 Implementation Guide
### Using SecureOps to Build Your AI Management System (AIMS)

---

## What This Guide Covers

ISO/IEC 42001:2023 is the international standard for AI Management Systems. It requires your organization to govern AI responsibly across its full lifecycle — from design through deployment, monitoring, and retirement.

This guide maps every clause and Annex A control to a concrete action inside SecureOps. Follow the phases in order. Each phase builds on the last.

---

## Phase 1 — Establish the Foundation (Clause 4)

**Goal:** Define the boundaries of your AIMS before doing anything else.

### Step 1.1 — Understand your context (Clause 4.1)

1. Go to **GRC Hub → Documents**
2. Create a new document: *Category: Policy, Title: AIMS Context Analysis*
3. In the document, capture:
   - Internal issues (technology maturity, AI skills gap, existing governance)
   - External issues (regulatory environment, EU AI Act, customer expectations)
   - Use a PESTLE table (Political, Economic, Social, Technology, Legal, Environmental)
4. Upload the finished document and set status to **Approved**

### Step 1.2 — Register your interested parties (Clause 4.2)

1. In **GRC Hub → Documents**, create: *AIMS Stakeholder Register*
2. List every party with an interest in your AI systems:
   - Board / executive sponsor
   - Employees who use or build AI
   - Customers whose data is processed
   - Regulators (national AI authority, data protection authority)
   - AI system suppliers / SaaS vendors
3. For each party, document their needs, expectations, and how you will engage them
4. Upload and mark **Approved**

### Step 1.3 — Define your AIMS scope (Clause 4.3)

1. Create document: *AIMS Scope Statement*
2. Define:
   - Which AI systems are in scope (name each one)
   - Which business units / locations are covered
   - Which AI systems are explicitly excluded and why
3. Get the scope approved by your executive sponsor before proceeding
4. Upload and mark **Approved**

### Step 1.4 — Baseline your maturity

1. Go to **Maturity Assessment → ISO 42001**
2. Score every item in **Clauses 4–10** and all **Annex A** controls
3. Use the scoring definitions: 0=None, 1=Initial, 2=Developing, 3=Defined, 4=Managed, 5=Optimizing
4. The radar chart gives you an honest picture of where you stand today
5. Export this as your **baseline maturity snapshot** — you will repeat this quarterly to measure progress

> At this stage almost everything will score 0–1. That is expected and correct.

---

## Phase 2 — Leadership & Governance (Clause 5)

**Goal:** Get formal leadership commitment and assign clear accountability.

### Step 2.1 — Appoint key roles (Clause 5.3)

1. Go to **GRC Hub → RACI Matrices → New Matrix**
2. Name it: *AIMS Roles and Responsibilities*
3. Add the mandatory roles as **columns**:
   - Executive Sponsor (top management)
   - AIMS Programme Manager
   - AI Ethics Officer
   - AIMS Working Group members
   - IT / Data Engineering lead
   - Legal / Compliance lead
   - HR lead
4. Add the key AIMS processes as **rows**:
   - Define AIMS scope
   - Maintain AI risk register
   - Conduct impact assessments
   - Approve AI deployments
   - Run internal audits
   - Conduct management reviews
   - Handle AI incidents
5. Fill each cell: **R** (Responsible), **A** (Accountable), **C** (Consulted), **I** (Informed)
6. Export as CSV and include in your AIMS document pack

### Step 2.2 — Write your AI Policy (Clause 5.2)

1. Create document: *AI Policy* (Category: Policy)
2. The policy must include:
   - Statement of commitment to responsible AI
   - Eight AI principles: fairness, transparency, accountability, human oversight, privacy, security, reliability, sustainability
   - Scope of AI systems covered
   - Top management approval signature
   - Annual review commitment
3. Upload, mark **Approved**, and distribute to all staff

### Step 2.3 — Record leadership commitment (Clause 5.1)

1. Create document: *AIMS Governance Charter*
2. Document:
   - Executive sponsor name and mandate
   - Steering committee composition and meeting frequency (minimum quarterly)
   - Resources allocated (budget, FTE for AIMS PM)
3. Upload and mark **Approved**

---

## Phase 3 — Risk Planning (Clause 6)

**Goal:** Identify, assess, and plan treatment for all AI-related risks.

### Step 3.1 — Build your AI Risk Register (Clause 6.1.2)

1. Go to **Risk Register → Add Risk** for each AI system in scope
2. For every risk, complete all fields:
   - **Asset:** the AI system (e.g. "Loan Scoring Model v2")
   - **Likelihood (1–5):** how probable is this risk materialising
   - **Impact (1–5):** what is the business consequence
   - **Asset Value ($):** estimated value of the system/data to the business
   - **Exposure Factor (%):** percentage of asset value lost if the risk occurs
   - **ARO:** how many times per year you expect this to occur
3. SecureOps automatically calculates:
   - **Risk Score** = Likelihood × Impact → auto-classified as Critical/High/Medium/Low
   - **SLE** = Asset Value × Exposure Factor
   - **ALE** = SLE × ARO (annualised loss expectancy)
4. Common AI risks to register:
   - Biased model output causing discriminatory decisions
   - Model drift degrading accuracy over time
   - Training data poisoning
   - Prompt injection (for LLM systems)
   - Lack of human oversight on high-stakes decisions
   - Third-party AI vendor lock-in or failure
   - Regulatory non-compliance (EU AI Act, GDPR)
   - Inadequate explainability for regulated decisions

### Step 3.2 — Write Risk Treatment Plans (Clause 6.1.3)

1. For every **Critical** and **High** risk in the register:
   - Open the risk and document the treatment option: Mitigate / Accept / Transfer / Avoid
   - Set a **due date** and **owner**
2. Go to **GRC Hub → Action Tracker → New Action** for each treatment
3. Assign owner, due date, and link to the relevant risk
4. Track status through: Open → In Progress → Completed

### Step 3.3 — Set AIMS Objectives and KPIs (Clause 6.2)

1. Create document: *AIMS Objectives and KPIs*
2. Define at least six SMART objectives, for example:

   | Ref  | Objective | KPI | Target | Review |
   |------|-----------|-----|--------|--------|
   | OBJ-1 | Achieve ISO 42001 certification | Cert audit passed | Yes by [date] | Annual |
   | OBJ-2 | Maintain complete AI inventory | % of AI systems inventoried | 100% | Quarterly |
   | OBJ-3 | Regulatory compliance | Open regulatory findings | 0 Critical | Monthly |
   | OBJ-4 | Staff competence | % completed AI ethics training | 100% | Annual |
   | OBJ-5 | Risk reduction | Open Critical/High AI risks | Reduce by 50% | Quarterly |
   | OBJ-6 | Ethical AI | AI impact assessments completed | 100% before deployment | Per deployment |

3. Upload and mark **Approved**
4. Review KPIs in **Maturity Assessment → ISO 42001** each quarter

---

## Phase 4 — Support (Clause 7)

**Goal:** Put in place the people, training, and document control needed to run the AIMS.

### Step 4.1 — Build the AI System Inventory (Annex A.8.1)

1. For each AI system, create a document in **GRC Hub → Documents**:
   - *Category: Assessment, Title: AI System Card — [System Name]*
2. Each system card must contain:
   - System name, version, owner, vendor (if third-party)
   - AI type: Generative AI / ML Predictive / NLP / Computer Vision / RPA-AI / Analytics
   - Business purpose and decision-making role
   - Data inputs (including personal data — yes/no)
   - EU AI Act risk tier: Unacceptable / High / Limited / Minimal
   - Deployment date, last review date
3. Mark status **Active** and review quarterly

### Step 4.2 — Document training and competence (Clause 7.2 / 7.3)

1. Create document: *AI Competence Framework*
2. List required competences by role (developer, business owner, end user)
3. Record training completed, dates, and effectiveness evidence
4. Create document: *AI Awareness Training Records*
5. Upload signed completion records for all in-scope staff
6. Track any outstanding training as **Actions** in GRC Hub with due dates

### Step 4.3 — Establish document control (Clause 7.5)

The **GRC Hub → Document Library** is your AIMS document control system.

Adopt this naming convention:

| Prefix | Category | Example |
|--------|----------|---------|
| POL | Policy | POL-001 AI Policy |
| PROC | Procedure | PROC-001 AI Impact Assessment Procedure |
| REG | Register | REG-001 AI Risk Register |
| RPT | Report | RPT-001 Q1 Management Review |
| REC | Record | REC-001 Training Completion Records |

For every document: set version, review date, owner, and status. Use the **Edit** button to reupload when a new version is issued.

---

## Phase 5 — Operations (Clause 8 / Annex A.9)

**Goal:** Control AI systems throughout their lifecycle.

### Step 5.1 — Write the AI Lifecycle Procedure (Clause 8.1)

1. Create document: *AI Lifecycle Procedure*
2. Cover each stage with controls:

   | Stage | Key Controls |
   |-------|-------------|
   | Design | Requirements review, ethics pre-screening |
   | Data | Data quality check, consent and lawful basis verified |
   | Development | Bias testing, model documentation |
   | Testing | Performance benchmarks, fairness metrics |
   | Impact Assessment | Ethics Officer sign-off (see Step 5.2) |
   | Deployment | Approval gate signed by AIMS PM |
   | Monitoring | Drift detection, incident alerting |
   | Retirement | Data deletion, model decommission record |

### Step 5.2 — Conduct AI Impact Assessments (Clause 8.2 / Annex A.9.1)

For every AI system before deployment:

1. Create document: *AI Impact Assessment — [System Name]*
2. Assess five impact dimensions:
   - **Individual impact:** could this affect a person's rights, access to services, or opportunities?
   - **Societal impact:** could this reinforce bias at scale or affect vulnerable groups?
   - **Operational impact:** what happens if the system fails or outputs incorrectly?
   - **Legal impact:** does this touch regulated decisions (credit, employment, healthcare)?
   - **Ethical impact:** is the system transparent, explainable, and fair?
3. Classify the EU AI Act tier (Unacceptable / High / Limited / Minimal)
4. Get sign-off from the AI Ethics Officer
5. Upload to Document Library, link to the AI System Card and Risk Register entry

### Step 5.3 — Track operational actions

1. Use **GRC Hub → Action Tracker** to track every open control gap found during:
   - Impact assessments
   - Vendor reviews
   - Incident investigations
2. Assign each action an owner and due date — never leave actions unowned

---

## Phase 6 — Performance Evaluation (Clause 9)

**Goal:** Measure whether the AIMS is working and improving.

### Step 6.1 — Monitor KPIs monthly (Clause 9.1)

1. Go to **Maturity Assessment → ISO 42001** each month
2. Update scores for any clause where work has been completed
3. Review the radar chart — the shape should grow outward over time
4. Check **Risk Register** dashboard: track how many Critical/High risks are open vs. closed
5. Record KPI values against OBJ-1 to OBJ-6 in your objectives document

### Step 6.2 — Run Internal Audits (Clause 9.2)

1. Plan an annual audit covering all clauses 4–10 and all Annex A controls
2. Create document: *Internal Audit Programme*
3. For each audit:
   - Create an audit report in **GRC Hub → Documents** (Category: Audit)
   - Record every finding as a **Nonconformity (NC)** or **Observation**
   - Open an **Action** in GRC Hub for each NC with: root cause, corrective action, due date, owner
   - Major NCs: close within 30 days
   - Minor NCs: close within 60 days
4. Track NC closure via the Action Tracker

### Step 6.3 — Conduct Management Reviews (Clause 9.3)

1. Go to **GRC Hub → Management Reviews → New Review**
2. Hold at minimum one annual review (quarterly recommended)
3. The review agenda must cover all eight required inputs:
   - Status of actions from previous reviews
   - Changes in external/internal context
   - AI risk register status and trends
   - Results of internal audits
   - AIMS objective and KPI performance
   - Incidents and nonconformities
   - Opportunities for improvement
   - Resource adequacy
4. Record decisions and action items — all actions go into the **Action Tracker**
5. Upload the signed minutes to the Document Library (Category: Review)

---

## Phase 7 — Continuous Improvement (Clause 10)

**Goal:** Embed a PDCA improvement cycle so the AIMS matures over time.

### Step 7.1 — Maintain an Improvement Register (Clause 10.1)

1. Create document: *AIMS Improvement Register*
2. Log every improvement idea from:
   - Internal audits (observations, not just NCs)
   - Management review outputs
   - Staff suggestions
   - Post-incident reviews
3. Prioritise and assign each to the Action Tracker

### Step 7.2 — Handle Nonconformities (Clause 10.2)

When a nonconformity is found (audit, incident, self-detection):

1. Raise an **Action** in GRC Hub immediately
2. Document:
   - What the nonconformity is
   - Root cause (use 5-Why or fishbone analysis)
   - Containment action (immediate fix)
   - Corrective action (systemic fix to prevent recurrence)
   - Verification that the fix worked
3. Update the **Maturity Assessment** score for the affected clause after closure
4. If the same NC recurs, escalate to the Steering Committee

### Step 7.3 — Quarterly maturity cycle

Run this cycle every quarter:

```
1. Update Maturity Assessment scores (ISO 42001 tab)
2. Review Risk Register — close treated risks, add newly discovered ones
3. Review open Actions — chase overdue items
4. Update KPIs in the Objectives document
5. Present radar chart trend to executive sponsor
6. Plan next quarter's improvement priorities
```

---

## Phase 8 — Certification Readiness

**Goal:** Prepare for the Stage 1 and Stage 2 audits by an accredited certification body.

### Certification Body (CB) Audit Checklist

Use **Maturity Assessment → ISO 42001** and ensure every item scores **≥ 3 (Defined)** before the Stage 2 audit.

| Clause | Evidence the CB will ask for | Where it lives in SecureOps |
|--------|-----------------------------|-----------------------------|
| 4.1 | Context analysis document | GRC Hub → Documents |
| 4.2 | Stakeholder register | GRC Hub → Documents |
| 4.3 | Scope statement (approved) | GRC Hub → Documents |
| 5.1 | Governance charter, Steering Committee minutes | GRC Hub → Documents + Reviews |
| 5.2 | AI Policy (top management signed) | GRC Hub → Documents |
| 5.3 | RACI matrix | GRC Hub → RACI Matrices |
| 6.1 | AI Risk Register with scores and treatment plans | Risk Register |
| 6.2 | AIMS Objectives and KPIs with evidence | GRC Hub → Documents |
| 7.2/7.3 | Training records, competence framework | GRC Hub → Documents |
| 7.5 | Document register showing version control | GRC Hub → Document Library |
| 8.1 | AI Lifecycle Procedure | GRC Hub → Documents |
| 8.2 | Impact assessments per AI system | GRC Hub → Documents |
| 9.1 | KPI reports, monitoring records | Maturity Assessment + Risk Register |
| 9.2 | Internal audit reports with NC closure evidence | GRC Hub → Documents + Actions |
| 9.3 | Management review minutes with actions | GRC Hub → Reviews |
| 10.2 | NC log with root cause analysis and verification | GRC Hub → Actions |
| A.5 | AI Policy + AI Risk Management Policy | GRC Hub → Documents |
| A.6 | RACI, segregation of duties evidence | GRC Hub → RACI + Documents |
| A.8 | AI System Inventory (all systems) | GRC Hub → Documents |
| A.9 | Impact assessments, documented and approved | GRC Hub → Documents |

### Pre-audit self-check

1. Every document in the AIMS has status **Approved** — nothing in **Draft**
2. No open Critical or High risks without a treatment plan and owner
3. No overdue actions in the Action Tracker
4. At least one full internal audit completed and all NCs closed
5. At least one management review conducted with signed minutes
6. 100% of in-scope staff have training records
7. Maturity Assessment: all clauses 4–10 score ≥ 3

---

## Quick Reference — Platform Feature to ISO 42001 Mapping

| SecureOps Feature | ISO 42001 Clauses / Controls |
|-------------------|------------------------------|
| GRC Hub → Document Library | 4.1, 4.2, 4.3, 5.1, 5.2, 7.5, 8.1, 8.2, 9.2, 9.3, 10.2, A.5, A.7, A.8, A.9 |
| GRC Hub → RACI Matrix | 5.3, A.6.1, A.6.2 |
| GRC Hub → Action Tracker | 6.1.3, 9.2, 9.3, 10.1, 10.2 |
| GRC Hub → Management Reviews | 9.3 |
| Risk Register | 6.1.2, 6.1.3, A.5.2 |
| Maturity Assessment → ISO 42001 | 6.2, 9.1, continual improvement measurement |
| Network Scans / Vulnerabilities | Supports A.8.3 (AI system security controls) |
| Settings → LDAP | Supports A.6 (identity and access for AIMS roles) |

---

## Recommended Timeline

| Month | Focus | Key Deliverables |
|-------|-------|-----------------|
| 1 | Foundation | Context, stakeholders, scope, baseline maturity |
| 2 | Leadership | Governance charter, AI Policy, RACI, role appointments |
| 3–4 | Risk & Planning | Full AI risk register, treatment plans, AIMS objectives |
| 5–6 | Support | AI inventory, lifecycle procedure, training records, document control |
| 7–8 | Operations | Impact assessments for all in-scope AI systems |
| 9 | Evaluation | Internal audit, management review |
| 10 | Improvement | NC closure, maturity re-assessment, gap remediation |
| 11 | Readiness | Pre-audit self-check, all scores ≥ 3 |
| 12 | Certification | Stage 1 audit (document review), Stage 2 audit (implementation) |

---

*SecureOps — Use responsibly on networks and AI systems you own or are authorised to govern.*
