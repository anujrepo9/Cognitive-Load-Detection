"""
generate_icon.py — Creates resources/icon.ico and icon.png for CogniLoad.
Run once before PyInstaller if you don't have a custom icon.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import sys

RESOURCES = Path(__file__).parent.parent / "resources"
RESOURCES.mkdir(exist_ok=True)


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Background circle – indigo
    d.ellipse([0, 0, size - 1, size - 1], fill=(79, 70, 229, 255))

    # Brain-like shape: two overlapping circles inside
    m = size // 2
    r = size // 4
    d.ellipse([m - r - r // 3, m - r, m + r // 3, m + r], fill=(255, 255, 255, 220))
    d.ellipse([m - r // 3, m - r, m + r + r // 3, m + r], fill=(255, 255, 255, 220))

    # Center dividing line
    lw = max(2, size // 32)
    d.line([(m, m - r + lw * 2), (m, m + r - lw * 2)], fill=(79, 70, 229, 255), width=lw)

    # Top connector bump
    bump = size // 8
    d.ellipse([m - bump, m - r - bump // 2, m + bump, m - r + bump], fill=(255, 255, 255, 200))

    return img


def main():
    sizes = [16, 24, 32, 48, 64, 128, 256]
    images = [draw_icon(s) for s in sizes]

    # Save as .ico (multi-resolution)
    ico_path = RESOURCES / "icon.ico"
    images[-1].save(
        ico_path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=images[:-1],
    )
    print(f"[ICON] Saved {ico_path}")

    # Save as .png (256×256)
    png_path = RESOURCES / "icon.png"
    images[-1].save(png_path, format="PNG")
    print(f"[ICON] Saved {png_path}")


if __name__ == "__main__":
    main()
