import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const assetsDirectory = fileURLToPath(
  new URL('../dist/assets/', import.meta.url),
);
const budgets = {
  '.js': { individual: 750_000, total: 750_000 },
  '.css': { individual: 100_000, total: 100_000 },
};

const files = await readdir(assetsDirectory);
let failed = false;

for (const [extension, budget] of Object.entries(budgets)) {
  const matching = files.filter((file) => file.endsWith(extension));
  const sizes = await Promise.all(
    matching.map(async (file) => ({
      file,
      bytes: (await stat(join(assetsDirectory, file))).size,
    })),
  );
  const total = sizes.reduce((sum, asset) => sum + asset.bytes, 0);
  for (const asset of sizes) {
    if (asset.bytes > budget.individual) {
      console.error(
        `${asset.file} is ${asset.bytes} bytes; individual ${extension} budget is ${budget.individual}.`,
      );
      failed = true;
    }
  }
  if (total > budget.total) {
    console.error(
      `Total ${extension} output is ${total} bytes; budget is ${budget.total}.`,
    );
    failed = true;
  }
}

if (failed) process.exitCode = 1;
else console.log('Bundle budgets passed.');
