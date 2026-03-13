# Cosmic Ventures — Browser Extension

## Installation

1. **Unzip** this file somewhere permanent (e.g. Documents/cosmic-ventures-ext)
   - Don't delete the folder after installing — Chrome needs it to stay there

2. Open Chrome and go to: **chrome://extensions**

3. Enable **Developer mode** using the toggle in the **top-right corner**

4. Click **"Load unpacked"**

5. Select the **cv-ext** folder (the one containing manifest.json)

6. The 🌌 icon should appear in your toolbar
   - If you don't see it, click the puzzle piece 🧩 icon and pin Cosmic Ventures

7. Click the icon to play — the game runs entirely inside the popup!

## Troubleshooting

**Popup is too small / cuts off:**
- Right-click the extension icon → the popup should auto-size to 800×580px
- If it still looks wrong, try closing and reopening the popup

**Nothing shows up / blank popup:**
- Go to chrome://extensions, find Cosmic Ventures, and click "Errors"
- If you see a CSP error, make sure you loaded the folder from the zip (not a downloaded .html file)

**"Could not load extension" error:**
- Make sure you selected the cv-ext folder itself, not the zip or the parent folder
- The folder must contain manifest.json directly inside it

## Notes
- Your save is stored in chrome.storage.local — it persists across browser restarts
- Managers earn while the popup is closed (offline earnings shown on next open)
- All cheat codes from the web version work here too
