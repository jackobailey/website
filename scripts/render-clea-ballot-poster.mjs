import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { renderCleaBallotScene } from "../src/lib/cleaBallotScene.ts";

const scene = renderCleaBallotScene();
await writeFile(new URL("../src/assets/writing/clean-clea-ballot.svg", import.meta.url), scene + "\n");
await writeFile(new URL("../src/assets/writing/clean-clea-social.png", import.meta.url), await sharp(Buffer.from(scene)).png().toBuffer());
console.log("Rendered the Clean CLEA SVG card artwork and matching PNG social preview.");
