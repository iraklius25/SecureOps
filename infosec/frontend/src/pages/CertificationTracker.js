import React, { useState, useEffect, useCallback, useContext } from 'react';
import { api, AuthContext } from '../App';

/* ── Constants ─────────────────────────────────────────────────── */
const FRAMEWORKS = [
  { id: 'PCIDSS',   label: 'PCI DSS v4.0',    color: '#ef4444', desc: 'Payment Card Industry Data Security Standard' },
  { id: 'ISO27001', label: 'ISO 27001:2022',   color: '#3b82f6', desc: 'Information Security Management System' },
  { id: 'ISO42001', label: 'ISO 42001:2023',   color: '#8b5cf6', desc: 'AI Management System' },
  { id: 'NISTCSF',  label: 'NIST CSF 2.0',    color: '#10b981', desc: 'Cybersecurity Framework' },
  { id: 'SOC2',     label: 'SOC 2 Type II',    color: '#f59e0b', desc: 'Service Organization Control 2' },
  { id: 'HIPAA',    label: 'HIPAA',            color: '#06b6d4', desc: 'Health Insurance Portability and Accountability Act' },
  { id: 'GDPR',     label: 'GDPR',             color: '#6366f1', desc: 'General Data Protection Regulation' },
  { id: 'CUSTOM',   label: 'Custom',           color: '#6b7280', desc: 'Custom framework' },
];

const PHASES = [
  { id: 'planning',     label: 'Planning',     color: '#6b7280' },
  { id: 'gap_analysis', label: 'Gap Analysis', color: '#f59e0b' },
  { id: 'remediation',  label: 'Remediation',  color: '#f97316' },
  { id: 'pre_audit',    label: 'Pre-Audit',    color: '#3b82f6' },
  { id: 'audit',        label: 'Audit',        color: '#8b5cf6' },
  { id: 'certified',    label: 'Certified',    color: '#10b981' },
  { id: 'surveillance', label: 'Surveillance', color: '#06b6d4' },
  { id: 'renewal',      label: 'Renewal',      color: '#6366f1' },
];

const TL_TYPES = [
  { id: 'milestone',    label: 'Milestone',      icon: '⭐', color: '#3b82f6' },
  { id: 'audit',        label: 'Audit',          icon: '📋', color: '#8b5cf6' },
  { id: 'finding',      label: 'Finding',        icon: '⚠️',  color: '#ef4444' },
  { id: 'action',       label: 'Action',         icon: '⚙️',  color: '#f97316' },
  { id: 'approval',     label: 'Approval',       icon: '✅', color: '#10b981' },
  { id: 'certification',label: 'Certification',  icon: '🏆', color: '#f59e0b' },
  { id: 'note',         label: 'Note',           icon: '📝', color: '#6b7280' },
];

const STEP_STATUSES = [
  { id: 'pending',     label: 'Pending',     color: '#6b7280' },
  { id: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { id: 'in_review',   label: 'In Review',   color: '#8b5cf6' },
  { id: 'completed',   label: 'Completed',   color: '#10b981' },
  { id: 'blocked',     label: 'Blocked',     color: '#ef4444' },
  { id: 'skipped',     label: 'Skipped',     color: '#9ca3af' },
];

const KANBAN_COLS = [
  { id: 'pending',     label: 'To Do',       color: '#64748b' },
  { id: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { id: 'in_review',   label: 'In Review',   color: '#8b5cf6' },
  { id: 'blocked',     label: 'Blocked',     color: '#ef4444' },
  { id: 'completed',   label: 'Done',        color: '#10b981' },
];

const KANBAN_PRIORITIES = [
  { id: 'critical', label: 'Critical', color: '#ef4444' },
  { id: 'high',     label: 'High',     color: '#f97316' },
  { id: 'medium',   label: 'Medium',   color: '#eab308' },
  { id: 'low',      label: 'Low',      color: '#22c55e' },
];
const kpri = id => KANBAN_PRIORITIES.find(p => p.id === id) || KANBAN_PRIORITIES[2];

const REQ_STATUSES = [
  { id: 'compliant',       label: 'Compliant',       color: '#10b981' },
  { id: 'in_progress',     label: 'In Progress',     color: '#3b82f6' },
  { id: 'non_compliant',   label: 'Non-Compliant',   color: '#ef4444' },
  { id: 'not_applicable',  label: 'N/A',             color: '#9ca3af' },
  { id: 'not_assessed',    label: 'Not Assessed',    color: '#6b7280' },
];

/* ── Framework Implementation Roadmap Data ─────────────────────── */
const FRAMEWORK_ROADMAP = {
  PCIDSS: {
    planning:    { title:'Define CDE Scope & Assemble Team', steps:['Identify all systems storing, processing or transmitting cardholder data (CHD)','Define the Cardholder Data Environment (CDE) boundary precisely','Appoint a PCI DSS owner and engage a Qualified Security Assessor (QSA)','Review all 12 PCI DSS v4.0 requirements and the applicable SAQ type','Set a target certification date and allocate budget'] },
    gap_analysis:{ title:'Gap Analysis & Baseline Scans', steps:['Self-assess against all 12 PCI DSS requirements','Inventory all in-scope systems, network segments and third-party service providers','Run an Approved Scanning Vendor (ASV) external vulnerability scan','Conduct an internal penetration test baseline','Document all gaps and prioritise by risk level'] },
    remediation: { title:'Implement Controls & Close Gaps', steps:['Segment CDE from out-of-scope networks (firewalls, VLANs)','Implement strong access control: MFA, unique IDs, least privilege','Encrypt CHD at rest (AES-256) and in transit (TLS 1.2+)','Deploy anti-malware, IDS/IPS and file integrity monitoring (FIM)','Establish centralised logging and alerting for all in-scope systems','Create or update all required security policies and train all staff'] },
    pre_audit:   { title:'Pre-Audit Validation', steps:['Complete internal assessment against all 12 requirements','Run final ASV scan and resolve all medium/high findings','Conduct full penetration test (network and application layer)','Organise all audit evidence, policies and procedures','Brief the QSA on scope, environment and available documentation'] },
    audit:       { title:'QSA Formal Assessment', steps:['Provide QSA access to all in-scope systems, documentation and staff','Participate in interviews, walkthroughs and evidence reviews','Address QSA queries with supplementary evidence as requested','Review and approve the draft Report on Compliance (RoC)','Sign the final Attestation of Compliance (AoC)'] },
    certified:   { title:'Certified — Maintain Controls', steps:['Submit AoC and quarterly ASV scan results to your acquiring bank','Maintain all PCI DSS controls — do not relax after certification','Conduct quarterly internal vulnerability scans','Perform annual penetration testing and staff re-training','Monitor CDE changes that could affect compliance scope'] },
    surveillance:{ title:'Quarterly Surveillance', steps:['Complete quarterly ASV scans and remediate any new findings','Review and update policies after any significant environment change','Track PCI DSS v4.0 future-dated requirements and their effective dates','Conduct interim gap assessments before the annual re-assessment','Log and investigate all security incidents involving CHD'] },
    renewal:     { title:'Annual Re-Assessment', steps:['Initiate renewal at least 3 months before AoC expiry','Reassess scope — have new systems entered the CDE?','Schedule the QSA for the annual Report on Compliance','Update all documentation, policies and evidence packages','Address any new v4.0 requirements still in the pipeline'] },
  },
  ISO27001: {
    planning:    { title:'Establish ISMS Scope & Context', steps:['Define the ISMS scope and organisational boundaries (Clause 4)','Identify internal/external issues and interested parties','Obtain top management commitment and appoint an ISMS owner','Establish the ISMS policy and high-level security objectives','Plan project timeline, resources and budget'] },
    gap_analysis:{ title:'Risk Assessment & Gap Analysis', steps:['Build an information asset inventory (Annex A 5.9)','Conduct an information security risk assessment (Clause 6.1.2)','Evaluate current controls against all 93 Annex A controls (2022 version)','Prepare Statement of Applicability (SoA) for all Annex A controls','Produce a Risk Treatment Plan (RTP) and obtain management approval'] },
    remediation: { title:'Implement & Document Controls', steps:['Implement priority controls from the Risk Treatment Plan','Develop all required ISMS documents: policies, procedures, guidelines','Establish the management review process (Clause 9.3)','Set up an internal audit programme (Clause 9.2)','Implement security awareness training programme (Annex A 6.3)','Deploy technical controls: access management, encryption, logging, backup'] },
    pre_audit:   { title:'Internal Audit & Management Review', steps:['Complete a full internal audit against all applicable Clauses 4–10','Audit all relevant Annex A controls and verify supporting evidence','Hold a formal management review meeting and document outcomes','Close all nonconformities identified in the internal audit','Finalise and sign off the Statement of Applicability'] },
    audit:       { title:'Certification Audit (Stage 1 + Stage 2)', steps:['Stage 1: Submit ISMS documentation for auditor document review','Address all Stage 1 observations before the Stage 2 date','Stage 2: Demonstrate ISMS operation and control effectiveness on-site','Provide evidence of risk assessment, SoA, internal audit and management review','Respond to nonconformities and receive the ISO 27001 certificate'] },
    certified:   { title:'Certified — Operate the ISMS', steps:['Continue operating all ISMS controls and processes','Maintain and update the risk register for any significant changes','Conduct ongoing security awareness training','Log and investigate all information security incidents','Prepare for the first annual surveillance audit (~12 months)'] },
    surveillance:{ title:'Annual Surveillance Audit', steps:['Conduct an internal audit covering a subset of Annex A controls','Hold a management review and document corrective actions','Update the risk register and SoA for any scope or context changes','Prepare the surveillance audit evidence package','Host the certification body for the annual surveillance visit'] },
    renewal:     { title:'Recertification Audit (Year 3)', steps:['Initiate renewal at least 6 months before certificate expiry','Comprehensive internal audit covering all Clauses and Annex A controls','Full management review with updated ISMS objectives','Reassess all risks and update the Risk Treatment Plan','Schedule and complete the recertification audit with the certification body'] },
  },
  ISO42001: {
    planning:    { title:'Establish AI Management System Scope', steps:['Define scope: which AI systems and use cases are in scope?','Map AI roles, stakeholders and impacted parties across the organisation','Obtain top management commitment and appoint an AI governance lead','Review ISO 42001:2023 structure and align with existing ISMS if applicable','Set project timeline and plan stakeholder engagement'] },
    gap_analysis:{ title:'AI Risk & Impact Assessment', steps:['Inventory all AI systems and their intended uses (Clause 4)','Conduct AI risk assessment: bias, safety, transparency, accountability','Assess AI system impacts on individuals and society','Map current controls against Annex A AI-specific controls','Prepare Statement of Applicability for AI controls','Identify data governance and AI lifecycle management gaps'] },
    remediation: { title:'Implement AI Governance Controls', steps:['Establish AI policy and measurable AI objectives (Clause 5)','Implement AI risk treatment and human oversight mechanisms','Set up AI system documentation and model cards for each in-scope AI','Establish data quality and training data management procedures','Create AI incident response and corrective action processes','Train all relevant staff on responsible AI use and AIMS procedures'] },
    pre_audit:   { title:'Internal Audit & AIMS Review', steps:['Complete a full internal audit of the AIMS against all applicable clauses','Review AI system documentation, risk assessments and incident logs','Hold a management review and confirm AI objectives and treatment plans','Close all nonconformities before the certification audit','Prepare AIMS evidence pack: policy, SoA, risk register, audit records'] },
    audit:       { title:'Certification Audit', steps:['Stage 1: Submit AIMS documentation for auditor review','Resolve Stage 1 observations or documentation gaps','Stage 2: Demonstrate AIMS operation and AI risk register in practice','Provide evidence of human oversight, monitoring and corrective actions','Respond to nonconformities and receive ISO 42001 certificate'] },
    certified:   { title:'Certified — Operate the AIMS', steps:['Maintain AI risk register and update for new AI deployments','Conduct periodic AI impact reviews for high-risk systems','Log and investigate AI incidents, bias events and near-misses','Keep AI system documentation and model cards current','Prepare for the first surveillance audit (~12 months)'] },
    surveillance:{ title:'Annual Surveillance Audit', steps:['Internal audit: review AI risk register, incident log and corrective actions','Management review: AIMS performance against AI objectives','Update SoA for any new AI systems or changed use cases','Prepare surveillance audit evidence for the certification body','Host annual surveillance visit'] },
    renewal:     { title:'Recertification Audit (Year 3)', steps:['Initiate renewal 6 months before certificate expiry','Comprehensive internal audit of all AIMS clauses and Annex A','Reassess all AI risks and update the AI risk register','Management review with updated AIMS objectives','Schedule and complete recertification audit'] },
  },
  NISTCSF: {
    planning:    { title:'Define Scope & Select Tier Target', steps:['Identify critical systems, assets and data flows','Establish risk management context aligned with business priorities','Select a target NIST CSF 2.0 Tier (1–4)','Appoint a cybersecurity programme owner and cross-functional team','Review all 6 CSF Functions: Govern, Identify, Protect, Detect, Respond, Recover'] },
    gap_analysis:{ title:'Current Profile & Gap Analysis', steps:['Create a Current Profile documenting as-is state for each CSF category','Define a Target Profile aligned to business risk tolerance','Identify and prioritise gaps between Current and Target profiles','Conduct asset inventory and data flow mapping (Identify function)','Assess governance, policies and third-party risk management (Govern function)'] },
    remediation: { title:'Implement Controls & Improve Posture', steps:['Implement priority Protect controls: access management, data security, training','Deploy Detect capabilities: logging, monitoring and anomaly detection','Establish Respond playbooks: incident response, communications, analysis','Define Recover procedures: recovery planning, improvements, communications','Strengthen Govern function: risk strategy, supply chain risk, executive oversight'] },
    pre_audit:   { title:'Assessment & Validation', steps:['Reassess Current Profile against each CSF category and subcategory','Verify that priority gaps from the gap analysis have been closed','Conduct or commission an independent cybersecurity assessment','Run tabletop exercises for incident response and recovery scenarios','Review and update all cybersecurity policies and procedures'] },
    audit:       { title:'Third-Party Assessment', steps:['Commission an independent assessor to evaluate the current profile','Provide access to policies, controls and evidence for each CSF function','Walk the assessor through key controls across all 6 CSF functions','Review assessment findings and agree residual risk acceptance','Produce a final CSF Assessment Report with maturity scores'] },
    certified:   { title:'Achieved Target Profile', steps:['Publish the achieved Target Profile to relevant stakeholders','Continue monitoring and maintaining all implemented controls','Incorporate CSF metrics into regular risk and executive reporting','Review the Target Profile annually or after significant changes','Engage supply chain partners on CSF alignment and third-party risk'] },
    surveillance:{ title:'Continuous Improvement', steps:['Review Current Profile quarterly and update for new threats or changes','Monitor NIST for CSF updates and new informative references','Perform tabletop exercises and update response/recovery playbooks','Conduct annual CSF assessments to track progress toward the next Tier','Report cybersecurity posture to leadership using CSF metrics'] },
    renewal:     { title:'Tier Advancement & Re-Assessment', steps:['Reassess Current Profile against the next target Tier','Update Target Profile with new priorities and risk-informed objectives','Commission independent assessment for the updated profile','Align CSF programme with regulatory or contractual requirements','Document lessons learned and update the cybersecurity improvement plan'] },
  },
  SOC2: {
    planning:    { title:'Define Scope & Trust Service Criteria', steps:['Determine applicable TSC: Security, Availability, Confidentiality, Processing Integrity, Privacy','Define the service system boundary (systems and processes in scope)','Choose SOC 2 Type I (point-in-time) or Type II (6–12 month period)','Engage a licensed CPA auditor and set the audit period start date','Map existing controls to AICPA Common Criteria (CC series)'] },
    gap_analysis:{ title:'Controls Gap Assessment', steps:['Map current controls to all applicable CC controls','Add supplemental criteria for chosen TSC (A, C, PI, P)','Identify gaps: logical access, change management, monitoring, availability','Review vendor and subservice organisation agreements (CSCs)','Document all gaps with ownership and target remediation dates'] },
    remediation: { title:'Implement & Evidence Controls', steps:['Implement access controls: MFA, RBAC, quarterly access reviews','Establish change management: approvals, testing, deployment logs','Deploy continuous monitoring: SIEM, IDS, vulnerability scanning','Begin collecting evidence from day 1 of the audit observation period','Develop incident response, BCP and DR plans with staff training'] },
    pre_audit:   { title:'Audit Readiness Assessment', steps:['Run a readiness assessment against all in-scope Trust Service Criteria','Organise evidence for the entire audit observation period','Verify access reviews, change tickets and incident logs are complete','Prepare the System Description document for CPA review','Brief the auditor on scope, system description and available evidence'] },
    audit:       { title:'CPA Audit & Report', steps:['Provide auditor with the System Description for review and sign-off','Supply evidence for each tested control: access logs, change records, incidents','Participate in auditor walkthroughs and interviews for each TSC','Address exceptions or control deficiencies identified','Receive and distribute the final SOC 2 Type II report under NDA'] },
    certified:   { title:'Report Issued — Maintain Controls', steps:['Distribute the SOC 2 report to customers and prospects (under NDA)','Continue operating all controls — the clock starts for next year','Collect evidence continuously throughout the year','Monitor for control exceptions and investigate promptly','Conduct quarterly access reviews and update policies as needed'] },
    surveillance:{ title:'Annual Audit Period Monitoring', steps:['Maintain continuous evidence: access reviews, change logs, training records','Review and update policies for any changes to the environment','Conduct a mid-period readiness check to identify new gaps','Address incidents or exceptions before the audit period closes','Plan the next audit engagement 2–3 months before the period end'] },
    renewal:     { title:'Next Audit Period', steps:['Define the new 12-month audit observation period','Reassess scope — have new services or systems been added?','Update the System Description for infrastructure or service changes','Engage the CPA auditor for the new period','Review and update control evidence templates and collection processes'] },
  },
  HIPAA: {
    planning:    { title:'Identify PHI Scope & Appoint Officers', steps:['Determine if you are a Covered Entity (CE) or Business Associate (BA)','Identify all Protected Health Information (PHI) and ePHI in your environment','Appoint a HIPAA Privacy Officer and a HIPAA Security Officer','Review Privacy Rule, Security Rule and Breach Notification Rule requirements','Map Business Associate relationships and plan BAA review'] },
    gap_analysis:{ title:'Risk Analysis & Safeguards Gap Assessment', steps:['Conduct a thorough Risk Analysis of all ePHI (Security Rule §164.308(a)(1))','Evaluate existing Administrative, Physical and Technical Safeguards','Assess workforce training, access controls, audit logging and transmission security','Review Notice of Privacy Practices and patient rights procedures','Document all gaps with risk severity ratings and remediation owners'] },
    remediation: { title:'Implement HIPAA Safeguards', steps:['Implement Risk Management Plan to reduce ePHI risks to a reasonable level','Deploy Technical Safeguards: access controls, audit logs, encryption at rest and in transit','Establish Physical Safeguards: facility access, workstation security, device controls','Implement Administrative Safeguards: sanction policy, contingency plan, workforce training','Execute all required Business Associate Agreements (BAAs)','Establish 72-hour Breach Notification procedures'] },
    pre_audit:   { title:'Internal Assessment & Documentation', steps:['Re-run the Risk Analysis and verify all risks are documented and treated','Verify all required policies: Privacy Policy, Security Policy, Contingency Plan','Review audit logs — are all ePHI access events logged and reviewed?','Conduct a workforce training audit — all staff trained and records documented?','Verify BAAs are in place for all applicable third parties'] },
    audit:       { title:'Third-Party Audit / OCR Review', steps:['Provide Risk Analysis, Risk Management Plan and supporting policies','Demonstrate access controls, audit log reviews and training records','Show evidence of contingency plan testing (backup/restore, DR)','Provide copies of all active Business Associate Agreements','Respond to findings with a corrective action plan and agreed timeline'] },
    certified:   { title:'Compliant — Maintain Programme', steps:['Conduct annual HIPAA Risk Analyses (required by the Security Rule)','Re-train all workforce members annually and document completion','Review and update all HIPAA policies annually or after significant changes','Monitor for PHI breaches and notify within 60 days of discovery','Review and update Business Associate Agreements as relationships change'] },
    surveillance:{ title:'Ongoing HIPAA Compliance', steps:['Review audit logs quarterly for unauthorised ePHI access','Monitor OCR enforcement bulletins for regulatory changes','Test contingency plan and disaster recovery procedures annually','Conduct spot-checks on workforce HIPAA procedures','Reassess Business Associate risk and agreements annually'] },
    renewal:     { title:'Annual Review & Risk Re-Assessment', steps:['Complete updated annual Risk Analysis for all ePHI','Review and update Risk Management Plan with new treatments','Refresh all workforce HIPAA training and document completion','Audit BAAs for currency and completeness','Update HIPAA policies to reflect regulatory guidance or operational changes'] },
  },
  GDPR: {
    planning:    { title:'Establish Data Protection Programme', steps:['Appoint a Data Protection Officer (DPO) if required by GDPR Art. 37','Define the scope of personal data processing activities','Map all legal bases for processing (consent, LI, contract, legal obligation, etc.)','Establish a Data Protection steering group with legal, IT and operations','Set programme timeline and resource plan for full GDPR compliance'] },
    gap_analysis:{ title:'Data Mapping & Compliance Gap Analysis', steps:['Complete a Record of Processing Activities (RoPA) — Art. 30 requirement','Identify all personal data flows: collection, storage, transfer, deletion','Identify international transfers and applicable mechanisms (SCCs, adequacy decisions)','Review data subject rights procedures (access, erasure, portability, objection)','Gap-assess against all applicable GDPR articles'] },
    remediation: { title:'Implement Data Protection Controls', steps:['Implement Privacy by Design and by Default in systems and processes','Update privacy notices and consent mechanisms to GDPR standard','Establish DSAR procedures with 30-day response SLA','Implement data retention and deletion schedules','Conduct DPIAs for all high-risk processing activities','Update Data Processing Agreements (DPAs) with all processors','Establish 72-hour breach notification process to the supervisory authority'] },
    pre_audit:   { title:'Internal Review & DPA Readiness', steps:['Review RoPA for completeness and accuracy','Verify privacy notices, consent forms and DPAs are current','Test the DSAR process end-to-end','Confirm DPIA register covers all high-risk processing activities','Review breach notification logs and response procedures'] },
    audit:       { title:'Supervisory Authority Audit / DPA Assessment', steps:['Provide RoPA and privacy notices to the auditor','Demonstrate lawful basis documentation for all processing activities','Show evidence of DSAR processes, DPIA register and breach log','Provide processor agreements and international transfer documentation','Respond to findings with a corrective action plan'] },
    certified:   { title:'Compliant — Maintain Data Protection', steps:['Keep the RoPA updated as processing activities change','Review privacy notices and consent for any new processing','Monitor DSARs and respond within 30 days','Log all breaches and notify supervisory authority within 72 hours if required','Conduct annual staff data protection training'] },
    surveillance:{ title:'Ongoing GDPR Compliance', steps:['Quarterly review of the RoPA for accuracy','Annual DPIA review for high-risk processing activities','Monitor EDPB guidance and national DPA decisions for updates','Test breach notification process annually','Review and renew processor agreements as contracts change'] },
    renewal:     { title:'Annual Compliance Review', steps:['Full review of the Record of Processing Activities','Update DPIA register for changed or new processing activities','Reassess lawful basis for all processing activities','Refresh all staff data protection training','Update privacy notices, consent forms and processor agreements'] },
  },
  CUSTOM: {
    planning:    { title:'Define Programme Scope & Objectives', steps:['Document compliance objectives and success criteria','Identify applicable regulations, standards or internal policies','Appoint a programme owner and assemble a cross-functional team','Define programme scope boundary and applicable assets','Create a high-level project plan with milestones and resource allocation'] },
    gap_analysis:{ title:'Current State Assessment', steps:['Inventory all systems, data and processes in scope','Assess current controls against applicable requirements','Document and prioritise all gaps by risk level and impact','Define ownership for each gap and agree remediation timelines','Obtain management sign-off on the gap analysis findings'] },
    remediation: { title:'Implement Required Controls', steps:['Execute the remediation plan for all high-priority gaps','Develop or update required policies, standards and procedures','Implement technical controls and validate effectiveness','Conduct staff training on new requirements and procedures','Collect evidence of control implementation and track progress'] },
    pre_audit:   { title:'Internal Validation', steps:['Conduct an internal compliance assessment against all requirements','Verify all required documentation and evidence is in place','Close any remaining gaps identified in the internal assessment','Brief the external auditor on scope and available evidence','Prepare the evidence package for the formal audit'] },
    audit:       { title:'Formal Compliance Assessment', steps:['Provide auditor access to required documentation and personnel','Facilitate walkthroughs and evidence reviews','Respond to auditor queries with additional evidence as needed','Review audit findings and agree corrective action plans','Obtain formal assessment sign-off or certification'] },
    certified:   { title:'Achieved — Maintain Compliance', steps:['Maintain all implemented controls on an ongoing basis','Monitor for changes to requirements or the operating environment','Conduct regular compliance reviews and management reporting','Investigate and remediate any compliance exceptions promptly','Prepare for the next assessment cycle'] },
    surveillance:{ title:'Ongoing Monitoring', steps:['Conduct periodic internal assessments to verify control effectiveness','Monitor for regulatory or standard updates affecting compliance','Review and update policies and procedures annually','Report compliance status to leadership on a regular basis','Address any control failures or incidents promptly'] },
    renewal:     { title:'Re-Assessment & Renewal', steps:['Initiate renewal ahead of the assessment due date','Reassess scope for any changes to systems, processes or requirements','Update documentation, policies and evidence packages','Commission the external assessor for the renewal audit','Implement any new requirements in the updated standard'] },
  },
};

/* ── Helpers ───────────────────────────────────────────────────── */
const fw   = id => FRAMEWORKS.find(f => f.id === id) || { label: id, color: '#6b7280' };
const ph   = id => PHASES.find(p => p.id === id)     || { label: id, color: '#6b7280' };
const rs   = id => REQ_STATUSES.find(s => s.id === id)|| { label: id, color: '#6b7280' };
const tl   = id => TL_TYPES.find(t => t.id === id)   || { icon: '●',  color: '#6b7280' };
const fmtD = d => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const fmtDT= d => d ? new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
const isOverdue = d => d && new Date(d) < new Date();

const badge = (color, text) => (
  <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:10,
                 fontSize:11, fontWeight:600, background:`${color}20`, color, whiteSpace:'nowrap' }}>
    {text}
  </span>
);

const inp  = { width:'100%', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:6, padding:'8px 10px', color:'var(--text1)', fontSize:13, boxSizing:'border-box' };
const sel  = { background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:6, padding:'8px 10px', color:'var(--text1)', fontSize:13, width:'100%', boxSizing:'border-box' };
const btnS = (v='default') => {
  const vs = {
    default: { background:'var(--surface3)', border:'1px solid var(--border2)', color:'var(--text1)' },
    primary: { background:'var(--accent)', border:'none', color:'#fff' },
    danger:  { background:'#ef444422', border:'1px solid #ef4444', color:'#ef4444' },
    sm:      { background:'var(--surface3)', border:'1px solid var(--border2)', color:'var(--text1)', padding:'4px 10px', fontSize:12 },
  };
  return { ...vs[v], borderRadius:6, padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:500 };
};

/* ── Framework Roadmap Component ─────────────────────────────── */
function FrameworkRoadmap({ framework, currentPhase, compact = false }) {
  const f = fw(framework);
  const roadmap = FRAMEWORK_ROADMAP[framework] || FRAMEWORK_ROADMAP.CUSTOM;
  const currentIdx = PHASES.findIndex(p => p.id === currentPhase);
  const currentInfo = roadmap[currentPhase] || { title: ph(currentPhase).label, steps: [] };
  const nextPhase = PHASES[currentIdx + 1];
  const nextInfo = nextPhase ? (roadmap[nextPhase.id] || { title: nextPhase.label, steps: [] }) : null;

  return (
    <div style={{ background: compact ? 'transparent' : 'var(--surface3)', border:`1px solid ${f.color}25`,
                  borderRadius:10, padding: compact ? '12px 0 0' : 20, marginTop: compact ? 8 : 0 }}>
      {!compact && (
        <div style={{ fontSize:13, fontWeight:700, color:f.color, marginBottom:16 }}>
          🗺 Implementation Roadmap — {f.label}
        </div>
      )}

      {/* Phase track */}
      <div style={{ display:'flex', alignItems:'flex-start', overflowX:'auto', paddingBottom:8,
                    marginBottom: compact ? 10 : 16, gap:0 }}>
        {PHASES.map((p, i) => {
          const isDone = i < currentIdx;
          const isCurr = i === currentIdx;
          const color  = isCurr ? f.color : isDone ? '#10b981' : 'var(--text3)';
          return (
            <React.Fragment key={p.id}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth: compact ? 58 : 70 }}>
                <div style={{ width: compact ? 26 : 32, height: compact ? 26 : 32, borderRadius:'50%',
                               background: isCurr ? f.color : isDone ? '#10b981' : 'var(--surface2)',
                               border:`2px solid ${color}`,
                               display:'flex', alignItems:'center', justifyContent:'center',
                               fontSize: compact ? 11 : 13, color:(isCurr||isDone)?'#fff':color,
                               fontWeight:700, flexShrink:0,
                               boxShadow: isCurr ? `0 0 0 4px ${f.color}25` : 'none' }}>
                  {isDone ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: compact ? 9 : 10, marginTop: compact ? 3 : 5, textAlign:'center',
                               whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                               maxWidth: compact ? 54 : 66,
                               color: isCurr ? f.color : isDone ? '#10b981' : 'var(--text3)',
                               fontWeight: isCurr ? 700 : isDone ? 500 : 400 }}>
                  {p.label}
                </div>
                {isCurr && <div style={{ fontSize:8, color:f.color, fontWeight:700, marginTop:2,
                                         textTransform:'uppercase', letterSpacing:'0.05em' }}>▲ HERE</div>}
              </div>
              {i < PHASES.length - 1 && (
                <div style={{ flex:1, height:2, minWidth: compact ? 6 : 10, marginTop: compact ? 12 : 15,
                               background: i < currentIdx ? '#10b98150' : 'var(--border1)' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Current phase steps */}
      <div style={{ background:'var(--surface2)', border:`1px solid ${f.color}30`, borderRadius:8,
                    padding: compact ? 10 : 14, marginBottom: nextInfo ? (compact ? 8 : 12) : 0 }}>
        <div style={{ fontSize: compact ? 11 : 12, fontWeight:700, color:f.color, marginBottom: compact ? 5 : 8,
                       display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <span style={{ background:`${f.color}20`, padding:'2px 8px', borderRadius:4, fontSize: compact ? 9 : 10,
                          textTransform:'uppercase', letterSpacing:'0.05em' }}>Current Phase</span>
          {currentInfo.title}
        </div>
        <ol style={{ margin:0, paddingLeft:18, display:'flex', flexDirection:'column', gap: compact ? 3 : 5 }}>
          {(compact ? currentInfo.steps.slice(0, 4) : currentInfo.steps).map((step, j) => (
            <li key={j} style={{ fontSize: compact ? 11 : 12, color:'var(--text2)', lineHeight:1.45 }}>{step}</li>
          ))}
          {compact && currentInfo.steps.length > 4 && (
            <li style={{ fontSize:10, color:'var(--text3)', listStyle:'none', marginLeft:-18, marginTop:2, fontStyle:'italic' }}>
              +{currentInfo.steps.length - 4} more steps…
            </li>
          )}
        </ol>
      </div>

      {/* Next phase */}
      {nextInfo && !compact && (
        <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:8, padding:14, opacity:0.8 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ background:'var(--surface3)', padding:'2px 8px', borderRadius:4, fontSize:10,
                            textTransform:'uppercase', letterSpacing:'0.05em' }}>Next →</span>
            {nextInfo.title}
          </div>
          <ol style={{ margin:0, paddingLeft:18, display:'flex', flexDirection:'column', gap:4 }}>
            {nextInfo.steps.slice(0, 3).map((step, j) => (
              <li key={j} style={{ fontSize:12, color:'var(--text3)', lineHeight:1.4 }}>{step}</li>
            ))}
            {nextInfo.steps.length > 3 && (
              <li style={{ fontSize:11, color:'var(--text3)', listStyle:'none', marginLeft:-18, marginTop:2, fontStyle:'italic' }}>
                +{nextInfo.steps.length - 3} more steps in next phase…
              </li>
            )}
          </ol>
        </div>
      )}

      {/* Compact next tip */}
      {nextInfo && compact && (
        <div style={{ padding:'6px 10px', background:'var(--surface2)', borderRadius:6, fontSize:11,
                       color:'var(--text3)', display:'flex', gap:6, alignItems:'flex-start' }}>
          <span style={{ color:'#f59e0b', fontWeight:700, flexShrink:0 }}>→ Next:</span>
          <span><strong style={{ color:'var(--text2)' }}>{nextInfo.title}</strong> — {nextInfo.steps[0]}</span>
        </div>
      )}
    </div>
  );
}

/* ── CertificationTracker ─────────────────────────────────────── */
export default function CertificationTracker() {
  const { user } = useContext(AuthContext);
  const canEdit  = ['admin','analyst'].includes(user?.role);
  const isAdmin  = user?.role === 'admin';

  const [tab,   setTab]   = useState('overview');
  const [certs, setCerts] = useState([]);
  const [orgs,  setOrgs]  = useState([]);
  const [selCert, setSelCert] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get('/certifications'), api.get('/certifications/organizations')])
      .then(([c, o]) => { setCerts(c.data); setOrgs(o.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const TABS = [
    { id: 'overview',      label: 'Overview',      icon: '📊' },
    { id: 'requirements',  label: 'Requirements',  icon: '📋' },
    { id: 'timeline',      label: 'Timeline',      icon: '📅' },
    { id: 'workflows',     label: 'Workflows',     icon: '⚙️' },
  ];

  const totalCompliant = certs.reduce((a, c) => a + (c.completion_pct || 0), 0);
  const avgCompletion  = certs.length ? Math.round(totalCompliant / certs.length) : 0;
  const overdue        = certs.filter(c => isOverdue(c.target_date) && c.status === 'active').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Certification Tracker</div>
          <div className="page-subtitle">Multi-framework certification management across organizations</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tabs" style={{ marginBottom:20 }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${tab===t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="empty-state"><div className="spinner" /></div> : (
        <>
          {tab === 'overview'     && <OverviewTab certs={certs} orgs={orgs} avgCompletion={avgCompletion}
                                                  overdue={overdue} canEdit={canEdit} isAdmin={isAdmin} onRefresh={load} />}
          {tab === 'requirements' && <RequirementsTab certs={certs} selCert={selCert} setSelCert={setSelCert}
                                                       canEdit={canEdit} onRefresh={load} />}
          {tab === 'timeline'     && <TimelineTab certs={certs} selCert={selCert} setSelCert={setSelCert}
                                                   canEdit={canEdit} onRefresh={load} />}
          {tab === 'workflows'    && <WorkflowsTab certs={certs} selCert={selCert} setSelCert={setSelCert}
                                                    canEdit={canEdit} onRefresh={load} />}
        </>
      )}
    </div>
  );
}

/* ── Overview Tab ─────────────────────────────────────────────── */
function OverviewTab({ certs, orgs, avgCompletion, overdue, canEdit, isAdmin, onRefresh }) {
  const [showNewCert,  setShowNewCert]  = useState(false);
  const [showNewOrg,   setShowNewOrg]   = useState(false);
  const [showManageOrgs, setShowManageOrgs] = useState(false);
  const [filterFw,     setFilterFw]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const deleteOrg = async (id, name) => {
    if (!window.confirm(`Delete organization "${name}"?\n\nAll certifications linked to this organization will also be deleted.`)) return;
    try {
      await api.delete(`/certifications/organizations/${id}`);
      onRefresh();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to delete organization');
    }
  };

  const visible = certs.filter(c =>
    (!filterFw     || c.framework === filterFw) &&
    (!filterStatus || c.status    === filterStatus)
  );

  const byOrg = {};
  visible.forEach(c => {
    const key = c.org_name || 'No Organization';
    if (!byOrg[key]) byOrg[key] = [];
    byOrg[key].push(c);
  });

  return (
    <div>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {[
          { label:'Total Certifications', value: certs.length,   icon:'🏆', color:'#3b82f6' },
          { label:'Organizations',        value: orgs.length,    icon:'🏢', color:'#8b5cf6' },
          { label:'Avg Completion',       value:`${avgCompletion}%`, icon:'📈', color:'#10b981' },
          { label:'Overdue',              value: overdue,        icon:'⏰', color: overdue ? '#ef4444' : '#6b7280' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--surface2)', border:'1px solid var(--border1)',
               borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ fontSize:28 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', gap:10, marginBottom: showManageOrgs ? 12 : 20, flexWrap:'wrap', alignItems:'center' }}>
        <select style={{ ...sel, width:'auto', minWidth:140 }} value={filterFw} onChange={e => setFilterFw(e.target.value)}>
          <option value="">All Frameworks</option>
          {FRAMEWORKS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <select style={{ ...sel, width:'auto', minWidth:120 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {['active','paused','completed','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ flex:1 }} />
        {isAdmin && (
          <button style={{ ...btnS('default'), fontSize:12,
                            color: showManageOrgs ? '#8b5cf6' : 'var(--text2)',
                            border: showManageOrgs ? '1px solid #8b5cf6' : '1px solid var(--border2)' }}
            onClick={() => setShowManageOrgs(s => !s)}>
            🏢 Manage Organizations
          </button>
        )}
        {canEdit && (
          <>
            <button style={btnS('default')} onClick={() => setShowNewOrg(true)}>+ Organization</button>
            <button style={btnS('primary')} onClick={() => setShowNewCert(true)}>+ Certification</button>
          </>
        )}
      </div>

      {/* Manage Organizations panel */}
      {showManageOrgs && (
        <div style={{ background:'var(--surface2)', border:'1px solid #8b5cf640', borderRadius:12,
                      padding:16, marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#8b5cf6', textTransform:'uppercase',
                        letterSpacing:'0.06em', marginBottom:12 }}>
            All Organizations ({orgs.length})
          </div>
          {orgs.length === 0 ? (
            <div style={{ fontSize:13, color:'var(--text3)' }}>No organizations yet.</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px,1fr))', gap:10 }}>
              {orgs.map(o => {
                const certCount = certs.filter(c => c.org_id === o.id).length;
                return (
                  <div key={o.id} style={{ background:'var(--surface3)', border:'1px solid var(--border2)',
                                            borderRadius:8, padding:'10px 14px', display:'flex',
                                            alignItems:'center', gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text1)',
                                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        🏢 {o.name}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:2, display:'flex', gap:8 }}>
                        {o.industry && <span>{o.industry}</span>}
                        <span>{certCount} certification{certCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <button style={{ ...btnS('danger'), padding:'3px 10px', fontSize:11, flexShrink:0 }}
                      onClick={() => deleteOrg(o.id, o.name)}>
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Certification cards grouped by org */}
      {Object.keys(byOrg).length === 0 ? (
        <div className="empty-state"><p>No certifications found. Add one to get started.</p></div>
      ) : (
        Object.entries(byOrg).map(([orgName, orgCerts]) => {
          const orgObj = orgs.find(o => o.name === orgName);
          return (
          <div key={orgName} style={{ marginBottom:28 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text2)', textTransform:'uppercase',
                          letterSpacing:'0.07em', marginBottom:12, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              🏢 {orgName}
              <span style={{ fontSize:11, fontWeight:400, color:'var(--text3)' }}>({orgCerts.length} certification{orgCerts.length!==1?'s':''})</span>
              {orgObj?.industry && <span style={{ fontSize:10, fontWeight:400, color:'var(--text3)', textTransform:'none' }}>{orgObj.industry}</span>}
              {isAdmin && orgObj && (
                <button style={{ ...btnS('danger'), padding:'2px 9px', fontSize:10, marginLeft:'auto', textTransform:'none', letterSpacing:0 }}
                  onClick={() => deleteOrg(orgObj.id, orgName)}>
                  Delete Org
                </button>
              )}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px,1fr))', gap:14 }}>
              {orgCerts.map(c => <CertCard key={c.id} cert={c} orgs={orgs} onRefresh={onRefresh} canEdit={canEdit} />)}
            </div>
          </div>
          );
        })
      )}

      {showNewCert && <CertModal orgs={orgs} onClose={() => setShowNewCert(false)} onSave={onRefresh} />}
      {showNewOrg  && <OrgModal  onClose={() => setShowNewOrg(false)}  onSave={onRefresh} />}
    </div>
  );
}

function CertCard({ cert, orgs, onRefresh, canEdit }) {
  const f = fw(cert.framework);
  const p = ph(cert.phase);
  const [showEdit,    setShowEdit]    = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${cert.name}"?`)) return;
    await api.delete(`/certifications/${cert.id}`).catch(console.error);
    onRefresh();
  };

  const expiryWarning = cert.expiry_date && (() => {
    const days = Math.ceil((new Date(cert.expiry_date) - new Date()) / 86400000);
    return days < 90 ? days : null;
  })();

  return (
    <div style={{ background:'var(--surface2)', border:`1px solid var(--border1)`, borderRadius:12,
                  borderTop:`3px solid ${f.color}`, padding:18, display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:f.color, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>
            {f.label}
          </div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text1)', lineHeight:1.3 }}>{cert.name}</div>
          {cert.scope && <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>{cert.scope}</div>}
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {badge(cert.status==='active'?'#10b981':cert.status==='completed'?'#3b82f6':'#6b7280', cert.status)}
        </div>
      </div>

      {/* Phase progress bar */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
          {badge(p.color, p.label)}
          <span style={{ fontSize:13, fontWeight:700, color:f.color }}>{cert.completion_pct}%</span>
        </div>
        <div style={{ height:6, background:'var(--surface3)', borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${cert.completion_pct}%`, background:f.color, borderRadius:3, transition:'width 0.3s' }} />
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
        {cert.owner && <div><span style={{ color:'var(--text3)' }}>Owner: </span>{cert.owner}</div>}
        {cert.auditor && <div><span style={{ color:'var(--text3)' }}>Auditor: </span>{cert.auditor}</div>}
        {cert.target_date && (
          <div style={{ color: isOverdue(cert.target_date) && cert.phase !== 'certified' ? '#ef4444' : 'var(--text2)' }}>
            <span style={{ color:'var(--text3)' }}>Target: </span>{fmtD(cert.target_date)}
            {isOverdue(cert.target_date) && cert.phase !== 'certified' && ' ⚠️'}
          </div>
        )}
        {cert.certified_date && <div style={{ color:'#10b981' }}><span style={{ color:'var(--text3)' }}>Certified: </span>{fmtD(cert.certified_date)}</div>}
        {cert.expiry_date && (
          <div style={{ color: expiryWarning !== null ? (expiryWarning < 30 ? '#ef4444' : '#f59e0b') : 'var(--text2)' }}>
            <span style={{ color:'var(--text3)' }}>Expires: </span>{fmtD(cert.expiry_date)}
            {expiryWarning !== null && ` (${expiryWarning}d)`}
          </div>
        )}
      </div>

      {canEdit && (
        <div style={{ display:'flex', gap:6, marginTop:4 }}>
          <button style={{ ...btnS('sm'), flex:1 }} onClick={() => setShowEdit(true)}>Edit</button>
          <button style={{ ...btnS('danger'), padding:'4px 10px', fontSize:12 }} onClick={handleDelete}>Delete</button>
        </div>
      )}
      <button style={{ ...btnS('sm'), width:'100%', marginTop:4, fontSize:11,
                        color: showRoadmap ? f.color : 'var(--text3)',
                        border: `1px solid ${showRoadmap ? f.color : 'var(--border2)'}` }}
        onClick={() => setShowRoadmap(r => !r)}>
        {showRoadmap ? '▲ Hide Roadmap' : '🗺 View Implementation Roadmap'}
      </button>
      {showRoadmap && <FrameworkRoadmap framework={cert.framework} currentPhase={cert.phase} compact />}
      {showEdit && <CertModal cert={cert} orgs={[]} onClose={() => setShowEdit(false)} onSave={onRefresh} />}
    </div>
  );
}

/* ── Requirements Tab ─────────────────────────────────────────── */
function RequirementsTab({ certs, selCert, setSelCert, canEdit, onRefresh }) {
  const [reqs,     setReqs]     = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLevel, setFilterLevel]   = useState('');
  const [search,   setSearch]   = useState('');
  const [editReq,  setEditReq]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [expanded,    setExpanded]    = useState({});
  const [showRoadmap, setShowRoadmap] = useState(false);

  useEffect(() => {
    if (!selCert) return;
    setLoading(true);
    api.get(`/certifications/${selCert}/requirements`)
      .then(r => setReqs(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selCert]);

  const visible = reqs.filter(r =>
    (!filterStatus || (r.resp_status || 'not_assessed') === filterStatus) &&
    (!filterLevel  || String(r.level) === filterLevel) &&
    (!search       || r.title.toLowerCase().includes(search.toLowerCase()) || r.req_id.includes(search))
  );

  const stats = reqs.reduce((a, r) => {
    const s = r.resp_status || 'not_assessed';
    a[s] = (a[s]||0) + 1;
    return a;
  }, {});

  return (
    <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:20, alignItems:'start' }}>
      {/* Left panel — cert selector */}
      <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border1)', fontSize:12, fontWeight:700,
                      textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text3)' }}>
          Select Certification
        </div>
        {certs.length === 0 ? (
          <div style={{ padding:16, fontSize:13, color:'var(--text3)' }}>No certifications yet.</div>
        ) : certs.map(c => {
          const f = fw(c.framework);
          return (
            <div key={c.id} onClick={() => setSelCert(c.id)}
              style={{ padding:'12px 16px', cursor:'pointer', borderLeft:`3px solid ${selCert===c.id ? f.color : 'transparent'}`,
                       background: selCert===c.id ? `${f.color}10` : 'transparent',
                       borderBottom:'1px solid var(--border1)', transition:'background 0.15s' }}>
              <div style={{ fontSize:10, color:f.color, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{f.label}</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text1)', marginTop:2 }}>{c.name}</div>
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{c.org_name || 'No org'}</div>
              <div style={{ marginTop:6, height:4, background:'var(--surface3)', borderRadius:2 }}>
                <div style={{ height:'100%', width:`${c.completion_pct}%`, background:f.color, borderRadius:2 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Right panel */}
      <div>
        {!selCert ? (
          <div className="empty-state"><p>Select a certification to view its requirements.</p></div>
        ) : loading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : (
          <>
            {/* Roadmap toggle */}
            {(() => {
              const selCertObj = certs.find(c => c.id === selCert);
              if (!selCertObj) return null;
              const f = fw(selCertObj.framework);
              return (
                <div style={{ marginBottom:16 }}>
                  <button style={{ ...btnS('sm'), fontSize:11, width:'100%', justifyContent:'center',
                                    display:'flex', alignItems:'center', gap:6,
                                    color: showRoadmap ? f.color : 'var(--text3)',
                                    border:`1px solid ${showRoadmap ? f.color : 'var(--border2)'}` }}
                    onClick={() => setShowRoadmap(r => !r)}>
                    🗺 {showRoadmap ? '▲ Hide Implementation Roadmap' : 'View Implementation Roadmap'}
                    <span style={{ fontSize:10, color:'var(--text3)', fontWeight:400 }}>— {ph(selCertObj.phase).label} phase</span>
                  </button>
                  {showRoadmap && (
                    <div style={{ background:'var(--surface2)', border:`1px solid ${f.color}25`, borderRadius:10, padding:20, marginTop:8 }}>
                      <FrameworkRoadmap framework={selCertObj.framework} currentPhase={selCertObj.phase} compact={false} />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Stats chips */}
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              {REQ_STATUSES.map(s => (
                <div key={s.id} onClick={() => setFilterStatus(filterStatus===s.id?'':s.id)}
                  style={{ padding:'5px 12px', borderRadius:16, cursor:'pointer', fontSize:12, fontWeight:600,
                           background: filterStatus===s.id ? `${s.color}30` : 'var(--surface3)',
                           border:`1px solid ${filterStatus===s.id ? s.color : 'var(--border2)'}`,
                           color:s.color, transition:'all 0.15s' }}>
                  {s.label} ({stats[s.id]||0})
                </div>
              ))}
              <button onClick={() => setFilterStatus('')}
                style={{ ...btnS('sm'), color:'var(--text3)', marginLeft:'auto' }}>Clear filter</button>
            </div>

            {/* Filters */}
            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
              <input style={{ ...inp, maxWidth:280 }} placeholder="Search requirements..." value={search}
                     onChange={e => setSearch(e.target.value)} />
              <select style={{ ...sel, width:'auto', minWidth:130 }} value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
                <option value="">All levels</option>
                <option value="1">Main requirements</option>
                <option value="2">Sub-requirements</option>
              </select>
            </div>

            {/* Requirements list */}
            <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:12, overflow:'hidden' }}>
              {visible.length === 0 ? (
                <div style={{ padding:32, textAlign:'center', color:'var(--text3)', fontSize:13 }}>No matching requirements.</div>
              ) : visible.map(r => {
                const status = r.resp_status || 'not_assessed';
                const rStatus = rs(status);
                const isMain = r.level === 1;
                return (
                  <div key={r.id} style={{ borderBottom:'1px solid var(--border1)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                                  background: isMain ? 'var(--surface3)' : 'transparent',
                                  paddingLeft: isMain ? 16 : 32, cursor:'pointer' }}
                         onClick={() => setExpanded(e => ({ ...e, [r.id]: !e[r.id] }))}>
                      <div style={{ width:36, fontSize:12, fontWeight:700, color:'var(--text3)',
                                    fontFamily:'monospace', flexShrink:0 }}>
                        {r.req_id}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight: isMain ? 700 : 500, color:'var(--text1)',
                                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {r.title}
                        </div>
                        {r.resp_notes && (
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {r.resp_notes}
                          </div>
                        )}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                        {r.assignee && <span style={{ fontSize:11, color:'var(--text3)' }}>{r.assignee}</span>}
                        {r.due_date && (
                          <span style={{ fontSize:11, color: isOverdue(r.due_date) && status !== 'compliant' ? '#ef4444' : 'var(--text3)' }}>
                            {fmtD(r.due_date)}
                          </span>
                        )}
                        {badge(rStatus.color, rStatus.label)}
                        {canEdit && (
                          <button style={{ ...btnS('sm') }} onClick={e => { e.stopPropagation(); setEditReq(r); }}>
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                    {expanded[r.id] && (
                      <div style={{ padding:'12px 16px 12px 64px', background:'var(--surface3)',
                                    borderTop:'1px solid var(--border1)' }}>
                        <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6, marginBottom:8 }}>{r.description}</div>
                        {r.response && (
                          <div style={{ marginTop:8 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Response</div>
                            <div style={{ fontSize:12, color:'var(--text1)', padding:'8px 12px', background:'var(--surface2)', borderRadius:6 }}>{r.response}</div>
                          </div>
                        )}
                        {r.evidence_notes && (
                          <div style={{ marginTop:8 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Evidence</div>
                            <div style={{ fontSize:12, color:'var(--text1)', padding:'8px 12px', background:'var(--surface2)', borderRadius:6 }}>{r.evidence_notes}</div>
                          </div>
                        )}
                        {r.resp_updated && (
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:8 }}>Last updated: {fmtDT(r.resp_updated)}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {editReq && (
        <ReqModal req={editReq} certId={selCert} onClose={() => setEditReq(null)}
                  onSave={() => { setEditReq(null); api.get(`/certifications/${selCert}/requirements`).then(r => setReqs(r.data)); onRefresh(); }} />
      )}
    </div>
  );
}

/* ── Timeline Tab ─────────────────────────────────────────────── */
function TimelineTab({ certs, selCert, setSelCert, canEdit, onRefresh }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editEv,  setEditEv]  = useState(null);
  const [form,    setForm]    = useState({ event_type:'milestone', title:'', description:'', event_date:new Date().toISOString().slice(0,10), status:'planned' });

  const loadEvents = useCallback(() => {
    if (!selCert) return;
    setLoading(true);
    api.get(`/certifications/${selCert}/timeline`)
      .then(r => setEvents(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selCert]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleSaveEvent = async () => {
    if (!form.title.trim()) return;
    try {
      if (editEv) {
        await api.put(`/certifications/timeline/${editEv.id}`, form);
      } else {
        await api.post(`/certifications/${selCert}/timeline`, form);
      }
      setShowAdd(false); setEditEv(null);
      setForm({ event_type:'milestone', title:'', description:'', event_date:new Date().toISOString().slice(0,10), status:'planned' });
      loadEvents();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    await api.delete(`/certifications/timeline/${id}`).catch(console.error);
    loadEvents();
  };

  const statusColor = { planned:'#6b7280', completed:'#10b981', cancelled:'#9ca3af', overdue:'#ef4444' };

  const cert = certs.find(c => c.id === selCert);

  return (
    <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:20, alignItems:'start' }}>
      {/* Cert selector */}
      <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border1)', fontSize:12, fontWeight:700,
                      textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text3)' }}>
          Select Certification
        </div>
        {certs.map(c => {
          const f = fw(c.framework);
          return (
            <div key={c.id} onClick={() => setSelCert(c.id)}
              style={{ padding:'12px 16px', cursor:'pointer', borderLeft:`3px solid ${selCert===c.id?f.color:'transparent'}`,
                       background: selCert===c.id?`${f.color}10`:'transparent', borderBottom:'1px solid var(--border1)' }}>
              <div style={{ fontSize:10, color:f.color, fontWeight:700, textTransform:'uppercase' }}>{f.label}</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text1)', marginTop:2 }}>{c.name}</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>{c.org_name || 'No org'}</div>
            </div>
          );
        })}
      </div>

      {/* Timeline panel */}
      <div>
        {!selCert ? (
          <div className="empty-state"><p>Select a certification to view its timeline.</p></div>
        ) : (
          <>
            {/* Phase progress track + Roadmap */}
            {cert && (
              <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:12, padding:20, marginBottom:20 }}>
                <FrameworkRoadmap framework={cert.framework} currentPhase={cert.phase} compact={false} />
              </div>
            )}

            {/* Timeline header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text1)' }}>
                Events ({events.length})
              </div>
              {canEdit && (
                <button style={btnS('primary')} onClick={() => { setShowAdd(true); setEditEv(null); setForm({ event_type:'milestone', title:'', description:'', event_date:new Date().toISOString().slice(0,10), status:'planned' }); }}>
                  + Add Event
                </button>
              )}
            </div>

            {/* Add/Edit form */}
            {(showAdd || editEv) && (
              <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:12, padding:20, marginBottom:20 }}>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>{editEv ? 'Edit Event' : 'New Timeline Event'}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                  <div>
                    <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:5 }}>Type</label>
                    <select style={sel} value={form.event_type} onChange={e => setForm(f=>({...f, event_type:e.target.value}))}>
                      {TL_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:5 }}>Status</label>
                    <select style={sel} value={form.status} onChange={e => setForm(f=>({...f, status:e.target.value}))}>
                      {['planned','completed','cancelled','overdue'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:5 }}>Date</label>
                    <input type="date" style={inp} value={form.event_date} onChange={e => setForm(f=>({...f, event_date:e.target.value}))} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:5 }}>Title *</label>
                    <input style={inp} value={form.title} onChange={e => setForm(f=>({...f, title:e.target.value}))} placeholder="Event title" />
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:5 }}>Description</label>
                  <textarea style={{ ...inp, minHeight:70, resize:'vertical' }} value={form.description||''}
                             onChange={e => setForm(f=>({...f, description:e.target.value}))} placeholder="Optional details..." />
                </div>
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                  <button style={btnS('default')} onClick={() => { setShowAdd(false); setEditEv(null); }}>Cancel</button>
                  <button style={btnS('primary')} onClick={handleSaveEvent}>Save Event</button>
                </div>
              </div>
            )}

            {/* Timeline entries */}
            {loading ? <div className="empty-state"><div className="spinner" /></div> :
            events.length === 0 ? (
              <div className="empty-state"><p>No timeline events yet.</p></div>
            ) : (
              <div style={{ position:'relative', paddingLeft:40 }}>
                <div style={{ position:'absolute', left:16, top:0, bottom:0, width:2, background:'var(--border1)' }} />
                {events.map(ev => {
                  const t = tl(ev.event_type);
                  const sc = statusColor[ev.status] || '#6b7280';
                  return (
                    <div key={ev.id} style={{ position:'relative', marginBottom:20 }}>
                      <div style={{ position:'absolute', left:-32, top:10, width:28, height:28, borderRadius:'50%',
                                    background:'var(--surface2)', border:`2px solid ${t.color}`,
                                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>
                        {t.icon}
                      </div>
                      <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:10, padding:16 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:'var(--text1)' }}>{ev.title}</div>
                            <div style={{ fontSize:11, color:'var(--text3)', marginTop:3, display:'flex', gap:8 }}>
                              <span>📅 {fmtD(ev.event_date)}</span>
                              <span>🕐 {fmtDT(ev.created_at)}</span>
                              {ev.full_name && <span>👤 {ev.full_name || ev.username}</span>}
                            </div>
                          </div>
                          <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                            {badge(sc, ev.status)}
                            {badge(t.color, ev.event_type)}
                            {canEdit && (
                              <>
                                <button style={btnS('sm')} onClick={() => { setEditEv(ev); setShowAdd(false); setForm({ event_type:ev.event_type, title:ev.title, description:ev.description||'', event_date:ev.event_date?.slice(0,10)||'', status:ev.status }); }}>Edit</button>
                                <button style={{ ...btnS('sm'), color:'#ef4444', border:'1px solid #ef4444' }} onClick={() => handleDelete(ev.id)}>✕</button>
                              </>
                            )}
                          </div>
                        </div>
                        {ev.description && <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.5 }}>{ev.description}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Workflows Tab (Kanban) ───────────────────────────────────── */
function WorkflowsTab({ certs, selCert, setSelCert, canEdit }) {
  const [workflows, setWorkflows] = useState([]);
  const [selWf,     setSelWf]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [showNew,   setShowNew]   = useState(false);
  const [newName,   setNewName]   = useState('');
  const [newDesc,   setNewDesc]   = useState('');

  const loadWf = useCallback(() => {
    if (!selCert) return;
    setLoading(true);
    api.get(`/certifications/${selCert}/workflows`)
      .then(r => { setWorkflows(r.data); if (r.data.length && !selWf) setSelWf(r.data[0].id); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selCert]); // eslint-disable-line

  useEffect(() => { setSelWf(null); setWorkflows([]); }, [selCert]);
  useEffect(() => { loadWf(); }, [loadWf]);

  const createWf = async () => {
    if (!newName.trim()) return;
    const r = await api.post(`/certifications/${selCert}/workflows`, { name: newName, description: newDesc }).catch(console.error);
    if (r?.data) { setNewName(''); setNewDesc(''); setShowNew(false); loadWf(); setSelWf(r.data.id); }
  };

  const deleteWf = async id => {
    if (!window.confirm('Delete this board and all its cards?')) return;
    await api.delete(`/certifications/workflows/${id}`).catch(console.error);
    if (selWf === id) setSelWf(null);
    loadWf();
  };

  const currentWf = workflows.find(w => w.id === selWf);

  return (
    <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:20, alignItems:'start' }}>
      {/* Left sidebar: cert + board list */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border1)', fontSize:11, fontWeight:700,
                        textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text3)' }}>Certification</div>
          {certs.length === 0 && <div style={{ padding:'16px 14px', fontSize:12, color:'var(--text3)' }}>No certifications yet</div>}
          {certs.map(c => {
            const f = fw(c.framework);
            return (
              <div key={c.id} onClick={() => setSelCert(c.id)}
                style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid var(--border1)',
                         borderLeft:`3px solid ${selCert===c.id ? f.color : 'transparent'}`,
                         background: selCert===c.id ? `${f.color}12` : 'transparent' }}>
                <div style={{ fontSize:10, color:f.color, fontWeight:700, textTransform:'uppercase' }}>{f.label}</div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text1)', marginTop:1 }}>{c.name}</div>
              </div>
            );
          })}
        </div>

        {selCert && (
          <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border1)', fontSize:11, fontWeight:700,
                          textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text3)',
                          display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              Boards
              {canEdit && <button onClick={() => setShowNew(true)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', fontSize:18, lineHeight:1, padding:0 }}>+</button>}
            </div>
            {loading && <div style={{ padding:12 }}><div className="spinner" /></div>}
            {workflows.map(w => (
              <div key={w.id} onClick={() => setSelWf(w.id)}
                style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid var(--border1)',
                         borderLeft:`3px solid ${selWf===w.id ? 'var(--accent)' : 'transparent'}`,
                         background: selWf===w.id ? 'var(--surface3)' : 'transparent',
                         display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.name}</div>
                  {w.description && <div style={{ fontSize:11, color:'var(--text3)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.description}</div>}
                </div>
                {canEdit && selWf===w.id && (
                  <button onClick={e => { e.stopPropagation(); deleteWf(w.id); }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:13, flexShrink:0, padding:'0 2px' }}>✕</button>
                )}
              </div>
            ))}
            {!loading && workflows.length === 0 && (
              <div style={{ padding:'16px 14px', fontSize:12, color:'var(--text3)' }}>No boards yet — create one</div>
            )}
          </div>
        )}

        {showNew && (
          <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:12, padding:14 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:10, color:'var(--text1)' }}>New Board</div>
            <input style={{ ...inp, marginBottom:8 }} placeholder="Board name *" value={newName}
              onChange={e => setNewName(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key==='Enter') createWf(); if (e.key==='Escape') setShowNew(false); }} />
            <input style={{ ...inp, marginBottom:10 }} placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            <div style={{ display:'flex', gap:6 }}>
              <button style={{ ...btnS('default'), flex:1 }} onClick={() => setShowNew(false)}>Cancel</button>
              <button style={{ ...btnS('primary'), flex:1 }} onClick={createWf}>Create</button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Kanban board */}
      <div>
        {!selCert ? (
          <div className="empty-state"><p>Select a certification to view boards.</p></div>
        ) : !currentWf ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>Select a board from the left or create a new one.</p>
            {canEdit && <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Board</button>}
          </div>
        ) : (
          <KanbanBoard key={currentWf.id} workflow={currentWf} canEdit={canEdit} onDelete={() => deleteWf(currentWf.id)} />
        )}
      </div>
    </div>
  );
}

/* ── Kanban Board ─────────────────────────────────────────────── */
function KanbanBoard({ workflow, canEdit, onDelete }) {
  const [cards,   setCards]   = useState(workflow.steps || []);
  const [dragId,  setDragId]  = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [detail,  setDetail]  = useState(null);
  const [filterPri,      setFilterPri]      = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');

  const assignees = [...new Set(cards.map(c => c.assignee).filter(Boolean))];
  const visible   = cards.filter(c =>
    (!filterPri      || (c.priority || 'medium') === filterPri) &&
    (!filterAssignee || c.assignee === filterAssignee)
  );
  const byCol = KANBAN_COLS.reduce((a, col) => { a[col.id] = visible.filter(c => c.status === col.id); return a; }, {});
  const done  = cards.filter(c => c.status === 'completed').length;
  const pct   = cards.length ? Math.round(100 * done / cards.length) : 0;

  const onDragStart = (e, id) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver  = (e, colId) => { e.preventDefault(); setOverCol(colId); };
  const onDragLeave = () => setOverCol(null);
  const onDrop = async (e, colId) => {
    e.preventDefault(); setOverCol(null);
    if (!dragId || !canEdit) { setDragId(null); return; }
    const card = cards.find(c => c.id === dragId); setDragId(null);
    if (!card || card.status === colId) return;
    const updated = { ...card, status: colId };
    setCards(prev => prev.map(c => c.id === card.id ? updated : c));
    await api.put(`/certifications/workflows/steps/${card.id}`, updated).catch(console.error);
  };

  const addCard = async (colId, form) => {
    const r = await api.post(`/certifications/workflows/${workflow.id}/steps`, { ...form, status: colId }).catch(console.error);
    if (r?.data) setCards(prev => [...prev, r.data]);
  };

  const updateCard = async (id, data) => {
    const card = cards.find(c => c.id === id);
    const merged = { ...card, ...data };
    setCards(prev => prev.map(c => c.id === id ? merged : c));
    if (detail?.id === id) setDetail(merged);
    await api.put(`/certifications/workflows/steps/${id}`, merged).catch(console.error);
  };

  const deleteCard = async id => {
    await api.delete(`/certifications/workflows/steps/${id}`).catch(console.error);
    setCards(prev => prev.filter(c => c.id !== id));
    if (detail?.id === id) setDetail(null);
  };

  return (
    <div>
      {/* Board header */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:17, fontWeight:700, color:'var(--text1)' }}>{workflow.name}</div>
          {workflow.description && <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{workflow.description}</div>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:180 }}>
          <div style={{ flex:1, height:6, borderRadius:3, background:'var(--border1)', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${pct}%`, background:pct===100?'#10b981':'var(--accent)', transition:'width 0.4s' }} />
          </div>
          <span style={{ fontSize:13, fontWeight:700, color:pct===100?'#10b981':'var(--text2)', minWidth:38 }}>{pct}%</span>
          <span style={{ fontSize:12, color:'var(--text3)', whiteSpace:'nowrap' }}>{done}/{cards.length}</span>
        </div>
        {canEdit && <button style={{ ...btnS('danger'), padding:'5px 12px', fontSize:12 }} onClick={onDelete}>Delete Board</button>}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <select style={{ ...sel, width:'auto', fontSize:12, padding:'5px 10px' }} value={filterPri} onChange={e => setFilterPri(e.target.value)}>
          <option value="">All Priorities</option>
          {KANBAN_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        {assignees.length > 0 && (
          <select style={{ ...sel, width:'auto', fontSize:12, padding:'5px 10px' }} value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
            <option value="">All Assignees</option>
            {assignees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <span style={{ fontSize:12, color:'var(--text3)' }}>{visible.length} card{visible.length!==1?'s':''}</span>
      </div>

      {/* Columns */}
      <div style={{ display:'flex', gap:12, overflowX:'auto', alignItems:'flex-start', paddingBottom:8 }}>
        {KANBAN_COLS.map(col => (
          <KanbanColumn key={col.id} col={col} cards={byCol[col.id]||[]} canEdit={canEdit}
            isOver={overCol===col.id}
            onDragOver={e => onDragOver(e, col.id)}
            onDragLeave={onDragLeave}
            onDrop={e => onDrop(e, col.id)}
            onCardDragStart={onDragStart}
            onCardClick={card => setDetail({ ...card })}
            onAddCard={form => addCard(col.id, form)} />
        ))}
      </div>

      {detail && (
        <CardDetailModal card={detail} canEdit={canEdit}
          onClose={() => setDetail(null)}
          onUpdate={updateCard}
          onDelete={deleteCard} />
      )}
    </div>
  );
}

/* ── Kanban Column ────────────────────────────────────────────── */
function KanbanColumn({ col, cards, canEdit, isOver, onDragOver, onDragLeave, onDrop, onCardDragStart, onCardClick, onAddCard }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title:'', assignee:'', priority:'medium', due_date:'' });

  const submit = async () => {
    if (!form.title.trim()) return;
    await onAddCard(form);
    setForm({ title:'', assignee:'', priority:'medium', due_date:'' });
    setShowAdd(false);
  };

  return (
    <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      style={{ minWidth:210, flex:'0 0 210px', borderRadius:10, overflow:'hidden',
               background: isOver ? `${col.color}14` : 'var(--surface2)',
               border:`1px solid ${isOver ? col.color : 'var(--border1)'}`,
               transition:'border-color 0.15s, background 0.15s', display:'flex', flexDirection:'column' }}>

      {/* Column header */}
      <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--border1)',
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    background:`${col.color}18` }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <div style={{ width:9, height:9, borderRadius:'50%', background:col.color }} />
          <span style={{ fontSize:12, fontWeight:700, color:col.color, textTransform:'uppercase', letterSpacing:'0.05em' }}>{col.label}</span>
          <span style={{ background:'var(--surface3)', color:'var(--text3)', borderRadius:10, padding:'1px 7px', fontSize:11, fontWeight:600 }}>{cards.length}</span>
        </div>
        {canEdit && (
          <button onClick={() => setShowAdd(s => !s)}
            style={{ background:'none', border:'none', cursor:'pointer', color:col.color, fontSize:18, lineHeight:1, padding:'0 2px' }}>+</button>
        )}
      </div>

      {/* Cards */}
      <div style={{ flex:1, padding:'8px 8px 4px', display:'flex', flexDirection:'column', gap:8, minHeight:120 }}>
        {cards.map(card => (
          <KanbanCard key={card.id} card={card} canEdit={canEdit} onDragStart={onCardDragStart} onClick={onCardClick} />
        ))}
      </div>

      {/* Quick-add */}
      {canEdit && showAdd && (
        <div style={{ padding:'10px 10px 12px', borderTop:'1px solid var(--border1)', display:'flex', flexDirection:'column', gap:6 }}>
          <input style={{ ...inp, fontSize:12, padding:'6px 8px' }} placeholder="Card title *"
            value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))}
            onKeyDown={e => { if (e.key==='Enter') submit(); if (e.key==='Escape') setShowAdd(false); }}
            autoFocus />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
            <input style={{ ...inp, fontSize:11, padding:'5px 7px' }} placeholder="Assignee"
              value={form.assignee} onChange={e => setForm(f => ({...f, assignee:e.target.value}))} />
            <select style={{ ...sel, fontSize:11, padding:'5px 7px' }} value={form.priority}
              onChange={e => setForm(f => ({...f, priority:e.target.value}))}>
              {KANBAN_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <input type="date" style={{ ...inp, fontSize:11, padding:'5px 7px' }}
            value={form.due_date} onChange={e => setForm(f => ({...f, due_date:e.target.value}))} />
          <div style={{ display:'flex', gap:5 }}>
            <button style={{ ...btnS('default'), flex:1, padding:'5px 0', fontSize:12 }} onClick={() => setShowAdd(false)}>Cancel</button>
            <button style={{ ...btnS('primary'), flex:1, padding:'5px 0', fontSize:12 }} onClick={submit}>Add</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Kanban Card ──────────────────────────────────────────────── */
function KanbanCard({ card, canEdit, onDragStart, onClick }) {
  const p       = kpri(card.priority || 'medium');
  const overdue = card.due_date && new Date(card.due_date) < new Date() && card.status !== 'completed';

  return (
    <div draggable={canEdit} onDragStart={e => onDragStart(e, card.id)} onClick={() => onClick(card)}
      style={{ background:'var(--surface3)', border:'1px solid var(--border1)', borderRadius:8,
               padding:'10px 11px', cursor:canEdit?'grab':'pointer',
               borderLeft:`3px solid ${p.color}`, transition:'box-shadow 0.15s',
               userSelect:'none' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow='0 3px 12px rgba(0,0,0,0.25)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>

      {/* Priority + title */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:6, marginBottom:5 }}>
        <span style={{ fontSize:10, fontWeight:700, color:p.color, background:`${p.color}20`,
                       padding:'1px 6px', borderRadius:4, flexShrink:0, marginTop:1 }}>{p.label}</span>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--text1)', lineHeight:1.35,
                      textDecoration: card.status==='completed' ? 'line-through' : 'none' }}>{card.title}</div>
      </div>

      {card.description && (
        <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6,
                      display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
          {card.description}
        </div>
      )}

      {/* Meta */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginTop:4 }}>
        {card.assignee && (
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:18, height:18, borderRadius:'50%', background:'var(--accent)', color:'#fff',
                          fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {card.assignee[0].toUpperCase()}
            </div>
            <span style={{ fontSize:11, color:'var(--text2)' }}>{card.assignee}</span>
          </div>
        )}
        {card.due_date && (
          <span style={{ fontSize:11, color:overdue?'#ef4444':'var(--text3)', fontWeight:overdue?600:400 }}>
            📅 {fmtD(card.due_date)}
          </span>
        )}
        {card.status === 'completed' && (
          <span style={{ fontSize:10, color:'#10b981', fontWeight:600 }}>✓ Done</span>
        )}
      </div>
    </div>
  );
}

/* ── Card Detail Modal ────────────────────────────────────────── */
function CardDetailModal({ card, canEdit, onClose, onUpdate, onDelete }) {
  const [form, setForm] = useState({
    title:       card.title       || '',
    description: card.description || '',
    assignee:    card.assignee    || '',
    priority:    card.priority    || 'medium',
    due_date:    card.due_date?.slice(0,10) || '',
    status:      card.status      || 'pending',
    notes:       card.notes       || '',
    step_number: card.step_number || 1,
  });
  const [saving, setSaving] = useState(false);
  const p   = kpri(form.priority);
  const col = KANBAN_COLS.find(c => c.id === form.status) || KANBAN_COLS[0];

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await onUpdate(card.id, form);
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:640, width:'96%' }}>
        <div className="modal-header" style={{ borderLeft:`4px solid ${p.color}` }}>
          <div>
            <div style={{ fontSize:11, marginBottom:4, display:'flex', gap:8 }}>
              <span style={{ color:p.color, fontWeight:700, fontSize:11, background:`${p.color}18`, padding:'2px 7px', borderRadius:4 }}>{p.label}</span>
              <span style={{ color:col.color, fontWeight:600 }}>● {col.label}</span>
            </div>
            <h2>Card Detail</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="form-group">
            <label>Title</label>
            <input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} disabled={!canEdit} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))} disabled={!canEdit}>
                {KANBAN_COLS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select value={form.priority} onChange={e => setForm(f=>({...f,priority:e.target.value}))} disabled={!canEdit}>
                {KANBAN_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Assignee</label>
              <input value={form.assignee} onChange={e => setForm(f=>({...f,assignee:e.target.value}))} disabled={!canEdit} placeholder="Name" />
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f=>({...f,due_date:e.target.value}))} disabled={!canEdit} />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea rows={3} value={form.description}
              onChange={e => setForm(f=>({...f,description:e.target.value}))}
              disabled={!canEdit} placeholder="Describe the task…" style={{ resize:'vertical' }} />
          </div>
          <div className="form-group">
            <label>Notes / Comments</label>
            <textarea rows={3} value={form.notes}
              onChange={e => setForm(f=>({...f,notes:e.target.value}))}
              disabled={!canEdit} placeholder="Add notes or comments…" style={{ resize:'vertical' }} />
          </div>
          {card.completed_at && (
            <div style={{ fontSize:12, color:'#10b981', padding:'8px 12px', background:'#10b98118', borderRadius:6 }}>
              ✅ Completed: {fmtDT(card.completed_at)}
            </div>
          )}
        </div>
        <div className="modal-footer">
          {canEdit && (
            <button className="btn btn-danger" style={{ marginRight:'auto' }}
              onClick={() => { if (window.confirm('Delete this card?')) { onDelete(card.id); onClose(); } }}>
              Delete Card
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {canEdit && (
            <button className="btn btn-primary" onClick={save} disabled={saving || !form.title.trim()}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Modals ───────────────────────────────────────────────────── */
function CertModal({ cert, orgs, onClose, onSave }) {
  const [form, setForm] = useState({
    org_id:         cert?.org_id         || '',
    framework:      cert?.framework      || 'PCIDSS',
    name:           cert?.name           || '',
    scope:          cert?.scope          || '',
    phase:          cert?.phase          || 'planning',
    target_date:    cert?.target_date?.slice(0,10) || '',
    certified_date: cert?.certified_date?.slice(0,10) || '',
    expiry_date:    cert?.expiry_date?.slice(0,10) || '',
    auditor:        cert?.auditor        || '',
    owner:          cert?.owner          || '',
    status:         cert?.status         || 'active',
    notes:          cert?.notes          || '',
  });
  const [err, setErr] = useState('');

  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      if (cert) {
        await api.put(`/certifications/${cert.id}`, form);
      } else {
        await api.post('/certifications', form);
      }
      onSave(); onClose();
    } catch (ex) { setErr(ex.response?.data?.error || 'Error'); }
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:600 }}>
        <div className="modal-header">
          <h2>{cert ? 'Edit Certification' : 'New Certification'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ maxHeight:'70vh', overflowY:'auto' }}>
            {err && <div className="alert alert-error" style={{ marginBottom:12 }}>{err}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label>Certification Name *</label>
                <input style={inp} value={form.name} onChange={f('name')} required placeholder="e.g., PCI DSS Certification 2026" />
              </div>
              <div className="form-group">
                <label>Framework *</label>
                <select style={sel} value={form.framework} onChange={f('framework')}>
                  {FRAMEWORKS.map(fw => <option key={fw.id} value={fw.id}>{fw.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Organization</label>
                <select style={sel} value={form.org_id} onChange={f('org_id')}>
                  <option value="">No organization</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Phase</label>
                <select style={sel} value={form.phase} onChange={f('phase')}>
                  {PHASES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select style={sel} value={form.status} onChange={f('status')}>
                  {['active','paused','completed','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Target Date</label>
                <input type="date" style={inp} value={form.target_date} onChange={f('target_date')} />
              </div>
              <div className="form-group">
                <label>Certified Date</label>
                <input type="date" style={inp} value={form.certified_date} onChange={f('certified_date')} />
              </div>
              <div className="form-group">
                <label>Expiry Date</label>
                <input type="date" style={inp} value={form.expiry_date} onChange={f('expiry_date')} />
              </div>
              <div className="form-group">
                <label>Owner</label>
                <input style={inp} value={form.owner} onChange={f('owner')} placeholder="Name or team" />
              </div>
              <div className="form-group">
                <label>Auditor / QSA</label>
                <input style={inp} value={form.auditor} onChange={f('auditor')} placeholder="Auditing firm or name" />
              </div>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label>Scope</label>
                <textarea style={{ ...inp, minHeight:60, resize:'vertical' }} value={form.scope} onChange={f('scope')}
                           placeholder="Define the scope of this certification..." />
              </div>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label>Notes</label>
                <textarea style={{ ...inp, minHeight:60, resize:'vertical' }} value={form.notes} onChange={f('notes')} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{cert ? 'Save Changes' : 'Create Certification'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OrgModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name:'', industry:'', contact:'', description:'' });
  const [err, setErr] = useState('');

  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      await api.post('/certifications/organizations', form);
      onSave(); onClose();
    } catch (ex) { setErr(ex.response?.data?.error || 'Error'); }
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:480 }}>
        <div className="modal-header">
          <h2>New Organization</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {err && <div className="alert alert-error" style={{ marginBottom:12 }}>{err}</div>}
            <div className="form-group"><label>Organization Name *</label><input style={inp} value={form.name} onChange={f('name')} required /></div>
            <div className="form-group"><label>Industry</label><input style={inp} value={form.industry} onChange={f('industry')} placeholder="e.g., Financial Services" /></div>
            <div className="form-group"><label>Contact</label><input style={inp} value={form.contact} onChange={f('contact')} placeholder="Primary contact name" /></div>
            <div className="form-group"><label>Description</label><textarea style={{ ...inp, minHeight:70, resize:'vertical' }} value={form.description} onChange={f('description')} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Organization</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReqModal({ req, certId, onClose, onSave }) {
  const [form, setForm] = useState({
    status:         req.resp_status     || 'not_assessed',
    response:       req.response        || '',
    evidence_notes: req.evidence_notes  || '',
    assignee:       req.assignee        || '',
    due_date:       req.due_date?.slice(0,10) || '',
    completed_date: req.completed_date?.slice(0,10) || '',
    notes:          req.resp_notes      || '',
  });
  const [err, setErr] = useState('');

  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      await api.put(`/certifications/${certId}/requirements/${req.id}`, form);
      onSave();
    } catch (ex) { setErr(ex.response?.data?.error || 'Error'); }
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:560 }}>
        <div className="modal-header">
          <h2><span style={{ fontFamily:'monospace', fontSize:14, color:'var(--text3)' }}>{req.req_id}</span> — Requirement Response</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ maxHeight:'65vh', overflowY:'auto' }}>
            {err && <div className="alert alert-error" style={{ marginBottom:12 }}>{err}</div>}
            <div style={{ padding:'12px 14px', background:'var(--surface3)', borderRadius:8, marginBottom:16, fontSize:13, color:'var(--text2)' }}>
              {req.title}
              {req.description && <div style={{ fontSize:12, color:'var(--text3)', marginTop:6, lineHeight:1.5 }}>{req.description}</div>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div className="form-group">
                <label>Compliance Status</label>
                <select style={sel} value={form.status} onChange={f('status')}>
                  {REQ_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Assignee</label>
                <input style={inp} value={form.assignee} onChange={f('assignee')} placeholder="Person responsible" />
              </div>
              <div className="form-group">
                <label>Due Date</label>
                <input type="date" style={inp} value={form.due_date} onChange={f('due_date')} />
              </div>
              <div className="form-group">
                <label>Completed Date</label>
                <input type="date" style={inp} value={form.completed_date} onChange={f('completed_date')} />
              </div>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label>Response / Implementation Description</label>
                <textarea style={{ ...inp, minHeight:80, resize:'vertical' }} value={form.response} onChange={f('response')}
                           placeholder="Describe how this requirement is being met..." />
              </div>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label>Evidence Notes</label>
                <textarea style={{ ...inp, minHeight:60, resize:'vertical' }} value={form.evidence_notes} onChange={f('evidence_notes')}
                           placeholder="Reference to evidence documents, screenshots, logs..." />
              </div>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label>Additional Notes</label>
                <textarea style={{ ...inp, minHeight:60, resize:'vertical' }} value={form.notes} onChange={f('notes')} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Response</button>
          </div>
        </form>
      </div>
    </div>
  );
}
