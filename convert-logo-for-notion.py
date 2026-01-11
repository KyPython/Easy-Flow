#!/usr/bin/env python3
"""
Convert EasyFlow logo SVG to PNG for Notion integration
Notion requires: Square logo, 1024x1024 pixels, PNG format with transparent background
"""

import sys
import os

def convert_svg_to_png():
    """Convert SVG logo to PNG for Notion"""
    svg_path = 'rpa-system/rpa-dashboard/src/logo.svg'
    output_path = 'rpa-system/rpa-dashboard/public/logo-notion.png'

    if not os.path.exists(svg_path):
        print(f"Error: Logo file not found at {svg_path}")
        return False
 
 # Try method 1: cairosvg (recommended)
    try:
    import cairosvg
    print("Converting SVG to PNG using cairosvg...")
    cairosvg.svg2png(
    url=svg_path,
    write_to=output_path,
    output_width=1024,
    output_height=1024,
    background_color='transparent'
    )
    print(f"✅ Success! Logo saved to: {output_path}")
    print(f" Size: 1024x1024 pixels (square, as required by Notion)")
    return True
    except ImportError:
    print("cairosvg not installed. Trying alternative method...")
    except Exception as e:
    print(f"Error with cairosvg: {e}")
 
 # Try method 2: rsvg-convert (if available via command line)
    try:
    import subprocess
    result = subprocess.run(
    ['rsvg-convert', '-w', '1024', '-h', '1024', '-o', output_path, svg_path],
    capture_output=True,
    text=True
    )
    if result.returncode == 0:
    print(f"✅ Success! Logo saved to: {output_path}")
    print(f" Size: 1024x1024 pixels (square, as required by Notion)")
    return True
    else:
    print("rsvg-convert failed")
    except FileNotFoundError:
    print("rsvg-convert not found")
    except Exception as e:
    print(f"Error with rsvg-convert: {e}")
 
 # Method 3: Instructions for manual conversion
    print("\n" + "="*60)
    print("AUTOMATIC CONVERSION FAILED")
    print("="*60)
    print("\nTo convert your logo manually:")
    print(f"1. Open the SVG file: {svg_path}")
    print("2. Use one of these methods:")
    print(" a) Online: https://cloudconvert.com/svg-to-png")
    print(" b) Install: pip3 install cairosvg")
    print(" c) Install: brew install librsvg")
    print("3. Export as PNG:")
    print(" - Size: 1024x1024 pixels (square)")
    print(" - Format: PNG")
    print(" - Background: Transparent")
    print(f"4. Save to: {output_path}")
    print("\nOr run: pip3 install cairosvg && python3 convert-logo-for-notion.py")
    return False

    if __name__ == '__main__':
    success = convert_svg_to_png()
    sys.exit(0 if success else 1)

