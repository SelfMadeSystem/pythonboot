#!/usr/bin/env bun

import plugin from 'bun-plugin-tailwind';
import { cp } from 'fs/promises';
import path from 'path';

const start = performance.now();

const entrypoints = [...new Bun.Glob('**.html').scanSync('src')]
  .map(a => path.resolve('src', a))
  .filter(dir => !dir.includes('node_modules'));

const result = await Bun.build({
  entrypoints,
  outdir: path.join(process.cwd(), 'dist'),
  plugins: [plugin],
  minify: true,
  target: 'browser',
  sourcemap: 'linked',
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});

const copyRouteAssets = async (pkg: string, srcSubdir = '') => {
  let src;
  if (pkg === 'pyodide') {
    src = path.join(process.cwd(), 'public', 'pyodide');
  } else {
    src = path.join(process.cwd(), 'node_modules', pkg, srcSubdir);
  }
  const dest = path.join(
    process.cwd(),
    'dist',
    pkg === 'pyodide' ? 'pyodide' : 'monaco',
  );
  await cp(src, dest, { recursive: true });
  console.log(`Copied ${pkg} assets to ${dest}`);
};

await copyRouteAssets('pyodide');
await copyRouteAssets('monaco-editor', 'min');

const end = performance.now();
console.log(`Build completed in ${(end - start).toFixed(2)}ms`);
console.log('Build logs:');
console.log(result.logs);
