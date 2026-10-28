"""Operational UI adapter; original demo/static source files remain untouched.

Called only by operations-server for HTML below public/. No credentials embedded.
"""


def account_page(mfa=False):
    title = 'Connexion du personnel'
    form = """<p>Connectez-vous avec votre compte personnel. Votre rôle et vos droits sont attribués par l’administrateur.</p><form data-account-login><label for="staff-username">Identifiant ou e-mail<input id="staff-username" name="username" type="text" autocomplete="username" maxlength="254" required autofocus placeholder="Votre identifiant ou e-mail"></label><label for="staff-password">Mot de passe<input id="staff-password" name="password" type="password" autocomplete="current-password" maxlength="512" required></label><button class="account-secondary" type="button" data-password-toggle aria-controls="staff-password" aria-pressed="false">Afficher le mot de passe</button><button class="studio-primary" type="submit">Ouvrir mon espace ↗</button><div class="account-message" role="status" aria-live="polite"></div></form>"""
    return f'''<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>{title} · Blue Ocean Studio</title><link rel="icon" href="/experience/assets/favicon.svg"><link rel="stylesheet" href="/studio/assets/studio.css"><link rel="stylesheet" href="/operations/account.css"><link rel="stylesheet" href="/operations/i18n.css"><script defer src="/operations/i18n.js"></script><script defer src="/operations/login.js"></script></head><body class="studio-login-body"><div class="account-ribbon">BLUE OCEAN · ACCÈS PERSONNEL</div><main class="account-shell"><section class="account-story"><div class="account-brand"><b>B.</b>BLUE OCEAN<br>OPERATIONS STUDIO</div><div><span class="account-kicker">VOTRE ESPACE DE TRAVAIL</span><h1>Le travail<br>en coulisses,<br><em>avec clarté.</em></h1><p>Les demandes deviennent des séjours. Chaque action est liée à votre compte et enregistrée dans le registre des opérations.</p></div><div class="account-foot">BONAPRISO · DOUALA · RÉSIDENCE MIAGUE</div></section><section class="account-panel"><div class="account-card"><span class="account-kicker">COMPTE PERSONNEL · ACCÈS SELON VOTRE RÔLE</span><h2>{title}.</h2>{form}<div class="account-notes"><a href="/experience/">Retour au site Blue Ocean</a><span>Accès réservé au personnel autorisé</span></div></div></section></main></body></html>'''


def render_html(text, path):
    """Return operational HTML for a public path, without changing stored files."""
    normalized = '/' + str(path).replace('\\', '/').lstrip('/')
    if normalized in ('/studio', '/studio/', '/studio/index.html'):
        return account_page()
    if normalized in ('/studio/mfa', '/studio/mfa/', '/studio/mfa/index.html'):
        return account_page(mfa=True)
    for old, new in {
        '/studio/assets/studio.js': '/operations/staff.js',
        '/studio/assets/studio-v4.js': '/operations/staff-v4.js',
        '/experience/assets/site-v3.js': '/operations/site.js',
        '/experience/assets/booking-v4.js': '/operations/booking.js',
        '/studio/pricing/pricing-admin.js': '/operations/pricing.js',
        'src="pricing-admin.js"': 'src="/operations/pricing.js"',
        'ENVIRONNEMENT DE DÉMONSTRATION · DONNÉES SYNTHÉTIQUES · AUCUNE TRANSACTION RÉELLE': 'OPÉRATIONS LOCALES · DONNÉES PERSISTANTES · ENCAISSEMENT EN LIGNE NON CONNECTÉ',
        'ENVIRONNEMENT DE DÉMONSTRATION': 'OPÉRATIONS LOCALES',
        'LOCAL DEMO': 'OPÉRATIONS LOCALES',
        '(DEMO)': '',
        'Rôle de démonstration': 'Rôle attribué par le serveur',
        'Connexion à l’API de démonstration en cours. Aucune donnée métier ne sera simulée comme « live ».': 'Connexion au registre des opérations en cours.',
        'Connexion à l’API de démonstration en cours.': 'Connexion au registre des opérations en cours.',
        'Un vrai flux de travail : arrivée, présence, folio et départ dans l’environnement test.': 'Arrivée, présence, folio et départ enregistrés dans le registre des opérations.',
        'Les confirmations et modifications sont appliquées à la base SQLite de démonstration. Elles ne concernent jamais des réservations réelles.': 'Les confirmations et modifications sont enregistrées dans le registre des opérations de Résidence Miague.',
        'Suivez les charges de démonstration, sans simuler un paiement réel.': 'Suivez les charges de séjour. L’encaissement en ligne reste non connecté.',
        'Ici, seules des charges tests sont enregistrables.': 'Les charges sont enregistrées sans encaissement bancaire automatique.',
        'Montants simulés comme reçus': 'Encaissements en ligne',
        'Seule une session Finance/Manager peut tenter un règlement simulé lorsque l’option locale explicite est activée. Le client ne peut pas valider son propre paiement.': 'L’encaissement en ligne est indisponible. Aucun bouton ne valide un paiement bancaire dans cet espace.',
        'DEMO ONLY · LOCAL SQLITE · NO LIVE PRICING': 'OPÉRATIONS LOCALES · TARIFS ENREGISTRÉS · ENCAISSEMENT NON CONNECTÉ',
        'Demo SQLite': 'Registre des opérations',
        'Test uniquement, aucun PSP': 'Encaissement en ligne non connecté',
        'Configure nightly rates and block unavailable dates in the isolated demo inventory. Changes are audited and visible in guest quotes. Actual PMS/merchant accounts are not connected.': 'Configure nightly rates and block unavailable dates. Changes are recorded and visible in guest quotes. Online payments are not connected.',
        'Anonymous demo funnel': 'Booking request activity',
        'SQLite démo': 'Registre des opérations',
        'écritures de démonstration': 'écritures des opérations',
        'base de démonstration': 'base des opérations',
        'données de démonstration': 'données des opérations',
        'réservation de test': 'réservation',
        'demande de test': 'demande',
        'Demandes de test': 'Demandes',
        'API de démo': 'Service des opérations',
        'chargement des données de test': 'chargement des opérations',
        'chargement des intents locaux': 'chargement des demandes de paiement',
        'Chargement des intents locaux': 'Chargement des demandes de paiement',
    }.items():
        text = text.replace(old, new)
    # Operational pricing has no anonymous funnel collector.
    text = text.replace('Price admin (demo)', 'Gestion des tarifs')
    import re
    text = re.sub(r'<select[^>]*data-role-switch[^>]*>.*?</select>', '<span class="scoped-pill" data-role-label>Personnel</span>', text, flags=re.S)
    if normalized.startswith('/studio') and '/operations/i18n.js' not in text:
        stylesheet = '<link rel="stylesheet" href="/operations/i18n.css">'
        locale_script = '<script defer src="/operations/i18n.js"></script>'
        text = text.replace('</head>', stylesheet + '</head>')
        # Ordered deferred scripts initialize localization before application rendering.
        match = re.search(r'<script\b[^>]*src="/operations/(?:staff|login|pricing)\.js"[^>]*></script>', text)
        if match:
            text = text[:match.start()] + locale_script + text[match.start():]
        else:
            text = text.replace('</head>', locale_script + '</head>')
    return text
