/* One blog post.
 *
 * These field names are the contract with tools/build-blog.mjs and with the
 * content pipeline that writes posts through the API. They match what the
 * pipeline already writes — description, mainImage, markdownBody — so the
 * Studio and the API agree on one shape.
 *
 * The body is Markdown, not Portable Text, deliberately: Portable Text has no
 * table block, and an export to it drops tables and most inline links. */

export const post = {
  name: 'post',
  title: 'Post',
  type: 'document',
  groups: [
    { name: 'content', title: 'Content', default: true },
    { name: 'seo', title: 'SEO & social' },
  ],
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'content',
      description: 'The headline. Also the <h1> and the default <title>.',
      validation: (Rule) => Rule.required().max(110),
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'content',
      description: 'The URL: dovilo.app/blog/<slug>/. Once a post is live, changing this breaks its links.',
      options: { source: 'title', maxLength: 72 },
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      group: 'content',
      description:
        'The search snippet, the card text on the blog index and homepage, and the RSS summary. ' +
        'Google cuts it near 155 characters.',
      validation: (Rule) => Rule.required().min(60).max(300),
    },
    {
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
      group: 'content',
      description: 'The post goes live at this moment — a future date holds it back until the next build.',
      initialValue: () => new Date().toISOString(),
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'updatedAt',
      title: 'Updated at',
      type: 'datetime',
      group: 'content',
      description: 'Optional. Set it when a published post gets a real revision; it feeds dateModified.',
    },
    {
      name: 'author',
      title: 'Author',
      type: 'string',
      group: 'content',
      description: 'Leave empty for Selahaddin Akgün.',
    },
    {
      name: 'tags',
      title: 'Tags',
      type: 'array',
      group: 'content',
      of: [{ type: 'string' }],
      options: {
        layout: 'tags',
        list: [
          { title: 'Focus', value: 'Focus' },
          { title: 'Productivity', value: 'Productivity' },
          { title: 'AI & agents', value: 'AI & agents' },
          { title: 'Building Dovilo', value: 'Building Dovilo' },
          { title: 'Comparisons', value: 'Comparisons' },
          { title: 'Guides', value: 'Guides' },
        ],
      },
      validation: (Rule) => Rule.unique().max(4),
    },
    {
      name: 'mainImage',
      title: 'Cover image',
      type: 'image',
      group: 'content',
      description: 'Heads the post and becomes its share card. Landscape, at least 1200×630.',
      options: { hotspot: true },
      fields: [
        {
          name: 'alt',
          title: 'Alt text',
          type: 'string',
          description: 'What the image shows, for screen readers and search. Defaults to the title.',
        },
        { name: 'caption', title: 'Caption', type: 'string' },
      ],
    },
    {
      name: 'markdownBody',
      title: 'Body (Markdown)',
      type: 'text',
      rows: 40,
      group: 'content',
      description:
        'GitHub-flavoured Markdown: ## headings, tables, lists, links, bold, code fences, --- rules. ' +
        'A list of [Section](#section) links at the very top is rendered as a table of contents; the ' +
        'anchors follow GitHub’s heading-id rules, so they resolve. Images are optional — an image on ' +
        'the Sanity CDN is copied into the site at build time, anything else stays remote.',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'seoTitle',
      title: 'SEO title',
      type: 'string',
      group: 'seo',
      description: 'Overrides the title in <title> and share cards. Keep it under ~60 characters.',
      validation: (Rule) => Rule.max(70),
    },
    {
      name: 'metaDescription',
      title: 'Meta description',
      type: 'text',
      rows: 2,
      group: 'seo',
      description: 'Overrides the description as the search snippet only.',
      validation: (Rule) => Rule.max(300),
    },
  ],
  orderings: [{ title: 'Newest first', name: 'publishedDesc', by: [{ field: 'publishedAt', direction: 'desc' }] }],
  preview: {
    select: { title: 'title', date: 'publishedAt', media: 'mainImage' },
    prepare: ({ title, date, media }) => ({
      title,
      subtitle: date ? new Date(date).toISOString().slice(0, 10) : 'no date — will not publish',
      media,
    }),
  },
};
