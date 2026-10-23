/* SCI BLUE OCEAN | Hotel OS v2.0 (Odoo Architecture Reverse-Engineered)
 * Full Hospitality ERP: hotel.folio, hotel.room, hotel.service, hotel.maintenance, hotel.night.audit
 * Open Source & local interactive prototype based on OCA/vertical-hotel & Cybrosys Hotel ERP
 */
(() => {
  'use strict';
  const STORAGE_KEY = 'sbo_hotel_os_odoo_v2';

  // 1. Odoo Security Groups & Role Hierarchy (ir.model.access.csv)
  const roles = {
    direction: {
      odooId: 'hotel.group_hotel_manager',
      fr: 'Direction générale (Manager)',
      en: 'General Manager',
      views: ['overview','rooms','bookings','folios','services','calendar','guests','housekeeping','maintenance','operations','audit','reports','settings'],
      actions: ['booking','checkin','room','guest','payment','folio_charge','folio_close','task','maintenance','audit_run','ops','export','reset']
    },
    reception: {
      odooId: 'hotel.group_hotel_user',
      fr: 'Réception (Front Desk)',
      en: 'Front Desk Clerk',
      views: ['overview','rooms','bookings','folios','services','calendar','guests','housekeeping'],
      actions: ['booking','checkin','room','guest','payment','folio_charge']
    },
    housekeeping: {
      odooId: 'hotel.group_hotel_housekeeping',
      fr: 'Gouvernante (Housekeeping)',
      en: 'Housekeeping',
      views: ['overview','rooms','calendar','housekeeping','maintenance'],
      actions: ['room','task','maintenance']
    },
    service: {
      odooId: 'hotel.group_hotel_service',
      fr: 'Services & Restauration (POS)',
      en: 'F&B and Room Service',
      views: ['overview','rooms','folios','services'],
      actions: ['folio_charge']
    },
    finance: {
      odooId: 'hotel.group_hotel_accountant',
      fr: 'Comptabilité & Audit (Finance)',
      en: 'Accountant & Night Auditor',
      views: ['overview','bookings','folios','calendar','audit','reports'],
      actions: ['payment','folio_close','audit_run','export']
    }
  };

  // 2. Odoo Navigation Architecture (hotel, hotel_reservation, hotel_restaurant, hotel_housekeeping)
  const navigation = [
    { id:'overview', icon:'dashboard', group:0, fr:"Tableau de bord", en:'Dashboard', descFr:'Indicateurs clés, ADR, RevPAR et état opérationnel en temps réel.', descEn:'Core KPIs, ADR, RevPAR and real-time operations.' },
    { id:'rooms', icon:'bed', group:0, fr:'Chambres & Rack', en:'Room Rack Matrix', descFr:'Plan de chambre par étage, commodités et statut en direct.', descEn:'Floor rack matrix, room amenities and live statuses.' },
    { id:'bookings', icon:'book', group:0, fr:'Réservations', en:'Reservations', descFr:'Gestion des séjours et pipeline de validation Odoo.', descEn:'Stay management and Odoo workflow pipeline.' },
    { id:'folios', icon:'fileText', group:0, fr:'Folios & Facturation', en:'Guest Folios', descFr:'Ledger financier centralisé (chambre, restauration, blanchisserie).', descEn:'Centralized guest billing folio (room, F&B, laundry).' },
    { id:'services', icon:'utensils', group:1, fr:'Services & Room Service', en:'POS & Services', descFr:'Carte restauration, blanchisserie, spa & imputation directe au folio.', descEn:'F&B menu, laundry, spa & direct folio charge posting.' },
    { id:'calendar', icon:'calendar', group:1, fr:'Calendrier / Planning', en:'Calendar Board', descFr:'Vue mensuelle de l’occupation et des séjours prévus.', descEn:'Monthly occupancy and scheduled reservation planning.' },
    { id:'guests', icon:'users', group:1, fr:'Fichier Clients (CRM)', en:'Guest Directory', descFr:'Profils clients, historique des dépenses et statut VIP.', descEn:'Guest profiles, stay history and VIP status.' },
    { id:'housekeeping', icon:'sparkles', group:1, fr:'Gouvernante & Linge', en:'Housekeeping', descFr:'Cycle de nettoyage (Sale, En cours, Inspectée, Prête).', descEn:'Turnover cleaning cycle (Dirty, In Progress, Inspected, Ready).' },
    { id:'maintenance', icon:'wrench', group:1, fr:'Maintenance & Pannes', en:'Maintenance', descFr:'Gestion des ordres de réparation et blocage des chambres.', descEn:'Repair orders and room out-of-order blocks.' },
    { id:'operations', icon:'settings', group:1, fr:'Exploitation & Utilités', en:'Facilities & Ops', descFr:'Groupes électrogènes, eau, sécurité et réseau.', descEn:'Generators, water reserves, security and connectivity.' },
    { id:'audit', icon:'moon', group:2, fr:'Clôture de Nuit (Night Audit)', en:'Night Audit Station', descFr:'Processus de clôture journalière, calcul ADR & RevPAR Odoo.', descEn:'End-of-day revenue reconciliation, ADR & RevPAR engine.' },
    { id:'reports', icon:'chart', group:2, fr:'Rapports & Audit Logs', en:'Reports & Audit Trail', descFr:'Analyses financières, journal des opérations et exports.', descEn:'Financial analytics, audit logs and raw data export.' },
    { id:'settings', icon:'sliders', group:2, fr:'Sécurité Odoo & Système', en:'Odoo Security & Demo', descFr:'Matrice des droits ir.model.access et données de démonstration.', descEn:'ir.model.access rights matrix and demo dataset.' }
  ];

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

  // 3. Odoo Standard Services Catalog (hotel.service & hotel.restaurant)
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
    { id:'SRV-10', cat:'service', nameFr:'Lit d’appoint supplémentaire / nuit', nameEn:'Extra Bed & Amenities / night', price:18000, icon:'bed' }
  ];

  // 4. Seed Database according to Odoo Hotel ERP Schema
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
      notes: i % 3 === 0 ? 'Exige étage supérieur & vue océan' : '',
      created: t
    }));

    // 24 Rooms with Floors & Amenities
    const rooms = Array.from({length:24}, (_, i) => {
      const floor = Math.floor(i / 8); // 0 = RDC, 1 = 1er Étage, 2 = 2ème Étage
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

      return {
        id: String(num),
        type,
        floor: floor === 0 ? 'RDC' : `${floor}e`,
        rate,
        amenities,
        status: 'available'
      };
    });

    const bookings = [];
    const folios = [];

    // Create 16 initial bookings and their linked Odoo Folios
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

      // Generate Folio Lines (Room rent + Extra Odoo Services)
      const folioLines = [
        {
          id: `LN-${String(i+1)}01`,
          date: arrival,
          category: 'room',
          desc: `Hébergement ${room.type} (Ch. ${room.id}) · ${nights} nuits`,
          qty: nights,
          unitPrice: room.rate,
          total: roomCost
        }
      ];

      // Add restaurant & laundry charges to live and completed folios
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
        channel: ['Direct Hôtel', 'WhatsApp AI Concierge', 'Booking.com', 'Corporate Travel'][i % 4],
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

    rooms[17].status = 'cleaning';
    rooms[18].status = 'inspected';
    rooms[19].status = 'maintenance';

    const tasks = [
      { id:'TSK-01', roomId:rooms[17].id, label:'Nettoyage approfondi après départ', status:'pending', priority:'high' },
      { id:'TSK-02', roomId:rooms[18].id, label:'Inspection finale gouvernante chambre VIP', status:'done', priority:'normal' },
      { id:'TSK-03', roomId:rooms[7].id, label:'Réassort minibar et serviettes', status:'pending', priority:'normal' }
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
      version: 2,
      rooms,
      bookings,
      guests,
      folios,
      services: DEFAULT_SERVICES,
      tasks,
      maintenance: maintenanceTickets,
      auditHistory,
      systems,
      history: [],
      generatedAt: t
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.version === 2 && Array.isArray(d.rooms) && Array.isArray(d.folios)) return d;
      }
    } catch (e) {
      console.warn('Demo storage unavailable:', e);
    }
    return demoSeed();
  }

  let db = load();
  let role = 'direction';
  let lang = 'fr';
  let view = 'overview';
  let filter = '';
  let roomFilter = 'all';
  let bookingFilter = 'all';
  let folioFilter = 'all';
  let floorFilter = 'all';
  let selectedDate = '';
  let monthCursor = todayISO().slice(0,7);
  let activeFolioId = '';
  let vatOn = false;

  const $ = s => document.querySelector(s);
  const can = perm => roles[role].actions.includes(perm);
  const canView = id => roles[role].views.includes(id);
  const tr = (fr, en) => lang === 'fr' ? fr : en;

  // Odoo Folio & Entity Helpers
  const guestFor = id => db.guests.find(g => g.id === id) || { name: tr('Client inconnu','Unknown guest'), phone:'—', email:'' };
  const roomFor = id => db.rooms.find(r => r.id === id);
  const bookingFor = id => db.bookings.find(b => b.id === id);
  const folioFor = id => db.folios.find(f => f.id === id);
  const folioForBooking = bId => db.folios.find(f => f.bookingId === bId);

  // Financial calculations from Folio lines
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch(e) {
      notify(tr('Stockage local indisponible.','Browser storage unavailable.'), true);
    }
    db.history.unshift({ when: new Date().toISOString(), role, action, meta: String(meta).slice(0, 110) });
    db.history = db.history.slice(0, 80);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch(e){}
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

  // 5. Odoo Hospitality Metrics: ADR, RevPAR, Occupancy
  function hospitalityMetrics() {
    const occupiedRooms = db.rooms.filter(r => r.status === 'occupied').length;
    const totalRooms = db.rooms.length;
    const occupancyRate = Math.round((occupiedRooms / totalRooms) * 100);

    const activeFolios = db.folios.filter(f => f.status === 'open');
    let totalRoomRevenue = 0;
    let totalServiceRevenue = 0;
    let totalPaid = 0;

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

  function renderNav() {
    let prev = -1;
    $('#mainNav').innerHTML = roles[role].views.map(id => {
      const x = navigation.find(v => v.id === id);
      if (!x) return '';
      const groupHeader = x.group !== prev ? `<div class="nav-section">${[tr('PILOTAGE ODOO','ODOO PILOTAGE'), tr('EXPLOITATION & SERVICES','OPERATIONS & SERVICES'), tr('FINANCE & CONFIGURATION','FINANCE & SETTINGS')][x.group]}</div>` : '';
      prev = x.group;
      const badge = id === 'bookings' ? db.bookings.filter(b => b.status === 'confirmed').length : id === 'folios' ? db.folios.filter(f => f.status === 'open').length : id === 'maintenance' ? db.maintenance.filter(m => m.stage !== 'resolved').length : 0;
      return `${groupHeader}<button type="button" class="nav-item ${view===id?'active':''}" data-view="${id}" ${view===id?'aria-current="page"':''}>${icon(x.icon)}<span>${tr(x.fr,x.en)}</span>${badge > 0 ? `<span class="nav-badge">${badge}</span>` : ''}</button>`;
    }).join('');
  }

  function render() {
    if (!canView(view)) view = 'overview';
    const item = navigation.find(x => x.id === view) || navigation[0];
    document.documentElement.lang = lang;
    $('#roleSelect').value = role;
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $('#crumbTitle').textContent = tr(item.fr, item.en);
    $('#pageTitle').innerHTML = `${esc(tr(item.fr, item.en))}<span class="heading-dot">.</span>`;
    $('#pageDescription').textContent = tr(item.descFr, item.descEn);
    $('#pageEyebrow').textContent = `SCI BLUE OCEAN / ${roles[role].odooId.toUpperCase()}`;
    $('#todayPill').textContent = dateLabel(todayISO(), lang, true);

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const dict = {
        workspace: ["Espace de travail", 'Workspace'],
        sandbox: ["Environnement Odoo ERP Reverse", 'Odoo ERP Environment'],
        sandboxDesc: ["Architecture hôtelière Odoo · Démonstration", 'Odoo hospitality architecture · Demo'],
        role: ["Rôle Odoo", 'Odoo Role'],
        footer: ["Prototype hôtelier inspiré de vertical-hotel & Cybrosys", 'Hospitality prototype inspired by vertical-hotel & Cybrosys']
      };
      if (dict[el.dataset.i18n]) el.textContent = dict[el.dataset.i18n][lang === 'fr' ? 0 : 1];
    });

    renderNav();
    $('#headingActions').innerHTML = headingActions();

    const viewMap = {
      overview: renderOverview,
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
    switch (view) {
      case 'overview':
        return can('booking') ? btn('new-booking', `${icon('plus')}${tr('Nouvelle réservation Odoo','New Odoo booking')}`, 'primary') : '';
      case 'rooms':
        return can('room') ? btn('room-quick-filter', `${icon('bed')}${tr('Rafraîchir le rack','Refresh rack')}`) : '';
      case 'bookings':
        return can('booking') ? btn('new-booking', `${icon('plus')}${tr('Créer une réservation','Create reservation')}`, 'primary') : '';
      case 'folios':
        return can('folio_charge') ? btn('open-service-charge', `${icon('plus')}${tr('Ajouter prestation au Folio','Add folio charge')}`, 'primary') : '';
      case 'services':
        return can('folio_charge') ? btn('open-service-charge', `${icon('utensils')}${tr('Commander & imputer','Order & charge')}`, 'primary') : '';
      case 'guests':
        return can('guest') ? btn('new-guest', `${icon('plus')}${tr('Nouveau client','New guest')}`, 'primary') : '';
      case 'maintenance':
        return can('maintenance') ? btn('new-maintenance', `${icon('wrench')}${tr('Signaler une panne','Report issue')}`, 'primary') : '';
      case 'audit':
        return can('audit_run') ? btn('run-night-audit', `${icon('moon')}${tr('Exécuter le Night Audit','Run Night Audit')}`, 'primary') : '';
      case 'reports':
        return can('export') ? btn('export-csv', `${icon('download')} CSV Folios`) : '';
      default:
        return '';
    }
  }

  // --- VIEW 1: OVERVIEW (ODOO HOSPITALITY METRICS) ---
  function renderOverview() {
    const m = hospitalityMetrics();
    const active = db.bookings.filter(b => b.status === 'checked-in' || b.status === 'confirmed').sort((a,b) => a.arrival.localeCompare(b.arrival)).slice(0, 6);

    const cards = [
      stat(tr('Taux d’occupation','Occupancy Rate'), `${m.occupancyRate}%`, `${m.occupiedRooms} / ${m.totalRooms} ${tr('chambres occupées','rooms occupied')}`, 'bed'),
      stat(tr('ADR (Tarif Moyen Journalier)','ADR (Avg Daily Rate)'), money(m.adr), tr('Revenu moyen par chambre louée','Average rate per occupied room'), 'chart'),
      stat(tr('RevPAR (Revenu / Ch. Dispo)','RevPAR (Rev Per Avail Room)'), money(m.revPar), tr('Performance globale du parc','Overall property yield'), 'receipt'),
      stat(tr('Encaissements cumulés','Total Collections'), money(m.totalPaid), tr('Paiements enregistrés sur folios','Payments posted to folios'), 'wallet')
    ].join('');

    const chartPoints = [45, 52, 48, 62, 65, 58, m.occupancyRate].map((v, i) => `${28 + i * 59},${144 - v * 1.15}`).join(' ');
    const chart = `<svg viewBox="0 0 420 168" class="overview-chart" role="img" aria-label="Tendance 7 jours"><line x1="20" x2="408" y1="40" y2="40" class="chart-grids"/><line x1="20" x2="408" y1="88" y2="88" class="chart-grids"/><line x1="20" x2="408" y1="137" y2="137" class="chart-grids"/><defs><linearGradient id="curveFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#56b6a7" stop-opacity=".35"/><stop offset="100%" stop-color="#56b6a7" stop-opacity="0"/></linearGradient></defs><polygon points="28,145 ${chartPoints} 382,145" fill="url(#curveFill)"/><polyline points="${chartPoints}" fill="none" stroke="#2b8478" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${[45, 52, 48, 62, 65, 58, m.occupancyRate].map((v, i) => `<circle cx="${28 + i * 59}" cy="${144 - v * 1.15}" r="3" fill="#fff" stroke="#1d5c53" stroke-width="2"/>`).join('')}</svg>`;

    const recentRows = active.map(b => {
      const f = folioFor(b.folioId);
      const fm = folioMetrics(f);
      return `<tr><td><strong class="mono">${esc(b.id)}</strong><div class="soft">${esc(b.channel)}</div></td><td><strong>${esc(guestFor(b.guestId).name)}</strong></td><td><span class="mono">${esc(b.roomId)}</span></td><td>${esc(dateLabel(b.arrival, lang))}</td><td>${statusChip(b.status)}</td><td><span class="mono">${money(fm.totalGross)}</span></td><td>${btn('booking-detail', tr('Gérer','Manage'), 'outline btn-small', `data-id="${esc(b.id)}"`)}</td></tr>`;
    }).join('');

    return `
      <div class="overview-intro">
        <div>
          <div class="overline">SCI BLUE OCEAN · HOTEL OS v2.0 (ARCHITECTURE ODOO ERP)</div>
          <h2>${tr('Gestion Hôtelière & Folios Intégrés','Hospitality Operations & Integrated Folios')}</h2>
          <p>${tr('Plateforme complète rétro-ingéniée depuis les modules Odoo hotel, hotel_reservation et hotel_folio.','Full PMS workflow reverse-engineered from Odoo hotel, reservation and folio models.')}</p>
        </div>
        ${can('booking') ? btn('new-booking', `${icon('plus')}${tr('Créer Réservation','New Reservation')}`) : ''}
      </div>

      <div class="stats-grid">${cards}</div>

      <div class="cols-2">
        <section class="panel panel-pad">
          <div class="panel-heading">
            <div>
              <h2 class="panel-title">${tr('Occupation & Performance Hôtelière','Occupancy & Hotel Performance')}</h2>
              <p class="panel-sub">${tr('ADR actuel : ','Current ADR: ')}<b>${money(m.adr)}</b> · RevPAR : <b>${money(m.revPar)}</b></p>
            </div>
            <span class="mini-legend"><i class="legend-dot"></i> ${tr('Occupation %','Occupancy %')}</span>
          </div>
          ${chart}
          <div class="meter-grid">
            <div class="meter-item">
              <div class="meter-head"><span>${tr('Chambres occupées','Occupied')}</span><b>${m.occupancyRate}%</b></div>
              <div class="meter-track"><div class="meter-fill" style="width:${m.occupancyRate}%"></div></div>
            </div>
            <div class="meter-item">
              <div class="meter-head"><span>${tr('Disponibilité immédiate','Available')}</span><b>${m.availableRooms} / ${m.totalRooms}</b></div>
              <div class="meter-track"><div class="meter-fill" style="width:${Math.round((m.availableRooms/m.totalRooms)*100)}%;background:#a8d5cf"></div></div>
            </div>
          </div>
        </section>

        ${panel(tr('Activités Immédiates & Alertes','Operational Pulse & Alerts'), tr('Arrivées, départs et maintenance Odoo','Today arrivals, departures & tickets'), `
          <div class="task-list">
            <div class="task-card">
              <div class="task-info"><strong>${m.arrivalsToday} ${tr('Arrivée(s) attendue(s) aujourd’hui','Expected arrival(s) today')}</strong><p>${tr('Vérifier l’état de préparation des chambres','Verify room readiness before guest check-in')}</p></div>
              ${btn('bookings', tr('Voir','View'), 'outline btn-small')}
            </div>
            <div class="task-card">
              <div class="task-info"><strong>${m.departuresToday} ${tr('Départ(s) à clôturer','Departure(s) to process')}</strong><p>${tr('Contrôle du solde Folio et bascule en ménage','Check folio balance and send to housekeeping')}</p></div>
              ${btn('folios', tr('Folios','Folios'), 'outline btn-small')}
            </div>
            <div class="task-card">
              <div class="task-info"><strong>${db.maintenance.filter(x => x.stage !== 'resolved').length} ${tr('Intervention(s) de maintenance','Open maintenance order(s)')}</strong><p>${tr('Suivi des pannes et blocages de chambres','Track open repair orders and out-of-order blocks')}</p></div>
              ${btn('maintenance', tr('Tickets','Tickets'), 'outline btn-small')}
            </div>
          </div>
        `)}
      </div>

      <div class="section-gap">
        ${panel(tr('Séjours Actifs & Réservations Récentes','Active In-House Stays & Recent Bookings'), tr('Synchronisé avec les folios financiers','Synchronized with real-time guest folios'), `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>${tr('Réservation','Reservation')}</th><th>${tr('Client','Guest')}</th><th>${tr('Chambre','Room')}</th><th>${tr('Arrivée','Arrival')}</th><th>${tr('Statut','Status')}</th><th>${tr('Total Folio','Folio Total')}</th><th></th></tr></thead>
              <tbody>${recentRows}</tbody>
            </table>
          </div>
        `, `<button class="panel-link" data-action="bookings">${tr('Voir toutes les réservations','See all bookings')} →</button>`)}
      </div>
    `;
  }

  // --- VIEW 2: ROOM RACK MATRIX (ODOO HOTEL.ROOM & HOTEL.FLOOR) ---
  function renderRooms() {
    const floors = ['all', 'RDC', '1e', '2e'];
    const floorPills = floors.map(f => `<button class="pill ${floorFilter===f?'active':''}" data-floor-filter="${f}">${f==='all'?tr('Tous les étages','All floors'):tr(`Étage ${f}`,`Floor ${f}`)}</button>`).join('');

    const statuses = ['all','available','occupied','dirty','cleaning','inspected','maintenance'];
    const statusPills = statuses.map(s => `<button class="pill ${roomFilter===s?'active':''}" data-room-filter="${s}">${s==='all'?tr('Tous les états','All states'):statusLabel(s)} <b>${s==='all'?db.rooms.length:db.rooms.filter(r=>r.status===s).length}</b></button>`).join('');

    const matched = db.rooms.filter(r => (floorFilter === 'all' || r.floor === floorFilter) && (roomFilter === 'all' || r.status === roomFilter) && (`${r.id} ${r.type} ${r.amenities.join(' ')}`.toLowerCase().includes(filter.toLowerCase())));

    // Group by floor for the matrix
    const byFloors = {};
    matched.forEach(r => {
      byFloors[r.floor] = byFloors[r.floor] || [];
      byFloors[r.floor].push(r);
    });

    return `
      <div class="toolbar">
        <div class="toolbar-group">
          <div class="checklist">${floorPills}</div>
          <div class="checklist">${statusPills}</div>
        </div>
        <label class="search-field">${icon('search')}<input id="searchInput" data-filter placeholder="${tr('Chercher chambre, type, commodité...','Search room, type, amenity...')}" value="${esc(filter)}" /></label>
      </div>

      ${Object.keys(byFloors).sort().map(fKey => `
        <div class="floor-section">
          <div class="floor-header">${tr(`Étage ${fKey} · ${byFloors[fKey].length} chambres`,`Floor ${fKey} · ${byFloors[fKey].length} rooms`)}</div>
          <div class="rooms-grid">
            ${byFloors[fKey].map(r => `
              <article class="room-card">
                <div class="room-head">
                  <div>
                    <div class="room-number mono">${esc(r.id)}</div>
                    <div class="room-type">${esc(r.type)} · Étage ${esc(r.floor)}</div>
                  </div>
                  ${statusChip(r.status)}
                </div>
                <div>
                  <div class="amenity-chips">
                    ${r.amenities.map(a => `<span class="amenity-chip">${esc(a)}</span>`).join('')}
                  </div>
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

  // --- VIEW 3: BOOKINGS (ODOO HOTEL.RESERVATION) ---
  function renderBookings() {
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
        ${matched.length === 0 ? empty(tr('Aucune réservation trouvée.','No bookings found.')) : ''}
      </section>
    `;
  }

  // --- VIEW 4: ODOO FOLIOS & FACTURATION (HOTEL.FOLIO) ---
  function renderFolios() {
    const matched = db.folios.filter(f => (folioFilter === 'all' || f.status === folioFilter) && (`${f.id} ${guestFor(f.guestId).name} ${f.roomId} ${f.bookingId}`.toLowerCase().includes(filter.toLowerCase()))).sort((a,b) => b.id.localeCompare(a.id));

    let sumRoom = 0, sumService = 0, sumGross = 0, sumPaid = 0, sumBal = 0;
    matched.forEach(f => {
      const m = folioMetrics(f);
      sumRoom += m.roomTotal;
      sumService += m.serviceTotal;
      sumGross += m.totalGross;
      sumPaid += m.totalPaid;
      sumBal += m.balance;
    });

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
                      ${can('payment') && fm.balance > 0 ? btn('folio-payment-quick', `${icon('wallet')}`, 'outline btn-small', `data-id="${esc(f.id)}" title="${tr('Encaisser','Record payment')}"`) : ''}
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        ${matched.length === 0 ? empty(tr('Aucun folio trouvé.','No folios found.')) : ''}
      </section>
    `;
  }

  // --- VIEW 5: SERVICES & POS CATALOG (ODOO HOTEL.SERVICE & RESTAURANT) ---
  function renderServices() {
    return `
      <div class="overview-intro" style="margin-bottom:20px">
        <div>
          <div class="overline">ODOO HOTEL.SERVICE & RESTAURANT POINT OF SALE</div>
          <h2>${tr('Carte des Prestations & Facturation Directe au Folio','Services Menu & Direct Folio Imputation')}</h2>
          <p>${tr('Commandez un plat, une boisson, un pressing ou un transport et imputez-le instantanément sur le folio d’un client sur place.','Order dining, laundry or concierge services and instantly post charges to in-house guest folios.')}</p>
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
            <div>
              ${can('folio_charge') ? `
                <button type="button" class="btn btn-outline btn-small" style="width:100%" data-action="quick-post-service" data-srv-id="${esc(s.id)}">
                  ${icon('plus')}${tr('Imputer sur une chambre','Post to Room Folio')}
                </button>
              ` : `<span class="hint">${tr('Lecture seule','Read-only')}</span>`}
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  // --- VIEW 6: CALENDAR BOARD ---
  function renderCalendar() {
    const [y, m] = monthCursor.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const offset = (first.getUTCDay() + 6) % 7;
    const weekday = lang === 'fr' ? ['LUN','MAR','MER','JEU','VEN','SAM','DIM'] : ['MON','TUE','WED','THU','FRI','SAT','SUN'];

    const cells = Array.from({length: Math.ceil((last + offset) / 7) * 7}, (_, i) => {
      const d = i - offset + 1;
      if (d < 1 || d > last) return '<div class="cal-day muted" aria-hidden="true"></div>';
      const iso = `${monthCursor}-${String(d).padStart(2,'0')}`;
      const items = db.bookings.filter(b => b.status !== 'cancelled' && b.arrival <= iso && b.departure > iso);
      return `<button class="cal-day ${iso === todayISO() ? 'today' : ''}" data-cal-date="${iso}">
        <span class="cal-num">${d}</span>
        <div class="cal-chips">
          ${items.slice(0, 2).map(b => `<span class="cal-chip ${b.status==='checked-in'?'hotel':''}">${esc(b.roomId)} · ${esc(guestFor(b.guestId).name)}</span>`).join('')}
          ${items.length > 2 ? `<span class="cal-chip more">+${items.length-2}</span>` : ''}
        </div>
      </button>`;
    }).join('');

    const monthTitle = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { year:'numeric', month:'long', timeZone:'UTC' }).format(first);

    return `
      <section class="panel calendar-panel">
        <div class="calendar-top">
          <div><h2 class="calendar-month">${esc(monthTitle)}</h2><p class="panel-sub">${tr('Planning des chambres et séjours Odoo','Odoo room allocation and reservation schedule')}</p></div>
          <div class="toolbar-group">
            ${btn('month-prev', icon('chevronLeft'), 'outline btn-small')}
            ${btn('month-today', tr("Aujourd'hui",'Today'), 'outline btn-small')}
            ${btn('month-next', icon('chevronRight'), 'outline btn-small')}
          </div>
        </div>
        <div class="calendar-grid">
          ${weekday.map(w => `<span class="cal-dow">${w}</span>`).join('')}
          ${cells}
        </div>
      </section>
    `;
  }

  // --- VIEW 7: GUESTS (CRM) ---
  function renderGuests() {
    const matched = db.guests.filter(g => `${g.name} ${g.email} ${g.phone} ${g.notes}`.toLowerCase().includes(filter.toLowerCase()));
    return `
      <div class="toolbar">
        <p class="hint">${db.guests.length} ${tr('clients enregistrés dans la base Odoo','guests registered in Odoo CRM')}</p>
        <label class="search-field">${icon('search')}<input data-filter id="searchInput" value="${esc(filter)}" placeholder="${tr('Rechercher un client, téléphone...','Search guest, phone...')}"/></label>
      </div>
      <div class="guest-grid">
        ${matched.map(g => {
          const guestBookings = db.bookings.filter(b => b.guestId === g.id && b.status !== 'cancelled');
          return `
            <article class="guest-card">
              <div class="inline-flex" style="justify-content:space-between;width:100%">
                <div class="guest-avatar">${esc(g.name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase())}</div>
                ${g.vip ? `<span class="pill active">VIP · PRESTIGE</span>` : ''}
              </div>
              <h3>${esc(g.name)}</h3>
              <p>${esc(g.phone)} · ${esc(g.email || '—')}</p>
              ${g.notes ? `<div class="quiet-box" style="margin:8px 0;padding:8px 10px;font-size:10px">${esc(g.notes)}</div>` : ''}
              <div class="guest-meta">
                <span>${tr('Séjours : ','Stays: ')}<b>${guestBookings.length}</b></span>
                <span class="mono">${esc(g.id)}</span>
              </div>
            </article>
          `;
        }).join('')}
      </div>
      ${matched.length === 0 ? empty(tr('Aucun profil client trouvé.','No guests found.')) : ''}
    `;
  }

  // --- VIEW 8: HOUSEKEEPING (ODOO HOTEL.HOUSEKEEPING) ---
  function renderHousekeeping() {
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

  // --- VIEW 9: MAINTENANCE (ODOO HOTEL.MAINTENANCE) ---
  function renderMaintenance() {
    const openTickets = db.maintenance.filter(m => m.stage !== 'resolved');
    return `
      <div class="stats-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        ${stat(tr('Pannes en cours','Active Tickets'), String(openTickets.length), tr('Affecte le parc hôtelier','Affects room inventory'), 'wrench')}
        ${stat(tr('Chambres bloquées','Blocked Rooms'), String(db.rooms.filter(r=>r.status==='maintenance').length), tr('Statut hors service Odoo','Out of order state in Odoo'), 'shield')}
        ${stat(tr('Incidents résolus','Resolved'), String(db.maintenance.filter(m=>m.stage==='resolved').length), tr('Historique de maintenance','Maintenance logbook'), 'check')}
      </div>

      ${panel(tr('Ordres de Travail & Maintenance Hôtelière','Hotel Maintenance Orders & Repair Pipeline'), tr('Lié directement à l’état de la chambre','Directly locks room inventory when urgent'), `
        <div class="task-list">
          ${db.maintenance.map(m => `
            <div class="task-card">
              <div class="task-info">
                <div class="inline-flex" style="gap:8px">
                  <strong class="mono">${esc(m.id)}</strong>
                  <span class="maint-badge ${m.priority==='urgent'?'maint-urgent':m.priority==='normal'?'maint-normal':'maint-low'}">${esc(m.priority.toUpperCase())}</span>
                  <strong>${tr('Chambre','Room')} ${esc(m.roomId)}</strong>
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

  // --- VIEW 10: OPERATIONS & UTILITIES ---
  function renderOperations() {
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

  // --- VIEW 11: NIGHT AUDIT STATION (ODOO HOTEL.NIGHT.AUDIT) ---
  function renderAudit() {
    const m = hospitalityMetrics();
    return `
      <div class="audit-box">
        <h3>${tr('Poste de Clôture de Nuit (Night Audit Odoo)','Odoo Night Audit & Day Closure Station')}</h3>
        <p>${tr('La clôture de nuit valide les nuitées échues, calcule les ratios ADR et RevPAR, impute les taxes locales et verrouille les transactions journalières dans le grand livre Odoo.','Night audit processes completed overnight stays, calculates property ADR/RevPAR yields, posts daily taxes, and reconciles cash/card accounts into the Odoo General Ledger.')}</p>

        <div class="audit-kpis">
          <div class="audit-kpi"><span>Taux d'occupation</span><strong>${m.occupancyRate}%</strong></div>
          <div class="audit-kpi"><span>ADR (Tarif Moyen)</span><strong>${money(m.adr)}</strong></div>
          <div class="audit-kpi"><span>RevPAR</span><strong>${money(m.revPar)}</strong></div>
          <div class="audit-kpi"><span>Revenu Journée</span><strong>${money(m.totalGross)}</strong></div>
        </div>

        <div style="margin-top:22px">
          ${can('audit_run') ? btn('run-night-audit-btn', `${icon('moon')}${tr('Lancer la procédure de Clôture de Nuit','Execute Night Audit Run')}`, 'primary') : `<span class="hint">${tr('Réservé à la Direction et au Night Auditor.','Restricted to Manager and Night Auditor.')}</span>`}
        </div>
      </div>

      ${panel(tr('Historique des Clôtures de Nuit Récentes','Recent Night Audit Certificates'), tr('Historique archivé dans le système Odoo','Audited records stored in system journal'), `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>${tr('Date de Clôture','Audit Date')}</th><th>${tr('Occupation','Occupancy')}</th><th>ADR</th><th>RevPAR</th><th>${tr('Hébergement','Rooms')}</th><th>${tr('Prestations','Services')}</th><th>${tr('Total Journée','Daily Total')}</th><th>${tr('Auditeur','Auditor')}</th></tr></thead>
            <tbody>
              ${db.auditHistory.map(a => `
                <tr>
                  <td><strong class="mono">${esc(a.date)}</strong></td>
                  <td>${a.occupancyRate}%</td>
                  <td class="mono">${money(a.adr)}</td>
                  <td class="mono">${money(a.revPar)}</td>
                  <td class="mono">${money(a.roomRevenue)}</td>
                  <td class="mono">${money(a.serviceRevenue)}</td>
                  <td class="mono"><strong>${money(a.totalDayRevenue)}</strong></td>
                  <td><span class="pill">${esc(a.auditor)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `)}
    `;
  }

  // --- VIEW 12: REPORTS & AUDIT TRAIL ---
  function renderReports() {
    const m = hospitalityMetrics();
    return `
      <div class="stats-grid">
        ${stat(tr('Chiffre d’Affaires Total','Gross Billed Total'), money(m.totalGross), tr('Hébergement + Services','Rooms + Services'), 'wallet')}
        ${stat(tr('Encaissements Enregistrés','Total Collections'), money(m.totalPaid), tr('Règlements reçus','Payments received'), 'check')}
        ${stat(tr('Créances Clients (Soldes)','Accounts Receivable'), money(m.balanceDue), tr('En cours sur folios actifs','Pending balances on folios'), 'receipt')}
        ${stat(tr('Taux Moyen d’Occupation','Average Occupancy'), `${m.occupancyRate}%`, tr('Capacité 24 chambres','24-room baseline'), 'bed')}
      </div>

      ${panel(tr('Journal des Événements & Audit Trail (Odoo SysLog)','System Action & Audit Log'), tr('Historique immuable des actions locales','Immutable chronological trail of user actions'), `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>${tr('Date / Heure','Date / Time')}</th><th>${tr('Rôle Odoo','Odoo Role')}</th><th>${tr('Action ERP','ERP Action')}</th><th>${tr('Détail / Référence','Target / Meta')}</th></tr></thead>
            <tbody>
              ${db.history.slice(0, 15).map(h => `
                <tr>
                  <td><span class="mono">${esc(new Date(h.when).toLocaleString(lang==='fr'?'fr-FR':'en-GB'))}</span></td>
                  <td><span class="pill">${esc(roles[h.role]?.[lang] || h.role)}</span></td>
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

  // --- VIEW 13: SETTINGS & ODOO SECURITY MATRIX ---
  function renderSettings() {
    return `
      <div class="cols-2 cols-even">
        ${panel(tr('Matrice des Droits Odoo (ir.model.access.csv)','Odoo Security Access Matrix (ir.model.access.csv)'), tr('Règles d’accès CRUD par groupe de sécurité','CRUD permissions mapped to security groups'), `
          <div class="table-wrap">
            <table class="odoo-matrix">
              <thead>
                <tr><th>${tr('Modèle Odoo','Odoo Model')}</th><th>Direction</th><th>Réception</th><th>Gouvernante</th><th>Services</th><th>Finance</th></tr>
              </thead>
              <tbody>
                <tr><td><strong>hotel.folio</strong></td><td>CRUD</td><td>CRU-</td><td>----</td><td>--U-</td><td>-RU-</td></tr>
                <tr><td><strong>hotel.reservation</strong></td><td>CRUD</td><td>CRUD</td><td>R---</td><td>----</td><td>R---</td></tr>
                <tr><td><strong>hotel.room</strong></td><td>CRUD</td><td>-RU-</td><td>-RU-</td><td>R---</td><td>R---</td></tr>
                <tr><td><strong>hotel.service</strong></td><td>CRUD</td><td>R---</td><td>----</td><td>-RU-</td><td>R---</td></tr>
                <tr><td><strong>hotel.maintenance</strong></td><td>CRUD</td><td>CRU-</td><td>CRUD</td><td>----</td><td>R---</td></tr>
                <tr><td><strong>hotel.night.audit</strong></td><td>CRUD</td><td>----</td><td>----</td><td>----</td><td>CRUD</td></tr>
              </tbody>
            </table>
          </div>
        `)}

        ${panel(tr('Gestion de la Base de Démonstration','Demo Database Management'), tr('Sauvegarde JSON et réinitialisation Odoo','JSON backup and factory reset'), `
          <div class="stack">
            <div class="task-card">
              <div class="task-info">
                <strong>${tr('Exporter les données Odoo (JSON)','Export Odoo Dataset (JSON)')}</strong>
                <p>${tr('Télécharger les folios, chambres, réservations et historique','Download full snapshot of folios, rooms and logs')}</p>
              </div>
              ${btn('export-json', `${icon('download')} JSON`, 'outline btn-small')}
            </div>
            <div class="task-card">
              <div class="task-info">
                <strong>${tr('Réinitialisation Usine Odoo','Factory Reset Demo')}</strong>
                <p>${tr('Restaurer le jeu d’essai complet avec folios et chambres fraîches','Re-seed complete dataset with fresh demo records')}</p>
              </div>
              ${btn('reset-data', tr('Réinitialiser','Reset Database'), 'danger btn-small')}
            </div>
          </div>
        `)}
      </div>
    `;
  }

  // --- MODALS & ODOO WORKFLOWS ---
  function modal(title, body) {
    const root = $('#modalRoot');
    root.hidden = false;
    root.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-header"><h2 id="modalTitle">${title}</h2><button class="modal-close" type="button" data-action="close-modal" aria-label="Close">×</button></div>${body}</div>`;
    root.querySelector('.modal-close')?.focus();
  }

  function closeModal() {
    $('#modalRoot').hidden = true;
    $('#modalRoot').innerHTML = '';
  }

  function field(name, label, type='text', value='', extra='') {
    return `<div class="form-field"><label for="field-${esc(name)}">${label}</label><input id="field-${esc(name)}" name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${extra}/></div>`;
  }

  function formActions(label) {
    return `<div class="form-actions"><button class="btn btn-outline" data-action="close-modal" type="button">${tr('Annuler','Cancel')}</button><button class="btn btn-primary" type="submit">${label}</button></div>`;
  }

  // Modal: New Booking (Generates Reservation + Hotel Folio)
  function newBookingModal() {
    if (!can('booking')) return denied();
    const a = addDays(todayISO(), 1);
    const b = addDays(todayISO(), 3);
    modal(tr('Créer une Réservation & Folio Odoo','New Odoo Reservation & Folio'), `
      <form data-form="booking">
        <div class="form-grid">
          ${field('guest', tr('Nom du client','Guest name'), 'text', '', 'required minlength="2" maxlength="80" placeholder="Ex: Jean Dupont"')}
          ${field('phone', tr('Téléphone / WhatsApp','Phone / WhatsApp'), 'text', '+237 ', 'required')}
          <div class="form-field">
            <label for="booking-room">${tr('Chambre disponible','Select Available Room')}</label>
            <select id="booking-room" name="roomId" required>
              ${db.rooms.filter(r => r.status !== 'maintenance').map(r => `<option value="${esc(r.id)}">${esc(r.id)} — ${esc(r.type)} (${esc(r.floor)}) · ${money(r.rate)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label for="booking-channel">${tr('Canal de provenance','Source Channel')}</label>
            <select id="booking-channel" name="channel">
              <option>Direct Hôtel (Réception)</option>
              <option>WhatsApp AI Concierge</option>
              <option>Booking.com</option>
              <option>Agence de Voyage / Entreprise</option>
            </select>
          </div>
          ${field('arrival', tr('Date d’arrivée','Arrival Date'), 'date', a, 'required')}
          ${field('departure', tr('Date de départ','Departure Date'), 'date', b, 'required')}
          ${field('paid', tr('Acompte initial (FCFA)','Initial Deposit (FCFA)'), 'number', '0', 'min="0" step="1000"')}
          <div class="form-field">
            <label>${tr('Mode d’encaissement acompte','Deposit Payment Method')}</label>
            <select name="payMethod">
              <option>Espèces (Cash)</option>
              <option>Carte Bancaire</option>
              <option>Orange Money</option>
              <option>MTN MoMo</option>
            </select>
          </div>
        </div>
        <p class="form-note">${tr('Cette opération génère simultanément la réservation Odoo et ouvre un Folio financier associé.','This creates the Odoo reservation record and opens an associated guest folio.')}</p>
        ${formActions(tr('Enregistrer et ouvrir le Folio','Save & Open Folio'))}
      </form>
    `);
  }

  // Modal: Folio Detail & Ledger Inspector (The Core Odoo Folio Hub!)
  function openFolioModal(id) {
    const f = folioFor(id);
    if (!f) return notify(tr('Folio introuvable','Folio not found'), true);
    activeFolioId = f.id;
    const b = bookingFor(f.bookingId);
    const g = guestFor(f.guestId);
    const fm = folioMetrics(f);

    modal(`${tr('Folio Client','Guest Folio')} ${esc(f.id)}`, `
      <div class="stack">
        <div class="statusbar">
          <div class="statusbar-step ${f.status==='open'?'done':'done'}">${tr('1. Brouillon','1. Draft')}</div>
          <div class="statusbar-step ${f.status==='open'?'active':'done'}">${tr('2. Séjour Actif (En cours)','2. In-House (Open)')}</div>
          <div class="statusbar-step ${f.status==='closed'?'active':''}">${tr('3. Clôturé / Facturé','3. Closed / Invoiced')}</div>
        </div>

        <div class="task-card">
          <div class="task-info">
            <strong>${esc(g.name)}</strong>
            <p>${tr('Chambre','Room')} ${esc(f.roomId)} · ${b ? `${dateLabel(b.arrival,lang)} → ${dateLabel(b.departure,lang)}` : '—'}</p>
          </div>
          ${statusChip(f.status)}
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>${tr('Date','Date')}</th><th>${tr('Prestation / Article','Service / Item')}</th><th>${tr('Qté','Qty')}</th><th>${tr('Prix Unit.','Unit')}</th><th>${tr('Total','Total')}</th></tr>
            </thead>
            <tbody>
              ${f.lines.map(l => `
                <tr>
                  <td><span class="mono">${esc(l.date)}</span></td>
                  <td><span class="folio-line-cat ${esc(l.category)}">${esc(l.category)}</span> <strong>${esc(l.desc)}</strong></td>
                  <td>${l.qty}</td>
                  <td class="mono">${money(l.unitPrice)}</td>
                  <td class="mono"><strong>${money(l.total)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="bill-summary" style="margin:12px 0">
          <div><span>${tr('Sous-total','Subtotal')}</span><strong class="mono">${money(fm.subtotal)}</strong></div>
          <div><span>${tr('Total Encaissé','Total Paid')}</span><strong class="mono positive">${money(fm.totalPaid)}</strong></div>
          <div><span>${tr('Solde Dû','Balance Due')}</span><strong class="mono ${fm.balance>0?'negative':'positive'}">${money(fm.balance)}</strong></div>
        </div>

        <div class="form-actions">
          ${can('folio_charge') && f.status === 'open' ? btn('add-charge-to-folio', `${icon('plus')}${tr('Ajouter Prestation','Add Charge')}`, 'outline', `data-folio="${esc(f.id)}"`) : ''}
          ${can('payment') && fm.balance > 0 ? btn('folio-payment-quick', `${icon('wallet')}${tr('Encaisser Règlement','Record Payment')}`, 'primary', `data-id="${esc(f.id)}"`) : ''}
          ${can('folio_close') && f.status === 'open' && fm.balance === 0 ? btn('close-folio-btn', `${icon('check')}${tr('Clôturer le Folio','Close Folio')}`, 'primary', `data-folio="${esc(f.id)}"`) : ''}
          ${btn('print-folio-invoice', `${icon('receipt')}${tr('Facture Folio PDF','Folio Invoice PDF')}`, 'outline', `data-id="${esc(f.id)}"`)}
        </div>
      </div>
    `);
  }

  // Modal: Add Charge to Folio (Restaurant, Laundry, Concierge)
  function addChargeModal(folioId) {
    if (!can('folio_charge')) return denied();
    const f = folioFor(folioId) || db.folios.find(x => x.status === 'open');
    if (!f) return notify(tr('Aucun folio actif disponible','No open folio available'), true);

    modal(tr('Imputer une Prestation au Folio Odoo','Post Service Charge to Folio'), `
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
            <label>${tr('Article / Prestation (Catalogue Odoo)','Service Catalog Item')}</label>
            <select id="charge-service-select" name="serviceId">
              ${db.services.map(s => `<option value="${esc(s.id)}" data-price="${s.price}" data-cat="${s.cat}">${esc(lang==='fr'?s.nameFr:s.nameEn)} — ${money(s.price)}</option>`).join('')}
              <option value="CUSTOM">${tr('Autre prestation personnalisée...','Custom expense...')}</option>
            </select>
          </div>
          ${field('customDesc', tr('Description si personnalisée','Custom description if any'), 'text', '', 'placeholder="Ex: Minibar extra"')}
          ${field('qty', tr('Quantité','Quantity'), 'number', '1', 'min="1" required')}
          ${field('price', tr('Prix unitaire (FCFA)','Unit price (FCFA)'), 'number', String(db.services[0].price), 'min="0" required')}
        </div>
        <p class="form-note">${tr('Cette prestation sera immédiatement ajoutée au grand livre du client.','This charge will be instantly appended to the guest folio ledger.')}</p>
        ${formActions(tr('Imputer au Folio','Post Charge'))}
      </form>
    `);
  }

  // Modal: Record Payment on Folio
  function paymentModal(folioId) {
    if (!can('payment')) return denied();
    const f = folioFor(folioId);
    if (!f) return notify(tr('Folio introuvable','Folio not found'), true);
    const fm = folioMetrics(f);
    if (fm.balance <= 0) return notify(tr('Ce folio est déjà intégralement soldé.','This folio is already fully paid.'), true);

    modal(tr('Enregistrer un Règlement (Paiement Folio)','Record Payment on Folio'), `
      <form data-form="folio-payment" data-folio="${esc(f.id)}">
        <div class="quiet-box">
          <strong>${esc(f.id)}</strong> · Client : ${esc(guestFor(f.guestId).name)} (Chambre ${esc(f.roomId)})<br/>
          ${tr('Solde restant dû : ','Remaining Balance: ')}<strong class="negative">${money(fm.balance)}</strong>
        </div>
        <div style="height:14px"></div>
        <div class="form-grid">
          ${field('amount', tr('Montant encaissé (FCFA)','Payment amount (FCFA)'), 'number', String(fm.balance), `required min="1" max="${fm.balance}" step="100"`)}
          <div class="form-field">
            <label>${tr('Méthode de paiement','Payment Method')}</label>
            <select name="method">
              <option>Carte Bancaire (Visa/Mastercard)</option>
              <option>Espèces (Cash Caisse)</option>
              <option>Orange Money Cameroun</option>
              <option>MTN MoMo</option>
              <option>Virement Bancaire</option>
            </select>
          </div>
        </div>
        ${formActions(tr('Valider l’encaissement','Confirm Payment'))}
      </form>
    `);
  }

  // Modal: Maintenance Ticket
  function newMaintenanceModal() {
    if (!can('maintenance')) return denied();
    modal(tr('Créer un Ordre de Maintenance Odoo','New Odoo Maintenance Ticket'), `
      <form data-form="maintenance">
        <div class="form-grid">
          <div class="form-field">
            <label>${tr('Chambre concernée','Target Room')}</label>
            <select name="roomId" required>
              ${db.rooms.map(r => `<option value="${esc(r.id)}">${esc(r.id)} — ${esc(r.type)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>${tr('Niveau d’urgence','Priority Level')}</label>
            <select name="priority">
              <option value="normal">${tr('Normale (Entretien standard)','Normal')}</option>
              <option value="urgent">${tr('Urgente (Bloquer la chambre hors service)','Urgent (Block Room)')}</option>
              <option value="low">${tr('Faible (Préventif)','Low')}</option>
            </select>
          </div>
          <div class="form-field wide">
            <label>${tr('Description du problème constaté','Defect Description')}</label>
            <textarea name="desc" required placeholder="${tr('Ex: Climatiseur fuit, ampoule grillée, serrure...','E.g. AC leaking, light bulb broken...')}"></textarea>
          </div>
        </div>
        <p class="form-note">${tr('Si l’urgence est élevée, la chambre passera automatiquement en statut Hors Service.','Urgent priority automatically marks the room as Out of Order.')}</p>
        ${formActions(tr('Créer l’ordre de travail','Create Ticket'))}
      </form>
    `);
  }

  // Invoice Layout for Print
  function printFolioInvoice(f) {
    const fm = folioMetrics(f);
    const g = guestFor(f.guestId);
    const b = bookingFor(f.bookingId);
    const r = roomFor(f.roomId);

    return `
      <div class="print-paper">
        <header>
          <div>
            <span class="overline">SCI BLUE OCEAN · HOSPITALITY OPERATIONS</span>
            <h2>${tr('Facture Folio Hôtelière','Guest Folio Invoice')}</h2>
            <small>Réf : ${esc(f.id)} · ${dateLabel(todayISO(), lang, true)}</small>
          </div>
          <div class="align-right">
            <strong style="color:#23685f">SCI BLUE OCEAN</strong>
            <div class="watermark">ODOO ERP · FACTURE OFFICIELLE</div>
          </div>
        </header>

        <div class="permission-grid" style="margin:20px 0">
          <div>
            <small>${tr('Client & Facturation','Guest & Billing Details')}</small>
            <p><strong>${esc(g.name)}</strong></p>
            <small>${esc(g.phone)} · ${esc(g.email)}</small>
          </div>
          <div>
            <small>${tr('Détails du Séjour','Stay Details')}</small>
            <p><strong>Chambre ${esc(f.roomId)} (${esc(r?.type || 'Chambre')})</strong></p>
            <small>${b ? `${dateLabel(b.arrival,lang)} → ${dateLabel(b.departure,lang)}` : '—'}</small>
          </div>
        </div>

        <table>
          <thead><tr><th>${tr('Date','Date')}</th><th>${tr('Désignation / Prestation','Description')}</th><th>${tr('Qté','Qty')}</th><th>${tr('P.U. (FCFA)','Unit')}</th><th>${tr('Total (FCFA)','Total')}</th></tr></thead>
          <tbody>
            ${f.lines.map(l => `<tr><td>${esc(l.date)}</td><td>[${esc(l.category.toUpperCase())}] ${esc(l.desc)}</td><td>${l.qty}</td><td>${money(l.unitPrice)}</td><td>${money(l.total)}</td></tr>`).join('')}
          </tbody>
        </table>

        <div class="align-right">
          <p>${tr('Sous-total HT','Subtotal')}: <strong>${money(fm.subtotal)}</strong></p>
          <p>${tr('TVA (19,25% facultative)','VAT (19.25%)')}: <strong>${money(fm.tax)}</strong></p>
          <p class="total">${tr('Total TTC','Total Gross')}: ${money(fm.totalGross)}</p>
          <p>${tr('Règlements reçus','Total Paid')}: <span style="color:#248d68"><b>${money(fm.totalPaid)}</b></span></p>
          <p class="total">${tr('Solde Net à Payer','Net Balance Due')}: ${money(fm.balance)}</p>
        </div>

        <div class="alert-box" style="margin-top:25px">
          ${tr('Document généré par SCI Blue Ocean Hotel OS selon les normes comptables Odoo Hospitality.','Generated by SCI Blue Ocean Hotel OS in compliance with Odoo Hospitality accounting.')}
        </div>
      </div>
    `;
  }

  function denied() {
    notify(tr('Action refusée pour votre groupe de sécurité Odoo actuel.','Action denied for your current Odoo security group.'), true);
  }

  function switchView(id) {
    if (!canView(id)) return denied();
    view = id;
    filter = '';
    selectedDate = '';
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
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function exportFoliosCSV() {
    const header = ['Folio ID', 'Booking ID', 'Guest Name', 'Room', 'Room Charges XAF', 'Service Charges XAF', 'Total Gross XAF', 'Paid XAF', 'Balance XAF', 'Status'];
    const rows = db.folios.map(f => {
      const fm = folioMetrics(f);
      return [f.id, f.bookingId, guestFor(f.guestId).name, f.roomId, fm.roomTotal, fm.serviceTotal, fm.totalGross, fm.totalPaid, fm.balance, f.status];
    });
    download('\ufeff' + [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\r\n'), 'odoo-hotel-folios-export.csv', 'text/csv;charset=utf-8');
    notify(tr('CSV des Folios exporté avec succès','Folios CSV successfully exported'));
  }

  // --- EVENT LISTENERS ---
  document.addEventListener('click', event => {
    const langBtn = event.target.closest('[data-lang]');
    if (langBtn) {
      lang = langBtn.dataset.lang === 'en' ? 'en' : 'fr';
      render();
      return;
    }

    const nav = event.target.closest('[data-view]');
    if (nav) {
      switchView(nav.dataset.view);
      return;
    }

    const floorBtn = event.target.closest('[data-floor-filter]');
    if (floorBtn) {
      floorFilter = floorBtn.dataset.floorFilter;
      render();
      return;
    }

    const roomBtn = event.target.closest('[data-room-filter]');
    if (roomBtn) {
      roomFilter = roomBtn.dataset.roomFilter;
      render();
      return;
    }

    const folioBtn = event.target.closest('[data-folio-filter]');
    if (folioBtn) {
      folioFilter = folioBtn.dataset.folioFilter;
      render();
      return;
    }

    const calBtn = event.target.closest('[data-cal-date]');
    if (calBtn) {
      if (canView('bookings')) {
        selectedDate = calBtn.dataset.calDate;
        view = 'bookings';
        filter = '';
        render();
      }
      return;
    }

    const button = event.target.closest('[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    const action = button.dataset.action;

    switch (action) {
      case 'close-modal': closeModal(); break;
      case 'new-booking': newBookingModal(); break;
      case 'new-guest': {
        if (!can('guest')) return denied();
        modal(tr('Créer un Profil Client Odoo CRM','New Odoo CRM Guest Profile'), `
          <form data-form="guest">
            <div class="form-grid">
              ${field('guest', tr('Nom complet','Full Name'), 'text', '', 'required minlength="2" maxlength="80"')}
              ${field('phone', tr('Téléphone WhatsApp','Phone WhatsApp'), 'text', '+237 ', 'required')}
              ${field('email', 'Email', 'email', '', 'placeholder="contact@example.cm"')}
              <div class="form-field wide"><label>${tr('Préférences particulières / Notes Odoo','Guest Preferences / Odoo Notes')}</label><textarea name="notes"></textarea></div>
              <label class="checkbox-line wide"><input type="checkbox" name="vip"/> VIP Prestige Guest</label>
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
        const srvId = button.dataset.srvId;
        const srv = db.services.find(s => s.id === srvId);
        addChargeModal();
        setTimeout(() => {
          const select = $('#charge-service-select');
          if (select && srv) {
            select.value = srv.id;
            const priceInput = $('#field-price');
            if (priceInput) priceInput.value = srv.price;
          }
        }, 50);
        break;
      }
      case 'charge-room': {
        const rId = button.dataset.room;
        const folio = db.folios.find(f => f.roomId === rId && f.status === 'open');
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
        if (!f || !can('folio_close')) return denied();
        f.status = 'closed';
        const b = bookingFor(f.bookingId);
        if (b && b.status === 'checked-in') {
          b.status = 'checked-out';
          const r = roomFor(f.roomId);
          if (r) r.status = 'dirty';
          db.tasks.push({ id:`TSK-${Date.now().toString(36)}`, roomId:f.roomId, label:'Nettoyage après départ Odoo', status:'pending', priority:'high' });
        }
        save('close-folio', f.id);
        closeModal();
        render();
        notify(tr('Folio clôturé et soldé avec succès !','Folio closed and settled!'));
        break;
      }
      case 'booking-detail': {
        const b = bookingFor(id);
        if (!b) break;
        const g = guestFor(b.guestId);
        const f = folioFor(b.folioId);
        const fm = folioMetrics(f);
        modal(`${tr('Réservation Odoo','Odoo Booking')} ${esc(b.id)}`, `
          <div class="stack">
            <div class="statusbar">
              <div class="statusbar-step ${b.status==='confirmed'?'active':'done'}">${tr('1. Confirmée','1. Confirmed')}</div>
              <div class="statusbar-step ${b.status==='checked-in'?'active':b.status==='checked-out'?'done':''}">${tr('2. Check-In (Sur place)','2. Checked-In')}</div>
              <div class="statusbar-step ${b.status==='checked-out'?'active':''}">${tr('3. Check-Out (Clôturé)','3. Checked-Out')}</div>
            </div>
            <div class="task-card">
              <div class="task-info"><strong>${esc(g.name)}</strong><p>Chambre ${esc(b.roomId)} · ${dateLabel(b.arrival,lang)} → ${dateLabel(b.departure,lang)}</p></div>
              ${statusChip(b.status)}
            </div>
            <div class="bill-summary" style="margin:10px 0">
              <div><span>${tr('Folio associé','Linked Folio')}</span><strong class="mono">${esc(b.folioId)}</strong></div>
              <div><span>${tr('Total Facturé','Total Charges')}</span><strong class="mono">${money(fm.totalGross)}</strong></div>
              <div><span>${tr('Solde Dû','Balance Due')}</span><strong class="mono ${fm.balance>0?'negative':'positive'}">${money(fm.balance)}</strong></div>
            </div>
            <div class="form-actions">
              ${b.status === 'confirmed' && can('checkin') ? btn('do-checkin', `${icon('check')}${tr('Effectuer Check-In','Process Check-In')}`, 'primary', `data-id="${esc(b.id)}"`) : ''}
              ${b.status === 'checked-in' && can('checkin') ? btn('do-checkout', `${icon('arrow')}${tr('Effectuer Check-Out','Process Check-Out')}`, 'primary', `data-id="${esc(b.id)}"`) : ''}
              ${btn('open-folio', `${icon('fileText')}${tr('Consulter le Folio','View Folio')}`, 'outline', `data-id="${esc(b.folioId)}"`) }
            </div>
          </div>
        `);
        break;
      }
      case 'do-checkin': {
        const b = bookingFor(id);
        if (!b || !can('checkin')) return denied();
        const r = roomFor(b.roomId);
        if (r.status === 'maintenance') return notify(tr('Chambre en maintenance, check-in impossible','Room in maintenance, cannot check in'), true);
        b.status = 'checked-in';
        r.status = 'occupied';
        save('check-in', b.id);
        closeModal();
        render();
        notify(tr('Check-in Odoo validé, client sur place.','Check-in completed.'));
        break;
      }
      case 'do-checkout': {
        const b = bookingFor(id);
        if (!b || !can('checkin')) return denied();
        const f = folioFor(b.folioId);
        const fm = folioMetrics(f);
        if (fm.balance > 0) {
          notify(tr(`Impossible de clôturer : solde dû de ${money(fm.balance)} sur le folio.`, `Cannot checkout: outstanding balance of ${money(fm.balance)}`), true);
          openFolioModal(f.id);
          return;
        }
        b.status = 'checked-out';
        if (f) f.status = 'closed';
        const r = roomFor(b.roomId);
        if (r) r.status = 'dirty';
        db.tasks.push({ id:`TSK-${Date.now().toString(36)}`, roomId:b.roomId, label:'Nettoyage suite à départ client', status:'pending', priority:'high' });
        save('check-out', b.id);
        closeModal();
        render();
        notify(tr('Check-out validé, folio clôturé, chambre passée à nettoyer.','Check-out completed, room sent to cleaning.'));
        break;
      }
      case 'new-maintenance': newMaintenanceModal(); break;
      case 'resolve-maintenance': {
        const m = db.maintenance.find(x => x.id === id);
        if (!m || !can('maintenance')) return denied();
        m.stage = 'resolved';
        const r = roomFor(m.roomId);
        if (r && r.status === 'maintenance') r.status = 'inspected';
        save('resolve-maintenance', m.id);
        render();
        notify(tr('Ticket de maintenance résolu avec succès !','Maintenance order resolved!'));
        break;
      }
      case 'run-night-audit': case 'run-night-audit-btn': {
        if (!can('audit_run')) return denied();
        const m = hospitalityMetrics();
        const auditEntry = {
          date: todayISO(),
          occupancyRate: m.occupancyRate,
          adr: m.adr,
          revPar: m.revPar,
          roomRevenue: m.totalRoomRevenue,
          serviceRevenue: m.totalServiceRevenue,
          totalDayRevenue: m.totalGross,
          auditor: roles[role].fr
        };
        db.auditHistory.unshift(auditEntry);
        save('night-audit-run', `${todayISO()}:ADR=${m.adr}`);
        render();
        notify(tr('Clôture de Nuit Odoo (Night Audit) exécutée et archivée avec succès !','Night Audit completed successfully!'));
        break;
      }
      case 'task-complete': {
        const t = db.tasks.find(x => x.id === id);
        if (!t || !can('task')) return denied();
        t.status = 'done';
        const r = roomFor(t.roomId);
        if (r && (r.status === 'dirty' || r.status === 'cleaning')) r.status = 'available';
        save('complete-task', t.id);
        render();
        notify(tr('Chambre nettoyée et prête à la location !','Room cleaned and available!'));
        break;
      }
      case 'room-detail': {
        const r = roomFor(id);
        if (!r) break;
        modal(tr(`Chambre Odoo ${r.id}`,`Odoo Room ${r.id}`), `
          <div class="stack">
            <div class="task-card">
              <div class="task-info"><strong>Chambre ${esc(r.id)} · ${esc(r.type)}</strong><p>Étage : ${esc(r.floor)} · Tarif : ${money(r.rate)} / nuit</p></div>
              ${statusChip(r.status)}
            </div>
            <div>
              <small class="soft">${tr('Commodités Odoo','Odoo Amenities')}</small>
              <div class="amenity-chips" style="margin-top:8px">
                ${r.amenities.map(a => `<span class="amenity-chip">${esc(a)}</span>`).join('')}
              </div>
            </div>
            ${can('room') ? btn('room-edit', tr('Modifier l’état','Update Status'), 'primary', `data-id="${esc(r.id)}"`) : ''}
          </div>
        `);
        break;
      }
      case 'room-edit': {
        const r = roomFor(id);
        if (!r || !can('room')) return denied();
        modal(tr('Changer le Statut de la Chambre','Update Room Status'), `
          <form data-form="room-status-form" data-id="${esc(r.id)}">
            <div class="form-field wide">
              <label>${tr('Statut Odoo pour la chambre','Odoo status for room')} ${esc(r.id)}</label>
              <select name="status">
                ${['available','dirty','cleaning','inspected','maintenance'].map(s => `<option value="${s}" ${r.status===s?'selected':''}>${statusLabel(s)}</option>`).join('')}
              </select>
            </div>
            ${formActions(tr('Appliquer','Apply'))}
          </form>
        `);
        break;
      }
      case 'month-prev': {
        const [y, m] = monthCursor.split('-').map(Number);
        monthCursor = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0,7);
        render();
        break;
      }
      case 'month-next': {
        const [y, m] = monthCursor.split('-').map(Number);
        monthCursor = new Date(Date.UTC(y, m, 1)).toISOString().slice(0,7);
        render();
        break;
      }
      case 'month-today': {
        monthCursor = todayISO().slice(0,7);
        render();
        break;
      }
      case 'clear-date': {
        selectedDate = '';
        render();
        break;
      }
      case 'export-json': {
        download(JSON.stringify(db, null, 2), 'sciblueocean-odoo-backup.json', 'application/json');
        notify(tr('Base de données Odoo exportée','Odoo dataset exported'));
        break;
      }
      case 'export-csv': {
        exportFoliosCSV();
        break;
      }
      case 'reset-data': {
        if (!confirm(tr('Réinitialiser la base de démonstration Odoo ?','Reset Odoo demo database?'))) return;
        db = demoSeed();
        save('factory-reset');
        render();
        notify(tr('Base Odoo réinitialisée à l’état d’origine !','Odoo database reset!'));
        break;
      }
      case 'ops-toggle': {
        const s = db.systems.find(x => x.id === id);
        if (s && can('ops')) {
          s.status = s.status === 'healthy' ? 'issue' : 'healthy';
          save('toggle-ops', s.id);
          render();
        }
        break;
      }
      case 'bookings': case 'rooms': case 'folios': case 'services': case 'maintenance': case 'audit': {
        switchView(action);
        break;
      }
    }
  });

  // Role Switching & Filter Handlers
  document.addEventListener('change', event => {
    if (event.target.matches('#roleSelect')) {
      role = roles[event.target.value] ? event.target.value : 'direction';
      view = 'overview';
      filter = '';
      closeModal();
      render();
      notify(`${tr('Rôle actif : ','Active Odoo role: ')} ${roles[role][lang]}`);
    }
    if (event.target.matches('[data-booking-filter]')) {
      bookingFilter = event.target.value;
      render();
    }
    if (event.target.matches('#charge-service-select')) {
      const selected = event.target.selectedOptions[0];
      const price = selected.dataset.price;
      const priceInput = $('#field-price');
      if (priceInput && price) priceInput.value = price;
    }
  });

  document.addEventListener('input', event => {
    if (!event.target.matches('[data-filter]')) return;
    const pos = event.target.selectionStart ?? 0;
    filter = event.target.value;
    render();
    const input = $('#searchInput');
    if (input) {
      input.focus();
      try { input.setSelectionRange(pos, pos); } catch(e){}
    }
  });

  // Forms Submissions
  document.addEventListener('submit', event => {
    const form = event.target.closest('[data-form]');
    if (!form) return;
    event.preventDefault();
    const f = new FormData(form);
    const kind = form.dataset.form;

    if (kind === 'booking') {
      const guestName = String(f.get('guest') || '').trim();
      const phone = String(f.get('phone') || '').trim();
      const roomId = String(f.get('roomId') || '');
      const arrival = String(f.get('arrival') || '');
      const departure = String(f.get('departure') || '');
      const channel = String(f.get('channel') || 'Direct Hôtel');
      const deposit = Number(f.get('paid') || 0);
      const payMethod = String(f.get('payMethod') || 'Espèces');

      if (!guestName || !arrival || !departure || arrival >= departure) {
        return notify(tr('Dates de réservation invalides','Invalid stay dates'), true);
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

      const folioLines = [{
        id: `LN-${Date.now().toString(36)}`,
        date: arrival,
        category: 'room',
        desc: `Hébergement ${room.type} (Ch. ${room.id}) · ${nights} nuits`,
        qty: nights,
        unitPrice: room.rate,
        total: roomTotal
      }];

      const payments = deposit > 0 ? [{
        id: `PAY-${Date.now().toString(36)}`,
        date: arrival,
        amount: deposit,
        method: payMethod,
        ref: `DEP-${Date.now().toString().slice(-5)}`
      }] : [];

      db.bookings.push({
        id: newBookingId,
        folioId: newFolioId,
        guestId: guest.id,
        roomId,
        arrival,
        departure,
        status: 'confirmed',
        channel,
        created: todayISO()
      });

      db.folios.push({
        id: newFolioId,
        bookingId: newBookingId,
        guestId: guest.id,
        roomId,
        status: 'open',
        lines: folioLines,
        payments,
        createdAt: arrival
      });

      save('create-odoo-booking', newBookingId);
      closeModal();
      view = 'folios';
      render();
      notify(tr('Réservation Odoo et Folio financier créés avec succès !','Odoo reservation and folio created!'));
      return;
    }

    if (kind === 'folio-charge') {
      const folioId = String(f.get('selectedFolioId') || f.get('folioId') || '');
      const folio = folioFor(folioId);
      if (!folio) return notify(tr('Folio non trouvé','Folio not found'), true);

      const serviceId = String(f.get('serviceId') || '');
      const srv = db.services.find(s => s.id === serviceId);
      const qty = Number(f.get('qty') || 1);
      const price = Number(f.get('price') || (srv?.price || 0));
      const desc = srv ? (lang === 'fr' ? srv.nameFr : srv.nameEn) : String(f.get('customDesc') || 'Prestation diverse');
      const cat = srv ? srv.cat : 'service';

      folio.lines.push({
        id: `LN-${Date.now().toString(36)}`,
        date: todayISO(),
        category: cat,
        desc,
        qty,
        unitPrice: price,
        total: qty * price
      });

      save('add-folio-charge', `${folio.id}:${desc}`);
      closeModal();
      openFolioModal(folio.id);
      render();
      notify(tr(`Charge de ${money(qty * price)} imputée avec succès sur le Folio ${folio.id} !`, `Charge posted to Folio ${folio.id}`));
      return;
    }

    if (kind === 'folio-payment') {
      const folioId = form.dataset.folio;
      const folio = folioFor(folioId);
      if (!folio) return;
      const amount = Number(f.get('amount') || 0);
      const method = String(f.get('method') || 'Espèces');

      if (amount <= 0) return notify(tr('Montant invalide','Invalid amount'), true);

      folio.payments.push({
        id: `PAY-${Date.now().toString(36)}`,
        date: todayISO(),
        amount,
        method,
        ref: `ENC-${Date.now().toString().slice(-6)}`
      });

      save('record-folio-payment', `${folio.id}:${amount}`);
      closeModal();
      openFolioModal(folio.id);
      render();
      notify(tr(`Règlement de ${money(amount)} enregistré avec succès !`,`Payment of ${money(amount)} recorded!`));
      return;
    }

    if (kind === 'guest') {
      const name = String(f.get('guest') || '').trim();
      const phone = String(f.get('phone') || '').trim();
      const email = String(f.get('email') || '').trim();
      const notes = String(f.get('notes') || '').trim();
      const vip = f.get('vip') === 'on';

      const newId = `G${Date.now().toString(36).toUpperCase()}`;
      db.guests.push({ id: newId, name, phone, email, notes, vip, created: todayISO() });
      save('create-guest', newId);
      closeModal();
      render();
      notify(tr('Client ajouté dans le CRM Odoo !','Guest profile added to Odoo CRM!'));
      return;
    }

    if (kind === 'maintenance') {
      const roomId = String(f.get('roomId') || '');
      const priority = String(f.get('priority') || 'normal');
      const desc = String(f.get('desc') || '').trim();

      const ticketId = `MNT-${Date.now().toString().slice(-4)}`;
      db.maintenance.unshift({
        id: ticketId,
        roomId,
        desc,
        priority,
        stage: 'in_progress',
        reportedBy: roles[role].fr,
        date: todayISO()
      });

      if (priority === 'urgent') {
        const r = roomFor(roomId);
        if (r) r.status = 'maintenance';
      }

      save('create-maintenance', ticketId);
      closeModal();
      render();
      notify(tr('Ordre de travail créé dans Odoo Maintenance !','Odoo maintenance order created!'));
      return;
    }

    if (kind === 'room-status-form') {
      const roomId = form.dataset.id;
      const status = String(f.get('status') || '');
      const r = roomFor(roomId);
      if (r) {
        r.status = status;
        save('update-room-status', `${r.id}:${status}`);
        closeModal();
        render();
        notify(tr(`Statut de la chambre ${r.id} mis à jour : ${statusLabel(status)}`, `Room ${r.id} status updated`));
      }
      return;
    }
  });

  // Mobile drawer controls
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
  $('#modalRoot').addEventListener('click', e => {
    if (e.target === $('#modalRoot')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      $('#sidebar').classList.remove('open');
      $('#scrim').hidden = true;
      $('#menuToggle').setAttribute('aria-expanded', 'false');
    }
  });

  render();
})();
