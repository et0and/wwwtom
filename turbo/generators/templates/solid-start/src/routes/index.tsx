// @refresh reload
import { Title } from "@solidjs/meta";

export default function Home() {
  return (
    <main>
      <Title>Home | {{ name }}</Title>
      <h1>Welcome to {{ name }}</h1>
      <p>Built with SolidStart</p>
    </main>
  );
}
