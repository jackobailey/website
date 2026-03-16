import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).min(1),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    featured: z.boolean().default(false),
    seoTitle: z.string().optional()
  })
});

const notes = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).min(1),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    featured: z.boolean().default(false),
    seoTitle: z.string().optional()
  })
});

const polls = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    lastUpdated: z.coerce.date(),
    takeaway: z.string(),
    methodology: z.string().optional(),
    featured: z.boolean().default(false),
    links: z
      .array(
        z.object({
          label: z.string(),
          url: z.string().url()
        })
      )
      .default([])
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
  notes,
  polls,
  tags
};
