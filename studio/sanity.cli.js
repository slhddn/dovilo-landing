import { defineCliConfig } from 'sanity/cli';

export default defineCliConfig({
  api: { projectId: '3unyshld', dataset: 'production' },
  /* npx sanity deploy publishes to https://dovilo.sanity.studio */
  studioHost: 'dovilo',
  deployment: { autoUpdates: true },
});
