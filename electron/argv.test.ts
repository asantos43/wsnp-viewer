import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { snapshotPaths } from './argv.ts'

describe('snapshotPaths', () => {
  it('takes the .wsnp files of a command line, in any case, and makes them absolute', () => {
    const cwd = path.resolve('/work')
    expect(snapshotPaths(['electron', '.', 'a.wsnp', path.resolve('/x/B.WSNP'), '--no-sandbox', '--user-data-dir=/tmp/p.wsnp', 'notes.txt', 'c.wsnpx'], cwd)).toEqual([path.resolve('/work/a.wsnp'), path.resolve('/x/B.WSNP')])
  })
  it('is empty when nothing is named', () => expect(snapshotPaths(['electron', '.'], '/work')).toEqual([]))
})
