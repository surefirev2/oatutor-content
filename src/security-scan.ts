import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const ALLOWED_EXT = new Set([
  ".json",
  ".txt",
  ".md",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  "",
]);

const BLOCKED_EXT = new Set([
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bat",
  ".cmd",
  ".ps1",
  ".sh",
  ".wasm",
  ".jar",
  ".php",
  ".py",
  ".rb",
  ".pl",
]);

/**
 * Lightweight supply-chain scan of a problem directory.
 * Licensing is separate; this flags unexpected executables / scripts.
 */
export function securityScanProblemDir(dir: string): string[] {
  const issues: string[] = [];
  const files = walk(dir);
  for (const f of files) {
    const ext = extname(f).toLowerCase();
    if (BLOCKED_EXT.has(ext)) {
      issues.push(`blocked extension ${ext}: ${f}`);
    } else if (ext && !ALLOWED_EXT.has(ext) && !ext.match(/^\.\w{1,5}$/)) {
      // unusual long extensions
      issues.push(`unusual extension ${ext}: ${f}`);
    }
    try {
      const st = statSync(f);
      if (st.size > 25 * 1024 * 1024) {
        issues.push(`oversized file (${st.size}): ${f}`);
      }
    } catch {
      /* ignore */
    }
  }
  return issues;
}

function walk(dir: string, acc: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}
