import os
import re

STUDIO_DIR = r"D:\code\sciblueocean\public\studio"

OLD_RIBBON = '<div class="demo-ribbon">OPÉRATIONS LOCALES · DONNÉES PERSISTANTES · ENCAISSEMENT EN LIGNE NON CONNECTÉ</div>'
NEW_RIBBON = '<div class="demo-ribbon">SYSTÈME D\'EXPLOITATION EN PRODUCTION · RÉSIDENCE MIAGUE · PASSERELLE EN LIGNE SIMULÉE (VIREMENT BANCAIRE ACTIF)</div>'

OLD_TAG = '<span class="environment-tag">OPÉRATIONS LOCALES</span>'
NEW_TAG = '<span class="environment-tag">PRODUCTION EN DIRECT</span>'

OLD_SIDEBAR = 'API locale : <b data-api-state="">Vérification…</b>'
NEW_SIDEBAR = 'API d\'exploitation : <b data-api-state="">Vérification…</b>'

PRINT_BTN = '<button class="print-button" data-action="print-report" type="button" title="Imprimer le document officiel"><svg aria-hidden="true" class="ui-icon" style="width:14px;height:14px;margin-right:4px;vertical-align:-2px;"><use href="/experience/assets/icons.svg#printer"></use></svg><span>Imprimer</span></button>'

count = 0
for root, dirs, files in os.walk(STUDIO_DIR):
    for f in files:
        if f == "index.html":
            path = os.path.join(root, f)
            with open(path, "r", encoding="utf-8") as fp:
                content = fp.read()
            
            modified = False
            if OLD_RIBBON in content:
                content = content.replace(OLD_RIBBON, NEW_RIBBON)
                modified = True
            
            if OLD_TAG in content:
                content = content.replace(OLD_TAG, NEW_TAG)
                modified = True
            
            if OLD_SIDEBAR in content:
                content = content.replace(OLD_SIDEBAR, NEW_SIDEBAR)
                modified = True

            # Add print button if not already present in heading-buttons
            page_name = os.path.basename(root)
            if 'class="print-button"' not in content and '<div class="heading-buttons">' in content:
                content = content.replace('<div class="heading-buttons">', f'<div class="heading-buttons">{PRINT_BTN}')
                modified = True
                print(f"Added print button to {page_name}")

            if modified:
                with open(path, "w", encoding="utf-8") as fp:
                    fp.write(content)
                count += 1
                print(f"Updated {page_name}/index.html")

print(f"Total updated studio files: {count}")
