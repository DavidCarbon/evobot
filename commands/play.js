import https from "https";
import SoundCloud from "soundcloud-downloader";
import { getSong } from "../music/getSong.js";
import { startQueue } from "../music/startQueue.js";
import { i18n } from "../utils/i18n.js";
import { mobileScRegex, playlistPattern } from "../utils/patterns.js";
import { generateQueue } from "../utils/queue.js";
import { PermissionsBitField } from "discord.js";

const scdl = SoundCloud.create();

export
    default
    {
        name: "play",
        cooldown: 3,
        aliases: ["p"],
        description: i18n.__("play.description"),
        permissions: [
            PermissionsBitField.Flags.Connect,
            PermissionsBitField.Flags.Speak,
            PermissionsBitField.Flags.AddReactions,
            PermissionsBitField.Flags.ManageMessages
        ],
        async execute(message, args)
        {
            try
            {
                const { channel } = message.member.voice;

                if (!channel)
                {
                    return message.reply(i18n.__("play.errorNotChannel")).catch(console.error);
                }
                else
                {
                    const queue = message.client.queue.get(message.guild.id);

                    if (queue && channel.id !== queue.channel.id)
                    {
                        return message
                            .reply(i18n.__mf("play.errorNotInSameChannel", { user: message.client.user.username }))
                            .catch(console.error);
                    }
                    else if (!args.length)
                    {
                        return message
                            .reply(i18n.__mf("play.usageReply", { prefix: message.client.prefix }))
                            .catch(console.error);
                    }
                    else
                    {
                        const url = args[0];

                        // Start the playlist if playlist url was provided
                        if (playlistPattern.test(args[0]) || (scdl.isValidUrl(url) && url.includes("/sets/")))
                        {
                            return message.client.commands.get("playlist").execute(message, args);
                        }
                        else if (mobileScRegex.test(url))
                        {
                            try
                            {
                                https.get(url, function (res)
                                {
                                    if (res.statusCode == "302")
                                    {
                                        return message.client.commands.get("play").execute(message, [res.headers.location]);
                                    }
                                    else
                                    {
                                        return message.reply(i18n.__("play.songNotFound")).catch(console.error);
                                    }
                                });
                            }
                            catch (error)
                            {
                                console.error(error);
                                return message.reply(error.message).catch(console.error);
                            }
                        }
                        else
                        {
                            const song = await getSong({ message, args });

                            if (!song)
                            {
                                return message.reply(i18n.__("common.errorCommand")).catch(console.error);
                            }
                            else if (queue)
                            {
                                queue.songs.push(song);

                                return message
                                    .reply(i18n.__mf("play.queueAdded", { title: song.title, author: message.author }))
                                    .catch(console.error);
                            }
                            else
                            {
                                const queueConstruct = generateQueue(message.channel, channel);
                                queueConstruct.songs.push(song);

                                message.client.queue.set(message.guild.id, queueConstruct);

                                startQueue({ message, channel });
                            }
                        }
                    }
                }
            }
            catch (error)
            {
                console.error(error.message);
                return message.reply("Function Play Error").catch(console.error);
            }
        }
    };