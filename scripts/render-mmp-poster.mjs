// Run with Node 22.18+ after changing the shared scene, palette or still layout.
import { writeFile } from "node:fs/promises";
import { renderMmpSeatsScene } from "../src/lib/mmpSeatsScene.ts";

await writeFile(new URL("../src/assets/writing/just-use-mmp-seats.svg", import.meta.url), renderMmpSeatsScene() + "\n");
console.log("Rendered the MMP chair animation's vector still.");
