/** How a file of a snapshot is shown in a tab (docs/VIEWER-GUIDELINES.md, "Files inside a snapshot"). */
export type ViewKind = 'text' | 'image' | 'pdf' | 'font' | 'other'

/** Source in the viewer's colours, for these languages; anything else is plain text. */
export type Language = 'json' | 'html' | 'css' | 'javascript' | 'xml' | 'plain'

/** A text file bigger than this is not opened in a tab: it is offered with Save As, like a PDF. */
export const TEXT_LIMIT = 5 * 2 ** 20
/** A picture or a font bigger than this is not read into the interface either. */
export const BINARY_LIMIT = 64 * 2 ** 20

const BY_EXTENSION: Record<string, string> = {
  html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', xml: 'application/xml', svg: 'image/svg+xml', vtt: 'text/vtt', srt: 'text/plain',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon',
  pdf: 'application/pdf', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
}

/** The declared media type when it says something, else the one the extension suggests. */
export function effectiveType(mediaType: string | undefined, name: string): string {
  const declared = (mediaType ?? '').split(';')[0].trim().toLowerCase()
  if (declared && declared !== 'application/octet-stream') return declared
  return BY_EXTENSION[/\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? ''] ?? 'application/octet-stream'
}

const IMAGE = /^image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)$/
const TEXT = /^(text\/.+|application\/(json|javascript|ecmascript|xml|xhtml\+xml|x-javascript|ld\+json|manifest\+json)|.+\+(json|xml)|image\/svg\+xml)$/
const FONT = /^(font\/.+|application\/(font-woff2?|x-font-.+|vnd\.ms-fontobject))$/

/** What tab a file gets. ZIP, office documents, audio, video and unknown types are `other`: they are saved, not shown. */
export function viewKind(mediaType: string | undefined, name: string, size: number): ViewKind {
  const type = effectiveType(mediaType, name)
  if (TEXT.test(type)) return size <= TEXT_LIMIT ? 'text' : 'other'
  if (IMAGE.test(type)) return size <= BINARY_LIMIT ? 'image' : 'other'
  if (type === 'application/pdf') return size <= BINARY_LIMIT ? 'pdf' : 'other'
  if (FONT.test(type)) return size <= BINARY_LIMIT ? 'font' : 'other'
  return 'other'
}

export function languageOf(mediaType: string | undefined, name: string): Language {
  const type = effectiveType(mediaType, name)
  if (type === 'text/html' || type === 'application/xhtml+xml') return 'html'
  if (type === 'text/css') return 'css'
  if (/javascript|ecmascript/.test(type)) return 'javascript'
  if (/json/.test(type)) return 'json'
  if (/xml/.test(type)) return 'xml'
  return 'plain'
}
