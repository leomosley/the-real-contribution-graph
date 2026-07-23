// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: vercel(),
  integrations: [react()],
  vite: {
    // Cast: @tailwindcss/vite ships types against a different Vite version.
    plugins: [/** @type {any} */ (tailwindcss())],
  },
});
