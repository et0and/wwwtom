// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";
import { hydrate } from "@tanstack/solid-query";
import { queryClient } from "~/libs/query-client";

const stateScript = document.getElementById("query-dehydrated-state");
if (stateScript) {
  hydrate(queryClient, JSON.parse(stateScript.textContent ?? "null"));
  stateScript.remove();
}

mount(() => <StartClient />, document.getElementById("app")!);
