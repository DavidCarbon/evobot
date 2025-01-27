import { EmbedBuilder } from "discord.js";
import { splitBar } from "string-progressbar";
import { i18n } from "../utils/i18n.js";

export default
    {
        name: "np",
        cooldown: 10,
        description: i18n.__("nowplaying.description"),
        execute(message)
        {
            const queue = message.client.queue.get(message.guild.id);

            if (!queue || !queue.songs.length)
            {
                return message.reply(i18n.__("nowplaying.errorNotQueue")).catch(console.error);
            }
            else
            {
                const song = queue.songs[0];
                const seek = queue.resource.playbackDuration / 1000;
                const left = song.duration - seek;

                let nowPlaying = new EmbedBuilder()
                    .setTitle(i18n.__("nowplaying.embedTitle"))
                    .setDescription(`[${song.title}](${song.url})`)
                    .setColor("#F8AA2A");

                if (song.duration > 0)
                {
                    nowPlaying.addField(
                        "\u200b",
                        new Date(seek * 1000).toISOString().substring(11, 8) +
                        "[" +
                        splitBar(song.duration == 0 ? seek : song.duration, seek, 20)[0] +
                        "]" +
                        (song.duration == 0 ? " ◉ LIVE" : new Date(song.duration * 1000).toISOString().substring(11, 8)),
                        false
                    );

                    nowPlaying.setFooter({
                        text: i18n.__mf("nowplaying.timeRemaining", {
                            time: new Date(left * 1000).toISOString().substring(11, 8)
                        })
                    });
                }

                return message.reply({ embeds: [nowPlaying] });
            }
        }
    };
