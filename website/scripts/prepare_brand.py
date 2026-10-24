from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
WEBSITE = ROOT / "website"
PUBLIC = WEBSITE / "public"
PUBLIC.mkdir(parents=True, exist_ok=True)

source = Image.open(WEBSITE / "assets" / "travels-logo.png").convert("RGBA")
logo = source.copy()
logo.thumbnail((512, 512), Image.Resampling.LANCZOS)
logo.save(PUBLIC / "travels-logo.png", optimize=True)
logo.save(PUBLIC / "travels-logo.webp", quality=92, method=6)

icon = source.copy()
icon.thumbnail((128, 128), Image.Resampling.LANCZOS)
icon.save(WEBSITE / "app" / "icon.png", optimize=True)

apple_icon = source.copy()
apple_icon.thumbnail((180, 180), Image.Resampling.LANCZOS)
apple_icon.save(WEBSITE / "app" / "apple-icon.png", optimize=True)

width, height = 1200, 630
image = Image.new("RGB", (width, height), "#07111f")
pixels = image.load()
for y in range(height):
    for x in range(width):
        blue = max(0.0, 1.0 - (((x - 940) / 620) ** 2 + ((y - 170) / 520) ** 2))
        orange = max(0.0, 1.0 - (((x - 920) / 520) ** 2 + ((y - 590) / 460) ** 2))
        pixels[x, y] = (
            int(7 + 13 * blue + 32 * orange),
            int(17 + 45 * blue + 18 * orange),
            int(31 + 95 * blue + 8 * orange),
        )

glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
glow_draw = ImageDraw.Draw(glow)
glow_draw.ellipse((770, 60, 1190, 480), fill=(49, 124, 255, 90))
glow_draw.ellipse((850, 300, 1190, 650), fill=(255, 112, 62, 60))
glow = glow.filter(ImageFilter.GaussianBlur(85))
image = Image.alpha_composite(image.convert("RGBA"), glow)

draw = ImageDraw.Draw(image)
draw.rounded_rectangle((64, 62, 254, 104), radius=21, fill=(17, 36, 60, 255), outline=(54, 83, 116, 255))

def font(size: int, bold: bool = False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()

draw.text((88, 75), "TRAVELS 3.0", font=font(17, True), fill="#9fc5ff")
draw.text((64, 162), "Every change.", font=font(68, True), fill="#f7faff")
draw.text((64, 242), "A way back.", font=font(68, True), fill="#f7faff")
draw.text((68, 355), "Patch-based undo/redo for modern applications.", font=font(26), fill="#b7c6d9")
draw.text((68, 397), "Small updates. Durable history. Any framework.", font=font(26), fill="#b7c6d9")

hero_logo = source.copy()
hero_logo.thumbnail((405, 405), Image.Resampling.LANCZOS)
image.alpha_composite(hero_logo, (745, 125))
image.convert("RGB").save(PUBLIC / "og-image.png", optimize=True)

print("Generated logo, favicon, apple icon, and social image assets.")
