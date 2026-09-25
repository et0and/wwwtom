import { Runtime } from "foldkit";
import { Message, Model, init, update, view } from "./main";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("mono root element is missing");

const application = Runtime.makeApplication({
  Model,
  init,
  update,
  view,
  container: root,
  devTools: { Message },
});

Runtime.run(application);
