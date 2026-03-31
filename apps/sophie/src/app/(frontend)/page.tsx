import { SideBySide } from "../../components/SideBySide";
import "./styles.css";

export default async function HomePage() {
  const nav = {
    homeHref: "/",
    title: "Sophie Tremaine",
    shortTitle: "ST",
    links: [
      { href: "/about", label: "About" },
      { href: "/posts", label: "Posts" },
    ],
  };

  return (
    <SideBySide nav={nav}>
      <p>Hehehe</p>
    </SideBySide>
  );
}
