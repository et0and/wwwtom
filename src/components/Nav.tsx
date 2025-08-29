export default function Nav() {
	return (
		<nav class="flex items-center tracking-tighter justify-between h-16 px-6 py-4 flex-shrink-0">
			<a class="text-lg font-medium" href="/">
				<h1 class="md:block hidden">Tom Hackshaw</h1>
				<div class="md:hidden block transition-colors duration-100 w-7 h-7 bg-black rounded-full">
					<h1 class="sr-only">Tom Hackshaw</h1>
				</div>
			</a>
			<div class="flex md:items-center space-x-4 text-lg">
				<a href="/about">About</a>
				<a href="/work">Work</a>
				<a href="/posts">Writing</a>
			</div>
		</nav>
	);
}
