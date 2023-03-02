import { i18n } from "../utils/i18n.js";
import { readdir } from "fs";

export
    default
    {
        name: "clips",
        aliases: ["cl", "pcl"],
        description: i18n.__("clips.description"),
        execute(message)
        {
            readdir("./sounds", function (server_error, files)
            {
                if (server_error)
                {
                    return console.log("Unable to read directory: " + server_error);
                }
                else
                {
                    let clips = [];

                    files.forEach(function (file)
                    {
                        clips.push(file.substring(0, file.length - 4));
                    });

                    message.reply(`${clips.join("\n")}`).catch(console.error);
                }
            });
        }
    };