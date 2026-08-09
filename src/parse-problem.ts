import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const FIGURE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".tif",
  ".tiff",
  ".pdf",
]);

export type ParsedProblem = {
  id: string;
  dirPath: string;
  relativePath: string;
  malformed: boolean;
  malformReason?: string;
  license?: string;
  oer?: string;
  courseName?: string;
  title?: string;
  hasSteps: boolean;
  hasHints: boolean;
  hasScaffolds: boolean;
  hasFigures: boolean;
  figurePaths: string[];
};

function walkFiles(dir: string, acc: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, acc);
    else acc.push(p);
  }
  return acc;
}

export function detectFigures(problemDir: string): string[] {
  const files = walkFiles(problemDir);
  return files.filter((f) => {
    const lower = f.toLowerCase();
    const dot = lower.lastIndexOf(".");
    if (dot < 0) return false;
    return FIGURE_EXT.has(lower.slice(dot));
  });
}

/**
 * Parse one problem directory under content-pool/<id>/.
 */
export function parseProblemDir(
  problemDir: string,
  contentPoolRoot: string,
): ParsedProblem {
  const id = basename(problemDir);
  const relativePath = `content-pool/${id}`;
  const figures = detectFigures(problemDir);

  let hasSteps = false;
  let hasHints = false;
  let hasScaffolds = false;
  try {
    const entries = readdirSync(problemDir);
    hasSteps = entries.includes("steps");
    hasHints =
      entries.includes("tutoring") ||
      entries.some((e) => e.toLowerCase().includes("hint"));
    hasScaffolds = entries.some((e) => e.toLowerCase().includes("scaffold"));
  } catch {
    return {
      id,
      dirPath: problemDir,
      relativePath,
      malformed: true,
      malformReason: "cannot-read-directory",
      hasSteps: false,
      hasHints: false,
      hasScaffolds: false,
      hasFigures: figures.length > 0,
      figurePaths: figures,
    };
  }

  const jsonPath = join(problemDir, `${id}.json`);
  try {
    const stat = statSync(jsonPath);
    if (!stat.isFile()) throw new Error("not a file");
  } catch {
    // Some problems use alternate metadata names — try any top-level json
    let alt: string | undefined;
    try {
      alt = readdirSync(problemDir).find((f) => f.endsWith(".json"));
    } catch {
      /* empty */
    }
    if (!alt) {
      return {
        id,
        dirPath: problemDir,
        relativePath,
        malformed: true,
        malformReason: "missing-problem-json",
        hasSteps,
        hasHints,
        hasScaffolds,
        hasFigures: figures.length > 0,
        figurePaths: figures,
      };
    }
    try {
      const data = JSON.parse(
        readFileSync(join(problemDir, alt), "utf8"),
      ) as Record<string, unknown>;
      return {
        id: String(data.id ?? id),
        dirPath: problemDir,
        relativePath,
        malformed: false,
        license: typeof data.license === "string" ? data.license : undefined,
        oer: typeof data.oer === "string" ? data.oer : undefined,
        courseName:
          typeof data.courseName === "string" ? data.courseName : undefined,
        title: typeof data.title === "string" ? data.title : undefined,
        hasSteps,
        hasHints,
        hasScaffolds,
        hasFigures: figures.length > 0,
        figurePaths: figures,
      };
    } catch (e) {
      return {
        id,
        dirPath: problemDir,
        relativePath,
        malformed: true,
        malformReason: `invalid-json: ${e instanceof Error ? e.message : String(e)}`,
        hasSteps,
        hasHints,
        hasScaffolds,
        hasFigures: figures.length > 0,
        figurePaths: figures,
      };
    }
  }

  try {
    const data = JSON.parse(readFileSync(jsonPath, "utf8")) as Record<
      string,
      unknown
    >;
    return {
      id: String(data.id ?? id),
      dirPath: problemDir,
      relativePath,
      malformed: false,
      license: typeof data.license === "string" ? data.license : undefined,
      oer: typeof data.oer === "string" ? data.oer : undefined,
      courseName:
        typeof data.courseName === "string" ? data.courseName : undefined,
      title: typeof data.title === "string" ? data.title : undefined,
      hasSteps,
      hasHints,
      hasScaffolds,
      hasFigures: figures.length > 0,
      figurePaths: figures,
    };
  } catch (e) {
    return {
      id,
      dirPath: problemDir,
      relativePath,
      malformed: true,
      malformReason: `invalid-json: ${e instanceof Error ? e.message : String(e)}`,
      hasSteps,
      hasHints,
      hasScaffolds,
      hasFigures: figures.length > 0,
      figurePaths: figures,
    };
  }
}
