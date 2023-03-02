import move from "array-move";
import { i18n } from "../utils/i18n.js";
import { canModifyQueue } from "../utils/queue.js";

export
    default
    {
        name: "move",
        aliases: ["mv"],
        description: i18n.__("move.description"),
        execute(message, args)
        {
            try
            {
                const queue = message.client.queue.get(message.guild.id);

                if (!queue)
                {
                    return message.reply(i18n.__("move.errorNotQueue")).catch(console.error);
                }
                else if (!canModifyQueue(message.member))
                {
                    return;
                }
                else if (!args.length)
                {
                    return message.reply(i18n.__mf("move.usagesReply", { prefix: message.client.prefix }));
                }
                else if (isNaN(args[0]) || args[0] <= 1)
                {
                    return message.reply(i18n.__mf("move.usagesReply", { prefix: message.client.prefix }));
                }

                let song = queue.songs[args[0] - 1];

                queue.songs = move(queue.songs, args[0] - 1, args[1] == 1 ? 1 : args[1] - 1);

                if (queue.textChannel != null)
                {
                    queue.textChannel.send(
                        i18n.__mf("move.result", {
                            author: message.author,
                            title: song.title,
                            index: args[1] == 1 ? 1 : args[1]
                        })
                    );
                }
            }
            catch (error)
            {
                console.error(error.message);
                return message.reply("Function Move Error").catch(console.error);
            }
        }
    };
