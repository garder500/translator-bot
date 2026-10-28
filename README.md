# translator-bot

Bot Discord en **Bun** : réagis à n'importe quel message avec un **drapeau de pays** et le bot te
envoie la traduction du message dans la langue de ce pays (ex. message en espagnol + 🇫🇷 → traduction
française). La réaction-drapeau est ensuite retirée automatiquement.

## Traduction « privée »

Discord n'autorise les messages *éphémères* (visibles par une seule personne) que en réponse à une
**interaction** (slash command, bouton…). Une réaction n'en est pas une, donc un vrai message éphémère
est impossible dans ce cas. Le bot envoie donc la traduction **en message privé** : toi seul la vois,
personne d'autre sur le salon ne voit quoi que ce soit, et ton drapeau disparaît. Si tes MP sont
fermés pour le serveur, le bot ne peut rien t'envoyer (il le note dans ses logs).

## API de traduction

- **Principal** : endpoint public de Google Translate (`translate.googleapis.com`) — gratuit, sans clé,
  détection automatique de la langue source.
- **Secours** : [MyMemory](https://mymemory.translated.net) — gratuit, sans clé (quota journalier plus bas ;
  `MYMEMORY_EMAIL` le relève).
- Cache en mémoire (1 h), dédoublonnage des requêtes identiques et délai anti-spam par utilisateur
  pour limiter la charge.

> L'endpoint Google est public mais non officiel : il peut changer ou limiter le débit sans préavis, d'où le secours.

## Configuration Discord

1. Crée une application sur <https://discord.com/developers/applications>, ajoute un bot, copie le token.
2. Dans l'onglet **Bot**, active l'intent privilégié **Message Content Intent** (nécessaire pour lire le texte).
3. Invite le bot avec les permissions : *Voir les salons*, *Lire l'historique des messages*,
   *Gérer les messages* (pour retirer ta réaction ; sans cela la traduction marche mais le drapeau reste).

## Lancer

```bash
cp .env.example .env   # renseigne DISCORD_TOKEN
bun install
bun start
```

### Docker

```bash
docker build -t translator-bot .
docker run -d --name translator-bot --restart unless-stopped --env-file .env translator-bot
```

Une image multi-architecture (amd64/arm64) est publiée automatiquement sur GitHub Container Registry
par la CI (`.github/workflows/ci.yml`) à chaque push sur `main` (`latest`) et à chaque tag `v*` :

```bash
docker run -d --restart unless-stopped --env-file .env ghcr.io/garder500/translator-bot:latest
```

## Variables d'environnement

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `DISCORD_TOKEN` | — | Token du bot (obligatoire) |
| `UI_LOCALE` | `fr` | Langue des libellés (`fr` ou `en`) et des noms de langues |
| `COOLDOWN_MS` | `1500` | Délai minimum entre deux traductions d'un même utilisateur |
| `REMOVE_REACTION` | `true` | Retire le drapeau après traduction |
| `MYMEMORY_EMAIL` | — | Optionnel, relève le quota du service de secours |

## Développement

```bash
bun test
bun run typecheck
```
