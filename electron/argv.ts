import path from 'node:path'

/** The `.wsnp` files a command line names (a double-click passes the path as an argument), made absolute. Flags are skipped. */
export function snapshotPaths(argv: readonly string[], cwd: string): string[] {
  return argv.filter((arg) => !arg.startsWith('-') && /\.wsnp$/i.test(arg)).map((arg) => path.resolve(cwd, arg))
}
