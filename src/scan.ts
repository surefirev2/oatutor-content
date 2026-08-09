import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseProblemDir, type ParsedProblem } from "./parse-problem.ts";

/**
 * Enumerate every problem directory under upstream content-pool/.
 * Does not skip malformed items — callers classify them.
 */
export function scanContentPool(contentPoolRoot: string): ParsedProblem[] {
  let names: string[];
  try {
    names = readdirSync(contentPoolRoot);
  } catch (e) {
    throw new Error(
      `Cannot read content-pool at ${contentPoolRoot}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const problems: ParsedProblem[] = [];
  for (const name of names.sort()) {
    if (name.startsWith(".")) continue;
    const dir = join(contentPoolRoot, name);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    problems.push(parseProblemDir(dir, contentPoolRoot));
  }
  return problems;
}
