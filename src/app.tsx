import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import { MetaProvider } from "@solidjs/meta";
import Nav from "~/components/Nav";
import Footer from "~/components/Footer";
import "./app.css";

export default function App() {
	return (
		<MetaProvider>
			<Router
				root={(props) => (
					<div class="min-h-screen flex flex-col">
						<Nav />

						<main class="flex-1">
							<Suspense>{props.children}</Suspense>
						</main>
						<Footer />
					</div>
				)}
			>
				<FileRoutes />
			</Router>
		</MetaProvider>
	);
}
