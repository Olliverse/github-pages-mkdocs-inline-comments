import { build } from "esbuild";

await build({
  entryPoints: [
    { in: "src/main.ts", out: "ghc" },
    { in: "src/ghc.css", out: "ghc" },
  ],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  outdir: "../src/mkdocs_inline_comments/assets",
  legalComments: "none",
});
