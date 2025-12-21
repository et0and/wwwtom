import { render } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { PageLayout } from "../PageLayout";
import { MetaProvider } from "@solidjs/meta";

describe("PageLayout", () => {
	it("matches the snapshot", () => {
		const { container } = render(() => (
			<MetaProvider>
				<PageLayout
					title="Tom and his page layout"
					description="Microservices were a massive mistake"
				>
					<h1>Test content</h1>
				</PageLayout>
			</MetaProvider>
		));
		expect(container).toMatchSnapshot();
	});
});
