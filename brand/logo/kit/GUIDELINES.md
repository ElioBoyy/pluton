# Pluton — Guide d'usage du logo

## 1. Le logo

**Idée.** Un disque coupé selon une ligne à 17°, dont les deux moitiés glissent l'une contre l'autre. Une seule coupe, un seul décalage : une forme qui bouge, sans fusée ni flèche. (17° est l'inclinaison de l'orbite de Pluton. C'est un détail à raconter, pas à expliquer.)

**Versions**

| Version | Fichier | Quand l'utiliser |
|---|---|---|
| Horizontale (principale) | `pluton-horizontal.svg` | Partout par défaut : site, app, documents |
| Empilée | `pluton-stacked.svg` | Formats carrés ou étroits : affiche, slide de titre, goodies |
| Symbole seul | `pluton-symbol.svg` | Quand le nom est déjà présent : avatar, icône, filigrane |
| Symbole petite taille | `pluton-symbol-small.svg` | En dessous de 48 px : coupe plus large qui ne se referme pas |
| Wordmark seul | `pluton-wordmark.svg` | Rarement : quand le symbole apparaît déjà à côté |

Chaque version existe en couleur, en noir (`-black`) et en blanc (`-white`). Les versions blanches ont une coupe légèrement plus ouverte, pour compenser l'effet de halo du blanc sur fond sombre.

## 2. Zone de protection

Garde autour du logo un espace vide d'au moins **X** de chaque côté, où **X = la hauteur du « u » du wordmark** (sa hauteur d'x). Pour le symbole seul, X = la moitié de la hauteur du symbole (c'est la même mesure). Cette zone suit la taille du logo : ce n'est jamais une distance fixe.

## 3. Tailles minimales

| Version | Écran | Impression |
|---|---|---|
| Horizontale | 96 px de large | 25 mm de large |
| Empilée | 64 px de large | 18 mm de large |
| Symbole | 16 px (fichier `-small` ou `favicon.svg`) | 5 mm |

## 4. Couleurs

| Nom | HEX | RGB | CMJN | Pantone (le plus proche, à valider sur nuancier) |
|---|---|---|---|---|
| **Outremer** (symbole) | `#2B3BFF` | 43 · 59 · 255 | 83 · 77 · 0 · 0 | 2728 C |
| **Encre** (wordmark, textes) | `#101018` | 16 · 16 · 24 | 33 · 33 · 0 · 91 | Black 6 C |
| Blanc | `#FFFFFF` | 255 · 255 · 255 | 0 · 0 · 0 · 0 | — |

Contrastes : outremer sur blanc 6,6:1 · encre sur blanc 18,9:1 · outremer sur encre 2,9:1 (réservé au symbole, jamais pour du texte).

**Associations autorisées**
- Couleur (symbole outremer, wordmark encre) sur blanc ou fond très clair.
- Symbole outremer et wordmark blanc sur encre (`pluton-horizontal-on-ink.svg`).
- Tout blanc sur outremer ou sur encre.
- Tout noir sur blanc, pour l'impression une couleur.
- Sur une photo : la version blanche ou noire, sur une zone calme de l'image.

L'outremer est la couleur de la marque, pas celle de l'interface : dans l'app, l'accent reste le bleu système de macOS.

## 5. Typographie

- **Wordmark** : lettres construites sur mesure (traits de 24 unités, boucles circulaires). Ce n'est pas une police : n'essaie jamais de le recomposer en tapant « pluton ».
- **Textes** : la police système d'Apple (SF Pro), avec Inter en repli, comme dans l'app.

## 6. À ne pas faire

- Ne pas étirer, écraser ni pencher le logo.
- Ne pas changer l'angle de la coupe, son épaisseur ni le décalage des deux moitiés.
- Ne pas faire tourner le symbole.
- Ne pas changer les couleurs en dehors de la palette.
- Ne pas ajouter d'ombre, de contour, de dégradé ni d'effet.
- Ne pas changer les proportions ni l'espacement entre le symbole et le wordmark.
- Ne pas poser le logo sur un fond chargé sans le placer dans un conteneur.

## 7. Fichiers

- `*.svg` : les masters vectoriels, à utiliser en priorité.
- `png/` : les lockups en PNG transparents, 1 200 px de large.
- `web/` : favicon (`favicon.ico`, `favicon.svg`, PNG 16/32/48), `apple-touch-icon.png`, icônes 192/512 et maskable, `site.webmanifest` et `head-snippet.html` à coller dans le `<head>`.
- `presentation.html` et `slides/` : la présentation du logo avec ses mises en situation.
- `../build_kit.py` régénère tous les masters à partir de la géométrie.
