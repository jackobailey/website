import { getCollection, type CollectionEntry } from "astro:content";

export async function getBlogPosts() {
  const posts = await getCollection("blog");
  return posts.sort((left, right) => right.data.date.valueOf() - left.data.date.valueOf());
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
