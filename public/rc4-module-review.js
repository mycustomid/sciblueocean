// BLUE LINE CAPITAL GROUP — Executive 9-Module Review Hub & Backend Inspector Engine
// Client-side controller for inspecting, auditing, and executing transactions across all 9 ERP modules

(() => {
  'use strict';

  let activeReviewModId = 'sugar';
  let backendHealth = { status: 'NOT_CHECKED', latencyMs: null, driver: 'Demo API, not an ERP database' };
  let apiConsoleState = {
    method: 'GET',
    url: '/api/health',
    status: null,
    timeMs: null,
    response: { status: 'NOT_CHECKED', note: 'Click Ping API to test the demo endpoint' }
  };

  const moneyFmt = v => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(Number(v) || 0)) + ' FCFA';
  const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Auto-fetch backend health on load
  async function checkBackend() {
    const t0 = performance.now();
    try {
      const res = await fetch('/api/health');
      const t1 = performance.now();
      if (res.ok) {
        const data = await res.json();
        backendHealth = {
          status: data.mode || 'DEMO_API',
          latencyMs: Math.round(t1 - t0),
          driver: data.persistence || 'NO_SERVER_WRITES',
          stats: null
        };
      }
    } catch (e) {
      backendHealth = { status: 'STANDALONE_FALLBACK', latencyMs: 0, driver: 'Local In-Memory Cache' };
    }
  }

  window.renderModulesReviewView = function() {
    const p9 = window.PRODUCTS_9 || [];
    const db = window.db || { divisionRecords: {} };

    // Calculate aggregated stats across 9 products
    let totalConsolidated = 0; // Sum of sample nominal values, NOT accounting consolidation
    let totalDossiers = 0;
    const globalSteps = { 1: 0, 2: 0, 3: 0, 4: 0 };

    const moduleStats = p9.map(m => {
      const recs = (db.divisionRecords && db.divisionRecords[m.id]) || [];
      const mTotal = recs.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      totalConsolidated += mTotal;
      totalDossiers += recs.length;
      const sCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
      recs.forEach(r => {
        const st = Number(r.step) || 1;
        if (sCounts[st] !== undefined) {
          sCounts[st]++;
          globalSteps[st]++;
        }
      });
      return {
        ...m,
        records: recs,
        totalAmount: mTotal,
        stepCounts: sCounts
      };
    });

    const activeMod = moduleStats.find(m => m.id === activeReviewModId) || moduleStats[0] || p9[0];
    const activeRecs = activeMod?.records || [];

    return `
      <div class="rev-hub">
        <!-- 1. EXECUTIVE BANNER WITH REALTIME BACKEND STATUS -->
        <div class="rev-header-card">
          <div class="rev-header-copy">
            <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;color:#d7aa71;text-transform:uppercase;margin-bottom:4px">
              CENTRE DE COMMANDEMENT EXÉCUTIF · AUDIT DES 9 FILIALES
            </div>
            <h2>Revue des 9 Modules ERP & Banc d'Essai Backend</h2>
            <p>
              Inspection des exemples métier du Groupe. État du backend vérifiable ; données du navigateur distinctes de la base serveur. Les chiffres ci-dessous sont des exemples, pas un reporting comptable.
            </p>
          </div>
          <div class="rev-header-badges">
            <button type="button" class="btn btn-outline btn-small" data-view="modulesBenchmark">⇄ Comparer deux ERP avec preuves</button>
            <div class="rev-badge-online">
              <span class="rev-pulse"></span>
              <span>API démo : ${escHtml(backendHealth.status)} (${backendHealth.latencyMs ?? '—'}ms)</span>
            </div>
            <button type="button" class="btn btn-dark btn-small" data-action="rev-ping-api" data-url="/api/health" data-method="GET">
              ⚡ Ping /api/health
            </button>
            <button type="button" class="btn btn-outline btn-small" data-action="rev-export-all-json">
              📥 Export Audit Global (JSON)
            </button>
          </div>
        </div>

        <!-- 2. 4-KPI EXECUTIVE RIBBON -->
        <div class="rev-kpi-ribbon">
          <div class="rev-kpi-tile">
            <span class="rev-kpi-label">Périmètre Opérationnel</span>
            <div class="rev-kpi-val">9 Domaines Démo</div>
            <span class="rev-kpi-sub">Architecture modulaire Odoo & Frappe</span>
          </div>
          <div class="rev-kpi-tile">
            <span class="rev-kpi-label">Volume Financier Traité</span>
            <div class="rev-kpi-val">${moneyFmt(totalConsolidated)}</div>
            <span class="rev-kpi-sub">Total nominal de dossiers démo (NON consolidé)</span>
          </div>
          <div class="rev-kpi-tile">
            <span class="rev-kpi-label">Dossiers en navigateur (local)</span>
            <div class="rev-kpi-val">${totalDossiers} Transactions</div>
            <span class="rev-kpi-sub">État local : démonstration uniquement</span>
          </div>
          <div class="rev-kpi-tile">
            <span class="rev-kpi-label">État du Pipeline Global</span>
            <div class="rev-kpi-val">${globalSteps[1]} Guichet · ${globalSteps[2]} Usine · ${globalSteps[3]} Audit · ${globalSteps[4]} Direction</div>
            <span class="rev-kpi-sub">Flowchart opérationnel Start-to-End</span>
          </div>
        </div>

        <!-- 3. 9-MODULE BENTO SELECTION GRID -->
        <div class="rev-bento-section">
          <div class="rev-section-title">
            <span>Sélecteur des 9 Modules ERP (Cliquer pour inspecter)</span>
            <span style="font-size:12px;color:#7b8c99;font-weight:600">Module actif : <b>${escHtml(activeMod.num)} · ${escHtml(activeMod.nameFr)}</b></span>
          </div>
          <div class="rev-bento-grid">
            ${moduleStats.map(m => `
              <div class="rev-module-card ${m.id === activeReviewModId ? 'active' : ''}" data-action="rev-select-mod" data-mod-id="${m.id}">
                <div>
                  <div class="rev-card-top">
                    <span class="rev-card-num">${escHtml(m.num)}</span>
                    <span class="rev-card-repo">${escHtml(m.repo.split('/')[1] || m.repo)}</span>
                  </div>
                  <h4 class="rev-card-title">${escHtml(m.nameFr)}</h4>
                  <p style="font-size:12px;color:#60727f;margin:4px 0 0 0;line-height:1.4">${escHtml(m.odooModel || m.framework || '')}</p>
                </div>
                <div>
                  <div class="rev-card-metrics">
                    <span class="rev-card-amt">${moneyFmt(m.totalAmount)}</span>
                    <span class="rev-card-cnt">${m.records.length} dossier(s)</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
                    <div class="rev-card-pipeline" title="Pipeline: Step 1 / Step 2 / Step 3 / Step 4">
                      <span class="rev-pip-dot ${m.stepCounts[1] > 0 ? 'active' : ''}"></span>
                      <span class="rev-pip-dot ${m.stepCounts[2] > 0 ? 'active' : ''}"></span>
                      <span class="rev-pip-dot ${m.stepCounts[3] > 0 ? 'active' : ''}"></span>
                      <span class="rev-pip-dot ${m.stepCounts[4] > 0 ? 'done' : ''}"></span>
                    </div>
                    <span style="font-size:11px;font-weight:700;color:${m.id === activeReviewModId ? '#0d2232' : '#0d9488'}">
                      ${m.id === activeReviewModId ? '✓ En cours d’inspection' : 'Examiner →'}
                    </span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 4. DEDICATED MODULE DEEP DIVE STATION -->
        <div class="rev-station">
          <div class="rev-station-banner">
            <div>
              <div style="font-size:11px;font-weight:800;color:#0d9488;letter-spacing:0.06em;text-transform:uppercase">
                MODULE EN REVUE DÉTAILLÉE · ${escHtml(activeMod.num)}
              </div>
              <h3>${escHtml(activeMod.nameFr)}</h3>
              <p style="margin:4px 0 0 0;font-size:13px;color:#60727f">
                <b>Référence Amont GitHub :</b> <a href="https://${escHtml(activeMod.repo)}" target="_blank" rel="noopener" style="color:#0284c7;text-decoration:underline">${escHtml(activeMod.repo)}</a>
                &nbsp;·&nbsp; <b>Framework Métier :</b> ${escHtml(activeMod.odooModel || 'ERP Standard')}
              </p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button type="button" class="btn btn-outline btn-small" data-action="rev-export-mod-csv" data-mod-id="${activeMod.id}">
                📊 Export CSV
              </button>
              <button type="button" class="btn btn-dark btn-small" data-action="rev-ping-api" data-url="/api/records?module=${activeMod.id}" data-method="GET">
                ⚡ Tester API GET /api/records
              </button>
            </div>
          </div>

          <!-- 4A. 4-STEP PIPELINE TRACKER FOR THIS MODULE -->
          <div>
            <h5 style="margin:0 0 10px 0;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#475569">
              Machine d'États Start-to-End du Module
            </h5>
            <div class="rev-flow-tracker">
              ${activeMod.flow.map(st => {
                const count = activeRecs.filter(r => (Number(r.step) || 1) === st.step).length;
                return `
                  <div class="rev-flow-step-box ${count > 0 ? 'has-items' : ''}">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                      <span class="rev-flow-step-num">${escHtml(st.code)}</span>
                      <span class="rev-flow-step-badge">${count} en attente</span>
                    </div>
                    <div class="rev-flow-step-name">${escHtml(st.titleFr)}</div>
                    <div style="font-size:11px;color:#64748b;line-height:1.4">${escHtml(st.descFr)}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 4B. LOCAL DEMO RECORDS TABLE -->
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
              <h5 style="margin:0;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#475569">
                Dossiers de démonstration locale (${activeRecs.length} exemples)
              </h5>
              <span style="font-size:12px;color:#64748b">
                Volume du module : <b>${moneyFmt(activeMod.totalAmount)}</b>
              </span>
            </div>

            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Réf. ID</th>
                    <th>Date</th>
                    <th>Partie Prenante / Tiers</th>
                    <th>Description de l'Opération</th>
                    <th>Catégorie</th>
                    <th>Montant</th>
                    <th>Étape Actuelle</th>
                    <th>Statut</th>
                    <th style="text-align:right">Actions d'Audit</th>
                  </tr>
                </thead>
                <tbody>
                  ${activeRecs.length === 0 ? `
                    <tr>
                      <td colspan="9" style="text-align:center;padding:32px;color:#94a3b8">
                        Aucun enregistrement trouvé dans ce module. Utilisez le banc d'essai ci-dessous pour injecter une transaction test.
                      </td>
                    </tr>
                  ` : activeRecs.map(r => `
                    <tr>
                      <td class="mono"><strong>${escHtml(r.id)}</strong></td>
                      <td>${escHtml(r.date)}</td>
                      <td><strong>${escHtml(r.client || r.party || 'Non spécifié')}</strong></td>
                      <td>
                        <span class="soft">${escHtml(r.itemFr || r.desc || '')}</span>
                        ${r.notesFr ? `<br/><small style="color:#64748b">${escHtml(r.notesFr)}</small>` : ''}
                      </td>
                      <td><span class="pill">${escHtml(r.category || 'Opération')}</span></td>
                      <td class="mono"><strong>${moneyFmt(r.amount)}</strong></td>
                      <td>
                        <span class="pill ${r.step === 4 ? 'pill-success' : 'pill-warning'}">
                          Étape ${r.step} / 4
                        </span>
                      </td>
                      <td>
                        <span class="pill ${r.status === 'approved' || r.approvedByBoss ? 'pill-success' : 'pill-info'}">
                          ${r.approvedByBoss || r.status === 'approved' ? '✓ Signé Boss [END]' : (r.status || 'En cours')}
                        </span>
                      </td>
                      <td style="text-align:right;white-space:nowrap">
                        <button type="button" class="btn btn-small btn-outline" data-action="rev-record-details" data-mod-id="${activeMod.id}" data-rec-id="${r.id}">
                          👁️ Détails
                        </button>
                        ${r.step < 4 ? `
                          <button type="button" class="btn btn-small btn-primary" data-action="rev-advance-record" data-mod-id="${activeMod.id}" data-rec-id="${r.id}" data-target-step="${r.step + 1}">
                            ⚡ Étape ${r.step + 1}
                          </button>
                        ` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 4C. LOCAL TEST BENCH & READ-ONLY API CONSOLE -->
          <div class="rev-two-col">
            <!-- TEST BENCH -->
            <div class="rev-box">
              <h4 class="rev-box-title">Banc d'Essai : Transaction Simulée Locale</h4>
              <p style="margin:0;font-size:12px;color:#64748b">
                Simulez une opération dans le navigateur, sans écriture serveur, pour le domaine <b>${escHtml(activeMod.nameFr)}</b>.
              </p>
              <form id="revTestBenchForm" class="rev-form-grid" data-mod-id="${activeMod.id}">
                <div class="rev-form-group">
                  <label for="tbClient">Tiers / Client / Fournisseur</label>
                  <input type="text" id="tbClient" name="party" required value="Partenaire fictif (démo)" placeholder="ex: Coopérative Planteurs" />
                </div>
                <div class="rev-form-group">
                  <label for="tbCategory">Catégorie Métier</label>
                  <input type="text" id="tbCategory" name="category" required value="${escHtml(activeMod.catalog?.[0]?.nameFr || 'Transaction Métier')}" />
                </div>
                <div class="rev-form-group full">
                  <label for="tbDesc">Description de l'Opération</label>
                  <input type="text" id="tbDesc" name="desc" required value="Opération de démonstration exécutée depuis la console d'audit" />
                </div>
                <div class="rev-form-group">
                  <label for="tbAmount">Montant Nominal (FCFA)</label>
                  <input type="number" id="tbAmount" name="amount" required min="1000" step="1000" value="15000000" />
                </div>
                <div class="rev-form-group">
                  <label for="tbStep">Étape initiale (démo)</label>
                  <select id="tbStep" name="step">
                    <option value="1" selected>Étape 1 · Guichet / Intake</option>
                  </select>
                </div>
                <div class="rev-form-group full" style="margin-top:6px">
                  <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">
                    ➕ Ajouter au navigateur (simulation)
                  </button>
                </div>
              </form>
            </div>

            <!-- API DEVELOPER CONSOLE -->
            <div class="rev-box">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                <h4 class="rev-box-title">Inspection REST API (lecture seule)</h4>
                <div class="rev-console-status">
                  <span>●</span> <span>${escHtml(apiConsoleState.method)} ${escHtml(apiConsoleState.url)} · HTTP ${apiConsoleState.status ?? '—'} (${apiConsoleState.timeMs}ms)</span>
                </div>
              </div>
              <p style="margin:0;font-size:12px;color:#64748b">
                Testez les endpoints de démonstration ; les requêtes privées peuvent renvoyer 403. Aucun ordre de paiement ni approbation n'est exécuté côté serveur.
              </p>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button type="button" class="btn btn-small btn-dark" data-action="rev-ping-api" data-url="/api/health" data-method="GET">
                  GET /api/health
                </button>
                <button type="button" class="btn btn-small btn-dark" data-action="rev-ping-api" data-url="/api/modules" data-method="GET">
                  GET /api/modules
                </button>
                <button type="button" class="btn btn-small btn-dark" data-action="rev-ping-api" data-url="/api/records?module=${activeMod.id}" data-method="GET">
                  GET /api/records (${activeMod.id})
                </button>
              </div>
              <pre class="rev-console-pre"><code>${escHtml(JSON.stringify(apiConsoleState.response, null, 2))}</code></pre>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  // Event handler delegation
  document.addEventListener('click', async event => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === 'rev-select-mod') {
      const modId = btn.dataset.modId;
      if (modId) {
        activeReviewModId = modId;
        if (typeof window.render === 'function') window.render();
      }
      return;
    }

    if (action === 'rev-ping-api') {
      const url = btn.dataset.url || '/api/health';
      const method = btn.dataset.method || 'GET';
      const t0 = performance.now();
      try {
        const res = await fetch(url, { method });
        const t1 = performance.now();
        const json = await res.json();
        apiConsoleState = {
          method,
          url,
          status: res.status,
          timeMs: Math.round(t1 - t0),
          response: json
        };
        if (typeof window.notify === 'function') {
          window.notify(`API ${method} ${url} exécuté en ${Math.round(t1 - t0)}ms (HTTP ${res.status}) !`);
        }
        if (typeof window.render === 'function') window.render();
      } catch (err) {
        apiConsoleState = {
          method,
          url,
          status: 500,
          timeMs: 0,
          response: { error: err.message, status: 'STANDALONE_FALLBACK' }
        };
        if (typeof window.render === 'function') window.render();
      }
      return;
    }

    if (action === 'rev-advance-record') {
      const modId = btn.dataset.modId;
      const recId = btn.dataset.recId;
      const targetStep = Number(btn.dataset.targetStep) || 4;
      const db = window.db || {};
      const list = (db.divisionRecords && db.divisionRecords[modId]) || [];
      const rec = list.find(r => r.id === recId);

      if (rec) {
        rec.step = targetStep;
        if (targetStep === 4) rec.approvedByBoss = true;
        if (typeof window.save === 'function') window.save('rev-advance-step', `${modId}:${recId}:${targetStep}`);

        // Explicitly local: never claim an unauthenticated browser click is a server approval.

        if (typeof window.notify === 'function') {
          window.notify(`SIMULATION LOCALE : dossier ${recId}, étape ${targetStep}/4 (non synchronisé).`);
        }
        if (typeof window.render === 'function') window.render();
      }
      return;
    }

    if (action === 'rev-record-details') {
      const modId = btn.dataset.modId;
      const recId = btn.dataset.recId;
      const db = window.db || {};
      const list = (db.divisionRecords && db.divisionRecords[modId]) || [];
      const rec = list.find(r => r.id === recId);
      if (!rec) return;

      const modalHtml = `
        <div style="display:flex;flex-direction:column;gap:16px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px">
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
              <div><small style="color:#64748b">Référence Transaction</small><p style="margin:2px 0 0;font-weight:700" class="mono">${escHtml(rec.id)}</p></div>
              <div><small style="color:#64748b">Date d'Enregistrement</small><p style="margin:2px 0 0;font-weight:700">${escHtml(rec.date)}</p></div>
              <div><small style="color:#64748b">Partie Prenante / Tiers</small><p style="margin:2px 0 0;font-weight:700">${escHtml(rec.client || rec.party || 'Non spécifié')}</p></div>
              <div><small style="color:#64748b">Montant Réglementaire</small><p style="margin:2px 0 0;font-weight:700;color:#0d2232">${moneyFmt(rec.amount)}</p></div>
              <div style="grid-column:1/-1"><small style="color:#64748b">Description / Spécification Métier</small><p style="margin:2px 0 0">${escHtml(rec.itemFr || rec.desc || '')}</p></div>
              ${rec.notesFr ? `<div style="grid-column:1/-1"><small style="color:#64748b">Notes Techniques & Justificatifs</small><p style="margin:2px 0 0;font-size:12px;color:#475569">${escHtml(rec.notesFr)}</p></div>` : ''}
            </div>
          </div>

          <div>
            <h5 style="margin:0 0 8px;font-size:12px;text-transform:uppercase;color:#475569">Historique simulé du dossier (non certifié)</h5>
            <div style="display:flex;flex-direction:column;gap:8px">
              <div style="background:#f0fdf4;border-left:3px solid #10b981;padding:8px 12px;font-size:12px">
                <b>Étape 1 (Guichet/Intake) :</b> Dossier initié et vérifié par l'opérateur de saisie.
              </div>
              ${rec.step >= 2 ? `
                <div style="background:#f0fdf4;border-left:3px solid #10b981;padding:8px 12px;font-size:12px">
                  <b>Étape 2 (Opérations/Usine) :</b> Constat technique, pesée ou contrôle d'exécution validé.
                </div>
              ` : ''}
              ${rec.step >= 3 ? `
                <div style="background:#f0fdf4;border-left:3px solid #10b981;padding:8px 12px;font-size:12px">
                  <b>Étape 3 (Audit/Compta) :</b> Rapprochement SYSCOHADA, conformité fiscale et visa auditeur.
                </div>
              ` : ''}
              ${rec.step >= 4 || rec.approvedByBoss ? `
                <div style="background:#ecfdf5;border-left:3px solid #059669;padding:8px 12px;font-size:12px">
                  <b>Étape 4 (Direction [END]) :</b> Visa définitif de la Direction Générale et autorisation de clôture.
                </div>
              ` : ''}
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
            <button type="button" class="btn btn-outline" data-action="close-modal">Fermer</button>
            <button type="button" class="btn btn-primary" onclick="window.print()">🖨 Imprimer Fiche d'Audit</button>
          </div>
        </div>
      `;

      if (typeof window.modal === 'function') {
        window.modal(`Audit de la Transaction ${escHtml(rec.id)}`, modalHtml);
      }
      return;
    }

    if (action === 'rev-export-mod-csv') {
      const modId = btn.dataset.modId;
      const db = window.db || {};
      const list = (db.divisionRecords && db.divisionRecords[modId]) || [];
      const headers = ['ID', 'Date', 'Tiers', 'Description', 'Categorie', 'Montant_FCFA', 'Etape', 'Statut'];
      const rows = list.map(r => [
        r.id,
        r.date,
        `"${(r.client || r.party || '').replace(/"/g, '""')}"`,
        `"${(r.itemFr || r.desc || '').replace(/"/g, '""')}"`,
        `"${(r.category || '').replace(/"/g, '""')}"`,
        r.amount,
        r.step,
        r.approvedByBoss ? 'APPROVED_BOSS' : (r.status || 'PENDING')
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_${modId}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      if (typeof window.notify === 'function') window.notify(`Export CSV généré pour le module ${modId} !`);
      return;
    }

    if (action === 'rev-export-all-json') {
      const db = window.db || {};
      const exportData = {
        exportedAt: new Date().toISOString(),
        group: 'Blue Line Capital Group',
        backendHealth,
        divisionRecords: db.divisionRecords || {}
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `blueline_audit_consolidated_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      if (typeof window.notify === 'function') window.notify('Rapport d’audit consolidé JSON exporté !');
      return;
    }
  });

  // Handle Test Bench Form Submit
  document.addEventListener('submit', async event => {
    if (event.target?.id !== 'revTestBenchForm') return;
    event.preventDefault();

    const form = event.target;
    const modId = form.dataset.modId;
    const formData = new FormData(form);
    const party = String(formData.get('party') || '').trim();
    const category = String(formData.get('category') || '').trim();
    const desc = String(formData.get('desc') || '').trim();
    const amount = Number(formData.get('amount') || 0);
    const step = 1;
    if (!party || desc.length < 3 || !Number.isFinite(amount) || amount <= 0) {
      if (window.notify) window.notify('Formulaire invalide : tiers, description et montant positif requis.');
      return;
    }

    const prefix = modId.toUpperCase().slice(0, 3);
    const newId = `${prefix}-DEMO-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
    const today = new Date().toISOString().slice(0, 10);

    const newRec = {
      id: newId,
      step,
      client: party,
      party,
      itemFr: desc,
      itemEn: desc,
      category,
      qty: 1,
      unitPrice: amount,
      amount,
      paymentMethod: 'SIMULATION / AUCUN TRANSFERT',
      operator: 'Demo operator (no authenticated identity)',
      notesFr: `Transaction injectée via la Console de Revue Exécutive. Étape ${step}/4.`,
      notesEn: `Transaction injected from Executive Review Console. Step ${step}/4.`,
      date: today,
      status: step === 4 ? 'approved' : (step === 3 ? 'audited' : 'in_progress'),
      approvedByBoss: step === 4
    };

    const db = window.db || { divisionRecords: {} };
    db.divisionRecords = db.divisionRecords || {};
    db.divisionRecords[modId] = db.divisionRecords[modId] || [];
    db.divisionRecords[modId].unshift(newRec);

    if (typeof window.save === 'function') {
      window.save('test-bench-record-created', `${modId}:${newId}:${amount}`);
    }

    // RC5: no POST from the unauthenticated client test bench.
    // Browser storage is explicitly separate from the server API.

    if (typeof window.notify === 'function') {
      window.notify(`SIMULATION LOCALE : ${newId} (${moneyFmt(amount)}) sauvegardée dans ce navigateur, pas en serveur.`);
    }

    if (typeof window.render === 'function') window.render();
  });

  checkBackend();
})();
