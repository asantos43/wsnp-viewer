// happy-dom prints a frame it was told not to load as an error straight to stderr. The workbench tests open many snapshots
// (each an iframe whose page is the main process's business, not the test's), so that one message is dropped.
const write = process.stderr.write.bind(process.stderr)
process.stderr.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => (String(chunk).includes('Iframe page loading is disabled') ? true : (write as (...a: unknown[]) => boolean)(chunk, ...rest))) as typeof process.stderr.write
