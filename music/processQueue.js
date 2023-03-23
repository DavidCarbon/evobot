import { AudioPlayerStatus, createAudioResource, entersState, StreamType, VoiceConnectionStatus } from "@discordjs/voice";
import SoundCloud from "soundcloud-downloader";
import ytdl from "ytdl-core-discord";
import { config } from "../utils/config.js";
import { i18n } from "../utils/i18n.js";
import { canModifyQueue } from "../utils/queue.js";
const { PRUNING, STAY_TIME } = config;
const scdl = SoundCloud.create();

function botLeavesTimeout(message) 
{
    setTimeout(function ()
    {
        try
        {
            if ((canModifyQueue(message.member) && !message.client.queue.get(message.guild.id)) || (message.guild?.me?.voice.channel?.members.size <= 1))
            {
                /* FIX TypeError: Cannot read properties of undefined (reading 'player') */
                if (message.client.queue.get(message.guild.id).player != null)
                {
                    message.client.queue.get(message.guild.id).player.stop();
                }
                
                if (message.client.queue.get(message.guild.id).connection != null)
                {
                    if (message.client.queue.get(message.guild.id).connection.state != null)
                    {
                        if (message.client.queue.get(message.guild.id).connection.state.status !== VoiceConnectionStatus.Destroyed)
                        {
                            message.client.queue.get(message.guild.id).connection.destroy();
                            message.client.queue.get(message.guild.id).connection = null;
                        }
                    }
                }
            }
            else
            {
                botLeavesTimeout(message);
            }
        }
        catch (error)
        {
            console.error(error);
        }
    }, STAY_TIME * 1000);
}

export async function processQueue(song, message)
{    
    const queue = message.client.queue.get(message.guild.id);
    if (message.guild?.me?.voice.channel?.members.size <= 1)    
    {        
        try        
        {            
            botLeavesTimeout(message);

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
    else
    {
        if (!song)
        {
            botLeavesTimeout(message);

            if (queue.textChannel != null && !PRUNING)
            {
                queue.textChannel.send(i18n.__("play.queueEnded")).catch(console.error);
            }
            
            await entersState(queue.player, AudioPlayerStatus.Idle, 5e3);
            return message.client.queue.delete(message.guild.id);
        }

        if (queue.textChannel != null && !PRUNING)
        {
            queue.textChannel.send("Downloading: " + song.title).catch(console.error);
        }
        
        let stream = null;
        let streamType = song.url.includes("youtube.com") ? StreamType.Opus : StreamType.OggOpus;
        try
        {
            if (song.url.includes("youtube.com"))
            {
                stream = await ytdl(song.url, { highWaterMark: 1 << 25 });
            }
            else if (song.url.includes("soundcloud.com"))
            {
                try
                {
                    stream = await scdl.downloadFormat(song.url, 'audio/ogg; codecs="opus"');
                }
                catch (error)
                {
                    stream = await scdl.downloadFormat(song.url, "audio/mpeg");
                    streamType = StreamType.Arbitrary;
                }
            }
            else if (song.url.includes("http") && song.url.includes("://") && (song.url.endsWith(".mp3") || song.url.endsWith(".ogg")))
            {
                stream = song.url;
                streamType = song.url.endsWith(".ogg") ? StreamType.OggOpus : StreamType.Arbitrary;
            }
            else if (song.url.includes("/sounds/") && (song.url.endsWith(".mp3") || song.url.endsWith(".ogg")))
            {
                stream = song.url;
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
        
        queue.resource = createAudioResource(stream, { inputType: streamType, inlineVolume: true });
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
}