import { REST, Routes, SlashCommandBuilder, SlashCommandChannelOption } from "discord.js";

export const commands = [
	new SlashCommandBuilder().setName("play").setDescription("Plays a sound").addStringOption(o => o.setName("sound").setDescription("name of the sound").setRequired(true)).addChannelOption(c => {
		c.setName("channel").setRequired(false).setDescription("The channel to play the sound in");
		return c;
	}),
	new SlashCommandBuilder().setName("link").setDescription("get a link to manage the bots sounds")
]




export const init = async(client_id: string, token: string) => {
	const rest = new REST({ version: '10' }).setToken(token);
	await rest.put(Routes.applicationCommands(client_id), {body: commands});

	const updateGuildSounds = async(guildId: string, sounds: string[]) => {
		const guildCommands = [
			new SlashCommandBuilder().setName("sound").setDescription("Plays a sound").addStringOption(o => o.setName("sound").setDescription("name of the sound").setRequired(true).addChoices(...sounds.map(s => ({name: s, value: s})))).addChannelOption(c => {
				c.setName("channel").setRequired(false).setDescription("The channel to play the sound in");
				return c;
			})
		]
		await rest.put(Routes.applicationGuildCommands(client_id, guildId), {body: guildCommands});
	}
	
	return {
		updateGuildSounds
	}
}