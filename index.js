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

let dispatchMessage = null;
let logsMessage = null;

// ===== HELPERS =====
function getStatus(id) {
  return statuses[id] || "10-41";
}

function isDispatcher(member) {
  return member.roles.cache.some(r => r.name === DISPATCHER_ROLE);
}

// ⚡ FAST NAME (CACHED)
function getName(id) {
  const unit = queue.find(u => u.id === id);
  return unit?.name || "Unknown";
}

function getAvailableUnits() {
  return queue.filter(u => getStatus(u.id) === "10-41");
}

function getBreakUnits() {
  return queue.filter(u => getStatus(u.id) === "10-7");
}

// ===== EMBED =====
function buildEmbed(lastCall = "None") {
  const available = getAvailableUnits();
  const breakUnits = getBreakUnits();

  const dutyList = available.length
    ? available.map(u => `• ${u.name}`).join("\n")
    : "No active units";

  const breakList = breakUnits.length
    ? breakUnits.map(u => `• ${u.name}`).join("\n")
    : "No units on standby";

  const next90 = available.length
    ? available[rotation90 % available.length].name
    : "None";

  const next33 = available.length
    ? available[rotation33 % available.length].name
    : "None";

  return new EmbedBuilder()
    .setTitle("🚑 CCMD DISPATCH ROTATION")
    .setColor(0x8B0000)
    .setDescription(
      `🚨 **ACTIVE DISPATCH**\n\n` +
      `🔵 10-90 → ${current90}\n` +
      `🔴 10-33 → ${current33}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `📊 **QUEUE STATUS**\n\n` +
      `🔵 Next 10-90 → ${next90}\n` +
      `🔴 Next 10-33 → ${next33}`
    )
    .addFields(
      { name: "🟢 ON DUTY (10-41)", value: dutyList },
      { name: "🟡 ON BREAK (10-7)", value: breakList }
    )
    .setFooter({
      text: `Crimson City Medical Department • Last: ${lastCall}`
    })
    .setTimestamp();
}

// ===== LOGS =====
function buildLogsEmbed() {
  const logs = callLogs.slice(-6).reverse();

  const content = logs.length
    ? logs.map(log =>
        `${log.type} → ${log.responder}\nDispatcher: ${log.dispatcher}\nTime: ${log.time}`
      ).join("\n\n")
    : "No recent activity";

  return new EmbedBuilder()
    .setTitle("🧾 EMS CALL LOGS")
    .setColor(0x5A0000)
    .setDescription(content)
    .setTimestamp();
}

// ===== BUTTONS =====
function getMainButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("next_90").setLabel("Next 10-90").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("skip_90").setLabel("Skip 10-90").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("next_33").setLabel("Next 10-33").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("skip_33").setLabel("Skip 10-33").setStyle(ButtonStyle.Secondary)
  );
}

// ===== PANELS =====
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

async function updateLogsPanel(channel) {
  if (!logsMessage) {
    logsMessage = await channel.send({
      embeds: [buildLogsEmbed()]
    });
  } else {
    await logsMessage.edit({
      embeds: [buildLogsEmbed()]
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
  new SlashCommandBuilder().setName("add").setDescription("Add unit").addUserOption(o => o.setName("user").setRequired(true)),
  new SlashCommandBuilder().setName("break").setDescription("Set unit to 10-7").addUserOption(o => o.setName("user").setRequired(true)),
  new SlashCommandBuilder().setName("resume").setDescription("Return unit to 10-41").addUserOption(o => o.setName("user").setRequired(true)),
  new SlashCommandBuilder().setName("remove").setDescription("Remove unit").addUserOption(o => o.setName("user").setRequired(true)),
  new SlashCommandBuilder().setName("reset").setDescription("Reset system")
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
})();

// ===== INTERACTIONS =====
client.on("interactionCreate", async interaction => {

  if (interaction.isChatInputCommand()) {

    if (!isDispatcher(interaction.member)) {
      return interaction.reply({ content: "❌ Dispatcher only", flags: MessageFlags.Ephemeral });
    }

    const channel = await client.channels.fetch(CHANNEL_ID);
    const user = interaction.options.getUser("user");
if (interaction.commandName === "add") {
  const user = interaction.options.getUser("user");

  if (!queue.find(u => u.id === user.id)) {
    queue.push({
      id: user.id,
      name: user.username // 🔥 NO FETCH = NO CRASH
    });
    statuses[user.id] = "10-41";
  }

  await updatePanel(channel);
  return interaction.reply({
    content: "✅ Added",
    flags: MessageFlags.Ephemeral
  });
}

    if (interaction.commandName === "break") {
      if (!queue.find(u => u.id === user.id)) {
        return interaction.reply({ content: "❌ Not in queue", flags: MessageFlags.Ephemeral });
      }

      statuses[user.id] = "10-7";
      await updatePanel(channel);
      return interaction.reply({ content: "🟡 Set to break", flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === "resume") {
      statuses[user.id] = "10-41";
      await updatePanel(channel);
      return interaction.reply({ content: "🟢 Back on duty", flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === "remove") {
      queue = queue.filter(u => u.id !== user.id);
      delete statuses[user.id];

      await updatePanel(channel);
      return interaction.reply({ content: "❌ Removed", flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === "reset") {
      queue = [];
      statuses = {};
      callLogs = [];
      rotation90 = 0;
      rotation33 = 0;
      current90 = "None";
      current33 = "None";

      await updatePanel(channel);
      await updateLogsPanel(channel);

      return interaction.reply({ content: "♻️ Reset", flags: MessageFlags.Ephemeral });
    }
  }

  if (interaction.isButton()) {

    if (!isDispatcher(interaction.member)) return;

    await interaction.deferUpdate();
    const channel = await client.channels.fetch(CHANNEL_ID);
    const available = getAvailableUnits();

    if (!available.length) return;

    const dispatcher = interaction.member.nickname || interaction.user.username;
    const time = new Date().toLocaleTimeString();

    if (interaction.customId === "skip_90") {
      rotation90++;
      return updatePanel(channel);
    }

    if (interaction.customId === "skip_33") {
      rotation33++;
      return updatePanel(channel);
    }

    if (interaction.customId === "next_90") {
      const unit = available[rotation90 % available.length];
      rotation90++;
      current90 = unit.name;

      callLogs.push({
        type: "10-90",
        responder: unit.name,
        dispatcher,
        time
      });

      await updatePanel(channel, `10-90 → ${unit.name}`);
      return updateLogsPanel(channel);
    }

    if (interaction.customId === "next_33") {
      const unit = available[rotation33 % available.length];
      rotation33++;
      current33 = unit.name;

      callLogs.push({
        type: "10-33",
        responder: unit.name,
        dispatcher,
        time
      });

      await updatePanel(channel, `10-33 → ${unit.name}`);
      return updateLogsPanel(channel);
    }
  }
});

client.login(TOKEN);