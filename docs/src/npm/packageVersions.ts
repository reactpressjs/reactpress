/** Public unscoped install package (`npm i -g reactpressjs`). */
export const REACTPRESS_NPM_PACKAGE = 'reactpressjs';

/** Implementation package published under the org scope. */
export const REACTPRESS_CORE_NPM_PACKAGE = '@reactpressjs/reactpress';

export const REACTPRESS_NPM_REGISTRY_URL = 'https://registry.npmjs.org/reactpressjs';

export const REACTPRESS_NPM_PAGE_URL = 'https://www.npmjs.com/package/reactpressjs';

export const REACTPRESS_CORE_NPM_PAGE_URL = 'https://www.npmjs.com/package/@reactpressjs/reactpress';

/** npm.com version page, e.g. …/v/4.0.0 */
export function buildNpmVersionPageUrl(version: string): string {
  return `${REACTPRESS_NPM_PAGE_URL}/v/${encodeURIComponent(version)}`;
}

/** GitHub release tag page, e.g. …/releases/tag/v4.0.0 */
export function buildGitHubReleaseTagUrl(version: string): string {
  return `https://github.com/reactpressjs/reactpress/releases/tag/v${encodeURIComponent(version)}`;
}

/** Fallback when the registry is unreachable (SSR / offline). */
export const FALLBACK_REACTPRESS_LATEST = '5.0.0';

/** @deprecated Use FALLBACK_REACTPRESS_LATEST */
export const FALLBACK_REACTPRESS_VERSIONS = {
  latest: FALLBACK_REACTPRESS_LATEST,
} as const;

export type ReactPressDistTags = {
  latest: string;
};

type NpmRegistryResponse = {
  'dist-tags'?: Partial<ReactPressDistTags> & Record<string, string>;
};

export async function fetchReactPressVersions(): Promise<ReactPressDistTags> {
  const response = await fetch(REACTPRESS_NPM_REGISTRY_URL);
  if (!response.ok) {
    throw new Error(`npm registry responded with ${response.status}`);
  }

  const data = (await response.json()) as NpmRegistryResponse;
  const distTags = data['dist-tags'] ?? {};

  return {
    latest: distTags.latest ?? FALLBACK_REACTPRESS_LATEST,
  };
}

/** Global install command — always npm `@latest`. */
export function buildInstallCommand(): string {
  return `npm i -g ${REACTPRESS_NPM_PACKAGE}`;
}

export function buildNpmInstallOutput(version: string): string {
  return `${REACTPRESS_NPM_PACKAGE}@${version}`;
}

/** e.g. 4.0.0 → 4.0 */
export function formatMajorMinor(version: string): string {
  const match = version.match(/^(\d+)\.(\d+)/);
  return match ? `${match[1]}.${match[2]}` : version;
}
