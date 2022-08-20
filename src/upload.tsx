import {
	ChangeEventHandler,
	FunctionComponent,
	MouseEventHandler,
	SyntheticEvent,
	useEffect,
	useRef,
	useState,
} from "react";

export type UploadProps = {
	upload: (data: FormData) => void;
	setError: (error: string | null) => void;
};

export const Upload: FunctionComponent<UploadProps> = ({ upload, setError }) => {
	const formRef = useRef<HTMLFormElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [name, setName] = useState<string>("");

	const click = async (event: SyntheticEvent) => {
		event.preventDefault();
			const formData = new FormData();
			if(file && name){
				formData.append("sound", file);
				formData.append("name", name);
				upload(formData);
				setFile(null);
				setName("");
			} else {
			setError("Incomplete");
		}
	};

	const changeFile: ChangeEventHandler<HTMLInputElement> = (e) => {
		const file = e.target.files?.[0];
		if (file != undefined) {
			setFile(file);
			if (!name) {
				const fn = file.name.split(".");
				fn.pop();
				setName(fn.join("."));
			}
		} else {
			setFile(null);
		}
	};

	const disabled = !file || !name;

	return (
		<form
			ref={formRef}
			className="upload_form"
			onSubmit={(e) => {
				e.preventDefault();
				click(e);
			}}>
			<h2>Add a sound</h2>
			<label htmlFor="sound" className="button">
				<input type="file" id="sound" name="sound" onChange={changeFile} accept="audio/*" />
				{file?.name || "select file"}
			</label>
			<input
				type="text"
				placeholder="name"
				name="name"
				value={name}
				onChange={(e) => setName(e.target.value)}
			/>
			<button type="button" disabled={disabled} onClick={click}>
				{" "}
				upload{" "}
			</button>
		</form>
	);
};
