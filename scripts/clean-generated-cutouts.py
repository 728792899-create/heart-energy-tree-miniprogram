#!/usr/bin/env python3
"""Build real RGBA cutouts from the preserved Image 2 source files.

Image 2 occasionally bakes a checkerboard preview into otherwise useful artwork.
On macOS this script first uses Apple's local Vision foreground segmentation to
isolate the subject. A conservative color cleanup then removes the dark neutral
preview remnants that Vision may retain around the three largest trees.
"""

from collections import deque
from pathlib import Path
import shutil
import subprocess
import tempfile

from PIL import Image, ImageChops, ImageFilter

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = PROJECT_ROOT / "design" / "imagegen-source"
OUTPUT_DIR = PROJECT_ROOT / "miniprogram" / "assets" / "generated"
MOTION_CHARACTER_DIR = PROJECT_ROOT / "motion-studio" / "public" / "characters"
VISION_SCRIPT = PROJECT_ROOT / "scripts" / "extract-foreground.swift"

COUPLE_ASSETS = ("couple-hold.png", "couple-jump.png", "couple-stand.png")
PARTICLE_ASSETS = ("particle-coin.png", "particle-heart.png", "particle-petal.png", "particle-star.png")
TREE_ASSETS = tuple(f"tree-level-{level}.png" for level in range(1, 6))
ALL_CUTOUTS = COUPLE_ASSETS + PARTICLE_ASSETS + TREE_ASSETS
LARGE_TREE_ASSETS = ("tree-level-3.png", "tree-level-4.png", "tree-level-5.png")


def clean_neutral_remnants(source: Path, destination: Path) -> None:
    """Remove only dark, low-saturation preview remnants from a Vision cutout."""
    image = Image.open(source).convert("RGBA")
    width, height = image.size
    pixels = list(image.getdata())
    candidate = [False] * (width * height)

    for index, (red, green, blue, alpha) in enumerate(pixels):
        if alpha < 16:
            candidate[index] = True
            continue
        maximum = max(red, green, blue)
        minimum = min(red, green, blue)
        saturation = 0 if maximum == 0 else (maximum - minimum) / maximum
        value = maximum / 255
        candidate[index] = saturation <= 0.19 and 0.10 <= value <= 0.72

    # Remove all matching preview pixels, including islands enclosed by the tree's
    # decorative halo. Vision has already isolated the foreground, so the narrow
    # threshold does not need to guess the complete silhouette.
    removed = [False] * (width * height)
    queue = deque()
    for x in range(width):
        for y in (0, height - 1):
            index = y * width + x
            if candidate[index] and not removed[index]:
                removed[index] = True
                queue.append(index)
    for y in range(height):
        for x in (0, width - 1):
            index = y * width + x
            if candidate[index] and not removed[index]:
                removed[index] = True
                queue.append(index)

    while queue:
        index = queue.popleft()
        y, x = divmod(index, width)
        for delta_y in (-1, 0, 1):
            for delta_x in (-1, 0, 1):
                if delta_x == 0 and delta_y == 0:
                    continue
                next_x = x + delta_x
                next_y = y + delta_y
                if 0 <= next_x < width and 0 <= next_y < height:
                    next_index = next_y * width + next_x
                    if candidate[next_index] and not removed[next_index]:
                        removed[next_index] = True
                        queue.append(next_index)

    removed = [was_removed or candidate[index] for index, was_removed in enumerate(removed)]
    matte = Image.new("L", (width, height), 0)
    matte_pixels = matte.load()
    for index, was_removed in enumerate(removed):
        if not was_removed:
            y, x = divmod(index, width)
            matte_pixels[x, y] = 255

    matte = matte.filter(ImageFilter.GaussianBlur(0.65))
    final_alpha = ImageChops.multiply(image.getchannel("A"), matte)
    image.putalpha(final_alpha)
    image.save(destination, optimize=True)


def extract_with_vision(temporary_dir: Path) -> None:
    swift = shutil.which("swift")
    if not swift:
        raise RuntimeError("未找到 Swift；透明前景清理需要 macOS 自带的 Swift 与 Vision。")
    command = [swift, str(VISION_SCRIPT)]
    for name in ALL_CUTOUTS:
        source = SOURCE_DIR / name
        if not source.exists():
            raise FileNotFoundError(f"缺少 Image 2 原图：{source}")
        command.extend((str(source), str(temporary_dir / name)))
    subprocess.run(command, cwd=PROJECT_ROOT, check=True)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="heart-tree-cutouts-") as temporary:
        temporary_dir = Path(temporary)
        extract_with_vision(temporary_dir)
        for name in ALL_CUTOUTS:
            source = temporary_dir / name
            destination = OUTPUT_DIR / name
            if name in LARGE_TREE_ASSETS:
                clean_neutral_remnants(source, destination)
            else:
                shutil.copyfile(source, destination)

    MOTION_CHARACTER_DIR.mkdir(parents=True, exist_ok=True)
    for name in COUPLE_ASSETS:
        shutil.copyfile(OUTPUT_DIR / name, MOTION_CHARACTER_DIR / name)


if __name__ == "__main__":
    main()
