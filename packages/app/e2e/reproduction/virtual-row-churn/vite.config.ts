import { defineConfig } from "vite"
import solid from "vite-plugin-solid"

export default defineConfig({
  root: import.meta.dirname,
  plugins: [solid()],
  resolve: {
    alias: {
      "@": new URL("../../../src", import.meta.url).pathname,
    },
  },
})
