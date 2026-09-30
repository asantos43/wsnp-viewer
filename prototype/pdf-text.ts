// Reads a PDF back (pages and text) to check what was printed. pdfjs is a development dependency,
// loaded by name at run time so it is not bundled into the app.
export async function pdfInfo(bytes: Buffer): Promise<{ pages: number; text: string; pageTexts: string[] }> {
  const specifier = 'pdfjs-dist/legacy/build/pdf.mjs'
  const pdfjs = (await import(/* @vite-ignore */ specifier)) as typeof import('pdfjs-dist')
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
  const doc = await task.promise
  const pageTexts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent()
    pageTexts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
  }
  const pages = doc.numPages
  await task.destroy()
  return { pages, text: pageTexts.join('\n'), pageTexts }
}
