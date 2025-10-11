import { Component } from "solid-js";
import type { JSX } from "solid-js";
import Meta from "./Meta";

interface PageLayoutProps {
	children: JSX.Element;
	title?: string;
	description?: string;
	frontmatter?: {
		title: string;
		summary: string;
		publishedAt: string;
	};
}

const PageLayout: Component<PageLayoutProps> = (props) => {
	const title = props.frontmatter?.title ?? props.title ?? "";
	const description = props.frontmatter?.summary ?? props.description ?? "";

	return (
		<>
			<Meta title={title} metaType="description" metaContent={description} />
			<main class="mx-auto p-8 max-w-[750px]">{props.children}</main>
		</>
	);
};

export default PageLayout;
