# Notion Logo Conversion Instructions

Your EasyFlow logo is located at: `rpa-system/rpa-dashboard/src/logo.svg`

## Quick Method (Recommended - 2 minutes)

**Use an online converter:**

1. Go to: https://cloudconvert.com/svg-to-png
2. Upload: `rpa-system/rpa-dashboard/src/logo.svg`
3. Set conversion settings:
   - **Width:** 1024 pixels
   - **Height:** 1024 pixels (square)
   - **Background:** Transparent
4. Click "Convert"
5. Download the PNG file
6. Save it as: `rpa-system/rpa-dashboard/public/logo-notion.png`

## Alternative: Install System Library

If you prefer command-line conversion:

```bash
# Install the required library
brew install cairo

# Then run the conversion script
python3 convert-logo-for-notion.py
```

## Notion Requirements

- **Format:** PNG
- **Size:** 1024x1024 pixels (square)
- **Background:** Transparent
- **File location:** Upload to Notion integration settings

## After Conversion

Once you have the PNG file, upload it to your Notion integration at:
https://www.notion.so/my-integrations

The logo will appear in the Notion integration settings and when users connect EasyFlow to their Notion workspace.

