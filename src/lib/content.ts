import { getCollection, type CollectionEntry } from "astro:content";

export async function getBlogPosts() {
  const posts = await getCollection("blog");
  return posts.sort((left, right) => right.data.date.valueOf() - left.data.date.valueOf());
}

export async function getNotesEntries() {
  const notes = await getCollection("notes");
  return notes.sort((left, right) => right.data.date.valueOf() - left.data.date.valueOf());
}

export async function getPollEntries() {
  const entries = await getCollection("polls");
  return entries.sort((left, right) => right.data.date.valueOf() - left.data.date.valueOf());
}

export async function getTagEntries() {
  const entries = await getCollection("tags");
  return entries.sort((left, right) => left.data.name.localeCompare(right.data.name));
}

export function getRelatedPosts(
  post: CollectionEntry<"blog">,
  posts: CollectionEntry<"blog">[]
) {
  return posts
    .filter((candidate) => candidate.slug !== post.slug)
    .map((candidate) => ({
      post: candidate,
      score: candidate.data.tags.filter((tag) => post.data.tags.includes(tag)).length
    }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.post.data.date.valueOf() - left.post.data.date.valueOf()
    )
    .slice(0, 3)
    .map((candidate) => candidate.post);
}

export function getRelatedNotes(
  note: CollectionEntry<"notes">,
  notes: CollectionEntry<"notes">[]
) {
  return notes
    .filter((candidate) => candidate.slug !== note.slug)
    .map((candidate) => ({
      note: candidate,
      score: candidate.data.tags.filter((tag) => note.data.tags.includes(tag)).length
    }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.note.data.date.valueOf() - left.note.data.date.valueOf()
    )
    .slice(0, 3)
    .map((candidate) => candidate.note);
}
