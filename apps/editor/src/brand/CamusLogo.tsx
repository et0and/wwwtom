import camusLogo from "../assets/camus.svg?raw";

/** Camus mark on the sign-in view. Fill inherits text color for light/dark. */
export const CamusLogo = () => <div class="camus-logo" aria-hidden="true" innerHTML={camusLogo} />;
