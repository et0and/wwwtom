import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Welcome to {{ name }}</h1>
      <p>Built with TanStack Start</p>
    </div>
  );
}
