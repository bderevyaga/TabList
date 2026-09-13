# AGENTS.md

## Scope

These instructions apply to the entire repository rooted at this directory.

## Project Overview

- This repo is a Manifest V3 Chrome extension named `TabList`.
- The extension UI lives in the popup and is loaded from `popup.html`.
- The codebase uses plain JavaScript ES modules. There is no build step, package manager, or framework in the repo.

## Structure

- `manifest.json`: extension manifest and permissions.
- `background.js`: toolbar badge updates and page context-menu actions.
- `popup/main.js`: popup entry point and dependency wiring.
- `popup/controllers/`: orchestration between UI, storage, parsing, and tab operations.
- `popup/services/`: browser-tab and URL-processing behavior.
- `popup/storage/`: persistence wrappers over `chrome.storage.local`.
- `popup/view/`: DOM access and rendering.
- `popup/parsers/`, `popup/formatters/`, `popup/utils/`: focused helpers.
- `popup.css`, `popup.html`: popup presentation.
- `.agents/skills/tablist-store-images/`: project-local screenshot skill and export helper.
- `promo/`: final store images; keep temporary previews and intermediate files elsewhere.

## Change Guidelines

- Keep changes small and consistent with the current module boundaries.
- Prefer fixing behavior in the relevant service, parser, store, or controller instead of adding cross-cutting workarounds.
- Preserve the existing ES module style and relative import layout.
- Avoid introducing new dependencies, build tooling, or frameworks unless explicitly requested.
- Keep browser-extension permissions minimal. Do not expand `manifest.json` permissions without a clear requirement.
- Prefer simple, deterministic logic. This extension primarily coordinates Chrome APIs and popup UI state.

## Code Style

- Match the existing formatting style in each file.
- Use descriptive names; avoid single-letter variables.
- Add comments only when a block is otherwise hard to understand.
- Keep DOM concerns in `popup/view/` and avoid scattering selectors across unrelated modules.
- Keep Chrome API access behind the existing service or utility abstractions when practical.
- For styling modifiers, use BEM-style.

## Validation

- There are no automated tests or lint scripts in the repo today.
- Validate changes by loading the unpacked extension in Chrome and exercising the popup flows manually.
- For behavior changes, check the affected actions directly: capture, open, close, copy, clear, storage restore, theme toggling, and filter handling as applicable.
- For CSS changes, check light, dark, and automatic themes, keyboard focus, reduced motion, and overflow at the popup size.
- If `manifest.json` or popup assets change, reload the extension in `chrome://extensions` before verifying.

## Store Images

- For TabList store screenshots or promotional images, follow [tablist-store-images](.agents/skills/tablist-store-images/SKILL.md).
- Default to matching light and dark images at 1280×800 in 24-bit RGB PNG without transparency. Honor explicit requests for 640×400, JPEG, or one theme.
- Use the current popup and harmless demonstration URLs with identical data and framing in both themes. Describe local fixture previews accurately; do not present them as live Chrome captures.
- Save final images in `promo/` using distinct theme names. Preserve existing images with numbered filenames unless replacement is requested.
- Validate dimensions and RGB encoding with the skill's export helper, then visually inspect each result. Python/Pillow is an image-authoring dependency only; do not add extension build tooling for it.

## Documentation

- Update `README.md` when user-visible behavior, setup, permissions, or workflow changes.
- Do not add broad process documentation unless it directly helps contributors work on this extension.
