import { i18n } from "../utils/i18n.js";
import { canModifyQueue } from "../utils/queue.js";

export
    default
    {
        name: "pause",
        description: i18n.__("pause.description"),
        execute(message)
        {
            try
            {
                const queue = message.client.queue.get(message.guild.id);

                if (!queue || (queue.player == null))
                {
                    return message.reply(i18n.__("pause.errorNotQueue")).catch(console.error);
                }
                else if (!canModifyQueue(message.member))
                {
                    return i18n.__("common.errorNotChannel");
                }
                else if (queue.player.pause())
                {
                    if (queue.textChannel != null)
                    {
                        queue.textChannel.send(i18n.__mf("pause.result", { author: message.author })).catch(console.error);
                    }

                    return true;
                }
            }
            catch (error)
            {
                console.error(error.message);
                return message.reply("Function Pause Error").catch(console.error);
            }
        }
    };
