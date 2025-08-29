import { Title } from "@solidjs/meta";
import { JSX } from "solid-js";

interface SiteTitleProps {
	children: JSX.Element | string | number;
}

export default function SiteTitle(props: SiteTitleProps) {
	return <Title>{props.children} | Tom Hackshaw</Title>;
}
