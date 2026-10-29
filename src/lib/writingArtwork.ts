import type { ImageMetadata } from "astro";
import simpleSystems from "@/assets/writing/simple-systems-pendulum.svg";
import effectiveParties from "@/assets/writing/collision-gas.svg";
import justUseMmp from "@/assets/writing/just-use-mmp-seats.svg";
import taxCurve from "@/assets/writing/tax-curve.svg";

interface WritingArtwork {
  image: ImageMetadata;
  homeClass: string;
  objectPosition: string;
}

const writingArtworkBySlug: Record<string, WritingArtwork> = {
  "growth-curve": {
    image: taxCurve,
    homeClass: "writing-card--tax",
    objectPosition: "50% 50%"
  },
  "just-do-mmp": {
    image: justUseMmp,
    homeClass: "writing-card--mmp",
    objectPosition: "50% 50%"
  },
  "effective-parties-as-collisions": {
    image: effectiveParties,
    homeClass: "writing-card--collisions",
    objectPosition: "52% 50%"
  },
  "not-so-simple-systems": {
    image: simpleSystems,
    homeClass: "writing-card--simple",
    objectPosition: "50% 50%"
  }
};

export function getWritingArtwork(slug: string) {
  const artwork = writingArtworkBySlug[slug];

  if (!artwork) {
    throw new Error(`No writing artwork configured for ${slug}`);
  }

  return artwork;
}
