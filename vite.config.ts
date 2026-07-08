import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// NOTE: change `base` to match your GitHub repo name if deploying to
// https://<username>.github.io/<repo-name>/
// e.g. base: '/tv-tracker/'
// If deploying to a custom domain or a <username>.github.io root repo, use '/'
export default defineConfig({
  base: "/TV-Tracker/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "favicon.ico",
        "favicon-16.png",
        "favicon-32.png",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "TV Tracker",
        short_name: "TV Tracker",
        description: "Track what episode you're on for every show you watch.",
        start_url: ".",
        display: "standalone",
        background_color: "#0d1117",
        theme_color: "#0d1117",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
          {
            src: "favicon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "favicon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "apple-touch-icon.png",
            sizes: "180x180",
            type: "image/png",
          },
        ],
      },
      workbox: {
        // Precache the built app shell (HTML/JS/CSS) so the app can
        // launch from a fully offline cold start, not just stay usable
        // once already open.
        globPatterns: ["**/*.{js,css,html,svg}"],
        // API calls (Drive, TMDB, AniList, Google auth) should never be
        // served from a stale cache — always try the network first and
        // only exist in the runtime cache as a fallback for the
        // shell/assets, never for live data.
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === "https://www.googleapis.com" ||
              url.origin === "https://accounts.google.com" ||
              url.origin === "https://api.themoviedb.org" ||
              url.origin === "https://graphql.anilist.co" ||
              url.origin === "https://image.tmdb.org" ||
              url.origin === "https://s4.anilist.co",
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
});
