import PageLayout from "~/components/PageLayout";
import type { WorkPage } from "~/types/work-routes";

const pages: WorkPage[] = [
	{
		href: "/work/an-idea-for-a-performance",
		text: "An idea for a performance",
	},
];

export default function Home() {
	return (
		<>
			<PageLayout title="Work" description="Some work that I have made">
				<h1>Work</h1>
				<ul>
					{pages.map((page) => (
						<li>
							<a href={page.href}>{page.text}</a>
						</li>
					))}
				</ul>
			</PageLayout>
		</>
	);
}
