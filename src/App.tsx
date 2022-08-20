import { useCallback, useEffect, useRef, useState } from "react";
import { IoStop, IoPlay, IoChevronDown } from "react-icons/io5";
import clsx from "clsx";
import "./app.scss";
import { Upload } from "./upload";

function App() {
	const [sounds, setSounds] = useState<null | string[]>(null);
	const [playing, setPlaying] = useState("");
	const [channels, setChannels] = useState<{ name: string; id: string }[]>([]);
	const [channel, setChannel] = useState<string>();
	const [selectOpen, setSelectOpen] = useState(false);
	const selectRef = useRef<HTMLDivElement>(null);

	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (error) {
			const inter = setTimeout(() => {
				setError(null);
			}, 5000);
			return () => clearTimeout(inter);
		}
	}, [error, setError]);

	const path = location.pathname;
	const guild = path.split("/")[1];

	const fetchSounds = useCallback(async () => {
		fetch(`/sounds/${guild}`)
			.then((res) => res.json())
			.then((data) => {
				setSounds(data.sounds);
				setName(data.guildName);
				setChannels(data.channels);
			});
	}, [setSounds, setName, setChannels]);

	useEffect(() => {
		if (!guild) return;
		fetchSounds();
	}, [guild]);

	const play = async (sound: string) => {
		if (playing === sound) {
			await fetch(`/stop/${guild}`, {
				method: "POST",
			});
			setPlaying("");
		} else {
			setPlaying(sound);
			const res = await fetch(`/play/${guild}`, {
				method: "POST",
				body: JSON.stringify({ sound, channel: channel || undefined }),
				headers: {
					"Content-Type": "application/json",
				},
			});
			if (!res.ok) {
				const text = await res.text().catch(() => res.statusText);
				setError(text);
			}

			setPlaying(p => {
				const to = (p == sound ? "" : p);
				return to;
			});
		}
	};

	const upload = useCallback(async (data: FormData) => {
		await fetch(`/sounds/${guild}`, {
			method: "POST",
			body: data,
		});
		fetchSounds();
	}, [guild, fetchSounds]);

	const selectChannel = useCallback(
		(c: string) => {
			setChannel(c);
			setSelectOpen(false);
		},
		[setChannel, setSelectOpen]
	);

	useEffect(() => {
		const el = (e: MouseEvent) => {
			if (selectRef.current != null && !selectRef.current.contains(e.target as Node)) {
				setSelectOpen(false);
			}
		};
		window.addEventListener("mousedown", el);
		return () => window.removeEventListener("mousedown", el);
	}, [setSelectOpen]);

	return (
		<div className="app">
			{!guild && (
				<>
					<h1>No server selected</h1>
					
					<a href="https://discord.com/api/oauth2/authorize?client_id=462749560981291008&permissions=2184184832&redirect_uri=https%3A%2F%2Fdiscord.nitschke.dev%2Fauth&response_type=code&scope=identify%20bot"><button> add to your server</button></a>
					<p style={{paddingTop: "1rem"}}>Add the bot to your server and use the /link command to open the app!</p>
				</>
			)}
			{sounds && Array.isArray(sounds) && (
				<>
					<div className="head">
						<h1>{name ? name : ""} Sounds </h1>
						<div className={clsx("channel", selectOpen && "open")} ref={selectRef}>
							<button onClick={() => setSelectOpen((open) => !open)}>
								Channel:{" "}
								{channels.find((c) => c.id === channel)?.name ?? "current channel"}
								<IoChevronDown className="icon" />
							</button>
							<ul className="popup">
								{channels.map(({ name, id }) => (
									<li key={id} onClick={() => selectChannel(id)}>
										{name}
									</li>
								))}
							</ul>
							{sounds.length === 0 && (
								<h2>Upload some sounds to get started!</h2>
							)}
						</div>
					</div>
					<div className={clsx("sounds", selectOpen && "faded")}>
						<ul>
							{sounds.map((sound) => (
								<li onClick={() => play(sound)} key={sound} className="button">
									{playing == sound ? <IoStop /> : <IoPlay />}
									{sound}
								</li>
							))}
						</ul>
						<Upload upload={upload} setError={setError} />
						{error && <div className="error">{error}</div>}
					</div>
				</>
			)}
		</div>
	);
}

export default App;
