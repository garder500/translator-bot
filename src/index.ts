import {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  Partials,
  type Message,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type User,
} from "discord.js";
import { flagToLanguage } from "./flags.ts";
import { sameLanguage, translate } from "./translate.ts";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("DISCORD_TOKEN manquant (voir .env.example).");
  process.exit(1);
}

const UI_LOCALE = process.env.UI_LOCALE || "fr";
const COOLDOWN_MS = Number(process.env.COOLDOWN_MS ?? 1500);
const REMOVE_REACTION = (process.env.REMOVE_REACTION ?? "true").toLowerCase() !== "false";
const MAX_SOURCE_CHARS = 6000;
const EMBED_DESCRIPTION_MAX = 4096;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.MessageContent, // intent privilégié : à activer dans le portail développeur
  ],
  // Nécessaire pour recevoir les réactions sur des messages/salons non présents en cache.
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
  allowedMentions: { parse: [] },
});

const labels = (() => {
  const fr = UI_LOCALE.toLowerCase().startsWith("fr");
  return {
    title: (lang: string) => (fr ? `Traduction en ${lang}` : `Translation to ${lang}`),
    from: (lang: string) => (fr ? `Langue détectée : ${lang}` : `Detected language: ${lang}`),
    open: fr ? "Message d'origine" : "Original message",
    sameLang: (lang: string) =>
      fr ? `Ce message est déjà en ${lang}.` : `This message is already in ${lang}.`,
    empty: fr ? "Ce message ne contient aucun texte à traduire." : "This message has no text to translate.",
    failed: fr ? "La traduction a échoué, réessaie dans un instant." : "Translation failed, please try again shortly.",
  };
})();

function languageName(code: string): string {
  try {
    return new Intl.DisplayNames([UI_LOCALE], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Texte traduisible d'un message : contenu + texte des embeds (liens enrichis, etc.). */
function extractText(message: Message): string {
  const parts: string[] = [];
  if (message.content) parts.push(message.content);
  for (const embed of message.embeds) {
    if (embed.title) parts.push(embed.title);
    if (embed.description) parts.push(embed.description);
  }
  return parts.join("\n\n").trim().slice(0, MAX_SOURCE_CHARS);
}

const lastRequest = new Map<string, number>();
function onCooldown(userId: string): boolean {
  const now = Date.now();
  const last = lastRequest.get(userId) ?? 0;
  if (now - last < COOLDOWN_MS) return true;
  lastRequest.set(userId, now);
  if (lastRequest.size > 5000) {
    for (const [id, ts] of lastRequest) if (now - ts > 60_000) lastRequest.delete(id);
  }
  return false;
}

async function removeReaction(reaction: MessageReaction, user: User) {
  if (!REMOVE_REACTION || !reaction.message.guildId) return; // pas de suppression possible en MP
  try {
    await reaction.users.remove(user.id);
  } catch (err) {
    console.warn(
      `[reaction] impossible de retirer la réaction (permission « Gérer les messages » manquante ?) :`,
      err instanceof Error ? err.message : err,
    );
  }
}

async function sendPrivate(user: User, payload: { content?: string; embeds?: EmbedBuilder[] }) {
  try {
    await user.send(payload);
  } catch (err) {
    console.warn(
      `[dm] envoi impossible à ${user.tag} (MP fermés ?) :`,
      err instanceof Error ? err.message : err,
    );
  }
}

async function handleReaction(rawReaction: MessageReaction | PartialMessageReaction, rawUser: User | PartialUser) {
  if (rawUser.bot) return;
  const target = flagToLanguage(rawReaction.emoji.name);
  if (!target) return; // ce n'est pas un drapeau géré : on ne touche à rien

  const [reaction, user] = await Promise.all([
    rawReaction.partial ? rawReaction.fetch() : rawReaction,
    rawUser.partial ? rawUser.fetch() : rawUser,
  ]);
  const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;

  // Retire le drapeau tout de suite : seul l'utilisateur voit le résultat, en privé.
  const removal = removeReaction(reaction, user);

  if (onCooldown(user.id)) {
    await removal;
    return;
  }

  const sourceUrl = message.url;
  const text = extractText(message);
  const targetName = languageName(target.language);

  if (!text) {
    await Promise.all([removal, sendPrivate(user, { content: `${reaction.emoji.name} ${labels.empty}\n${sourceUrl}` })]);
    return;
  }

  try {
    const result = await translate(text, target.language);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({
        name: message.author?.displayName ?? message.author?.username ?? "?",
        iconURL: message.author?.displayAvatarURL(),
      })
      .setTitle(`${reaction.emoji.name} ${labels.title(targetName)}`)
      .setDescription(
        (sameLanguage(result.detectedLanguage, target.language)
          ? `*${labels.sameLang(targetName)}*\n\n`
          : "") + result.text.slice(0, EMBED_DESCRIPTION_MAX),
      )
      .addFields({ name: labels.open, value: `[→](${sourceUrl})`, inline: true })
      .setFooter({
        text: [
          result.detectedLanguage ? labels.from(languageName(result.detectedLanguage)) : null,
          result.provider,
        ]
          .filter(Boolean)
          .join(" • "),
      });
    await Promise.all([removal, sendPrivate(user, { embeds: [embed] })]);
  } catch (err) {
    console.error("[translate]", err instanceof Error ? err.message : err);
    await Promise.all([removal, sendPrivate(user, { content: `${reaction.emoji.name} ${labels.failed}\n${sourceUrl}` })]);
  }
}

client.on(Events.MessageReactionAdd, (reaction, user) => {
  handleReaction(reaction, user).catch((err) =>
    console.error("[reaction]", err instanceof Error ? err.message : err),
  );
});

client.once(Events.ClientReady, (c) => {
  console.log(`Connecté en tant que ${c.user.tag} sur ${c.guilds.cache.size} serveur(s).`);
});

client.on(Events.Error, (err) => console.error("[client]", err));

const shutdown = () => {
  console.log("Arrêt…");
  client.destroy().finally(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await client.login(token);
