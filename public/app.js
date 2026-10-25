/* BLUE LINE CAPITAL GROUP & SCI BLUE OCEAN — 9-PRODUCT ENTERPRISE ERP SUITE v3.0
 * Reverse-Engineered from GitHub Open-Source ERP Ecosystems (Odoo OCA & Frappe / ERPNext)
 * Complete Start-to-End Operational Flowcharts, Multi-Terminal Login Gate & Role-Specific Workspaces
 */
(() => {
  'use strict';
  const STORAGE_KEY = 'blcg_sbo_9product_erp_v3';

  // SVG Icons
  const icons = {
    dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    bed:'<path d="M3 18v-7m18 7v-7M3 14h18M5 11V6a2 2 0 012-2h10a2 2 0 012 2v5M3 18h18M7 11V9h4v2m2 0V9h4v2"/>',
    book:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0112 0v2M17 5a3 3 0 010 6M17 14a5 5 0 014 5v1"/>',
    receipt:'<path d="M5 3h14v18l-3-2-4 2-4-2-3 2zM8 8h8M8 12h8M8 16h5"/>',
    fileText:'<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    sparkles:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',
    settings:'<path d="M4 17v2h16v-2M6 17l2-11h8l2 11M12 6V3M6 10h12M8 14h8"/>',
    chart:'<path d="M4 20V4M4 20h16M8 16v-5M13 16V7M18 16V3"/>',
    sliders:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="white"/><circle cx="16" cy="17" r="2" fill="white"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    down:'<path d="m6 9 6 6 6-6"/>',
    arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
    check:'<path d="m4 12 5 5L20 6"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3"/>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    wallet:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 8V5a2 2 0 012-2h13M15 13h6"/>',
    bell:'<path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    power:'<path d="M12 2v10M7 5a9 9 0 1010 0"/>',
    chevronLeft:'<path d="m15 18-6-6 6-6"/>',
    chevronRight:'<path d="m9 18 6-6-6-6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    utensils:'<path d="M18 2v6a3 3 0 01-3 3 3 3 0 01-3-3V2M15 2v18M6 2v7a2 2 0 002 2 2 2 0 002-2V2M8 11v9"/>',
    wrench:'<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>',
    bolt:'<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
    moon:'<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>'
  };

  const icon = (name, size=17) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.dashboard}</svg>`;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = v => Number(v)||0;
  const money = v => new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Math.round(n(v)))+' FCFA';
  const timeZone = 'Africa/Douala';

  function todayISO() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }
  function addDays(iso, days) {
    const d = new Date(iso+'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0,10);
  }
  const dateDiff = (a,b) => Math.round((Date.parse(b+'T12:00:00Z') - Date.parse(a+'T12:00:00Z')) / 86400000);
  const dateLabel = (d, lang='fr', long=false) => d ? new Intl.DateTimeFormat(lang==='fr'?'fr-FR':'en-GB',{day:'2-digit',month:long?'long':'short',year:long?'numeric':undefined,timeZone:'UTC'}).format(new Date(d+'T12:00:00Z')) : '—';

  // ============================================================================
  // 1. THE 9 PRODUCTS OF BLUE LINE CAPITAL GROUP (GITHUB OPEN-SOURCE ERP MODELS)
  // ============================================================================
  const PRODUCTS_9 = [
    {
      id: 'holding',
      num: '01 / 09',
      slug: 'blue-line-capital-group',
      nameFr: 'Blue Line Capital Group (Holding)',
      nameEn: 'Blue Line Capital Group (Holding)',
      repo: 'github.com/OCA/account-consolidation',
      odooModel: 'Consolidation & Board CAPEX ERP',
      descFr: 'Gouvernance centrale, allocation CAPEX inter-filiales, éliminations intragroupe et consolidation SYSCOHADA des 9 entités.',
      descEn: 'Central corporate governance, inter-subsidiary CAPEX allocation, intercompany eliminations and SYSCOHADA consolidation.',
      flow: [
        { step:1, role:'service', code:'STEP 1 · FILIALE', titleFr:'Saisie Demande CAPEX / Remontée', titleEn:'Subsidiary CAPEX & Reporting Intake', descFr:'Soumission des besoins d’investissement & états mensuels par la filiale.', descEn:'Submission of CAPEX requests & monthly figures by subsidiary desk.' },
        { step:2, role:'housekeeping', code:'STEP 2 · CONTRÔLE', titleFr:'Analyse Budgétaire & Risques', titleEn:'Budget & Risk Due Diligence', descFr:'Instruction du dossier, élimination flux intragroupe & scoring ROI.', descEn:'Financial vetting, intercompany elimination & ROI risk scoring.' },
        { step:3, role:'finance', code:'STEP 3 · AUDIT OHADA', titleFr:'Comité d’Audit & Conformité', titleEn:'OHADA Audit & Compliance Desk', descFr:'Validation statutaire SYSCOHADA et visa du commissaire interne.', descEn:'SYSCOHADA statutory compliance & internal audit sign-off.' },
        { step:4, role:'direction', code:'STEP 4 · BOARD [END]', titleFr:'Décision PDG & Déblocage Fonds', titleEn:'Board Approval & Capital Release', descFr:'Arbitrage final du Conseil d’Administration et ordre de décaissement.', descEn:'Final Board of Directors sign-off and treasury capital release.' }
      ],
      roles: {
        service: { badge:'ANALYSTE', staff:'Marc-Antoine Ndongo', fr:'Guichet Reporting Filiales (Étape 1)', en:'Subsidiary Reporting Desk (Step 1)', descFr:'Saisie des demandes CAPEX, dividendes et remontées des 8 filiales.', descEn:'Submit CAPEX requests, dividends and subsidiary performance tickets.' },
        housekeeping: { badge:'CONTRÔLE', staff:'Clarisse Ewane', fr:'Contrôleur de Gestion Groupe (Étape 2)', en:'Group Management Controller (Step 2)', descFr:'Kanban d’instruction budgétaire, revue des marges et risques.', descEn:'Kanban board for budget analysis, margin review and risk scoring.' },
        finance: { badge:'AUDITEUR', staff:'Maître Samuel Kotto', fr:'Comité Audit & Consolidation (Étape 3)', en:'Audit & Consolidation Officer (Step 3)', descFr:'Réconciliation inter-compagnies et validation liasse SYSCOHADA.', descEn:'Intercompany reconciliation and SYSCOHADA statutory sign-off.' },
        direction: { badge:'PDG / BOSS', staff:'Président Direction Générale', fr:'Conseil d’Administration / Boss (Étape 4)', en:'Chairman & Holding CEO (Step 4)', descFr:'Vue consolidée des 9 produits, arbitrage capital et signature finale.', descEn:'Consolidated view across all 9 products, capital allocation & final sign-off.' }
      },
      catalog: [
        { id:'CAP-01', cat:'CAPEX Industriel', nameFr:'Extension Ligne Raffinage Sucre (Dibombari)', nameEn:'Sugar Refinery Line Expansion', price:45000000 },
        { id:'CAP-02', cat:'Dotation Trésorerie', nameFr:'Ligne Liquidité Devises BLEX (EUR/USD)', nameEn:'BLEX FX Liquidity Facility (EUR/USD)', price:30000000 },
        { id:'CAP-03', cat:'Acquisition Foncière', nameFr:'Acquisition Parcelle Logistique Port Douala', nameEn:'Douala Port Logistics Land Acquisition', price:65000000 },
        { id:'CAP-04', cat:'Équipement BTP', nameFr:'Achat Centrale à Béton Mobile Chantier', nameEn:'Mobile Concrete Batching Plant Purchase', price:28000000 },
        { id:'CAP-05', cat:'Transformation IA', nameFr:'Déploiement Cluster ERP & IA Copilot Groupe', nameEn:'Group ERP & AI Copilot Cloud Cluster', price:12500000 },
        { id:'CAP-06', cat:'Flotte Import', nameFr:'Renouvellement Camions Tracteurs Corridor CEMAC', nameEn:'CEMAC Corridor Heavy Trucks Fleet', price:38000000 }
      ]
    },
    {
      id: 'blex',
      num: '02 / 09',
      slug: 'blue-line-exchange',
      nameFr: 'Blue Line Exchange — BLEX (Change FX)',
      nameEn: 'Blue Line Exchange — BLEX (FX & Treasury)',
      repo: 'github.com/OCA/pos + OCA/currency',
      odooModel: 'FX Bureau de Change POS & COBAC AML',
      descFr: 'Change manuel multi-devises (EUR, USD, AED, GBP, CNY ↔ XAF), contrôle LBC/FT COBAC et gestion des coffres BEAC.',
      descEn: 'Multi-currency exchange POS (EUR, USD, AED, GBP, CNY ↔ XAF), COBAC AML/KYC compliance and central vault management.',
      flow: [
        { step:1, role:'service', code:'STEP 1 · CAISSE FX', titleFr:'Guichet Change & Cotation POS', titleEn:'FX Teller Booth & Rate Quote', descFr:'Calcul du cours XAF, saisie bordereau client & encaissement guichet.', descEn:'Live XAF rate conversion, customer slip entry & counter collection.' },
        { step:2, role:'housekeeping', code:'STEP 2 · KYC COBAC', titleFr:'Contrôle Conformité LBC/FT & KYC', titleEn:'COBAC AML/KYC Compliance Check', descFr:'Vérification passeport, motif économique, déclaration douanière & seuils BEAC.', descEn:'Passport verification, economic justification & BEAC threshold check.' },
        { step:3, role:'finance', code:'STEP 3 · TRÉSORERIE', titleFr:'Coffre Devises & Position Cambiste', titleEn:'Vault Settlement & FX Position', descFr:'Mouvement physique coffre-fort devises et équilibrage position BEAC.', descEn:'Physical currency vault movement and BEAC position settlement.' },
        { step:4, role:'direction', code:'STEP 4 · DIRECTION [END]', titleFr:'Clôture Registre COBAC & Arrêté', titleEn:'Executive FX Registry Sign-Off', descFr:'Validation finale du registre journalier de change et marge cambiste.', descEn:'Final daily COBAC regulatory register approval and FX spread audit.' }
      ],
      roles: {
        service: { badge:'CAISSIER FX', staff:'Nadine Tchoumi (Guichet #1)', fr:'Guichetier / Caissier Change POS (Étape 1)', en:'FX POS Cashier / Teller (Step 1)', descFr:'Terminal de change rapide EUR/USD/AED/GBP/CNY vers FCFA avec reçu.', descEn:'Fast currency exchange POS terminal with live XAF spread calculator.' },
        housekeeping: { badge:'KYC / LBC', staff:'Serge Abanda (Conformité)', fr:'Officier Conformité COBAC / KYC (Étape 2)', en:'COBAC KYC Compliance Officer (Step 2)', descFr:'Kanban de vérification d’identité, passeports et plafonds réglementaires.', descEn:'Kanban board for KYC ID checks, travel proofs and AML screening.' },
        finance: { badge:'TRÉSORIER', staff:'Christian Mebenga (Coffre)', fr:'Trésorier & Cambiste Coffre (Étape 3)', en:'Vault Treasurer & FX Dealer (Step 3)', descFr:'Gestion des encaisses devises, alimentation guichets et couverture.', descEn:'Currency vault balances, booth replenishment and BEAC reconciliation.' },
        direction: { badge:'DIR. BLEX', staff:'Directeur Général BLEX', fr:'Direction Générale BLEX (Étape 4)', en:'BLEX Managing Director (Step 4)', descFr:'Supervision des cours, positions de change et registre officiel COBAC.', descEn:'Full supervision of FX rates, positions and official COBAC ledger.' }
      },
      catalog: [
        { id:'FX-EUR', cat:'Zone Euro (Parité Fixe)', nameFr:'Achat / Vente Lot 1 000 EUR (Cours Officiel 655,957)', nameEn:'1,000 EUR FX Lot (Fixed Peg 655.957)', price:656000 },
        { id:'FX-USD', cat:'Dollar Américain', nameFr:'Achat / Vente Lot 1 000 USD (Billets Neufs Série 100)', nameEn:'1,000 USD FX Lot (Series 100 Crisp Notes)', price:612000 },
        { id:'FX-AED', cat:'Corridor Dubaï / EAU', nameFr:'Achat / Vente Lot 5 000 AED (Négoce Dubaï-Douala)', nameEn:'5,000 AED FX Lot (Dubai-Douala Trade)', price:835000 },
        { id:'FX-GBP', cat:'Livre Sterling', nameFr:'Achat / Vente Lot 1 000 GBP (Londres Corporate)', nameEn:'1,000 GBP FX Lot (UK Corporate)', price:778000 },
        { id:'FX-CNY', cat:'Yuan Chinois (Import)', nameFr:'Achat / Vente Lot 10 000 CNY (Fournisseurs Guangzhou)', nameEn:'10,000 CNY FX Lot (Guangzhou Suppliers)', price:855000 },
        { id:'FX-VIP', cat:'Allocation Voyageurs', nameFr:'Dotation Devises Voyage d’Affaires (Billet + Passeport)', nameEn:'Corporate Travel FX Allocation', price:1500000 }
      ]
    },
    {
      id: 'property',
      num: '03 / 09',
      slug: 'blue-line-property-management',
      nameFr: 'Blue Line Property & Hôtel SCI Blue Ocean',
      nameEn: 'Blue Line Property & SCI Blue Ocean Hotel OS',
      repo: 'github.com/OCA/vertical-hotel + OCA/real-estate',
      odooModel: 'hotel.folio · hotel.room · property.lease',
      descFr: 'Gestion hôtelière complète (24 chambres, Folios, POS Restaurant, Gouvernante, Night Audit) & baux immobiliers commerciaux.',
      descEn: 'Full Hospitality & Property ERP (24 rooms rack, Folios, F&B POS, Housekeeping Kanban, Night Audit & commercial leases).',
      flow: [
        { step:1, role:'reception', code:'STEP 1 · RÉCEPTION & POS', titleFr:'Réception, Check-In & Caisse POS', titleEn:'Front Desk Check-In & POS Cashier', descFr:'Ouverture séjour/bail, création Folio client & imputation Room Service POS.', descEn:'Guest check-in/lease start, Folio creation & POS F&B charge posting.' },
        { step:2, role:'housekeeping', code:'STEP 2 · GOUVERNANTE', titleFr:'Ménage, Inspection & Maintenance', titleEn:'Housekeeping & Technical Turnover', descFr:'Remise en état des chambres/lots (Sale → Nettoyage → Inspectée → Prête).', descEn:'Room & unit turnover (Dirty → Cleaning → Inspected → Ready) & repairs.' },
        { step:3, role:'finance', code:'STEP 3 · COMPTA & AUDIT', titleFr:'Encaissement Folios & Night Audit', titleEn:'Folio Settlement & Night Audit', descFr:'Règlement des soldes, facturation TVA 19,25% et clôture Night Audit.', descEn:'Folio balance collection, 19.25% VAT invoicing and Night Audit closure.' },
        { step:4, role:'direction', code:'STEP 4 · DIRECTION [END]', titleFr:'Pilotage RevPAR, ADR & Patrimoine', titleEn:'GM Executive RevPAR & Asset Sign-Off', descFr:'Validation finale des journaux hôteliers, rendement locatif et audit global.', descEn:'Executive review of ADR, RevPAR, occupancy yield and full ERP modules.' }
      ],
      roles: {
        reception: { badge:'RÉCEPTION', staff:'Clarisse Fotso (Front Desk)', fr:'Poste Réception & Accueil (Étape 1A)', en:'Front Desk Receptionist (Step 1A)', descFr:'Check-in/Check-out, plan des 24 chambres et ouverture des Folios.', descEn:'Check-in/Check-out desk, 24-room rack and guest folio opening.' },
        service: { badge:'CAISSE POS', staff:'Brice Ondoua (Caisse F&B)', fr:'Caisse POS Restaurant & Services (Étape 1B)', en:'F&B POS Cashier Terminal (Step 1B)', descFr:'Terminal Caisse tactile pour restaurant, bar, pressing et navette.', descEn:'Split-screen POS cashier terminal for restaurant, laundry and spa.' },
        housekeeping: { badge:'MÉNAGE', staff:'Mireille Eboumbou (Gouvernante)', fr:'Poste Gouvernante & Maintenance (Étape 2)', en:'Housekeeping & Maintenance (Step 2)', descFr:'Kanban 3 colonnes de nettoyage des chambres et ordres de réparation.', descEn:'3-column room cleaning Kanban board and technical repair orders.' },
        finance: { badge:'COMPTA', staff:'Daniel Kamga (Night Auditor)', fr:'Poste Comptabilité & Night Audit (Étape 3)', en:'Accountant & Night Auditor (Step 3)', descFr:'Recouvrement des Folios, quittances et exécution du Night Audit.', descEn:'Folio settlement, invoice printing and Night Audit execution.' },
        direction: { badge:'DG / BOSS', staff:'Amélie Nkouandou (Directrice)', fr:'Direction Générale Hôtel & Immobilier (Étape 4)', en:'General Manager / Property Boss (Step 4)', descFr:'Accès intégral aux 13 modules Odoo Hospitality, KPIs ADR/RevPAR et audit.', descEn:'Full access to all 13 Odoo Hospitality modules, ADR/RevPAR & audit.' }
      },
      catalog: []
    },
    {
      id: 'construction',
      num: '04 / 09',
      slug: 'blue-line-construction',
      nameFr: 'Blue Line Construction & Génie Civil (BTP)',
      nameEn: 'Blue Line Construction & Infrastructure',
      repo: 'github.com/OCA/project + OCA/contracting',
      odooModel: 'project.task · construction.boq · stock.picking',
      descFr: 'Pilotage de chantiers BTP, bons de sortie matériaux, avancement physique des lots d’ingénierie et décomptes BOQ.',
      descEn: 'Civil engineering site management, material requisitions, physical milestone progress and BOQ cost control.',
      flow: [
        { step:1, role:'service', code:'STEP 1 · MAGASIN BTP', titleFr:'Réquisition Matériaux & Pointage Site', titleEn:'Site Material Requisition & Intake', descFr:'Émission des bons de sortie ciment/fer/béton et pointage des équipes.', descEn:'Issue site material vouchers (cement, rebar, concrete) and crew logs.' },
        { step:2, role:'housekeeping', code:'STEP 2 · INGÉNIEUR SITE', titleFr:'Exécution Lots Génie Civil & Chantier', titleEn:'Civil Works Execution & Site Inspection', descFr:'Mise en œuvre sur chantier (Fondations, Gros œuvre, VRD) et contrôle béton.', descEn:'On-site structural execution, concrete pouring and technical inspection.' },
        { step:3, role:'finance', code:'STEP 3 · MÉTREUR BOQ', titleFr:'Vérification Attachements & Coûts BOQ', titleEn:'Quantity Surveyor & BOQ Cost Audit', descFr:'Métré contradictoire, contrôle des écarts devis/réel et décompte provisoire.', descEn:'Quantity survey verification, BOQ budget variance check and valuation.' },
        { step:4, role:'direction', code:'STEP 4 · DIR. TRAVAUX [END]', titleFr:'Réception Jalon & Déblocage Facture', titleEn:'Project Director Milestone Sign-Off', descFr:'Validation du certificat d’avancement et paiement sous-traitant.', descEn:'Final milestone certificate approval and contractor payment release.' }
      ],
      roles: {
        service: { badge:'MAGASINIER', staff:'Hervé Siewe (Dépôt Bassa)', fr:'Magasinier & Pointeur Chantier (Étape 1)', en:'Site Storekeeper & Material Desk (Step 1)', descFr:'Terminal de sortie matériaux (Ciment, Fer, Gasoil) et bons d’approvisionnement.', descEn:'Material requisition POS terminal for cement, steel rebar and heavy equipment.' },
        housekeeping: { badge:'INGÉNIEUR', staff:'Ing. Armand Celestin (Chantier)', fr:'Ingénieur Chef de Chantier (Étape 2)', en:'Chief Site Civil Engineer (Step 2)', descFr:'Kanban d’avancement des lots BTP, coulage béton et levée des réserves.', descEn:'3-column Kanban board for site work packages and structural inspections.' },
        finance: { badge:'MÉTREUR', staff:'Jean Roger Bella (Contrôle BOQ)', fr:'Métreur & Contrôleur Coûts BOQ (Étape 3)', en:'Quantity Surveyor / BOQ Auditor (Step 3)', descFr:'Validation des attachements, contrôle des quantités et décomptes BTP.', descEn:'Verify site measurements, BOQ cost variances and contractor valuations.' },
        direction: { badge:'DIR. BTP', staff:'Directeur des Travaux Groupe', fr:'Directeur Général Construction (Étape 4)', en:'Construction Managing Director (Step 4)', descFr:'Tableau de bord multi-chantiers (Bonanjo, Kribi, Yaoundé) et marges.', descEn:'Multi-site portfolio command center, milestone sign-off and margin KPIs.' }
      },
      catalog: [
        { id:'BTP-01', cat:'Gros Œuvre & Béton', nameFr:'Lot Ciment CIMENCAM CPJ 42.5 (10 Tonnes / 200 Sacs)', nameEn:'CIMENCAM CPJ 42.5 Cement Lot (10 Tons)', price:980000 },
        { id:'BTP-02', cat:'Armatures Acier', nameFr:'Ferraillage Haute Adhérence HA12/HA16 (Lot 5 Tonnes)', nameEn:'High-Tensile Steel Rebar HA12/16 (5 Tons)', price:3450000 },
        { id:'BTP-03', cat:'Béton Prêt à l’Emploi', nameFr:'Coulage Béton B25 Toupie Chantier (20 m³)', nameEn:'Ready-Mix Concrete B25 Delivery (20 m³)', price:1900000 },
        { id:'BTP-04', cat:'Engins & Terrassement', nameFr:'Location Pelle Hydraulique CAT 320 + Carburant (5 Jours)', nameEn:'CAT 320 Excavator + Fuel Package (5 Days)', price:2250000 },
        { id:'BTP-05', cat:'Charpente & Toiture', nameFr:'Structure Métallique Hangar Logistique (Travee 15m)', nameEn:'Steel Warehouse Truss Bay (15m Span)', price:4800000 },
        { id:'BTP-06', cat:'VRD & Assainissement', nameFr:'Lot Buses Béton Armé Ø800 & Graviers Concassés', nameEn:'Reinforced Concrete Drainage Pipes & Gravel', price:1420000 }
      ]
    },
    {
      id: 'sugar',
      num: '05 / 09',
      slug: 'blue-line-sugar-manufacturing',
      nameFr: 'Blue Line Sugar Manufacturing (MRP)',
      nameEn: 'Blue Line Sugar Manufacturing (Refinery MRP)',
      repo: 'github.com/OCA/manufacture + OCA/quality',
      odooModel: 'mrp.production · mrp.bom · quality.check',
      descFr: 'Réception canne sur pont-bascule, ordres de fabrication (MO), raffinage, contrôle laboratoire ICUMSA/Brix et ensachage 50kg.',
      descEn: 'Weighbridge cane intake, MRP production orders, refining, ICUMSA/Brix lab quality control and 50kg bagging lines.',
      flow: [
        { step:1, role:'service', code:'STEP 1 · PONT-BASCULE', titleFr:'Pesée Matière Première & Lancement Lot', titleEn:'Weighbridge Intake & Batch Ticket', descFr:'Pesée camions canne/sucre brut et création du bon d’ordre de fabrication.', descEn:'Truck weighbridge ticket and raw cane batch intake registration.' },
        { step:2, role:'housekeeping', code:'STEP 2 · RAFFINERIE MRP', titleFr:'Broyage, Cuite, Turbinage & Ensachage', titleEn:'Refining, Crystallization & Bagging', descFr:'Exécution sur ligne industrielle (Évaporation, Cristallisation, Sacs 50kg).', descEn:'Shop-floor MRP execution: boiling, centrifuging, drying and 50kg bagging.' },
        { step:3, role:'finance', code:'STEP 3 · LABO QUALITÉ QC', titleFr:'Analyse Polarimétrie Brix & ICUMSA', titleEn:'QC Lab ICUMSA & Moisture Certification', descFr:'Contrôle couleur ICUMSA < 45, humidité < 0,04% et certificat sanitaire.', descEn:'Lab testing for ICUMSA color, polarization, moisture and batch certification.' },
        { step:4, role:'direction', code:'STEP 4 · DIR. USINE [END]', titleFr:'Libération Silo & Distribution CEMAC', titleEn:'Plant Director Batch Release to Market', descFr:'Autorisation de mise sur le marché et transfert vers l’entrepôt central.', descEn:'Final batch release sign-off for wholesale distribution and OEE audit.' }
      ],
      roles: {
        service: { badge:'BASCULE', staff:'Richard Zambo (Pont-Bascule)', fr:'Opérateur Pont-Bascule & Silo (Étape 1)', en:'Weighbridge & Intake Operator (Step 1)', descFr:'Terminal de pesée matière première et émission des tickets de production.', descEn:'Weighbridge intake terminal and batch packaging order counter.' },
        housekeeping: { badge:'CHEF QUART', staff:'Ing. Lucien Douala (Ligne A)', fr:'Chef de Quart Raffinerie MRP (Étape 2)', en:'Refinery Shift Supervisor (Step 2)', descFr:'Kanban des Ordres de Fabrication (mrp.production) et suivi des cuites.', descEn:'3-column MRP work order Kanban board for refining and bagging lines.' },
        finance: { badge:'LABO QC', staff:'Dr. Yvonne Atangana (Chimiste)', fr:'Responsable Laboratoire Qualité QC (Étape 3)', en:'Chief QC Lab Inspector (Step 3)', descFr:'Certification ICUMSA, polarimétrie Brix et validation des lots.', descEn:'Lab quality control station for ICUMSA grading and batch release.' },
        direction: { badge:'DIR. USINE', staff:'Directeur Industriel Sucrerie', fr:'Directeur d’Usine & MRP (Étape 4)', en:'Sugar Plant Managing Director (Step 4)', descFr:'Rendement d’extraction, OEE des lignes, stocks silos et libération finale.', descEn:'Plant extraction yield, OEE metrics, silo inventory and batch sign-off.' }
      },
      catalog: [
        { id:'SUG-01', cat:'Sucre Raffiné Blanc', nameFr:'Lot Sucre Blanc Raffiné ICUMSA 45 (Palette 40 Sacs × 50kg)', nameEn:'Refined White Sugar ICUMSA 45 (40×50kg Pallet)', price:1680000 },
        { id:'SUG-02', cat:'Sucre Roux de Canne', nameFr:'Lot Sucre Blond Cristallisé Extra (Palette 40 Sacs × 50kg)', nameEn:'Golden Cane Crystal Sugar (40×50kg Pallet)', price:1520000 },
        { id:'SUG-03', cat:'Conditionnement Retail', nameFr:'Lot Sucre en Morceaux Boîtes 1kg (1 000 Cartons Supermarché)', nameEn:'1kg Sugar Cubes Retail Pack (1,000 Boxes)', price:1150000 },
        { id:'SUG-04', cat:'Industrie Boissons', nameFr:'Citerne Sirop de Sucre Liquide Inverti 70° Brix (10 Tonnes)', nameEn:'Liquid Inverted Sugar Syrup 70° Brix (10T)', price:4200000 },
        { id:'SUG-05', cat:'Matière Première', nameFr:'Approvisionnement Canne Fraîche Plantation (Lot 50 Tonnes)', nameEn:'Fresh Sugar Cane Plantation Intake (50 Tons)', price:1750000 },
        { id:'SUG-06', cat:'Co-Produit Valorisé', nameFr:'Lot Mélasse Industrielle Fermentation (Citerne 15 Tonnes)', nameEn:'Industrial Molasses By-Product Tank (15T)', price:950000 }
      ]
    },
    {
      id: 'trade',
      num: '06 / 09',
      slug: 'blue-line-import-assembly-trade',
      nameFr: 'Blue Line Import, Assemblage & Négoce',
      nameEn: 'Blue Line Importation, Assembly & Trade',
      repo: 'github.com/OCA/stock-logistics-workflow',
      odooModel: 'stock.landed.cost · mrp.unbuild · sale.order',
      descFr: 'Transit maritime Port Autonome de Douala, dédouanement GUCE, ligne d’assemblage mécanique SKD/CKD et distribution B2B.',
      descEn: 'Port of Douala maritime customs clearance, SKD/CKD mechanical assembly line, landed cost calculation and B2B wholesale.',
      flow: [
        { step:1, role:'service', code:'STEP 1 · COMPTOIR B2B', titleFr:'Commande Grossiste / Déclaration B/L', titleEn:'B2B Wholesale Order & B/L Intake', descFr:'Enregistrement connaissement conteneur (B/L) ou prise de commande grossiste.', descEn:'Register maritime Bill of Lading (B/L) or B2B wholesale purchase order.' },
        { step:2, role:'housekeeping', code:'STEP 2 · ATELIER SKD', titleFr:'Dépotage Conteneur & Assemblage SKD', titleEn:'Container Unloading & SKD Assembly', descFr:'Dépotage à quai, montage mécanique des kits SKD et test sur banc.', descEn:'Container stripping, SKD mechanical assembly and bench testing.' },
        { step:3, role:'finance', code:'STEP 3 · DOUANE & COÛTS', titleFr:'Liquidation Douane GUCE & Landed Cost', titleEn:'Customs Clearance & Landed Cost Audit', descFr:'Calcul droits TEC CEMAC, fret, surestaries et coût de revient unitaire.', descEn:'Calculate CEMAC customs duties, freight, demurrage and unit landed cost.' },
        { step:4, role:'direction', code:'STEP 4 · SUPPLY CHAIN [END]', titleFr:'Bon de Sortie Portuaire & Expédition', titleEn:'Supply Chain Director Release & Dispatch', descFr:'Validation finale du BAE (Bon à Enlever) et départ flotte corridor CEMAC.', descEn:'Final port release authorization and CEMAC corridor fleet dispatch.' }
      ],
      roles: {
        service: { badge:'COMPTOIR B2B', staff:'Sophie Laure Mpacko (Ventes)', fr:'Guichet Commercial B2B & Transit (Étape 1)', en:'B2B Trade Counter & Transit Clerk (Step 1)', descFr:'Facturation grossistes, réservation de conteneurs et bons de commande.', descEn:'Wholesale B2B sales counter and container arrival registration.' },
        housekeeping: { badge:'ATELIER SKD', staff:'Patrick Mboma (Chef Quai)', fr:'Chef Atelier Assemblage & Entrepôt (Étape 2)', en:'SKD Assembly & Warehouse Chief (Step 2)', descFr:'Kanban de dépotage conteneurs 40HQ et lignes de montage mécanique.', descEn:'Kanban board for 40HQ container stripping and SKD assembly lines.' },
        finance: { badge:'TRANSITAIRE', staff:'Irene Priso (Douane GUCE)', fr:'Contrôleur Douane & Coûts d’Approche (Étape 3)', en:'Customs & Landed Cost Controller (Step 3)', descFr:'Calcul des droits de douane CEMAC, TVA import et coûts d’approche.', descEn:'Verify GUCE customs assessments, landed costs and import margins.' },
        direction: { badge:'DIR. TRADE', staff:'Directeur Import & Supply Chain', fr:'Directeur Supply Chain & Négoce (Étape 4)', en:'Import & Trade Managing Director (Step 4)', descFr:'Pilotage du corridor Douala-N’Djamena-Bangui et rotation des stocks.', descEn:'End-to-end oversight of maritime containers, SKD output and B2B margins.' }
      },
      catalog: [
        { id:'TRD-01', cat:'Assemblage Mécanique SKD', nameFr:'Lot 10 Motoculteurs Agricoles Diesel 15CV (Assemblés Douala)', nameEn:'10× 15HP Diesel Agricultural Tillers (SKD Assembled)', price:8500000 },
        { id:'TRD-02', cat:'Énergie & Groupes', nameFr:'Groupe Électrogène Industriel Insonorisé 100kVA (Kit CKD)', nameEn:'100kVA Silent Industrial Generator (CKD Assembled)', price:7900000 },
        { id:'TRD-03', cat:'Conteneur Négoce 40HQ', nameFr:'Conteneur 40HQ Pneumatiques Poids Lourds (Dédouané PAD)', nameEn:'40HQ Heavy Truck Tires Container (Cleared Douala)', price:18500000 },
        { id:'TRD-04', cat:'Matériel Électrique', nameFr:'Lot Transformateurs & Câbles Moyenne Tension (Import Europe)', nameEn:'MV Transformers & Armored Cables Lot', price:11200000 },
        { id:'TRD-05', cat:'Mobilité & Transport', nameFr:'Lot 5 Tricycles Cargo Motorisés 250cc Renforcés (SKD)', nameEn:'5× 250cc Heavy Cargo Motor Tricycles (SKD)', price:5750000 },
        { id:'TRD-06', cat:'Quincaillerie Gros B2B', nameFr:'Palette Outillage Électroportatif & Boulonnerie Acier', nameEn:'Wholesale Power Tools & Industrial Fasteners Pallet', price:3400000 }
      ]
    },
    {
      id: 'finance',
      num: '07 / 09',
      slug: 'group-finance-accounting',
      nameFr: 'Group Finance & Comptabilité SYSCOHADA',
      nameEn: 'Group Finance & SYSCOHADA Accounting',
      repo: 'github.com/OCA/account-financial-tools',
      odooModel: 'account.move · account.journal · l10n_syscohada',
      descFr: 'Tenue du Grand Livre selon le Plan Comptable OHADA Révisé (Classes 1 à 8), trésorerie centralisée, TVA 19,25% et DSF.',
      descEn: 'Revised SYSCOHADA General Ledger (Classes 1 to 8), multi-bank treasury, Cameroon 19.25% VAT/AIR tax filings and audit.',
      flow: [
        { step:1, role:'service', code:'STEP 1 · CAISSE & PIÈCES', titleFr:'Saisie Pièces de Caisse & Factures', titleEn:'Voucher & Invoice Counter Entry', descFr:'Réception des factures fournisseurs/clients et émission des bons de caisse.', descEn:'Register supplier/customer invoices and issue cash disbursement vouchers.' },
        { step:2, role:'housekeeping', code:'STEP 2 · IMPUTATION OHADA', titleFr:'Imputation Comptable Classes 1–8 & Lettrage', titleEn:'SYSCOHADA Account Posting & Matching', descFr:'Codification selon le plan SYSCOHADA, saisie brouillard et rapprochement.', descEn:'Map entries to SYSCOHADA accounts (Classes 1-8) and bank reconciliation.' },
        { step:3, role:'finance', code:'STEP 3 · AUDIT FISCAL DGI', titleFr:'Contrôle TVA 19,25%, AIR & Équilibre', titleEn:'Tax Compliance (VAT/AIR) & Trial Balance', descFr:'Vérification équilibre Débit=Crédit, retenues fiscales DGI et révision.', descEn:'Verify Debit=Credit balance, 19.25% VAT / WHT calculations and audit trail.' },
        { step:4, role:'direction', code:'STEP 4 · DAF [END]', titleFr:'Clôture Journal & Signature États DSF', titleEn:'CFO Ledger Lock & Financial Statements', descFr:'Verrouillage définitif des écritures (account.move) et signature du DAF.', descEn:'Final posting lock of journal entries and CFO statutory sign-off.' }
      ],
      roles: {
        service: { badge:'CAISSIER', staff:'Edith Wangun (Caisse Centrale)', fr:'Caissier Central & Saisie Pièces (Étape 1)', en:'Central Cashier & Voucher Clerk (Step 1)', descFr:'Terminal d’enregistrement des pièces de caisse, chèques et factures.', descEn:'Counter terminal for cash vouchers, supplier bills and receipts.' },
        housekeeping: { badge:'COMPTABLE', staff:'François Talla (Grand Livre)', fr:'Comptable Général SYSCOHADA (Étape 2)', en:'SYSCOHADA General Accountant (Step 2)', descFr:'Kanban d’imputation comptable (Classes 1 à 8) et rapprochement bancaire.', descEn:'Kanban board for SYSCOHADA journal coding and bank reconciliation.' },
        finance: { badge:'FISCALISTE', staff:'Chantal Biya-Meka (Audit Fiscal)', fr:'Auditeur Fiscal & Contrôleur Interne (Étape 3)', en:'Tax Auditor & Internal Controller (Step 3)', descFr:'Contrôle TVA 19,25%, acompte IS, centimes additionnels et balance.', descEn:'Audit 19.25% VAT, corporate tax prepayments and trial balance.' },
        direction: { badge:'DAF / CFO', staff:'Directeur Administratif & Financier', fr:'Directeur Financier Groupe - DAF (Étape 4)', en:'Group Chief Financial Officer - CFO (Step 4)', descFr:'Bilan SYSCOHADA, Compte de Résultat, TAFIRE et signature des clôtures.', descEn:'SYSCOHADA Balance Sheet, P&L, cashflow statement and final journal lock.' }
      },
      catalog: [
        { id:'FIN-601', cat:'Classe 6 · Achats (Cpte 601)', nameFr:'Écriture Achat Marchandises & Matières Premières', nameEn:'Class 6 · Raw Materials & Goods Purchase Entry', price:4500000 },
        { id:'FIN-701', cat:'Classe 7 · Ventes (Cpte 701)', nameFr:'Facturation Ventes Produits Finis & Prestations Groupe', nameEn:'Class 7 · Finished Goods & Services Revenue Entry', price:8200000 },
        { id:'FIN-443', cat:'Classe 4 · État TVA (Cpte 443)', nameFr:'Déclaration Mensuelle TVA Collectée 19,25% & AIR 2,2%', nameEn:'Class 4 · Monthly VAT 19.25% & WHT Tax Settlement', price:1925000 },
        { id:'FIN-521', cat:'Classe 5 · Trésorerie (Cpte 521)', nameFr:'Virement de Nivellement Trésorerie Inter-Banques CEMAC', nameEn:'Class 5 · Interbank Treasury Sweep Transfer', price:15000000 },
        { id:'FIN-241', cat:'Classe 2 · Immobilisations (Cpte 241)', nameFr:'Acquisition Matériel & Outillage Industriel Amortissable', nameEn:'Class 2 · Industrial Equipment Capitalization', price:6800000 },
        { id:'FIN-661', cat:'Classe 6 · Personnel (Cpte 661)', nameFr:'Centralisation Mensuelle Salaires & Charges Sociales CNPS', nameEn:'Class 6 · Monthly Payroll & CNPS Journal Entry', price:9400000 }
      ]
    },
    {
      id: 'hr',
      num: '08 / 09',
      slug: 'hr-payroll',
      nameFr: 'HR & Payroll Operations (Paie CNPS / OHADA)',
      nameEn: 'HR & Payroll Operations (Cameroon CNPS)',
      repo: 'github.com/frappe/hrms + OCA/payroll',
      odooModel: 'hr.employee · hr.attendance · hr.payslip',
      descFr: 'Administration du personnel, pointage biométrique, gestion des congés et calcul des bulletins de paie (CNPS, IRPP, CAC, CFC, RAV).',
      descEn: 'Workforce lifecycle, biometric shift attendance, leave management and statutory Cameroon payroll (CNPS, IRPP, CAC, CFC).',
      flow: [
        { step:1, role:'service', code:'STEP 1 · GUICHET RH', titleFr:'Pointage, Congés & Demandes Salariés', titleEn:'Attendance, Leave & Staff Intake Desk', descFr:'Relevé biométrique des heures, demandes d’acompte/congé et embauches.', descEn:'Log biometric shift hours, leave requests, salary advances and onboarding.' },
        { step:2, role:'housekeeping', code:'STEP 2 · SUPERVISION RH', titleFr:'Validation Feuilles de Temps & Quarts', titleEn:'Department Shift & Timesheet Approval', descFr:'Vérification des heures supplémentaires, primes de rendement et absences.', descEn:'Approve overtime hours, production bonuses and shift rosters.' },
        { step:3, role:'finance', code:'STEP 3 · PAIE CNPS/IRPP', titleFr:'Calcul Bulletins de Paie & Retenues', titleEn:'CNPS & IRPP Payroll Slip Calculation', descFr:'Liquidation Salaire Brut → Cotisation CNPS (4,2%) → IRPP/CAC/CFC/RAV → Net.', descEn:'Compute Gross Pay, 4.2% CNPS pension, IRPP income tax and Net Pay.' },
        { step:4, role:'direction', code:'STEP 4 · DRH [END]', titleFr:'Signature Virement Salarial & DIPE', titleEn:'CHRO Payroll Bank Transfer Sign-Off', descFr:'Validation finale du fichier de virement bancaire et télédéclaration CNPS.', descEn:'Final approval of monthly bank salary disbursement and CNPS DIPE filing.' }
      ],
      roles: {
        service: { badge:'ASSISTANT RH', staff:'Nadine Vanessa (Guichet RH)', fr:'Guichet RH, Pointage & Congés (Étape 1)', en:'HR Front Desk & Attendance Clerk (Step 1)', descFr:'Saisie des pointages, demandes de congés, avances et fiches salariés.', descEn:'Terminal for employee attendance logs, leave requests and onboarding.' },
        housekeeping: { badge:'PLANNING RH', staff:'Armand Celestin (Superviseur)', fr:'Gestionnaire RH & Chefs d’Équipe (Étape 2)', en:'HR Operations & Shift Supervisor (Step 2)', descFr:'Kanban de validation des feuilles de présence et évaluations terrain.', descEn:'Kanban board for timesheet validation, shift rosters and appraisals.' },
        finance: { badge:'GEST. PAIE', staff:'Daniel Kamga (Paie & CNPS)', fr:'Gestionnaire de Paie CNPS / DIPE (Étape 3)', en:'Payroll & CNPS Tax Specialist (Step 3)', descFr:'Édition des bulletins de paie camerounais et calcul des charges patronales.', descEn:'Calculate statutory Cameroon payslips, CNPS contributions and DIPE taxes.' },
        direction: { badge:'DRH GROUPE', staff:'Directeur des Ressources Humaines', fr:'Directeur des Ressources Humaines (Étape 4)', en:'Chief Human Resources Officer - CHRO (Step 4)', descFr:'Pilotage de la masse salariale des 9 filiales et autorisation de virement.', descEn:'Group headcount analytics, payroll cost control and bank transfer sign-off.' }
      },
      catalog: [
        { id:'HR-01', cat:'Paie Cadres & Ingénieurs', nameFr:'Lot Paie Mensuelle Ingénieurs & Cadres de Direction (10 Salariés)', nameEn:'Monthly Executive & Engineers Payroll Batch (10 Staff)', price:8500000 },
        { id:'HR-02', cat:'Paie Techniciens & Usine', nameFr:'Lot Paie Mensuelle Opérateurs Raffinerie & Atelier SKD (25 Salariés)', nameEn:'Refinery & Assembly Operators Payroll Batch (25 Staff)', price:6250000 },
        { id:'HR-03', cat:'Équipes Chantier BTP', nameFr:'Quinzaine Ouvriers Qualifiés & Conducteurs Engins BTP (30 Salariés)', nameEn:'Bi-Weekly Construction Crew & Operators Payroll (30 Staff)', price:4800000 },
        { id:'HR-04', cat:'Cotisations Sociales', nameFr:'Télédéclaration Mensuelle CNPS (Part Salariale 4,2% + Patronale)', nameEn:'Monthly CNPS Social Security Statutory Remittance', price:1950000 },
        { id:'HR-05', cat:'Impôts sur Salaires DGI', nameFr:'Reversement DIPE Mensuel (IRPP, CAC, Crédit Foncier, RAV)', nameEn:'Monthly DIPE Wage Tax Remittance (IRPP, CAC, CFC, RAV)', price:1420000 },
        { id:'HR-06', cat:'Formation & Santé', nameFr:'Programme Assurance Maladie Groupe & Sécurité HSE Chantier', nameEn:'Group Health Insurance & HSE Safety Training Package', price:2100000 }
      ]
    },
    {
      id: 'digital',
      num: '09 / 09',
      slug: 'digital-transformation-ai',
      nameFr: 'Digital Transformation & AI Copilot',
      nameEn: 'Digital Transformation & AI Copilot OS',
      repo: 'github.com/OCA/server-backend + OCA/queue',
      odooModel: 'ir.cron · queue.job · ai.anomaly.copilot',
      descFr: 'Bus d’intégration ERP inter-filiales, détection d’anomalies financières par IA, automatisation des workflows et cyber-gouvernance.',
      descEn: 'Cross-subsidiary ERP event bus, AI financial anomaly detection, workflow automation rules and RBAC cybersecurity.',
      flow: [
        { step:1, role:'service', code:'STEP 1 · HELPDESK & BUS', titleFr:'Ingestion Tickets IT & Flux Filiales', titleEn:'IT Service Desk & Webhook Ingestion', descFr:'Collecte des demandes support, webhooks ERP et alertes de capteurs.', descEn:'Ingest user support tickets, ERP webhooks and automated threshold alerts.' },
        { step:2, role:'housekeeping', code:'STEP 2 · DEVOPS & ETL', titleFr:'Traitement Pipeline ETL & Automatisation', titleEn:'DevOps ETL Pipeline & Sync Execution', descFr:'Exécution des jobs asynchrones (queue.job), synchronisation DB et patchs.', descEn:'Run asynchronous queue jobs, database synchronization and API connectors.' },
        { step:3, role:'finance', code:'STEP 3 · AUDIT IA & RBAC', titleFr:'Revue Anomalies IA Copilot & Sécurité', titleEn:'AI Anomaly Audit & RBAC Security Gate', descFr:'Vérification des alertes de fraude/écart détectées par l’IA et audit RBAC.', descEn:'Audit AI-flagged financial/inventory anomalies and verify RBAC permissions.' },
        { step:4, role:'direction', code:'STEP 4 · CDO / DSI [END]', titleFr:'Mise en Production & Gouvernance Cloud', titleEn:'CDO Production Release & SLA Sign-Off', descFr:'Validation finale du déploiement sur le cluster Groupe et maintien SLA 99,9%.', descEn:'Final production deployment approval and 99.9% Cloud SLA governance.' }
      ],
      roles: {
        service: { badge:'SUPPORT IT', staff:'Kevin Nguema (NOC & Helpdesk)', fr:'Opérateur Support IT & Webhooks (Étape 1)', en:'IT Service Desk & NOC Operator (Step 1)', descFr:'Terminal d’ouverture de tickets techniques et déclenchement de flux ERP.', descEn:'NOC terminal for logging IT requests and triggering ERP sync webhooks.' },
        housekeeping: { badge:'ING. DEVOPS', staff:'Ing. Fabrice Mvondo (DevOps)', fr:'Ingénieur Système & Intégration ERP (Étape 2)', en:'DevOps & ERP Integration Engineer (Step 2)', descFr:'Kanban des pipelines de synchronisation inter-filiales et automatisations.', descEn:'3-column Kanban board for ETL data pipelines, API jobs and infrastructure.' },
        finance: { badge:'AUDITEUR IA', staff:'Dr. Clarisse Ewane (SecOps & IA)', fr:'Analyste AI Copilot & Auditeur Cybersécurité (Étape 3)', en:'AI Copilot Analyst & SecOps Auditor (Step 3)', descFr:'Inspection des anomalies détectées par l’IA (écarts caisse/stock) et RBAC.', descEn:'Inspect AI-detected cash/inventory anomalies and RBAC security logs.' },
        direction: { badge:'DSI / CDO', staff:'Chief Digital Officer Groupe', fr:'Directeur Digital & IA - CDO (Étape 4)', en:'Chief Digital & AI Officer - CDO (Step 4)', descFr:'Supervision globale de l’infrastructure des 9 produits, SLA et IA Copilot.', descEn:'Executive command of the 9-product digital backbone, AI models and SLA.' }
      },
      catalog: [
        { id:'AI-01', cat:'Connecteur ERP', nameFr:'Synchronisation Temps Réel Caisses BLEX ↔ Grand Livre SYSCOHADA', nameEn:'Real-Time BLEX POS ↔ SYSCOHADA Ledger Sync Pipeline', price:1500000 },
        { id:'AI-02', cat:'AI Anomaly Radar', nameFr:'Audit Automatisé IA : Détection Écarts Stocks Sucre & Carburant BTP', nameEn:'AI Anomaly Scan: Sugar Silo & Construction Fuel Variance', price:2200000 },
        { id:'AI-03', cat:'Automatisation WhatsApp', nameFr:'Déploiement Bot Concierge WhatsApp & Relance Loyers Immo', nameEn:'WhatsApp AI Concierge & Automated Rent Reminder Bot', price:1200000 },
        { id:'AI-04', cat:'Cybersécurité & RBAC', nameFr:'Audit de Sécurité SAST/DAST & Durcissement Accès Multi-Postes', nameEn:'SAST/DAST Security Hardening & Multi-Terminal RBAC Audit', price:1850000 },
        { id:'AI-05', cat:'BI & Consolidation', nameFr:'Générateur Automatisé Liasses Financières Board (9 Filiales)', nameEn:'Automated 9-Subsidiary Board Financial Pack Generator', price:2600000 },
        { id:'AI-06', cat:'Infrastructure Edge', nameFr:'Sauvegarde Chiffrée Multi-Cloud Cloudflare R2 & Réplication Douala', nameEn:'Encrypted Cloudflare R2 Offsite Backup & Douala Failover', price:980000 }
      ]
    }
  ];

  // ============================================================================
  // 2. ODOO HOSPITALITY & MULTI-DIVISION SEED GENERATOR
  // ============================================================================
  const DEFAULT_SERVICES = [
    { id:'SRV-01', cat:'restaurant', nameFr:'Petit-déjeuner Continental Buffet', nameEn:'Continental Breakfast Buffet', price:8500, icon:'utensils' },
    { id:'SRV-02', cat:'restaurant', nameFr:'Dîner Gastronomique Blue Ocean', nameEn:'Blue Ocean Gourmet Dinner', price:24000, icon:'utensils' },
    { id:'SRV-03', cat:'restaurant', nameFr:'Plateau Fruits de Mer Douala', nameEn:'Douala Seafood Platter', price:32000, icon:'utensils' },
    { id:'SRV-04', cat:'restaurant', nameFr:'Cocktail Signature Blue Ocean', nameEn:'Signature Ocean Cocktail', price:6500, icon:'utensils' },
    { id:'SRV-05', cat:'laundry', nameFr:'Blanchisserie Express Costume / Robe', nameEn:'Express Suit / Dress Dry Clean', price:12000, icon:'sparkles' },
    { id:'SRV-06', cat:'laundry', nameFr:'Lavage & Repassage Chemise / Pantalon', nameEn:'Shirt / Trousers Laundry & Press', price:4500, icon:'sparkles' },
    { id:'SRV-07', cat:'service', nameFr:'Navette Aéroport VIP (Douala / Yaoundé)', nameEn:'VIP Airport Shuttle (DLA/YAO)', price:25000, icon:'arrow' },
    { id:'SRV-08', cat:'service', nameFr:'Massage Relaxant & Soin Spa (60 min)', nameEn:'Balneotherapy & Spa Massage (60m)', price:38000, icon:'sparkles' },
    { id:'SRV-09', cat:'minibar', nameFr:'Réassort Minibar Premium (Spiritueux & Snacks)', nameEn:'Premium Minibar Refill', price:16000, icon:'utensils' },
    { id:'SRV-10', cat:'service', nameFr:'Bail Commercial / Salle de Conférence Exécutive (Journée)', nameEn:'Executive Conference / Commercial Space Day Lease', price:125000, icon:'bed' }
  ];

  const roles = {
    direction: {
      odooId: 'group_executive_manager',
      fr: 'Direction Générale (Boss)',
      en: 'General Manager (Boss)',
      views: ['overview','modulesReview','modulesBenchmark','rooms','bookings','folios','services','calendar','guests','housekeeping','maintenance','operations','audit','reports','settings'],
      actions: ['booking','checkin','room','guest','payment','folio_charge','folio_close','task','maintenance','audit_run','ops','export','reset']
    },
    reception: {
      odooId: 'group_frontdesk_user',
      fr: 'Poste Réception & Accueil (Étape 1)',
      en: 'Front Desk Terminal (Step 1)',
      views: ['overview','rooms','bookings','folios','calendar','guests'],
      actions: ['booking','checkin','room','guest','payment','folio_charge']
    },
    service: {
      odooId: 'group_pos_cashier',
      fr: 'Poste Caisse POS & Guichet (Étape 1)',
      en: 'POS Cashier & Counter Terminal (Step 1)',
      views: ['overview','services','folios','rooms'],
      actions: ['folio_charge','payment','booking']
    },
    housekeeping: {
      odooId: 'group_operations_field',
      fr: 'Poste Opérations, Terrain & Ménage (Étape 2)',
      en: 'Operations, Field & Housekeeping (Step 2)',
      views: ['overview','housekeeping','maintenance','rooms','operations'],
      actions: ['room','task','maintenance','ops']
    },
    finance: {
      odooId: 'group_accountant_auditor',
      fr: 'Poste Comptabilité, Contrôle & Audit (Étape 3)',
      en: 'Accounting, Compliance & Audit (Step 3)',
      views: ['overview','modulesReview','modulesBenchmark','folios','audit','reports','bookings'],
      actions: ['payment','folio_close','audit_run','export']
    }
  };

  const navigation = [
    { id:'overview', icon:'dashboard', group:0, fr:"Terminal du Poste Actif", en:'Active Role Terminal', descFr:'Espace opérationnel dédié à votre poste dans le Flowchart Start-to-End.', descEn:'Dedicated operational workspace for your role in the Start-to-End Flowchart.' },
    { id:'modulesReview', icon:'chart', group:0, fr:'Revue & Audit des 9 Modules ERP', en:'9-Module ERP Executive Audit', descFr:'Console de démonstration et données locales des neuf domaines.', descEn:'Nine-domain review with sample data stored locally in this browser.' },
    { id:'modulesBenchmark', icon:'shield', group:0, fr:'Comparatif ERP & Preuves', en:'ERP Comparison & Evidence', descFr:'Évaluer les deux ERP sur 9 domaines avec preuves et export CSV/JSON.', descEn:'Compare two ERP solutions across nine domains with evidence and CSV/JSON export.' },
    { id:'rooms', icon:'bed', group:0, fr:'Chambres & Parc Immobilier', en:'Rooms & Property Rack', descFr:'Plan de chambre par étage, commodités et statut en direct.', descEn:'Floor rack matrix, room amenities and live statuses.' },
    { id:'bookings', icon:'book', group:0, fr:'Réservations & Baux', en:'Reservations & Leases', descFr:'Gestion des séjours et pipeline de validation Odoo.', descEn:'Stay management and Odoo workflow pipeline.' },
    { id:'folios', icon:'fileText', group:0, fr:'Folios & Grand Livre', en:'Folios & Ledger', descFr:'Ledger financier centralisé (chambre, restauration, blanchisserie).', descEn:'Centralized guest billing folio (room, F&B, laundry).' },
    { id:'services', icon:'utensils', group:1, fr:'Catalogue & Caisse POS', en:'Catalog & POS Counter', descFr:'Carte restauration, blanchisserie, spa & imputation directe au folio.', descEn:'F&B menu, laundry, spa & direct folio charge posting.' },
    { id:'calendar', icon:'calendar', group:1, fr:'Calendrier / Planning', en:'Calendar Board', descFr:'Vue mensuelle de l’occupation et des séjours prévus.', descEn:'Monthly occupancy and scheduled reservation planning.' },
    { id:'guests', icon:'users', group:1, fr:'Fichier Clients & Tiers', en:'Client & Partner CRM', descFr:'Profils clients, historique des dépenses et statut VIP.', descEn:'Guest profiles, stay history and VIP status.' },
    { id:'housekeeping', icon:'sparkles', group:1, fr:'Kanban Opérations & Ménage', en:'Operations & Housekeeping Kanban', descFr:'Cycle opérationnel (À faire, En cours, Inspecté, Terminé).', descEn:'Operational turnover cycle (Pending, In Progress, Inspected, Done).' },
    { id:'maintenance', icon:'wrench', group:1, fr:'Maintenance & Incidents', en:'Maintenance & Tickets', descFr:'Gestion des ordres de réparation et blocage des actifs.', descEn:'Repair orders and asset out-of-order blocks.' },
    { id:'operations', icon:'settings', group:1, fr:'Utilités & Infrastructure', en:'Facilities & Infrastructure', descFr:'Groupes électrogènes, eau, sécurité et réseau.', descEn:'Generators, water reserves, security and connectivity.' },
    { id:'audit', icon:'moon', group:2, fr:'Clôture & Audit Réglementaire', en:'Night Audit & Compliance', descFr:'Processus de clôture journalière, contrôle SYSCOHADA/COBAC & KPIs.', descEn:'End-of-day revenue reconciliation, SYSCOHADA/COBAC audit & KPIs.' },
    { id:'reports', icon:'chart', group:2, fr:'Rapports & Journal SysLog', en:'Reports & Audit Trail', descFr:'Analyses financières, journal des opérations et exports.', descEn:'Financial analytics, audit logs and raw data export.' },
    { id:'settings', icon:'sliders', group:2, fr:'Matrice RBAC & Système', en:'RBAC Matrix & Demo DB', descFr:'Matrice des droits ir.model.access et données de démonstration.', descEn:'ir.model.access rights matrix and demo dataset.' }
  ];

  // Domain-specific sidebar navigation labels per Product so Sugar/BLEX/BTP/HR never display "Hotel Rooms"
  const DIV_NAV_LABELS = {
    holding: {
      rooms: ['Portefeuille 9 Filiales & Actifs', '9 Subsidiaries & Asset Portfolio'],
      bookings: ['Résolutions & Dossiers CAPEX', 'Board Resolutions & CAPEX'],
      folios: ['Liasse Consolidation OHADA', 'Consolidated Ledger & Eliminations'],
      services: ['Simulateur TRI (IRR) & VAN (NPV)', 'CAPEX IRR & NPV Simulator'],
      calendar: ['Calendrier Conseils & Comités', 'Board & Committee Calendar'],
      guests: ['Actionnaires & Banques CEMAC', 'Shareholders & Syndicate Banks'],
      housekeeping: ['Kanban Gouvernance & Due Diligence', 'Governance & Due Diligence Kanban'],
      audit: ['Audit Consolidé Groupe & Commissariat', 'Consolidated Statutory Audit']
    },
    blex: {
      rooms: ['Coffres Devises & Guichets FX', 'FX Currency Vaults & Counters'],
      bookings: ['Registre des Opérations FX', 'FX Deals & Exchange Register'],
      folios: ['Bordereaux FX & Règlements BEAC', 'FX Settlement Slips & Ledger'],
      services: ['Calculateur Spread FX & LBC/FT', 'Live FX Spread & AML Calculator'],
      calendar: ['Échéancier Transferts & Couvertures', 'FX Settlement & Hedging Schedule'],
      guests: ['Base KYC Clients & Déclarations COBAC', 'KYC Counterparties & COBAC AML'],
      housekeeping: ['Kanban Flux Guichet → Coffre → AML', 'FX Deal Execution Kanban'],
      audit: ['Contrôle Réglementaire COBAC (>5M)', 'COBAC AML & Vault Reconciliation']
    },
    construction: {
      rooms: ['Parc Chantiers, Lots & Engins BTP', 'Active Construction Sites & Fleet'],
      bookings: ['Marchés BTP & Attachements', 'Works Contracts & Site Logs'],
      folios: ['Décomptes Provisoires & BOQ', 'Progress Billing & BOQ Ledger'],
      services: ['Calculateur Décompte BTP & Retenue', 'BOQ Progress Billing Calculator'],
      calendar: ['Planning Gantt & Jalons Chantier', 'Master Site Schedule & Milestones'],
      guests: ['Maîtres d’Ouvrage & Sous-Traitants', 'Project Owners & Subcontractors'],
      housekeeping: ['Kanban Chantier (Études → Réception)', 'Site Engineering & Works Kanban'],
      audit: ['Contrôle Labo Béton, HSE & Garantie', 'Geotech Lab, HSE & Retention Audit']
    },
    sugar: {
      rooms: ['Lignes Raffinage, Cuites & Silos', 'Refinery Lines, Boilers & Silos'],
      bookings: ['Ordres de Fabrication (MO / Lots)', 'Manufacturing Orders (mrp.production)'],
      folios: ['Bilans Matières & Coûts de Revient', 'Material Yield & Costing Ledger'],
      services: ['Calculateur Rendement Canne & Brix', 'Cane Yield & ICUMSA Lab Simulator'],
      calendar: ['Planning Campagne Sucrière & Quarts', 'Refinery Shift & Campaign Schedule'],
      guests: ['Plantations & Grossistes Sucre', 'Cane Estates & Sugar Wholesalers'],
      housekeeping: ['Kanban Usine (Pesée → Turbinage)', 'Shop-Floor MRP Execution Kanban'],
      audit: ['Certificat Labo Polarimétrie ICUMSA 45', 'ICUMSA 45 & Brix Lab Certification']
    },
    trade: {
      rooms: ['Entrepôts PAD, Conteneurs & SKD', 'Douala Port Bonded Zones & SKD Line'],
      bookings: ['Connaissements (B/L) & Import GUCE', 'Bills of Lading & Import Dossiers'],
      folios: ['Coûts d’Approche (Landed Cost CAF)', 'Landed Cost & Customs Liquidation'],
      services: ['Simulateur Douane CEMAC (TEC+TVA)', 'CEMAC Customs & Landed Cost Calc'],
      calendar: ['Planning Navires PAD & Assemblage', 'Vessel ETA & SKD Assembly Schedule'],
      guests: ['Fournisseurs, Transitaires & B2B', 'Global Suppliers & Freight Forwarders'],
      housekeeping: ['Kanban Transit (Port PAD → SKD)', 'Port Clearance & SKD Assembly Kanban'],
      audit: ['Apurement Manifeste GUCE & SGS', 'GUCE Customs & SGS Compliance Audit']
    },
    finance: {
      rooms: ['Plan Comptable OHADA (Classes 1–8)', 'SYSCOHADA Chart of Accounts (1–8)'],
      bookings: ['Journaux Comptables (account.move)', 'Accounting Journals (Moves)'],
      folios: ['Grand Livre, Balance & Lettrage', 'General Ledger & Trial Balance'],
      services: ['Simulateur Fiscal TVA 19,25% & AIR', 'Cameroon VAT 19.25% & WHT Simulator'],
      calendar: ['Échéancier Fiscal DGI & Clôtures', 'Statutory Tax Filing Calendar'],
      guests: ['Comptes Tiers Clients (411) & Frs (401)', 'AR (411) & AP (401) Sub-Ledgers'],
      housekeeping: ['Kanban Clôture (Pièces → Imputation)', 'Journal Posting & Matching Kanban'],
      audit: ['Contrôle Débit=Crédit & Liasse DSF', 'Trial Balance & DSF Tax Audit']
    },
    hr: {
      rooms: ['Effectifs par Filiale & Catégories', 'Workforce Roster & OHADA Grades'],
      bookings: ['Pointages Biométriques & Congés', 'Biometric Attendance & Leave Logs'],
      folios: ['Bulletins de Paie CNPS / DIPE', 'Statutory Payslips & Payroll Register'],
      services: ['Calculateur Officiel Paie Cameroun', 'Cameroon CNPS / IRPP Payslip Calc'],
      calendar: ['Planning Quarts, Congés & Paie', 'Shift Roster & Payroll Calendar'],
      guests: ['Dossiers Salariés & Matricules CNPS', 'Employee Directory & CNPS IDs'],
      housekeeping: ['Kanban Paie (Pointage → Virement)', 'Monthly Payroll Processing Kanban'],
      audit: ['Télédéclaration CNPS & DIPE DGI', 'CNPS Social Security & DIPE Audit']
    },
    digital: {
      rooms: ['Topologie Serveurs, Bus & Connecteurs', 'ERP Nodes, Event Bus & Connectors'],
      bookings: ['Files Jobs Asynchrones (queue.job)', 'Async Job Queues & Webhook Logs'],
      folios: ['Registre Sécurité & Traces RBAC', 'Security Ledger & RBAC Access Logs'],
      services: ['Scanner IA Anomalies & Fraude (9 ERP)', 'AI Anomaly & Fraud Scanner (9 ERP)'],
      calendar: ['Fenêtres Maintenance & Cron Jobs', 'Scheduled Cron Jobs & SLA Windows'],
      guests: ['Comptes Opérateurs & Clés API', 'Operator Accounts & API Credentials'],
      housekeeping: ['Kanban DevOps (Alerte → Patch → Prod)', 'DevOps Incident & Pipeline Kanban'],
      audit: ['Certification Cyber-Gouvernance & SLA', 'Cybersecurity & Zero-Trust Audit']
    }
  };

  function navItemMeta(id, prodId = productId) {
    const base = navigation.find(v => v.id === id) || navigation[0];
    if (prodId === 'property' || !DIV_NAV_LABELS[prodId] || !DIV_NAV_LABELS[prodId][id]) return base;
    const [fr, en] = DIV_NAV_LABELS[prodId][id];
    return { ...base, fr, en };
  }

  // Domain-specific physical/financial units per Product for the 2nd sidebar tab (rooms/units)
  const DIV_UNITS_SEED = {
    holding: [
      { id:'HOLD-SBO', zone:'Pôle Immobilier & Hôtellerie', type:'Filiale Détenue à 100%', rate:4800000000, status:'available', specs:['24 Unités Hôtelières', 'Baux Commerciaux', 'Rendement 14,2%'] },
      { id:'HOLD-SUG', zone:'Pôle Agro-Industrie', type:'Complexe Sucrier MRP', rate:6200000000, status:'occupied', specs:['Ligne Raffinage A/B', 'ICUMSA 45', 'EBITDA +22%'] },
      { id:'HOLD-BTP', zone:'Pôle Infrastructures', type:'Blue Line Construction SA', rate:3450000000, status:'occupied', specs:['5 Chantiers Actifs', 'Centrale Béton', 'Carnet 8,4 Mds'] },
      { id:'HOLD-BLEX', zone:'Pôle Financier & Change', type:'Blue Line Exchange (BLEX)', rate:2900000000, status:'available', specs:['Agrément COBAC/BEAC', '6 Devises', 'Spread Moyen 1,8%'] },
      { id:'HOLD-TRD', zone:'Pôle Logistique & SKD', type:'Import, Assemblage & Négoce', rate:2150000000, status:'occupied', specs:['Terminal PAD Douala', 'Atelier SKD', 'Corridor CEMAC'] },
      { id:'HOLD-CAP', zone:'Trésorerie & Fonds Groupe', type:'Réserve Stratégique CAPEX', rate:1850000000, status:'inspected', specs:['Pool Bancaire CEMAC', 'Audit OHADA', 'Liquidité Immédiate'] }
    ],
    blex: [
      { id:'COFFRE-EUR', zone:'Coffres Devises Principales', type:'Réserve Euro ( Zone Franc / BCE )', rate:295180650, status:'available', specs:['Stock: 450 000 EUR', 'Parité: 655,957 XAF', 'Plafond COBAC OK'] },
      { id:'COFFRE-USD', zone:'Coffres Devises Principales', type:'Réserve Dollar US ( billets neufs )', rate:230090000, status:'occupied', specs:['Stock: 380 000 USD', 'Cours: 605,50 XAF', 'Forte Demande Import'] },
      { id:'COFFRE-XAF', zone:'Coffres Devises Principales', type:'Encaisse Centrale Franc CFA (BEAC)', rate:620000000, status:'available', specs:['Coffre Blindé Akwa', 'Coupures 10 000 XAF', 'Assurance Toutes Valeurs'] },
      { id:'COFFRE-CNY', zone:'Devises Asie & Moyen-Orient', type:'Ligne Yuan Renminbi (Fournisseurs Chine)', rate:177450000, status:'occupied', specs:['Stock: 2 100 000 CNY', 'Cours: 84,50 XAF', 'Règlement Canton/Yiwu'] },
      { id:'COFFRE-AED', zone:'Devises Asie & Moyen-Orient', type:'Réserve Dirham Émirats (Corridor Dubaï)', rate:131840000, status:'available', specs:['Stock: 800 000 AED', 'Cours: 164,80 XAF', 'KYC Renforcé'] },
      { id:'GUICHET-VIP', zone:'Terminaux & Guichets BLEX', type:'Salon Change Corporate & Diplomatique', rate:95000000, status:'inspected', specs:['Compteuse Anti-Faux', 'Scanner Passeport KYC', 'Liaison ANIF/COBAC'] }
    ],
    construction: [
      { id:'BTP-AKWA', zone:'Chantiers Bâtiment & Tours', type:'Tour Commerciale Akwa Phase II (R+8)', rate:485000000, status:'occupied', specs:['Avancement: 64%', 'Béton B35 Précontraint', '45 Ouvriers'] },
      { id:'BTP-BONA', zone:'Chantiers Industriels', type:'Complexe Entrepôt Portuaire Bonabéri', rate:320000000, status:'occupied', specs:['Avancement: 78%', 'Charpente Métallique', 'Dalle Radier 35cm'] },
      { id:'BTP-VRD', zone:'Génie Civil & Voirie', type:'Lot Voirie & Drainage Pluvial Bassa', rate:210000000, status:'cleaning', specs:['Terrassement 85%', 'Caniveaux Béton', 'Contrôle Labogenie'] },
      { id:'ENGIN-B25', zone:'Parc Matériel & Centrales', type:'Centrale à Béton Automatisée 60 m³/h', rate:85000000, status:'available', specs:['Silo Ciment CEM II 42.5', 'Sonde Humidité', '4 Camions Toupie'] },
      { id:'ENGIN-GRUE', zone:'Parc Matériel & Centrales', type:'Parc Grues à Tour & Pelles Hydrauliques', rate:140000000, status:'available', specs:['2 Grues Potain 45m', '3 Pelles CAT 320', 'Certificat APAVE'] },
      { id:'LABO-BTP', zone:'Qualité & Sécurité HSE', type:'Laboratoire Éprouvettes Béton & Géotech', rate:28000000, status:'inspected', specs:['Essais Compression 28j', 'Zéro Accident HSE', 'Visa Bureau Contrôle'] }
    ],
    sugar: [
      { id:'MRP-MOULIN', zone:'Extraction & Broyage', type:'Tandem Moulins à Canne & Pont-Bascule', rate:185000000, status:'occupied', specs:['Cadence: 120 Tonnes/h', 'Extraction Jus: 96,4%', 'Pesée Électronique'] },
      { id:'MRP-CUITE', zone:'Évaporation & Cristallisation', type:'Batterie Chaudières & Cuites Sous Vide', rate:240000000, status:'occupied', specs:['Brix Sirop: 68,5°', 'Vapeur Basse Pression', 'Automate Siemens PLC'] },
      { id:'MRP-TURB', zone:'Turbinage & Séchage', type:'Centrifugeuses Automatiques Sucre Blanc', rate:160000000, status:'available', specs:['Pureté: 99,8% Pol', 'Norme ICUMSA ≤ 45', 'Clairçage Vapeur'] },
      { id:'SILO-BLANC', zone:'Stockage & Conditionnement', type:'Silo Climatise Sucre Blanc #1 (2 500 T)', rate:420000000, status:'available', specs:['Hygrométrie < 55%', 'Ensachage 50kg Auto', 'Traçabilité Lot QR'] },
      { id:'SILO-ROUX', zone:'Stockage & Conditionnement', type:'Silo Sucre Roux & Cuve Mélasse #2', rate:195000000, status:'cleaning', specs:['Sucre Blond Canne', 'Citerne Mélasse 800T', 'Chargement Camion'] },
      { id:'LABO-ICUMSA', zone:'Contrôle Qualité Raffinerie', type:'Laboratoire Polarimétrie & Colorimétrie', rate:45000000, status:'inspected', specs:['Saccharimètre Auto', 'Spectro450nm ICUMSA', 'Certificat ANOR'] }
    ],
    trade: [
      { id:'PAD-QUAI14', zone:'Opérations Portuaires Douala', type:'Parc Conteneurs 40HQ Sous Douane PAD', rate:310000000, status:'occupied', specs:['12 Conteneurs Actifs', 'Franchise Surestaries', 'Tracking BL MSC/CMA'] },
      { id:'SKD-LIGNE1', zone:'Atelier Assemblage Mécanique', type:'Chaîne Montage Motoculteurs & Tricycles', rate:145000000, status:'occupied', specs:['Cadence: 18 Unités/j', 'Banc Essai Moteur', 'Numéro Châssis Gravé'] },
      { id:'CKD-GROUPES', zone:'Atelier Assemblage Mécanique', type:'Cellule Montage Groupes Électrogènes CKD', rate:225000000, status:'available', specs:['Gamme 20kVA à 250kVA', 'Capotage Insonorisé', 'Test Charge 100%'] },
      { id:'GUCE-DOUANE', zone:'Dédouanement & Transit', type:'Cellule Déclarations Sydonia++ / GUCE', rate:88000000, status:'inspected', specs:['Tarif Extérieur CEMAC', 'Attestation SGS/BIVAC', 'BAE Express 48h'] },
      { id:'ENTREPOT-B2B', zone:'Distribution & Logistique', type:'Hub Logistique & Pièces Détachées Akwa', rate:175000000, status:'available', specs:['Surface 4 500 m²', 'Gestion WMS Code-Barres', 'Stock Sécurité 90j'] },
      { id:'CORRIDOR-CEMAC', zone:'Distribution & Logistique', type:'Flotte Camions Douala–Yaoundé–N’Djamena', rate:130000000, status:'occupied', specs:['Balise GPS Temps Réel', 'Carnet TIR / Transit', 'Livraison Grossistes'] }
    ],
    finance: [
      { id:'OHADA-CL12', zone:'Haut de Bilan SYSCOHADA', type:'Classes 1 & 2 : Capitaux & Immobilisations', rate:8400000000, status:'inspected', specs:['Capital Social & Réserves', 'Tableau Amortissements', 'Conforme AUDCIF'] },
      { id:'OHADA-CL34', zone:'Cycle Exploitation & Fiscal', type:'Classes 3 & 4 : Stocks, Clients (411), État (443)', rate:1920000000, status:'occupied', specs:['Lettrage Tiers Auto', 'TVA 19,25% & AIR 2,2%', 'Déclaration Mensuelle DGI'] },
      { id:'OHADA-CL5', zone:'Trésorerie Multi-Banques', type:'Classe 5 : Banques CEMAC & Caisses (521/571)', rate:1450000000, status:'available', specs:['Afriland, BICEC, BGFI', 'Rapprochement Bancaire', 'Nivellement Cash-Pooling'] },
      { id:'OHADA-CL6', zone:'Comptes de Gestion', type:'Classe 6 : Achats & Charges d’Exploitation', rate:2380000000, status:'occupied', specs:['Contrôle Budgétaire', 'Imputation Analytique', 'Visa Contrôle Interne'] },
      { id:'OHADA-CL7', zone:'Comptes de Gestion', type:'Classe 7 : Chiffre d’Affaires & Produits', rate:3640000000, status:'available', specs:['Consolidation 9 Pôles', 'Marge Brute 34,8%', 'Facturation Certifiée'] },
      { id:'LIASSE-DSF', zone:'États Financiers Annuels', type:'Cellule Bilan, Compte de Résultat & DSF', rate:520000000, status:'inspected', specs:['Système Normal OHADA', 'Équilibre Débit=Crédit', 'Prêt Signature DAF'] }
    ],
    hr: [
      { id:'RH-CADRES', zone:'Collèges & Effectifs Groupe', type:'Collège Cadres Supérieurs & Ingénieurs (Cat. F–G)', rate:48500000, status:'available', specs:['42 Salariés Actifs', 'Contrats CDI OHADA', 'Évaluation Objectifs KPI'] },
      { id:'RH-USINE', zone:'Collèges & Effectifs Groupe', type:'Opérateurs Raffinerie MRP & Atelier SKD (Cat. C–E)', rate:64200000, status:'occupied', specs:['118 Techniciens', 'Rotation 3×8 Quarts', 'Prime Rendement Usine'] },
      { id:'RH-BTP', zone:'Collèges & Effectifs Groupe', type:'Compagnons BTP & Conducteurs Engins (Cat. B–D)', rate:52800000, status:'occupied', specs:['165 Ouvriers Chantier', 'Pointage Biométrique', 'Équipements EPI / HSE'] },
      { id:'RH-SERVICES', zone:'Collèges & Effectifs Groupe', type:'Équipes Hôtel SCI Blue Ocean & Guichets BLEX', rate:31400000, status:'available', specs:['82 Collaborateurs', 'Service Client 24/7', 'Formation Continue'] },
      { id:'PAIE-CNPS', zone:'Paie Réglementaire & Fiscalité', type:'Moteur Liquidation CNPS (4,2% / 11,2%) & DIPE', rate:24600000, status:'inspected', specs:['Plafond CNPS 750 000 XAF', 'Barème IRPP + CAC 10%', 'Crédit Foncier & RAV'] },
      { id:'MED-TRAVAIL', zone:'Santé & Social', type:'Assurance Maladie Groupe & Comité Hygiène', rate:14200000, status:'available', specs:['Couverture 80% Famille', 'Visite Médicale Annuelle', 'Zéro Litige Inspection'] }
    ],
    digital: [
      { id:'NODE-BUS', zone:'Infrastructure Cloud & ERP', type:'Enterprise Service Bus (ESB) — 9 Filiales', rate:45000000, status:'available', specs:['Uptime: 99,98%', 'Latence: 14 ms', 'Sync Temps Réel JSON/REST'] },
      { id:'NODE-AI', zone:'Intelligence Artificielle', type:'Moteur AI Copilot : Détection Fraude & Anomalies', rate:68000000, status:'occupied', specs:['Scan Continu 9 ERP', 'Contrôle Seuils COBAC/DGI', 'Alertes Prédictives'] },
      { id:'NODE-DB', zone:'Stockage & Haute Dispo', type:'Cluster PostgreSQL HA & Sauvegarde Chiffrée R2', rate:52000000, status:'inspected', specs:['Réplication Synchrone', 'Snapshot Horaire', 'Chiffrement AES-256'] },
      { id:'NODE-QUEUE', zone:'Automatisation Workflows', type:'Orchestrateur Tâches Asynchrones (queue.job / cron)', rate:29000000, status:'available', specs:['142 Jobs / heure', 'Génération PDF Auto', 'Relances Automatiques'] },
      { id:'NODE-SEC', zone:'Cyber-Sécurité & RBAC', type:'Passerelle Zero-Trust, WAF & Audit ir.model.access', rate:38000000, status:'inspected', specs:['Séparation 4 Postes/ERP', 'Journal SysLog Immuable', 'Protection Anti-DDoS'] },
      { id:'NODE-POS', zone:'Terminaux Terrain', type:'Flotte 36 Terminaux Caisses POS, Tablettes & Douchettes', rate:31000000, status:'available', specs:['Mode Offline-First', 'Imprimantes Thermiques', 'Sync 4G / Fibre'] }
    ]
  };

  // Seed initial pipeline records for all 9 products so every product has active items at Steps 1, 2, 3, and 4!
  function seedDivisionRecords(t) {
    const records = {};
    const clientsByProd = {
      holding: ['Filiale Blue Line Sugar SA', 'Filiale Blue Line Exchange (BLEX)', 'SCI Blue Ocean Hospitality', 'Blue Line Construction BTP', 'Direction Import & Trade Douala'],
      blex: ['Société Négoce Golfe SARL (Dubaï)', 'CFAO Import Cameroun', 'Mission Diplomatique CEMAC', 'Transitaire Port Douala SA', 'Groupe Agro-Export Kribi'],
      property: ['Amélie Nkouandou (Suite 101)', 'Cabinet Audit OHADA (Tour Bonanjo)', 'François Talla (Suite 197)', 'Banque Atlantique Cameroun (Bail)', 'Chantal Biya-Meka (VIP 293)'],
      construction: ['Chantier Immeuble Siège Bonanjo', 'Chantier Entrepôt Port Autonome Quai 4', 'Lot Voirie & Drainage Zone Bassa', 'Pont Béton Précontraint Dibombari', 'Résidence Exécutive Akwa'],
      sugar: ['Lot Raffinage #MO-2601 (Ligne A)', 'Lot Cristallisation #MO-2602 (Silo 2)', 'Commande Grossiste Supermarchés Douala', 'Lot Sirop Boissons #MO-2604', 'Réception Canne Plantation Nkoteng'],
      trade: ['Conteneur 40HQ #MSCU-882190 (Port Douala)', 'Ligne Assemblage Motoculteurs #SKD-104', 'Expédition Grossiste Libreville (Gabon)', 'Conteneur Groupes 100kVA #CMAU-44102', 'Dossier Douane GUCE #DEC-99201'],
      finance: ['Journal Trésorerie Afriland First Bank', 'Déclaration Mensuelle TVA & AIR (DGI)', 'Facture Fournisseur CIMENCAM #FAC-881', 'Centralisation Paie Groupe Octobre', 'Rapprochement Coffre Devises BLEX'],
      hr: ['Feuille de Paie Mensuelle Usine Dibombari', 'Pointage Biométrique Équipes Chantier BTP', 'Déclaration Sociale CNPS & DIPE Octobre', 'Validation Congés & Primes Trimestrielles', 'Recrutement Ingénieurs Génie Civil'],
      digital: ['Pipeline Sync Temps-Réel BLEX ↔ SYSCOHADA', 'Alerte IA Copilot : Écart Consommation Gasoil BTP', 'Déploiement Portail ERP 9 Filiales v3.0', 'Audit Sécurité RBAC & Sauvegarde R2', 'Webhook Facturation Automatique Property OS']
    };

    PRODUCTS_9.forEach(p => {
      const cat = p.catalog.length ? p.catalog : DEFAULT_SERVICES;
      const clients = clientsByProd[p.id] || clientsByProd.holding;
      records[p.id] = [
        {
          id: `${p.id.toUpperCase().slice(0,3)}-2601`,
          step: 1,
          client: clients[0],
          itemFr: cat[0].nameFr,
          itemEn: cat[0].nameEn,
          category: cat[0].cat,
          qty: 1,
          unitPrice: cat[0].price,
          amount: cat[0].price,
          paymentMethod: 'Virement CEMAC / Cash',
          operator: p.roles.service?.staff || 'Guichet #1',
          notesFr: 'Saisi au guichet (Étape 1) — En attente de prise en charge opérationnelle.',
          notesEn: 'Entered at frontline desk (Step 1) — Awaiting operational execution.',
          date: t
        },
        {
          id: `${p.id.toUpperCase().slice(0,3)}-2602`,
          step: 1,
          client: clients[1],
          itemFr: cat[1 % cat.length].nameFr,
          itemEn: cat[1 % cat.length].nameEn,
          category: cat[1 % cat.length].cat,
          qty: 2,
          unitPrice: cat[1 % cat.length].price,
          amount: cat[1 % cat.length].price * 2,
          paymentMethod: 'Orange Money / Chèque Certifié',
          operator: p.roles.service?.staff || 'Guichet #1',
          notesFr: 'Dossier enregistré au poste initial — Prêt pour l’Étape 2.',
          notesEn: 'Registered at counter terminal — Ready for Step 2 execution.',
          date: t
        },
        {
          id: `${p.id.toUpperCase().slice(0,3)}-2603`,
          step: 2,
          client: clients[2],
          itemFr: cat[2 % cat.length].nameFr,
          itemEn: cat[2 % cat.length].nameEn,
          category: cat[2 % cat.length].cat,
          qty: 1,
          unitPrice: cat[2 % cat.length].price,
          amount: cat[2 % cat.length].price,
          paymentMethod: 'Virement Bancaire',
          operator: p.roles.housekeeping?.staff || 'Équipe Terrain',
          notesFr: 'En cours d’exécution technique / terrain (Étape 2).',
          notesEn: 'Currently in field / shop-floor execution (Step 2).',
          date: t
        },
        {
          id: `${p.id.toUpperCase().slice(0,3)}-2604`,
          step: 3,
          client: clients[3],
          itemFr: cat[3 % cat.length].nameFr,
          itemEn: cat[3 % cat.length].nameEn,
          category: cat[3 % cat.length].cat,
          qty: 1,
          unitPrice: cat[3 % cat.length].price,
          amount: cat[3 % cat.length].price,
          paymentMethod: 'Virement CEMAC',
          operator: p.roles.finance?.staff || 'Contrôle & Audit',
          notesFr: 'Exécution terrain terminée — En attente de certification Comptabilité/Audit (Étape 3).',
          notesEn: 'Operations completed — Pending Finance/QC Audit certification (Step 3).',
          date: addDays(t, -1)
        },
        {
          id: `${p.id.toUpperCase().slice(0,3)}-2605`,
          step: 4,
          client: clients[4],
          itemFr: cat[4 % cat.length].nameFr,
          itemEn: cat[4 % cat.length].nameEn,
          category: cat[4 % cat.length].cat,
          qty: 1,
          unitPrice: cat[4 % cat.length].price,
          amount: cat[4 % cat.length].price,
          paymentMethod: 'Virement Irrévocable BEAC',
          operator: p.roles.direction?.staff || 'Direction Générale',
          notesFr: 'Certifié conforme par l’Audit (Étape 3) — Transmis au Boss pour signature finale [END].',
          notesEn: 'Audited & certified (Step 3) — Ready for Executive Boss final sign-off [END].',
          date: addDays(t, -1),
          approvedByBoss: false
        }
      ];
    });
    return records;
  }

  function demoSeed() {
    const t = todayISO();
    const guestNames = [
      'Amélie Nkouandou','François Talla','Mireille Eboumbou','Daniel Kamga','Chantal Biya-Meka',
      'Patrick Mboma','Yvonne Atangana','Lucien Douala','Clarisse Fotso','Jean Roger Bella',
      'Sophie Laure Mpacko','Armand Celestin','Irene Priso','Hervé Siewe','Nadine Vanessa',
      'Brice Ondoua','Edith Wangun','Richard Zambo'
    ];
    const guests = guestNames.map((name, i) => ({
      id: `G${String(i+1).padStart(3,'0')}`,
      name,
      phone: `+237 6${(70000000 + i * 13579).toString().slice(0,8)}`,
      email: `${name.toLowerCase().replace(/[^a-z]/g,'')}@example.cm`,
      vip: i % 4 === 0,
      notes: i % 3 === 0 ? 'Client Corporate Blue Line Capital · Priorité VIP' : '',
      created: t
    }));

    const rooms = Array.from({length:24}, (_, i) => {
      const floor = Math.floor(i / 8);
      const num = 101 + i + floor * 92;
      const type = i % 8 === 0 ? 'Suite Présidentielle' : i % 4 === 0 ? 'Suite Premium' : i % 3 === 0 ? 'Deluxe Océan' : 'Standard Executive';
      const rate = {
        'Suite Présidentielle': 145000,
        'Suite Premium': 95000,
        'Deluxe Océan': 65000,
        'Standard Executive': 38000
      }[type];
      const amenities = ['WiFi Fibre', 'Climatisation', 'Coffre-fort'];
      if (type.includes('Suite')) amenities.push('Mini Bar', 'Vue Océan', 'Jacuzzi', 'Lit King-Size');
      else if (type.includes('Deluxe')) amenities.push('Mini Bar', 'Vue Océan', 'Balcon');
      else amenities.push('Bureau', 'TV 4K');

      return { id: String(num), type, floor: floor === 0 ? 'RDC' : `${floor}e`, rate, amenities, status: 'available' };
    });

    const bookings = [];
    const folios = [];
    for (let i = 0; i < 16; i++) {
      const live = i < 8;
      const completed = i >= 13;
      const arrival = live ? addDays(t, -1 - (i % 3)) : completed ? addDays(t, -8 - (i % 3)) : addDays(t, 1 + ((i - 8) % 7));
      const nights = live ? 3 + (i % 3) : completed ? 2 : 2 + (i % 4);
      const departure = addDays(arrival, nights);
      const room = rooms[i];
      const roomCost = room.rate * nights;
      const status = live ? 'checked-in' : completed ? 'checked-out' : 'confirmed';
      const bookingId = `RES-${String(2601 + i)}`;
      const folioId = `FOL-${String(5501 + i)}`;
      const folioLines = [{
        id: `LN-${String(i+1)}01`,
        date: arrival,
        category: 'room',
        desc: `Hébergement ${room.type} (Ch. ${room.id}) · ${nights} nuits`,
        qty: nights,
        unitPrice: room.rate,
        total: roomCost
      }];
      if (live || completed) {
        folioLines.push({
          id: `LN-${String(i+1)}02`,
          date: arrival,
          category: 'restaurant',
          desc: 'Petit-déjeuner Continental Buffet',
          qty: 2,
          unitPrice: 8500,
          total: 17000
        });
        if (i % 2 === 0) {
          folioLines.push({
            id: `LN-${String(i+1)}03`,
            date: addDays(arrival, 1),
            category: 'laundry',
            desc: 'Blanchisserie Express Costume',
            qty: 1,
            unitPrice: 12000,
            total: 12000
          });
        }
      }
      const totalLines = folioLines.reduce((acc, l) => acc + l.total, 0);
      const paidAmount = completed ? totalLines : live ? Math.round(totalLines * 0.6) : Math.round(totalLines * 0.3);
      const payments = paidAmount > 0 ? [{
        id: `PAY-${String(i+1)}01`,
        date: arrival,
        amount: paidAmount,
        method: i % 3 === 0 ? 'Carte Bancaire' : i % 2 === 0 ? 'Orange Money' : 'Espèces',
        ref: `TXN-${10000 + i * 29}`
      }] : [];

      bookings.push({
        id: bookingId,
        folioId,
        guestId: guests[i].id,
        roomId: room.id,
        arrival,
        departure,
        status,
        channel: ['Direct Réception', 'WhatsApp AI Concierge', 'Corporate Blue Line', 'Booking.com'][i % 4],
        created: t
      });
      folios.push({
        id: folioId,
        bookingId,
        guestId: guests[i].id,
        roomId: room.id,
        status: completed ? 'closed' : 'open',
        lines: folioLines,
        payments,
        createdAt: arrival
      });
      if (live) room.status = 'occupied';
    }

    rooms[16].status = 'dirty';
    rooms[17].status = 'cleaning';
    rooms[18].status = 'inspected';
    rooms[19].status = 'maintenance';

    const tasks = [
      { id:'TSK-01', roomId:rooms[16].id, label:'Remise à blanc complète après départ client', status:'pending', priority:'high' },
      { id:'TSK-02', roomId:rooms[17].id, label:'Désinfection & changement draps Suite', status:'pending', priority:'high' },
      { id:'TSK-03', roomId:rooms[18].id, label:'Inspection finale gouvernante chambre VIP', status:'done', priority:'normal' },
      { id:'TSK-04', roomId:rooms[7].id, label:'Réassort minibar et serviettes de bain', status:'pending', priority:'normal' }
    ];

    const maintenanceTickets = [
      { id:'MNT-101', roomId:rooms[19].id, desc:'Fuite compresseur climatisation split', priority:'urgent', stage:'in_progress', reportedBy:'Gouvernante', date:t },
      { id:'MNT-102', roomId:rooms[5].id, desc:'Changement ampoule applique chevet gauche', priority:'low', stage:'reported', reportedBy:'Réception', date:t },
      { id:'MNT-103', roomId:rooms[12].id, desc:'Poignée balcon coulissant resserrée', priority:'normal', stage:'resolved', reportedBy:'Client', date:addDays(t,-2) }
    ];

    const auditHistory = [
      { date: addDays(t,-1), occupancyRate: 67, adr: 72500, revPar: 48575, roomRevenue: 1160000, serviceRevenue: 184000, totalDayRevenue: 1344000, auditor: 'Comptabilité' },
      { date: addDays(t,-2), occupancyRate: 71, adr: 74200, revPar: 52682, roomRevenue: 1264368, serviceRevenue: 215000, totalDayRevenue: 1479368, auditor: 'Comptabilité' }
    ];

    const systems = [
      { id:'generator', labelFr:'Groupe électrogène Caterpillar 250kVA', labelEn:'Backup generator 250kVA', detailFr:'Inverseur automatique · Plein gazole 94%', detailEn:'Auto transfer switch · Fuel 94%', status:'healthy', icon:'power' },
      { id:'security', labelFr:'Sécurité & contrôle d’accès RFID', labelEn:'Security & RFID access', detailFr:'Portails biométriques & rondes actives', detailEn:'Biometric gates & active patrol', status:'healthy', icon:'shield' },
      { id:'water', labelFr:'Réserve d’eau potable & surpresseur', labelEn:'Water treatment & boosters', detailFr:'Cuve 30 000L · Pression nominale 4.2 bar', detailEn:'30,000L tank · 4.2 bar nominal pressure', status:'healthy', icon:'settings' },
      { id:'internet', labelFr:'Fibre optique dédiée & Wi-Fi 6', labelEn:'Dedicated Optical Fiber & Wi-Fi 6', detailFr:'Double adduction Douala & bascule 4G', detailEn:'Dual-homed link & 4G failover', status:'healthy', icon:'chart' }
    ];

    return {
      version: 3,
      rooms,
      bookings,
      guests,
      folios,
      services: DEFAULT_SERVICES,
      tasks,
      maintenance: maintenanceTickets,
      auditHistory,
      systems,
      divisionRecords: seedDivisionRecords(t),
      history: [],
      generatedAt: t
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.version === 3 && Array.isArray(d.rooms) && d.divisionRecords) return d;
      }
    } catch (e) {
      console.warn('Demo storage unavailable:', e);
    }
    return demoSeed();
  }

  let db = load();
  const params = new URLSearchParams(window.location.search);
  const initProdParam = params.get('product') || '';
  const matchedInitProd = PRODUCTS_9.find(p => p.id === initProdParam || p.slug === initProdParam);

  let productId = matchedInitProd ? matchedInitProd.id : 'property';
  let role = roles[params.get('role')] ? params.get('role') : 'direction';
  let lang = params.get('lang') === 'en' ? 'en' : 'fr';
  let view = 'overview';
  // Open Login Gate by default on HTTP/HTTPS so user starts at the Start-to-End Flowchart & Role Portal
  let gateOpen = params.get('gate') === '0' ? false : (params.get('gate') === '1' || (!params.has('role') && !params.has('product') && window.location.protocol.startsWith('http')));
  let filter = '';
  let roomFilter = 'all';
  let bookingFilter = 'all';
  let folioFilter = 'all';
  let floorFilter = 'all';
  let selectedDate = '';
  let monthCursor = todayISO().slice(0,7);
  let activeFolioId = '';
  let vatOn = false;
  let posCart = [];

  const $ = s => document.querySelector(s);
  const tr = (fr, en) => lang === 'fr' ? fr : en;
  const currentProduct = () => PRODUCTS_9.find(p => p.id === productId) || PRODUCTS_9[2];
  const currentRoleMeta = () => {
    const p = currentProduct();
    return p.roles[role] || p.roles.service || p.roles.direction;
  };
  const can = perm => Boolean(roles[role]?.actions.includes(perm));
  const canView = id => Boolean(roles[role]?.views.includes(id));

  // Helpers
  const guestFor = id => db.guests.find(g => g.id === id) || { name: tr('Client inconnu','Unknown guest'), phone:'—', email:'' };
  const roomFor = id => db.rooms.find(r => r.id === id);
  const bookingFor = id => db.bookings.find(b => b.id === id);
  const folioFor = id => db.folios.find(f => f.id === id);

  function folioMetrics(folio) {
    if (!folio) return { roomTotal:0, serviceTotal:0, subtotal:0, tax:0, totalGross:0, totalPaid:0, balance:0 };
    const roomTotal = folio.lines.filter(l => l.category === 'room').reduce((a, l) => a + n(l.total), 0);
    const serviceTotal = folio.lines.filter(l => l.category !== 'room').reduce((a, l) => a + n(l.total), 0);
    const subtotal = roomTotal + serviceTotal;
    const tax = vatOn ? Math.round(subtotal * 0.1925) : 0;
    const totalGross = subtotal + tax;
    const totalPaid = folio.payments.reduce((a, p) => a + n(p.amount), 0);
    const balance = Math.max(0, totalGross - totalPaid);
    return { roomTotal, serviceTotal, subtotal, tax, totalGross, totalPaid, balance };
  }

  function save(action, meta='') {
    db.history.unshift({ when: new Date().toISOString(), role: `${productId}:${role}`, action, meta: String(meta).slice(0, 110) });
    db.history = db.history.slice(0, 80);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch(e) {
      notify(tr('Stockage local indisponible.','Browser storage unavailable.'), true);
    }
  }

  function statusLabel(s) {
    const dict = {
      available: ["Disponible", 'Available'],
      occupied: ["Occupée", 'Occupied'],
      dirty: ["À nettoyer", 'Dirty'],
      cleaning: ["En cours de ménage", 'Cleaning'],
      inspected: ["Inspectée & Prête", 'Inspected & Ready'],
      maintenance: ["Hors service", 'Out of Order'],
      confirmed: ["Confirmée", 'Confirmed'],
      cancelled: ["Annulée", 'Cancelled'],
      'checked-in': ["Sur place (Check-In)", 'In-House'],
      'checked-out': ["Départ effectué", 'Checked out'],
      pending: ["En attente", 'Pending'],
      done: ["Clôturé / Prêt", 'Done / Ready'],
      healthy: ["Opérationnel", 'Operational'],
      watch: ["Sous surveillance / Actif", 'Active / Monitored'],
      issue: ["Incident signalé", 'Issue reported'],
      open: ["Ouvert / Actif", 'Open'],
      closed: ["Soldé & Clôturé", 'Settled & Closed'],
      reported: ["Signalé", 'Reported'],
      in_progress: ["En cours de réparation", 'In Progress'],
      resolved: ["Résolu", 'Resolved']
    };
    return (dict[s] || [s,s])[lang==='fr'?0:1];
  }

  const statusChip = s => `<span class="status ${esc(s)}">${esc(statusLabel(s))}</span>`;

  function notify(msg, err=false) {
    const el = document.createElement('div');
    el.className = 'toast' + (err ? ' error' : '');
    el.textContent = msg;
    $('#toastRoot').append(el);
    setTimeout(() => el.remove(), 4200);
  }

  function btn(action, text, style='outline', extra='') {
    return `<button type="button" class="btn btn-${style}" data-action="${esc(action)}" ${extra}>${text}</button>`;
  }

  function empty(msg) {
    return `<div class="empty-state"><div class="empty-glyph">∿</div><strong>${tr('Aucun résultat','No results')}</strong>${esc(msg)}</div>`;
  }

  function panel(title, subtitle, body, side='') {
    return `<section class="panel panel-pad"><div class="panel-heading"><div><h2 class="panel-title">${title}</h2>${subtitle?`<p class="panel-sub">${subtitle}</p>`:''}</div>${side}</div>${body}</section>`;
  }

  function stat(title, value, foot, ic='chart', footClass='') {
    return `<article class="stat-card"><div class="stat-label"><span>${title}</span><span class="stat-icon">${icon(ic)}</span></div><div class="stat-value mono">${value}</div><div class="stat-footer ${footClass}">${foot}</div></article>`;
  }

  function hospitalityMetrics() {
    const occupiedRooms = db.rooms.filter(r => r.status === 'occupied').length;
    const totalRooms = db.rooms.length;
    const occupancyRate = Math.round((occupiedRooms / totalRooms) * 100);
    let totalRoomRevenue = 0, totalServiceRevenue = 0, totalPaid = 0;
    db.folios.forEach(f => {
      const m = folioMetrics(f);
      totalRoomRevenue += m.roomTotal;
      totalServiceRevenue += m.serviceTotal;
      totalPaid += m.totalPaid;
    });
    const adr = occupiedRooms > 0 ? Math.round(totalRoomRevenue / occupiedRooms) : 0;
    const revPar = totalRooms > 0 ? Math.round(totalRoomRevenue / totalRooms) : 0;
    const arrivalsToday = db.bookings.filter(b => b.arrival === todayISO() && b.status === 'confirmed').length;
    const departuresToday = db.bookings.filter(b => b.departure === todayISO() && b.status === 'checked-in').length;

    return {
      occupiedRooms,
      availableRooms: db.rooms.filter(r => r.status === 'available').length,
      totalRooms,
      occupancyRate,
      adr,
      revPar,
      totalRoomRevenue,
      totalServiceRevenue,
      totalGross: totalRoomRevenue + totalServiceRevenue,
      totalPaid,
      balanceDue: Math.max(0, (totalRoomRevenue + totalServiceRevenue) - totalPaid),
      arrivalsToday,
      departuresToday
    };
  }

  // Count active items at each of the 4 steps of the current product's Flowchart
  function stepCountsFor(prodId) {
    if (prodId === 'property') {
      return {
        1: db.bookings.filter(b => b.status === 'confirmed' || b.status === 'checked-in').length,
        2: db.rooms.filter(r => r.status === 'dirty' || r.status === 'cleaning').length + db.tasks.filter(t => t.status === 'pending').length,
        3: db.folios.filter(f => f.status === 'open').length,
        4: db.auditHistory.length + db.folios.filter(f => f.status === 'closed').length
      };
    }
    const list = db.divisionRecords[prodId] || [];
    return {
      1: list.filter(r => r.step === 1).length,
      2: list.filter(r => r.step === 2).length,
      3: list.filter(r => r.step === 3).length,
      4: list.filter(r => r.step === 4).length
    };
  }

  // ============================================================================
  // 3. PORTAL LOGIN GATE (#loginGate) & START-TO-END FLOWCHART BAR (#flowchartBar)
  // ============================================================================
  function renderLoginGate() {
    const gate = $('#loginGate');
    const shell = $('#appShell');
    if (!gate) return;
    gate.hidden = !gateOpen;
    if (shell) shell.hidden = gateOpen;
    if (!gateOpen) return;

    const p = currentProduct();
    const counts = stepCountsFor(p.id);
    const roleKeys = Object.keys(p.roles);

    gate.innerHTML = `
      <div class="login-container">
        <div class="login-top">
          <div class="login-brand">
            <div class="login-brand-box"><img src="./brand/logo-main.png" alt="Blue Line Capital" onerror="this.src='/brand/logo-main.png'"/></div>
            <div>
              <h1>${tr('Blue Line Capital Group — Architecture ERP des 9 Produits','Blue Line Capital Group — 9-Product Enterprise ERP Suite')}</h1>
              <p>${tr('Explorez les workflows des filiales et ouvrez un terminal de démonstration (sans authentification serveur).','Explore division workflows and open a demo workstation (no server authentication).')}</p>
            </div>
          </div>
          <div class="toolbar-group">
            <button type="button" class="btn btn-outline btn-small" style="background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.25)" data-lang="${lang==='fr'?'en':'fr'}">
              🌐 ${lang==='fr'?'English (EN)':'Français (FR)'}
            </button>
            <button type="button" class="btn btn-primary btn-small" data-action="close-login-gate">
              ${tr('Accéder au Poste Actif →','Open Active Terminal →')}
            </button>
          </div>
        </div>

        <section class="portal-lede" aria-label="${tr('Aperçu du portail','Portal overview')}">
          <div class="portal-lede-copy">
            <span class="portal-kicker">BLUE LINE / OPERATIONS ATLAS / 2026</span>
            <h2>${tr('Neuf métiers. Une même exigence de pilotage.','Nine disciplines. One operational perspective.')}</h2>
            <p>${tr('Explorez les flux et ouvrez un poste de travail de démonstration. Les données restent dans votre navigateur : ceci ne constitue pas une connexion sécurisée.','Explore the workflows and open a demo workstation. Data is held in your browser; this is not a secure sign-in.')}</p>
          </div>
          <div class="portal-lede-metric" aria-hidden="true"><strong>09</strong><span>${tr('domaines / activité','operating / divisions')}</span></div>
        </section>
        <div class="portal-search-row">
          <label for="portalProductSearch" class="portal-search-label">${tr('Rechercher une activité','Find a business division')}</label>
          <div class="portal-search-input-wrap"><span aria-hidden="true">⌕</span><input id="portalProductSearch" type="search" autocomplete="off" placeholder="${tr('Nom, métier ou fonction…','Name, sector or function…')}" aria-controls="portalProductGrid" aria-describedby="portalResults"/></div>
          <span id="portalResults" class="portal-results" role="status" aria-live="polite">9 / 9</span>
          <kbd class="portal-shortcut">Ctrl / ⌘ + K</kbd>
        </div>

        <!-- STEP A: THE 9 PRODUCTS OF BLUE LINE CAPITAL GROUP -->
        <div class="products-9-section">
          <div class="products-9-head">
            <strong>1. ${tr('CHOISIR L’UN DES 9 PRODUITS / FILIALES DU GROUPE (BLUE LINE CAPITAL)','SELECT ONE OF THE 9 GROUP PRODUCTS / DIVISIONS')}</strong>
            <span>${tr('Architectures Open-Source rétro-ingéniées depuis GitHub (Odoo OCA & Frappe ERPNext)','Open-source architectures reverse-engineered from GitHub (Odoo OCA & Frappe ERPNext)')}</span>
          </div>
          <div class="products-9-grid" id="portalProductGrid">
            ${PRODUCTS_9.map(prod => {
              const c = stepCountsFor(prod.id);
              const totalActive = c[1] + c[2] + c[3] + c[4];
              return `
                <button type="button" class="product-9-card ${prod.id === p.id ? 'active' : ''}" data-action="select-product" data-product="${esc(prod.id)}" aria-pressed="${prod.id === p.id}">
                  <div class="product-9-top">
                    <span class="product-9-num">${esc(prod.num)}</span>
                    <span class="product-9-repo">${esc(prod.repo)}</span>
                  </div>
                  <strong>${esc(tr(prod.nameFr, prod.nameEn))}</strong>
                  <small>${esc(tr(prod.descFr, prod.descEn))}</small>
                  <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#8ad8ca;font-weight:750">
                    <span>${esc(prod.odooModel)}</span>
                    <span>${totalActive} ${tr('flux','flows')} →</span>
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- STEP B: VISUAL START-TO-END FLOWCHART FOR THE SELECTED PRODUCT -->
        <div class="flow-diagram-box">
          <div class="flow-diagram-head">
            <strong>2. FLOWCHART OPÉRATIONNEL START-TO-END — ${esc(tr(p.nameFr, p.nameEn).toUpperCase())}</strong>
            <span>Réf GitHub : <b>${esc(p.repo)}</b> (${esc(p.odooModel)})</span>
          </div>
          <div class="flow-steps-grid">
            ${p.flow.map(f => `
              <div class="flow-node ${role === f.role ? 'active-step' : ''}">
                <div class="flow-node-step">
                  <span>${f.step === 1 ? '▶ [START] ' : f.step === 4 ? '★ [END] ' : ''}${esc(f.code)}</span>
                  <span>→</span>
                </div>
                <strong>${esc(tr(f.titleFr, f.titleEn))}</strong>
                <p>${esc(tr(f.descFr, f.descEn))}</p>
                <div class="flow-node-stat">
                  <span>${counts[f.step] || 0} ${tr('dossiers','items')}</span>
                  <button type="button" class="btn btn-small" style="padding:4px 10px;min-height:26px;font-size:10px;background:#59bdb0;color:#08222c;font-weight:800" data-action="enter-terminal" data-product="${esc(p.id)}" data-role="${esc(f.role)}">
                    ${tr('Ouvrir','Open')} →
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- STEP C: SELECT SPECIFIC ROLE TERMINAL TO LOG IN -->
        <div class="products-9-head" style="margin-bottom:12px">
          <strong>3. ${tr('OUVRIR UN POSTE DE DÉMONSTRATION','OPEN A DEMO WORKSTATION')}</strong>
          <span>${tr('Le Caissier, l’Opérateur Terrain, le Comptable et le Boss ont chacun leur propre interface !','Cashiers, Field Operators, Accountants and the Boss each get their own specialized workspace!')}</span>
        </div>
        <div class="terminals-grid">
          ${roleKeys.map(rKey => {
            const rMeta = p.roles[rKey];
            const perms = roles[rKey]?.views || [];
            return `
              <article class="terminal-card ${role === rKey ? 'active-role' : ''}">
                <div>
                  <span class="terminal-role-tag">${esc(rMeta.badge)}</span>
                  <h3>${esc(tr(rMeta.fr, rMeta.en))}</h3>
                  <p class="terminal-staff">👤 ${esc(rMeta.staff)}</p>
                  <p class="terminal-desc">${esc(tr(rMeta.descFr, rMeta.descEn))}</p>
                  <div class="terminal-perms">
                    ${perms.slice(0, 5).map(v => `<span class="terminal-perm">${esc(v)}</span>`).join('')}
                  </div>
                </div>
                <button type="button" class="btn btn-primary" style="width:100%" data-action="enter-terminal" data-product="${esc(p.id)}" data-role="${esc(rKey)}">
                  ${tr('Ouvrir ce Poste','Launch Terminal')} →
                </button>
              </article>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderFlowchartBar() {
    const bar = $('#flowchartBar');
    if (!bar) return;
    const p = currentProduct();
    const counts = stepCountsFor(p.id);

    bar.innerHTML = `
      <div class="flow-track">
        ${p.flow.map((f, idx) => {
          const isCurrent = (role === f.role) || (p.id === 'property' && f.step === 1 && (role === 'reception' || role === 'service'));
          return `
            <button type="button" class="flow-pill ${isCurrent ? 'current' : ''}" data-action="switch-role-step" data-role="${esc(f.role)}" title="${esc(tr(f.descFr, f.descEn))}">
              <div>
                <span class="flow-pill-step">${f.step === 1 ? '▶ START · ' : f.step === 4 ? '★ END · ' : ''}ÉTAPE ${f.step}/4</span>
                <span class="flow-pill-title">${esc(tr(f.titleFr, f.titleEn))}</span>
              </div>
              <span class="flow-pill-count">${counts[f.step] || 0}</span>
            </button>
            ${idx < p.flow.length - 1 ? `<span class="flow-arrow" aria-hidden="true">➔</span>` : ''}
          `;
        }).join('')}
      </div>
    `;
  }

  // ============================================================================
  // 4. DEDICATED ROLE-SPECIFIC WORKSPACES (NO SHARED GENERIC DASHBOARD!)
  // ============================================================================
  function renderOverview() {
    const p = currentProduct();
    if (p.id === 'property') {
      return renderPropertyRoleTerminal();
    }
    return renderDivisionRoleTerminal(p);
  }

  // --- 4A. PRODUCT 03 (PROPERTY & SCI BLUE OCEAN HOTEL OS) ROLE TERMINALS ---
  function renderPropertyRoleTerminal() {
    const m = hospitalityMetrics();
    const p = currentProduct();
    const rMeta = currentRoleMeta();

    // 1. TERMINAL CAISSE POS (ROLE = SERVICE)
    if (role === 'service') {
      const openFolios = db.folios.filter(f => f.status === 'open');
      const targetFolio = openFolios.find(f => f.id === activeFolioId) || openFolios[0];
      const cartTotal = posCart.reduce((acc, item) => acc + item.price * item.qty, 0);

      return `
        <div class="overview-intro" style="background:linear-gradient(109deg,#13434e,#1d6473)">
          <div>
            <div class="overline">▶ [START] ÉTAPE 1B · TERMINAL CAISSE POS RESTAURANT & PRESTATIONS</div>
            <h2>${tr('Guichet Caisse POS — Imputation Directe aux Folios','F&B POS Cashier Terminal — Direct Folio Posting')}</h2>
            <p>👤 <b>${esc(rMeta.staff)}</b> · ${tr('Cliquez sur les articles à gauche pour composer le ticket, puis validez pour débiter la chambre/locataire (Étape 1 → Étape 3 Compta).','Click items on the left to build the order slip, then post directly to the active room folio.')}</p>
          </div>
          <span class="pill active">${openFolios.length} ${tr('Folios Clients Actifs','Open Guest Folios')}</span>
        </div>

        <div class="pos-layout">
          <section class="panel panel-pad">
            <div class="panel-heading">
              <div>
                <h2 class="panel-title">${tr('Catalogue Tactile des Prestations (Odoo POS)','Touch POS Service & F&B Catalog')}</h2>
                <p class="panel-sub">${tr('Sélectionnez un plat, boisson, pressing, spa ou salle de conférence','Click any item to add to the current cashier ticket')}</p>
              </div>
            </div>
            <div class="service-grid">
              ${db.services.map(s => `
                <article class="service-card">
                  <div>
                    <span class="service-cat">${esc(s.cat)}</span>
                    <h3 class="service-title">${esc(lang === 'fr' ? s.nameFr : s.nameEn)}</h3>
                    <p class="service-price mono">${money(s.price)}</p>
                  </div>
                  <button type="button" class="btn btn-primary btn-small" style="width:100%" data-action="pos-add-item" data-srv-id="${esc(s.id)}">
                    ${icon('plus')}${tr('Ajouter au Ticket','Add to Slip')}
                  </button>
                </article>
              `).join('')}
            </div>
          </section>

          <aside class="pos-ticket">
            <div class="panel-heading" style="margin-bottom:12px">
              <div>
                <span class="eyebrow" style="margin:0">TICKET DE CAISSE POS</span>
                <h2 class="panel-title">${tr('Bordereau d’Imputation','Active Cashier Slip')}</h2>
              </div>
              ${posCart.length ? btn('pos-clear-cart', tr('Vider','Clear'), 'outline btn-small') : ''}
            </div>

            <div class="form-field" style="margin-bottom:12px">
              <label>${tr('Chambre / Folio Client à débiter','Target Room / Guest Folio')}</label>
              <select id="posFolioSelect">
                ${openFolios.map(f => `<option value="${esc(f.id)}" ${targetFolio && f.id===targetFolio.id?'selected':''}>${esc(f.id)} · Ch. ${esc(f.roomId)} — ${esc(guestFor(f.guestId).name)}</option>`).join('')}
              </select>
            </div>

            <div class="pos-cart-list">
              ${posCart.length === 0 ? `<div class="quiet-box">${tr('Ticket vide. Cliquez sur un article du catalogue à gauche pour l’ajouter.','Ticket empty. Click an item on the left catalog to add it.')}</div>` : posCart.map(item => `
                <div class="pos-cart-item">
                  <div>
                    <strong>${esc(lang==='fr'?item.nameFr:item.nameEn)}</strong>
                    <div class="soft mono">${money(item.price)} × ${item.qty} = <b>${money(item.price * item.qty)}</b></div>
                  </div>
                  <div class="pos-qty-controls">
                    <button type="button" class="pos-qty-btn" data-action="pos-qty-dec" data-srv-id="${esc(item.id)}">−</button>
                    <strong class="mono">${item.qty}</strong>
                    <button type="button" class="pos-qty-btn" data-action="pos-qty-inc" data-srv-id="${esc(item.id)}">+</button>
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="bill-summary" style="grid-template-columns:1fr;margin:14px 0">
              <div>
                <span>${tr('Total Ticket POS à Imputer','Total POS Ticket to Post')}</span>
                <strong class="mono" style="color:#1b5864">${money(cartTotal)}</strong>
              </div>
            </div>

            <button type="button" class="btn btn-primary" style="width:100%" data-action="pos-submit-ticket" ${posCart.length===0?'disabled':''}>
              ${icon('check')}${tr('Valider & Envoyer au Folio (Étape 3 Compta) →','Validate & Post to Folio (Step 3 Accounting) →')}
            </button>
          </aside>
        </div>
      `;
    }

    // 2. TERMINAL RÉCEPTION FRONT-DESK (ROLE = RECEPTION)
    if (role === 'reception') {
      const arrivals = db.bookings.filter(b => b.status === 'confirmed');
      const inHouse = db.bookings.filter(b => b.status === 'checked-in');
      return `
        <div class="overview-intro">
          <div>
            <div class="overline">▶ [START] ÉTAPE 1A · TERMINAL RÉCEPTION & FRONT-DESK (CHECK-IN / CHECK-OUT)</div>
            <h2>${tr('Guichet Réception — Accueil, Clés & Ouverture des Séjours','Front Desk Terminal — Guest Arrivals, Room Keys & Stays')}</h2>
            <p>👤 <b>${esc(rMeta.staff)}</b> · ${tr('Démarrez le Flowchart ici : créez une réservation, effectuez le Check-In client ou lancez le Check-Out (qui envoie automatiquement la chambre à la Gouvernante en Étape 2).','Start the Flowchart here: create bookings, check guests in, or process check-outs (automatically handing the room off to Step 2 Housekeeping).')}</p>
          </div>
          ${btn('new-booking', `${icon('plus')}${tr('Nouvelle Réservation / Bail','New Booking / Lease')}`, 'primary')}
        </div>

        <div class="stats-grid">
          ${stat(tr('Arrivées à Enregistrer (Check-In)','Pending Check-Ins'), String(arrivals.length), tr('Clients confirmés attendus au guichet','Confirmed guests ready for check-in'), 'book')}
          ${stat(tr('Clients sur Place (In-House)','Active In-House Stays'), String(inHouse.length), tr('Séjours actifs avec Folio ouvert','Currently occupying rooms'), 'users')}
          ${stat(tr('Chambres Prêtes / Dispo','Ready & Available Rooms'), String(m.availableRooms + db.rooms.filter(r=>r.status==='inspected').length), tr('Sur 24 chambres du parc','Out of 24 property units'), 'bed')}
          ${stat(tr('En Ménage (Étape 2)','In Housekeeping (Step 2)'), String(db.rooms.filter(r=>r.status==='dirty'||r.status==='cleaning').length), tr('Remise à blanc par la gouvernante','Currently with housekeeping team'), 'sparkles')}
        </div>

        <div class="cols-2">
          ${panel(tr('File d’Attente Check-In (Étape 1 → Séjour Actif)','Arrivals Queue Ready for Check-In'), tr('Cliquez sur Check-In pour remettre la clé et activer le Folio','Click Check-In to hand over room key and activate guest folio'), `
            <div class="task-list">
              ${arrivals.slice(0, 6).map(b => `
                <div class="task-card">
                  <div class="task-info">
                    <strong>${esc(guestFor(b.guestId).name)} · Ch. ${esc(b.roomId)}</strong>
                    <p>${esc(b.id)} · ${dateLabel(b.arrival,lang)} → ${dateLabel(b.departure,lang)} (${esc(b.channel)})</p>
                  </div>
                  <div class="toolbar-group">
                    ${btn('do-checkin', `${icon('check')} Check-In`, 'primary btn-small', `data-id="${esc(b.id)}"`)}
                    ${btn('booking-detail', tr('Dossier','Details'), 'outline btn-small', `data-id="${esc(b.id)}"`)}
                  </div>
                </div>
              `).join('') || empty(tr('Aucune arrivée en attente.','No pending arrivals.'))}
            </div>
          `)}

          ${panel(tr('Séjours en Cours & Départs (Check-Out → Étape 2 Ménage)','In-House Guests & Departures (Handoff to Step 2)'), tr('Le Check-Out clôture le séjour et envoie la chambre au Kanban Gouvernante','Check-Out closes the stay and pushes the room to Housekeeping Kanban'), `
            <div class="task-list">
              ${inHouse.slice(0, 6).map(b => {
                const f = folioFor(b.folioId);
                const fm = folioMetrics(f);
                return `
                  <div class="task-card">
                    <div class="task-info">
                      <strong>Ch. ${esc(b.roomId)} · ${esc(guestFor(b.guestId).name)}</strong>
                      <p>Folio ${esc(b.folioId)} · Solde : <b class="${fm.balance>0?'negative':'positive'}">${money(fm.balance)}</b></p>
                    </div>
                    <div class="toolbar-group">
                      ${fm.balance > 0 ? btn('folio-payment-quick', `${icon('wallet')}${tr('Encaisser','Pay')}`, 'outline btn-small', `data-id="${esc(b.folioId)}"`) : ''}
                      ${btn('do-checkout', `${icon('arrow')} Check-Out → Ménage`, 'primary btn-small', `data-id="${esc(b.id)}"`)}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `)}
        </div>
      `;
    }

    // 3. TERMINAL GOUVERNANTE & MAINTENANCE KANBAN (ROLE = HOUSEKEEPING)
    if (role === 'housekeeping') {
      const colDirty = db.rooms.filter(r => r.status === 'dirty');
      const colCleaning = db.rooms.filter(r => r.status === 'cleaning' || r.status === 'maintenance');
      const colReady = db.rooms.filter(r => r.status === 'inspected' || r.status === 'available');

      return `
        <div class="overview-intro" style="background:linear-gradient(109deg,#1d4a43,#26655c)">
          <div>
            <div class="overline">ÉTAPE 2/4 · TERMINAL GOUVERNANTE, MÉNAGE & MAINTENANCE TECHNIQUE</div>
            <h2>${tr('Tableau Kanban de Remise en État des Chambres','Housekeeping & Technical Turnover Kanban Board')}</h2>
            <p>👤 <b>${esc(rMeta.staff)}</b> · ${tr('Les chambres libérées par la Réception arrivent dans la colonne 1 (Sale). Faites-les avancer jusqu’à Inspectée & Disponible pour les remettre en vente !','Rooms checked out by Front Desk land in Column 1 (Dirty). Advance them through Cleaning to Inspected & Available!')}</p>
          </div>
          ${btn('new-maintenance', `${icon('wrench')}${tr('Signaler Panne Technique','Report Technical Defect')}`, 'primary')}
        </div>

        <div class="kanban-3">
          <div class="kanban-col">
            <div class="kanban-col-head">
              <strong>1. À Nettoyer / Sortie Client (${colDirty.length})</strong>
              <span class="status dirty">Sale</span>
            </div>
            <div class="kanban-cards">
              ${colDirty.map(r => `
                <article class="kanban-card">
                  <div class="inline-flex" style="justify-content:space-between">
                    <strong class="mono" style="font-size:16px">Chambre ${esc(r.id)}</strong>
                    <span class="pill">${esc(r.floor)}</span>
                  </div>
                  <p class="hint">${esc(r.type)} · Départ client signalé par Réception</p>
                  <button type="button" class="btn btn-primary btn-small" data-action="hk-advance-room" data-id="${esc(r.id)}" data-next="cleaning">
                    ${tr('Démarrer le Ménage →','Start Cleaning →')}
                  </button>
                </article>
              `).join('') || `<div class="quiet-box">${tr('Aucune chambre sale en attente.','No dirty rooms waiting.')}</div>`}
            </div>
          </div>

          <div class="kanban-col">
            <div class="kanban-col-head">
              <strong>2. En Cours / Maintenance (${colCleaning.length})</strong>
              <span class="status cleaning">En cours</span>
            </div>
            <div class="kanban-cards">
              ${colCleaning.map(r => `
                <article class="kanban-card">
                  <div class="inline-flex" style="justify-content:space-between">
                    <strong class="mono" style="font-size:16px">Chambre ${esc(r.id)}</strong>
                    ${statusChip(r.status)}
                  </div>
                  <p class="hint">${esc(r.type)} · Étage ${esc(r.floor)}</p>
                  <button type="button" class="btn btn-primary btn-small" data-action="hk-advance-room" data-id="${esc(r.id)}" data-next="available">
                    ${icon('check')}${tr('Valider Inspection & Rendre Dispo →','Approve Inspection & Make Ready →')}
                  </button>
                </article>
              `).join('') || `<div class="quiet-box">${tr('Aucune chambre en cours.','No rooms in progress.')}</div>`}
            </div>
          </div>

          <div class="kanban-col">
            <div class="kanban-col-head">
              <strong>3. Inspectées & Prêtes (${colReady.length})</strong>
              <span class="status available">Prête</span>
            </div>
            <div class="kanban-cards">
              ${colReady.slice(0, 6).map(r => `
                <article class="kanban-card">
                  <div class="inline-flex" style="justify-content:space-between">
                    <strong class="mono">Chambre ${esc(r.id)}</strong>
                    ${statusChip(r.status)}
                  </div>
                  <p class="hint">${esc(r.type)} · ${money(r.rate)} / nuit</p>
                </article>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    // 4. TERMINAL COMPTABILITÉ & NIGHT AUDIT (ROLE = FINANCE)
    if (role === 'finance') {
      const openFolios = db.folios.filter(f => f.status === 'open');
      return `
        <div class="overview-intro" style="background:linear-gradient(109deg,#1b3954,#254f73)">
          <div>
            <div class="overline">ÉTAPE 3/4 · BUREAU COMPTABILITÉ, RECOUVREMENT FOLIOS & NIGHT AUDIT</div>
            <h2>${tr('Contrôle Financier des Folios & Clôture Journalière (Night Audit)','Folio Financial Control & End-of-Day Night Audit')}</h2>
            <p>👤 <b>${esc(rMeta.staff)}</b> · ${tr('Vérifiez les imputations provenant de la Réception et de la Caisse POS, encaissez les soldes restants et lancez le Night Audit pour transmettre le rapport final au Boss (Étape 4).','Audit charges from Reception & POS Cashier, collect remaining folio balances, and run Night Audit for the Boss (Step 4).')}</p>
          </div>
          <div class="toolbar-group">
            ${btn('run-night-audit', `${icon('moon')}${tr('Exécuter Night Audit → Étape 4','Run Night Audit → Step 4')}`, 'primary')}
            ${btn('export-csv', `${icon('download')} Export CSV SYSCOHADA`, 'outline')}
          </div>
        </div>

        <div class="stats-grid">
          ${stat(tr('Chiffre d’Affaires Folios','Total Billed Folios'), money(m.totalGross), tr('Hébergement + Prestations POS','Rooms + POS Services'), 'fileText')}
          ${stat(tr('Encaissements Reçus','Collected Payments'), money(m.totalPaid), tr('Espèces, Cartes, Orange Money','Cash, Cards & Mobile Money'), 'check', 'positive')}
          ${stat(tr('Soldes à Recouvrer','Balance Due to Collect'), money(m.balanceDue), `${openFolios.length} ${tr('folios ouverts à solder','open folios pending settlement')}`, 'wallet', m.balanceDue>0?'negative':'positive')}
          ${stat(tr('Clôtures Night Audit','Night Audit Runs'), String(db.auditHistory.length), tr('Certificats journaliers transmis au Boss','Daily certificates sent to GM'), 'moon')}
        </div>

        ${panel(tr('Folios Ouverts en Attente de Règlement / Clôture (Étape 3 → Étape 4)','Open Guest Folios Pending Settlement & Audit Closure'), tr('Encaissez le solde puis clôturez le folio pour verrouiller l’écriture comptable','Collect remaining balance then close the folio to lock the accounting entry'), `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Folio</th><th>Client</th><th>Chambre</th><th>Hébergement</th><th>POS / Extras</th><th>Total TTC</th><th>Payé</th><th>Reste Dû</th><th>Action Comptable</th></tr></thead>
              <tbody>
                ${openFolios.map(f => {
                  const fm = folioMetrics(f);
                  return `<tr>
                    <td><strong class="mono">${esc(f.id)}</strong></td>
                    <td><strong>${esc(guestFor(f.guestId).name)}</strong></td>
                    <td class="mono">Ch. ${esc(f.roomId)}</td>
                    <td class="mono">${money(fm.roomTotal)}</td>
                    <td class="mono">${money(fm.serviceTotal)}</td>
                    <td class="mono"><strong>${money(fm.totalGross)}</strong></td>
                    <td class="mono positive">${money(fm.totalPaid)}</td>
                    <td class="mono ${fm.balance>0?'negative':'positive'}"><strong>${money(fm.balance)}</strong></td>
                    <td>
                      <div class="toolbar-group">
                        ${fm.balance > 0 ? btn('folio-payment-quick', `${icon('wallet')}${tr('Encaisser Solde','Collect')}`, 'primary btn-small', `data-id="${esc(f.id)}"`) : btn('close-folio-btn', `${icon('check')}${tr('Clôturer Folio ✓','Close Folio ✓')}`, 'primary btn-small', `data-folio="${esc(f.id)}"`)}
                        ${btn('open-folio', tr('Détail','Inspect'), 'outline btn-small', `data-id="${esc(f.id)}"`)}
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        `)}
      `;
    }

    // 5. TERMINAL DIRECTION GÉNÉRALE / BOSS (ROLE = DIRECTION — STEP 4 END)
    const active = db.bookings.filter(b => b.status === 'checked-in' || b.status === 'confirmed').slice(0, 6);
    return `
      <div class="overview-intro">
        <div>
          <div class="overline">★ [END] ÉTAPE 4/4 · TOUR DE CONTRÔLE DIRECTION GÉNÉRALE (BOSS)</div>
          <h2>${tr('Pilotage Exécutif — Consolidation Hôtelière, Immobilier & 9 Filiales','Executive Command Center — Hospitality, Real Estate & 9 Divisions')}</h2>
          <p>👤 <b>${esc(rMeta.staff)}</b> · ${tr('Vue finale du Flowchart : supervisez les ratios ADR/RevPAR, les clôtures Night Audit remontées par la Comptabilité et basculez entre les 9 produits du Groupe Blue Line Capital.','Final stage of the Flowchart: oversee ADR/RevPAR yields, Night Audit closures from Accounting, and switch across all 9 Blue Line Capital Group products.')}</p>
        </div>
        <div class="toolbar-group">
          ${btn('open-login-gate', `⊞ ${tr('Portail des 9 Produits','9-Product Portal')}`, 'outline')}
          ${btn('new-booking', `${icon('plus')}${tr('Nouvelle Réservation','New Booking')}`, 'primary')}
        </div>
      </div>

      <div class="stats-grid">
        ${stat(tr('Taux d’occupation','Occupancy Rate'), `${m.occupancyRate}%`, `${m.occupiedRooms} / ${m.totalRooms} ${tr('chambres occupées','rooms occupied')}`, 'bed')}
        ${stat(tr('ADR (Tarif Moyen Journalier)','ADR (Avg Daily Rate)'), money(m.adr), tr('Revenu moyen par chambre louée','Average rate per occupied room'), 'chart')}
        ${stat(tr('RevPAR (Revenu / Ch. Dispo)','RevPAR (Rev Per Avail Room)'), money(m.revPar), tr('Performance globale du parc','Overall property yield'), 'receipt')}
        ${stat(tr('Trésorerie Encaissée','Total Collections'), money(m.totalPaid), tr('Paiements validés sur folios','Payments posted to folios'), 'wallet', 'positive')}
      </div>

      ${renderHolding9MatrixWidget()}

      <div class="section-gap">
        ${panel(tr('Séjours Actifs & Folios Consolidés (Temps Réel)','Live In-House Stays & Consolidated Folios'), tr('Synchronisé avec la Réception (Étape 1), la Gouvernante (Étape 2) et la Comptabilité (Étape 3)','Synchronized across Reception (Step 1), Housekeeping (Step 2) and Accounting (Step 3)'), `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Réservation</th><th>Client</th><th>Chambre</th><th>Arrivée</th><th>Statut</th><th>Total Folio</th><th>Action</th></tr></thead>
              <tbody>
                ${active.map(b => {
                  const f = folioFor(b.folioId);
                  const fm = folioMetrics(f);
                  return `<tr><td><strong class="mono">${esc(b.id)}</strong><div class="soft">${esc(b.channel)}</div></td><td><strong>${esc(guestFor(b.guestId).name)}</strong></td><td><span class="mono">${esc(b.roomId)}</span></td><td>${esc(dateLabel(b.arrival, lang))}</td><td>${statusChip(b.status)}</td><td><span class="mono">${money(fm.totalGross)}</span></td><td>${btn('booking-detail', tr('Gérer','Manage'), 'outline btn-small', `data-id="${esc(b.id)}"`)}</td></tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        `)}
      </div>
    `;
  }

  // --- 4B. UNIVERSAL ROLE-SPECIFIC TERMINALS FOR THE OTHER 8 PRODUCTS OF BLUE LINE CAPITAL ---
  function renderDivisionRoleTerminal(p) {
    const list = db.divisionRecords[p.id] || [];
    const rMeta = currentRoleMeta();
    const counts = stepCountsFor(p.id);
    const totalVal = list.reduce((a, r) => a + n(r.amount), 0);
    const step4Val = list.filter(r => r.step === 4).reduce((a, r) => a + n(r.amount), 0);

    // ROLE STEP 1: FRONTLINE / POS / COUNTER TERMINAL (role === 'service' or 'reception')
    if (role === 'service' || role === 'reception') {
      const step1Items = list.filter(r => r.step === 1);
      return `
        <div class="overview-intro" style="background:linear-gradient(109deg,#113e4b,#1b5d6e)">
          <div>
            <div class="overline">▶ [START] ${esc(p.flow[0].code)} · ${esc(p.repo.toUpperCase())}</div>
            <h2>${esc(tr(rMeta.fr, rMeta.en))}</h2>
            <p>👤 <b>${esc(rMeta.staff)}</b> · ${esc(tr(p.flow[0].descFr, p.flow[0].descEn))}</p>
          </div>
          <span class="pill active">${step1Items.length} ${tr('Dossiers à l’Étape 1','Items at Step 1')}</span>
        </div>

        <div class="pos-layout">
          <section class="panel panel-pad">
            <div class="panel-heading">
              <div>
                <h2 class="panel-title">${tr('1. Catalogue & Barème Officiel — ','1. Official Tariff & Catalog — ')}${esc(tr(p.nameFr, p.nameEn))}</h2>
                <p class="panel-sub">${tr('Cliquez sur une opération type pour pré-remplir le bordereau de guichet à droite','Click any standard operation below to pre-fill the frontline slip on the right')}</p>
              </div>
            </div>
            <div class="service-grid">
              ${p.catalog.map(item => `
                <article class="service-card">
                  <div>
                    <span class="service-cat">${esc(item.cat)}</span>
                    <h3 class="service-title">${esc(tr(item.nameFr, item.nameEn))}</h3>
                    <p class="service-price mono">${money(item.price)}</p>
                  </div>
                  <button type="button" class="btn btn-primary btn-small" style="width:100%" data-action="div-prefill-item" data-item-id="${esc(item.id)}">
                    ${icon('plus')}${tr('Sélectionner au Guichet','Select in Terminal')}
                  </button>
                </article>
              `).join('')}
            </div>

            <div class="section-gap">
              <h3 class="panel-title" style="margin-bottom:12px">${tr('Dossiers Saisis au Guichet (Prêts pour Envoi vers Étape 2)','Frontline Queue (Ready to Push to Step 2 Operations)')}</h3>
              <div class="task-list">
                ${step1Items.map(rec => `
                  <div class="task-card">
                    <div class="task-info">
                      <strong><span class="mono">${esc(rec.id)}</span> · ${esc(rec.client)}</strong>
                      <p>${esc(tr(rec.itemFr, rec.itemEn))} · <b class="mono">${money(rec.amount)}</b></p>
                    </div>
                    <button type="button" class="btn btn-primary btn-small" data-action="div-advance-step" data-id="${esc(rec.id)}">
                      ${tr('Transmettre à l’Étape 2 →','Send to Step 2 →')}
                    </button>
                  </div>
                `).join('') || `<div class="quiet-box">${tr('Tous les dossiers de l’Étape 1 ont été transmis à l’Étape 2.','All Step 1 items have been pushed to Step 2.')}</div>`}
              </div>
            </div>
          </section>

          <aside class="pos-ticket">
            <div class="panel-heading" style="margin-bottom:12px">
              <div>
                <span class="eyebrow" style="margin:0">BORDEREAU GUICHET (ÉTAPE 1)</span>
                <h2 class="panel-title">${tr('Nouvelle Saisie Opérationnelle','New Frontline Transaction')}</h2>
              </div>
            </div>
            <form data-form="div-new-record">
              <div class="stack" style="gap:11px">
                <div class="form-field">
                  <label>${tr('Client / Entité / Chantier / Lot','Client / Entity / Site / Batch Ref')}</label>
                  <input name="client" id="divClientInput" required placeholder="${tr('Ex: Société Douala Négoce SA','E.g. Douala Trading Corp')}" />
                </div>
                <div class="form-field">
                  <label>${tr('Opération / Article du Catalogue','Catalog Operation / Item')}</label>
                  <select name="itemId" id="divItemSelect">
                    ${p.catalog.map(c => `<option value="${esc(c.id)}" data-price="${c.price}">${esc(tr(c.nameFr, c.nameEn))} (${money(c.price)})</option>`).join('')}
                  </select>
                </div>
                <div class="form-grid">
                  <div class="form-field">
                    <label>${tr('Quantité / Lots','Quantity / Lots')}</label>
                    <input type="number" name="qty" id="divQtyInput" value="1" min="1" required />
                  </div>
                  <div class="form-field">
                    <label>${tr('Montant Unitaire (FCFA)','Unit Amount (FCFA)')}</label>
                    <input type="number" name="unitPrice" id="divPriceInput" value="${p.catalog[0]?.price || 100000}" min="0" required />
                  </div>
                </div>
                <div class="form-field">
                  <label>${tr('Mode de Règlement / Canal','Settlement / Channel')}</label>
                  <select name="paymentMethod">
                    <option>Virement Bancaire CEMAC (BEAC)</option>
                    <option>Espèces Guichet (FCFA)</option>
                    <option>Chèque Certifié Standard Chartered / Afriland</option>
                    <option>Orange Money / MTN MoMo Corporate</option>
                  </select>
                </div>
                <div class="quiet-box" style="font-size:10px">
                  <strong>Flowchart :</strong> ${tr('La validation crée le dossier à l’Étape 1 et le transmet directement au Kanban Opérations (Étape 2).','Submitting registers the transaction and sends it to the Step 2 Operations Kanban.')}
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%">
                  ${icon('check')}${tr('Enregistrer & Envoyer vers Étape 2 →','Submit & Push to Step 2 →')}
                </button>
              </div>
            </form>
          </aside>
        </div>
      `;
    }

    // ROLE STEP 2: OPERATIONS / FIELD / FACTORY KANBAN BOARD (role === 'housekeeping')
    if (role === 'housekeeping') {
      const col1 = list.filter(r => r.step === 1);
      const col2 = list.filter(r => r.step === 2);
      const col3 = list.filter(r => r.step >= 3);

      return `
        <div class="overview-intro" style="background:linear-gradient(109deg,#1c4b42,#25685c)">
          <div>
            <div class="overline">ÉTAPE 2/4 · ${esc(p.flow[1].code)} · KANBAN OPÉRATIONNEL</div>
            <h2>${esc(tr(rMeta.fr, rMeta.en))}</h2>
            <p>👤 <b>${esc(rMeta.staff)}</b> · ${esc(tr(p.flow[1].descFr, p.flow[1].descEn))}</p>
          </div>
          <span class="pill active">${col2.length} ${tr('En cours d’exécution','In execution')}</span>
        </div>

        <div class="kanban-3">
          <div class="kanban-col">
            <div class="kanban-col-head">
              <strong>1. Reçu du Guichet — Étape 1 (${col1.length})</strong>
              <span class="status pending">À traiter</span>
            </div>
            <div class="kanban-cards">
              ${col1.map(rec => `
                <article class="kanban-card">
                  <div class="inline-flex" style="justify-content:space-between">
                    <strong class="mono">${esc(rec.id)}</strong>
                    <span class="pill">${esc(rec.category)}</span>
                  </div>
                  <strong>${esc(rec.client)}</strong>
                  <p class="hint">${esc(tr(rec.itemFr, rec.itemEn))} · <b>${money(rec.amount)}</b></p>
                  <button type="button" class="btn btn-primary btn-small" data-action="div-advance-step" data-id="${esc(rec.id)}">
                    ${tr('Prendre en Charge (Passer Étape 2) →','Start Execution (Move to Step 2) →')}
                  </button>
                </article>
              `).join('') || `<div class="quiet-box">${tr('Aucun dossier en attente depuis le guichet.','No pending items from Step 1.')}</div>`}
            </div>
          </div>

          <div class="kanban-col">
            <div class="kanban-col-head">
              <strong>2. En Exécution Terrain / Usine (${col2.length})</strong>
              <span class="status occupied">Étape 2 Active</span>
            </div>
            <div class="kanban-cards">
              ${col2.map(rec => `
                <article class="kanban-card">
                  <div class="inline-flex" style="justify-content:space-between">
                    <strong class="mono">${esc(rec.id)}</strong>
                    <span class="status occupied">En cours</span>
                  </div>
                  <strong>${esc(rec.client)}</strong>
                  <p class="hint">${esc(tr(rec.itemFr, rec.itemEn))} · Qté: ${rec.qty} · <b>${money(rec.amount)}</b></p>
                  <button type="button" class="btn btn-primary btn-small" data-action="div-advance-step" data-id="${esc(rec.id)}">
                    ${icon('check')}${tr('Terminer & Envoyer au Contrôle (Étape 3) →','Complete & Send to Audit (Step 3) →')}
                  </button>
                </article>
              `).join('') || `<div class="quiet-box">${tr('Aucune opération en cours à l’Étape 2.','No active operations in Step 2.')}</div>`}
            </div>
          </div>

          <div class="kanban-col">
            <div class="kanban-col-head">
              <strong>3. Transmis au Contrôle / Audit (${col3.length})</strong>
              <span class="status confirmed">Étape 3 & 4</span>
            </div>
            <div class="kanban-cards">
              ${col3.map(rec => `
                <article class="kanban-card">
                  <div class="inline-flex" style="justify-content:space-between">
                    <strong class="mono">${esc(rec.id)}</strong>
                    <span class="status confirmed">Étape ${rec.step}/4</span>
                  </div>
                  <strong>${esc(rec.client)}</strong>
                  <p class="hint">${esc(tr(rec.itemFr, rec.itemEn))} · <b>${money(rec.amount)}</b></p>
                </article>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    // ROLE STEP 3: COMPLIANCE / QC / ACCOUNTING AUDIT STATION (role === 'finance')
    if (role === 'finance') {
      const step3Items = list.filter(r => r.step === 3);
      return `
        <div class="overview-intro" style="background:linear-gradient(109deg,#1a3852,#265175)">
          <div>
            <div class="overline">ÉTAPE 3/4 · ${esc(p.flow[2].code)} · BUREAU DE CONTRÔLE, CONFORMITÉ & AUDIT</div>
            <h2>${esc(tr(rMeta.fr, rMeta.en))}</h2>
            <p>👤 <b>${esc(rMeta.staff)}</b> · ${esc(tr(p.flow[2].descFr, p.flow[2].descEn))}</p>
          </div>
          <span class="pill active">${step3Items.length} ${tr('Dossiers à Certifier (Étape 3)','Items Pending Audit (Step 3)')}</span>
        </div>

        <div class="stats-grid">
          ${stat(tr('En Attente de Visa (Étape 3)','Pending Audit Sign-Off'), String(step3Items.length), tr('Reçus du terrain / usine (Étape 2)','Handed off from Step 2 Operations'), 'shield')}
          ${stat(tr('Transmis Direction (Étape 4)','Certified for Boss (Step 4)'), String(counts[4]), tr('Certifiés conformes OHADA/COBAC/QC','Audited & sent to Executive Boss'), 'check', 'positive')}
          ${stat(tr('Volume Financier Sous Contrôle','Total Audited Volume'), money(totalVal), tr('Cumul des opérations de la filiale','Cumulative division pipeline value'), 'wallet')}
          ${stat(tr('TVA / Retenues Estimées (19,25%)','Est. Statutory VAT (19.25%)'), money(Math.round(totalVal * 0.1925)), tr('Calcul réglementaire CEMAC / DGI','CEMAC / Cameroon statutory rate'), 'receipt')}
        </div>

        <div style="margin-bottom:20px">
          ${renderDivisionSimulator(p)}
        </div>

        ${panel(tr('File de Certification & Contrôle Réglementaire (Étape 3 → Étape 4 Direction)','Compliance, QC & Financial Audit Queue (Step 3 → Step 4 Boss)'), tr('Vérifiez les pièces justificatives et certifiez le dossier pour l’envoyer à la signature finale du Boss','Verify supporting records and certify to push to Step 4 Executive Sign-Off'), `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Réf Dossier</th><th>Tiers / Lot</th><th>Désignation Opération</th><th>Étape Actuelle</th><th>Montant HT</th><th>TVA / Retenue</th><th>Décision Contrôle & PDF</th></tr></thead>
              <tbody>
                ${list.map(rec => `
                  <tr>
                    <td><strong class="mono">${esc(rec.id)}</strong></td>
                    <td><strong>${esc(rec.client)}</strong><div class="soft">${esc(rec.paymentMethod)}</div></td>
                    <td>${esc(tr(rec.itemFr, rec.itemEn))}</td>
                    <td><span class="status ${rec.step===3?'cleaning':rec.step===4?'confirmed':'occupied'}">Étape ${rec.step}/4</span></td>
                    <td class="mono"><strong>${money(rec.amount)}</strong></td>
                    <td class="mono soft">${money(Math.round(rec.amount * 0.1925))}</td>
                    <td>
                      <div class="toolbar-group">
                        ${rec.step === 3 ? btn('div-advance-step', `${icon('check')}${tr('Certifier → Boss (Étape 4)','Certify → Boss (Step 4)')}`, 'primary btn-small', `data-id="${esc(rec.id)}"`) : rec.step < 3 ? btn('div-advance-step', `${tr('Avancer Étape','Advance Step')} ${rec.step+1} →`, 'outline btn-small', `data-id="${esc(rec.id)}"`) : `<span class="status confirmed">✓ Étape 4</span>`}
                        ${btn('print-div-record', `🖨 PDF`, 'outline btn-small', `data-id="${esc(rec.id)}"`)}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `)}
      `;
    }

    // ROLE STEP 4 [END]: EXECUTIVE BOSS COMMAND CENTER (role === 'direction')
    return `
      <div class="overview-intro">
        <div>
          <div class="overline">★ [END] ${esc(p.flow[3].code)} · TOUR DE CONTRÔLE DIRECTION GÉNÉRALE</div>
          <h2>${esc(tr(p.nameFr, p.nameEn))} — ${esc(tr(rMeta.fr, rMeta.en))}</h2>
          <p>👤 <b>${esc(rMeta.staff)}</b> · ${esc(tr(p.flow[3].descFr, p.flow[3].descEn))}</p>
        </div>
        <div class="toolbar-group">
          ${btn('open-login-gate', `⊞ ${tr('Portail des 9 Produits','All 9 Products Portal')}`, 'outline')}
          ${btn('switch-role-step', `${icon('plus')}${tr('Ouvrir Guichet Étape 1','Open Step 1 Counter')}`, 'primary', 'data-role="service"')}
        </div>
      </div>

      <div class="stats-grid">
        ${stat(tr('Volume Global du Pôle','Total Division Volume'), money(totalVal), `${list.length} ${tr('dossiers actifs dans le flowchart','active records in flowchart')}`, 'chart')}
        ${stat(tr('Validés Étape 4 [END]','Completed at Step 4 [END]'), money(step4Val), `${counts[4]} ${tr('dossiers prêts pour signature Boss','records at final executive stage')}`, 'check', 'positive')}
        ${stat(tr('En Cours (Étapes 1 → 3)','In Pipeline (Steps 1 → 3)'), String(counts[1] + counts[2] + counts[3]), `Étape 1: ${counts[1]} · Étape 2: ${counts[2]} · Étape 3: ${counts[3]}`, 'clock')}
        ${stat(tr('Référentiel Open-Source','GitHub ERP Architecture'), p.num, esc(p.repo), 'shield')}
      </div>

      <div style="margin-bottom:20px">
        ${renderDivisionSimulator(p)}
      </div>

      ${panel(tr('Registre Start-to-End & Signature Finale Direction (Étapes 1 → 4)','End-to-End Flowchart Register & Executive Final Sign-Off'), tr('Suivez chaque dossier depuis sa saisie au guichet (Étape 1) jusqu’à l’approbation finale du Boss (Étape 4)','Track every record from frontline intake (Step 1) through field execution (Step 2) and audit (Step 3) to Boss sign-off (Step 4)'), `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>ID</th><th>Client / Entité</th><th>Opération / Lot</th><th>Progression Flowchart</th><th>Montant</th><th>Opérateur</th><th>Action Direction & PDF</th></tr></thead>
            <tbody>
              ${list.map(rec => `
                <tr>
                  <td><strong class="mono">${esc(rec.id)}</strong></td>
                  <td><strong>${esc(rec.client)}</strong><div class="soft">${esc(rec.date)}</div></td>
                  <td><span class="pill">${esc(rec.category)}</span> ${esc(tr(rec.itemFr, rec.itemEn))}</td>
                  <td>
                    <span class="status ${rec.step===4?'confirmed':rec.step===3?'cleaning':'occupied'}">
                      ${rec.step===1?'▶ Étape 1 (Guichet)':rec.step===2?'⚙ Étape 2 (Terrain)':rec.step===3?'🛡 Étape 3 (Audit)':rec.approvedByBoss?'★ Clôturé & Signé Boss':'★ Étape 4 (Prêt Signature)'}
                    </span>
                  </td>
                  <td class="mono"><strong>${money(rec.amount)}</strong></td>
                  <td><span class="soft">${esc(rec.operator)}</span></td>
                  <td>
                    <div class="toolbar-group">
                      ${rec.step < 4 ? btn('div-advance-step', `${tr('Avancer Étape','Advance Step')} ${rec.step+1} →`, 'outline btn-small', `data-id="${esc(rec.id)}"`) : !rec.approvedByBoss ? btn('div-boss-approve', `★ ${tr('Signer & Clôturer [END]','Sign & Close [END]')}`, 'primary btn-small', `data-id="${esc(rec.id)}"`) : `<span class="status confirmed">✓ Signé PDG</span>`}
                      ${btn('print-div-record', `🖨 PDF`, 'outline btn-small', `data-id="${esc(rec.id)}"`)}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `)}

      ${renderProductGitHubTables(p)}

      <div class="section-gap">
        ${renderHolding9MatrixWidget()}
      </div>
    `;
  }

  function renderProductGitHubTables(p) {
    if (p.id === 'holding') {
      return `
        <div class="section-gap">
          ${panel(tr('1. Liasse de Consolidation Multi-Sociétés (OCA/account-consolidation · SYSCOHADA)','1. Multi-Company Consolidation Trial Balance (OCA/account-consolidation · SYSCOHADA)'), tr('Agrégation temps-réel des comptes de résultat et bilans des 9 entités avec éliminations intragroupe','Real-time P&L and Balance Sheet aggregation across all 9 entities with intercompany eliminations'), `
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>Code Entité</th><th>Filiale Consolidée</th><th>Méthode OHADA</th><th>Chiffre d’Affaires HT</th><th>Flux Intragroupe Éliminés</th><th>EBITDA Consolidé</th><th>Résultat Net</th><th>Quote-Part</th></tr></thead>
                <tbody>
                  <tr><td class="mono"><strong>BLC-01</strong></td><td><strong>Blue Line Capital Holding SA</strong></td><td><span class="pill active">Société Mère</span></td><td class="mono">850 000 000 FCFA</td><td class="mono soft">-420 000 000 FCFA</td><td class="mono">390 000 000 FCFA</td><td class="mono positive"><strong>312 000 000 FCFA</strong></td><td>100%</td></tr>
                  <tr><td class="mono"><strong>BLC-02</strong></td><td><strong>Blue Line Exchange (BLEX FX)</strong></td><td><span class="pill">Intégration Globale</span></td><td class="mono">1 420 000 000 FCFA</td><td class="mono soft">-185 000 000 FCFA</td><td class="mono">480 000 000 FCFA</td><td class="mono positive"><strong>345 000 000 FCFA</strong></td><td>100%</td></tr>
                  <tr><td class="mono"><strong>BLC-03</strong></td><td><strong>SCI Blue Ocean Hotel & Property</strong></td><td><span class="pill">Intégration Globale</span></td><td class="mono">960 000 000 FCFA</td><td class="mono soft">-45 000 000 FCFA</td><td class="mono">410 000 000 FCFA</td><td class="mono positive"><strong>288 000 000 FCFA</strong></td><td>100%</td></tr>
                  <tr><td class="mono"><strong>BLC-04</strong></td><td><strong>Blue Line Construction BTP SA</strong></td><td><span class="pill">Intégration Globale</span></td><td class="mono">3 450 000 000 FCFA</td><td class="mono soft">-620 000 000 FCFA</td><td class="mono">790 000 000 FCFA</td><td class="mono positive"><strong>510 000 000 FCFA</strong></td><td>100%</td></tr>
                  <tr><td class="mono"><strong>BLC-05</strong></td><td><strong>Blue Line Sugar Manufacturing MRP</strong></td><td><span class="pill">Intégration Globale</span></td><td class="mono">4 820 000 000 FCFA</td><td class="mono soft">-110 000 000 FCFA</td><td class="mono">1 150 000 000 FCFA</td><td class="mono positive"><strong>780 000 000 FCFA</strong></td><td>100%</td></tr>
                  <tr><td class="mono"><strong>BLC-06</strong></td><td><strong>Blue Line Import, SKD & Trade</strong></td><td><span class="pill">Intégration Globale</span></td><td class="mono">2 690 000 000 FCFA</td><td class="mono soft">-230 000 000 FCFA</td><td class="mono">540 000 000 FCFA</td><td class="mono positive"><strong>365 000 000 FCFA</strong></td><td>100%</td></tr>
                </tbody>
              </table>
            </div>
          `)}
        </div>
      `;
    }
    if (p.id === 'blex') {
      return `
        <div class="section-gap">
          ${panel(tr('1. Table des Cours de Change & Position des Coffres (apache/fineract + opensourcepos)','1. Live Multi-Currency Dealing Board & Vault Position (apache/fineract + opensourcepos)'), tr('Parité fixe EUR/XAF = 655,957 · Cours Achat/Vente guichet, spread et encaisse physique par devise','Fixed EUR/XAF = 655.957 peg · Live Buy/Sell counter rates, spread % and physical vault balances'), `
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>Devise</th><th>Parité / Cours Pivot</th><th>Cours Achat (Buy)</th><th>Cours Vente (Sell)</th><th>Spread %</th><th>Encaisse Coffre (Devise)</th><th>Contre-Valeur XAF</th><th>Statut Plafond COBAC</th></tr></thead>
                <tbody>
                  <tr><td><strong class="mono">EUR · Euro Zone</strong></td><td class="mono">655,957 XAF</td><td class="mono">655,00 XAF</td><td class="mono"><strong>665,00 XAF</strong></td><td>1,52%</td><td class="mono">450 000 EUR</td><td class="mono"><strong>295 180 650 FCFA</strong></td><td><span class="status confirmed">Conforme BEAC</span></td></tr>
                  <tr><td><strong class="mono">USD · US Dollar</strong></td><td class="mono">605,500 XAF</td><td class="mono">598,00 XAF</td><td class="mono"><strong>614,00 XAF</strong></td><td>2,60%</td><td class="mono">380 000 USD</td><td class="mono"><strong>230 090 000 FCFA</strong></td><td><span class="status confirmed">Conforme BEAC</span></td></tr>
                  <tr><td><strong class="mono">GBP · Livre Sterling</strong></td><td class="mono">768,200 XAF</td><td class="mono">758,00 XAF</td><td class="mono"><strong>780,00 XAF</strong></td><td>2,82%</td><td class="mono">95 000 GBP</td><td class="mono"><strong>72 979 000 FCFA</strong></td><td><span class="status confirmed">Conforme BEAC</span></td></tr>
                  <tr><td><strong class="mono">CNY · Yuan Renminbi</strong></td><td class="mono">84,500 XAF</td><td class="mono">82,80 XAF</td><td class="mono"><strong>86,40 XAF</strong></td><td>4,16%</td><td class="mono">2 100 000 CNY</td><td class="mono"><strong>177 450 000 FCFA</strong></td><td><span class="status occupied">Forte Demande Import</span></td></tr>
                  <tr><td><strong class="mono">AED · Dirham Dubaï</strong></td><td class="mono">164,800 XAF</td><td class="mono">161,50 XAF</td><td class="mono"><strong>168,50 XAF</strong></td><td>4,15%</td><td class="mono">800 000 AED</td><td class="mono"><strong>131 840 000 FCFA</strong></td><td><span class="status confirmed">KYC Corridor Actif</span></td></tr>
                </tbody>
              </table>
            </div>
          `)}
        </div>
      `;
    }
    if (p.id === 'construction') {
      return `
        <div class="section-gap">
          ${panel(tr('1. Bordereau des Prix Unitaires & Devis Quantitatif Estimatif — BPU / DQE (OCA/project + contracting)','1. Bill of Quantities (BOQ / DQE) & Physical Site Progress (OCA/project + contracting)'), tr('Métrés contradictoires sur chantier, quantités exécutées et calcul automatique des décomptes provisoires','Verified site quantity takeoffs, physical completion % and progress billing valuation'), `
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>Code Lot BPU</th><th>Désignation des Ouvrages BTP</th><th>Unité</th><th>Qté Marché</th><th>Qté Réalisée</th><th>Avancement</th><th>Prix Unitaire HT</th><th>Montant Réalisé HT</th></tr></thead>
                <tbody>
                  <tr><td class="mono"><strong>LOT-100</strong></td><td><strong>Terrassement Général, Fouilles en Puits & Blindage</strong></td><td>m³</td><td class="mono">4 500</td><td class="mono">4 500</td><td><span class="status confirmed">100%</span></td><td class="mono">8 500 FCFA</td><td class="mono"><strong>38 250 000 FCFA</strong></td></tr>
                  <tr><td class="mono"><strong>LOT-200</strong></td><td><strong>Béton Armé B35 pour Radier, Poteaux & Voiles (Ciment CEM II 42.5)</strong></td><td>m³</td><td class="mono">1 200</td><td class="mono">840</td><td><span class="status occupied">70%</span></td><td class="mono">145 000 FCFA</td><td class="mono"><strong>121 800 000 FCFA</strong></td></tr>
                  <tr><td class="mono"><strong>LOT-300</strong></td><td><strong>Ferraillage Acier Haute Adhérence FeE500 Façonné & Posé</strong></td><td>Tonne</td><td class="mono">140</td><td class="mono">98</td><td><span class="status occupied">70%</span></td><td class="mono">780 000 FCFA</td><td class="mono"><strong>76 440 000 FCFA</strong></td></tr>
                  <tr><td class="mono"><strong>LOT-400</strong></td><td><strong>Charpente Métallique Galvanisée & Couverture Bac Alu 7/10e</strong></td><td>m²</td><td class="mono">2 800</td><td class="mono">1 400</td><td><span class="status cleaning">50%</span></td><td class="mono">32 000 FCFA</td><td class="mono"><strong>44 800 000 FCFA</strong></td></tr>
                  <tr><td class="mono"><strong>LOT-500</strong></td><td><strong>Voirie Lourde Pavés Autobloquants & Caniveaux Béton Pluvial</strong></td><td>ml</td><td class="mono">650</td><td class="mono">520</td><td><span class="status occupied">80%</span></td><td class="mono">65 000 FCFA</td><td class="mono"><strong>33 800 000 FCFA</strong></td></tr>
                </tbody>
              </table>
            </div>
          `)}
        </div>
      `;
    }
    if (p.id === 'sugar') {
      return `
        <div class="section-gap">
          ${panel(tr('1. Nomenclature BOM, Gamme d’Usinage (Job Cards) & Contrôle Labo ICUMSA 45 (frappe/erpnext Manufacturing)','1. Multi-Stage BOM, Shop-Floor Job Cards & ICUMSA 45 Quality Inspection (frappe/erpnext Manufacturing)'), tr('Traçabilité complète du lot : Pont-Bascule → Moulins → Évaporation → Cuite Sous Vide → Turbinage → Ensachage 50kg','Full batch routing: Weighbridge → Tandem Mills → Evaporation → Vacuum Boiling → Centrifugals → 50kg Bagging'), `
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>Job Card / Opération</th><th>Poste de Travail (Workstation)</th><th>Intrant / Paramètre Process</th><th>Mesure Labo / Capteur</th><th>Norme Cible ICUMSA</th><th>Rendement / État</th></tr></thead>
                <tbody>
                  <tr><td class="mono"><strong>OP-10 · BROYAGE</strong></td><td><strong>Pont-Bascule & Tandem 5 Moulins</strong></td><td>Canne Fraîche (9,2 T / T Sucre)</td><td class="mono">Richesse Pol : 13,85 °Z</td><td>Extraction Jus ≥ 96,0%</td><td><span class="status confirmed">96,4% · Optimal</span></td></tr>
                  <tr><td class="mono"><strong>OP-20 · ÉPURATION</strong></td><td><strong>Chaulage CaO, Sulfitation & Décanteur</strong></td><td>Lait de Chaux 12kg + Floculant</td><td class="mono">pH Jus Clair : 7,15</td><td>pH 7,0 – 7,2 · Turbidité 0</td><td><span class="status confirmed">Conforme</span></td></tr>
                  <tr><td class="mono"><strong>OP-30 · ÉVAPORATION</strong></td><td><strong>Quadruple Effet Sous Vide</strong></td><td>Vapeur Bagasse 2,5 bar</td><td class="mono">Brix Sirop : 68,4 °Bx</td><td>65,0 à 70,0 °Brix</td><td><span class="status confirmed">Conforme</span></td></tr>
                  <tr><td class="mono"><strong>OP-40 · CUITE & TURB</strong></td><td><strong>Chaudières à Cuire A/B/C & Centrifuges</strong></td><td>Masse Cuite Jet A (1 200 rpm)</td><td class="mono">Polarisation : 99,84 °Z</td><td>Pol ≥ 99,80 °Z</td><td><span class="status confirmed">Certifié Labo</span></td></tr>
                  <tr><td class="mono"><strong>OP-50 · SÉCHAGE & LABO</strong></td><td><strong>Sécheur Tambour & Spectrophotomètre</strong></td><td>Sucre Blanc Cristallisé Extra</td><td class="mono">Couleur : 38 IU · Hum : 0,03%</td><td>ICUMSA ≤ 45 IU · Hum ≤ 0,04%</td><td><span class="status confirmed">ICUMSA 45 PASS</span></td></tr>
                </tbody>
              </table>
            </div>
          `)}
        </div>
      `;
    }
    if (p.id === 'trade') {
      return `
        <div class="section-gap">
          ${panel(tr('1. Fiche de Coût d’Approche Conteneurs (erpnext.LandedCostVoucher) & Assemblage SKD/CKD','1. Container Landed Cost Voucher (CIF + CEMAC Duty) & SKD Assembly Tracker'), tr('Ventilation exacte des frais portuaires PAD, droits de douane TEC CEMAC et coût de revient unitaire dédouané','Exact apportionment of CIF value, CEMAC customs tariff, Port of Douala handling and unit landed cost'), `
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>Conteneur / B/L</th><th>Marchandise / Kit SKD</th><th>Valeur CAF Douala</th><th>Douane TEC CEMAC</th><th>Acconage PAD & GUCE</th><th>TVA Import 19,25%</th><th>Coût Revient Total</th><th>Statut Sydonia++</th></tr></thead>
                <tbody>
                  <tr><td class="mono"><strong>MSCU-882190</strong></td><td><strong>20× Motoculteurs Diesel 15CV (SKD)</strong></td><td class="mono">11 500 000 FCFA</td><td class="mono">1 150 000 FCFA (10%)</td><td class="mono">620 000 FCFA</td><td class="mono">2 554 475 FCFA</td><td class="mono"><strong>15 824 475 FCFA</strong></td><td><span class="status confirmed">BAE Délivré</span></td></tr>
                  <tr><td class="mono"><strong>CMAU-441029</strong></td><td><strong>4× Groupes Électrogènes 100kVA (CKD)</strong></td><td class="mono">22 000 000 FCFA</td><td class="mono">4 400 000 FCFA (20%)</td><td class="mono">890 000 FCFA</td><td class="mono">5 253 325 FCFA</td><td class="mono"><strong>32 543 325 FCFA</strong></td><td><span class="status occupied">En Montage SKD</span></td></tr>
                  <tr><td class="mono"><strong>MAEU-773104</strong></td><td><strong>Conteneur 40HQ Pneus Poids Lourds</strong></td><td class="mono">14 200 000 FCFA</td><td class="mono">2 840 000 FCFA (20%)</td><td class="mono">740 000 FCFA</td><td class="mono">3 422 650 FCFA</td><td class="mono"><strong>21 202 650 FCFA</strong></td><td><span class="status confirmed">Stock Entrepôt</span></td></tr>
                  <tr><td class="mono"><strong>HLCU-910442</strong></td><td><strong>15× Tricycles Cargo 250cc Renforcés</strong></td><td class="mono">10 800 000 FCFA</td><td class="mono">2 160 000 FCFA (20%)</td><td class="mono">580 000 FCFA</td><td class="mono">2 606 450 FCFA</td><td class="mono"><strong>16 146 450 FCFA</strong></td><td><span class="status cleaning">Liquidation GUCE</span></td></tr>
                </tbody>
              </table>
            </div>
          `)}
        </div>
      `;
    }
    if (p.id === 'finance') {
      return `
        <div class="section-gap">
          ${panel(tr('1. Balance Générale des Comptes à 6 Colonnes — Plan Comptable OHADA Révisé (OCA/account-financial-tools)','1. 6-Column SYSCOHADA Trial Balance & General Ledger (OCA/account-financial-tools)'), tr('Équilibre strict Débit = Crédit sur les Classes 1 à 7, TVA collectée/récupérable (19,25%) et précompte AIR (2,2%)','Strict Debit = Credit verification across OHADA Classes 1 to 7, 19.25% VAT and 2.2% WHT'), `
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>Compte OHADA</th><th>Intitulé du Compte SYSCOHADA</th><th>Classe</th><th>Mouv. Débit</th><th>Mouv. Crédit</th><th>Solde Débiteur</th><th>Solde Créditeur</th></tr></thead>
                <tbody>
                  <tr><td class="mono"><strong>101000</strong></td><td><strong>Capital Social Appelé Versé</strong></td><td>Classe 1</td><td class="mono">0 FCFA</td><td class="mono">500 000 000 FCFA</td><td class="mono">—</td><td class="mono"><strong>500 000 000 FCFA</strong></td></tr>
                  <tr><td class="mono"><strong>241100</strong></td><td><strong>Matériel & Outillage Industriel (Usine & BTP)</strong></td><td>Classe 2</td><td class="mono">320 000 000 FCFA</td><td class="mono">0 FCFA</td><td class="mono"><strong>320 000 000 FCFA</strong></td><td class="mono">—</td></tr>
                  <tr><td class="mono"><strong>401100</strong></td><td><strong>Fournisseurs d’Exploitation Locaux & Import</strong></td><td>Classe 4</td><td class="mono">85 000 000 FCFA</td><td class="mono">142 000 000 FCFA</td><td class="mono">—</td><td class="mono"><strong>57 000 000 FCFA</strong></td></tr>
                  <tr><td class="mono"><strong>411100</strong></td><td><strong>Clients Groupe & Créances Commerciales</strong></td><td>Classe 4</td><td class="mono">210 000 000 FCFA</td><td class="mono">165 000 000 FCFA</td><td class="mono"><strong>45 000 000 FCFA</strong></td><td class="mono">—</td></tr>
                  <tr><td class="mono"><strong>443100</strong></td><td><strong>État, TVA Facturée sur Ventes (19,25% DGI)</strong></td><td>Classe 4</td><td class="mono">12 400 000 FCFA</td><td class="mono">31 650 000 FCFA</td><td class="mono">—</td><td class="mono"><strong>19 250 000 FCFA</strong></td></tr>
                  <tr><td class="mono"><strong>521100</strong></td><td><strong>Banques Locales CEMAC (Afriland, BICEC, BGFI)</strong></td><td>Classe 5</td><td class="mono">490 000 000 FCFA</td><td class="mono">188 000 000 FCFA</td><td class="mono"><strong>302 000 000 FCFA</strong></td><td class="mono">—</td></tr>
                  <tr><td class="mono"><strong>601/661</strong></td><td><strong>Achats Matières & Charges de Personnel CNPS</strong></td><td>Classe 6</td><td class="mono">195 000 000 FCFA</td><td class="mono">0 FCFA</td><td class="mono"><strong>195 000 000 FCFA</strong></td><td class="mono">—</td></tr>
                  <tr><td class="mono"><strong>701/706</strong></td><td><strong>Ventes de Produits Finis, Travaux & Services</strong></td><td>Classe 7</td><td class="mono">0 FCFA</td><td class="mono">285 750 000 FCFA</td><td class="mono">—</td><td class="mono"><strong>285 750 000 FCFA</strong></td></tr>
                </tbody>
              </table>
            </div>
          `)}
        </div>
      `;
    }
    if (p.id === 'hr') {
      return `
        <div class="section-gap">
          ${panel(tr('1. Livre de Paie Réglementaire Cameroun — CNPS, IRPP, CAC, CFC & RAV (frappe/hrms + horilla)','1. Cameroon Statutory Monthly Payroll Register — CNPS, IRPP, CAC, CFC & RAV (frappe/hrms + horilla)'), tr('Plafond légal CNPS PVID 750 000 FCFA/mois (max 31 500 FCFA part salariale) · Barème progressif IRPP + 10% CAC + 1% Crédit Foncier','Statutory 750,000 FCFA CNPS ceiling (max 31,500 FCFA employee pension) · Progressive IRPP + 10% CAC + 1% CFC'), `
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>Matricule & CNPS</th><th>Salarié & Fonction</th><th>Cat. OHADA</th><th>Salaire Brut</th><th>CNPS Salarié (4,2%)</th><th>IRPP + CAC (10%)</th><th>CFC (1%) + RAV</th><th>CNPS Patronale</th><th>Salaire Net à Payer</th></tr></thead>
                <tbody>
                  <tr><td class="mono"><strong>EMP-001 · #329-110</strong></td><td><strong>Ing. Lucien Douala</strong> (Chef Usine MRP)</td><td>Cat. 11 / G</td><td class="mono">950 000 FCFA</td><td class="mono">31 500 FCFA (Plafond)</td><td class="mono">118 400 FCFA</td><td class="mono">19 500 FCFA</td><td class="mono soft">106 400 FCFA</td><td class="mono positive"><strong>780 600 FCFA</strong></td></tr>
                  <tr><td class="mono"><strong>EMP-002 · #418-204</strong></td><td><strong>Ing. Patrice Mbarga</strong> (Conducteur BTP)</td><td>Cat. 10 / F</td><td class="mono">820 000 FCFA</td><td class="mono">31 500 FCFA (Plafond)</td><td class="mono">94 200 FCFA</td><td class="mono">16 700 FCFA</td><td class="mono soft">91 840 FCFA</td><td class="mono positive"><strong>677 600 FCFA</strong></td></tr>
                  <tr><td class="mono"><strong>EMP-003 · #509-882</strong></td><td><strong>Chantal Biya-Meka</strong> (Auditeur Fiscal)</td><td>Cat. 10 / F</td><td class="mono">750 000 FCFA</td><td class="mono">31 500 FCFA</td><td class="mono">81 500 FCFA</td><td class="mono">14 000 FCFA</td><td class="mono soft">84 000 FCFA</td><td class="mono positive"><strong>623 000 FCFA</strong></td></tr>
                  <tr><td class="mono"><strong>EMP-004 · #612-339</strong></td><td><strong>Clarisse Fotso</strong> (Cambiste BLEX FX)</td><td>Cat. 8 / D</td><td class="mono">420 000 FCFA</td><td class="mono">17 640 FCFA</td><td class="mono">34 800 FCFA</td><td class="mono">8 700 FCFA</td><td class="mono soft">47 040 FCFA</td><td class="mono positive"><strong>358 860 FCFA</strong></td></tr>
                  <tr><td class="mono"><strong>EMP-005 · #704-511</strong></td><td><strong>Hervé Siewe</strong> (Chef Atelier SKD Douala)</td><td>Cat. 9 / E</td><td class="mono">540 000 FCFA</td><td class="mono">22 680 FCFA</td><td class="mono">51 200 FCFA</td><td class="mono">10 900 FCFA</td><td class="mono soft">60 480 FCFA</td><td class="mono positive"><strong>455 220 FCFA</strong></td></tr>
                </tbody>
              </table>
            </div>
          `)}
        </div>
      `;
    }
    return `
      <div class="section-gap">
        ${panel(tr('1. File de Travaux Asynchrones (OCA/queue · queue.job) & Règles IA Copilot','1. Async Worker Queue (OCA/queue · queue.job) & AI Anomaly Rules'), tr('Supervision temps-réel des connecteurs ERP inter-filiales, tâches planifiées ir.cron et alertes heuristiques IA','Real-time monitoring of cross-subsidiary ERP connectors, scheduled ir.cron jobs and AI heuristic alerts'), `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Job UUID</th><th>Canal Worker</th><th>Méthode / Règle IA</th><th>Filiale Cible</th><th>Latence</th><th>Verdict / État</th></tr></thead>
              <tbody>
                <tr><td class="mono"><strong>JOB-99201</strong></td><td><span class="pill">root.ai_copilot</span></td><td><strong>aml.cobac.structuring_scan()</strong></td><td>02 · BLEX Change FX</td><td class="mono">12 ms</td><td><span class="status confirmed">Done · 0 Fractionnement</span></td></tr>
                <tr><td class="mono"><strong>JOB-99202</strong></td><td><span class="pill">root.mrp_telemetry</span></td><td><strong>mrp.sugar.icumsa_polarimetry_check()</strong></td><td>05 · Sugar MRP</td><td class="mono">18 ms</td><td><span class="status confirmed">Done · 38 IU (Conforme)</span></td></tr>
                <tr><td class="mono"><strong>JOB-99203</strong></td><td><span class="pill">root.syscohada</span></td><td><strong>account.move.verify_debit_credit_balance()</strong></td><td>07 · Finance OHADA</td><td class="mono">9 ms</td><td><span class="status confirmed">Done · Équilibre 100%</span></td></tr>
                <tr><td class="mono"><strong>JOB-99204</strong></td><td><span class="pill">root.btp_boq</span></td><td><strong>project.boq.cement_variance_detector()</strong></td><td>04 · Construction BTP</td><td class="mono">24 ms</td><td><span class="status occupied">Écart +1,4% Toléré</span></td></tr>
              </tbody>
            </table>
          </div>
        `)}
      </div>
    `;
  }

  function renderHolding9MatrixWidget() {
    return panel(
      tr('Matrice Exécutive des 9 Produits — Blue Line Capital Group','Blue Line Capital Group — 9-Product Enterprise Matrix'),
      tr('Cliquez sur n’importe laquelle des 9 filiales pour basculer instantanément sur son ERP et son Flowchart Start-to-End','Click any of the 9 business divisions to switch directly into its ERP and Start-to-End Flowchart'),
      `<div class="holding-grid-9">
        ${PRODUCTS_9.map(prod => {
          const c = stepCountsFor(prod.id);
          return `
            <article class="holding-card-9 ${prod.id === productId ? 'current-prod' : ''}">
              <div>
                <div class="inline-flex" style="justify-content:space-between;width:100%;margin-bottom:6px">
                  <span class="pill active">${esc(prod.num)}</span>
                  <span class="soft mono" style="font-size:10px">${esc(prod.repo)}</span>
                </div>
                <h3 style="font-size:14px;margin:4px 0;color:#153643">${esc(tr(prod.nameFr, prod.nameEn))}</h3>
                <p class="hint" style="line-height:1.45">${esc(tr(prod.descFr, prod.descEn))}</p>
              </div>
              <div style="border-top:1px solid #e6eeec;padding-top:10px;display:flex;justify-content:space-between;align-items:center;gap:8px">
                <span class="soft" style="font-size:10px">Étapes: <b>${c[1]}</b> → <b>${c[2]}</b> → <b>${c[3]}</b> → <b>${c[4]}</b></span>
                <button type="button" class="btn btn-outline btn-small" data-action="select-product-direct" data-product="${esc(prod.id)}">
                  ${prod.id === productId ? tr('Actif ✓','Active ✓') : `${tr('Ouvrir ERP','Open ERP')} →`}
                </button>
              </div>
            </article>
          `;
        }).join('')}
      </div>`
    );
  }

  // ============================================================================
  // 5. NAVIGATION, DEEP ERP VIEWS & EVENT HANDLERS
  // ============================================================================
  function renderNav() {
    const p = currentProduct();
    const allowedViews = roles[role]?.views || roles.service.views;
    let prev = -1;
    $('#mainNav').innerHTML = allowedViews.map(id => {
      const x = navItemMeta(id, p.id);
      if (!x) return '';
      const groupHeader = x.group !== prev ? `<div class="nav-section">${[tr('POSTE & PILOTAGE','TERMINAL & PILOTAGE'), tr('EXPLOITATION & TERRAIN','OPERATIONS & FIELD'), tr('CONTRÔLE & SYSTÈME','AUDIT & SYSTEM')][x.group]}</div>` : '';
      prev = x.group;
      const counts = stepCountsFor(p.id);
      const divList = db.divisionRecords[p.id] || [];
      const badge = id === 'overview' ? (counts[1] + counts[2] + counts[3])
        : p.id === 'property' ? (id === 'bookings' ? db.bookings.filter(b => b.status === 'confirmed').length : id === 'folios' ? db.folios.filter(f => f.status === 'open').length : id === 'maintenance' ? db.maintenance.filter(m => m.stage !== 'resolved').length : 0)
        : (id === 'bookings' ? divList.length : id === 'folios' ? counts[3] + counts[4] : id === 'rooms' ? (DIV_UNITS_SEED[p.id]?.length || 6) : 0);
      const label = id === 'overview' ? tr(currentRoleMeta().fr, currentRoleMeta().en) : tr(x.fr, x.en);
      return `${groupHeader}<button type="button" class="nav-item ${view===id?'active':''}" data-view="${id}" ${view===id?'aria-current="page"':''}>${icon(x.icon)}<span>${esc(label)}</span>${badge > 0 ? `<span class="nav-badge">${badge}</span>` : ''}</button>`;
    }).join('');
  }

  function render() {
    const p = currentProduct();
    if (!p.roles[role]) {
      role = Object.keys(p.roles)[0] || 'direction';
    }
    if (!canView(view)) view = 'overview';

    // Populate Product Select in Sidebar
    const prodSelect = $('#productSelect');
    if (prodSelect) {
      prodSelect.innerHTML = PRODUCTS_9.map(prod => `<option value="${esc(prod.id)}" ${prod.id === p.id ? 'selected' : ''}>${esc(prod.num)} · ${esc(tr(prod.nameFr, prod.nameEn))}</option>`).join('');
    }
    const repoTag = $('#sidebarRepoTag');
    if (repoTag) repoTag.textContent = `GitHub: ${p.repo}`;

    // Populate Role Select in Topbar for current product
    const roleSelect = $('#roleSelect');
    if (roleSelect) {
      roleSelect.innerHTML = Object.keys(p.roles).map(rKey => `<option value="${esc(rKey)}" ${rKey === role ? 'selected' : ''}>${esc(tr(p.roles[rKey].fr, p.roles[rKey].en))}</option>`).join('');
    }

    const rMeta = currentRoleMeta();
    const item = navItemMeta(view, p.id);
    document.documentElement.lang = lang;
    document.documentElement.dataset.erpProduct = p.id;
    document.documentElement.dataset.erpRole = role;
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));

    if ($('#productBreadcrumb')) $('#productBreadcrumb').textContent = `${p.num} · ${tr(p.nameFr, p.nameEn)}`;
    if ($('#terminalBreadcrumb')) $('#terminalBreadcrumb').textContent = tr(rMeta.fr, rMeta.en);
    if ($('#crumbTitle')) $('#crumbTitle').textContent = view === 'overview' ? rMeta.badge : tr(item.fr, item.en);
    if ($('#activeStaffBadge')) $('#activeStaffBadge').textContent = rMeta.staff;
    if ($('#activeRoleCode')) $('#activeRoleCode').textContent = rMeta.badge;
    if ($('#userAvatar')) $('#userAvatar').textContent = rMeta.badge.slice(0, 2);

    const titleText = view === 'overview' ? `${tr(rMeta.fr, rMeta.en)} — ${tr(p.nameFr, p.nameEn)}` : `${tr(item.fr, item.en)}${p.id !== 'property' ? ` — ${tr(p.nameFr, p.nameEn)}` : ''}`;
    const descText = view === 'overview' ? `${tr(rMeta.descFr, rMeta.descEn)} (Architecture GitHub : ${p.repo})` : `${tr(item.descFr, item.descEn)} (${p.odooModel})`;

    $('#pageTitle').innerHTML = `${esc(titleText)}<span class="heading-dot">.</span>`;
    $('#pageDescription').textContent = descText;
    $('#pageEyebrow').textContent = `${p.num} · ${p.repo.toUpperCase()} · ${rMeta.badge}`;
    $('#todayPill').textContent = dateLabel(todayISO(), lang, true);
    const demoPill = $('#shiftStatusPill');
    if (demoPill) { demoPill.textContent = tr('●  MODE DÉMONSTRATION — DONNÉES LOCALES','●  DEMO MODE — LOCAL DATA'); demoPill.title = tr('Sans authentification ni synchronisation serveur','No authenticated session or server synchronization'); }

    renderLoginGate();
    renderFlowchartBar();
    renderNav();
    $('#headingActions').innerHTML = headingActions();

    const viewMap = {
      overview: renderOverview,
      modulesReview: () => (window.renderModulesReviewView ? window.renderModulesReviewView() : renderOverview()),
      modulesBenchmark: () => (window.renderERPReadinessBenchmark ? window.renderERPReadinessBenchmark() : renderOverview()),
      rooms: renderRooms,
      bookings: renderBookings,
      folios: renderFolios,
      services: renderServices,
      calendar: renderCalendar,
      guests: renderGuests,
      housekeeping: renderHousekeeping,
      maintenance: renderMaintenance,
      operations: renderOperations,
      audit: renderAudit,
      reports: renderReports,
      settings: renderSettings
    };

    $('#mainView').innerHTML = (viewMap[view] || renderOverview)();
  }

  function headingActions() {
    const p = currentProduct();
    if (view === 'modulesBenchmark') return btn('switch-view-overview', `⇦ ${tr('Retour au Terminal','Back to Terminal')}`, 'outline');
    if (view === 'modulesReview') {
      return `
        ${btn('open-login-gate', `⊞ ${tr('Portail 9 Produits','9-Product Portal')}`, 'outline')}
        ${btn('switch-view-overview', `⇦ ${tr('Retour au Terminal','Back to Terminal')}`, 'primary')}
      `;
    }
    if (view === 'overview') {
      return `
        ${btn('open-login-gate', `⊞ ${tr('Changer Produit / Poste (9 ERP)','Switch Product / Role (9 ERP)')}`, 'outline')}
        ${btn('goto-modules-review', `📊 ${tr('Revue 9 Modules ERP','9-Module ERP Review')}`, 'dark')}
        ${p.id === 'property' && can('booking') ? btn('new-booking', `${icon('plus')}${tr('Nouvelle Réservation','New Booking')}`, 'primary') : btn('switch-role-step', `${icon('plus')}${tr('Saisie Guichet (Étape 1)','New Step 1 Entry')}`, 'primary', 'data-role="service"')}
      `;
    }
    if (p.id !== 'property') {
      const actions = [btn('open-login-gate', `⊞ ${tr('Portail 9 Produits','9-Product Portal')}`, 'outline')];
      if (view === 'reports' || view === 'folios') actions.push(btn('export-csv', `${icon('download')} CSV Export`));
      else if (view === 'audit') actions.push(btn('div-audit-certify-all', `${icon('check')}${tr('Certifier Étape 3 → 4','Certify Step 3 → 4')}`, 'primary'));
      else actions.push(btn('switch-role-step', `${icon('plus')}${tr('Nouveau Dossier (Étape 1)','New Step 1 Entry')}`, 'primary', 'data-role="service"'));
      return actions.join(' ');
    }
    switch (view) {
      case 'bookings': return can('booking') ? btn('new-booking', `${icon('plus')}${tr('Créer une réservation','Create reservation')}`, 'primary') : '';
      case 'folios': return can('folio_charge') ? btn('open-service-charge', `${icon('plus')}${tr('Ajouter prestation au Folio','Add folio charge')}`, 'primary') : '';
      case 'services': return can('folio_charge') ? btn('open-service-charge', `${icon('utensils')}${tr('Commander & imputer','Order & charge')}`, 'primary') : '';
      case 'guests': return can('guest') ? btn('new-guest', `${icon('plus')}${tr('Nouveau client','New guest')}`, 'primary') : '';
      case 'maintenance': return can('maintenance') ? btn('new-maintenance', `${icon('wrench')}${tr('Signaler une panne','Report issue')}`, 'primary') : '';
      case 'audit': return can('audit_run') ? btn('run-night-audit', `${icon('moon')}${tr('Exécuter le Night Audit','Run Night Audit')}`, 'primary') : '';
      case 'reports': return can('export') ? btn('export-csv', `${icon('download')} CSV Export`) : '';
      default: return btn('open-login-gate', `⊞ ${tr('Portail 9 Produits','9-Product Portal')}`, 'outline');
    }
  }

  function renderRooms() {
    const p = currentProduct();
    if (p.id !== 'property') {
      const units = DIV_UNITS_SEED[p.id] || DIV_UNITS_SEED.holding;
      const byZone = {};
      units.forEach(u => {
        if (filter && !`${u.id} ${u.type} ${u.zone} ${u.specs.join(' ')}`.toLowerCase().includes(filter.toLowerCase())) return;
        byZone[u.zone] = byZone[u.zone] || [];
        byZone[u.zone].push(u);
      });
      return `
        <div class="toolbar">
          <p class="hint">${units.length} ${tr('unités opérationnelles, lignes industrielles ou coffres actifs — ','active operational units, industrial lines or vaults — ')}<b>${esc(p.odooModel)}</b></p>
          <label class="search-field">${icon('search')}<input id="searchInput" data-filter placeholder="${tr('Rechercher unité, ligne, coffre, chantier...','Search unit, line, vault, site...')}" value="${esc(filter)}" /></label>
        </div>
        ${Object.keys(byZone).map(zKey => `
          <div class="floor-section">
            <div class="floor-header">${esc(zKey)} · ${byZone[zKey].length} ${tr('unités','units')}</div>
            <div class="rooms-grid">
              ${byZone[zKey].map(u => `
                <article class="room-card">
                  <div class="room-head">
                    <div><div class="room-number mono" style="font-size:20px">${esc(u.id)}</div><div class="room-type">${esc(u.type)}</div></div>
                    ${statusChip(u.status)}
                  </div>
                  <div>
                    <div class="amenity-chips">${u.specs.map(a => `<span class="amenity-chip">${esc(a)}</span>`).join('')}</div>
                    <p class="hint" style="margin-top:10px">${tr('Valorisation / Capacité Active','Active Valuation / Capacity')}</p>
                    <p class="room-price mono">${money(u.rate)}</p>
                  </div>
                  <div class="room-actions">
                    ${btn('switch-role-step', `${icon('plus')}${tr('Opérer (Étape 1)','Operate (Step 1)')}`, 'primary btn-small', 'data-role="service"')}
                    ${btn('switch-role-step', `${tr('Kanban (Étape 2)','Kanban (Step 2)')}`, 'outline btn-small', 'data-role="housekeeping"')}
                  </div>
                </article>
              `).join('')}
            </div>
          </div>
        `).join('')}
      `;
    }

    const floors = ['all', 'RDC', '1e', '2e'];
    const floorPills = floors.map(f => `<button class="pill ${floorFilter===f?'active':''}" data-floor-filter="${f}">${f==='all'?tr('Tous les étages','All floors'):tr(`Étage ${f}`,`Floor ${f}`)}</button>`).join('');
    const statuses = ['all','available','occupied','dirty','cleaning','inspected','maintenance'];
    const statusPills = statuses.map(s => `<button class="pill ${roomFilter===s?'active':''}" data-room-filter="${s}">${s==='all'?tr('Tous les états','All states'):statusLabel(s)} <b>${s==='all'?db.rooms.length:db.rooms.filter(r=>r.status===s).length}</b></button>`).join('');
    const matched = db.rooms.filter(r => (floorFilter === 'all' || r.floor === floorFilter) && (roomFilter === 'all' || r.status === roomFilter) && (`${r.id} ${r.type} ${r.amenities.join(' ')}`.toLowerCase().includes(filter.toLowerCase())));
    const byFloors = {};
    matched.forEach(r => { byFloors[r.floor] = byFloors[r.floor] || []; byFloors[r.floor].push(r); });

    return `
      <div class="toolbar">
        <div class="toolbar-group"><div class="checklist">${floorPills}</div><div class="checklist">${statusPills}</div></div>
        <label class="search-field">${icon('search')}<input id="searchInput" data-filter placeholder="${tr('Chercher chambre, type, commodité...','Search room, type, amenity...')}" value="${esc(filter)}" /></label>
      </div>
      ${Object.keys(byFloors).sort().map(fKey => `
        <div class="floor-section">
          <div class="floor-header">${tr(`Étage ${fKey} · ${byFloors[fKey].length} unités`,`Floor ${fKey} · ${byFloors[fKey].length} units`)}</div>
          <div class="rooms-grid">
            ${byFloors[fKey].map(r => `
              <article class="room-card">
                <div class="room-head">
                  <div><div class="room-number mono">${esc(r.id)}</div><div class="room-type">${esc(r.type)} · Étage ${esc(r.floor)}</div></div>
                  ${statusChip(r.status)}
                </div>
                <div>
                  <div class="amenity-chips">${r.amenities.map(a => `<span class="amenity-chip">${esc(a)}</span>`).join('')}</div>
                  <p class="hint" style="margin-top:10px">${tr('Tarif Odoo / nuitée','Odoo rate / night')}</p>
                  <p class="room-price mono">${money(r.rate)}</p>
                </div>
                <div class="room-actions">
                  ${btn('room-detail', `${icon('bed')}${tr('Détails','Details')}`, 'outline btn-small', `data-id="${esc(r.id)}"`)}
                  ${can('room') ? btn('room-edit', tr('Changer statut','Update status'), 'primary btn-small', `data-id="${esc(r.id)}"`):''}
                  ${can('folio_charge') && r.status === 'occupied' ? btn('charge-room', `${icon('utensils')}${tr('Imputer Folio','Charge')}`, 'outline btn-small', `data-room="${esc(r.id)}"`) : ''}
                </div>
              </article>
            `).join('')}
          </div>
        </div>
      `).join('')}
      ${matched.length === 0 ? empty(tr('Aucune chambre ne correspond à ces critères.','No rooms found.')) : ''}
    `;
  }

  function renderBookings() {
    const p = currentProduct();
    if (p.id !== 'property') {
      let list = (db.divisionRecords[p.id] || []).filter(rec => `${rec.id} ${rec.client} ${rec.itemFr} ${rec.itemEn} ${rec.category}`.toLowerCase().includes(filter.toLowerCase()));
      if (selectedDate) list = list.filter(rec => rec.date === selectedDate);
      return `
        <div class="toolbar">
          <div class="toolbar-group">
            <label class="search-field">${icon('search')}<input id="searchInput" data-filter placeholder="${tr('Rechercher réf, client, lot, opération...','Search ref, client, batch, operation...')}" value="${esc(filter)}"/></label>
            ${selectedDate ? `<div class="inline-flex"><span class="pill active">${esc(dateLabel(selectedDate,lang,true))}</span>${btn('clear-date','✕','outline btn-small')}</div>` : ''}
          </div>
          <p class="hint">${list.length} ${tr('dossiers opérationnels actifs dans le Flowchart','active operational dossiers in Flowchart')} (${esc(p.odooModel)})</p>
        </div>
        <section class="panel">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Réf ERP</th><th>${tr('Client / Entité / Lot','Counterparty / Batch')}</th><th>${tr('Catégorie Métier','Category')}</th><th>${tr('Opération','Operation')}</th><th>${tr('Étape Flowchart','Flowchart Step')}</th><th>${tr('Montant Total','Total Amount')}</th><th>${tr('Actions & Pièce PDF','Actions & Official PDF')}</th></tr></thead>
              <tbody>
                ${list.map(rec => `
                  <tr>
                    <td><strong class="mono">${esc(rec.id)}</strong><div class="soft">${esc(rec.date)}</div></td>
                    <td><strong>${esc(rec.client)}</strong><div class="soft">${esc(rec.operator)}</div></td>
                    <td><span class="pill">${esc(rec.category)}</span></td>
                    <td>${esc(tr(rec.itemFr, rec.itemEn))} <span class="soft">(×${rec.qty})</span></td>
                    <td>
                      <span class="status ${rec.step===4?'confirmed':rec.step===3?'cleaning':'occupied'}">
                        ${rec.step===1?'▶ Étape 1 (Guichet)':rec.step===2?'⚙ Étape 2 (Terrain)':rec.step===3?'🛡 Étape 3 (Audit)':rec.approvedByBoss?'★ Clôturé Boss':'★ Étape 4 (Direction)'}
                      </span>
                    </td>
                    <td class="mono"><strong>${money(rec.amount)}</strong></td>
                    <td>
                      <div class="toolbar-group">
                        ${rec.step < 4 ? btn('div-advance-step', `Étape ${rec.step+1} →`, 'primary btn-small', `data-id="${esc(rec.id)}"`) : !rec.approvedByBoss ? (role === 'direction' ? btn('div-boss-approve', `★ Signer`, 'primary btn-small', `data-id="${esc(rec.id)}"`) : `<span class="status occupied">★ Visa Boss Requis</span>`) : `<span class="status confirmed">✓ Signé</span>`}
                        ${btn('print-div-record', `🖨 PDF`, 'outline btn-small', `data-id="${esc(rec.id)}"`)}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>
      `;
    }

    const matched = db.bookings.filter(b => (bookingFilter === 'all' || b.status === bookingFilter) && (!selectedDate || (b.arrival <= selectedDate && b.departure > selectedDate)) && (`${b.id} ${guestFor(b.guestId).name} ${b.roomId}`.toLowerCase().includes(filter.toLowerCase()))).sort((a,b) => a.arrival.localeCompare(b.arrival));
    const statuses = ['all','confirmed','checked-in','checked-out','cancelled'];
    return `
      <div class="toolbar">
        <div class="toolbar-group">
          <label class="search-field">${icon('search')}<input id="searchInput" data-filter placeholder="${tr('Rechercher réservation, client, chambre...','Find booking, guest, room...')}" value="${esc(filter)}"/></label>
          <select class="field-select" data-booking-filter aria-label="${tr('Filtrer par statut','Filter by status')}">
            ${statuses.map(s => `<option value="${s}" ${s===bookingFilter?'selected':''}>${s==='all'?tr('Tous les statuts','All statuses'):statusLabel(s)}</option>`).join('')}
          </select>
        </div>
        ${selectedDate ? `<div class="inline-flex"><span class="pill active">${esc(dateLabel(selectedDate,lang,true))}</span>${btn('clear-date','✕','outline btn-small')}</div>` : `<p class="hint">${matched.length} ${tr('dossiers de réservation','reservations')}</p>`}
      </div>
      <section class="panel">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>ID</th><th>${tr('Client Odoo','Odoo Guest')}</th><th>${tr('Chambre','Room')}</th><th>${tr('Dates de séjour','Dates')}</th><th>${tr('Canal','Channel')}</th><th>${tr('Folio lié','Linked Folio')}</th><th>${tr('Statut','Status')}</th><th></th></tr></thead>
            <tbody>
              ${matched.map(b => {
                const f = folioFor(b.folioId);
                const fm = folioMetrics(f);
                return `<tr>
                  <td><strong class="mono">${esc(b.id)}</strong></td>
                  <td><strong>${esc(guestFor(b.guestId).name)}</strong><div class="soft">${esc(guestFor(b.guestId).phone)}</div></td>
                  <td><span class="mono">${esc(b.roomId)}</span></td>
                  <td>${esc(dateLabel(b.arrival,lang))} → ${esc(dateLabel(b.departure,lang))}</td>
                  <td><span class="pill">${esc(b.channel)}</span></td>
                  <td><button class="panel-link mono" data-action="open-folio" data-id="${esc(b.folioId)}">${esc(b.folioId)} (${money(fm.totalGross)})</button></td>
                  <td>${statusChip(b.status)}</td>
                  <td>${btn('booking-detail', tr('Gérer','Manage'), 'outline btn-small', `data-id="${esc(b.id)}"`)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderFolios() {
    const p = currentProduct();
    if (p.id !== 'property') {
      const list = db.divisionRecords[p.id] || [];
      const sumHT = list.reduce((a, r) => a + r.amount, 0);
      const taxRate = p.id === 'hr' ? 0.042 : p.id === 'blex' ? 0.015 : 0.1925;
      const taxLabel = p.id === 'hr' ? 'Cotisation CNPS (4,2%)' : p.id === 'blex' ? 'Commission & Taxe Change (1,5%)' : p.id === 'construction' ? 'TVA 19,25% (Retenue 10% suivie)' : 'TVA / Droits Réglementaires (19,25%)';
      const sumTax = Math.round(sumHT * taxRate);
      const sumTTC = p.id === 'hr' ? (sumHT - sumTax) : (sumHT + sumTax);

      return `
        <div class="bill-summary" style="margin-bottom:20px">
          <div><span>${tr('Volume Brut H.T. Consolidé','Gross Base Volume (HT)')}</span><strong class="mono">${money(sumHT)}</strong></div>
          <div><span>${esc(taxLabel)}</span><strong class="mono" style="color:#2a7e71">${money(sumTax)}</strong></div>
          <div><span>${tr('Total Net Liquidé / TTC','Total Net Settled / TTC')}</span><strong class="mono">${money(sumTTC)}</strong></div>
        </div>
        ${renderProductGitHubTables(p)}
        <section class="panel" style="margin-top:20px">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Pièce / Bordereau</th><th>Tiers / Entité</th><th>Désignation</th><th>Base H.T. / Brut</th><th>${esc(taxLabel)}</th><th>Net / TTC</th><th>Mode Règlement</th><th>Étape</th><th>Pièce Officielle</th></tr></thead>
              <tbody>
                ${list.map(rec => {
                  const tx = Math.round(rec.amount * taxRate);
                  const net = p.id === 'hr' ? (rec.amount - tx) : (rec.amount + tx);
                  return `
                    <tr>
                      <td><strong class="mono">LIQ-${esc(rec.id)}</strong></td>
                      <td><strong>${esc(rec.client)}</strong></td>
                      <td>${esc(tr(rec.itemFr, rec.itemEn))}</td>
                      <td class="mono">${money(rec.amount)}</td>
                      <td class="mono soft">${money(tx)}</td>
                      <td class="mono"><strong>${money(net)}</strong></td>
                      <td><span class="pill">${esc(rec.paymentMethod)}</span></td>
                      <td><span class="status ${rec.step>=3?'confirmed':'occupied'}">Étape ${rec.step}/4</span></td>
                      <td>${btn('print-div-record', `🖨 ${tr('Imprimer Pièce','Print Slip')}`, 'outline btn-small', `data-id="${esc(rec.id)}"`)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </section>
      `;
    }

    const matched = db.folios.filter(f => (folioFilter === 'all' || f.status === folioFilter) && (`${f.id} ${guestFor(f.guestId).name} ${f.roomId} ${f.bookingId}`.toLowerCase().includes(filter.toLowerCase()))).sort((a,b) => b.id.localeCompare(a.id));
    let sumRoom = 0, sumService = 0, sumGross = 0, sumBal = 0;
    matched.forEach(f => { const m = folioMetrics(f); sumRoom += m.roomTotal; sumService += m.serviceTotal; sumGross += m.totalGross; sumBal += m.balance; });
    return `
      <div class="bill-summary" style="margin-bottom:20px">
        <div><span>${tr('Total Hébergement (Folios)','Total Room Charges')}</span><strong class="mono">${money(sumRoom)}</strong></div>
        <div><span>${tr('Prestations & Room Service','Extras & F&B Services')}</span><strong class="mono" style="color:#2a7e71">${money(sumService)}</strong></div>
        <div><span>${tr('Total Facturé / Reste à percevoir','Total Billed / Balance Due')}</span><strong class="mono">${money(sumGross)} <small class="soft">(${money(sumBal)} restant)</small></strong></div>
      </div>
      <div class="toolbar">
        <div class="toolbar-group">
          <label class="search-field">${icon('search')}<input id="searchInput" data-filter placeholder="${tr('Folio ID, client, chambre...','Folio ID, guest, room...')}" value="${esc(filter)}"/></label>
          <div class="checklist">
            <button class="pill ${folioFilter==='all'?'active':''}" data-folio-filter="all">${tr('Tous les Folios','All Folios')} <b>${db.folios.length}</b></button>
            <button class="pill ${folioFilter==='open'?'active':''}" data-folio-filter="open">${tr('En cours (Ouverts)','Open')} <b>${db.folios.filter(f=>f.status==='open').length}</b></button>
            <button class="pill ${folioFilter==='closed'?'active':''}" data-folio-filter="closed">${tr('Clôturés','Closed')} <b>${db.folios.filter(f=>f.status==='closed').length}</b></button>
          </div>
        </div>
        ${can('folio_charge') ? btn('open-service-charge', `${icon('plus')}${tr('Ajouter prestation','Post charge')}`, 'primary') : ''}
      </div>
      <section class="panel">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Folio ID</th><th>${tr('Client','Guest')}</th><th>${tr('Chambre','Room')}</th><th>${tr('Hébergement','Room')}</th><th>${tr('Services','Services')}</th><th>${tr('Total','Total')}</th><th>${tr('Versé','Paid')}</th><th>${tr('Solde','Balance')}</th><th>${tr('Statut','Status')}</th><th></th></tr></thead>
            <tbody>
              ${matched.map(f => {
                const fm = folioMetrics(f);
                return `<tr>
                  <td><strong class="mono">${esc(f.id)}</strong><div class="soft">${esc(f.bookingId)}</div></td>
                  <td><strong>${esc(guestFor(f.guestId).name)}</strong></td>
                  <td><span class="mono">${esc(f.roomId)}</span></td>
                  <td class="mono">${money(fm.roomTotal)}</td>
                  <td class="mono"><span class="folio-line-cat restaurant">${money(fm.serviceTotal)}</span></td>
                  <td class="mono"><strong>${money(fm.totalGross)}</strong></td>
                  <td class="mono positive">${money(fm.totalPaid)}</td>
                  <td class="mono ${fm.balance > 0 ? 'negative' : 'positive'}"><strong>${money(fm.balance)}</strong></td>
                  <td>${statusChip(f.status)}</td>
                  <td>
                    <div class="toolbar-group">
                      ${btn('open-folio', tr('Ouvrir Folio','Open Folio'), 'primary btn-small', `data-id="${esc(f.id)}"`)}
                      ${can('payment') && fm.balance > 0 ? btn('folio-payment-quick', `${icon('wallet')}`, 'outline btn-small', `data-id="${esc(f.id)}"`) : ''}
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderDivisionSimulator(p) {
    const simMeta = {
      blex: {
        titleFr: 'Simulateur Temps-Réel Change FX & Contrôle Seuil LBC/FT COBAC',
        titleEn: 'Live FX Currency Spread & COBAC AML Threshold Simulator',
        subFr: 'Parité fixe EUR/XAF = 655,957 · Alerte réglementaire ANIF/COBAC automatique dès 5 000 000 FCFA',
        subEn: 'Fixed EUR/XAF = 655.957 peg · Mandatory ANIF/COBAC AML declaration triggered at >= 5,000,000 FCFA',
        labelA: 'Montant en Devise (EUR / USD)', valA: 10000,
        labelB: 'Cours Appliqué (XAF / Unité)', valB: 665,
        labelC: 'Spread / Commission BLEX (%)', valC: 1.5,
        btnFr: 'Créer Bordereau FX & Vérifier KYC COBAC →', btnEn: 'Generate FX Slip & Run COBAC Check →'
      },
      sugar: {
        titleFr: 'Calculateur Industriel de Rendement Canne → Sucre Blanc ICUMSA 45',
        titleEn: 'Industrial Cane-to-Sugar Yield & ICUMSA 45 Lab Calculator',
        subFr: 'Bilan massique : Tonnage Canne × Richesse Saccharose (Pol °Z) × Extraction Moulin = Tonnes Sucre Raffiné & Sacs 50kg',
        subEn: 'Mass balance: Cane Tonnage × Sucrose Pol % × Mill Extraction = Refined Sugar Output & 50kg Bags',
        labelA: 'Tonnage Canne Broyée (Tonnes)', valA: 500,
        labelB: 'Rendement Extraction Sucre (%)', valB: 11,
        labelC: 'Prix de Cession Sac 50kg (FCFA)', valC: 42000,
        btnFr: 'Lancer l’Ordre de Fabrication MRP (mrp.production) →', btnEn: 'Launch Manufacturing Order (mrp.production) →'
      },
      construction: {
        titleFr: 'Simulateur de Décompte Provisoire BTP, Retenue de Garantie (10%) & TVA/AIR',
        titleEn: 'BTP Progress Billing (BOQ), 10% Retention Guarantee & Tax Calculator',
        subFr: 'Calcul automatique : Travaux HT − Retenue de Garantie 10% + TVA 19,25% − Précompte AIR 2,2% = Net à Mandater',
        subEn: 'Auto-compute: Gross Works HT - 10% Retention + 19.25% VAT - 2.2% WHT = Net Payable Certificate',
        labelA: 'Montant Brut Travaux Réalisés HT (FCFA)', valA: 25000000,
        labelB: 'Taux Avancement Physique du Lot (%)', valB: 100,
        labelC: 'Retenue de Garantie Légale (%)', valC: 10,
        btnFr: 'Émettre le Certificat pour Paiement / Décompte BTP →', btnEn: 'Issue BTP Progress Payment Certificate →'
      },
      trade: {
        titleFr: 'Calculateur de Coût d’Approche Port de Douala (CAF + Douane CEMAC + GUCE)',
        titleEn: 'Port of Douala Landed Cost & CEMAC Customs Duty Calculator',
        subFr: 'Liquidation Sydonia/GUCE : Valeur CAF + Tarif Extérieur Commun (TEC 10%–30%) + TVA Import 19,25% + Acconage PAD',
        subEn: 'Customs liquidation: CIF Value + CEMAC Common Tariff (10%-30%) + 19.25% Import VAT + Port Handling',
        labelA: 'Valeur CAF / CIF Conteneur (FCFA)', valA: 15000000,
        labelB: 'Droit de Douane TEC CEMAC (%)', valB: 20,
        labelC: 'Frais PAD, GUCE & Acconage (FCFA)', valC: 850000,
        btnFr: 'Valider Liquidation Douane GUCE & Coût de Revient →', btnEn: 'Submit GUCE Customs & Landed Cost Dossier →'
      },
      finance: {
        titleFr: 'Simulateur d’Imputation SYSCOHADA Révisé, TVA (19,25%) & Précompte AIR (2,2%)',
        titleEn: 'SYSCOHADA Double-Entry Journal, 19.25% VAT & 2.2% AIR Tax Simulator',
        subFr: 'Équilibre Débit = Crédit obligatoire (Comptes Classes 1 à 8) · Calcul instantané TVA 443/445 et retenue AIR 447',
        subEn: 'Mandatory Debit = Credit validation (Classes 1-8) · Instant 19.25% VAT and 2.2% WHT calculation',
        labelA: 'Montant Hors Taxes de la Pièce (FCFA)', valA: 10000000,
        labelB: 'Taux TVA Cameroun (%)', valB: 19.25,
        labelC: 'Retenue à la Source AIR (%)', valC: 2.2,
        btnFr: 'Passer l’Écriture Comptable au Journal (account.move) →', btnEn: 'Post Balanced Journal Entry (account.move) →'
      },
      hr: {
        titleFr: 'Calculateur Officiel de Bulletin de Paie Cameroun (CNPS 4,2% · IRPP · CAC · CFC · RAV)',
        titleEn: 'Cameroon Statutory Payslip Calculator (CNPS 4.2% · IRPP · CAC · CFC · RAV)',
        subFr: 'Plafond légal CNPS PVID : 750 000 FCFA/mois (max 31 500 FCFA salarié) + Crédit Foncier 1% + RAV + Charges Patronales 11,2%',
        subEn: 'Statutory CNPS ceiling: 750,000 FCFA/mo (max 31,500 FCFA employee) + 1% Housing Fund + RAV + 11.2% Employer CNPS',
        labelA: 'Salaire Brut Mensuel Effectif (FCFA)', valA: 850000,
        labelB: 'Nombre de Salariés du Lot', valB: 10,
        labelC: 'Taux Cotisation Patronale CNPS (%)', valC: 11.2,
        btnFr: 'Générer le Lot de Bulletins de Paie & DIPE →', btnEn: 'Generate Statutory Payslip Batch & DIPE →'
      },
      holding: {
        titleFr: 'Simulateur Comité d’Investissement CAPEX : VAN (NPV), TRI (IRR) & Dividendes Groupe',
        titleEn: 'Board CAPEX Investment Committee: NPV, IRR & Consolidated Dividend Simulator',
        subFr: 'Évaluation financière des projets d’expansion des 9 filiales et élimination des flux intragroupe SYSCOHADA',
        subEn: 'Financial modeling for subsidiary expansion projects and intercompany elimination',
        labelA: 'Enveloppe CAPEX Sollicitée (FCFA)', valA: 120000000,
        labelB: 'Cash-Flow Annuel Prévisionnel (FCFA)', valB: 45000000,
        labelC: 'Quote-Part Détention Holding (%)', valC: 100,
        btnFr: 'Inscrire la Résolution à l’Ordre du Jour du Conseil →', btnEn: 'Submit CAPEX Resolution to Board Pipeline →'
      },
      digital: {
        titleFr: 'Scanner IA Copilot : Audit d’Anomalies Multi-Filiales & Conformité RBAC',
        titleEn: 'AI Copilot Scanner: Cross-Subsidiary Anomaly Audit & RBAC Compliance',
        subFr: 'Inspection heuristique en temps réel des 9 bases ERP (seuils COBAC, soldes ouverts, écarts de rendement)',
        subEn: 'Real-time heuristic scan across all 9 ERP databases (COBAC thresholds, open balances, yield variances)',
        labelA: 'Seuil d’Alerte Transactionnelle (FCFA)', valA: 5000000,
        labelB: 'Filiales Scannées Simultanément', valB: 9,
        labelC: 'Score de Confiance IA Minimum (%)', valC: 95,
        btnFr: 'Générer Rapport d’Audit IA & Créer Ticket Sécurité →', btnEn: 'Run AI Anomaly Scan & Log Security Ticket →'
      }
    }[p.id];

    if (!simMeta) return '';

    return panel(
      tr(simMeta.titleFr, simMeta.titleEn),
      tr(simMeta.subFr, simMeta.subEn),
      `<form data-form="div-simulator" class="stack">
        <div class="form-grid sim-grid-3">
          <div class="form-field">
            <label>${esc(simMeta.labelA)}</label>
            <input type="number" name="simA" value="${simMeta.valA}" step="any" required />
          </div>
          <div class="form-field">
            <label>${esc(simMeta.labelB)}</label>
            <input type="number" name="simB" value="${simMeta.valB}" step="any" required />
          </div>
          <div class="form-field">
            <label>${esc(simMeta.labelC)}</label>
            <input type="number" name="simC" value="${simMeta.valC}" step="any" required />
          </div>
        </div>
        <div class="form-field">
          <label>${tr('Entité / Client / Référence du Lot','Target Counterparty / Batch Reference')}</label>
          <input type="text" name="simClient" value="Simulation Métier — ${esc(tr(p.nameFr, p.nameEn))}" required />
        </div>
        <div class="form-actions" style="margin-top:4px;justify-content:space-between;align-items:center">
          <span class="hint">${tr('Le calcul crée automatiquement un dossier chiffré avec pièce justificative PDF dans le Flowchart.','Calculation automatically creates a priced dossier with an official printable PDF in the Flowchart.')}</span>
          <button type="submit" class="btn btn-primary">${icon('check')}${esc(tr(simMeta.btnFr, simMeta.btnEn))}</button>
        </div>
      </form>`
    );
  }

  function renderServices() {
    const p = currentProduct();
    const items = p.catalog.length ? p.catalog : db.services;
    return `
      <div class="overview-intro" style="margin-bottom:20px">
        <div>
          <div class="overline">CATALOGUE OPÉRATIONNEL & SIMULATEUR MÉTIER — ${esc(p.repo.toUpperCase())}</div>
          <h2>${esc(tr(p.nameFr, p.nameEn))}</h2>
          <p>${tr('Barème officiel, moteur de calcul réglementaire et opérations de guichet pour cette filiale.','Official tariff schedule, statutory calculation engine and counter operations for this division.')}</p>
        </div>
      </div>
      ${p.id !== 'property' ? `<div style="margin-bottom:20px">${renderDivisionSimulator(p)}</div>` : ''}
      <div class="service-grid">
        ${items.map(s => `
          <article class="service-card">
            <div>
              <span class="service-cat">${esc(s.cat)}</span>
              <h3 class="service-title">${esc(lang === 'fr' ? s.nameFr : s.nameEn)}</h3>
              <p class="service-price mono">${money(s.price)}</p>
            </div>
            <div>
              ${p.id === 'property' ? `<button type="button" class="btn btn-outline btn-small" style="width:100%" data-action="quick-post-service" data-srv-id="${esc(s.id)}">${icon('plus')}${tr('Imputer sur Folio','Post to Folio')}</button>` : `<button type="button" class="btn btn-primary btn-small" style="width:100%" data-action="switch-role-step" data-role="service" data-item-id="${esc(s.id)}">${icon('plus')}${tr('Saisir au Guichet (Étape 1)','Open in Step 1 Counter')}</button>`}
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderCalendar() {
    const [y, m] = monthCursor.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const offset = (first.getUTCDay() + 6) % 7;
    const weekday = lang === 'fr' ? ['LUN','MAR','MER','JEU','VEN','SAM','DIM'] : ['MON','TUE','WED','THU','FRI','SAT','SUN'];
    const p = currentProduct();
    const cells = Array.from({length: Math.ceil((last + offset) / 7) * 7}, (_, i) => {
      const d = i - offset + 1;
      if (d < 1 || d > last) return '<div class="cal-day muted" aria-hidden="true"></div>';
      const iso = `${monthCursor}-${String(d).padStart(2,'0')}`;
      const items = p.id === 'property'
        ? db.bookings.filter(b => b.status !== 'cancelled' && b.arrival <= iso && b.departure > iso).map(b => ({ label: `${b.roomId} · ${guestFor(b.guestId).name}`, active: b.status === 'checked-in' }))
        : (db.divisionRecords[p.id] || []).filter((_, idx) => ((d + idx) % 6 === 0)).map(r => ({ label: `${r.id} · ${r.client}`, active: r.step >= 2 }));
      return `<button class="cal-day ${iso === todayISO() ? 'today' : ''}" data-cal-date="${iso}">
        <span class="cal-num">${d}</span>
        <div class="cal-chips">
          ${items.slice(0, 2).map(it => `<span class="cal-chip ${it.active?'hotel':''}">${esc(it.label)}</span>`).join('')}
          ${items.length > 2 ? `<span class="cal-chip more">+${items.length-2}</span>` : ''}
        </div>
      </button>`;
    }).join('');
    const monthTitle = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { year:'numeric', month:'long', timeZone:'UTC' }).format(first);
    return `
      <section class="panel calendar-panel">
        <div class="calendar-top">
          <div><h2 class="calendar-month">${esc(monthTitle)}</h2><p class="panel-sub">${esc(tr(p.nameFr, p.nameEn))} — ${tr('Planning opérationnel & jalons','Operational schedule & milestones')}</p></div>
          <div class="toolbar-group">
            ${btn('month-prev', icon('chevronLeft'), 'outline btn-small')}
            ${btn('month-today', tr("Aujourd'hui",'Today'), 'outline btn-small')}
            ${btn('month-next', icon('chevronRight'), 'outline btn-small')}
          </div>
        </div>
        <div class="calendar-grid">${weekday.map(w => `<span class="cal-dow">${w}</span>`).join('')}${cells}</div>
      </section>
    `;
  }

  function renderGuests() {
    const p = currentProduct();
    if (p.id !== 'property') {
      const list = db.divisionRecords[p.id] || [];
      return `
        <div class="toolbar">
          <p class="hint">${list.length} ${tr('contreparties, fournisseurs, chantiers ou salariés actifs dans cette filiale','active counterparties, suppliers, sites or staff in this division')}</p>
          <label class="search-field">${icon('search')}<input data-filter id="searchInput" value="${esc(filter)}" placeholder="${tr('Rechercher un tiers, matricule, entité...','Search counterparty, ID, entity...')}"/></label>
        </div>
        <div class="guest-grid">
          ${list.filter(r => `${r.client} ${r.id} ${r.category} ${r.operator}`.toLowerCase().includes(filter.toLowerCase())).map(r => `
            <article class="guest-card">
              <div class="inline-flex" style="justify-content:space-between;width:100%">
                <div class="guest-avatar">${esc(r.client.split(/\s+/).slice(0,2).map(s=>s[0]||'B').join('').toUpperCase())}</div>
                <span class="pill active">${esc(r.category)}</span>
              </div>
              <h3>${esc(r.client)}</h3>
              <p>${esc(tr(r.itemFr, r.itemEn))}</p>
              <div class="quiet-box" style="margin:8px 0;padding:8px 10px;font-size:10px">${tr('Responsable :','Handler:')} <b>${esc(r.operator)}</b> · ${esc(r.paymentMethod)}</div>
              <div class="guest-meta" style="margin-bottom:8px"><span>Volume : <b class="mono">${money(r.amount)}</b></span><span class="mono">Étape ${r.step}/4</span></div>
              <div style="border-top:1px solid #eef2f1;padding-top:8px;display:flex;justify-content:flex-end">
                ${btn('print-div-record', `🖨 ${tr('Pièce PDF','PDF Slip')}`, 'outline btn-small', `data-id="${esc(r.id)}"`)}
              </div>
            </article>
          `).join('')}
        </div>
      `;
    }

    const matched = db.guests.filter(g => `${g.name} ${g.email} ${g.phone} ${g.notes}`.toLowerCase().includes(filter.toLowerCase()));
    return `
      <div class="toolbar">
        <p class="hint">${db.guests.length} ${tr('clients & partenaires enregistrés dans le CRM','clients & partners registered in CRM')}</p>
        <label class="search-field">${icon('search')}<input data-filter id="searchInput" value="${esc(filter)}" placeholder="${tr('Rechercher un client, téléphone...','Search client, phone...')}"/></label>
      </div>
      <div class="guest-grid">
        ${matched.map(g => {
          const guestBookings = db.bookings.filter(b => b.guestId === g.id && b.status !== 'cancelled');
          return `
            <article class="guest-card">
              <div class="inline-flex" style="justify-content:space-between;width:100%">
                <div class="guest-avatar">${esc(g.name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase())}</div>
                ${g.vip ? `<span class="pill active">VIP · CORPORATE</span>` : ''}
              </div>
              <h3>${esc(g.name)}</h3>
              <p>${esc(g.phone)} · ${esc(g.email || '—')}</p>
              ${g.notes ? `<div class="quiet-box" style="margin:8px 0;padding:8px 10px;font-size:10px">${esc(g.notes)}</div>` : ''}
              <div class="guest-meta"><span>${tr('Dossiers : ','Records: ')}<b>${guestBookings.length}</b></span><span class="mono">${esc(g.id)}</span></div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderHousekeeping() {
    const p = currentProduct();
    if (p.id !== 'property') {
      const prevRole = role;
      role = 'housekeeping';
      const html = renderDivisionRoleTerminal(p);
      role = prevRole;
      return html;
    }

    const pendingTasks = db.tasks.filter(t => t.status === 'pending');
    const dirtyRooms = db.rooms.filter(r => r.status === 'dirty' || r.status === 'cleaning');
    const inspectedRooms = db.rooms.filter(r => r.status === 'inspected');
    return `
      <div class="stats-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        ${stat(tr('Chambres à nettoyer','Dirty / In Progress'), String(dirtyRooms.length), tr('Nécessite intervention gouvernante','Awaiting cleaning team'), 'sparkles')}
        ${stat(tr('Prêtes & Inspectées','Inspected & Ready'), String(inspectedRooms.length), tr('Validées pour check-in VIP','Validated for incoming guests'), 'check')}
        ${stat(tr('Ordres de ménage ouverts','Pending Tasks'), String(pendingTasks.length), tr('Feuille de service active','Active service task list'), 'book')}
      </div>
      ${panel(tr('Feuille de Service de la Gouvernante','Housekeeping Task & Room Turnover Board'), tr('Workflow Odoo : Sale → Nettoyage → Inspectée → Prête','Odoo workflow: Dirty → Cleaning → Inspected → Ready'), `
        <div class="task-list">
          ${db.tasks.map(t => `
            <div class="task-card">
              <div class="task-info">
                <strong>${tr('Chambre','Room')} ${esc(t.roomId)} · ${esc(t.label)}</strong>
                <p>${esc(t.id)} · ${t.priority==='high'?`<span class="maint-badge maint-urgent">${tr('Haute priorité','High priority')}</span>`:`<span class="maint-badge maint-normal">${tr('Normale','Normal')}</span>`}</p>
              </div>
              <div class="toolbar-group">
                ${statusChip(t.status)}
                ${t.status === 'pending' && can('task') ? btn('task-complete', `${icon('check')}${tr('Terminer & Inspecter','Inspect & Complete')}`, 'primary btn-small', `data-id="${esc(t.id)}"`) : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `)}
    `;
  }

  function renderMaintenance() {
    const p = currentProduct();
    if (p.id !== 'property') {
      const units = DIV_UNITS_SEED[p.id] || DIV_UNITS_SEED.holding;
      const list = db.divisionRecords[p.id] || [];
      return `
        <div class="stats-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          ${stat(tr('Unités & Équipements Suivis','Monitored Units & Assets'), String(units.length), esc(p.odooModel), 'wrench')}
          ${stat(tr('Contrôles Techniques Actifs','Active Technical Checks'), String(list.filter(r => r.step < 4).length), tr('En cours dans le Flowchart','In progress in Flowchart'), 'shield')}
          ${stat(tr('Conformité & Certificats','Certified & Compliant'), String(list.filter(r => r.step === 4).length), tr('Validés sans réserve','Cleared with zero defects'), 'check')}
        </div>
        ${panel(tr('Registre Technique, GMAO & Conformité Opérationnelle','Technical Asset Maintenance & Compliance Log'), `${esc(tr(p.nameFr, p.nameEn))} · ${esc(p.repo)}`, `
          <div class="task-list">
            ${units.map((u, idx) => `
              <div class="task-card">
                <div class="task-info">
                  <div class="inline-flex" style="gap:8px">
                    <strong class="mono">${esc(u.id)}</strong>
                    <span class="maint-badge ${idx === 0 ? 'maint-urgent' : 'maint-normal'}">${idx === 0 ? 'PRIORITÉ HAUTE' : 'INSPECTION OK'}</span>
                    <strong>${esc(u.type)}</strong>
                  </div>
                  <p style="margin:5px 0">${esc(u.zone)} — ${esc(u.specs.join(' · '))}</p>
                  <small class="soft">Capacité / Valorisation : ${money(u.rate)} · Modèle : ${esc(p.odooModel)}</small>
                </div>
                <div class="toolbar-group">
                  ${statusChip(u.status)}
                  ${btn('switch-role-step', `${icon('wrench')}${tr('Traiter (Étape 2)','Process (Step 2)')}`, 'outline btn-small', 'data-role="housekeeping"')}
                </div>
              </div>
            `).join('')}
          </div>
        `)}
      `;
    }

    const openTickets = db.maintenance.filter(m => m.stage !== 'resolved');
    return `
      <div class="stats-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        ${stat(tr('Pannes en cours','Active Tickets'), String(openTickets.length), tr('Affecte le parc','Affects inventory'), 'wrench')}
        ${stat(tr('Unités bloquées','Blocked Units'), String(db.rooms.filter(r=>r.status==='maintenance').length), tr('Statut hors service Odoo','Out of order state'), 'shield')}
        ${stat(tr('Incidents résolus','Resolved'), String(db.maintenance.filter(m=>m.stage==='resolved').length), tr('Historique de maintenance','Maintenance logbook'), 'check')}
      </div>
      ${panel(tr('Ordres de Travail & Maintenance','Maintenance Orders & Repair Pipeline'), tr('Suivi technique terrain','Technical field resolution'), `
        <div class="task-list">
          ${db.maintenance.map(m => `
            <div class="task-card">
              <div class="task-info">
                <div class="inline-flex" style="gap:8px">
                  <strong class="mono">${esc(m.id)}</strong>
                  <span class="maint-badge ${m.priority==='urgent'?'maint-urgent':m.priority==='normal'?'maint-normal':'maint-low'}">${esc(m.priority.toUpperCase())}</span>
                  <strong>Unité ${esc(m.roomId)}</strong>
                </div>
                <p style="margin:5px 0">${esc(m.desc)}</p>
                <small class="soft">${tr('Signalé par','Reported by')}: ${esc(m.reportedBy)} · ${esc(m.date)}</small>
              </div>
              <div class="toolbar-group">
                ${statusChip(m.stage)}
                ${can('maintenance') && m.stage !== 'resolved' ? btn('resolve-maintenance', `${icon('check')}${tr('Marquer résolu','Mark Resolved')}`, 'primary btn-small', `data-id="${esc(m.id)}"`) : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `)}
    `;
  }

  function renderOperations() {
    const p = currentProduct();
    if (p.id !== 'property') {
      const units = DIV_UNITS_SEED[p.id] || DIV_UNITS_SEED.holding;
      return `
        <div class="operations-grid">
          ${units.map(u => `
            <article class="ops-card">
              <div class="ops-icon">${icon('bolt', 23)}</div>
              <h3>${esc(u.id)} · ${esc(u.type)}</h3>
              <p>${esc(u.zone)} — ${esc(u.specs.join(' · '))}</p>
              <div class="ops-footer">
                ${statusChip(u.status === 'available' || u.status === 'inspected' ? 'healthy' : 'watch')}
                ${btn('div-unit-toggle', u.status === 'available' || u.status === 'inspected' ? tr('En service','Active') : tr('En maintenance','Standby'), 'outline btn-small', `data-id="${esc(u.id)}"`)}
              </div>
            </article>
          `).join('')}
        </div>
      `;
    }

    return `
      <div class="operations-grid">
        ${db.systems.map(s => `
          <article class="ops-card">
            <div class="ops-icon">${icon(s.icon, 23)}</div>
            <h3>${esc(lang === 'fr' ? s.labelFr : s.labelEn)}</h3>
            <p>${esc(lang === 'fr' ? s.detailFr : s.detailEn)}</p>
            <div class="ops-footer">
              ${statusChip(s.status)}
              ${can('ops') ? btn('ops-toggle', s.status==='healthy'?tr('Signaler incident','Report issue'):tr('Marquer opérationnel','Mark healthy'), 'outline btn-small', `data-id="${esc(s.id)}"`) : ''}
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderAudit() {
    const p = currentProduct();
    if (p.id !== 'property') {
      const list = db.divisionRecords[p.id] || [];
      const counts = stepCountsFor(p.id);
      const totalVol = list.reduce((a, r) => a + r.amount, 0);
      return `
        <div class="audit-box">
          <h3>${esc(tr(p.flow[2].titleFr, p.flow[2].titleEn))} — ${esc(tr(p.nameFr, p.nameEn))}</h3>
          <p>${esc(tr(p.flow[2].descFr, p.flow[2].descEn))} (${esc(p.odooModel)})</p>
          <div class="audit-kpis">
            <div class="audit-kpi"><span>Dossiers Étape 3 (Audit)</span><strong>${counts[3]}</strong></div>
            <div class="audit-kpi"><span>Certifiés Étape 4 (Boss)</span><strong>${counts[4]}</strong></div>
            <div class="audit-kpi"><span>Volume Sous Contrôle</span><strong>${money(totalVol)}</strong></div>
            <div class="audit-kpi"><span>TVA / Droits (19,25%)</span><strong>${money(Math.round(totalVol * 0.1925))}</strong></div>
          </div>
          <div style="margin-top:22px">
            ${btn('div-audit-certify-all', `${icon('check')}${tr('Certifier tous les dossiers Étape 3 → Envoyer au Boss (Étape 4)','Certify All Step 3 Dossiers → Push to Boss (Step 4)')}`, 'primary')}
          </div>
        </div>
        ${panel(tr('Registre de Contrôle Réglementaire & Pièces Officielles','Statutory Audit Register & Official Certificates'), tr('Cliquez sur PDF pour éditer le certificat officiel (COBAC, ICUMSA 45, GUCE, SYSCOHADA, CNPS)','Click PDF to print the official statutory certificate for any record'), `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Réf</th><th>Tiers / Lot</th><th>Opération</th><th>Montant</th><th>Statut Flowchart</th><th>Certification & PDF</th></tr></thead>
              <tbody>
                ${list.map(rec => `
                  <tr>
                    <td><strong class="mono">${esc(rec.id)}</strong></td>
                    <td><strong>${esc(rec.client)}</strong></td>
                    <td>${esc(tr(rec.itemFr, rec.itemEn))}</td>
                    <td class="mono"><strong>${money(rec.amount)}</strong></td>
                    <td><span class="status ${rec.step>=3?'confirmed':'occupied'}">Étape ${rec.step}/4</span></td>
                    <td>
                      <div class="toolbar-group">
                        ${rec.step < 4 ? btn('div-advance-step', `Certifier → Étape ${rec.step+1}`, 'primary btn-small', `data-id="${esc(rec.id)}"`) : `<span class="status confirmed">✓ Certifié</span>`}
                        ${btn('print-div-record', `🖨 Certificat PDF`, 'outline btn-small', `data-id="${esc(rec.id)}"`)}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `)}
      `;
    }

    const m = hospitalityMetrics();
    return `
      <div class="audit-box">
        <h3>${tr('Poste de Clôture & Audit Réglementaire (SYSCOHADA / COBAC / Night Audit)','Night Audit & Statutory Compliance Station')}</h3>
        <p>${tr('Valide les opérations journalières de l’Étape 3, calcule les ratios de rendement, impute la TVA 19,25% et génère le certificat de clôture pour la Direction Générale (Étape 4).','Validates Step 3 daily operations, computes yield ratios, posts 19.25% VAT and generates the closure certificate for the Boss (Step 4).')}</p>
        <div class="audit-kpis">
          <div class="audit-kpi"><span>Taux d'occupation</span><strong>${m.occupancyRate}%</strong></div>
          <div class="audit-kpi"><span>ADR (Tarif Moyen)</span><strong>${money(m.adr)}</strong></div>
          <div class="audit-kpi"><span>RevPAR</span><strong>${money(m.revPar)}</strong></div>
          <div class="audit-kpi"><span>Revenu Consolidé</span><strong>${money(m.totalGross)}</strong></div>
        </div>
        <div style="margin-top:22px">
          ${can('audit_run') ? btn('run-night-audit-btn', `${icon('moon')}${tr('Lancer la Clôture & Certifier pour le Boss','Execute Audit Closure Run')}`, 'primary') : `<span class="hint">${tr('Réservé à la Direction et à l’Auditeur.','Restricted to Manager and Auditor.')}</span>`}
        </div>
      </div>
      ${panel(tr('Historique des Certificats de Clôture','Recent Audit Closure Certificates'), tr('Archives immuables du journal système','Audited records stored in system journal'), `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Date</th><th>Occupation</th><th>ADR</th><th>RevPAR</th><th>Hébergement</th><th>Prestations</th><th>Total Journée</th><th>Auditeur</th></tr></thead>
            <tbody>
              ${db.auditHistory.map(a => `<tr><td><strong class="mono">${esc(a.date)}</strong></td><td>${a.occupancyRate}%</td><td class="mono">${money(a.adr)}</td><td class="mono">${money(a.revPar)}</td><td class="mono">${money(a.roomRevenue)}</td><td class="mono">${money(a.serviceRevenue)}</td><td class="mono"><strong>${money(a.totalDayRevenue)}</strong></td><td><span class="pill">${esc(a.auditor)}</span></td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      `)}
    `;
  }

  function renderReports() {
    const p = currentProduct();
    if (p.id !== 'property') {
      const list = db.divisionRecords[p.id] || [];
      const sumHT = list.reduce((a, r) => a + r.amount, 0);
      const sumSigned = list.filter(r => r.step === 4).reduce((a, r) => a + r.amount, 0);
      const sumPending = sumHT - sumSigned;
      return `
        <div class="stats-grid">
          ${stat(tr('Volume Brut Consolidé','Gross Division Volume'), money(sumHT), `${list.length} dossiers (${esc(p.odooModel)})`, 'wallet')}
          ${stat(tr('Volume Certifié & Clôturé','Certified & Closed Volume'), money(sumSigned), tr('Validé Étape 4','Validated Step 4'), 'check')}
          ${stat(tr('En Cours de Traitement','In-Flight Pipeline'), money(sumPending), tr('Étapes 1 à 3','Steps 1 to 3'), 'receipt')}
          ${stat(tr('Architecture GitHub','GitHub Reference'), esc(p.repo), esc(p.num), 'dashboard')}
        </div>
        ${renderProductGitHubTables(p)}
        ${panel(tr('Journal des Événements & Audit Trail (SysLog Multi-Postes)','Multi-Terminal System Action & Audit Log'), tr('Traçabilité complète des transitions du Flowchart entre les postes','Complete traceability of Flowchart handoffs across roles'), `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Date / Heure</th><th>Produit : Poste</th><th>Action ERP</th><th>Détail / Référence</th></tr></thead>
              <tbody>
                ${db.history.slice(0, 18).map(h => `
                  <tr>
                    <td><span class="mono">${esc(new Date(h.when).toLocaleString(lang==='fr'?'fr-FR':'en-GB'))}</span></td>
                    <td><span class="pill">${esc(h.role)}</span></td>
                    <td><strong>${esc(h.action)}</strong></td>
                    <td class="mono soft">${esc(h.meta)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${db.history.length === 0 ? empty(tr('Aucun journal pour l’instant.','No audit logs yet.')) : ''}
        `)}
      `;
    }

    const m = hospitalityMetrics();
    return `
      <div class="stats-grid">
        ${stat(tr('Chiffre d’Affaires Total','Gross Billed Total'), money(m.totalGross), tr('Opérations facturées','Billed operations'), 'wallet')}
        ${stat(tr('Encaissements Enregistrés','Total Collections'), money(m.totalPaid), tr('Règlements reçus','Payments received'), 'check')}
        ${stat(tr('Créances Clients (Soldes)','Accounts Receivable'), money(m.balanceDue), tr('En cours de recouvrement','Pending balances'), 'receipt')}
        ${stat(tr('Produits du Groupe Actifs','Active Group Products'), '9 / 9', tr('Suite Blue Line Capital complète','Full Blue Line Capital Suite'), 'dashboard')}
      </div>
      ${panel(tr('Journal des Événements & Audit Trail (SysLog Multi-Postes)','Multi-Terminal System Action & Audit Log'), tr('Traçabilité complète des transitions du Flowchart entre les postes','Complete traceability of Flowchart handoffs across roles'), `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Date / Heure</th><th>Produit : Poste</th><th>Action ERP</th><th>Détail / Référence</th></tr></thead>
            <tbody>
              ${db.history.slice(0, 18).map(h => `
                <tr>
                  <td><span class="mono">${esc(new Date(h.when).toLocaleString(lang==='fr'?'fr-FR':'en-GB'))}</span></td>
                  <td><span class="pill">${esc(h.role)}</span></td>
                  <td><strong>${esc(h.action)}</strong></td>
                  <td class="mono soft">${esc(h.meta)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${db.history.length === 0 ? empty(tr('Aucun journal pour l’instant.','No audit logs yet.')) : ''}
      `)}
    `;
  }

  function renderSettings() {
    return `
      <div class="cols-2 cols-even">
        ${panel(tr('Matrice des Droits Multi-Postes (ir.model.access.csv)','Multi-Terminal RBAC Matrix (ir.model.access.csv)'), tr('Séparation stricte entre Guichet/Caisse (Étape 1), Terrain (Étape 2), Audit (Étape 3) et Boss (Étape 4)','Strict separation between Step 1 Cashier, Step 2 Field, Step 3 Audit and Step 4 Boss'), `
          <div class="table-wrap">
            <table class="odoo-matrix">
              <thead><tr><th>Module / Modèle ERP</th><th>Étape 1 (Guichet/POS)</th><th>Étape 2 (Terrain/Usine)</th><th>Étape 3 (Audit/Compta)</th><th>Étape 4 (Boss/DG)</th></tr></thead>
              <tbody>
                <tr><td><strong>1. Saisie Guichet / Caisse POS</strong></td><td>CRUD</td><td>R---</td><td>R---</td><td>CRUD</td></tr>
                <tr><td><strong>2. Kanban Terrain / Ménage / MRP</strong></td><td>R---</td><td>CRUD</td><td>R---</td><td>CRUD</td></tr>
                <tr><td><strong>3. Contrôle / Folios / SYSCOHADA</strong></td><td>CR--</td><td>----</td><td>CRUD</td><td>CRUD</td></tr>
                <tr><td><strong>4. Clôture Finale & Signature Board</strong></td><td>----</td><td>----</td><td>CR--</td><td>CRUD</td></tr>
              </tbody>
            </table>
          </div>
        `)}
        ${panel(tr('Gestion de la Base Multi-Filiales (9 Produits)','9-Product Demo Database Management'), tr('Sauvegarde JSON et réinitialisation d’usine','JSON backup and factory reset'), `
          <div class="stack">
            <div class="task-card">
              <div class="task-info"><strong>${tr('Exporter les 9 Produits ERP (JSON)','Export 9-Product ERP Dataset (JSON)')}</strong><p>${tr('Télécharger l’intégralité des flux des 9 filiales','Download full snapshot of all 9 divisions')}</p></div>
              ${btn('export-json', `${icon('download')} JSON`, 'outline btn-small')}
            </div>
            <div class="task-card">
              <div class="task-info"><strong>${tr('Réinitialisation Usine des 9 Produits','Factory Reset All 9 Products')}</strong><p>${tr('Restaurer le jeu d’essai initial pour les 9 filiales','Re-seed initial dataset across all 9 divisions')}</p></div>
              ${btn('reset-data', tr('Réinitialiser','Reset Database'), 'danger btn-small')}
            </div>
          </div>
        `)}
      </div>
    `;
  }

  // Modals
  let modalPreviousFocus = null;
  function modal(title, body) {
    if ($('#modalRoot').hidden) modalPreviousFocus = document.activeElement;
    const root = $('#modalRoot');
    root.hidden = false;
    root.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-header"><h2 id="modalTitle">${title}</h2><button class="modal-close" type="button" data-action="close-modal" aria-label="Close">×</button></div>${body}</div>`;
    root.querySelector('.modal-close')?.focus();
  }
  function closeModal() { const root = $('#modalRoot'); if (root.hidden) return; root.hidden = true; root.innerHTML = ''; if (modalPreviousFocus?.isConnected) modalPreviousFocus.focus({preventScroll:true}); modalPreviousFocus = null; }
  function field(name, label, type='text', value='', extra='') {
    return `<div class="form-field"><label for="field-${esc(name)}">${label}</label><input id="field-${esc(name)}" name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${extra}/></div>`;
  }
  function formActions(label) {
    return `<div class="form-actions"><button class="btn btn-outline" data-action="close-modal" type="button">${tr('Annuler','Cancel')}</button><button class="btn btn-primary" type="submit">${label}</button></div>`;
  }

  function newBookingModal() {
    const a = addDays(todayISO(), 1), b = addDays(todayISO(), 3);
    modal(tr('Créer une Réservation & Folio Odoo (Étape 1)','New Odoo Reservation & Folio (Step 1)'), `
      <form data-form="booking">
        <div class="form-grid">
          ${field('guest', tr('Nom du client / Locataire','Guest / Tenant Name'), 'text', '', 'required minlength="2" maxlength="80" placeholder="Ex: Jean Dupont"')}
          ${field('phone', tr('Téléphone / WhatsApp','Phone / WhatsApp'), 'text', '+237 ', 'required')}
          <div class="form-field">
            <label for="booking-room">${tr('Unité / Chambre disponible','Select Available Unit / Room')}</label>
            <select id="booking-room" name="roomId" required>
              ${db.rooms.filter(r => r.status !== 'maintenance').map(r => `<option value="${esc(r.id)}">${esc(r.id)} — ${esc(r.type)} (${esc(r.floor)}) · ${money(r.rate)}</option>`).join('')}
            </select>
            <p class="form-note">${tr('Le système vérifiera les conflits de dates lors de l’enregistrement.','Date conflicts are checked before saving the reservation.')}</p>
          </div>
          <div class="form-field">
            <label for="booking-channel">${tr('Canal de provenance','Source Channel')}</label>
            <select id="booking-channel" name="channel">
              <option>Direct Guichet Réception</option>
              <option>WhatsApp AI Concierge</option>
              <option>Corporate Blue Line Capital</option>
              <option>Booking.com</option>
            </select>
          </div>
          ${field('arrival', tr('Date d’arrivée','Arrival Date'), 'date', a, 'required')}
          ${field('departure', tr('Date de départ','Departure Date'), 'date', b, 'required')}
          ${field('paid', tr('Acompte initial (FCFA)','Initial Deposit (FCFA)'), 'number', '0', 'min="0" step="1000"')}
          <div class="form-field">
            <label>${tr('Mode d’encaissement acompte','Deposit Payment Method')}</label>
            <select name="payMethod"><option>Espèces (Cash)</option><option>Carte Bancaire</option><option>Orange Money</option><option>MTN MoMo</option></select>
          </div>
        </div>
        ${formActions(tr('Enregistrer et ouvrir le Folio','Save & Open Folio'))}
      </form>
    `);
  }

  function openFolioModal(id) {
    const f = folioFor(id);
    if (!f) return notify(tr('Folio introuvable','Folio not found'), true);
    activeFolioId = f.id;
    const b = bookingFor(f.bookingId), g = guestFor(f.guestId), fm = folioMetrics(f);
    modal(`${tr('Folio Client','Guest Folio')} ${esc(f.id)}`, `
      <div class="stack">
        <div class="statusbar">
          <div class="statusbar-step done">${tr('1. Ouverture Réception','1. Front Desk Open')}</div>
          <div class="statusbar-step ${f.status==='open'?'active':'done'}">${tr('2. Imputations POS & Séjour','2. POS & Active Stay')}</div>
          <div class="statusbar-step ${f.status==='closed'?'active':''}">${tr('3. Clôturé & Audité','3. Closed & Audited')}</div>
        </div>
        <div class="task-card">
          <div class="task-info"><strong>${esc(g.name)}</strong><p>Chambre ${esc(f.roomId)} · ${b ? `${dateLabel(b.arrival,lang)} → ${dateLabel(b.departure,lang)}` : '—'}</p></div>
          ${statusChip(f.status)}
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Date</th><th>Prestation / Article</th><th>Qté</th><th>Prix Unit.</th><th>Total</th></tr></thead>
            <tbody>${f.lines.map(l => `<tr><td><span class="mono">${esc(l.date)}</span></td><td><span class="folio-line-cat ${esc(l.category)}">${esc(l.category)}</span> <strong>${esc(l.desc)}</strong></td><td>${l.qty}</td><td class="mono">${money(l.unitPrice)}</td><td class="mono"><strong>${money(l.total)}</strong></td></tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="bill-summary" style="margin:12px 0">
          <div><span>Sous-total</span><strong class="mono">${money(fm.subtotal)}</strong></div>
          <div><span>Total Encaissé</span><strong class="mono positive">${money(fm.totalPaid)}</strong></div>
          <div><span>Solde Dû</span><strong class="mono ${fm.balance>0?'negative':'positive'}">${money(fm.balance)}</strong></div>
        </div>
        <div class="form-actions">
          ${can('folio_charge') && f.status === 'open' ? btn('add-charge-to-folio', `${icon('plus')}${tr('Ajouter Prestation','Add Charge')}`, 'outline', `data-folio="${esc(f.id)}"`) : ''}
          ${can('payment') && fm.balance > 0 ? btn('folio-payment-quick', `${icon('wallet')}${tr('Encaisser Règlement','Record Payment')}`, 'primary', `data-id="${esc(f.id)}"`) : ''}
          ${can('folio_close') && f.status === 'open' && fm.balance === 0 ? btn('close-folio-btn', `${icon('check')}${tr('Clôturer le Folio','Close Folio')}`, 'primary', `data-folio="${esc(f.id)}"`) : ''}
          ${btn('print-folio-invoice', `${icon('receipt')}${tr('Facture PDF','Invoice PDF')}`, 'outline', `data-id="${esc(f.id)}"`)}
        </div>
      </div>
    `);
  }

  function addChargeModal(folioId) {
    const f = folioFor(folioId) || db.folios.find(x => x.status === 'open');
    if (!f) return notify(tr('Aucun folio actif disponible','No open folio available'), true);
    modal(tr('Imputer une Prestation au Folio','Post Service Charge to Folio'), `
      <form data-form="folio-charge">
        <input type="hidden" name="folioId" value="${esc(f.id)}"/>
        <div class="form-grid">
          <div class="form-field wide">
            <label>${tr('Folio client cible','Target Guest Folio')}</label>
            <select name="selectedFolioId">
              ${db.folios.filter(x => x.status === 'open').map(x => `<option value="${esc(x.id)}" ${x.id===f.id?'selected':''}>${esc(x.id)} — Ch. ${esc(x.roomId)} (${esc(guestFor(x.guestId).name)})</option>`).join('')}
            </select>
          </div>
          <div class="form-field wide">
            <label>${tr('Article / Prestation','Service Catalog Item')}</label>
            <select id="charge-service-select" name="serviceId">
              ${db.services.map(s => `<option value="${esc(s.id)}" data-price="${s.price}" data-cat="${s.cat}">${esc(lang==='fr'?s.nameFr:s.nameEn)} — ${money(s.price)}</option>`).join('')}
            </select>
          </div>
          ${field('qty', tr('Quantité','Quantity'), 'number', '1', 'min="1" required')}
          ${field('price', tr('Prix unitaire (FCFA)','Unit price (FCFA)'), 'number', String(db.services[0].price), 'min="0" required')}
        </div>
        ${formActions(tr('Imputer au Folio','Post Charge'))}
      </form>
    `);
  }

  function paymentModal(folioId) {
    const f = folioFor(folioId);
    if (!f) return notify(tr('Folio introuvable','Folio not found'), true);
    const fm = folioMetrics(f);
    if (fm.balance <= 0) return notify(tr('Ce folio est déjà intégralement soldé.','This folio is already fully paid.'), true);
    modal(tr('Enregistrer un Règlement Client','Record Folio Payment'), `
      <form data-form="folio-payment" data-folio="${esc(f.id)}">
        <div class="quiet-box"><strong>${esc(f.id)}</strong> · ${esc(guestFor(f.guestId).name)} (Ch. ${esc(f.roomId)}) — Solde : <strong class="negative">${money(fm.balance)}</strong></div>
        <div style="height:14px"></div>
        <div class="form-grid">
          ${field('amount', tr('Montant encaissé (FCFA)','Payment amount (FCFA)'), 'number', String(fm.balance), `required min="1" max="${fm.balance}"`)}
          <div class="form-field"><label>${tr('Méthode de paiement','Payment Method')}</label><select name="method"><option>Carte Bancaire</option><option>Espèces (Caisse)</option><option>Orange Money</option><option>MTN MoMo</option><option>Virement CEMAC</option></select></div>
        </div>
        ${formActions(tr('Valider l’encaissement','Confirm Payment'))}
      </form>
    `);
  }

  function newMaintenanceModal() {
    modal(tr('Créer un Ordre de Maintenance Technique','New Maintenance Ticket'), `
      <form data-form="maintenance">
        <div class="form-grid">
          <div class="form-field"><label>${tr('Unité / Chambre','Target Unit / Room')}</label><select name="roomId" required>${db.rooms.map(r => `<option value="${esc(r.id)}">${esc(r.id)} — ${esc(r.type)}</option>`).join('')}</select></div>
          <div class="form-field"><label>${tr('Niveau d’urgence','Priority Level')}</label><select name="priority"><option value="normal">Normale</option><option value="urgent">Urgente (Bloquer Unité)</option><option value="low">Faible</option></select></div>
          <div class="form-field wide"><label>${tr('Description technique','Defect Description')}</label><textarea name="desc" required placeholder="Ex: Climatiseur split, groupe électrogène..."></textarea></div>
        </div>
        ${formActions(tr('Créer l’ordre de travail','Create Ticket'))}
      </form>
    `);
  }

  function printFolioInvoice(f) {
    const fm = folioMetrics(f), g = guestFor(f.guestId), b = bookingFor(f.bookingId), r = roomFor(f.roomId);
    return `<div class="print-paper"><header><div><span class="overline">BLUE LINE CAPITAL GROUP · SCI BLUE OCEAN</span><h2>Facture Folio Officielle</h2><small>Réf : ${esc(f.id)} · ${dateLabel(todayISO(), lang, true)}</small></div><div class="align-right"><strong>BLUE LINE PROPERTY & HOTEL OS</strong><div class="watermark">SYSCOHADA · FACTURE</div></div></header><div class="permission-grid" style="margin:20px 0"><div><small>Client</small><p><strong>${esc(g.name)}</strong></p><small>${esc(g.phone)}</small></div><div><small>Unité</small><p><strong>Chambre ${esc(f.roomId)} (${esc(r?.type || '')})</strong></p><small>${b ? `${dateLabel(b.arrival,lang)} → ${dateLabel(b.departure,lang)}` : '—'}</small></div></div><table><thead><tr><th>Date</th><th>Désignation</th><th>Qté</th><th>P.U.</th><th>Total</th></tr></thead><tbody>${f.lines.map(l => `<tr><td>${esc(l.date)}</td><td>${esc(l.desc)}</td><td>${l.qty}</td><td>${money(l.unitPrice)}</td><td>${money(l.total)}</td></tr>`).join('')}</tbody></table><div class="align-right"><p class="total">Total TTC: ${money(fm.totalGross)}</p><p>Payé: <b>${money(fm.totalPaid)}</b></p><p class="total">Solde Net: ${money(fm.balance)}</p></div></div>`;
  }

  function denied() { notify(tr('Action non autorisée pour ce poste de travail.','Action not permitted for this workstation role.'), true); }

  function switchView(id) {
    if (!canView(id)) return denied();
    view = id; filter = ''; selectedDate = '';
    closeModal();
    $('#sidebar').classList.remove('open');
    $('#scrim').hidden = true;
    $('#menuToggle').setAttribute('aria-expanded', 'false');
    render();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function download(content, name, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function exportFoliosCSV() {
    const p = currentProduct();
    if (p.id !== 'property') {
      const list = db.divisionRecords[p.id] || [];
      const header = ['ID Dossier', 'Étape', 'Client / Entité', 'Catégorie', 'Opération', 'Qté', 'Prix Unitaire XAF', 'Montant Total XAF', 'Mode Règlement', 'Opérateur', 'Date'];
      const rows = list.map(r => [r.id, `Étape ${r.step}/4`, r.client, r.category, tr(r.itemFr, r.itemEn), r.qty, r.unitPrice, r.amount, r.paymentMethod, r.operator, r.date]);
      download('\ufeff' + [header, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\r\n'), `${p.id}-export-erp.csv`, 'text/csv;charset=utf-8');
      notify(tr(`Export CSV (${p.repo}) téléchargé avec succès`,`CSV Export downloaded`));
      return;
    }
    const header = ['Folio ID', 'Booking ID', 'Guest Name', 'Room', 'Room Charges XAF', 'Service Charges XAF', 'Total Gross XAF', 'Paid XAF', 'Balance XAF', 'Status'];
    const rows = db.folios.map(f => { const fm = folioMetrics(f); return [f.id, f.bookingId, guestFor(f.guestId).name, f.roomId, fm.roomTotal, fm.serviceTotal, fm.totalGross, fm.totalPaid, fm.balance, f.status]; });
    download('\ufeff' + [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\r\n'), 'blue-line-erp-export.csv', 'text/csv;charset=utf-8');
    notify(tr('Export CSV téléchargé avec succès','CSV Export downloaded'));
  }

  // Click Events
  document.addEventListener('click', event => {
    const langBtn = event.target.closest('[data-lang]');
    if (langBtn) { lang = langBtn.dataset.lang === 'en' ? 'en' : 'fr'; render(); return; }

    const nav = event.target.closest('[data-view]');
    if (nav) { switchView(nav.dataset.view); return; }

    const floorBtn = event.target.closest('[data-floor-filter]');
    if (floorBtn) { floorFilter = floorBtn.dataset.floorFilter; render(); return; }

    const roomBtn = event.target.closest('[data-room-filter]');
    if (roomBtn) { roomFilter = roomBtn.dataset.roomFilter; render(); return; }

    const folioBtn = event.target.closest('[data-folio-filter]');
    if (folioBtn) { folioFilter = folioBtn.dataset.folioFilter; render(); return; }

    const calBtn = event.target.closest('[data-cal-date]');
    if (calBtn) { if (canView('bookings')) { selectedDate = calBtn.dataset.calDate; view = 'bookings'; render(); } return; }

    const button = event.target.closest('[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    const action = button.dataset.action;

    switch (action) {
      case 'open-login-gate': {
        event.preventDefault();
        gateOpen = true;
        render();
        break;
      }
      case 'close-login-gate': {
        gateOpen = false;
        render();
        break;
      }
      case 'select-product': {
        const nextProd = button.dataset.product;
        if (PRODUCTS_9.some(p => p.id === nextProd)) {
          productId = nextProd;
          const p = currentProduct();
          if (!p.roles[role]) role = Object.keys(p.roles)[0];
          render();
        }
        break;
      }
      case 'goto-modules-review': {
        view = 'modulesReview';
        gateOpen = false;
        render();
        window.scrollTo({ top: 0, behavior: 'instant' });
        notify(tr('Console de Revue des 9 Modules ERP ouverte !', '9-Module ERP Executive Review Console opened!'));
        break;
      }
      case 'switch-view-overview': {
        view = 'overview';
        render();
        window.scrollTo({ top: 0, behavior: 'instant' });
        break;
      }
      case 'select-product-direct': {
        const nextProd = button.dataset.product;
        if (PRODUCTS_9.some(p => p.id === nextProd)) {
          productId = nextProd;
          const p = currentProduct();
          if (!p.roles[role]) role = 'direction';
          view = 'overview';
          filter = '';
          selectedDate = '';
          gateOpen = false;
          render();
          window.scrollTo({ top: 0, behavior: 'instant' });
          notify(`${tr('Filiale active :','Active Division:')} ${tr(p.nameFr, p.nameEn)}`);
        }
        break;
      }
      case 'enter-terminal': {
        const nextProd = button.dataset.product || productId;
        const nextRole = button.dataset.role || 'direction';
        if (!PRODUCTS_9.some(p => p.id === nextProd) || !currentProduct().roles[nextRole] && !PRODUCTS_9.find(p => p.id === nextProd)?.roles[nextRole]) {
          notify(tr('Choix de terminal invalide','Invalid demo terminal selection'), true);
          break;
        }
        productId = nextProd;
        role = nextRole;
        view = 'overview';
        filter = '';
        selectedDate = '';
        gateOpen = false;
        render();
        window.scrollTo({ top: 0, behavior: 'instant' });
        notify(`${tr('Poste ouvert :','Terminal opened:')} ${tr(currentRoleMeta().fr, currentRoleMeta().en)}`);
        break;
      }
      case 'switch-role-step': {
        const nextRole = button.dataset.role;
        const p = currentProduct();
        if (p.roles[nextRole]) {
          role = nextRole;
          view = 'overview';
          render();
          window.scrollTo({ top: 0, behavior: 'instant' });
          if (button.dataset.itemId) {
            const item = p.catalog.find(c => c.id === button.dataset.itemId);
            if (item) {
              const sel = $('#divItemSelect');
              const priceIn = $('#divPriceInput');
              const clientIn = $('#divClientInput');
              if (sel) sel.value = item.id;
              if (priceIn) priceIn.value = item.price;
              if (clientIn && !clientIn.value) clientIn.value = `Dossier ${p.id.toUpperCase()} · Lot #${Math.floor(100 + Math.random()*899)}`;
              clientIn?.focus();
            }
          }
          notify(`${tr('Bascule sur le poste :','Switched to terminal:')} ${tr(currentRoleMeta().fr, currentRoleMeta().en)}`);
        }
        break;
      }
      case 'pos-add-item': {
        const srv = db.services.find(s => s.id === button.dataset.srvId);
        if (!srv) break;
        const existing = posCart.find(i => i.id === srv.id);
        if (existing) existing.qty += 1;
        else posCart.push({ ...srv, qty: 1 });
        render();
        break;
      }
      case 'pos-qty-inc': {
        const item = posCart.find(i => i.id === button.dataset.srvId);
        if (item) item.qty += 1;
        render();
        break;
      }
      case 'pos-qty-dec': {
        const idx = posCart.findIndex(i => i.id === button.dataset.srvId);
        if (idx > -1) {
          if (posCart[idx].qty > 1) posCart[idx].qty -= 1;
          else posCart.splice(idx, 1);
        }
        render();
        break;
      }
      case 'pos-clear-cart': {
        posCart = [];
        render();
        break;
      }
      case 'pos-submit-ticket': {
        const sel = $('#posFolioSelect');
        const f = folioFor(sel?.value) || db.folios.find(x => x.status === 'open');
        if (!f || posCart.length === 0) break;
        let totalAdded = 0;
        posCart.forEach(item => {
          const lineTotal = item.price * item.qty;
          totalAdded += lineTotal;
          f.lines.push({
            id: `LN-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,5)}`,
            date: todayISO(),
            category: item.cat,
            desc: lang === 'fr' ? item.nameFr : item.nameEn,
            qty: item.qty,
            unitPrice: item.price,
            total: lineTotal
          });
        });
        posCart = [];
        save('pos-ticket-posted', `${f.id}:${totalAdded}`);
        render();
        notify(tr(`Ticket POS de ${money(totalAdded)} imputé sur ${f.id} et transmis à la Comptabilité (Étape 3) !`, `POS Ticket of ${money(totalAdded)} posted to ${f.id} (Step 3)!`));
        break;
      }
      case 'hk-advance-room': {
        const r = roomFor(id);
        const nextStatus = button.dataset.next || 'available';
        if (r) {
          r.status = nextStatus;
          save('hk-room-turnover', `${r.id}->${nextStatus}`);
          render();
          notify(tr(`Chambre ${r.id} passée au statut : ${statusLabel(nextStatus)}`, `Room ${r.id} updated to ${statusLabel(nextStatus)}`));
        }
        break;
      }
      case 'div-prefill-item': {
        const p = currentProduct();
        const item = p.catalog.find(c => c.id === button.dataset.itemId);
        if (item) {
          const sel = $('#divItemSelect');
          const priceIn = $('#divPriceInput');
          const clientIn = $('#divClientInput');
          if (sel) sel.value = item.id;
          if (priceIn) priceIn.value = item.price;
          if (clientIn && !clientIn.value) clientIn.value = `Dossier ${p.id.toUpperCase()} · Lot #${Math.floor(100 + Math.random()*899)}`;
          clientIn?.focus();
          notify(tr(`Article ${item.id} sélectionné au guichet !`, `Item ${item.id} selected in terminal!`));
        }
        break;
      }
      case 'div-unit-toggle': {
        const p = currentProduct();
        const units = DIV_UNITS_SEED[p.id] || [];
        const u = units.find(x => x.id === id);
        if (u) {
          u.status = (u.status === 'available' || u.status === 'inspected') ? 'occupied' : 'available';
          save('toggle-div-unit', `${p.id}:${u.id}:${u.status}`);
          render();
          notify(tr(`Statut unité ${u.id} mis à jour : ${statusLabel(u.status)}`, `Unit ${u.id} status updated to ${statusLabel(u.status)}`));
        }
        break;
      }
      case 'div-advance-step': {
        const p = currentProduct();
        const list = db.divisionRecords[p.id] || [];
        const rec = list.find(r => r.id === id);
        if (rec && rec.step < 4) {
          rec.step += 1;
          save(`flow-step-${rec.step}`, `${p.id}:${rec.id}`);
          render();
          notify(tr(`Dossier ${rec.id} transmis avec succès à l’Étape ${rec.step}/4 !`, `Record ${rec.id} advanced to Step ${rec.step}/4!`));
        }
        break;
      }
      case 'div-boss-approve': {
        const p = currentProduct();
        const list = db.divisionRecords[p.id] || [];
        const rec = list.find(r => r.id === id);
        if (rec) {
          rec.approvedByBoss = true;
          save('boss-final-signoff', `${p.id}:${rec.id}`);
          render();
          notify(tr(`Signature Direction Générale apposée sur ${rec.id} — Cycle Start-to-End terminé [END] !`, `Executive Boss sign-off completed for ${rec.id} [END]!`));
        }
        break;
      }
      case 'div-audit-certify-all': {
        const p = currentProduct();
        const list = db.divisionRecords[p.id] || [];
        let certifiedCount = 0;
        list.forEach(r => {
          if (r.step === 3) { r.step = 4; certifiedCount += 1; }
        });
        if (certifiedCount === 0) {
          notify(tr('Aucun dossier en attente à l’Étape 3 (Audit).', 'No pending dossiers at Step 3 (Audit).'), true);
          break;
        }
        save('div-audit-certify-all', `${p.id}:${certifiedCount}`);
        render();
        notify(tr(`${certifiedCount} dossier(s) certifié(s) conforme(s) et transmis à la Direction Générale (Étape 4) !`, `${certifiedCount} dossier(s) certified and pushed to Step 4 Boss!`));
        break;
      }
      case 'print-div-record': {
        const p = currentProduct();
        const list = db.divisionRecords[p.id] || [];
        const rec = list.find(r => r.id === id) || list[0];
        if (!rec) break;
        const docTitles = {
          holding: ['Résolution Comité CAPEX & Consolidation OHADA', 'CAPEX Board Resolution & Consolidation Certificate'],
          blex: ['Bordereau Officiel de Change FX & Attestation KYC COBAC', 'Official FX Deal Slip & COBAC AML Certificate'],
          construction: ['Décompte Provisoire de Travaux BTP & Attachement', 'BTP Progress Billing Certificate & BOQ Statement'],
          sugar: ['Ordre de Fabrication MRP & Certificat Labo ICUMSA 45', 'MRP Manufacturing Order & ICUMSA 45 Lab Certificate'],
          trade: ['Fiche de Liquidation Douane GUCE & Coût de Revient (CAF)', 'GUCE Customs Liquidation & Landed Cost Sheet'],
          finance: ['Pièce d’Imputation Comptable SYSCOHADA (Débit = Crédit)', 'SYSCOHADA Double-Entry Journal Voucher'],
          hr: ['Bulletin de Paie Réglementaire Cameroun (CNPS / DIPE)', 'Cameroon Statutory Payslip & CNPS Statement'],
          digital: ['Rapport d’Audit Cyber-Gouvernance & Conformité IA', 'AI Anomaly Audit & RBAC Compliance Certificate']
        }[p.id] || ['Pièce Officielle ERP', 'Official ERP Document'];

        const taxRate = p.id === 'hr' ? 0.042 : p.id === 'blex' ? 0.015 : 0.1925;
        const taxAmt = Math.round(rec.amount * taxRate);
        const netAmt = p.id === 'hr' ? (rec.amount - taxAmt) : (rec.amount + taxAmt);
        const taxLabel = p.id === 'hr' ? 'Retenue Salariale CNPS PVID (4,2%)' : p.id === 'blex' ? 'Commission & Taxe Change (1,5%) · Seuil COBAC Vérifié' : p.id === 'construction' ? 'TVA Cameroun 19,25% (Retenue Garantie 10% suivie)' : 'TVA / Droits Réglementaires (19,25%)';

        const docHtml = `
          <div class="print-paper">
            <header>
              <div>
                <span class="overline">${esc(p.num)} · ${esc(tr(p.nameFr, p.nameEn).toUpperCase())}</span>
                <h2>${esc(tr(docTitles[0], docTitles[1]))}</h2>
                <small>Réf : ${esc(rec.id)} · Date : ${esc(rec.date)} · Modèle : ${esc(p.odooModel)}</small>
              </div>
              <div class="align-right">
                <strong>BLUE LINE CAPITAL GROUP</strong>
                <div class="watermark">ÉTAPE ${rec.step}/4 · CERTIFIÉ</div>
              </div>
            </header>
            <div class="permission-grid" style="margin:18px 0">
              <div><small>${tr('Tiers / Contrepartie / Lot','Counterparty / Batch')}</small><p><strong>${esc(rec.client)}</strong></p><small>Mode : ${esc(rec.paymentMethod)}</small></div>
              <div><small>${tr('Opérateur & Traçabilité Flowchart','Operator & Flowchart Trace')}</small><p><strong>${esc(rec.operator)}</strong></p><small>Statut : Étape ${rec.step}/4 ${rec.approvedByBoss ? '· Signé PDG [END]' : ''}</small></div>
            </div>
            <table>
              <thead><tr><th>Réf</th><th>Catégorie Métier</th><th>Désignation Officielle</th><th>Qté</th><th>Montant Unitaire</th><th>Montant H.T. / Brut</th></tr></thead>
              <tbody>
                <tr>
                  <td class="mono">${esc(rec.id)}</td>
                  <td>${esc(rec.category)}</td>
                  <td><strong>${esc(tr(rec.itemFr, rec.itemEn))}</strong><br/><small>${esc(tr(rec.notesFr || '', rec.notesEn || ''))}</small></td>
                  <td>${rec.qty}</td>
                  <td class="mono">${money(rec.unitPrice)}</td>
                  <td class="mono"><strong>${money(rec.amount)}</strong></td>
                </tr>
              </tbody>
            </table>
            <div class="align-right">
              <p>Base H.T. / Brut : <b class="mono">${money(rec.amount)}</b></p>
              <p>${esc(taxLabel)} : <b class="mono">${money(taxAmt)}</b></p>
              <p class="total">Net Liquidé / TTC : ${money(netAmt)}</p>
            </div>
          </div>
        `;
        $('#printRoot').innerHTML = docHtml;
        modal(`${esc(tr(docTitles[0], docTitles[1]))} — ${esc(rec.id)}`, `
          ${docHtml}
          <div class="form-actions">
            <button type="button" class="btn btn-outline" data-action="close-modal">${tr('Fermer','Close')}</button>
            <button type="button" class="btn btn-primary" onclick="window.print()">🖨 ${tr('Imprimer / Exporter PDF','Print / Save PDF')}</button>
          </div>
        `);
        break;
      }
      case 'close-modal': closeModal(); break;
      case 'new-booking': newBookingModal(); break;
      case 'new-guest': {
        modal(tr('Créer un Profil Client CRM','New CRM Client Profile'), `
          <form data-form="guest">
            <div class="form-grid">
              ${field('guest', tr('Nom complet','Full Name'), 'text', '', 'required minlength="2"')}
              ${field('phone', tr('Téléphone WhatsApp','Phone WhatsApp'), 'text', '+237 ', 'required')}
              ${field('email', 'Email', 'email', '')}
              <div class="form-field wide"><label>${tr('Notes','Notes')}</label><textarea name="notes"></textarea></div>
              <label class="checkbox-line wide"><input type="checkbox" name="vip"/> VIP Corporate</label>
            </div>
            ${formActions(tr('Créer le Client','Create Guest'))}
          </form>
        `);
        break;
      }
      case 'open-folio': openFolioModal(id); break;
      case 'add-charge-to-folio': addChargeModal(button.dataset.folio || id); break;
      case 'open-service-charge': addChargeModal(); break;
      case 'quick-post-service': {
        const srv = db.services.find(s => s.id === button.dataset.srvId);
        addChargeModal();
        setTimeout(() => {
          const select = $('#charge-service-select');
          if (select && srv) { select.value = srv.id; const priceInput = $('#field-price'); if (priceInput) priceInput.value = srv.price; }
        }, 50);
        break;
      }
      case 'charge-room': {
        const folio = db.folios.find(f => f.roomId === button.dataset.room && f.status === 'open');
        if (folio) openFolioModal(folio.id);
        else notify(tr('Aucun folio actif trouvé pour cette chambre','No open folio for this room'), true);
        break;
      }
      case 'folio-payment-quick': paymentModal(id); break;
      case 'print-folio-invoice': {
        const f = folioFor(id);
        if (!f) break;
        $('#printRoot').innerHTML = printFolioInvoice(f);
        window.print();
        break;
      }
      case 'close-folio-btn': {
        const f = folioFor(button.dataset.folio);
        if (!f) break;
        f.status = 'closed';
        const b = bookingFor(f.bookingId);
        if (b && b.status === 'checked-in') {
          b.status = 'checked-out';
          const r = roomFor(f.roomId);
          if (r) r.status = 'dirty';
          db.tasks.push({ id:`TSK-${Date.now().toString(36)}`, roomId:f.roomId, label:'Nettoyage après départ Odoo', status:'pending', priority:'high' });
        }
        save('close-folio', f.id);
        closeModal(); render();
        notify(tr('Folio clôturé et soldé avec succès !','Folio closed and settled!'));
        break;
      }
      case 'booking-detail': {
        const b = bookingFor(id);
        if (!b) break;
        const g = guestFor(b.guestId), f = folioFor(b.folioId), fm = folioMetrics(f);
        modal(`${tr('Réservation Odoo','Odoo Booking')} ${esc(b.id)}`, `
          <div class="stack">
            <div class="statusbar">
              <div class="statusbar-step ${b.status==='confirmed'?'active':'done'}">1. Confirmée</div>
              <div class="statusbar-step ${b.status==='checked-in'?'active':b.status==='checked-out'?'done':''}">2. Check-In</div>
              <div class="statusbar-step ${b.status==='checked-out'?'active':''}">3. Check-Out</div>
            </div>
            <div class="task-card"><div class="task-info"><strong>${esc(g.name)}</strong><p>Chambre ${esc(b.roomId)} · ${dateLabel(b.arrival,lang)} → ${dateLabel(b.departure,lang)}</p></div>${statusChip(b.status)}</div>
            <div class="bill-summary" style="margin:10px 0">
              <div><span>Folio associé</span><strong class="mono">${esc(b.folioId)}</strong></div>
              <div><span>Total Facturé</span><strong class="mono">${money(fm.totalGross)}</strong></div>
              <div><span>Solde Dû</span><strong class="mono ${fm.balance>0?'negative':'positive'}">${money(fm.balance)}</strong></div>
            </div>
            <div class="form-actions">
              ${b.status === 'confirmed' ? btn('do-checkin', `${icon('check')} Check-In`, 'primary', `data-id="${esc(b.id)}"`) : ''}
              ${b.status === 'checked-in' ? btn('do-checkout', `${icon('arrow')} Check-Out → Ménage`, 'primary', `data-id="${esc(b.id)}"`) : ''}
              ${btn('open-folio', `${icon('fileText')} Folio`, 'outline', `data-id="${esc(b.folioId)}"`) }
            </div>
          </div>
        `);
        break;
      }
      case 'do-checkin': {
        const b = bookingFor(id);
        if (!b) break;
        const r = roomFor(b.roomId);
        if (r?.status === 'maintenance') return notify(tr('Chambre en maintenance','Room in maintenance'), true);
        b.status = 'checked-in';
        if (r) r.status = 'occupied';
        save('check-in', b.id);
        closeModal(); render();
        notify(tr('Check-in validé, client sur place.','Check-in completed.'));
        break;
      }
      case 'do-checkout': {
        const b = bookingFor(id);
        if (!b) break;
        const f = folioFor(b.folioId), fm = folioMetrics(f);
        if (fm.balance > 0) {
          notify(tr(`Solde dû de ${money(fm.balance)} sur le folio avant Check-Out.`, `Outstanding balance of ${money(fm.balance)}`), true);
          openFolioModal(f.id);
          return;
        }
        b.status = 'checked-out';
        if (f) f.status = 'closed';
        const r = roomFor(b.roomId);
        if (r) r.status = 'dirty';
        db.tasks.push({ id:`TSK-${Date.now().toString(36)}`, roomId:b.roomId, label:'Nettoyage suite à départ client', status:'pending', priority:'high' });
        save('check-out', b.id);
        closeModal(); render();
        notify(tr('Check-out validé, chambre envoyée au Kanban Gouvernante (Étape 2) !','Check-out completed, room sent to Step 2 Housekeeping Kanban!'));
        break;
      }
      case 'new-maintenance': newMaintenanceModal(); break;
      case 'resolve-maintenance': {
        const m = db.maintenance.find(x => x.id === id);
        if (!m) break;
        m.stage = 'resolved';
        const r = roomFor(m.roomId);
        if (r && r.status === 'maintenance') r.status = 'inspected';
        save('resolve-maintenance', m.id);
        render();
        notify(tr('Ticket de maintenance résolu !','Maintenance order resolved!'));
        break;
      }
      case 'run-night-audit': case 'run-night-audit-btn': {
        const m = hospitalityMetrics();
        db.auditHistory.unshift({
          date: todayISO(),
          occupancyRate: m.occupancyRate,
          adr: m.adr,
          revPar: m.revPar,
          roomRevenue: m.totalRoomRevenue,
          serviceRevenue: m.totalServiceRevenue,
          totalDayRevenue: m.totalGross,
          auditor: currentRoleMeta().staff
        });
        save('night-audit-run', `${todayISO()}:ADR=${m.adr}`);
        render();
        notify(tr('Clôture Night Audit exécutée et transmise à la Direction Générale (Étape 4) !','Night Audit completed and sent to Step 4 Executive Boss!'));
        break;
      }
      case 'task-complete': {
        const t = db.tasks.find(x => x.id === id);
        if (!t) break;
        t.status = 'done';
        const r = roomFor(t.roomId);
        if (r && (r.status === 'dirty' || r.status === 'cleaning')) r.status = 'available';
        save('complete-task', t.id);
        render();
        notify(tr('Chambre nettoyée et prête !','Room cleaned and available!'));
        break;
      }
      case 'room-detail': {
        const r = roomFor(id);
        if (!r) break;
        modal(`Chambre ${r.id}`, `<div class="stack"><div class="task-card"><div class="task-info"><strong>Chambre ${esc(r.id)} · ${esc(r.type)}</strong><p>Étage : ${esc(r.floor)} · Tarif : ${money(r.rate)}</p></div>${statusChip(r.status)}</div><div class="amenity-chips">${r.amenities.map(a => `<span class="amenity-chip">${esc(a)}</span>`).join('')}</div>${can('room') ? btn('room-edit', tr('Modifier l’état','Update Status'), 'primary', `data-id="${esc(r.id)}"`) : ''}</div>`);
        break;
      }
      case 'room-edit': {
        const r = roomFor(id);
        if (!r) break;
        modal(tr('Changer le Statut de la Chambre','Update Room Status'), `<form data-form="room-status-form" data-id="${esc(r.id)}"><div class="form-field wide"><label>Chambre ${esc(r.id)}</label><select name="status">${['available','dirty','cleaning','inspected','maintenance'].map(s => `<option value="${s}" ${r.status===s?'selected':''}>${statusLabel(s)}</option>`).join('')}</select></div>${formActions(tr('Appliquer','Apply'))}</form>`);
        break;
      }
      case 'month-prev': { const [y, m] = monthCursor.split('-').map(Number); monthCursor = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0,7); render(); break; }
      case 'month-next': { const [y, m] = monthCursor.split('-').map(Number); monthCursor = new Date(Date.UTC(y, m, 1)).toISOString().slice(0,7); render(); break; }
      case 'month-today': { monthCursor = todayISO().slice(0,7); render(); break; }
      case 'clear-date': { selectedDate = ''; render(); break; }
      case 'export-json': { download(JSON.stringify(db, null, 2), 'blue-line-9-products-erp.json', 'application/json'); notify(tr('Base exportée (JSON)','JSON exported')); break; }
      case 'export-csv': { exportFoliosCSV(); break; }
      case 'reset-data': {
        if (!window.confirm(tr('Effacer toutes les modifications locales de la démonstration et restaurer les données exemple ? Cette action ne peut pas être annulée.', 'Erase all local demo changes and restore the sample dataset? This cannot be undone.'))) break;
        db = demoSeed(); save('factory-reset'); render();
        notify(tr('Base des 9 produits réinitialisée !','All 9 products reset!'));
        break;
      }
      case 'ops-toggle': {
        const s = db.systems.find(x => x.id === id);
        if (s) { s.status = s.status === 'healthy' ? 'issue' : 'healthy'; save('toggle-ops', s.id); render(); }
        break;
      }
      case 'bookings': case 'rooms': case 'folios': case 'services': case 'maintenance': case 'audit': {
        switchView(action); break;
      }
    }
  });

  // Select & Input Change Listeners
  document.addEventListener('change', event => {
    if (event.target.matches('#productSelect')) {
      productId = event.target.value;
      const p = currentProduct();
      if (!p.roles[role]) role = Object.keys(p.roles)[0];
      view = 'overview';
      render();
      notify(`${tr('Filiale active :','Active Division:')} ${tr(p.nameFr, p.nameEn)}`);
    }
    if (event.target.matches('#roleSelect')) {
      role = event.target.value;
      view = 'overview';
      filter = '';
      closeModal();
      render();
      notify(`${tr('Poste actif :','Active Terminal:')} ${tr(currentRoleMeta().fr, currentRoleMeta().en)}`);
    }
    if (event.target.matches('#posFolioSelect')) {
      activeFolioId = event.target.value;
    }
    if (event.target.matches('[data-booking-filter]')) {
      bookingFilter = event.target.value;
      render();
    }
    if (event.target.matches('#charge-service-select')) {
      const selected = event.target.selectedOptions[0];
      const priceInput = $('#field-price');
      if (priceInput && selected?.dataset.price) priceInput.value = selected.dataset.price;
    }
    if (event.target.matches('#divItemSelect')) {
      const selected = event.target.selectedOptions[0];
      const priceInput = $('#divPriceInput');
      if (priceInput && selected?.dataset.price) priceInput.value = selected.dataset.price;
    }
  });

  document.addEventListener('input', event => {
    if (!event.target.matches('[data-filter]')) return;
    const pos = event.target.selectionStart ?? 0;
    filter = event.target.value;
    render();
    const input = $('#searchInput');
    if (input) { input.focus(); try { input.setSelectionRange(pos, pos); } catch(e){} }
  });

  // Form Submissions
  document.addEventListener('submit', event => {
    const form = event.target.closest('[data-form]');
    if (!form) return;
    event.preventDefault();
    const f = new FormData(form);
    const kind = form.dataset.form;

    if (kind === 'div-new-record') {
      const p = currentProduct();
      const client = String(f.get('client') || '').trim();
      const itemId = String(f.get('itemId') || '');
      const catItem = p.catalog.find(c => c.id === itemId) || p.catalog[0];
      const qty = Math.max(1, Number(f.get('qty') || 1));
      const unitPrice = Number(f.get('unitPrice') || catItem?.price || 0);
      const paymentMethod = String(f.get('paymentMethod') || 'Virement CEMAC');

      const newRec = {
        id: `${p.id.toUpperCase().slice(0,3)}-${Math.floor(2610 + Math.random()*890)}`,
        step: 2, // Automatically created at Step 1 and pushed to Step 2 Operations!
        client,
        itemFr: catItem ? catItem.nameFr : 'Opération Standard',
        itemEn: catItem ? catItem.nameEn : 'Standard Operation',
        category: catItem ? catItem.cat : 'Opération',
        qty,
        unitPrice,
        amount: qty * unitPrice,
        paymentMethod,
        operator: currentRoleMeta().staff,
        notesFr: 'Créé au Guichet (Étape 1) et transmis à l’équipe Opérations (Étape 2).',
        notesEn: 'Created at Step 1 Counter and handed off to Step 2 Operations.',
        date: todayISO()
      };

      db.divisionRecords[p.id] = db.divisionRecords[p.id] || [];
      db.divisionRecords[p.id].unshift(newRec);
      save('new-division-record', `${p.id}:${newRec.id}`);
      render();
      notify(tr(`Dossier ${newRec.id} (${money(newRec.amount)}) validé à l’Étape 1 et envoyé au Kanban Opérations (Étape 2) !`, `Record ${newRec.id} created at Step 1 and sent to Step 2 Operations!`));
      return;
    }

    if (kind === 'div-simulator') {
      const p = currentProduct();
      const a = Number(f.get('simA') || 0);
      const b = Number(f.get('simB') || 0);
      const c = Number(f.get('simC') || 0);
      const client = String(f.get('simClient') || 'Dossier Calculé').trim();

      let amount = 0, itemFr = '', itemEn = '', cat = 'Calcul Métier', notesFr = '', notesEn = '';
      if (p.id === 'blex') {
        const baseXaf = Math.round(a * b);
        const spreadFee = Math.round(baseXaf * (c / 100));
        amount = baseXaf + spreadFee;
        const amlFlag = amount >= 5000000 ? 'Déclaration ANIF/COBAC Obligatoire (≥ 5M FCFA)' : 'Sous seuil LBC/FT (< 5M FCFA)';
        cat = 'Change FX & COBAC';
        itemFr = `Opération Change ${a.toLocaleString('fr-FR')} Devise @ ${b} XAF (+${c}% Spread)`;
        itemEn = `FX Deal ${a.toLocaleString('en-GB')} Currency @ ${b} XAF (+${c}% Spread)`;
        notesFr = `Contre-valeur : ${money(baseXaf)} · Marge FX : ${money(spreadFee)} · Statut AML : ${amlFlag}`;
        notesEn = `Base XAF: ${money(baseXaf)} · Spread: ${money(spreadFee)} · AML Status: ${amlFlag}`;
      } else if (p.id === 'sugar') {
        const sugarTonnes = +(a * (b / 100)).toFixed(2);
        const bags50kg = Math.round((sugarTonnes * 1000) / 50);
        amount = bags50kg * c;
        cat = 'Production MRP ICUMSA 45';
        itemFr = `Broyage ${a}T Canne → ${sugarTonnes}T Sucre Blanc (${bags50kg} Sacs 50kg)`;
        itemEn = `Milling ${a}T Cane → ${sugarTonnes}T Refined Sugar (${bags50kg} × 50kg Bags)`;
        notesFr = `Rendement extraction : ${b}% · Sacs 50kg produits : ${bags50kg} · Polarimétrie 99,8°Z ICUMSA ≤ 45`;
        notesEn = `Extraction yield: ${b}% · 50kg bags produced: ${bags50kg} · ICUMSA <= 45 certified`;
      } else if (p.id === 'construction') {
        const grossWorks = Math.round(a * (b / 100));
        const retention = Math.round(grossWorks * (c / 100));
        const tva = Math.round(grossWorks * 0.1925);
        const air = Math.round(grossWorks * 0.022);
        amount = grossWorks - retention + tva - air;
        cat = 'Décompte BTP & BOQ';
        itemFr = `Décompte Travaux (${b}% avancement) · Retenue Garantie ${c}%`;
        itemEn = `Progress Billing (${b}% completion) · ${c}% Retention Guarantee`;
        notesFr = `Brut HT: ${money(grossWorks)} · Retenue ${c}%: -${money(retention)} · TVA 19,25%: +${money(tva)} · AIR 2,2%: -${money(air)}`;
        notesEn = `Gross HT: ${money(grossWorks)} · Retention: -${money(retention)} · VAT: +${money(tva)} · WHT: -${money(air)}`;
      } else if (p.id === 'trade') {
        const duty = Math.round(a * (b / 100));
        const taxable = a + duty + c;
        const tvaImport = Math.round(taxable * 0.1925);
        amount = taxable + tvaImport;
        cat = 'Liquidation GUCE & CAF';
        itemFr = `Dédouanement Conteneur CAF ${money(a)} (TEC ${b}% + PAD)`;
        itemEn = `Container Customs Clearance CIF ${money(a)} (TEC ${b}% + Port)`;
        notesFr = `Droits Douane TEC (${b}%): ${money(duty)} · Acconage PAD: ${money(c)} · TVA Import 19,25%: ${money(tvaImport)}`;
        notesEn = `Customs Duty (${b}%): ${money(duty)} · Port Fees: ${money(c)} · Import VAT 19.25%: ${money(tvaImport)}`;
      } else if (p.id === 'finance') {
        const tva = Math.round(a * (b / 100));
        const air = Math.round(a * (c / 100));
        amount = a + tva - air;
        cat = 'Journal SYSCOHADA';
        itemFr = `Écriture OHADA HT ${money(a)} (TVA ${b}% · AIR ${c}%)`;
        itemEn = `SYSCOHADA Entry HT ${money(a)} (VAT ${b}% · WHT ${c}%)`;
        notesFr = `Débit Cpte 601/241: ${money(a)} + Cpte 445 TVA: ${money(tva)} | Crédit Cpte 401 Net: ${money(amount)} + Cpte 447 AIR: ${money(air)}`;
        notesEn = `Debit Acct 601: ${money(a)} + VAT 445: ${money(tva)} | Credit Acct 401 Net: ${money(amount)} + WHT 447: ${money(air)}`;
      } else if (p.id === 'hr') {
        const cnpsSal = Math.round(Math.min(a, 750000) * 0.042);
        const irpp = Math.round(Math.max(0, a - cnpsSal - 41667) * 0.165);
        const cfcRav = Math.round(a * 0.015);
        const netUnit = Math.max(0, a - cnpsSal - irpp - cfcRav);
        const cnpsPat = Math.round(a * (c / 100));
        amount = netUnit * Math.max(1, b);
        cat = 'Paie CNPS & DIPE';
        itemFr = `Lot Paie ${b} Salarié(s) · Brut ${money(a)} → Net Unitaire ${money(netUnit)}`;
        itemEn = `Payroll Batch ${b} Staff · Gross ${money(a)} → Net Unit ${money(netUnit)}`;
        notesFr = `Par salarié : CNPS Salarié (4,2% plafonné): ${money(cnpsSal)} · IRPP+CAC: ${money(irpp)} · CFC+RAV: ${money(cfcRav)} · CNPS Patronale (${c}%): ${money(cnpsPat)}`;
        notesEn = `Per employee: CNPS 4.2%: ${money(cnpsSal)} · IRPP+CAC: ${money(irpp)} · CFC+RAV: ${money(cfcRav)} · Employer CNPS (${c}%): ${money(cnpsPat)}`;
      } else if (p.id === 'holding') {
        const payback = b > 0 ? (a / b).toFixed(1) : '—';
        const npv5y = Math.round((b * 3.99) - a);
        amount = a;
        cat = 'Comité CAPEX Groupe';
        itemFr = `Allocation CAPEX ${money(a)} (Payback ${payback} ans · VAN 5 ans ${money(npv5y)})`;
        itemEn = `CAPEX Allocation ${money(a)} (Payback ${payback} yrs · 5Y NPV ${money(npv5y)})`;
        notesFr = `Cash-flow annuel: ${money(b)} · Détention Holding: ${c}% · VAN (NPV @ 8%): ${money(npv5y)}`;
        notesEn = `Annual cashflow: ${money(b)} · Holding stake: ${c}% · 5Y NPV (@ 8%): ${money(npv5y)}`;
      } else {
        amount = a;
        cat = 'Audit IA Copilot';
        itemFr = `Scan Heuristique ${b} Filiales (Seuil ${money(a)} · Confiance ${c}%)`;
        itemEn = `Heuristic Scan across ${b} Divisions (Threshold ${money(a)} · Confidence ${c}%)`;
        notesFr = `0 brèche RBAC · Vérification croisée BLEX/SYSCOHADA/Folios terminée avec score ${c}%`;
        notesEn = `0 RBAC breaches · Cross-division verification completed at ${c}% confidence`;
      }

      const newRec = {
        id: `${p.id.toUpperCase().slice(0,3)}-${Math.floor(2610 + Math.random()*890)}`,
        step: 3,
        client,
        itemFr,
        itemEn,
        category: cat,
        qty: 1,
        unitPrice: amount,
        amount,
        paymentMethod: 'Calcul Réglementaire Certifié',
        operator: currentRoleMeta().staff,
        notesFr,
        notesEn,
        date: todayISO()
      };

      db.divisionRecords[p.id] = db.divisionRecords[p.id] || [];
      db.divisionRecords[p.id].unshift(newRec);
      save('run-division-simulator', `${p.id}:${newRec.id}:${amount}`);
      render();
      notify(tr(`Simulation ${newRec.id} (${money(amount)}) enregistrée et envoyée à l’Audit (Étape 3) !`, `Simulation ${newRec.id} (${money(amount)}) saved to Step 3 Audit!`));
      return;
    }

    if (kind === 'booking') {
      const guestName = String(f.get('guest') || '').trim();
      const phone = String(f.get('phone') || '').trim();
      const roomId = String(f.get('roomId') || '');
      const arrival = String(f.get('arrival') || '');
      const departure = String(f.get('departure') || '');
      const channel = String(f.get('channel') || 'Direct Réception');
      const deposit = Number(f.get('paid') || 0);
      const payMethod = String(f.get('payMethod') || 'Espèces');

      if (!guestName || !arrival || !departure || arrival >= departure || !/^\d{4}-\d{2}-\d{2}$/.test(arrival) || !/^\d{4}-\d{2}-\d{2}$/.test(departure)) {
        return notify(tr('Dates de réservation invalides','Invalid stay dates'), true);
      }
      const requestedRoom = roomFor(roomId);
      if (!requestedRoom || requestedRoom.status === 'maintenance') {
        return notify(tr('Veuillez sélectionner une unité disponible et valide.','Select a valid unit that is not out of service.'), true);
      }
      const overlap = db.bookings.some(b => b.roomId === roomId && b.status !== 'cancelled' && b.status !== 'checked-out' && arrival < b.departure && departure > b.arrival);
      if (overlap) {
        return notify(tr('Cette unité est déjà réservée sur les dates sélectionnées.','This room already has a reservation overlapping those dates.'), true);
      }
      const requestedNights = dateDiff(arrival, departure);
      const maximumDeposit = requestedRoom.rate * requestedNights;
      if (!Number.isFinite(deposit) || deposit < 0 || deposit > maximumDeposit) {
        return notify(tr('Acompte invalide ou supérieur au montant du séjour.','Invalid deposit or greater than the stay total.'), true);
      }

      let guest = db.guests.find(g => g.name.toLowerCase() === guestName.toLowerCase());
      if (!guest) {
        guest = { id:`G${Date.now().toString(36).toUpperCase()}`, name:guestName, phone, email:'', vip:false, notes:'', created:todayISO() };
        db.guests.push(guest);
      }

      const room = roomFor(roomId);
      const nights = Math.max(1, dateDiff(arrival, departure));
      const roomTotal = (room?.rate || 40000) * nights;
      const newBookingId = `RES-${Date.now().toString(36).toUpperCase()}`;
      const newFolioId = `FOL-${Date.now().toString(36).toUpperCase()}`;

      db.bookings.unshift({ id: newBookingId, folioId: newFolioId, guestId: guest.id, roomId, arrival, departure, status: 'confirmed', channel, created: todayISO() });
      db.folios.unshift({
        id: newFolioId,
        bookingId: newBookingId,
        guestId: guest.id,
        roomId,
        status: 'open',
        lines: [{ id: `LN-${Date.now().toString(36)}`, date: arrival, category: 'room', desc: `Hébergement ${room.type} (Ch. ${room.id}) · ${nights} nuits`, qty: nights, unitPrice: room.rate, total: roomTotal }],
        payments: deposit > 0 ? [{ id: `PAY-${Date.now().toString(36)}`, date: arrival, amount: deposit, method: payMethod, ref: `DEP-${Date.now().toString().slice(-5)}` }] : [],
        createdAt: arrival
      });

      save('create-odoo-booking', newBookingId);
      closeModal(); render();
      notify(tr('Réservation et Folio créés avec succès !','Reservation and folio created!'));
      return;
    }

    if (kind === 'folio-charge') {
      const folio = folioFor(String(f.get('selectedFolioId') || f.get('folioId') || ''));
      if (!folio) return notify(tr('Folio non trouvé','Folio not found'), true);
      const srv = db.services.find(s => s.id === String(f.get('serviceId') || ''));
      const qty = Number(f.get('qty') || 1);
      const price = Number(f.get('price') || (srv?.price || 0));
      if (folio.status !== 'open' || !srv || !Number.isInteger(qty) || qty < 1 || qty > 10000 || !Number.isFinite(price) || price < 0) {
        return notify(tr('Prestation, quantité, prix ou folio invalide.','Invalid service, quantity, price, or closed folio.'), true);
      }
      const desc = srv ? (lang === 'fr' ? srv.nameFr : srv.nameEn) : 'Prestation';
      folio.lines.push({ id: `LN-${Date.now().toString(36)}`, date: todayISO(), category: srv ? srv.cat : 'service', desc, qty, unitPrice: price, total: qty * price });
      save('add-folio-charge', `${folio.id}:${desc}`);
      closeModal(); openFolioModal(folio.id); render();
      notify(tr(`Charge de ${money(qty * price)} imputée sur ${folio.id} !`, `Charge posted to ${folio.id}`));
      return;
    }

    if (kind === 'folio-payment') {
      const folio = folioFor(form.dataset.folio);
      if (!folio) return;
      const amount = Number(f.get('amount') || 0);
      const remaining = folioMetrics(folio).balance;
      if (!Number.isFinite(amount) || amount <= 0 || amount > remaining || folio.status === 'closed') {
        return notify(tr('Montant invalide, solde dépassé ou folio déjà clôturé.','Invalid amount, payment exceeds balance, or folio is closed.'), true);
      }
      folio.payments.push({ id: `PAY-${Date.now().toString(36)}`, date: todayISO(), amount, method: String(f.get('method') || 'Espèces'), ref: `ENC-${Date.now().toString().slice(-6)}` });
      save('record-folio-payment', `${folio.id}:${amount}`);
      closeModal(); openFolioModal(folio.id); render();
      notify(tr(`Règlement de ${money(amount)} enregistré !`,`Payment of ${money(amount)} recorded!`));
      return;
    }

    if (kind === 'guest') {
      const newId = `G${Date.now().toString(36).toUpperCase()}`;
      db.guests.push({ id: newId, name: String(f.get('guest') || '').trim(), phone: String(f.get('phone') || '').trim(), email: String(f.get('email') || '').trim(), notes: String(f.get('notes') || '').trim(), vip: f.get('vip') === 'on', created: todayISO() });
      save('create-guest', newId);
      closeModal(); render();
      notify(tr('Client ajouté dans le CRM !','Client added to CRM!'));
      return;
    }

    if (kind === 'maintenance') {
      const roomId = String(f.get('roomId') || ''), priority = String(f.get('priority') || 'normal'), desc = String(f.get('desc') || '').trim();
      const ticketId = `MNT-${Date.now().toString().slice(-4)}`;
      db.maintenance.unshift({ id: ticketId, roomId, desc, priority, stage: 'in_progress', reportedBy: currentRoleMeta().staff, date: todayISO() });
      if (priority === 'urgent') { const r = roomFor(roomId); if (r) r.status = 'maintenance'; }
      save('create-maintenance', ticketId);
      closeModal(); render();
      notify(tr('Ordre de maintenance créé !','Maintenance order created!'));
      return;
    }

    if (kind === 'room-status-form') {
      const r = roomFor(form.dataset.id);
      const status = String(f.get('status') || '');
      if (r) { r.status = status; save('update-room-status', `${r.id}:${status}`); closeModal(); render(); }
    }
  });

  // Progressive UX enhancement: filter nine products without resetting the application view.
  document.addEventListener('input', event => {
    if (event.target?.id !== 'portalProductSearch') return;
    const q = event.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
    const cards = [...document.querySelectorAll('#portalProductGrid .product-9-card')];
    let visible = 0;
    for (const card of cards) {
      const haystack = card.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
      const match = !q || haystack.includes(q);
      card.hidden = !match;
      if (match) visible++;
    }
    const status = $('#portalResults');
    if (status) status.textContent = `${visible} / ${cards.length}`;
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (!gateOpen) { gateOpen = true; render(); }
      $('#portalProductSearch')?.focus();
    }
    if (event.target?.id === 'portalProductSearch' && event.key === 'Enter') {
      const first = [...document.querySelectorAll('#portalProductGrid .product-9-card')].find(el => !el.hidden);
      if (first) { event.preventDefault(); first.click(); $('#portalProductSearch')?.focus(); }
    }
    if (event.key === 'Tab' && !$('#modalRoot')?.hidden) {
      const modalEl = $('#modalRoot .modal');
      if (!modalEl) return;
      const candidates = [...modalEl.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el => el.getClientRects().length);
      if (!candidates.length) return;
      const first = candidates[0], last = candidates[candidates.length - 1];
      if (event.shiftKey && (document.activeElement === first || !modalEl.contains(document.activeElement))) {event.preventDefault();last.focus();}
      else if (!event.shiftKey && (document.activeElement === last || !modalEl.contains(document.activeElement))) {event.preventDefault();first.focus();}
    }
  });

  // Drawer & Escape Listeners
  $('#menuToggle').addEventListener('click', () => {
    const open = !$('#sidebar').classList.contains('open');
    $('#sidebar').classList.toggle('open', open);
    $('#scrim').hidden = !open;
    $('#menuToggle').setAttribute('aria-expanded', String(open));
  });
  $('#scrim').addEventListener('click', () => {
    $('#sidebar').classList.remove('open');
    $('#scrim').hidden = true;
    $('#menuToggle').setAttribute('aria-expanded', 'false');
  });
  $('#modalRoot').addEventListener('click', e => { if (e.target === $('#modalRoot')) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      if (gateOpen) { gateOpen = false; render(); }
      $('#sidebar').classList.remove('open');
      $('#scrim').hidden = true;
      $('#menuToggle').setAttribute('aria-expanded', 'false');
    }
  });

  // Expose global runtime context for Executive 9-Module Review Hub & External Workspaces
  window.PRODUCTS_9 = PRODUCTS_9;
  window.db = db;
  window.save = save;
  window.notify = notify;
  window.modal = modal;
  window.closeModal = closeModal;
  window.render = render;
  window.currentProduct = currentProduct;

  render();
})();
