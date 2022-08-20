import bodyParser from "body-parser";
import express from "express";
import fileUpload from "express-fileupload";
import { join } from "path";
import { init as initDB } from "./db";
import { init as initRest } from "./rest";
import { init as initVoice } from "./voice";
import cookieSession from "cookie-session";
import { fetch } from "undici";
import { findVoiceChannel } from "./util";
import { ChannelType } from "discord.js";
import { readFileSync } from "fs";
import http from "http";
import https from "https";

const ORIGIN = "http://localhost:8080";

type Session = {
	user?: string;
	verifier?: string;
};

const main = async (
	id: string,
	token: string,
	oauthSecret: string,
	origin: string,
	secret: string
) => {
	let privateKey, certificate;

	try {
		const SSL_DIR = process.env.SSL_DIR ||  join(__dirname, "../ssl");
		privateKey = readFileSync(join(SSL_DIR, "privkey.pem"), "utf8");
		certificate = readFileSync(join(SSL_DIR, "fullchain.pem"), "utf8");
	} catch (ex) {
		console.log("Could not read ssl files");
	}

	const { Issuer } = await import("openid-client");

	const db = await initDB();
	const { storeSound, getSounds, getSound, getGuilds } = db;

	const { updateGuildSounds } = await initRest(id, token);

	getGuilds().then((guilds) => {
		guilds.forEach(async (guild) => {
			const sounds = await getSounds(guild);
			await updateGuildSounds(guild, sounds);
		});
	});

	const { client, playSound, stopSound, isUserInGuild } = await initVoice(token, db, origin);

	const token_endpoint = "https://discord.com/api/oauth2/token";
	const discordIssuer = new Issuer({
		issuer: "discord",
		authorization_endpoint: "https://discord.com/api/oauth2/authorize",
		token_endpoint,
	});

	const discordOauth = new discordIssuer.Client({
		client_id: id,
		client_secret: secret,
		redirect_uris: [`${origin}/auth`],
	});

	const server = express();
	server.use(
		cookieSession({
			name: "session",
			secret,
		})
	);

	const redirect_uri = `${origin}/auth`;

	const browserHandler = (req: express.Request, res: express.Response) => {
		if (!req.session) {
			res.status(500).send("error");
			return;
		}
		if (req.session?.user) {
			res.sendFile(join(__dirname, "../dist/index.html"));
		} else {
			req.session.redirect = req.originalUrl;
			res.redirect(
				302,
				discordOauth.authorizationUrl({
					scope: "identify",
					redirect_uri,
					prompt: "none",
					response_type: "code",
				})
			);
		}
	};

	server.get("/auth", async (req, res) => {
		const params = discordOauth.callbackParams(req);
		const data = {
			client_id: id,
			client_secret: oauthSecret,
			grant_type: "authorization_code",
			code: params.code,
			redirect_uri,
		};
		const tokenRes = await fetch(token_endpoint, {
			method: "POST",
			body: new URLSearchParams(data as any).toString(),
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
		});
		const token = (await tokenRes.json()) as any;

		if (!token?.access_token) {
			res.status(500).send("error");
			return;
		}

		const userRes = await fetch(`https://discord.com/api/oauth2/@me`, {
			headers: {
				Authorization: `Bearer ${token.access_token}`,
			},
		});
		const user = (await userRes.json()) as any;
		(req.session as Session).user = user.user.id;
		const redirect = req.session?.redirect ?? "/";
		res.redirect(302, redirect);
	});

	server.get("index.html", browserHandler);
	server.get("/", browserHandler);

	server.use(express.static(join(__dirname, "../dist/")));
	server.use(express.static(join(__dirname, "../webroot/")));

	server.use(bodyParser.json());
	server.use(bodyParser.urlencoded({ extended: false }));

	server.use(
		fileUpload({
			safeFileNames: true,
			preserveExtension: true,
			limits: { fileSize: 50 * 1024 * 1024 },
		})
	);

	server.get("/sounds/:guild", async (req, res) => {
		try {
			const user = (req.session as Session).user;
			const guildId = req.params.guild;
			if (!user && !isUserInGuild(guildId, user)) {
				res.status(401).send("no permission");
				return;
			}
			const sounds = await getSounds(req.params.guild);
			const guild = client.guilds.resolve(guildId);
			const channels = guild?.channels.cache.filter((c) => c.type === ChannelType.GuildVoice);
			res.json({
				sounds,
				guildName: guild?.name,
				channels: channels?.map((c) => ({ name: c.name, id: c.id })),
			});
		} catch (e) {
			res.status(500).send(e.message);
		}
	});

	server.post("/stop/:guild", async (req, res) => {
		try {
			const user = (req.session as Session).user;
			const guildId = req.params.guild;
			if (!user && !isUserInGuild(guildId, user)) {
				res.status(401).send("no permission");
				return;
			}

			stopSound(guildId);
			res.status(200).send("ok");
		} catch (ex) {
			res.status(500).send(ex.message);
		}
	});

	server.post("/play/:guild", async (req, res) => {
		try {
			const user = (req.session as Session).user;
			const guildId = req.params.guild;
			if (!user && !isUserInGuild(guildId, user)) {
				res.status(401).send("no permission");
				return;
			}

			const channelName = req.body.channel;
			const sound = req.body.sound;
			const guild = client.guilds.resolve(guildId);
			if (!guild) {
				res.status(400).send("no guild");
				return;
			}
			const uc = channelName && guild.channels.resolve(channelName);

			const channel = findVoiceChannel(guild, user, uc);
			if (!channel) {
				res.status(400).send("no channel");
				return;
			}
			await playSound(guildId, channel, sound);
			res.status(200).send("ok");
		} catch (ex) {
			res.status(500).send(ex.message);
		}
	});

	server.post("/sounds/:guild", async (req, res) => {
		try {
			const user = (req.session as Session).user;
			const guildId = req.params.guild;
			if (!user && !isUserInGuild(guildId, user)) {
				res.status(401).send("no permission");
				return;
			}

			if (guildId && req.body.name && (req as any).files.sound) {
				await storeSound(guildId, req.body.name, (req as any).files.sound)
					.then((sounds) => {
						updateGuildSounds(guildId, sounds);
						res.status(200).send("ok");
					})
					.catch((e) => {
						res.status(400).send(e.message);
					});
			} else {
				res.status(400).send("incomplete");
			}
		} catch (ex) {
			res.status(500).send(ex.message);
		}
	});

	server.get("*", browserHandler);

	const ssl = privateKey && certificate;

	const http_port = process.env.HTTP_PORT || 80;
	const https_port = process.env.HTTPS_PORT || 443;

	const httpServer = http.createServer(server);
	const httpsServer = ssl
		? https.createServer({ key: privateKey, cert: certificate }, server)
		: null;

	httpServer.listen(http_port, () => {
		console.log(`HTTP server listening on port ${http_port}`);
	});

	if (httpsServer) {
		httpsServer.listen(https_port, () => {
			console.log(`HTTPS server listening on port ${https_port}`);
		});
	}
};

if(!process.env.DISCORD_ID || !process.env.DISCORD_TOKEN || !process.env.AUTH_SECRET || !process.env.SECRET){
	console.error("Missing environment variables");
	process.exit(1);
}else{
	main(
		process.env.DISCORD_ID,
		process.env.DISCORD_TOKEN,
		process.env.AUTH_SECRET,
		process.env.ORIGIN || ORIGIN,
		process.env.SECRET
	);
	
}
