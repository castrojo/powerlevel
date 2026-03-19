// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://castrojo.github.io',
  base: '/powerlevel/',
  output: 'static',
  // The Astro project root is src/ (inside the repo), so treat it as srcDir.
  // This makes pages live at src/pages/, layouts at src/layouts/, etc.
  srcDir: '.',
});
