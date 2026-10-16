import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works under any GitHub Pages path (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Separate long-lived vendor files so app updates don't re-download Firebase.
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/]@?firebase[\\/](app|firestore|util|logger|component|webchannel-wrapper)[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
