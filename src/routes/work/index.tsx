import PageLayout from "~/components/PageLayout";
import { workPages } from "~/types/work-routes";

export default function WorkHome() {
	const sortedWork = [...workPages].sort((a, b) =>
		a.title.localeCompare(b.title),
	);

	return (
		<>
			<PageLayout title="Work" description="Some work that I have made">
				<h1>Work</h1>
				<ul>
					{sortedWork.map((page) => (
						<h2>
							<a href={page.href}>{page.title}</a>
						</h2>
					))}
				</ul>
			</PageLayout>
		</>
	);
}
