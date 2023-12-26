import { AudioPlayerStatus, createAudioResource, entersState, StreamType, VoiceConnectionStatus } from "@discordjs/voice";
import SoundCloud from "soundcloud-downloader";
import { config } from "../utils/config.js";
import { i18n } from "../utils/i18n.js";
import { canModifyQueue } from "../utils/queue.js";
import { stream } from "play-dl";
const { PRUNING, STAY_TIME } = config;
const scdl = SoundCloud.create();
/* Constants for emoji names */
const REACTION_SKIP = "⏭";
const REACTION_PAUSE_RESUME = "⏯";
const REACTION_SHUFFLE = "🔀";
const REACTION_LOOP = "🔁";
const REACTION_STOP = "⏹";
const REACTION_VOLUME_MUTE = "🔇";
const REACTION_VOLUME_DECREASE = "🔉";
const REACTION_VOLUME_INCREASE = "🔊";

/* Function to clear queue timeout */
function clearQueueTimeout(queue)
{
    if (queue.waitTimeout)
    {
        console.error("Cleared Timeout");
        clearTimeout(queue.waitTimeout);
        queue.waitTimeout = null;
    }
}

/* Function to destroy queue connection */
function destroyQueueConnection(queue, message)
{
    if (queue.connection && !message.client.queue.get(message.guild.id))
    {
        if (queue.player)
        {
            queue.player.stop();
        }

        if (queue.connection && queue.connection.state && queue.connection.state.status !== VoiceConnectionStatus.Destroyed)
        {
            queue.connection.destroy();
            queue.connection = null;
        }
    }
}

/* Function to handle errors */
function handleQueueError(queue, message, error, key = "play.queueError")
{
    if (queue && queue.songs[0])
    {
        queue.songs.shift();
        processQueue(queue.songs[0], message);
    }

    console.error(error);

    return message.channel.send(i18n.__mf(key, { error: error.message ? error.message : error }));
}

/* Function to send messages */
async function sendMessage(channel, text)
{
    try
    {
        if (channel != null)
        {
            await channel.send(text).catch(console.error);
        }
    }
    catch (error)
    {
        console.error(error);
    }
}

/* Function to handle reactions */
async function handleReaction(reaction, user, queue, message)
{
    if (!queue)
    {
        return;
    }

    const member = await message.guild.members.fetch(user);

    switch (reaction.emoji.name)
    {
        case REACTION_SKIP:
            reaction.users.remove(user).catch(console.error);
            await message.client.commands.get("skip").execute(message);
            break;
        case REACTION_PAUSE_RESUME:
            reaction.users.remove(user).catch(console.error);
            if (queue.player.state.status === AudioPlayerStatus.Playing)
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
        case REACTION_VOLUME_MUTE:
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
        case REACTION_VOLUME_DECREASE:
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
        case REACTION_VOLUME_INCREASE:
            reaction.users.remove(user).catch(console.error);
            if (queue.volume == 100)
            {
                return;
            }
            else if (!canModifyQueue(member, queue))
            {
                return i18n.__("common.errorNotChannel");
            }
            else {
                queue.volume = Math.min(queue.volume + 10, 100);
                queue.resource.volume.setVolumeLogarithmic(queue.volume / 100);
                if (queue.textChannel != null)
                {
                    queue.textChannel.send(i18n.__mf("play.increasedVolume", { author: user, volume: queue.volume })).catch(console.error);
                }
            }
            break;
        case REACTION_LOOP:
            reaction.users.remove(user).catch(console.error);
            await message.client.commands.get("loop").execute(message);
            break;
        case REACTION_SHUFFLE:
            reaction.users.remove(user).catch(console.error);
            await message.client.commands.get("shuffle").execute(message);
            break;
        case REACTION_STOP:
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

export async function processQueue(song, message) {
    const queue = message.client.queue.get(message.guild.id);

    if ((message.guild?.members?.me?.voice.channel?.members.size <= 1) || (!song && !queue)) {
        clearQueueTimeout(queue);

        queue.waitTimeout = setTimeout(async () => {
            destroyQueueConnection(queue, message);

            if (queue.textChannel != null && !PRUNING) {
                await sendMessage(queue.textChannel, i18n.__("play.queueEnded"));
            }

            await entersState(queue.player, AudioPlayerStatus.Idle, 5e3);
            message.client.queue.delete(message.guild.id);
        }, STAY_TIME * 1000);

        return;
    }

    if (song?.duration != null) {
        clearQueueTimeout(queue);

        if (queue.textChannel != null && !PRUNING) {
            await sendMessage(queue.textChannel, `Downloading: ${song.title}\nUrl: ${song.url}`);
        }

        let streamAudio = null;
        let isYouTube = song.url.includes("youtube.com");
        let streamType = isYouTube ? StreamType.Opus : StreamType.OggOpus;
        try {
            if (isYouTube) {
                streamAudio = await stream(song.url);
            }
            else if (song.url.includes("soundcloud.com")) {
                try {
                    streamAudio = await scdl.downloadFormat(song.url, 'audio/ogg; codecs="opus"');
                }
                catch (error) {
                    streamAudio = await scdl.downloadFormat(song.url, "audio/mpeg");
                    streamType = StreamType.Arbitrary;
                }
            }
            else if (song.url.includes("http") && song.url.includes("://") && (song.url.endsWith(".mp3") || song.url.endsWith(".ogg"))) {
                streamAudio = song.url;
                streamType = song.url.endsWith(".ogg") ? StreamType.OggOpus : StreamType.Arbitrary;
            }
            else if (song.url.includes("/sounds/") && (song.url.endsWith(".mp3") || song.url.endsWith(".ogg"))) {
                streamAudio = song.url;
                streamType = song.url.endsWith(".ogg") ? StreamType.OggOpus : StreamType.Arbitrary;
                song.url = "on Local Server";
            }
            else {
                if (queue) {
                    queue.songs.shift();
                    processQueue(queue.songs[0], message);
                }

                return message.channel.send(i18n.__mf("play.queueError"));
            }
        }
        catch (error) {
            handleQueueError(queue, message, error)
        }

        if (streamAudio) {
            try {
                queue.resource = createAudioResource(isYouTube ? streamAudio.stream : streamAudio, { inputType: streamType, inlineVolume: true });
                queue.resource.volume?.setVolumeLogarithmic(queue.volume / 100);
                queue.player.play(queue.resource);

                await entersState(queue.player, AudioPlayerStatus.Playing, 5e3);

                try {
                    if (queue.textChannel != null) {
                        var playingMessage = await queue.textChannel.send(i18n.__mf("play.startedPlaying", { title: song.title, url: song.url }));
                        if (queue.songs.length >= 2) {
                            await playingMessage.react(REACTION_SKIP);
                        }

                        await playingMessage.react(REACTION_LOOP);
                        if (queue.songs.length >= 3) {
                            await playingMessage.react(REACTION_SHUFFLE);
                        }
                        await playingMessage.react(REACTION_STOP);
                    }
                }
                catch (error) {
                    console.error(error);
                    return message.reply(error.message);
                }

                const filter = (reaction, user) => user.id !== message.client.user.id;
                var collector = playingMessage.createReactionCollector({
                    filter,
                    time: song.duration > 0 ? song.duration * 1000 : 600000
                });
                queue.collector = collector;

                collector.on("collect", async (reaction, user) => {
                    handleReaction(reaction, user, queue, message)
                });

                collector.on("end", () => {
                    playingMessage.reactions.removeAll().catch(console.error);
                    if (PRUNING) {
                        setTimeout(() => {
                            playingMessage.delete().catch();
                        }, 3000);
                    }
                });
            }
            catch (error_live)
            {
                handleQueueError(queue, message, error_live)
            }
        }
        else {
            if (queue) {
                queue.songs.shift();
                processQueue(queue.songs[0], message);
            }

            return message.channel.send(i18n.__mf("play.queueError"));
        }
    }
    else if (queue && queue.songs[0]) {
        queue.songs.shift();
        processQueue(queue.songs[0], message);
        await sendMessage(message.channel, i18n.__("play.queueError"));
    } else {
        clearQueueTimeout(queue);

        queue.waitTimeout = setTimeout(() => {
            destroyQueueConnection(queue, message);

            if (queue.textChannel != null && !PRUNING) {
                sendMessage(queue.textChannel, i18n.__("play.queueEnded")).catch(console.error);
            }

            entersState(queue.player, AudioPlayerStatus.Idle, 5e3);
            message.client.queue.delete(message.guild.id);
        }, STAY_TIME * 1000);
    }
}