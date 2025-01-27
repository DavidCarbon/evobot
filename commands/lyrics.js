import { EmbedBuilder } from "discord.js";
import { i18n } from "../utils/i18n.js";
import lyricsFinder from "lyrics-finder";

export
    default
    {
        name: "lyrics",
        aliases: ["ly"],
        description: i18n.__("lyrics.description"),
        async execute(message)
        {
            const queue = message.client.queue.get(message.guild.id);
            if (!queue || !queue.songs.length)
            {
                return message.reply(i18n.__("lyrics.errorNotQueue")).catch(console.error);
            }
            else
            {
                let lyrics = null;
                const title = queue.songs[0].title;

                try
                {
                    lyrics = await lyricsFinder(title, "");
                    if (!lyrics)
                    {
                        lyrics = i18n.__mf("lyrics.lyricsNotFound", { title: title });
                    }
                }
                catch (error)
                {
                    lyrics = i18n.__mf("lyrics.lyricsNotFound", { title: title });
                }

                let lyricsEmbed = new EmbedBuilder()
                    .setTitle(i18n.__mf("lyrics.embedTitle", { title: title }))
                    .setDescription(lyrics.length >= 4096 ? `${lyrics.substring(0, 4093)}...` : lyrics)
                    .setColor("#F8AA2A")
                    .setTimestamp();

                return message.reply({ embeds: [lyricsEmbed] }).catch(console.error);
            }
        }
    };
