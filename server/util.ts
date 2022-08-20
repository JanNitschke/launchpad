import { APIInteractionDataResolvedChannel, APIInteractionGuildMember, Channel, ChannelType, Guild, GuildBasedChannel, GuildMember, VoiceChannel } from "discord.js";


export const findVoiceChannel = (guild?: Guild|null, userId?:string, channel?: APIInteractionDataResolvedChannel | GuildBasedChannel | null ):VoiceChannel => {
	if(!userId || !guild){
		throw new Error("This command can only be used in a guild");
	}
	if(channel){
		if(channel.type === ChannelType.GuildVoice){
			return channel as VoiceChannel;
		}else{
			throw new Error("Channel is not a voice channel");
		}
	}

	const res = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.members.has(userId)) as VoiceChannel|undefined;
	if(!res){
		throw new Error("You are not in a voice channel");
	}
	return res;
}

export const callbackToPromise = <T>(callback: (cb: (error: any, val: T) => any) => void): Promise<T> => {
	return new Promise((resolve, reject) => {
		const cb = (error: any, val: T) => {
			if (error) {
				reject(error);
			} else {
				resolve(val);
			}
		}
		callback(cb);
	});
}

