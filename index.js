const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  SlashCommandBuilder,
  MessageFlags
} = require("discord.js");

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1489203701322354729";
const GUILD_ID = "1444442307150483730";
const DISPATCHER_ROLE = "Dispatcher";
const CHANNEL_ID = "1448140712985104520";

// ===== CLIENT =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ===== DATA =====
let queue = [];
let statuses = {};
let callLogs = [];
let rotation90 = 0;
let rotation33 = 0;
let current90 = "None";
let current33 = "None";
let logsPage = 0;

let dispatchMessage = null;
let logsMessage = null;

// ===== HELPERS =====
function getStatus(id) {
  return statuses[id] || "10-41";
}

function isDispatcher(member) {
  return member.roles.cache.some(r => r.name === DISPATCHER_ROLE);
}

function getAvailableUnits() {
  return queue.filter(u => getStatus(u.id) === "10-41");
}

// ===== MAIN EMBED =====
function buildEmbed(lastCall = "None") {
  const available = getAvailableUnits();

  const list = available.length
    ? available.map(u => {
        const member = client.guilds.cache
          .get(GUILD_ID)
          ?.members.cache.get(u.id);

        return `• ${member?.nickname || member?.user?.username || u.name}`;
      }).join("\n")
    : "No units on duty";

  const next90 = available.length
    ? available[rotation90 % available.length]?.name
    : "None";

  const next33 = available.length
    ? available[rotation33 % available.length]?.name
    : "None";

  return new EmbedBuilder()
    .setTitle("🚑 CRIMSON CITY MEDICAL MDT")
    .setColor(0x8B0000)
    .setDescription(
      `**DISPATCH OVERVIEW**\n\n` +
      `🔵 **10-90**\n` +
      `Current: ${current90}\n` +
      `Next: ${next90}\n\n` +
      `🔴 **10-33**\n` +
      `Current: ${current33}\n` +
      `Next: ${next33}`
    )
    .addFields({
      name: "🟢 ON DUTY UNITS (10-41)",
      value: list
    })
    .setFooter({
      text: `Crimson City Medical Department • Last: ${lastCall}`
    })
    .setTimestamp();
}

// ===== LOG EMBED =====
function buildLogsEmbed() {
  const perPage = 6;
  const totalPages = Math.max(1, Math.ceil(callLogs.length / perPage));

  if (logsPage >= totalPages) logsPage = totalPages - 1;

  const reversed = [...callLogs].reverse();
  const start = logsPage * perPage;
  const logs = reversed.slice(start, start + perPage);

  const format = (text, length) => {
    if (!text) return "".padEnd(length, " ");
    return text.length > length
      ? text.slice(0, length - 1) + "…"
      : text.padEnd(length, " ");
  };

  const table = logs.length
    ? logs.map(log =>
        `${format(log.type, 6)} │ ${format(log.responder, 12)} │ ${format(log.dispatcher, 12)} │ ${format(log.time, 8)}`
      ).join("\n")
    : "No recent activity";

  return new EmbedBuilder()
    .setTitle("🧾 EMS CALL LOGS")
    .setColor(0x5A0000)
    .setDescription(
      "```" +
      "TYPE   │ RESPONDER   │ DISPATCHER  │ TIME\n" +
      "───────┼─────────────┼─────────────┼────────\n" +
      table +
      "```"
    )
    .setFooter({ text: `Page ${logsPage + 1} / ${totalPages}` })
    .setTimestamp();
}

// ===== BUTTONS =====
function getMainButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("next_90")
      .setLabel("Next 10-90")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("next_33")
      .setLabel("Next 10-33")
      .setStyle(ButtonStyle.Secondary)
  );
}

function getLogButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("prev_logs").setLabel("⬅️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("next_logs").setLabel("➡️").setStyle(ButtonStyle.Secondary)
  );
}

// ===== UPDATE PANELS =====
async function updateLogsPanel(channel) {
  if (!logsMessage) {
    logsMessage = await channel.send({
      embeds: [buildLogsEmbed()],
      components: [getLogButtons()]
    });
  } else {
    await logsMessage.edit({
      embeds: [buildLogsEmbed()],
      components: [getLogButtons()]
    });
  }
}

async function updatePanel(channel, lastCall = "None") {
  if (!dispatchMessage) {
    dispatchMessage = await channel.send({
      embeds: [buildEmbed(lastCall)],
      components: [getMainButtons()]
    });
  } else {
    await dispatchMessage.edit({
      embeds: [buildEmbed(lastCall)],
      components: [getMainButtons()]
    });
  }
}

// ===== READY =====
client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(CHANNEL_ID);

  await updateLogsPanel(channel);
  await updatePanel(channel);
});

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add unit")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove unit")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Update status")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o =>
      o.setName("status").setDescription("Status").setRequired(true)
        .addChoices(
          { name: "10-41", value: "10-41" },
          { name: "10-7", value: "10-7" },
          { name: "10-6", value: "10-6" }
        )
    ),

  new SlashCommandBuilder()
    .setName("reset")
    .setDescription("Reset system")
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log("✅ Slash commands registered");
})();

// ===== INTERACTIONS =====
client.on("interactionCreate", async interaction => {

  if (interaction.isChatInputCommand()) {

    if (!isDispatcher(interaction.member)) {
      return interaction.reply({ content: "❌ Dispatcher only", flags: MessageFlags.Ephemeral });
    }

    const channel = await client.channels.fetch(CHANNEL_ID);

    if (interaction.commandName === "add") {
      const user = interaction.options.getUser("user");
      const member = await interaction.guild.members.fetch(user.id);

      if (!queue.find(u => u.id === user.id)) {
        queue.push({ id: user.id, name: member.nickname || user.username });
        statuses[user.id] = "10-41";
      }

      await updatePanel(channel);
      return interaction.reply({ content: "✅ Added", flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === "remove") {
      const user = interaction.options.getUser("user");
      queue = queue.filter(u => u.id !== user.id);
      delete statuses[user.id];

      await updatePanel(channel);
      return interaction.reply({ content: "❌ Removed", flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === "status") {
      const user = interaction.options.getUser("user");
      const status = interaction.options.getString("status");

      statuses[user.id] = status;
      await updatePanel(channel);

      return interaction.reply({ content: "📻 Status updated", flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === "reset") {
      queue = [];
      statuses = {};
      callLogs = [];
      rotation90 = 0;
      rotation33 = 0;
      current90 = "None";
      current33 = "None";

      await updateLogsPanel(channel);
      await updatePanel(channel);

      return interaction.reply({ content: "♻️ Reset", flags: MessageFlags.Ephemeral });
    }
  }

  if (interaction.isButton()) {

    if (!isDispatcher(interaction.member)) {
      return interaction.reply({ content: "❌ Dispatcher only", flags: MessageFlags.Ephemeral });
    }

    await interaction.deferUpdate();

    const channel = await client.channels.fetch(CHANNEL_ID);

    if (interaction.customId === "next_logs") {
      logsPage++;
      await updateLogsPanel(channel);
      return;
    }

    if (interaction.customId === "prev_logs") {
      logsPage = Math.max(0, logsPage - 1);
      await updateLogsPanel(channel);
      return;
    }

    const available = getAvailableUnits();
    if (available.length === 0) return;

    const dispatcher = interaction.member.nickname || interaction.user.username;
    const time = new Date().toLocaleTimeString();

    if (interaction.customId === "next_90") {
      const unit = available[rotation90 % available.length];
      rotation90 = (rotation90 + 1) % available.length;

      current90 = unit.name;

      callLogs.push({ type: "10-90", responder: unit.name, dispatcher, time });

      await updatePanel(channel, `10-90 → ${unit.name}`);
      await updateLogsPanel(channel);
    }

    if (interaction.customId === "next_33") {
      const unit = available[rotation33 % available.length];
      rotation33 = (rotation33 + 1) % available.length;

      current33 = unit.name;

      callLogs.push({ type: "10-33", responder: unit.name, dispatcher, time });

      await updatePanel(channel, `10-33 → ${unit.name}`);
      await updateLogsPanel(channel);
    }
  }
});

client.login(TOKEN);