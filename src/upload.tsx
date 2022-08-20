import { ChangeEventHandler, FunctionComponent, useEffect, useRef, useState } from "react";

export type UploadProps = {
	upload: (data: FormData) => void;
};

export const Upload: FunctionComponent<UploadProps> = ({ upload }) => {
	const formRef = useRef<HTMLFormElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [name, setName] = useState<string>("");

	const click = async () => {
		if (formRef.current != undefined) {
			var formData = new FormData(formRef.current);
			if (formData.get("file") != null && formData.get("name") != undefined) {
				upload(formData);
			}
		}
	};

	const changeFile: ChangeEventHandler<HTMLInputElement> = (e) => {
		const file = e.target.files?.[0];
		if (file != undefined) {
			setFile(file);
			if(!name){
				setName(file.name);
			}
		}else{
			setFile(null);
		}
	};

	const disabled = (!file || !name);

	return (
		<form ref={formRef} className="upload_form">
			<h2>Add a sound</h2>
			<label htmlFor="sound" className="button">
				<input
					type="file"
					id="sound"
					name="sound"
					onChange={changeFile}
					accept="audio/*"
				/>
				{ file?.name || "select file"}
			</label>
			<input type="text" placeholder="name" name="name" value={name} onChange={e => setName(e.target.value)} />
			<button disabled={disabled} onClick={click}> upload </button>
		</form>
	);
};
