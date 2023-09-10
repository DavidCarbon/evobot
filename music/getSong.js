import SoundCloud from "soundcloud-downloader";
import youtube from "youtube-sr";
import { i18n } from "../utils/i18n.js";
import { scRegex, videoPattern } from "../utils/patterns.js";
import { existsSync } from "fs";
import fetch from "node-fetch";
import { video_basic_info } from "play-dl";
const scdl = SoundCloud.create();

export async function getSong({ message, args })
{
    const titleSearch = args.join(" ");
    let titleSearchMP3 = titleSearch;
    const songLocation = args[0];

    let songExternal = false;
    let songInfo = null;
    let song = null;

    if (titleSearchMP3.includes("http") && titleSearchMP3.includes("://") && (titleSearchMP3.endsWith(".mp3") || titleSearchMP3.endsWith(".ogg")))
    {
        if (isValidAudioUrl(titleSearchMP3))
        {
            songExternal = true;
        }

        titleSearchMP3 = parseUrlFileName(titleSearch);
    }

    if (titleSearchMP3.endsWith(".mp3") || titleSearchMP3.endsWith(".ogg"))
    {
        titleSearchMP3 = titleSearchMP3.replace(".mp3", "").replace(".ogg", "");
    }

    if (videoPattern.test(songLocation))
    {
        try
        {
            songInfo = await video_basic_info(songLocation);
            song =
            {
                title: songInfo.video_details.title.toString(),
                url: songInfo.video_details.url.toString(),
                duration: parseInt(songInfo.video_details.durationInSec)
            };
        }
        catch (error)
        {
            console.error(error);

            return message.reply(error.message).catch(console.error);
        }
    }
    else if (scRegex.test(songLocation))
    {
        try
        {
            const trackInfo = await scdl.getInfo(songLocation);

            song =
            {
                title: trackInfo.title,
                url: trackInfo.permalink_url,
                duration: Math.ceil(trackInfo.duration / 1000)
            };
        }
        catch (error)
        {
            console.error(error);

            return message.reply(error.message).catch(console.error);
        }
    }
    else if (songExternal)
    {
        song =
        {
            title: titleSearchMP3,
            url: titleSearch
        };
    }
    else if (existsSync(`./sounds/${titleSearchMP3}.ogg`))
    {
        song =
        {
            title: titleSearchMP3,
            url: `./sounds/${titleSearchMP3}.ogg`
        };
    }
    else if (existsSync(`./sounds/${titleSearchMP3}.mp3`))
    {
        song =
        {
            title: titleSearchMP3,
            url: `./sounds/${titleSearchMP3}.mp3`
        };
    }
    else
    {
        try
        {
            const result = await youtube.searchOne(titleSearch);

            if (!result)
            {
                message.reply(i18n.__("play.songNotFound")).catch(console.error);
                return;
            }
            else
            {
                songInfo = await video_basic_info(`https://youtube.com/watch?v=${result.id}`);
                song =
                {
                    title: songInfo.video_details.title.toString(),
                    url: songInfo.video_details.url.toString(),
                    duration: parseInt(songInfo.video_details.durationInSec)
                };
            }
        }
        catch (error)
        {
            console.error(error);

            if (error.message.includes("410"))
            {
                return message.reply(i18n.__("play.songAccessErr")).catch(console.error);
            }
            else
            {
                return message.reply(error.message).catch(console.error);
            }
        }
    }

    return song;
}

/* Credit: https://stackoverflow.com/a/66983661/17539426 */

function isValidAudioUrl(urlToCheck)
{
    try
    {
        return fetch(urlToCheck, { method: 'HEAD', mode: 'no-cors' })
            .then(res => res.ok && res.headers.get('content-type').startsWith('audio'))
            .catch(err => console.error(err));
    }
    catch (error)
    {
        console.error(error);
        return false;
    }
}

/* Credit: https://stackoverflow.com/a/66908174/17539426 */
function parseUrlFileName(url, defaultFileName = null)
{
    /* No need to change "https://example.com"; it's only present to allow for processing relative URLs. */
    let fileName = new URL(url, "https://example.com").href.split("#").shift().split("?").shift().split("/").pop();

    if (!fileName)
    {
        if (defaultFileName)
        {
            /* No default filename provided; use a pseudorandom string. */
            fileName = defaultFileName;
        }
        else
        {
            fileName = Math.random().toString(36).substr(2, 10);
        }
    }

    return fileName;
}