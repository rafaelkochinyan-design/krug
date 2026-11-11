// Bundles the API into dist/server.js. Workspace packages (@krug/*) are compiled in;
// third-party packages stay in node_modules.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  plugins: [
    {
      name: 'externalize-deps',
      setup(b) {
        b.onResolve({ filter: /^[^./]/ }, (args) =>
          args.path.startsWith('@krug/') ? undefined : { path: args.path, external: true },
        );
      },
    },
  ],
});
console.log('built dist/server.js');
