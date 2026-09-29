import { build } from "esbuild";

const entries = { main: "src/main.ts", post: "src/post.ts", sampler: "src/sampler.ts" };

for (const [name, entry] of Object.entries(entries)) {
  await build({
    entryPoints: [entry],
    outfile: `dist/${name}/index.mjs`,
    bundle: true,
    platform: "node",
    target: "node24",
    format: "esm",
    banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  });
}
