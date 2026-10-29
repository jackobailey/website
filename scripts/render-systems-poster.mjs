// Run with Node 22.18+ after changing the shared scene or initial pendulum state.
import { writeFile } from "node:fs/promises";
import { renderSystemsScene } from "../src/lib/systemsScene.ts";

await writeFile(new URL("../src/assets/writing/simple-systems-pendulum.svg", import.meta.url), renderSystemsScene() + "\n");
console.log("Rendered the double-pendulum and fading-trail vector poster.");
