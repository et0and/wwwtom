import { Component } from "solid-js";
import type { JSX } from "solid-js";
import Meta from "./Meta";

interface PageLayoutProps {
	children: JSX.Element;
	title: string;
	description: string;
}

const PageLayout: Component<PageLayoutProps> = (props) => {
	return (
		<>
			<Meta
				title={props.title}
				metaType="description"
				metaContent={props.description}
			/>
			<main class="mx-auto p-8 max-w-[750px]">{props.children}</main>
		</>
	);
};

export default PageLayout;
