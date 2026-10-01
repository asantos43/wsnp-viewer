import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { yaml } from '@codemirror/lang-yaml'
import { xml } from '@codemirror/lang-xml'
import { bracketMatching, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import type { Language } from '@core/filekind.ts'
import { findExtension } from '@/find/code.ts'

const v = (name: string) => `var(--wsnp-${name})`

/** The read-only editor in the colours of the theme in use: everything is a CSS variable, so switching theme needs no rebuild. */
const theme = EditorView.theme({
  '&': { height: '100%', color: 'var(--vscode-editor-foreground)', backgroundColor: 'var(--vscode-editor-background)', fontSize: 'var(--vscode-editor-font-size)' },
  '.cm-scroller': { fontFamily: 'var(--vscode-editor-font-family)', lineHeight: '19px', overflow: 'auto' },
  '.cm-content': { caretColor: 'transparent' },
  '.cm-gutters': { backgroundColor: 'var(--vscode-editor-background)', color: v('line-number'), border: 'none' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 12px 0 20px', minWidth: '48px' },
  '.cm-activeLine': { backgroundColor: v('line-highlight') },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: v('line-number-active') },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection': { backgroundColor: v('selection') },
  '.cm-wsnpMatch': { backgroundColor: v('find-match') },
  '.cm-wsnpMatch-current': { backgroundColor: v('find-current'), outline: '1px solid var(--vscode-focusBorder)' },
  '&.cm-focused .cm-matchingBracket': { backgroundColor: v('match-bracket'), outline: '1px solid var(--vscode-editorGroup-border)' },
})

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.definitionKeyword], color: v('syntax-keyword') },
  { tag: [t.controlKeyword, t.moduleKeyword], color: v('syntax-control') },
  { tag: [t.string, t.special(t.string), t.attributeValue], color: v('syntax-string') },
  { tag: [t.number, t.integer, t.float], color: v('syntax-number') },
  { tag: [t.bool, t.null, t.atom, t.constant(t.name)], color: v('syntax-keyword') },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: v('syntax-comment'), fontStyle: 'italic' },
  { tag: [t.propertyName, t.definition(t.propertyName)], color: v('syntax-property') },
  { tag: [t.variableName, t.name], color: v('syntax-property') },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: v('syntax-function') },
  { tag: [t.typeName, t.className, t.namespace], color: v('syntax-type') },
  { tag: [t.tagName, t.angleBracket], color: v('syntax-tag') },
  { tag: [t.attributeName], color: v('syntax-attribute') },
  { tag: [t.operator, t.compareOperator, t.logicOperator, t.arithmeticOperator], color: v('syntax-operator') },
  { tag: [t.regexp, t.escape], color: v('syntax-regexp') },
  { tag: [t.punctuation, t.separator, t.bracket, t.brace, t.paren, t.squareBracket], color: v('syntax-punctuation') },
  { tag: [t.processingInstruction, t.meta, t.documentMeta], color: v('syntax-keyword') },
  { tag: t.link, color: 'var(--vscode-textLinkForeground)', textDecoration: 'underline' },
  { tag: t.invalid, color: 'var(--vscode-errorForeground)' },
])

const languages: Record<Language, () => Extension> = {
  json,
  html,
  css,
  javascript,
  typescript: () => javascript({ typescript: true }),
  jsx: () => javascript({ jsx: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  xml,
  markdown,
  yaml,
  plain: () => [],
}

/** Word wrap can be switched on and off without making the editor again (the scroll stays where it is). */
export const wrapping = new Compartment()

/** The extensions of a read-only view of a file in `language`. */
export const readOnlyExtensions = (language: Language, wrap: boolean): Extension[] => [
  wrapping.of(wrap ? EditorView.lineWrapping : []),
  EditorState.readOnly.of(true),
  EditorView.editable.of(false),
  EditorView.contentAttributes.of({ tabindex: '0' }),
  lineNumbers(),
  highlightActiveLine(),
  highlightActiveLineGutter(),
  bracketMatching(),
  syntaxHighlighting(highlight),
  theme,
  findExtension,
  languages[language](),
]
