// Version helpers for strings like "1.10.2".
// Missing parts count as 0 ("1.2" is "1.2.0") and a suffix such as "-beta" is
// ignored ("1.2.3-beta" is 1.2.3).
type Version = [number, number, number];

function parseVersion(version: string): Version {
  const [major = 0, minor = 0, patch = 0] = version
    .split(".")
    .map((part) => parseInt(part, 10));
  return [major, minor, patch];
}

// -1 when a is older than b, 0 when equal, 1 when a is newer.
function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return 0;
}

// Versions ordered from the lowest to the highest. Does not change the input.
function sortVersions(versions: string[]): string[] {
  return [...versions].sort((a, b) => compareVersions(a, b));
}

// The highest version, or null for an empty list.
function latestVersion(versions: string[]): string | null {
  if (versions.length === 0) return null;
  return sortVersions(versions).pop()!;
}

// True when `version` is the same as or newer than `minimum`.
function isAtLeast(version: string, minimum: string): boolean {
  return compareVersions(version, minimum) >= 0;
}

// True when the text carries a suffix such as "-beta".
function hasSuffix(version: string): boolean {
  return version.includes("-");
}

// Versions that are newer than `current`, lowest first.
function upgradesFrom(current: string, versions: string[]): string[] {
  return sortVersions(versions).filter(
    (version) => compareVersions(version, current) > 0,
  );
}
