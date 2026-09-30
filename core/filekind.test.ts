import { describe, expect, it } from 'vitest'
import { effectiveType, languageOf, TEXT_LIMIT, viewKind } from './filekind.ts'

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
  it('offers to save ZIP, office documents, audio, video and unknown types, and a PDF too large to read into the interface', () => {
    expect(viewKind('application/pdf', 'big.pdf', 64 * 2 ** 20 + 1)).toBe('other')
    for (const [type, name] of [['application/zip', 'a.zip'], ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a.docx'], ['audio/mpeg', 'a.mp3'], ['video/mp4', 'a.mp4'], ['application/x-unknown', 'a.bin']] as const) {
      expect(viewKind(type, name, 100), name).toBe('other')
    }
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
})
