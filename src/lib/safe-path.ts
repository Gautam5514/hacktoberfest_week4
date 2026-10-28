import fs from 'fs';
import path from 'path';

/**
 * Directories a user may import repositories from. Defaults to the app's own
 * working directory; extend with LASTCOMMIT_ALLOWED_ROOTS (path-delimited list).
 */
export function getAllowedRoots(): string[] {
  const extra = (process.env.LASTCOMMIT_ALLOWED_ROOTS || '')
    .split(path.delimiter)
    .filter(Boolean);
  const roots = [process.cwd(), ...extra];
  return roots.flatMap(r => {
    try {
      return [fs.realpathSync(r)];
    } catch {
      return [];
    }
  });
}

/** True when `child` is `root` itself or lives beneath it (separator-aware). */
export function isWithin(root: string, child: string): boolean {
  const rel = path.relative(root, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Resolve a user-supplied directory to a real path inside an allowed root, or null. */
export function resolveAllowedDirectory(input: string): string | null {
  if (typeof input !== 'string' || input.includes('\0')) return null;
  let real: string;
  try {
    real = fs.realpathSync(path.resolve(input));
    if (!fs.statSync(real).isDirectory()) return null;
  } catch {
    return null;
  }
  return getAllowedRoots().some(root => isWithin(root, real)) ? real : null;
}

/**
 * Resolve `relative` against `root` following symlinks, returning the real path
 * only if it stays inside `root`. Returns null otherwise (or if it doesn't exist).
 */
export function resolveWithin(root: string, relative: string): string | null {
  if (typeof relative !== 'string' || relative.includes('\0')) return null;
  try {
    const realRoot = fs.realpathSync(root);
    const real = fs.realpathSync(path.resolve(realRoot, relative));
    return isWithin(realRoot, real) ? real : null;
  } catch {
    return null;
  }
}
