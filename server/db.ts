import type { UploadedFile } from "express-fileupload";
import { access, readdir, constants, mkdir } from "fs";
import { callbackToPromise } from "./util";
import { join } from "path";

const encode = (name: string) => name?Buffer.from(name).toString("base64"):"";
const decode = (name: string) => name?Buffer.from(name, "base64").toString():"";

export type SoundDB = Awaited<ReturnType<typeof init>>;

export const init = async () => {
	const dir = join(__dirname, "../data/sounds");

	const getFiles = (guild: string) => {
		return callbackToPromise<string[]>((cb) => readdir(join(dir, guild), cb)).catch((ex) => {
			console.error(ex);
			return [];
		}).then(files => files.sort((a,b) => a.localeCompare(b)));
	};

	const getGuilds = async () => {
		return callbackToPromise<string[]>((cb) => readdir(dir, cb)).catch((ex) => {
			console.error(ex);
			return [];
		});
	};

	const getSounds = async (guild: string) => {
		const files = await getFiles(guild);
		const names = files.map((s) => decode(s.split(".")[0]));
		return names;
	};

	const getSound = async (guild: string, name: string) => {
		const encoded = encode(name);
		const files = await getFiles(guild);
		const file = files.find((s) => s.split(".")[0] === encoded);
		if (!file) {
			return null;
		}
		return join(dir, guild, file);
	};

	const storeSound = async (guild: string, name: string, file: UploadedFile):Promise<string[]> => {
		const ending = file.name.split(".").pop();
		const path = join(dir, guild, `${encode(name)}.${ending}`);

		const exists = await callbackToPromise<void>((cb) =>
			access(join(dir, guild), constants.W_OK, cb)
		)
			.then(() => true)
			.catch(() => false);

		if (!exists) {
			const success = await callbackToPromise<void>((cb) => mkdir(join(dir, guild), cb))
				.then(() => true)
				.catch(() => false);
			if (!success) {
				throw new Error("could not create directory");
			}
		}
		const sounds = await getSounds(guild);
		if(sounds.includes(name)){
						throw new Error("sound already exists");

		}
		await callbackToPromise<void>((cb) => file.mv(path, cb));
		return ([...sounds, name]).sort((a,b) => a.localeCompare(b));
	};

	return {
		storeSound,
		getGuilds,
		getSounds,
		getSound,
	};
};
