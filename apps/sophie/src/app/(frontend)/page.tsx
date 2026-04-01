import { SideBySide } from "../../components/SideBySide";
import { siteNav } from "./site-config";

export default function HomePage() {
  return (
    <SideBySide nav={siteNav}>
      <p>Hehehe</p>
    </SideBySide>
  );
}
