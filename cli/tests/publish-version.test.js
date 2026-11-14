const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { incrementVersion, promoteToStable, resolveNpmTag, CORE_PUBLISH_PACKAGES } = require('../out/lib/publish');

const REPO_ROOT = path.join(__dirname, '..', '..');

describe('publish version bump', () => {
  it('bumps patch', () => {
    assert.equal(incrementVersion('3.0.3', 'patch'), '3.0.4');
  });

  it('handles two-segment versions', () => {
    assert.equal(incrementVersion('3.0', 'patch'), '3.0.1');
  });

  it('bumps beta from stable', () => {
    assert.equal(incrementVersion('4.0.0', 'beta'), '4.0.0-beta.0');
  });

  it('bumps beta prerelease', () => {
    assert.equal(incrementVersion('3.0.0-beta.1', 'beta'), '3.0.0-beta.2');
  });

  it('promotes beta to stable without bumping patch', () => {
    assert.equal(promoteToStable('4.0.0-beta.18'), '4.0.0');
    assert.equal(incrementVersion('4.0.0-beta.18', 'stable'), '4.0.0');
  });

  it('promoteToStable is a no-op for already-stable versions', () => {
    assert.equal(promoteToStable('4.0.0'), '4.0.0');
    assert.equal(incrementVersion('4.0.0', 'stable'), '4.0.0');
  });
});

describe('resolveNpmTag for stable promotion', () => {
  it('maps stable semver to latest by default', () => {
    assert.equal(resolveNpmTag('4.0.0'), 'latest');
  });

  it('maps prerelease semver to beta by default', () => {
    assert.equal(resolveNpmTag('4.0.0-beta.18'), 'beta');
  });

  it('honors explicit tag override', () => {
    assert.equal(resolveNpmTag('4.0.0-beta.18', 'latest'), 'latest');
    assert.equal(resolveNpmTag('4.0.0', 'beta'), 'beta');
  });
});

describe('5.0.0-beta.0 release consistency', () => {
  const EXPECTED = '5.0.0-beta.0';

  it('keeps core package versions aligned at 5.0.0-beta.0', () => {
    const versions = new Map();
    for (const pkg of CORE_PUBLISH_PACKAGES) {
      const pkgJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, pkg.path, 'package.json'), 'utf8'));
      versions.set(pkg.name, pkgJson.version);
      assert.equal(pkgJson.version, EXPECTED, `${pkg.name} must be ${EXPECTED}`);
    }

    const rootVersion = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')).version;
    const desktopVersion = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'desktop/package.json'), 'utf8')).version;

    assert.equal(rootVersion, EXPECTED);
    assert.equal(desktopVersion, EXPECTED);
    assert.equal(versions.get('@reactpressjs/reactpress'), EXPECTED);
    assert.equal(versions.get('reactpressjs'), EXPECTED);
  });

  it('publishes reactpressjs after the scoped CLI package', () => {
    const names = CORE_PUBLISH_PACKAGES.map((pkg) => pkg.name);
    assert.ok(names.includes('reactpressjs'));
    assert.ok(names.indexOf('reactpressjs') > names.indexOf('@reactpressjs/reactpress'));

    const aliasPkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packages/reactpressjs/package.json'), 'utf8'));
    assert.equal(aliasPkg.name, 'reactpressjs');
    assert.equal(aliasPkg.bin.reactpress, './bin/reactpress.js');
    assert.equal(aliasPkg.dependencies['@reactpressjs/reactpress'], 'workspace:*');
    assert.match(aliasPkg.repository.url, /reactpressjs\/reactpressjs\.git/);
  });

  it('defaults docs install helpers to reactpressjs / 5.0.0 fallback', () => {
    const packageVersions = fs.readFileSync(path.join(REPO_ROOT, 'docs/src/npm/packageVersions.ts'), 'utf8');
    assert.match(packageVersions, /FALLBACK_REACTPRESS_LATEST\s*=\s*'5\.0\.0'/);
    assert.match(packageVersions, /REACTPRESS_NPM_PACKAGE\s*=\s*'reactpressjs'/);
    assert.match(packageVersions, /REACTPRESS_CORE_NPM_PACKAGE\s*=\s*'@reactpressjs\/reactpress'/);
    assert.match(packageVersions, /github\.com\/reactpressjs\/reactpressjs/);
    assert.match(packageVersions, /export function buildInstallCommand\(\):\s*string/);

    const quickStart = fs.readFileSync(path.join(REPO_ROOT, 'docs/src/constants/quickStartCommands.ts'), 'utf8');
    assert.match(quickStart, /buildInstallCommand\(\)/);
  });
});
