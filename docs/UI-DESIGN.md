# Interface design: as close to VS Code as possible

The viewer's interface must look and behave as much like Visual Studio Code as possible (the requirement is in
[`VIEWER-GUIDELINES.md`](VIEWER-GUIDELINES.md), "Look and feel"). This document records the research on how to get there,
the decisions taken, and where phase 1 starts. Sources are at the end.

## The reference

The reference is a screenshot of VS Code with the **Dark+** theme (the classic default dark theme, not "Dark Modern"),
showing a JSON file. It is not committed (it shows a private project), so it is described here:

- **Title bar**, 30 px, colour `#3C3C3C`: the app icon, the menu (File, Edit, Selection, View, Go, Run, Terminal, Help),
  back and forward arrows, a centred "command center" box with the project name, layout buttons at the right, window controls.
- **Activity bar**, a 48 px column of icons at the far left, `#333333`; the active icon has a light bar on its left edge; settings and
  account at the bottom.
- **Side bar**, `#252526`: a title ("Explorer") with action icons, a file tree (chevrons, coloured file-type icons, the
  selected row highlighted in blue), and collapsed sections at the bottom ("Outline", "Timeline").
- **Editor group**: tabs (icon, name, a close button on the active one, a highlighted active tab), **breadcrumbs**
  (`folder › folder › file › …`), the editor itself with line numbers, indent guides, coloured brackets and a **minimap**, and a
  **find widget** at its top-right corner ("No results", case / word / regex toggles, previous, next, close).
- **Status bar**, 22 px, blue `#007ACC`: a remote indicator at the left, problem counts, and at the right the cursor position,
  indentation, encoding, line ending, language, notifications.

## What each part becomes in the WSNP Viewer

| VS Code part | In the viewer |
| --- | --- |
| Title bar menu | File (Open…, Open Recent, Convert PageKeep ZIP…, Save as…, Export ▸ PNG / JPG / PDF, Close), Edit (Copy, Find), View (Zoom, Toggle Side Bar, Command Palette), Go (next / previous snapshot), Help |
| Command center, `Ctrl+P`, `Ctrl+Shift+P` | Quick open of an open snapshot by title or address; command palette for every command |
| Activity bar | Snapshots, Search across snapshots, Convert / Export queue, Settings (language, theme) |
| Side bar: Explorer | **Open snapshots** (title, address, capture date, preview) and the **files of the selected snapshot** as a tree (`manifest.json`, `index.html`, `assets/…`, `_wsnp/`) |
| Side bar: Outline, Timeline | **Information** (source address, capture date, generator, viewport, what could not be saved) and **Integrity** (SHA-256 result, per file) |
| Editor tabs | One tab per open snapshot (the rendered page); a click on a file of the tree opens it in a preview tab (JSON, HTML, CSS, JS as read-only source, pictures, fonts) |
| Breadcrumbs | `title › index.html`, or the path of the file being read |
| Editor area | The page in its isolated view, or a read-only source viewer with the theme's syntax colours |
| Find widget | The same widget, driving in-page search; it cannot cover the page if the page is a native view (see "The hard part") |
| Status bar | Source address (opens in the browser), capture date, viewport, integrity, generator, converted-from note, language |
| Notifications | Refusals in plain words ("made by a newer version", "password-protected…"), conversion and export progress |

## How to get the VS Code look

**Recreate it, don't embed it.** VS Code's own workbench (Code - OSS) or Eclipse Theia would give the look for free, but
they add hundreds of megabytes and an extension host this viewer does not need. The look is mostly colours, sizes,
icons and a few behaviours, all reproducible with a light stack.

1. **Design tokens as CSS variables named like VS Code's** (`--vscode-editor-background`,
   `--vscode-sideBar-background`, `--vscode-focusBorder`, …). Values come from the theme files
   (`extensions/theme-defaults/themes/dark_vs.json`, `dark_plus.json` in `microsoft/vscode`, MIT), plus the defaults of VS Code's colour
   registry that the theme files do not repeat. Using VS Code's names lets `@vscode-elements/elements` work unchanged and
   makes a Light+ theme a second set of values.
   **Light+** uses the same names with the values of `light_vs.json` and `light_plus.json`: editor `#FFFFFF` with text `#000000`, side bar `#F3F3F3`, activity bar `#2C2C2C`,
   status bar `#007ACC`, comments `#008000`, keywords `#0000FF`, numbers `#098658` (the rest is read from the theme files while building).
2. **Typography.** UI: `-apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", system-ui, "Ubuntu", "Droid Sans", sans-serif`
   at 13 px (VS Code's own stack; Segoe UI is not bundled). Editor: `Menlo, Monaco, Consolas, "Droid Sans Mono", monospace`
   at 14 px, line height about 19 px.
3. **Metrics (approximate, to be measured on the screenshot while building):** title bar 30 px, activity bar 48 px wide with 24 px icons,
   tab strip 35 px, tree rows 22 px, status bar 22 px, side bar 300 px by default, sashes 4 px.
4. **Icons.** UI icons: **Codicons** (`@vscode/codicons`; icons CC BY 4.0, code MIT; attribution required). File icons: the **Seti** set that VS Code
   uses by default (MIT, from `jesseweed/seti-ui`, packaged in `extensions/theme-seti`), or Material Icon Theme (MIT) as an alternative.
5. **Components.**
   - Split layout: **Allotment** (React, MIT; derived from VS Code's own split view code).
   - Tree: **react-arborist** (virtualised, keyboard navigation) or the `vscode-tree` of `@vscode-elements/elements`; decide in the spike.
   - Form controls, tabs, icons, context menu: **`@vscode-elements/elements`** (Lit web components, MIT, "reverse-engineered" to match
     VS Code's controls pixel for pixel; the successor of the archived `@vscode/webview-ui-toolkit`). Check React 19 interoperability in the spike.
   - Command palette: **cmdk** (unstyled, so it takes the tokens).
   - Source viewer: **CodeMirror 6** with a theme built from the Dark+ token colours (property names `#9CDCFE`, strings `#CE9178`,
     numbers `#B5CEA8`, keywords and `true`/`false`/`null` `#569CD6`, comments `#6A9955`, bracket pairs `#FFD700` / `#DA70D6` / `#179FFF`,
     indent guides `#404040`, line numbers `#858585`). Monaco (VS Code's editor) is over 2 MB gzipped against about 124 KB for CodeMirror,
     and a read-only viewer needs none of Monaco's extras.
6. **Window chrome.** `titleBarStyle: 'hidden'`; on Windows and Linux `titleBarOverlay` (`color`, `symbolColor`, `height`) keeps the native
   minimise / maximise / close buttons while the rest of the bar is drawn in HTML (`app-region: drag`; `env(titlebar-area-*)` keeps content
   clear of the buttons); on macOS the traffic lights stay (`trafficLightPosition`) and the **native application menu** is used, as VS Code does. On
   Windows and Linux the menu bar is drawn in the title bar, like VS Code's "custom" title bar style.
7. **Keyboard.** The same shortcuts as VS Code where the action exists (`Ctrl+P`, `Ctrl+Shift+P`, `Ctrl+F`, `Ctrl+W`, `Ctrl+Tab`, `Ctrl+B` for the side bar, `Ctrl+,`).
8. **Stack of the interface.** React 19, Vite, TypeScript and Tailwind 4 (as in `mdiff-electron`), with the tokens above as the only colours. No colour is written directly in a component.

## The hard part: HTML cannot draw over a native view

If each snapshot is shown in its own `WebContentsView` (as in the phase 0 prototype), it is a separate native surface **above** the
interface's HTML. Electron has no z-order API for views (only the order of `addChildView`), so a drop-down menu, the find widget,
the command palette or a tooltip that should sit over the page is hidden behind it. Known workarounds are a transparent overlay
view stacked on top, or hiding the page view and showing a `capturePage()` picture in its place while the overlay is open.

The alternative is to show the page in a **sandboxed `<iframe>`** inside the interface (this is also the shape `FORMAT.md` section 8.5 assumes
for `.wsnpx`). Overlays are then ordinary HTML. What has to be proven first, because phase 0 tested only top-level views:

| To prove | Why it matters |
| --- | --- |
| The snapshot origin (`wsnp://<id>/`) loads in an iframe of the interface, and the interface's session cancels every request that is not `wsnp://` | Isolation and "no network" must hold as they do today |
| `webContents.findInPage` finds text inside the iframe, with highlight and count | The find widget. (Electron's `<webview>` tag has a known find-in-page hang with iframes; a plain iframe is not a webview, but test it.) |
| The `sandbox` attribute (no `allow-same-origin`) plus the CSP and the CORS header still let scripts, fonts and pictures load | The rules of `FORMAT.md` section 10 |
| Links, printing and export | Links: `will-frame-navigate` on the iframe. Printing and export keep using a hidden view, which phase 0 proved. |

**Recommendation:** make the spike the first task of phase 1. If the iframe passes, use it for display (all VS Code overlays become plain
HTML, and `.wsnpx` gets the shape the spec expects) and keep a hidden `WebContentsView` for export and printing. If it fails, keep the
`WebContentsView` and put every overlay in a transparent view stacked above it. Either way the interface talks to a small "snapshot host"
interface, so the choice can be changed later.

## Other constraints and risks

- **Brand.** "Visual Studio Code", "VS Code" and the VS Code icon are Microsoft trademarks, and Microsoft's brand guidelines do not allow the
  icon, or a modified version of it, to identify another product. Codicons' licence does not grant any Microsoft name or logo either. The viewer
  therefore has **its own name and its own icon**, and says at most that its interface is inspired by VS Code, never that it is VS Code or
  endorsed by it. The Codicons and Seti notices go in `THIRD-PARTY-NOTICES.md` and the About window.
- **Find options.** `findInPage` only supports "match case" and "forward". Whole word and regular expression toggles need a helper script inside
  the page or are hidden; searching across all open snapshots is done by the viewer's own text index.
- **Density and scale.** VS Code sizes are in CSS pixels at 13 px text. Test at 100 %, 125 %, 150 % and 200 % scaling on the three systems (the developer's display is
  fractionally scaled).
- **Accessibility.** VS Code's look must not cost its accessibility: keyboard navigation, focus rings (`--vscode-focusBorder`), roles for tabs, tree and menus, a high-contrast theme.
- **Size.** React with these libraries adds about a megabyte; Codicons' font about 100 KB. Small next to Electron's own 280 MB.
- **Languages.** English and Brazilian Portuguese, as everywhere.

## Phase 1: where to start

Phase 1 is on its own branch and pull request (`phase-1-mvp`), with its tests, documentation and changelog lines.

1. **Spike** (throwaway, in `prototype/`): the iframe against the `WebContentsView` on the four points above, on the three systems through CI. Record the result in `ARCHITECTURE.md`.
2. **Tokens and shell**: the CSS variables for Dark+ and Light+ (with the system-following switch), the workbench layout (title bar, activity bar, side bar, editor group, status bar) with Allotment, the custom title bar per platform.
3. **Core of the MVP** (`docs/ARCHITECTURE.md`, Phases): `core/validate` (FORMAT.md section 10), opening several files (picker, drag, double-click, file association, single instance), the snapshot host, tabs, the tree of the archive, the information and integrity views, links, i18n.
4. **Packaging**: the four release files with file association; signing decisions.
5. **Tests**: unit tests for `validate` and the tree model, component tests for tabs, tree and the refusal messages, Playwright tests for opening files, and screenshot comparisons of the workbench at fixed sizes.

## Decisions

Taken by the developer after the research:

- **Name: "WSNP Viewer"**, final. It is already the `productName` of the build.
- **Two themes in phase 1: Dark+ and Light+.** The default follows the operating system (`prefers-color-scheme`), and the user can pick one in Settings,
  as VS Code's "Auto Detect Color Scheme" does. A high-contrast theme comes later.
- **VS Code is the base for the interface**: layout, tabs, the menu, the tree, keyboard shortcuts and the behaviours listed in the next section are taken
  from VS Code wherever the viewer has the same thing to do, and deviate only where it has not.
- **The icon** is candidate D1 (see "The icon").

## Behaviour taken from VS Code

| Area | Behaviour |
| --- | --- |
| Menu | VS Code's structure, trimmed to what the viewer can do: **File, Edit, View, Go, Help** (no Selection, Run or Terminal). The items keep VS Code's names, order and shortcuts where the action exists (Open File, Open Recent, Close Editor, Copy, Find, Toggle Side Bar, Zoom In / Out, Command Palette, Go to next / previous editor). |
| Tabs | A single click in the tree opens a **preview tab** (title in italics) that the next single click replaces; a double click, or editing, **keeps** it. Drag to reorder; middle click and the × close; `Ctrl+W` closes; `Ctrl+Tab` cycles in most-recently-used order; `Alt+1…9` (Windows, Linux) or `Ctrl+1…9` (macOS) go to a tab; pin a tab; the tab strip scrolls when it overflows. |
| Tab context menu | Close, Close Others, Close to the Right, Close All, Pin, Copy Source Address, Reveal in File Manager. |
| Editor groups | **Split Editor** (`Ctrl+\`) shows two snapshots side by side, so two captures of the same page can be compared. Groups are resizable with the same sashes as the side bar. |
| Explorer | An **Open Snapshots** section (like VS Code's "Open Editors") above the tree of the selected snapshot's files, with the same expand / collapse, keyboard navigation (arrows, `Home`, `End`, type to find) and selection colours. |
| Breadcrumbs | Clickable path with a drop-down of siblings, as in VS Code. |
| Quick open and palette | `Ctrl+P` (open snapshot or file), `Ctrl+Shift+P` (commands), `>` and `@` prefixes as far as they apply. |
| Find | `Ctrl+F` opens the find widget in the editor group; `Enter` and `Shift+Enter` go to the next and previous match; `Esc` closes it. |
| Status bar | Items are clickable and open the related view; a problem count stands for "could not be saved" and integrity failures. |
| Settings | A Settings view (language, theme, zoom) opened from the gear, with search. |
| Layout | Side bar and editor areas resize with sashes and remember their size; `Ctrl+B` toggles the side bar; `Ctrl+=` and `Ctrl+-` zoom the whole interface. |

## The icon

**Chosen: the developer picked candidate D1.** A browser window (the saved page) with a large `</>` (the HTML tag) across it and a camera lens (the
snapshot) on its corner, on an indigo-to-violet rounded square. It copies nothing from VS Code's icon.

- `build/icon.svg` is the master. `build/icon.png` is 1024 x 1024 with a 4 % transparent margin, made from it.
- electron-builder finds `build/icon.png` on its own and makes the `.ico` (Windows) and `.icns` (macOS) from it; the Linux packages use the PNG
  sizes. The window's own icon (Windows and Linux) is set from the same file in phase 1.
- To remake the PNG after changing the SVG, draw the SVG at 940 px in a 1024 px transparent canvas (any SVG renderer will do).
- Small sizes: the `</>` stays legible down to 32 px; at 16 px it is a mark, and the lens keeps the colour.

## Sources

- [VS Code brand and icon usage guidelines](https://code.visualstudio.com/brand)
- [Codicons (icon font, CC BY 4.0)](https://github.com/microsoft/vscode-codicons)
- [VS Code theme files: dark_vs.json, dark_plus.json, dark_modern.json](https://github.com/microsoft/vscode/tree/main/extensions/theme-defaults/themes)
- [VS Code theme colour reference](https://code.visualstudio.com/api/references/theme-color)
- [@vscode-elements/elements](https://github.com/vscode-elements/elements) (and the [archived Webview UI Toolkit](https://github.com/microsoft/vscode-webview-ui-toolkit))
- [Allotment](https://github.com/johnwalley/allotment), [react-arborist](https://www.npmjs.com/package/react-arborist), [cmdk](https://www.npmjs.com/package/cmdk)
- [Seti file icons in VS Code](https://github.com/microsoft/vscode/tree/main/extensions/theme-seti) and [Seti UI (MIT)](https://github.com/jesseweed/seti-ui)
- [Electron: custom title bar](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar)
- [Electron: WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view), [z-order for views (issue 15899)](https://github.com/electron/electron/issues/15899)
- [Electron: `<webview>` find-in-page hang with an iframe (issue 54199)](https://github.com/electron/electron/issues/54199)
- [Monaco against CodeMirror 6 (bundle size)](https://sourcegraph.com/blog/migrating-monaco-codemirror)
