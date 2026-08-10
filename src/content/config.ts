import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).min(1),
    featured: z.boolean().default(false),
    seoTitle: z.string().optional()
  })
});

const tags = defineCollection({
  type: "content",
  schema: z.object({
    name: z.string(),
    description: z.string(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    featured: z.boolean().default(false)
  })
});

export const collections = {
  blog,
  tags
};
