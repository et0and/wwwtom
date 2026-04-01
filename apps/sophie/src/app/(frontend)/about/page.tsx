import { SideBySide } from "../../../components/SideBySide";
import { siteNav } from "../site-config";

export default function AboutPage() {
  return (
    <SideBySide nav={siteNav}>
      <p>About meh</p>
    </SideBySide>
  );
}
