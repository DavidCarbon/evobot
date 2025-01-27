import { canModifyQueue } from "../utils/queue.js";
import { i18n } from "../utils/i18n.js";

export
    default
    {
        name: "skip",
        aliases: ["s", "fs"],
        description: i18n.__("skip.description"),
        execute(message)
        {
            try
            {
                const queue = message.client.queue.get(message.guild.id);

                if (!queue)
                {
                    return message.reply(i18n.__("skip.errorNotQueue")).catch(console.error);
                }
                else if (!canModifyQueue(message.member))
                {
                    return i18n.__("common.errorNotChannel");
                }
                else
                {
                    queue.player.stop(true);
                    queue.textChannel.send(i18n.__mf("skip.result", { author: message.author })).catch(console.error);
                }
            }
            catch (error)
            {
                console.error(error);
                return message.reply("Skip Error").catch(console.error);
            }
        }
    };