# TabList

TabList helps you manage many tabs quickly using one simple URL list.

## What it does

- Saves your URL list in the popup with autosave.
- Captures currently open tabs into the list with **Capture Links**.
- Opens links from the list in batches with **Open Links**.
- Avoids unnecessary duplicates: if a matching active tab exists, it won't open another one.
- Closes inactive tabs that match URLs in your list with **Close Links**.
- Copies the full list to clipboard in one click with **Copy**.
- Shows valid link count and live status updates.
- Shows the active list's valid link count on the extension toolbar badge.
- Adds or removes the current page URL from the active list via the browser context menu.
- Supports a capture filter for limiting captured tab URLs with a regular expression.
- Supports multiple saved lists and light, dark, or automatic themes.

## Privacy

- Your data is stored locally in your browser with `chrome.storage.local`.
- No URL list is sent to external servers.

## Permissions

- `tabs` - read open tabs and open/close tabs from your list.
- `storage` - save your list locally.
- The `contextMenus` permission is required to add or remove the current page URL from your active TabList using the browser's right-click menu. We only use it when you select “Add page to TabList” or “Remove page from TabList”; it does not read page content or collect browsing data.

## Requirements

- Google Chrome, or a Chromium-compatible browser with Manifest V3 support.
- No build step, package manager, or framework is required. The project uses plain JavaScript ES modules.

## Local installation

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `TabList` project folder.

The extension will appear in the browser toolbar.

## Usage

1. Click the extension icon to open the popup.
2. Add URLs to **Link List**, one per line or mixed into text.
3. Optionally set **Capture Filter** to capture only matching tab URLs.
4. Use the theme toggle in the header to switch between automatic, light, and dark themes.
5. Use **Capture Links** to replace the list with URLs from currently open tabs.
6. Use **Open Links** to open valid URLs from the list in background tabs.
7. Use **Close Links** to close inactive tabs whose URLs are listed.
8. Use **Copy** to copy the full list, or **Clear** to empty it.

### Capture filter examples

- `example\\.com` - plain regular expression without flags.
- `/example\\.com/i` - slash notation with flags.

## Release archive

- `sh release.sh patch` - increments the patch version and creates an archive in `releases/`.
- `sh release.sh minor` - increments the minor version and resets patch.
- `sh release.sh major` - increments the major version and resets minor and patch.
- `sh release.sh --set-version 1.2.3` - sets an exact version manually.

The script updates the `version` field in `manifest.json` and creates an archive named `releases/TabList-vX.Y.Z.zip`.

## Project structure

- `manifest.json` - Manifest V3 extension configuration.
- `popup.html` - popup markup.
- `popup.css` - popup styles.
- `popup/main.js` - popup entry point.
- `popup/controllers/` - popup controller and UI orchestration.
- `popup/services/` - browser tab and URL-processing behavior.
- `popup/storage/` - wrappers around `chrome.storage.local`.
- `popup/view/` - DOM access and rendering.
- `popup/parsers/` - URL and filter parsing.
- `popup/formatters/` - UI text formatting.
- `popup/utils/` - shared utilities.
- `icons/` - extension icons.
- `release.sh` - version bumping and release packaging.
- `icons.sh` - icon generation from SVG.
- `advertisement.sh` - advertisement image generation from SVG.
