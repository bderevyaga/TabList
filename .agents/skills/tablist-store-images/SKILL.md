---
name: tablist-store-images
description: Create light- and dark-theme screenshots and promotional images for the TabList browser extension at 1280×800 or 640×400, exported as JPEG or 24-bit PNG. Use for extension store listing images, not extension icons or unrelated artwork.
---

# TabList store images

Create two finished images of the TabList extension by default: one in the **light theme** and one in the **dark theme**. If the user explicitly requests only one theme, produce only that theme. Default to **1280×800, 24-bit PNG**; honor a requested **640×400** size or **JPEG** format. Both sizes have a 16:10 aspect ratio. Use the same requested size and format for both themes; do not generate additional size or format variants unless requested.

## Source and composition

- Inspect the current repository's popup.html, popup.css, README.md, and icons to match its actual interface and features. Do not hardcode a developer machine path. If the repository or reference is unavailable, obtain the missing source before claiming the image depicts the current extension.
- For screenshots, render the real popup with harmless sample URLs and capture it with the available browser tools. Keep real user URLs and browser profile details out of the image. A local preview with fixture data is suitable when Chrome extension APIs are unavailable; describe it accurately.
- Preserve popup proportions and readable interface text. Place the popup on a 16:10 canvas with intentional margins rather than stretching the interface or cropping controls.
- For requested promotional artwork, use the available imagegen skill/tool for newly generated illustrations or backgrounds; use the actual popup as the UI reference. Do not invent controls, badges, reviews, or unsupported product features. Use the user's requested language for captions.
- A screenshot should remain a screenshot unless the user requests a promotional composition. Do not publish or upload images merely because they are intended for a store listing.

## Theme pair

- Use identical sample URLs, selected list, count, status, layout, scale, and framing in both images.
- Render the actual light and dark styles separately using the popup's `theme-light` and `theme-dark` root classes in a local preview, or its theme control in an extension session. Do not invert colors or rely on the system's automatic theme.
- Match the surrounding canvas to each theme while keeping its composition consistent. Check dark-theme text and controls for readability.
- Save final images in `promo/` at the root of the current TabList project; create that directory if needed. Honor an explicitly requested alternative output directory. Keep temporary previews and intermediate files outside `promo/`.
- Name outputs distinctly, for example `promo/tablist-light-1280x800.png` and `promo/tablist-dark-1280x800.png`. If a file already exists, use a numbered suffix instead of overwriting it unless replacement is explicitly requested.

## Exact export

The user's requested workflow includes deterministic resizing and RGB format conversion. Use `scripts/export_image.py` for this final export; use image generation tools for creative generation or edits.

The script needs Python with Pillow. If the default Python lacks it, discover the bundled Python through `load_workspace_dependencies`; do not assume a machine-specific runtime path.

```sh
python3 scripts/export_image.py source.png output.png --size 1280x800
python3 scripts/export_image.py source.png output.jpg --size 640x400
```

Resolve the script path relative to this skill directory. Output extension selects PNG or JPEG. The script preserves proportions, pads with white by default, and flattens transparency. For a dark composition, pass `--background '#1a202c'`. Prefer a source already composed at 16:10 to avoid unintended borders. Never overwrite the original source.

## Verify and deliver

- Verify each exported file is exactly the selected size and RGB. PNG must be 8 bits per channel, RGB color type 2 (24-bit), with no alpha or indexed palette. JPEG must be an RGB JPEG.
- Open both final outputs and check readable text, complete controls, composition, and no accidental private data. Fix visible problems before delivery.
- Return both images inline with separate local file links labeled Light and Dark, stating their dimensions and format. If only one theme was explicitly requested, return that image only. Do not claim store approval or current store policy compliance beyond the user's specified image constraints.
