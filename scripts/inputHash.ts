import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Everything that determines src/generated/dataset.json. The build stamps a
 * hash of these files into the dataset and scripts/dataset.test.ts recomputes
 * it, so changing the data or the pipeline without `npm run data:build` fails
 * the tests instead of shipping a stale dataset.
 */
export const PIPELINE_INPUTS = [
  'data/movies.json',
  'scripts/build-dataset.ts',
  'src/core/connections.ts',
  'src/core/dataset.ts',
  'src/core/genres.ts',
  'src/core/graph.ts',
  'src/core/layout.ts',
];

export const hashPipelineInputs = async (root: string): Promise<string> => {
  const hash = createHash('sha256');
  for (const path of PIPELINE_INPUTS) {
    const text = (await readFile(resolve(root, path), 'utf8')).replace(/\r\n/g, '\n'); // CRLF checkouts hash the same
    hash.update(`${path}\0${text}\0`);
  }
  return hash.digest('hex').slice(0, 16);
};
