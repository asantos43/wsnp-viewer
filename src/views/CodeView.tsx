import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useEffect, useRef } from 'react'
import type { Language } from '@core/filekind.ts'
import { readOnlyExtensions } from './codeTheme.ts'

/** A file of the snapshot as read-only source, with line numbers and the colours of the theme (CodeMirror 6). */
export function CodeView({ text, language }: { text: string; language: Language }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!host.current) return
    const view = new EditorView({ parent: host.current, state: EditorState.create({ doc: text, extensions: readOnlyExtensions(language) }) })
    return () => view.destroy()
  }, [text, language])
  return <div ref={host} className="h-full min-h-0 flex-1 overflow-hidden" />
}
