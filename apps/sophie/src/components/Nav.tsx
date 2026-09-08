import { useColorMode } from "@tom/ui/tomui/color-mode";

export const Nav = () => {
  useColorMode();
  return (
    <nav class="sophie-nav">
      <a href="/" class="sophie-wordmark">
        Sophie
      </a>
      <a href="/about" class="sophie-about">
        About
      </a>
    </nav>
  );
};
