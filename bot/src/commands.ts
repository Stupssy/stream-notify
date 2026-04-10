import {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getConfig } from "./config";
import { addUser, removeUserByDiscordId, getAllUsers, getUserByDiscordId } from "./users";

// ── Command definitions ────────────────────────────────────────────────────────

export const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure your Twitch channel for stream notifications")
    .addSubcommand((sub) =>
      sub
        .setName("twitch")
        .setDescription("Link your Twitch username to the bot")
        .addStringOption((opt) =>
          opt
            .setName("username")
            .setDescription("Your Twitch username (e.g. stupssy)")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove your Twitch configuration")
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Show your configured Twitch username")
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Admin-only management commands")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("list-all")
        .setDescription("List all configured Twitch users")
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove-user")
        .setDescription("Remove a user's Twitch configuration")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("The Discord user to remove")
            .setRequired(true)
        )
    )
    .toJSON(),
];

// ── Register commands with Discord ─────────────────────────────────────────────

export async function registerCommands(): Promise<void> {
  const { discordBotToken, discordGuildId } = getConfig();
  if (!discordBotToken || !discordGuildId) {
    console.log("[commands] No Discord token or guild ID — skipping command registration");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(discordBotToken);

  try {
    console.log("[commands] Registering slash commands…");
    // Discord bot tokens have the format: base64(client_id).base64(timestamp).random
    // We need to decode the first segment to get the numeric client ID (snowflake).
    const clientId = Buffer.from(discordBotToken.split(".")[0], "base64").toString("utf-8");
    await rest.put(Routes.applicationGuildCommands(clientId, discordGuildId), {
      body: commands,
    });
    console.log("[commands] Slash commands registered ✓");
  } catch (err: any) {
    console.error("[commands] Failed to register commands:", err.message);
  }
}

// ── Interaction handler ────────────────────────────────────────────────────────

export async function handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
  const { commandName } = interaction;

  if (commandName === "setup") {
    await handleSetup(interaction);
  } else if (commandName === "admin") {
    await handleAdmin(interaction);
  }
}

async function handleSetup(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();
  const userId = interaction.user.id;
  const username = interaction.user.username;

  if (sub === "twitch") {
    const twitchUsername = interaction.options.getString("username", true).trim().toLowerCase();

    // Validate: no spaces, reasonable length
    if (/\s/.test(twitchUsername) || twitchUsername.length < 3 || twitchUsername.length > 25) {
      await interaction.reply({
        content: "❌ Invalid Twitch username. Must be 3-25 characters, no spaces.",
        ephemeral: true,
      });
      return;
    }

    // Add to user config
    addUser(userId, username, twitchUsername);

    // Assign streamer role if configured
    const { discordGuildId, discordStreamerRoleId } = getConfig();
    let roleAssigned = false;
    if (discordGuildId && discordStreamerRoleId) {
      try {
        const member = await interaction.guild?.members.fetch(userId);
        if (member && !member.roles.cache.has(discordStreamerRoleId)) {
          await member.roles.add(discordStreamerRoleId);
          roleAssigned = true;
        }
      } catch (err: any) {
        console.warn(`[commands] Could not assign role to ${userId}: ${err.message}`);
      }
    }

    const roleMsg = roleAssigned ? "\n✅ Streamer role assigned!" : "";
    await interaction.reply({
      content: `✅ Twitch username **${twitchUsername}** saved! You will now be monitored for live streams.${roleMsg}`,
      ephemeral: true,
    });
  } else if (sub === "remove") {
    const removed = removeUserByDiscordId(userId);

    // Remove streamer role if configured
    const { discordGuildId, discordStreamerRoleId } = getConfig();
    let roleRemoved = false;
    if (discordGuildId && discordStreamerRoleId) {
      try {
        const member = await interaction.guild?.members.fetch(userId);
        if (member && member.roles.cache.has(discordStreamerRoleId)) {
          await member.roles.remove(discordStreamerRoleId);
          roleRemoved = true;
        }
      } catch (err: any) {
        console.warn(`[commands] Could not remove role from ${userId}: ${err.message}`);
      }
    }

    if (!removed) {
      await interaction.reply({
        content: "❌ You have no Twitch configuration to remove.",
        ephemeral: true,
      });
      return;
    }

    const roleMsg = roleRemoved ? "\n🔻 Streamer role removed." : "";
    await interaction.reply({
      content: `✅ Your Twitch configuration has been removed.${roleMsg}`,
      ephemeral: true,
    });
  } else if (sub === "list") {
    const user = getUserByDiscordId(userId);
    if (!user) {
      await interaction.reply({
        content: "❌ You have no Twitch username configured. Use `/setup twitch <username>` to set one.",
        ephemeral: true,
      });
      return;
    }
    await interaction.reply({
      content: `📺 Your configured Twitch username: **${user.twitchUsername}**`,
      ephemeral: true,
    });
  }
}

async function handleAdmin(interaction: ChatInputCommandInteraction): Promise<void> {
  // Permission check (also enforced by Discord, but defense in depth)
  const member = interaction.member;
  if (!member || !(member as any).permissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: "❌ You need the **Manage Roles** permission to use this command.",
      ephemeral: true,
    });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "list-all") {
    const users = getAllUsers();
    if (users.length === 0) {
      await interaction.reply({ content: "📋 No users configured.", ephemeral: true });
      return;
    }
    const lines = users.map(
      (u) => `• <@${u.discordUserId}> → twitch.tv/${u.twitchUsername} (added ${u.addedAt})`
    );
    await interaction.reply({
      content: `📋 **Configured users (${users.length}):**\n${lines.join("\n")}`,
      ephemeral: true,
    });
  } else if (sub === "remove-user") {
    const target = interaction.options.getUser("user", true);
    const removed = removeUserByDiscordId(target.id);

    // Also try to remove the streamer role
    const { discordGuildId, discordStreamerRoleId } = getConfig();
    if (discordGuildId && discordStreamerRoleId && removed) {
      try {
        const guildMember = await interaction.guild?.members.fetch(target.id);
        if (guildMember && guildMember.roles.cache.has(discordStreamerRoleId)) {
          await guildMember.roles.remove(discordStreamerRoleId);
        }
      } catch (err: any) {
        console.warn(`[commands] Could not remove role from ${target.id}: ${err.message}`);
      }
    }

    if (!removed) {
      await interaction.reply({
        content: `❌ <@${target.id}> has no Twitch configuration.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: `✅ <@${target.id}>'s Twitch configuration has been removed.`,
      ephemeral: true,
    });
  }
}
