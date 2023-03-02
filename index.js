import { Client, Collection, GatewayIntentBits } from "discord.js";
import { config } from "./utils/config.js";
import { importCommands } from "./utils/importCommands.js";
import { messageCreate } from "./utils/messageCreate.js";

const { TOKEN, PREFIX } = config;

const client = new Client({
    restTimeOffset: 0,
    intents:
        [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages
        ]
});

client.login(TOKEN);
client.commands = new Collection();
client.prefix = PREFIX;
client.queue = new Map();

/**
 * Client events
 */
client.on("ready", () =>
{
    console.log(`${client.user.username} ready!`);
    client.user.setActivity(`${PREFIX}help and ${PREFIX}play`, { type: "LISTENING" });
});
client.on("warn", (info) => console.log(info));
client.on("error", console.error);

/**
 * Import commands
 */
importCommands(client);

/**
 * Message event
 */
messageCreate(client);
