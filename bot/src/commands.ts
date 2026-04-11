import {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getConfig } from "./config";
import { addUser, removeUserByDiscordId, getAllUsers, getUsersByDiscordId, getUsersByDiscordIdAndPlatform } from "./users";
import { logCommand } from "./logger";

// ── Command definitions ────────────────────────────────────────────────────────

export const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure streaming platform notifications")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Link a platform username to the bot")
        .addStringOption((opt) =>
          opt
            .setName("platform")
            .setDescription("Streaming platform")
            .setRequired(true)
            .addChoices(
              { name: "Twitch", value: "twitch" },
              { name: "Kick", value: "kick" },
              { name: "YouTube", value: "youtube" }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName("username")
            .setDescription("Your username on the platform")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove your platform configuration")
        .addStringOption((opt) =>
          opt
            .setName("platform")
            .setDescription("Streaming platform")
            .setRequired(true)
            .addChoices(
              { name: "Twitch", value: "twitch" },
              { name: "Kick", value: "kick" },
              { name: "YouTube", value: "youtube" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Show your configured usernames")
        .addStringOption((opt) =>
          opt
            .setName("platform")
            .setDescription("Streaming platform (optional, shows all)")
            .addChoices(
              { name: "Twitch", value: "twitch" },
              { name: "Kick", value: "kick" },
              { name: "YouTube", value: "youtube" }
            )
        )
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Admin-only management commands")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("list-all")
        .setDescription("List all configured users for a platform")
        .addStringOption((opt) =>
          opt
            .setName("platform")
            .setDescription("Streaming platform")
            .setRequired(true)
            .addChoices(
              { name: "Twitch", value: "twitch" },
              { name: "Kick", value: "kick" },
              { name: "YouTube", value: "youtube" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove-user")
        .setDescription("Remove a user's platform configuration")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("The Discord user to remove")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("platform")
            .setDescription("Streaming platform")
            .setRequired(true)
            .addChoices(
              { name: "Twitch", value: "twitch" },
              { name: "Kick", value: "kick" },
              { name: "YouTube", value: "youtube" }
            )
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
  const platform = interaction.options.getString("platform", false)?.toLowerCase();
  const username = interaction.options.getString("username", false)?.toLowerCase();
  const userId = interaction.user.id;
  const discordUsername = interaction.user.username;

  if (sub === "add") {
    logCommand("setup add", discordUsername, `${platform}: ${username}`);

    // Validate: no spaces, reasonable length
    if (!username || /\s/.test(username) || username.length < 3 || username.length > 25) {
      await interaction.reply({
        content: "❌ Invalid username. Must be 3-25 characters, no spaces.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Validate platform
    if (!["twitch", "kick", "youtube"].includes(platform || "")) {
      await interaction.reply({
        content: "❌ Invalid platform. Choose from: twitch, kick, youtube",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Add to user config
    await addUser(userId, discordUsername, username, platform!);

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
      content: `✅ **${platform}** username **${username}** saved! You will now be monitored for live streams.${roleMsg}`,
      flags: MessageFlags.Ephemeral,
    });
  } else if (sub === "remove") {
    logCommand("setup remove", discordUsername, platform || "all");
    const removed = await removeUserByDiscordId(userId, platform || undefined);

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
        content: "❌ You have no configuration to remove.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const roleMsg = roleRemoved ? "\n🔻 Streamer role removed." : "";
    await interaction.reply({
      content: `✅ Your **${platform || "platform"}** configuration has been removed.${roleMsg}`,
      flags: MessageFlags.Ephemeral,
    });
  } else if (sub === "list") {
    logCommand("setup list", discordUsername, platform || "all");
    const users = platform 
      ? getUsersByDiscordIdAndPlatform(userId, platform) 
      : getUsersByDiscordId(userId);
    
    if (!users || users.length === 0) {
      const msg = platform 
        ? `❌ You have no ${platform} username configured. Use \`/setup add ${platform} <username>\` to set one.`
        : "❌ You have no usernames configured. Use `/setup add <platform> <username>` to set one.";
      await interaction.reply({
        content: msg,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    
    const lines = users.map((u) => `• **${u.platform}**: ${u.username}`).join("\n");
    await interaction.reply({
      content: `📺 Your configured usernames:\n${lines}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleAdmin(interaction: ChatInputCommandInteraction): Promise<void> {
  // Permission check (also enforced by Discord, but defense in depth)
  const member = interaction.member;
  if (!member || !(member as any).permissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: "❌ You need the **Manage Roles** permission to use this command.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const platform = interaction.options.getString("platform", false)?.toLowerCase();

  if (sub === "list-all") {
    logCommand("admin list-all", interaction.user.username, platform || "all");
    const users = getAllUsers(platform || undefined);
    if (users.length === 0) {
      await interaction.reply({ content: "📋 No users configured.", flags: MessageFlags.Ephemeral });
      return;
    }
    const lines = users.map(
      (u) => `• <@${u.discordUserId}> → ${u.platform}.tv/${u.username} (added ${u.addedAt})`
    );
    await interaction.reply({
      content: `📋 **Configured users (${users.length}):**\n${lines.join("\n")}`,
      flags: MessageFlags.Ephemeral,
    });
  } else if (sub === "remove-user") {
    const target = interaction.options.getUser("user", true);
    logCommand("admin remove-user", interaction.user.username, `target: ${target.username}, platform: ${platform}`);
    const removed = await removeUserByDiscordId(target.id, platform || undefined);

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
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: `✅ <@${target.id}>'s Twitch configuration has been removed.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
