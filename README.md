# MMM-LittleBockFermentationLog

**MMM-LittleBockFermentationLog** est un module pour [MagicMirror²](https://github.com/MichMich/MagicMirror) qui permet d'afficher le suivi de la fermentation de brassins de bière en utilisant l'API de Little Bock.

### Layout horizontal
![Layout Horizontal](screenshots/screenshot_1.png)
### Layout CardsOnly
![Layout cardsOnly](screenshots/screenshot_2.png)


## Installation

Clonez ce dépôt dans votre dossier de modules MagicMirror :

```bash
cd ~/MagicMirror/modules
git clone https://github.com/SBrendan/MMM-LittleBockFermentationLog
```

## Configuration

Vous pouvez ajouter le module dans le fichier `config.js` de MagicMirror avec les options suivantes :

| Option             | Valeur par défaut   | Description                                                                                                                                                                                                |
| ------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiToken`         | `""`                | **Obligatoire**. Votre token d'API Little Bock. <br> **Type**: `string`                                                                                                                                    |
| `brewSessionID`    | `0`                 | **Obligatoire**. L'ID de la session de brassage à afficher. <br> **Type**: `string`                                                                                                                        |
| `updateInterval`   | `3600000` (1 heure) | Intervalle de mise à jour des données en millisecondes. <br> **Type**: `integer` <br>                                                                                                                      |
| `animationSpeed`   | `1000`              | Vitesse de l'animation lors de la mise à jour des informations. <br> **Type**: `integer` <br>                                                                                                              |
| `layout`           | `"horizontal"`      | Choix de l'agencement des éléments (graphique et cartes). <br> **Type**: `string` <br> **Valeurs possibles**: `"cardsOnly"`, `"horizontal"` <br>                                                           |

### Exemple de configuration dans `config.js`

```js
{
    module: "MMM-LittleBockFermentationLog",
    position: "top_right",
    config: {
        apiToken: "VOTRE_TOKEN",
        brewSessionID: "57094",
        updateInterval: 60 * 60 * 1000, // Mise à jour toutes les heures
        animationSpeed: 1000, // 1 seconde
        layout: "horizontal", // Choix du layout : cardsOnly, horizontal
}
},
```

## Cache et Limite de Taux d'API

Le module utilise un système de cache pour éviter de dépasser la limite de 150 requêtes par heure imposée par Little Bock. À l'initialisation, toutes les pages de données de fermentation sont chargées et stockées en cache. Par la suite, le module ne vérifie que les nouvelles pages disponibles toutes les heures, ce qui permet de limiter les appels à l'API tout en s'assurant que les données restent à jour.

## Fonctionnalités

- **Affichage du suivi de la fermentation** : Le module affiche la température, la densité, le taux d'alcool estimé et l'atténuation dans une grille de cartes et/ou un graphique.
- **Layouts personnalisables** : Choisissez entre l'affichage de seulement les cartes, un layout vertical ou horizontal pour adapter le module à vos préférences.
- **Cache de données** : Le module utilise un cache pour réduire les appels à l'API, récupérant toutes les pages au démarrage, et vérifiant les nouvelles pages disponibles toutes les heures.

## Remerciements

- Merci à l'équipe de [Little Bock](https://www.littlebock.fr/) pour leur API et leur soutien à la communauté des brasseurs.
- Un grand merci à [Michael Teeuw](https://github.com/MichMich) pour la création de [MagicMirror²](https://github.com/MichMich/MagicMirror), le framework qui a rendu ce module possible.

