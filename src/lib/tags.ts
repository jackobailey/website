import type { CollectionEntry } from "astro:content";
import { sentenceCaseFromSlug } from "@/lib/format";

export function getTagHref(slug: string, basePath = "/writing/tags") {
  return `${basePath}/${slug}/`;
}

export function buildTagLookup(tags: CollectionEntry<"tags">[]) {
  return Object.fromEntries(
    tags.map((tag) => [
      tag.slug,
      {
        label: tag.data.name,
        description: tag.data.description
      }
    ])
  );
}

export function getTagLabel(
  slug: string,
  lookup: Record<string, { label: string; description: string }>
) {
  return lookup[slug]?.label ?? sentenceCaseFromSlug(slug);
}

export function getTagCounts<T extends { data: { tags: string[] } }>(posts: T[]) {
  const counts = new Map<string, number>();

  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return counts;
}
