import { writeFile } from "node:fs/promises";
import { renderThresholdRaceScene } from "../src/lib/thresholdRaceScene.ts";

await writeFile(new URL("../src/assets/writing/effective-thresholds-race.svg", import.meta.url), renderThresholdRaceScene() + "\n");
console.log("Rendered the original pixel-horse race poster.");
