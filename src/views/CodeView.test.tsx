// @vitest-environment happy-dom
import type { Language } from '@core/filekind.ts'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CodeView } from './CodeView.tsx'

afterEach(cleanup)

// A line of each language that has more than one kind of token, so a language that is wired gives coloured spans and one that is not gives none.
const SAMPLES: Record<Exclude<Language, 'plain'>, string> = {
  json: '{"name": "harbor", "items": [1, 2, true, null]}',
  html: '<!doctype html><div class="a" id="b">text <b>bold</b></div>',
  css: '.card > h2 { color: #0a7; margin: 0 }',
  javascript: 'const add = (a, b) => { return a + b } // add',
  typescript: 'interface Item { id: number } const x: Item = { id: 1 }',
  jsx: 'const el = <div className="a">hello</div>',
  tsx: 'const el: JSX.Element = <div className="a">{1}</div>',
  xml: '<svg width="40"><circle cx="20" r="18"/></svg>',
  markdown: '# Title\n\n* one\n* `code`\n',
  yaml: 'name: harbor\nitems:\n  - id: 1\n',
}

describe('CodeView: the languages it knows are coloured', () => {
  for (const [language, sample] of Object.entries(SAMPLES) as [Exclude<Language, 'plain'>, string][]) {
    it(`${language}`, () => {
      render(<CodeView text={sample} language={language} wrap={false} />)
      const spans = document.querySelectorAll('.cm-line span')
      expect(spans.length, `${language} has coloured tokens`).toBeGreaterThan(1)
      expect(document.querySelector('.cm-content')?.textContent).toBe(sample.replace(/\n$/, '').replace(/\n/g, ''))
    })
  }

  it('does not colour plain text', () => {
    render(<CodeView text={'const a = 1 // not code'} language="plain" wrap={false} />)
    expect(document.querySelectorAll('.cm-line span').length).toBe(0)
  })
  it('is read-only, and selectable', () => {
    render(<CodeView text="x" language="plain" wrap={false} />)
    expect(document.querySelector('.cm-content')?.getAttribute('contenteditable')).toBe('false')
  })
  it('changes its text and its wrapping without being made again', () => {
    const { rerender } = render(<CodeView text="one" language="plain" wrap={false} />)
    const editor = document.querySelector('.cm-editor')
    rerender(<CodeView text="two" language="plain" wrap />)
    expect(document.querySelector('.cm-editor')).toBe(editor)
    expect(document.querySelector('.cm-content')?.textContent).toBe('two')
    expect(document.querySelector('.cm-lineWrapping')).not.toBeNull()
  })
})
