# Pipelines de données

Deux chaînes automatiques alimentent les jeux. Elles **proposent**, un
administrateur **valide** dans `/admin` → onglet **Données** : rien n'arrive
dans un jeu sans vérification humaine.

Les commandes se lancent depuis `server/`, là où `beatbox_artists/` est
disponible (machine de dev ou hôte du VPS ; le conteneur convient aussi pour
les scripts Node, `beatbox_artists/` y est monté).

## Photos du Buzzer Battle

```bash
npm run photos:collect                 # 1. cherche les photos manquantes
pip install -r scripts/photos/requirements.txt
python scripts/photos/faces.py         # 2. visages : tri, recadrage, doublons
# 3. /admin → Données → Photos Buzzer
npm run photos:clean                   # (plus tard) libère la place des fiches traitées
```

- **Liste de travail** : les cases blanches du Google Sheet (`credentials.json`
  à la racine du dépôt). Sans ce fichier, les entrées de `beatboxers.json`
  sans `local_image`. Les cases rouges sont ignorées.
- **Sources** : photo de profil beatbox.world, image principale du Beatbox
  Wiki, photo de chaîne YouTube, miniatures et images clés (25/50/75 %) de
  vidéos où le beatboxer apparaît.
- **Options utiles** : `--limit 50`, `--names "Max0,D-Low"`, `--force`,
  `--sources beatboxworld,wiki`, `--from json`. `faces.py --deep` extrait en
  plus des images au fil de la vidéo (yt-dlp + ffmpeg).
- **Validation** : la photo est copiée dans `beatbox_artists/` sous le nom
  attendu par `scan_images.py`, `local_image` est renseigné et le Buzzer
  Battle rechargé. Relancer ensuite `python scan_images.py` colorie le Sheet
  en vert. Une validation s'annule depuis l'onglet « Validées ».
- **Duos et crews** : reconnus via beatbox.world (page d'équipe), le wiki
  (catégorie Groups) ou le nom (« A & B », « A x B »). La photo doit alors
  montrer tous les membres : `faces.py` produit des recadrages de groupe et
  pénalise les images à un seul visage. Détection corrigeable dans la fiche
  (« C'est un duo / crew »), puis `faces.py --force --keys <clé>`.
- **Texte sur la photo** (nom du beatboxer sur une miniature) : bouton
  « Effacer le texte » sous la photo. Les demandes sont traitées par
  `python scripts/photos/clean_text.py --watch`, à laisser tourner sur
  l'hôte pendant la revue ; l'image nettoyée apparaît dans la fiche quelques
  secondes plus tard. Détection automatique avec EasyOCR, remplissage avec
  LaMa s'ils sont installés, sinon zones tracées à la main + OpenCV.
- Fichiers de travail : `beatbox_artists/review/photos/<clé>/`.

## Titres du Beatboxdle

```bash
npm run beatboxdle:profiles    # relit les fiches (cache : quasi instantané)
npm run beatboxdle:wiki        # palmarès du Beatbox Wiki
npm run beatboxdle:enrich      # propositions de titres
# /admin → Données → Titres Beatboxdle, puis « Reconstruire la base »
```

`npm run beatboxdle:all` enchaîne tout le pipeline, enrichissement compris.

- Le titre affiché n'est plus limité au GBB et au championnat du monde :
  continental, national, grands battles internationaux sont pris en compte et
  pondérés (`TITLE_*` dans `beatboxdle/config.js`).
- `beatboxdle/reports/evenements-non-classes.csv` liste les événements que
  la classification ne connaît pas, du plus fréquent au plus rare : c'est la
  liste à compléter dans `TITLE_INTL_EVENTS`.
- Seuls les titres validés sont repris par `build.js`
  (`beatboxdle/reviewed-titles.json`) ; `overrides.json` reste prioritaire.
- « Reconstruire la base » refuse d'écrire si la réponse du jour changerait
  (profils recrawlés depuis la dernière construction) : le faire juste après
  minuit, ou forcer en connaissance de cause.
