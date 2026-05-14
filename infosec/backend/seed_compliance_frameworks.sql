-- Compliance Controls Seed: PCI DSS v4.0, SOC 2, GDPR, ISO 22301
-- Run: psql -U infosec_user -d infosec_db -h localhost -f backend/seed_compliance_frameworks.sql

BEGIN;

INSERT INTO compliance_controls (framework, control_id, name, description, category) VALUES
-- ── PCI DSS v4.0 ─────────────────────────────────────────────────
('PCI_DSS','REQ-1','Network Security Controls','Install and maintain network security controls to protect the cardholder data environment','Network Security'),
('PCI_DSS','REQ-2','Secure Configurations','Apply secure configurations to all system components; remove vendor defaults','System Configuration'),
('PCI_DSS','REQ-3','Protect Account Data','Protect stored account data — limit retention, mask PAN, encrypt where stored','Data Protection'),
('PCI_DSS','REQ-4','Encrypt Data in Transit','Protect cardholder data with strong cryptography during transmission over open networks','Encryption'),
('PCI_DSS','REQ-5','Malware Protection','Protect all systems from malicious software — anti-malware, integrity monitoring','Malware Protection'),
('PCI_DSS','REQ-6','Secure Development','Develop and maintain secure systems and software — patch management, secure SDLC','Vulnerability Management'),
('PCI_DSS','REQ-7','Restrict Access','Restrict access to system components and cardholder data by business need-to-know','Access Control'),
('PCI_DSS','REQ-8','Identity & Authentication','Identify users and authenticate access — MFA, unique IDs, password policies','Identity Management'),
('PCI_DSS','REQ-9','Physical Access Controls','Restrict physical access to cardholder data — badge access, media controls','Physical Security'),
('PCI_DSS','REQ-10','Log & Monitor Access','Log and monitor all access to system components and cardholder data','Logging & Monitoring'),
('PCI_DSS','REQ-11','Security Testing','Test security of systems and networks regularly — vulnerability scans, penetration testing','Security Testing'),
('PCI_DSS','REQ-12','InfoSec Policy & Program','Support information security with organisational policies, risk assessments, and awareness training','Governance'),

-- ── SOC 2 Trust Service Criteria ─────────────────────────────────
('SOC_2','CC1','Control Environment','Policies, procedures, board oversight, and management philosophy supporting internal control','Common Criteria'),
('SOC_2','CC2','Communication & Information','Internal and external communication to support internal control functioning','Common Criteria'),
('SOC_2','CC3','Risk Assessment','Risk identification, analysis, and fraud risk processes','Common Criteria'),
('SOC_2','CC4','Monitoring Activities','Ongoing and separate evaluations of internal control components','Common Criteria'),
('SOC_2','CC5','Control Activities','Actions taken to mitigate risks to achievement of objectives','Common Criteria'),
('SOC_2','CC6','Logical & Physical Access','Logical and physical access controls over systems and data','Common Criteria'),
('SOC_2','CC7','System Operations','Detection and monitoring of security events and deviations','Common Criteria'),
('SOC_2','CC8','Change Management','Authorization, design, development, and testing of changes','Common Criteria'),
('SOC_2','CC9','Risk Mitigation','Identification and selection of risk mitigation activities','Common Criteria'),
('SOC_2','A1','Availability','System availability for operation and use as committed or agreed','Availability'),
('SOC_2','PI1','Processing Integrity','System processing is complete, valid, accurate, timely, and authorised','Processing Integrity'),
('SOC_2','C1','Confidentiality','Information designated as confidential is protected as committed or agreed','Confidentiality'),
('SOC_2','P1','Privacy — Notice & Communication','Notice about privacy practices is provided to individuals','Privacy'),
('SOC_2','P2','Privacy — Choice & Consent','Individuals are offered choices regarding collection and use of personal information','Privacy'),
('SOC_2','P3','Privacy — Collection','Personal information is collected in accordance with privacy commitments','Privacy'),
('SOC_2','P4','Privacy — Use, Retention & Disposal','Personal information is used, retained, and disposed of in accordance with commitments','Privacy'),
('SOC_2','P5','Privacy — Access','Individuals have rights to access, review, and correct their personal information','Privacy'),
('SOC_2','P6','Privacy — Disclosure','Personal information is disclosed in accordance with commitments and applicable law','Privacy'),
('SOC_2','P7','Privacy — Quality','Personal information is accurate, complete, and relevant for its intended purpose','Privacy'),
('SOC_2','P8','Privacy — Monitoring & Enforcement','Privacy complaints are addressed and monitoring is performed','Privacy'),

-- ── GDPR Key Obligations ─────────────────────────────────────────
('GDPR','ART-6','Lawful Basis for Processing','Identify and document a valid lawful basis for each processing activity','Lawful Basis'),
('GDPR','ART-7','Consent Management','Where consent is the basis, obtain, record, and manage consent in compliance with GDPR requirements','Lawful Basis'),
('GDPR','ART-13-14','Privacy Notices','Provide clear, accessible privacy notices at point of data collection covering all required information','Transparency'),
('GDPR','ART-15-22','Data Subject Rights','Processes to handle SAR, rectification, erasure, restriction, portability, and objection within timescales','Data Subject Rights'),
('GDPR','ART-25','Privacy by Design & Default','Data protection embedded into system design; minimisation and pseudonymisation applied by default','Privacy Engineering'),
('GDPR','ART-28','Processor Agreements','GDPR-compliant DPAs in place with all processors; sub-processor chains managed','Third-Party Management'),
('GDPR','ART-30','Records of Processing','Article 30 RoPA maintained and reviewed; covers all processing as controller and processor','Documentation'),
('GDPR','ART-32','Security of Processing','Appropriate technical and organisational measures implemented and reviewed regularly','Security'),
('GDPR','ART-33-34','Breach Notification','Processes to detect, assess, and notify breaches within 72 hours; breach log maintained','Incident Management'),
('GDPR','ART-35','DPIA','DPIAs conducted for high-risk processing; DPO consulted; prior consultation where required','Risk Assessment'),
('GDPR','ART-37-39','Data Protection Officer','DPO appointed where required; independent with appropriate expertise; contact details published','Governance'),
('GDPR','CH-V','International Transfers','Transfers outside EEA covered by adequacy, SCCs, BCRs, or derogation; TIAs documented','International Transfers'),

-- ── ISO 22301 Business Continuity ────────────────────────────────
('ISO_22301','CL-4','Context of Organization','Internal/external issues, interested parties, and BCMS scope established and documented','Context'),
('ISO_22301','CL-5','Leadership','Top management commitment, BC policy, and organisational roles and responsibilities defined','Leadership'),
('ISO_22301','CL-6','Planning','BC risks and opportunities addressed; BC objectives and plans established','Planning'),
('ISO_22301','CL-7','Support','Resources, competence, awareness, communication, and documented information for BCMS','Support'),
('ISO_22301','CL-8-BIA','Business Impact Analysis','BIA performed identifying critical activities, recovery time objectives, and dependencies','Operations'),
('ISO_22301','CL-8-RA','Risk Assessment','BC risk assessment performed for critical activities and supporting resources','Operations'),
('ISO_22301','CL-8-STRAT','BC Strategy','BC strategies and solutions selected to protect prioritised activities within RTO/RPO','Operations'),
('ISO_22301','CL-8-PLAN','BC Plans & Procedures','BC plans documented, approved, and accessible covering incident response and recovery','Operations'),
('ISO_22301','CL-8-EX','Exercising & Testing','BC plans exercised and tested regularly; results documented; corrective actions tracked','Operations'),
('ISO_22301','CL-9','Performance Evaluation','Monitoring, measurement, internal audit, and management review of BCMS effectiveness','Evaluation'),
('ISO_22301','CL-10','Improvement','Nonconformity, corrective action, and continual improvement processes active','Improvement')

ON CONFLICT (framework, control_id) DO NOTHING;

COMMIT;
