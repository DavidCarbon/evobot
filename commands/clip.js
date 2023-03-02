import { i18n } from "../utils/i18n.js";
import { existsSync } from "fs";

export
    default
    {
        name: "clip",
        aliases: ["c", "pc", "lp", "local play"],
        description: i18n.__("clip.description"),
        async execute(message, args)
        {
            try
            {
                const { channel } = message.member.voice;

                if (!channel)
                {
                    return message.reply(i18n.__("clip.errorNotChannel")).catch(console.error);
                }
                else if (message.client.queue.get(message.guild.id))
                {
                    return message.reply(i18n.__("clip.errorQueue"));
                }
                else if (!args.length)
                {
                    return message
                        .reply(i18n.__mf("clip.usagesReply", { prefix: message.client.prefix }))
                        .catch(console.error);
                }
                else
                {
                    let titleSearch = args.join(" ");

                    if (titleSearch.endsWith(".mp3") || titleSearch.endsWith(".ogg"))
                    {
                        titleSearch = titleSearch.replace(".mp3", "").replace(".ogg", "");
                    }

                    if (existsSync(`./sounds/${titleSearch}.mp3`) || existsSync(`./sounds/${titleSearch}.ogg`))
                    {
                        try
                        {
                            return message.client.commands.get("play").execute(message, titleSearch);
                        }
                        catch (error)
                        {
                            console.error(error.message);
                            return message.reply("Audio Clip Error").catch(console.error);
                        }
                    }
                    else
                    {
                        return message.reply(i18n.__("common.errorCommand")).catch(console.error); 
                    }
                }
            }
            catch (error)
            {
                console.error(error.message);
                return message.reply("Function Clip Error").catch(console.error);
            }
        }
    };