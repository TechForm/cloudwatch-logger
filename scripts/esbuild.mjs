import esbuild from 'esbuild';
import { rm } from 'fs/promises';
import { dirname, join } from 'path';
import { argv, env } from 'process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const production = env.NODE_ENV === 'production';
const watch = argv[2];

// esbuild has not "clean build folder" option, so that must be done manually
await rm(join(__dirname, '../build'), {
  force: true,
  recursive: true,
});

await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  platform: 'node',
  bundle: true,
  minify: production,
  target: 'node16',
  watch: watch == '--watch' && {
    onRebuild: (err, _result) => {
      if (err) {
        console.error('esbuild watcher error: ', err);
      } else {
        console.log('Files rebuilt successfully');
      }
    },
  },
});

console.log(
  watch ? '...watching for file changes' : 'Files bundled successfully',
);
