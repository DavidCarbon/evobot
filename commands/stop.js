import { i18n } from "../utils/i18n.js";
import { canModifyQueue } from "../utils/queue.js";

export
    default
    {
        name: "stop",
        description: i18n.__("stop.description"),
        execute(message)
        {
            try
            {
                const queue = message.client.queue.get(message.guild.id);

                if (!queue)
                {
                    return message.reply(i18n.__("stop.errorNotQueue")).catch(console.error);
                }
                else if (!canModifyQueue(message.member))
                {
                    return i18n.__("common.errorNotChannel");
                }
                else
                {
                    queue.loop = false;
                    queue.songs.shift();
                    queue.songs = [1];
                    queue.player.stop(true);

                    if (queue.connection != null)
                    {
                        queue.connection.destroy();
                        queue.connection = null;
                    }

                    if (queue.textChannel != null)
                    {
                        queue.textChannel.send(i18n.__mf("stop.result", { author: message.author })).catch(console.error);
                    }
                }
            }
            catch (error)
            {
                console.error(error);
                message.client.queue.get(message.guild.id).textChannel.send(error.message).catch(console.error);
            }
        }
    };