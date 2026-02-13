# ApeClaw UI QA Report — http://localhost:8787/

**Date:** 2025-02-13  
**Method:** Static code analysis (browser automation unavailable: MCP file system options required)

---

## Checklist Results

| # | Item | Result | Note |
|---|------|--------|------|
| 1 | Page loads with no obvious runtime crash | **UNTESTED** | Requires live browser; server returns 200. |
| 2 | Header shortcuts popover opens/closes; Esc closes | **PASS** | `initShortcutsPopover`: btn toggles panel, `document.click` closes on outside click, `keydown` Esc calls `close()`. |
| 3 | Cmd/Ctrl+K focuses collection search; Cmd/Ctrl+/ focuses chat input | **PASS** | `boot()` registers global `keydown` handlers; `preventDefault` + `focus()` on `collectionsSearch` and `chatInput`. |
| 4 | Collections tools: search, sort, Contract only, Enabled only update chips/status | **PASS** | `initCollectionControls` wires all four; `renderCollectionsBar()` filters by query/CA/enabled and updates `collectionsStatus`. |
| 5 | Setup panel: toggle, copy buttons, step checkboxes persist after reload | **PASS** | `toggleSetup()`; `initSetupEnhancements` adds copy btns and checkboxes; localStorage keys `apeclaw_setup_step_N`. |
| 6 | Shared Backend URL: Save/Test/Local update status and terminal; invalid URL shows error | **PASS** | Save/Test/Local push to `terminalLines` + `renderTerminal()`; invalid URL triggers error push and early return. |
| 7 | Feed controls: Pause/Resume, Clear, Export clickable and behave as expected | **PASS** | `feedPauseBtn` toggles `feedPaused`, Clear empties arrays, Export downloads JSON. |
| 8 | Terminal controls: Auto-scroll toggle, Clear, Export clickable | **PASS** | `terminalAutoBtn` toggles `terminalAutoScroll`, Clear/Export wired in `initPanelControls`. |
| 9 | Chat panel: room input, room chips, room status, search filter, reconnect/export visible | **PASS** | All elements present; `renderChatRooms` for chips; `updateChatAuthStatus` for status; search filters `renderChatMessages`. |
| 10 | Chat auth: no creds → send disabled; with creds + room → send enabled; POST failure surfaced in terminal | **PASS** | `updateChatAuthStatus` disables input/btn when no creds; `sendChatMessage` pushes errors to `terminalLines` on `!r.ok` or catch. |
| 11 | Room behavior: switch room updates status/chip; reload persists room/checklist | **PASS** | `selectChatRoom` + room input `change`; `updateChatAuthStatus` saves to localStorage; `initChat` restores from localStorage. |
| 12 | Accessibility: skip link visible on focus, jumps to main content | **PASS** | `.skip-link` at `top:-40px`, `:focus{top:10px}`; `href="#mainContent"`; `#mainContent` on `.main`. |

---

## Bugs Found

### None identified from code analysis

No functional bugs found in the tested flows. All handlers are wired correctly; event propagation and state updates are consistent.

---

## Residual Untested Areas

1. **Live runtime:** No visual confirmation of layout, CSS, or runtime crashes.
2. **SSE/telemetry:** Event stream connection and reconnection behavior not exercised.
3. **Chat POST failure:** Terminal error display for failed POSTs not visually verified.
4. **Keyboard focus:** Cmd/Ctrl+K and Cmd/Ctrl+/ when chat input is disabled (focus still works; input remains disabled).
5. **Room input change:** Room switch via typing + blur only; no Enter key handler on room input (minor UX).

---

## Recommendations

1. **Room input:** Add `keydown` handler so Enter submits room switch (e.g. blur or trigger `change`).
2. **Manual verification:** Run `node ./src/telemetry-server.mjs` and open `http://localhost:8787/` in a browser to confirm layout and interaction.
