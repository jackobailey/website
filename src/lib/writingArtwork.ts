import type { ImageMetadata } from "astro";
import electionsTriangles from "@/assets/writing/elections-triangles-pink.png";
import effectiveParties from "@/assets/writing/effective-parties-purple.png";
import justUseMmp from "@/assets/writing/just-use-mmp-coral.png";
import taxCurve from "@/assets/writing/tax-curve-coral.png";

interface WritingArtwork {
  image: ImageMetadata;
  homeClass: string;
  objectPosition: string;
}

const writingArtworkBySlug: Record<string, WritingArtwork> = {
  "growth-curve": {
    image: taxCurve,
    homeClass: "writing-card--tax",
    objectPosition: "52% 50%"
  },
  "just-do-mmp": {
    image: justUseMmp,
    homeClass: "writing-card--mmp",
    objectPosition: "50% 52%"
  },
  "what-is-an-effective-party": {
    image: effectiveParties,
    homeClass: "writing-card--effective",
    objectPosition: "52% 50%"
  },
  "effective-parties-as-collisions": {
    image: effectiveParties,
    homeClass: "writing-card--collisions",
    objectPosition: "52% 50%"
  },
  "elections-as-hyper-dimensional-triangles": {
    image: electionsTriangles,
    homeClass: "writing-card--triangles",
    objectPosition: "50% 52%"
  },
  "not-so-simple-systems": {
    image: electionsTriangles,
    homeClass: "writing-card--simple",
    objectPosition: "50% 52%"
  }
};

export function getWritingArtwork(slug: string) {
  const artwork = writingArtworkBySlug[slug];

  if (!artwork) {
    throw new Error(`No writing artwork configured for ${slug}`);
  }

  return artwork;
}
