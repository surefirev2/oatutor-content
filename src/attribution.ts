import type { LicenceRegistryEntry } from "./schemas.ts";
import { licenseUrlForSpdx } from "./spdx.ts";

export function buildAttribution(input: {
  entry: LicenceRegistryEntry;
  sourceUrl?: string;
}): {
  required: true;
  text: string;
  sourceUrl?: string;
  licenseUrl?: string;
  license: string;
} {
  const text = input.entry.attributionTemplate
    .replaceAll("{{sourceUrl}}", input.sourceUrl ?? "")
    .replaceAll("{{license}}", input.entry.license)
    .replaceAll("{{title}}", input.entry.title)
    .replaceAll("{{publisher}}", input.entry.publisher)
    .trim();

  if (!text) {
    throw new Error(`Empty attribution for registry ${input.entry.id}`);
  }

  return {
    required: true,
    text,
    sourceUrl: input.sourceUrl,
    licenseUrl: licenseUrlForSpdx(input.entry.license),
    license: input.entry.license,
  };
}
