import type { CollectionEntry } from "astro:content";
import { getBlogPosts, getNotesEntries, getTagEntries } from "@/lib/content";

export type TaggedContentEntry =
  | {
      collection: "writing";
      collectionLabel: "Writing";
      entry: CollectionEntry<"blog">;
      href: string;
    }
  | {
      collection: "notes";
      collectionLabel: "Notebook";
      entry: CollectionEntry<"notes">;
      href: string;
    };

export function getCombinedTagCounts(entries: TaggedContentEntry[]) {
  const total = new Map<string, number>();
  const writing = new Map<string, number>();
  const notes = new Map<string, number>();

  for (const item of entries) {
    for (const tag of item.entry.data.tags) {
      total.set(tag, (total.get(tag) ?? 0) + 1);

      const collectionCounts = item.collection === "writing" ? writing : notes;
      collectionCounts.set(tag, (collectionCounts.get(tag) ?? 0) + 1);
    }
  }

  return {
    notes,
    total,
    writing
  };
}

export async function getTaggedContentEntries() {
  const [posts, notes] = await Promise.all([getBlogPosts(), getNotesEntries()]);
  const entries: TaggedContentEntry[] = [
    ...posts.map((entry) => ({
      collection: "writing" as const,
      collectionLabel: "Writing" as const,
      entry,
      href: `/writing/${entry.slug}/`
    })),
    ...notes.map((entry) => ({
      collection: "notes" as const,
      collectionLabel: "Notebook" as const,
      entry,
      href: `/notes/${entry.slug}/`
    }))
  ];

  return entries.sort(
    (left, right) => right.entry.data.date.valueOf() - left.entry.data.date.valueOf()
  );
}

export async function getCombinedTagStaticPaths() {
  const [entries, tags] = await Promise.all([getTaggedContentEntries(), getTagEntries()]);
  const tagCounts = getCombinedTagCounts(entries);

  return tags
    .filter((tag) => (tagCounts.total.get(tag.slug) ?? 0) > 0)
    .map((tag) => ({
      params: { tag: tag.slug },
      props: {
        entries: entries.filter((item) => item.entry.data.tags.includes(tag.slug)),
        tag
      }
    }));
}
