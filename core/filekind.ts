/** How a file of a snapshot is shown in a tab (docs/VIEWER-GUIDELINES.md, "Files inside a snapshot"). */
export type ViewKind = 'text' | 'image' | 'pdf' | 'font' | 'other'

/** Source in the viewer's colours, for these languages; anything else is plain text. */
export type Language = 'json' | 'html' | 'css' | 'javascript' | 'typescript' | 'jsx' | 'tsx' | 'xml' | 'markdown' | 'yaml' | 'plain'

/** A text file bigger than this is not opened in a tab: it is offered with Save As, like a PDF. */
export const TEXT_LIMIT = 5 * 2 ** 20
/** A picture or a font bigger than this is not read into the interface either. */
export const BINARY_LIMIT = 64 * 2 ** 20

const BY_EXTENSION: Record<string, string> = {
  html: 'text/html', htm: 'text/html', xhtml: 'application/xhtml+xml', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', cjs: 'text/javascript', jsx: 'text/jsx', ts: 'text/typescript', tsx: 'text/tsx',
  json: 'application/json', map: 'application/json', webmanifest: 'application/manifest+json', txt: 'text/plain', log: 'text/plain', md: 'text/markdown', markdown: 'text/markdown', yml: 'text/yaml', yaml: 'text/yaml',
  csv: 'text/csv', xml: 'application/xml', rss: 'application/xml', atom: 'application/xml', svg: 'image/svg+xml', vtt: 'text/vtt', srt: 'text/plain',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon',
  pdf: 'application/pdf', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
}

/**
 * The declared media type when it says something, else the one the extension suggests. A server that calls everything `text/plain` or
 * `application/octet-stream` says nothing: the extension then decides (a `.md` served as plain text is still Markdown).
 */
export function effectiveType(mediaType: string | undefined, name: string): string {
  const declared = (mediaType ?? '').split(';')[0].trim().toLowerCase()
  const byName = BY_EXTENSION[/\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '']
  const weak = declared === '' || declared === 'application/octet-stream' || declared === 'text/plain'
  if (weak && byName) return byName
  return declared || 'application/octet-stream'
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

/** Languages whose text a formatter can lay out again (the others are shown as they are). */
export const FORMATTABLE: readonly Language[] = ['json', 'html', 'css', 'javascript', 'xml']

export function languageOf(mediaType: string | undefined, name: string): Language {
  const type = effectiveType(mediaType, name)
  if (type === 'text/html' || type === 'application/xhtml+xml') return 'html'
  if (type === 'text/css') return 'css'
  if (type === 'text/typescript' || type === 'application/typescript') return 'typescript'
  if (type === 'text/jsx') return 'jsx'
  if (type === 'text/tsx') return 'tsx'
  if (/javascript|ecmascript/.test(type)) return 'javascript'
  if (type === 'text/markdown' || type === 'text/x-markdown') return 'markdown'
  if (/yaml/.test(type)) return 'yaml'
  if (/json/.test(type)) return 'json'
  if (/xml/.test(type)) return 'xml'
  return 'plain'
}
