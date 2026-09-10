import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './schemaTypes/index.js';

export default defineConfig({
  name: 'dovilo',
  title: 'Dovilo',

  projectId: '3unyshld',
  dataset: 'production',

  plugins: [structureTool()],

  schema: { types: schemaTypes },

  document: {
    /* "Open preview" on a post goes to the published page. */
    productionUrl: async (prev, { document }) =>
      document?._type === 'post' && document?.slug?.current
        ? `https://dovilo.app/blog/${document.slug.current}/`
        : prev,
  },
});
