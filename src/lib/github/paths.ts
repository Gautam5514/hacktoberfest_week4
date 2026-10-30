import fs from 'fs';
import path from 'path';

export function dataDir(): string {
  const dir = process.env.LASTCOMMIT_DATA_DIR || path.join(process.cwd(), '.lastcommit');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}
