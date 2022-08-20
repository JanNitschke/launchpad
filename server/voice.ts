import type { SoundDB } from "./db";
import type { AudioPlayer, VoiceConnection } from "@discordjs/voice";
import { Client, GatewayIntentBits, Interaction, VoiceChannel } from "discord.js";
import { findVoiceChannel } from "./util";
const IDLE_TIMEOUT = 30_000;

export const init = async (token: string, db: SoundDB, origin: string) => {
	const { AudioPlayer, joinVoiceChannel, generateDependencyReport, createAudioResource } =
		await import("@discordjs/voice");
	const voiceConnections = new Map<string, VoiceConnectionInfo>();

	type VoiceConnectionInfo = {
		channel: string;
		connection?: VoiceConnection;
		playing: boolean;
		player?: AudioPlayer;
		timeout?: NodeJS.Timeout;
		callback?: () => void;
	};
	const stopSound = (guildId: string) => {
		const info = voiceConnections.get(guildId);
		if(info && info.player){
			info.player.stop();
		}
	}
	const playSound = (guildId: string, channel: VoiceChannel, sound: string) => {

		return new Promise<void>(async(resolve, reject) => {
			try{

				const resourcePath = await db.getSound(guildId, sound);
				if (!resourcePath) {
					reject(new Error("Sound does not exist"));
					return;
				}
		
				const resource = await createAudioResource(resourcePath);
		
				let info = voiceConnections.get(guildId);
				if (!info) {
					info = {
						channel: channel.id,
						playing: true,
					};
					const connection = await joinVoiceChannel({
						channelId: channel.id,
						guildId,
						adapterCreator: channel.guild.voiceAdapterCreator,
						selfMute: false,
						selfDeaf: false,
					});
					info.connection = connection;
					const player = new AudioPlayer({});
					info.player = player;
					connection.subscribe(player);
					voiceConnections.set(guildId, info);
				}
				if (info.playing && info.channel !== channel.id) {
					reject(new Error("Already playing"));
					return;
				}
				if (!info.connection || !info.player) {
					reject(new Error("Already requested playback"));
					return;
				}
				info.playing = true;
				if (info.channel !== channel.id) {
					info.connection.disconnect();
					info.connection = await joinVoiceChannel({
						channelId: channel.id,
						guildId: guildId,
						adapterCreator: channel.guild.voiceAdapterCreator,
						selfMute: false,
						selfDeaf: true,
					});
					info.connection.subscribe(info.player);
				}
				info.player.play(resource);
				if (info.timeout) {
					clearTimeout(info.timeout);
					info.timeout = undefined;
				}
				info.player.removeAllListeners("stateChange");
				if(info.callback){
					info.callback();
				}
				info.callback = resolve;
				info.player.addListener("stateChange", (oldOne, newOne) => {
					if (newOne.status == "idle") {
						resolve();
						info!.playing = false;
						info!.callback = undefined;
						info!.timeout = setTimeout(() => {
							info?.connection?.disconnect();
							info?.player?.stop();
							voiceConnections.delete(guildId);
						}, IDLE_TIMEOUT);
					}
					if(newOne.status == "buffering"){
						resolve();
					}
				});
			}catch(e){
				reject(e);
			}
		})
	};
	const playSoundForInteraction = (interaction: Interaction) => {
		if (!interaction.isChatInputCommand()) return;

		try {
			const channel = findVoiceChannel(
				interaction.guild,
				interaction.user.id,
				interaction.options.getChannel("channel")
			);
			const sound = interaction.options.getString("sound");
			const guildId = interaction.guildId as string;
			if (!sound) {
				throw new Error("No sound specified");
			}
			playSound(guildId, channel, sound)
				.then(() => {
					interaction.reply(`playing ${sound}...`);
				})
				.catch((ex) => {
					console.error(ex);
					interaction.reply(`error: ${ex.message}`);
				});
		} catch (ex) {
			console.error(ex);
			interaction.reply(`error: ${ex.message}`);
		}
	};

	const client = new Client({
		intents: [
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildMembers,
			GatewayIntentBits.GuildVoiceStates,
		],
	});

	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isChatInputCommand()) return;

		try {
			if (interaction.commandName === "link" && interaction.guildId) {
				await interaction.reply(`${origin}/${interaction.guildId}`);
			} else if (interaction.commandName === "play" && interaction.guildId) {
				playSoundForInteraction(interaction);
			}else if (interaction.commandName === "sound" && interaction.guildId) {
				playSoundForInteraction(interaction);
			}
		} catch (ex) {
			console.error(ex);
			interaction.reply(`error: ${ex.message}`);
		}
	});

	console.log(generateDependencyReport());

	client.login(token);

	client.on("ready", () => {
		console.log(`Logged in as ${client.user?.tag}!`);
	});

	const isUserInGuild = (guildId?: string, user?: string) => {
		if(!guildId || !user) return false;
		const guild = client.guilds.resolve(guildId);
		if(!guild){
			return false;
		}
		return !!guild.members.resolve(user);
	}


	return {
		client,
		playSound,
		stopSound,
		isUserInGuild
	};
};
