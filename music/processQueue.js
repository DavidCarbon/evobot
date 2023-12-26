import { AudioPlayerStatus, createAudioResource, entersState, StreamType, VoiceConnectionStatus } from "@discordjs/voice";
import SoundCloud from "soundcloud-downloader";
import { config } from "../utils/config.js";
import { i18n } from "../utils/i18n.js";
import { canModifyQueue } from "../utils/queue.js";
import { stream } from "play-dl";
const { PRUNING, STAY_TIME } = config;
const scdl = SoundCloud.create();

export async function processQueue(song, message)
{    
    const queue = message.client.queue.get(message.guild.id);
    if ((message.guild?.me?.voice.channel?.members.size <= 1) || (!song && !queue))
    {
        try
        {
            if (queue.waitTimeout != null)
            {
                console.error("Cleared Timeout");
                clearTimeout(queue.waitTimeout);
                queue.waitTimeout = null;
            }

            queue.waitTimeout = setTimeout(function ()
            {
                try
                {
                    if (queue.connection && !message.client.queue.get(message.guild.id))
                    {
                        /* FIX TypeError: Cannot read properties of undefined (reading 'player') */
                        if (queue.player)
                        {
                            queue.player.stop();
                        }

                        if (queue.connection)
                        {
                            if (queue.connection.state)
                            {
                                if (queue.connection.state.status !== VoiceConnectionStatus.Destroyed)
                                {
                                    queue.connection.destroy();
                                    queue.connection = null;
                                }
                            }
                        }
                    }
                }
                catch (error)
                {
                    console.error(error);
                }
            }, STAY_TIME * 1000);

            if (queue.textChannel != null && !PRUNING)
            {
                queue.textChannel.send(i18n.__("play.queueEnded")).catch(console.error);
            }

            await entersState(queue.player, AudioPlayerStatus.Idle, 5e3);

            return message.client.queue.delete(message.guild.id);
        }
        catch (error)
        {
            console.error(error);
        }
    }
    else if (song?.duration != null)
    {
        if (queue.waitTimeout != null)
        {
            console.error("Cleared Timeout");
            clearTimeout(queue.waitTimeout);
            queue.waitTimeout = null;
        }

        if (queue.textChannel != null && !PRUNING)
        {
            queue.textChannel.send("Downloading: " + song.title).catch(console.error);
            queue.textChannel.send("Url: " + song.url).catch(console.error);
        }
        
        let streamAudio = null;
        let isYouTube = song.url.includes("youtube.com");
        let streamType = isYouTube ? StreamType.Opus : StreamType.OggOpus;
        try
        {
            if (isYouTube)
            {
                streamAudio = await stream(song.url);
            }
            else if (song.url.includes("soundcloud.com"))
            {
                try
                {
                    streamAudio = await scdl.downloadFormat(song.url, 'audio/ogg; codecs="opus"');
                }
                catch (error)
                {
                    streamAudio = await scdl.downloadFormat(song.url, "audio/mpeg");
                    streamType = StreamType.Arbitrary;
                }
            }
            else if (song.url.includes("http") && song.url.includes("://") && (song.url.endsWith(".mp3") || song.url.endsWith(".ogg")))
            {
                streamAudio = song.url;
                streamType = song.url.endsWith(".ogg") ? StreamType.OggOpus : StreamType.Arbitrary;
            }
            else if (song.url.includes("/sounds/") && (song.url.endsWith(".mp3") || song.url.endsWith(".ogg")))
            {
                streamAudio = song.url;
                streamType = song.url.endsWith(".ogg") ? StreamType.OggOpus : StreamType.Arbitrary;
                song.url = "on Local Server";
            }
            else
            {
                if (queue)
                {
                    queue.songs.shift();
                    processQueue(queue.songs[0], message);
                }

                return message.channel.send(i18n.__mf("play.queueError"));
            }
        }
        catch (error)
        {
            if (queue)
            {
                queue.songs.shift();
                processQueue(queue.songs[0], message);
            }

            console.error(error);

            return message.channel.send(i18n.__mf("play.queueError", { error: error.message ? error.message : error }));
        }

        if (streamAudio)
        {
            try
            {
                queue.resource = createAudioResource(isYouTube ? streamAudio.stream : streamAudio, { inputType: streamType, inlineVolume: true });
                queue.resource.volume?.setVolumeLogarithmic(queue.volume / 100);
                queue.player.play(queue.resource);

                await entersState(queue.player, AudioPlayerStatus.Playing, 5e3);

                try
                {
                    if (queue.textChannel != null)
                    {
                        var playingMessage = await queue.textChannel.send(i18n.__mf("play.startedPlaying", { title: song.title, url: song.url }));
                        if (queue.songs.length >= 2)
                        {
                            await playingMessage.react("⏭");
                        }

                        await playingMessage.react("🔁");
                        if (queue.songs.length >= 3)
                        {
                            await playingMessage.react("🔀");
                        }
                        await playingMessage.react("⏹");
                    }
                }
                catch (error)
                {
                    console.error(error);
                    return message.reply(error.message);
                }

                const filter = (reaction, user) => user.id !== message.client.user.id;
                var collector = playingMessage.createReactionCollector({
                    filter,
                    time: song.duration > 0 ? song.duration * 1000 : 600000
                });
                queue.collector = collector;

                collector.on("collect", async (reaction, user) =>
                {
                    if (!queue)
                    {
                        return;
                    }
                    else
                    {
                        const member = await message.guild.members.fetch(user);
                        switch (reaction.emoji.name)
                        {
                            case "⏭":
                                reaction.users.remove(user).catch(console.error);
                                await message.client.commands.get("skip").execute(message);
                                break;
                            case "⏯":
                                reaction.users.remove(user).catch(console.error);
                                if (queue.player.state.status == AudioPlayerStatus.Playing)
                                {
                                    await message.client.commands.get("pause").execute(message);
                                    await entersState(queue.player, AudioPlayerStatus.Idle, 5e3);
                                }
                                else
                                {
                                    await message.client.commands.get("resume").execute(message);
                                    await entersState(queue.player, AudioPlayerStatus.Playing, 5e3);
                                }
                                break;
                            case "🔇":
                                reaction.users.remove(user).catch(console.error);
                                if (!canModifyQueue(member, queue))
                                {
                                    return i18n.__("common.errorNotChannel");
                                }
                                else
                                {
                                    queue.muted = !queue.muted;
                                    if (queue.muted)
                                    {
                                        queue.resource.volume.setVolumeLogarithmic(0);
                                        if (queue.textChannel != null)
                                        {
                                            queue.textChannel.send(i18n.__mf("play.mutedSong", { author: user })).catch(console.error);
                                        }
                                    }
                                    else
                                    {
                                        queue.resource.volume.setVolumeLogarithmic(queue.volume / 100);
                                        if (queue.textChannel != null)
                                        {
                                            queue.textChannel.send(i18n.__mf("play.unmutedSong", { author: user })).catch(console.error);
                                        }
                                    }
                                }
                                break;
                            case "🔉":
                                reaction.users.remove(user).catch(console.error);
                                if (queue.volume == 0)
                                {
                                    return;
                                }
                                else if (!canModifyQueue(member, queue))
                                {
                                    return i18n.__("common.errorNotChannel");
                                }
                                else
                                {
                                    queue.volume = Math.max(queue.volume - 10, 0);
                                    queue.resource.volume.setVolumeLogarithmic(queue.volume / 100);
                                    if (queue.textChannel != null)
                                    {
                                        queue.textChannel.send(i18n.__mf("play.decreasedVolume", { author: user, volume: queue.volume })).catch(console.error);
                                    }
                                }
                                break;
                            case "🔊":
                                reaction.users.remove(user).catch(console.error);
                                if (queue.volume == 100)
                                {
                                    return;
                                }
                                else if (!canModifyQueue(member, queue))
                                {
                                    return i18n.__("common.errorNotChannel");
                                }
                                else
                                {
                                    queue.volume = Math.min(queue.volume + 10, 100);
                                    queue.resource.volume.setVolumeLogarithmic(queue.volume / 100);
                                    if (queue.textChannel != null)
                                    {
                                        queue.textChannel.send(i18n.__mf("play.increasedVolume", { author: user, volume: queue.volume })).catch(console.error);
                                    }
                                }
                                break;
                            case "🔁":
                                reaction.users.remove(user).catch(console.error);
                                await message.client.commands.get("loop").execute(message);
                                break;
                            case "🔀":
                                reaction.users.remove(user).catch(console.error);
                                await message.client.commands.get("shuffle").execute(message);
                                break;
                            case "⏹":
                                reaction.users.remove(user).catch(console.error);
                                await message.client.commands.get("stop").execute(message);
                                collector.stop();
                                queue.connection = null;
                                break;
                            default:
                                reaction.users.remove(user).catch(console.error);
                                break;
                        }
                    }
                });

                collector.on("end", () =>
                {
                    playingMessage.reactions.removeAll().catch(console.error);
                    if (PRUNING)
                    {
                        setTimeout(() =>
                        {
                            playingMessage.delete().catch();
                        }, 3000);
                    }
                });
            }
            catch (error_live)
            {
                if (queue)
                {
                    queue.songs.shift();
                    processQueue(queue.songs[0], message);
                }

                console.error(error_live);
                return message.channel.send(i18n.__mf("play.queueError", { error_live: error_live.message ? error_live.message : error_live }));
            }
        }
        else
        {
            if (queue)
            {
                queue.songs.shift();
                processQueue(queue.songs[0], message);
            }

            return message.channel.send(i18n.__mf("play.queueError"));
        }
    }
    else if (queue && queue.songs[0])
    {
        queue.songs.shift();
        processQueue(queue.songs[0], message);
        return message.channel.send(i18n.__mf("play.queueError"));
    }
    else
    {
        if (queue.waitTimeout)
        {
            console.error("Cleared Timeout");
            clearTimeout(queue.waitTimeout);
            queue.waitTimeout = null;
        }

        queue.waitTimeout = setTimeout(function ()
        {
            try
            {
                if (queue.connection && !message.client.queue.get(message.guild.id))
                {
                    /* FIX TypeError: Cannot read properties of undefined (reading 'player') */
                    if (queue.player)
                    {
                        queue.player.stop();
                    }

                    if (queue.connection)
                    {
                        if (queue.connection.state)
                        {
                            if (queue.connection.state.status !== VoiceConnectionStatus.Destroyed)
                            {
                                queue.connection.destroy();
                                queue.connection = null;
                            }
                        }
                    }
                }
            }
            catch (error)
            {
                console.error(error);
            }
        }, STAY_TIME * 1000);

        if (queue.textChannel != null && !PRUNING)
        {
            queue.textChannel.send(i18n.__("play.queueEnded")).catch(console.error);
        }

        await entersState(queue.player, AudioPlayerStatus.Idle, 5e3);
        return message.client.queue.delete(message.guild.id);
    }
}