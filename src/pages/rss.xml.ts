import type { APIContext } from "astro";
import rss from "@astrojs/rss";
import { getBlogPosts } from "@/lib/content";
import { siteConfig } from "@/site.config";

export async function GET(context: APIContext) {
  const posts = await getBlogPosts();

  return rss({
    title: `${siteConfig.name} | Writing`,
    description: "Public-facing writing on polling, elections, and political change.",
    site: context.site ?? "https://example.com",
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.summary,
      pubDate: post.data.date,
      link: `/writing/${post.slug}/`
    }))
  });
}
