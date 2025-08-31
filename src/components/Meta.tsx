import { Title, Meta } from "@solidjs/meta";

interface MetaProps {
	title: string | number;
	metaType: string;
	metaContent: string;
}

export default function Metadata(props: MetaProps) {
	return (
		<>
			<Title>{props.title} | Tom Hackshaw</Title>
			<Meta
				name={props.metaType || "description"}
				content={
					props.metaContent ||
					"Tom Hackshaw is a design engineer from Aotearoa New Zealand."
				}
			/>
		</>
	);
}
