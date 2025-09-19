import PageLayout from "~/components/PageLayout";
import { workPages } from "~/types/work-routes";

export default function WorkHome() {
	return (
		<>
			<PageLayout title="Work" description="Some work that I have made">
				<h1>Work</h1>
				<ul>
					{workPages.map((page) => (
						<h2>
							<a href={page.href}>{page.text}</a>
						</h2>
					))}
				</ul>
			</PageLayout>
		</>
	);
}
