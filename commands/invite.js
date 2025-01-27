import { i18n } from "../utils/i18n.js";

export
    default
    {
        name: "invite",
        description: i18n.__("invite.description"),
        execute(message)
        {
            return message.member
                .send(
                    `https://discord.com/oauth2/authorize?client_id=${message.client.user.id}&permissions=70282305&scope=bot
    `
                )
                .catch(console.error);
        }
    };
