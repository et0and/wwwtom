import { Title, Meta } from "@solidjs/meta";
import { isServer } from "solid-js/web";
import { getRequestEvent } from "solid-js/web";

interface MetaProps {
	title: string | number;
	metaType: string;
	metaContent: string;
}

export default function Metadata(props: MetaProps) {
	const description =
		props.metaContent ||
		"Tom Hackshaw is a design engineer from Aotearoa New Zealand.";

	let baseUrl = "https://tom.so";

	if (isServer) {
		const event = getRequestEvent();
		if (event?.request) {
			const url = new URL(event.request.url);
			baseUrl = `${url.protocol}//${url.host}`;
		}
	} else if (typeof window !== "undefined") {
		baseUrl = `${window.location.protocol}//${window.location.host}`;
	}

	const ogImageUrl = `${baseUrl}/api/og?title=${encodeURIComponent(props.title.toString())}&summary=${encodeURIComponent(description)}`;

	return (
		<>
			<Title>{props.title} | Tom Hackshaw</Title>
			<Meta name={props.metaType || "description"} content={description} />
			<Meta property="og:title" content={`${props.title} | Tom Hackshaw`} />
			<Meta property="og:description" content={description} />
			<Meta property="og:image" content={ogImageUrl} />
			<Meta name="twitter:title" content={`${props.title} | Tom Hackshaw`} />
			<Meta name="twitter:description" content={description} />
			<Meta name="twitter:image" content={ogImageUrl} />
			<Meta name="twitter:card" content="summary_large_image" />
		</>
	);
}
