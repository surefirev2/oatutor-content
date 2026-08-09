/**
 * Parse OATutor-style "url <Label>" OER / license fields.
 */
export function parseUrlLabel(raw: string | undefined | null): {
  url?: string;
  label?: string;
  raw: string;
} {
  if (!raw) return { raw: "" };
  const trimmed = raw.trim();
  if (!trimmed) return { raw: "" };

  const angle = trimmed.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (angle) {
    const url = angle[1]!.trim();
    const label = angle[2]!.trim();
    return {
      url: url || undefined,
      label: label || undefined,
      raw: trimmed,
    };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return { url: trimmed, raw: trimmed };
  }

  return { label: trimmed, raw: trimmed };
}

/** Stable host+path key for frequency reports (drop query/hash). */
export function hostPathKey(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.replace(/\/+$/, "") || u.hostname;
  } catch {
    return url.slice(0, 200);
  }
}
