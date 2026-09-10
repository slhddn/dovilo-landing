/* Everything the blog build needs to know about the site and the Sanity project.
   The project id and dataset are not secrets — a public dataset is world-readable
   by design, and the build only ever reads. */

export const SITE = {
  origin: 'https://dovilo.app',
  name: 'Dovilo',
  twitter: '@doviloapp',
  logo: '/notify-icon.png',
  defaultOgImage: '/hero.jpg',
  author: { name: 'Selahaddin Akgün', url: 'https://sakgun.com' },
};

export const SANITY = {
  projectId: '3unyshld',
  dataset: 'production',
  /* Pinned: a GROQ result shape is only stable within an API version. */
  apiVersion: '2024-10-01',
};

export const BLOG = {
  dir: 'blog',
  base: '/blog/',
  title: 'Blog',
  /* Sits in <title> after the post name, and is the blog index description. */
  tagline: 'Focus, productivity and agent workflows — written while building Dovilo.',
  /* How many of the newest posts the homepage section shows. */
  postsOnHome: 3,
  /* Newest-first entries per blog index page. One page until there is more than this. */
  perPage: 24,
};
