import
{
  AudioPlayerStatus,
  createAudioPlayer,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  NoSubscriberBehavior,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus
} from "@discordjs/voice";
import { promisify } from "node:util";
import { processQueue } from "./processQueue.js";
import { i18n } from "../utils/i18n.js";

const wait = promisify(setTimeout);

export async function startQueue({ message, channel })
{
    const queue = message.client.queue.get(message.guild.id);

    queue.connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator
    });

    try
    {
        await entersState(queue.connection, VoiceConnectionStatus.Ready, 30e3);
    }
    catch (error)
    {
        console.error(error);

        getVoiceConnection(channel.guild.id)?.destroy();
        message.client.queue.delete(message.guild.id);

        return message.reply(i18n.__mf("play.cantJoinChannel", { error }));
    }

    queue.connection.on("error", console.warn);

    queue.connection.on("stateChange", async (oldState, newState) =>
    {
        if (newState.status === VoiceConnectionStatus.Disconnected)
        {
            if (newState.reason === VoiceConnectionDisconnectReason.Manual)
            {
      	        queue.loop = false;
      	        queue.songs.shift();
      	        queue.songs = [1];
      	        queue.player.stop(true);
                queue.connection = null;
            }
            else if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014)
            {
                try
                {
                  await entersState(queue.connection, VoiceConnectionStatus.Connecting, 5_000);
                }
                catch
                {
                    if (queue.connection != null)
                    {
                        if (queue.connection.state != null)
                        {
                            if (queue.connection.state.status !== VoiceConnectionStatus.Destroyed)
                            {
                                try
                                {
                                    queue.connection.destroy();
                                    queue.connection = null;
                                }
                                catch
                                {

                                }
                            }
                        }
                    }
                }
            }
            else if (queue.connection.rejoinAttempts < 5)
            {
                await wait((queue.connection.rejoinAttempts + 1) * 5_000);
                queue.connection.rejoin();
            }
            else if (queue.connection != null)
            {
                if (queue.connection.state != null)
                {
                    if (queue.connection.state.status !== VoiceConnectionStatus.Destroyed)
                    {
                        try
                        {
                            queue.connection.destroy();
                            queue.connection = null;
                        }
                        catch
                        {

                        }
                    }
                }
            }
        }
        /** Once destroyed, stop the subscription. */
        else if (newState.status === VoiceConnectionStatus.Destroyed)
        {
            queue.loop = false;
            queue.songs.shift();
            queue.songs = [1];
            queue.player.stop(true);
	        queue.connection = null;
        }
        else if (!queue.readyLock && (newState.status === VoiceConnectionStatus.Connecting || newState.status === VoiceConnectionStatus.Signalling))
        {
            queue.readyLock = true;

            try
            {
                await entersState(queue.connection, VoiceConnectionStatus.Ready, 20_000);
            }
            catch
            {
                if (queue.connection != null)
                {
                    if (queue.connection.state != null)
                    {
                        if (queue.connection.state.status !== VoiceConnectionStatus.Destroyed)
                        {
                            try
                            {
                                queue.connection.destroy();
                            }
                            catch
                            {

                            }
                        }
                    }
                }
            }
            finally
            {
                queue.readyLock = false;
            }
        }
    });

    queue.player = createAudioPlayer({
        behaviors:
        {
            noSubscriber: NoSubscriberBehavior.Stop
        }
    });

    queue.player.on("error", (err) =>
    {
        try
        {
            console.error(err);
            queue.songs.shift();
            processQueue(queue.songs[0], message);
        }
        catch (error)
        {
            console.error(error);
        }
    });

    queue.player.on("stateChange", async (oldState, newState) =>
    {
        /** Song ends */
        if (oldState.status !== AudioPlayerStatus.Idle && newState.status === AudioPlayerStatus.Idle)
        {
			try
			{
				if (!queue.collector?.ended)
				{
					queue.collector.stop();
				}
			}
			catch 
			{
				/* Cannot read properties of undefined (reading 'stop') */
			}

            if (queue.processing || queue.player.state.status !== AudioPlayerStatus.Idle || queue.songs.length === 0)
            {
                return;
            }
            else
            {
                queue.processing = true;

                try
                {

                    if (queue.loop && queue.songs.length > 0)
                    {
                        let lastSong = queue.songs.shift();
                        queue.songs.push(lastSong);
                        queue.processing = false;
                        processQueue(queue.songs[0], message);
                    }
                    else
                    {
                        queue.songs.shift();
                        queue.processing = false;
                        processQueue(queue.songs[0], message);
                    }
                }
                catch (error)
                {
                    console.error(error);
                }
            }
        }
    });

    queue.connection.subscribe(queue.player);

    processQueue(queue.songs[0], message);
}