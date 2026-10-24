// BLUE LINE CAPITAL GROUP — Backend Enterprise Data Store & State Engine (ESM)
// Manages 9 ERP Modules, Persistent Transaction Records, State Machine Workflows, and Audit Trails

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'erp-database.json');

export const INITIAL_MODULES = [
  {
    id: 'holding',
    num: '01 / 09',
    slug: 'blue-line-capital-group',
    nameFr: 'Blue Line Capital Group (Holding)',
    nameEn: 'Blue Line Capital Group (Holding)',
    upstreamRepo: 'OCA/account-consolidation',
    framework: 'SYSCOHADA & Odoo OCA',
    descFr: 'Gouvernance centrale, allocation CAPEX inter-filiales, éliminations intragroupe et consolidation SYSCOHADA des 9 entités.',
    descEn: 'Central corporate governance, inter-subsidiary CAPEX allocation, intercompany eliminations and SYSCOHADA consolidation.',
    primaryKpiLabel: 'Allocation CAPEX Groupe',
    steps: [
      { step: 1, role: 'service', labelFr: 'Saisie Demande CAPEX', labelEn: 'CAPEX Request Intake' },
      { step: 2, role: 'housekeeping', labelFr: 'Contrôle & Analyse ROI', labelEn: 'Due Diligence & ROI' },
      { step: 3, role: 'finance', labelFr: 'Visa Audit OHADA', labelEn: 'OHADA Audit Sign-off' },
      { step: 4, role: 'direction', labelFr: 'Décision Conseil / PDG', labelEn: 'Board Approval & Release' }
    ]
  },
  {
    id: 'blex',
    num: '02 / 09',
    slug: 'blue-line-exchange-blex',
    nameFr: 'Blue Line Exchange (BLEX Bureau de Change)',
    nameEn: 'Blue Line Exchange (BLEX Currency Bureau)',
    upstreamRepo: 'apache/fineract',
    framework: 'Règlement CEMAC / COBAC & Apache Fineract',
    descFr: 'Bureau de change agréé CEMAC, conversion spot devises (USD, EUR, GBP, XAF), traçabilité KYC / AML et déclarations BEAC.',
    descEn: 'Licensed CEMAC currency bureau, spot FX conversion, KYC / AML audit trails and central bank regulatory reporting.',
    primaryKpiLabel: 'Volume Devises Traité',
    steps: [
      { step: 1, role: 'service', labelFr: 'Guichet Change & KYC', labelEn: 'Teller Intake & KYC' },
      { step: 2, role: 'housekeeping', labelFr: 'Sécurisation Coffre & Caisse', labelEn: 'Vault & Cash Handling' },
      { step: 3, role: 'finance', labelFr: 'Contrôle AML & Déclaration BEAC', labelEn: 'AML Audit & BEAC Filing' },
      { step: 4, role: 'direction', labelFr: 'Validation Trésorerie Direction', labelEn: 'Treasury Director Release' }
    ]
  },
  {
    id: 'property',
    num: '03 / 09',
    slug: 'blue-line-property-management',
    nameFr: 'SCI Blue Ocean & Property Management',
    nameEn: 'SCI Blue Ocean & Property Management',
    upstreamRepo: 'OCA/vertical-hotel',
    framework: 'Odoo OCA Vertical Hotel & Real Estate PMS',
    descFr: 'Gestion de baux commerciaux, résidences hôtelières et asset management immobilier à Yaoundé et Douala.',
    descEn: 'Commercial leases, boutique hotel management, room folios, and asset management in Cameroon.',
    primaryKpiLabel: 'Chiffre d’Affaires Baux & Séjours',
    steps: [
      { step: 1, role: 'service', labelFr: 'Check-in & Contrat de Bail', labelEn: 'Frontdesk & Lease Intake' },
      { step: 2, role: 'housekeeping', labelFr: 'Gouvernance & État des Lieux', labelEn: 'Inspection & Property Prep' },
      { step: 3, role: 'finance', labelFr: 'Clôture Folio & Facturation', labelEn: 'Folio Close & Accounting' },
      { step: 4, role: 'direction', labelFr: 'Arbitrage Baux & Quittance', labelEn: 'Executive Asset Sign-off' }
    ]
  },
  {
    id: 'construction',
    num: '04 / 09',
    slug: 'blue-line-construction',
    nameFr: 'Blue Line Construction & Génie Civil',
    nameEn: 'Blue Line Construction & Civil Engineering',
    upstreamRepo: 'frappe/erpnext (Projects & Subcontracting)',
    framework: 'Frappe ERPNext Projects & WBS Milestone Costing',
    descFr: 'Entreprise générale de BTP, chantiers d’infrastructures, métrés, gestion des sous-traitants et réceptions de travaux.',
    descEn: 'EPC general contracting, infrastructure, WBS milestone costing, subcontractor tracking, and safety sign-off.',
    primaryKpiLabel: 'Engagements Chantiers EPC',
    steps: [
      { step: 1, role: 'service', labelFr: 'Devis & Ordre de Service', labelEn: 'Estimate & Site Work Order' },
      { step: 2, role: 'housekeeping', labelFr: 'Chef de Chantier & Métrés', labelEn: 'Site Execution & Metering' },
      { step: 3, role: 'finance', labelFr: 'Attachement & Décompte OHADA', labelEn: 'Progress Billing & Audit' },
      { step: 4, role: 'direction', labelFr: 'Réception d’Ouvrage Direction', labelEn: 'Director Project Sign-off' }
    ]
  },
  {
    id: 'sugar',
    num: '05 / 09',
    slug: 'blue-line-sugar-manufacturing',
    nameFr: 'Blue Line Sugar Manufacturing',
    nameEn: 'Blue Line Sugar Manufacturing',
    upstreamRepo: 'frappe/erpnext (Manufacturing & BOM)',
    framework: 'Frappe ERPNext Manufacturing, Milling BOM & QC Batch',
    descFr: 'Raffinage sucrier agro-industriel, planification du broyage, nomenclature (BOM) mélasse, contrôle qualité et expédition.',
    descEn: 'Industrial sugar refining, cane milling, multi-level BOM, laboratory QC release, and bagged distribution.',
    primaryKpiLabel: 'Tonnage & Valeur Sucre Produit',
    steps: [
      { step: 1, role: 'service', labelFr: 'Ordre de Fabrication & Canne', labelEn: 'Production Order & Weighbridge' },
      { step: 2, role: 'housekeeping', labelFr: 'Usine de Broyage & Cristallisation', labelEn: 'Milling & Crystallization Run' },
      { step: 3, role: 'finance', labelFr: 'Laboratoire CQ & Décompte Matières', labelEn: 'QC Lab Release & Stock Audit' },
      { step: 4, role: 'direction', labelFr: 'Autorisation Sortie Usine', labelEn: 'Plant Manager Sign-off' }
    ]
  },
  {
    id: 'trade',
    num: '06 / 09',
    slug: 'blue-line-import-assembly-trade',
    nameFr: 'Blue Line Import, Assemblage & Négoce',
    nameEn: 'Blue Line Import, Assembly & Trade',
    upstreamRepo: 'odoo/odoo (Purchase & Inventory)',
    framework: 'Odoo Core Purchase, Customs Declarations & Assembly',
    descFr: 'Import-export portuaire (Port Autonome de Douala), dédouanement Sydonia, entreposage sous douane et distribution.',
    descEn: 'Maritime freight forwarding, customs clearance at Douala Port, CKD assembly, and wholesale distribution.',
    primaryKpiLabel: 'Volume Import-Export Douala',
    steps: [
      { step: 1, role: 'service', labelFr: 'Connaissement & Déclaration Douane', labelEn: 'Bill of Lading & Customs Entry' },
      { step: 2, role: 'housekeeping', labelFr: 'Entrepôt PAD & Assemblage CKD', labelEn: 'Port Warehouse & Assembly' },
      { step: 3, role: 'finance', labelFr: 'Droit de Douane & Rapprochement', labelEn: 'Tariff Audit & Landed Cost' },
      { step: 4, role: 'direction', labelFr: 'Bordereau Livraison Direction', labelEn: 'Customs Release Sign-off' }
    ]
  },
  {
    id: 'finance',
    num: '07 / 09',
    slug: 'group-finance-accounting',
    nameFr: 'Group Finance & Comptabilité Générale',
    nameEn: 'Group Finance & General Accounting',
    upstreamRepo: 'OCA/account-financial-reporting',
    framework: 'SYSCOHADA Révisé & Odoo Financial Reporting',
    descFr: 'Tenue des livres légaux SYSCOHADA révisé, balance générale, rapprochements bancaires et déclarations fiscales DGI.',
    descEn: 'SYSCOHADA general ledger, multi-currency journal vouchers, bank reconciliations, and tax compliance filing.',
    primaryKpiLabel: 'Flux Comptables & Fiscalité',
    steps: [
      { step: 1, role: 'service', labelFr: 'Pièce Comptable & Saisie Écritures', labelEn: 'Voucher Entry & Intake' },
      { step: 2, role: 'housekeeping', labelFr: 'Rapprochement & Grand Livre', labelEn: 'Ledger Audit & Bank Rec' },
      { step: 3, role: 'finance', labelFr: 'Arrêté Mensuel & Déclaration DGI', labelEn: 'Tax Return & Closing' },
      { step: 4, role: 'direction', labelFr: 'Visa Directeur Financier / DAF', labelEn: 'CFO Statutory Validation' }
    ]
  },
  {
    id: 'hr',
    num: '08 / 09',
    slug: 'hr-payroll',
    nameFr: 'Ressources Humaines & Gestion de la Paie',
    nameEn: 'HR & Payroll Management',
    upstreamRepo: 'frappe/hrms',
    framework: 'Frappe HRMS (Payroll, Attendance, CNPS Social Tax)',
    descFr: 'Registre unique du personnel, contrats de travail, pointage biométrique, calcul des bulletins de paie et cotisations CNPS.',
    descEn: 'Employee registry, labor contracts, biometric attendance, CNPS social security deductions, and monthly salary disbursement.',
    primaryKpiLabel: 'Masse Salariale & Cotisations CNPS',
    steps: [
      { step: 1, role: 'service', labelFr: 'Fiche Salarié & Pointage Présences', labelEn: 'Staff Dossier & Attendance' },
      { step: 2, role: 'housekeeping', labelFr: 'Heures Sup & Notes de Frais', labelEn: 'Overtime & Expense Review' },
      { step: 3, role: 'finance', labelFr: 'Livre de Paie & Retenues CNPS', labelEn: 'Payroll Journal & Tax Deductions' },
      { step: 4, role: 'direction', labelFr: 'Ordre de Virement Salaires', labelEn: 'Executive Salary Sign-off' }
    ]
  },
  {
    id: 'digital',
    num: '09 / 09',
    slug: 'digital-transformation-ai',
    nameFr: 'Transformation Digitale, IA & Cloud',
    nameEn: 'Digital Transformation, AI & Cloud',
    upstreamRepo: 'frappe/frappe (Frappe Desk & Telemetry)',
    framework: 'Frappe Framework & High-Performance Microservices',
    descFr: 'Supervision de l’infrastructure multi-tenant, agentic AI Copilot, sécurité informatique, intégration ERP et SLA 99.9%.',
    descEn: 'Multi-tenant cloud infrastructure, autonomous AI Copilots, cyber security operations, and 99.9% uptime SLA monitor.',
    primaryKpiLabel: 'SLA Infrastructure & Requêtes IA',
    steps: [
      { step: 1, role: 'service', labelFr: 'Ticket Incident & Demande IA', labelEn: 'Service Desk Ticket & AI Intake' },
      { step: 2, role: 'housekeeping', labelFr: 'Déploiement & Patching Serveurs', labelEn: 'DevOps & Patch Deployment' },
      { step: 3, role: 'finance', labelFr: 'Audit Sécurité & Métriques Cloud', labelEn: 'Security Audit & FinOps' },
      { step: 4, role: 'direction', labelFr: 'Homologation CTO / Direction', labelEn: 'CTO Architectural Sign-off' }
    ]
  }
];

export const INITIAL_RECORDS = [
  {
    id: 'HLD-2601',
    moduleId: 'holding',
    date: '2026-10-24',
    party: 'Blue Line Sugar Manufacturing SA',
    desc: 'Extension Ligne de Broyage & Raffinage 1500T (CAPEX Q4)',
    category: 'CAPEX Filiale',
    amount: 145000000,
    currency: 'FCFA',
    step: 4,
    status: 'approved',
    metadata: { subsidiary: 'Sugar Manufacturing', roiEstimated: '22.4%', paybackMonths: 18, syscohadaAccount: '2151' },
    auditLog: [
      { step: 1, role: 'service', by: 'Marc-Antoine Ndongo', at: '2026-10-21 08:30', note: 'Dossier CAPEX soumis avec plan de trésorerie.' },
      { step: 2, role: 'housekeeping', by: 'Ing. Paul Essomba', at: '2026-10-22 14:15', note: 'Audit technique validé. Élimination intragroupe conforme.' },
      { step: 3, role: 'finance', by: 'Auditrice Danielle Meka', at: '2026-10-23 11:00', note: 'Certification SYSCOHADA OK. Compte 2151 imputé.' },
      { step: 4, role: 'direction', by: 'Dr. Fadjar Aryo Seto (PDG)', at: '2026-10-24 10:45', note: 'Décaissement autorisé en 2 tranches.' }
    ]
  },
  {
    id: 'HLD-2602',
    moduleId: 'holding',
    date: '2026-10-24',
    party: 'Blue Line Exchange SAS',
    desc: 'Augmentation Réserve Devises CEMAC (Fonds de Roulement BLEX)',
    category: 'Trésorerie Groupe',
    amount: 75000000,
    currency: 'FCFA',
    step: 3,
    status: 'audited',
    metadata: { subsidiary: 'Blue Line Exchange', regulatoryBody: 'COBAC / BEAC', targetReserve: 'USD / EUR' },
    auditLog: [
      { step: 1, role: 'service', by: 'Marc-Antoine Ndongo', at: '2026-10-23 09:00', note: 'Demande de refinancement guichets Yaoundé.' },
      { step: 2, role: 'housekeeping', by: 'Contrôleur Luc Noah', at: '2026-10-23 16:30', note: 'Revue ratios liquidité CEMAC positive.' },
      { step: 3, role: 'finance', by: 'Auditrice Danielle Meka', at: '2026-10-24 08:15', note: 'Visa de conformité monétaire accordé.' }
    ]
  },
  {
    id: 'BLX-2601',
    moduleId: 'blex',
    date: '2026-10-24',
    party: 'Société Camerounaise de Négoce (SCAN)',
    desc: 'Vente Devises Import: 250 000 USD @ 608 XAF (L/C Import)',
    category: 'Change Spot USD',
    amount: 152000000,
    currency: 'FCFA',
    step: 4,
    status: 'approved',
    metadata: { currencyPair: 'USD/XAF', volumeDevise: 250000, spotRate: 608, beacDeclarationId: 'DEC-BEAC-2026-8891' },
    auditLog: [
      { step: 1, role: 'service', by: 'Aissatou Bello', at: '2026-10-24 09:10', note: 'KYC client et facture proforma import validés.' },
      { step: 2, role: 'housekeeping', by: 'Serge Manga', at: '2026-10-24 10:00', note: 'Disponibilité billets coffre principal confirmée.' },
      { step: 3, role: 'finance', by: 'Alain Mbarga', at: '2026-10-24 10:45', note: 'Contrôle AML négatif (aucun signalement). Dossier visé.' },
      { step: 4, role: 'direction', by: 'Direction BLEX', at: '2026-10-24 11:20', note: 'Validation taux dérogatoire et ordre de remise.' }
    ]
  },
  {
    id: 'SBO-2601',
    moduleId: 'property',
    date: '2026-10-24',
    party: 'TotalEnergies EP Cameroun',
    desc: 'Contrat Bail Commercial & Suites Cadres Q4 (Immeuble Le Phare)',
    category: 'Bail & Résidence Hôtelière',
    amount: 48000000,
    currency: 'FCFA',
    step: 4,
    status: 'approved',
    metadata: { units: 'Suites 401-408 + Bureau Étage 2', nights: 90, contractType: 'Corporate Lease' },
    auditLog: [
      { step: 1, role: 'service', by: 'Nadine Fotso', at: '2026-10-20 10:00', note: 'Signature du bail cadre corporate.' },
      { step: 2, role: 'housekeeping', by: 'Gouvernante Henriette', at: '2026-10-21 15:00', note: 'État des lieux d’entrée et aménagement VIP achevés.' },
      { step: 3, role: 'finance', by: 'Comptable Samuel Ekotto', at: '2026-10-22 09:30', note: 'Dépôt de garantie et premier terme encaissés.' },
      { step: 4, role: 'direction', by: 'Gérance SCI Blue Ocean', at: '2026-10-23 17:00', note: 'Clés remises et quittance officielle émise.' }
    ]
  },
  {
    id: 'CST-2601',
    moduleId: 'construction',
    date: '2026-10-24',
    party: 'Port Autonome de Kribi (PAK)',
    desc: 'Phase 2: Plateforme Logistique 12 000 m² & Voie Lourde',
    category: 'Génie Civil EPC',
    amount: 320000000,
    currency: 'FCFA',
    step: 4,
    status: 'approved',
    metadata: { site: 'Zone Industrielle Kribi', milestone: 'Attachement 04/08', progressPct: 65, safetyIncidents: 0 },
    auditLog: [
      { step: 1, role: 'service', by: 'Bureau d’Études BTP', at: '2026-10-18 10:00', note: 'Émission attachement contradictoire n°4.' },
      { step: 2, role: 'housekeeping', by: 'Chef Chantier Jean-Pierre', at: '2026-10-20 14:00', note: 'Essais de portance béton C25/30 concluants.' },
      { step: 3, role: 'finance', by: 'Contrôleur de Gestion BTP', at: '2026-10-22 11:30', note: 'Décompte général provisoire certifié par la mission de contrôle.' },
      { step: 4, role: 'direction', by: 'Directeur Général BLC Construction', at: '2026-10-24 09:00', note: 'Validation pour mise en recouvrement client.' }
    ]
  },
  {
    id: 'SUG-2601',
    moduleId: 'sugar',
    date: '2026-10-24',
    party: 'Coopérative Planteurs du Nkam & Haute-Sanaga',
    desc: 'Campagne Sucrière Lot #88: Broyage 1 200 T Canne & Raffinage 135 T Sucre Blanc',
    category: 'Raffinage & Broyage',
    amount: 118500000,
    currency: 'FCFA',
    step: 4,
    status: 'approved',
    metadata: { batchNumber: 'LOT-SUG-2026-88', canneTonnage: 1200, yieldPct: 11.25, sugarBags50kg: 2700, brixLevel: 19.4 },
    auditLog: [
      { step: 1, role: 'service', by: 'Pesage Usine', at: '2026-10-21 06:00', note: 'Pesée pont-bascule 48 camions canne terminée.' },
      { step: 2, role: 'housekeeping', by: 'Ingénieur d’Usine Bakary', at: '2026-10-22 18:00', note: 'Cycle de chauffe et cristallisation conforme. Pureté 99.8%.' },
      { step: 3, role: 'finance', by: 'Labo Qualité & Contrôle Coûts', at: '2026-10-23 16:30', note: 'Certificat sanitaire délivré. Ensacage 50kg tracé.' },
      { step: 4, role: 'direction', by: 'Directeur Usine Sucrière', at: '2026-10-24 11:00', note: 'Feu vert délivré pour distribution grossistes Yaoundé.' }
    ]
  },
  {
    id: 'TRD-2601',
    moduleId: 'trade',
    date: '2026-10-24',
    party: 'Guangzhou Heavy Machinery Corp & Maersk Line',
    desc: 'Dédouanement 6 Conteneurs 40ft: Pièces Détachées & Modules CKD',
    category: 'Fret Maritime & Douane',
    amount: 88400000,
    currency: 'FCFA',
    step: 4,
    status: 'approved',
    metadata: { blNumber: 'MSK-DLA-2026-4401', declarationSydonia: 'DLA-SYD-99120', port: 'Port de Douala (PAD)', containers: 6 },
    auditLog: [
      { step: 1, role: 'service', by: 'Déclarant en Douane', at: '2026-10-20 08:00', note: 'Enregistrement déclaration Sydonia World.' },
      { step: 2, role: 'housekeeping', by: 'Opérations Portuaires', at: '2026-10-21 15:30', note: 'Visite physique douane effectuée sans contentieux.' },
      { step: 3, role: 'finance', by: 'Comptable Négoce', at: '2026-10-22 14:00', note: 'Paiement quittance Trésor Public et frais de manutention DIT.' },
      { step: 4, role: 'direction', by: 'Directeur Logistique Trade', at: '2026-10-24 08:30', note: 'Bon à enlever (BAE) obtenu et transfert entrepôt validé.' }
    ]
  },
  {
    id: 'FIN-2601',
    moduleId: 'finance',
    date: '2026-10-24',
    party: 'Direction Générale des Impôts (DGI Centre 1)',
    desc: 'Clôture TVA, Acomptes IS & Déclarations Fiscales Mensuelles Groupe',
    category: 'Déclaration Fiscale SYSCOHADA',
    amount: 34500000,
    currency: 'FCFA',
    step: 4,
    status: 'approved',
    metadata: { period: 'Septembre 2026', tvaCollectee: 28400000, acompteIS: 6100000, teledeclarationId: 'DGI-CMR-2026-89912' },
    auditLog: [
      { step: 1, role: 'service', by: 'Aide-Comptable Fiscaliste', at: '2026-10-22 11:00', note: 'Centralisation des journaux de ventes et achats des 9 filiales.' },
      { step: 2, role: 'housekeeping', by: 'Chef Comptable Groupe', at: '2026-10-23 10:30', note: 'Rapprochement des crédits de TVA et précomptes sur achats.' },
      { step: 3, role: 'finance', by: 'Contrôleur Fiscal Interne', at: '2026-10-23 16:45', note: 'Liasse fiscale validée conforme aux directives OHADA.' },
      { step: 4, role: 'direction', by: 'Directeur Administratif & Financier (DAF)', at: '2026-10-24 10:00', note: 'Ordre de virement bancaire Trésor Public signé.' }
    ]
  },
  {
    id: 'HR-2601',
    moduleId: 'hr',
    date: '2026-10-24',
    party: 'Caisse Nationale de Prévoyance Sociale (CNPS Cameroun)',
    desc: 'Masse Salariale Consolidée & Cotisations Sociales CNPS (184 Collaborateurs)',
    category: 'Paie & Déclarations Sociales',
    amount: 54800000,
    currency: 'FCFA',
    step: 4,
    status: 'approved',
    metadata: { headcount: 184, netPay: 41200000, cnpsDeduction: 8400000, irppTax: 5200000, month: 'Octobre 2026' },
    auditLog: [
      { step: 1, role: 'service', by: 'Gestionnaire RH', at: '2026-10-22 09:00', note: 'Clôture des pointages biométriques et heures supplémentaires.' },
      { step: 2, role: 'housekeeping', by: 'Superviseur Paie', at: '2026-10-23 14:00', note: 'Calcul des 184 fiches de paie et retenues CNPS / IRPP.' },
      { step: 3, role: 'finance', by: 'Auditeur Social', at: '2026-10-24 09:30', note: 'Vérification barèmes légaux Code du Travail camerounais.' },
      { step: 4, role: 'direction', by: 'Directrice des Ressources Humaines', at: '2026-10-24 11:15', note: 'Ordre de virement bancaire global transmis à la banque.' }
    ]
  },
  {
    id: 'DGT-2601',
    moduleId: 'digital',
    date: '2026-10-24',
    party: 'Infrastructure Cloud & Cluster IA Multi-Tenant',
    desc: 'Déploiement Nœud Inférence IA Copilot & Surveillance SLA 99.98%',
    category: 'Infrastructure & AI Cloud',
    amount: 18500000,
    currency: 'FCFA',
    step: 4,
    status: 'approved',
    metadata: { uptimePct: 99.98, apiRequests24h: 184520, aiCopilotLatencyMs: 42, activeContainers: 16 },
    auditLog: [
      { step: 1, role: 'service', by: 'Ingénieur Support Cloud', at: '2026-10-24 07:00', note: 'Surveillance proactive des conteneurs ERP et bases de données.' },
      { step: 2, role: 'housekeeping', by: 'DevOps Lead', at: '2026-10-24 08:30', note: 'Mise à niveau cluster Kubernetes et patch de sécurité appliqué.' },
      { step: 3, role: 'finance', by: 'FinOps Auditor', at: '2026-10-24 10:15', note: 'Audit de consommation bande passante et compute sous budget.' },
      { step: 4, role: 'direction', by: 'Chief Technology Officer (CTO)', at: '2026-10-24 11:30', note: 'Certification de résilience opérationnelle délivrée.' }
    ]
  }
];

export class DatabaseEngine {
  constructor() {
    this.modules = INITIAL_MODULES;
    this.records = [];
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        this.records = data.records || INITIAL_RECORDS;
      } else {
        this.records = INITIAL_RECORDS;
        this.save();
      }
    } catch (e) {
      this.records = INITIAL_RECORDS;
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify({
        version: '3.0.0',
        lastUpdated: new Date().toISOString(),
        totalRecords: this.records.length,
        records: this.records
      }, null, 2), 'utf8');
      return true;
    } catch (e) {
      return false;
    }
  }

  getModules() {
    return this.modules.map(m => {
      const recs = this.records.filter(r => r.moduleId === m.id);
      const totalAmount = recs.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const stepCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
      recs.forEach(r => { if (stepCounts[r.step] !== undefined) stepCounts[r.step]++; });
      return {
        ...m,
        recordCount: recs.length,
        totalAmount,
        stepCounts,
        healthScore: recs.length > 0 ? 100 : 80
      };
    });
  }

  getModule(id) {
    const m = this.getModules().find(x => x.id === id);
    if (!m) return null;
    const records = this.getRecords(id);
    return { ...m, records };
  }

  getRecords(moduleId = null) {
    if (moduleId && moduleId !== 'all') {
      return this.records.filter(r => r.moduleId === moduleId);
    }
    return this.records;
  }

  addRecord(payload) {
    const moduleId = payload.moduleId || 'holding';
    const num = Math.floor(1000 + Math.random() * 9000);
    const prefix = moduleId.toUpperCase().slice(0, 3);
    const newRecord = {
      id: payload.id || `${prefix}-${num}`,
      moduleId,
      date: payload.date || new Date().toISOString().slice(0, 10),
      party: payload.party || 'Tier Non Spécifié',
      desc: payload.desc || 'Nouvelle transaction enregistrée',
      category: payload.category || 'Opération Courante',
      amount: Number(payload.amount) || 0,
      currency: payload.currency || 'FCFA',
      step: Number(payload.step) || 1,
      status: payload.status || 'pending',
      metadata: payload.metadata || {},
      auditLog: [
        {
          step: Number(payload.step) || 1,
          role: 'service',
          by: payload.createdByName || 'Opérateur Guichet',
          at: new Date().toISOString().replace('T', ' ').slice(0, 16),
          note: payload.note || 'Enregistrement initial dans le système ERP.'
        }
      ]
    };
    this.records.unshift(newRecord);
    this.save();
    return newRecord;
  }

  advanceWorkflow(recordId, targetStep, operatorName = 'Direction Générale', note = 'Validation de l’étape') {
    const rec = this.records.find(r => r.id === recordId);
    if (!rec) return null;
    rec.step = Math.min(4, Math.max(1, Number(targetStep)));
    if (rec.step === 4) rec.status = 'approved';
    else if (rec.step === 3) rec.status = 'audited';
    else if (rec.step === 2) rec.status = 'in_progress';
    else rec.status = 'pending';

    rec.auditLog.push({
      step: rec.step,
      role: rec.step === 4 ? 'direction' : (rec.step === 3 ? 'finance' : 'housekeeping'),
      by: operatorName,
      at: new Date().toISOString().replace('T', ' ').slice(0, 16),
      note
    });
    this.save();
    return rec;
  }

  getStats() {
    const totalRecords = this.records.length;
    const totalAmount = this.records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const stepCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.records.forEach(r => { if (stepCounts[r.step] !== undefined) stepCounts[r.step]++; });
    return {
      totalModules: this.modules.length,
      totalRecords,
      totalAmount,
      totalAmountFormatted: new Intl.NumberFormat('fr-FR').format(totalAmount) + ' FCFA',
      stepCounts,
      uptimeSeconds: process.uptime ? Math.floor(process.uptime()) : 3600,
      dbStatus: 'CONNECTED',
      serverTimestamp: new Date().toISOString()
    };
  }
}

export const db = new DatabaseEngine();
export default db;
