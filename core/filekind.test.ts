import { describe, expect, it } from 'vitest'
import { effectiveType, FORMATTABLE, languageOf, TEXT_LIMIT, viewKind, ZIP_LIMIT } from './filekind.ts'

describe('viewKind: which files a tab can show', () => {
  it('shows source, pictures, PDFs and fonts', () => {
    expect(viewKind('application/pdf', 'a.pdf', 100)).toBe('pdf')
    expect(viewKind('application/octet-stream', 'A.PDF', 100)).toBe('pdf')
    expect(viewKind('text/html', 'index.html', 100)).toBe('text')
    expect(viewKind('text/css', 'a.css', 100)).toBe('text')
    expect(viewKind('text/javascript', 'a.js', 100)).toBe('text')
    expect(viewKind('application/json', 'manifest.json', 100)).toBe('text')
    expect(viewKind('application/ld+json', 'a', 100)).toBe('text')
    expect(viewKind('image/svg+xml', 'a.svg', 100)).toBe('text')
    expect(viewKind('image/png', 'a.png', 100)).toBe('image')
    expect(viewKind('image/webp', 'a.webp', 100)).toBe('image')
    expect(viewKind('font/woff2', 'a.woff2', 100)).toBe('font')
  })
  it('offers to save office documents, audio, video and unknown types, and a PDF too large to read into the interface', () => {
    expect(viewKind('application/pdf', 'big.pdf', 64 * 2 ** 20 + 1)).toBe('other')
    for (const [type, name] of [['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a.docx'], ['audio/mpeg', 'a.mp3'], ['video/mp4', 'a.mp4'], ['application/x-unknown', 'a.bin']] as const) {
      expect(viewKind(type, name, 100), name).toBe('other')
    }
  })
  it('lists a ZIP in a tab, by its type or its extension, unless it is too big to hold in memory', () => {
    expect(viewKind('application/zip', 'a.zip', 100)).toBe('zip')
    expect(viewKind('application/x-zip-compressed', 'a.zip', 100)).toBe('zip')
    expect(viewKind('application/octet-stream', 'bundle.ZIP', 100)).toBe('zip')
    expect(viewKind('application/zip', 'a.zip', ZIP_LIMIT + 1)).toBe('other')
    expect(viewKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a.docx', 100)).toBe('other')
  })
  it('uses the extension when the type says nothing', () => {
    expect(viewKind('application/octet-stream', 'photo.JPG', 100)).toBe('image')
    expect(viewKind(undefined, 'style.css', 100)).toBe('text')
    expect(viewKind('', 'file.pdf', 100)).toBe('pdf')
    expect(effectiveType('text/html; charset=utf-8', 'x')).toBe('text/html')
  })
  it('does not open a text file over the limit: it is saved instead', () => {
    expect(viewKind('text/plain', 'big.txt', TEXT_LIMIT)).toBe('text')
    expect(viewKind('text/plain', 'big.txt', TEXT_LIMIT + 1)).toBe('other')
  })
  it('picks the language for the colours', () => {
    expect(languageOf('text/html', 'a')).toBe('html')
    expect(languageOf('text/css', 'a')).toBe('css')
    expect(languageOf('text/javascript', 'a')).toBe('javascript')
    expect(languageOf('application/json', 'a')).toBe('json')
    expect(languageOf('image/svg+xml', 'a')).toBe('xml')
    expect(languageOf('text/plain', 'a')).toBe('plain')
  })
  it('knows more languages by the name when the type says nothing: Markdown, YAML, TypeScript, JSX, source maps, manifests', () => {
    expect(languageOf('text/plain', 'README.md')).toBe('markdown')
    expect(languageOf('application/octet-stream', 'config.yml')).toBe('yaml')
    expect(languageOf(undefined, 'app.yaml')).toBe('yaml')
    expect(languageOf('text/plain', 'app.ts')).toBe('typescript')
    expect(languageOf('text/plain', 'App.tsx')).toBe('tsx')
    expect(languageOf('text/plain', 'App.jsx')).toBe('jsx')
    expect(languageOf('application/octet-stream', 'app.js.map')).toBe('json')
    expect(languageOf('text/plain', 'site.webmanifest')).toBe('json')
    expect(languageOf('text/plain', 'notes.txt')).toBe('plain')
    expect(languageOf('text/plain', 'feed.rss')).toBe('xml')
  })
  it('trusts a declared type that says something over the name', () => {
    expect(languageOf('text/css', 'style.txt')).toBe('css')
    expect(languageOf('application/json', 'data.md')).toBe('json')
    expect(effectiveType('text/plain', 'a.unknownext')).toBe('text/plain')
  })
  it('says which languages a formatter can lay out again', () => {
    expect([...FORMATTABLE].sort()).toEqual(['css', 'html', 'javascript', 'json', 'xml'])
  })
})
