// Run with Node 22.18+ after changing the shared geometry, palette or initial state.
import { writeFile } from "node:fs/promises";
import { renderTaxCurveScene } from "../src/lib/taxCurveScene.ts";

await writeFile(new URL("../src/assets/writing/tax-curve.svg", import.meta.url), renderTaxCurveScene() + "\n");
console.log("Rendered the tax curve and Magma history vector poster.");
