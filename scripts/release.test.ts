import { describe, expect, it } from 'vitest'
// @ts-expect-error a plain .mjs script with no types
import { notesFor, prepareChangelog, setVersion } from './release.mjs'

const CHANGELOG = `# Changelog

Intro.

## [Unreleased]

### Added

- A new thing.

### Changed

- An old thing.

## [0.1.0] - 2026-01-01

### Added

- The first thing.
`

describe('notesFor', () => {
  it('gives the section of a version, without its heading and without the next one', () => {
    expect(notesFor(CHANGELOG, '0.1.0')).toBe('### Added\n\n- The first thing.')
    expect(notesFor(CHANGELOG, 'Unreleased')).toContain('A new thing.')
    expect(notesFor(CHANGELOG, 'Unreleased')).not.toContain('The first thing.')
  })
  it('is undefined for a version that has no section', () => {
    expect(notesFor(CHANGELOG, '9.9.9')).toBeUndefined()
  })
  it('reads a file with Windows line ends', () => {
    expect(notesFor(CHANGELOG.replace(/\n/g, '\r\n'), '0.1.0')).toBe('### Added\n\n- The first thing.')
  })
})

describe('prepareChangelog', () => {
  it('moves what is under Unreleased into the version, dated, and leaves Unreleased empty above it', () => {
    const out = prepareChangelog(CHANGELOG, '0.2.0', '2026-10-01')
    expect(out).toContain('## [Unreleased]\n\n## [0.2.0] - 2026-10-01\n\n### Added\n\n- A new thing.')
    expect(notesFor(out, 'Unreleased')).toBe('')
    expect(notesFor(out, '0.2.0')).toContain('An old thing.')
    expect(notesFor(out, '0.1.0')).toBe('### Added\n\n- The first thing.')
    expect(out.startsWith('# Changelog\n\nIntro.\n\n## [Unreleased]')).toBe(true)
    expect(out.endsWith('\n')).toBe(true)
  })
  it('refuses a version that is not one, one that exists, and nothing to release', () => {
    expect(() => prepareChangelog(CHANGELOG, 'v1', '2026-10-01')).toThrow(/not a version/)
    expect(() => prepareChangelog(CHANGELOG, '0.1.0', '2026-10-01')).toThrow(/already has a section/)
    expect(() => prepareChangelog('# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-01-01\n\n- x\n', '0.2.0', '2026-10-01')).toThrow(/nothing to release/)
    expect(() => prepareChangelog('# Changelog\n', '0.2.0', '2026-10-01')).toThrow(/no "## \[Unreleased\]"/)
  })
  it('accepts a pre-release version', () => {
    expect(prepareChangelog(CHANGELOG, '0.2.0-beta.1', '2026-10-01')).toContain('## [0.2.0-beta.1] - 2026-10-01')
  })
})

describe('setVersion', () => {
  it('changes the version and nothing else', () => {
    expect(setVersion('{\n  "name": "x",\n  "version": "0.0.0",\n  "a": "1.2.3"\n}', '1.0.0')).toBe('{\n  "name": "x",\n  "version": "1.0.0",\n  "a": "1.2.3"\n}')
  })
})
