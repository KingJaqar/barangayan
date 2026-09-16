from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(r"C:\Users\User\barangayan\barangayan project paper\Barangayan Value Chain Position.png")
W, H = 1800, 1400
BG = "#F8FAFC"
NAVY = "#12355B"
BLUE = "#1D4E89"
TEAL = "#0F766E"
SLATE = "#334155"
MUTED = "#64748B"
LIGHT_BLUE = "#EAF2FB"
LIGHT_TEAL = "#E6F6F3"
LIGHT_SLATE = "#EEF2F6"
WHITE = "#FFFFFF"
ARROW = "#94A3B8"


def font(size, bold=False):
    candidates = [
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def round_box(draw, box, fill, outline):
    draw.rounded_rectangle(box, radius=26, fill=fill, outline=outline, width=4)


def multiline_center(draw, box, text, font_obj, fill):
    l, t, r, b = box
    bounds = draw.multiline_textbbox((0, 0), text, font=font_obj, spacing=8, align="center")
    x = l + (r - l - (bounds[2] - bounds[0])) / 2
    y = t + (b - t - (bounds[3] - bounds[1])) / 2
    draw.multiline_text((x, y), text, font=font_obj, fill=fill, spacing=8, align="center")


def arrow(draw, y1, y2):
    x = W // 2
    draw.line((x, y1, x, y2), fill=ARROW, width=7)
    draw.polygon([(x, y2 + 18), (x - 20, y2 - 9), (x + 20, y2 - 9)], fill=ARROW)


def stage(draw, top, title, body, fill, outline, title_color):
    box = (250, top, 1550, top + 130)
    round_box(draw, box, fill, outline)
    draw.text((300, top + 25), title, font=font(25, bold=True), fill=title_color)
    multiline_center(draw, (510, top + 19, 1490, top + 112), body, font(29, bold=True), NAVY if title_color != TEAL else TEAL)
    return top + 130


def main():
    image = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(image)
    draw.text((100, 65), "Barangayan Value Chain Position", font=font(48, bold=True), fill=NAVY)
    draw.text(
        (102, 128),
        "How barangay requirements move through the Barangayan platform and supporting services",
        font=font(24),
        fill=SLATE,
    )
    draw.line((100, 178, 1700, 178), fill="#CBD5E1", width=3)

    bottom = stage(
        draw, 240, "1  Community users",
        "Residents and barangay personnel",
        LIGHT_BLUE, "#93C5FD", BLUE,
    )
    arrow(draw, bottom, bottom + 42)
    bottom = stage(
        draw, bottom + 65, "2  Operational requirements",
        "Service, information, and administrative requirements",
        WHITE, "#94A3B8", SLATE,
    )
    arrow(draw, bottom, bottom + 42)
    bottom = stage(
        draw, bottom + 65, "3  Platform layer",
        "Barangayan configuration and workflow platform",
        LIGHT_TEAL, "#5EEAD4", TEAL,
    )
    arrow(draw, bottom, bottom + 42)
    bottom = stage(
        draw, bottom + 65, "4  Core digital services",
        "Supabase authentication, database, storage, and realtime services",
        WHITE, "#93C5FD", BLUE,
    )
    arrow(draw, bottom, bottom + 42)
    bottom = stage(
        draw, bottom + 65, "5  External providers",
        "Payment, map, routing, notification, and messaging providers",
        LIGHT_SLATE, "#94A3B8", SLATE,
    )
    arrow(draw, bottom, bottom + 42)
    stage(
        draw, bottom + 65, "6  Documented outputs",
        "Documented resident transactions and administrative actions",
        LIGHT_BLUE, "#93C5FD", BLUE,
    )
    draw.text(
        (100, 1335),
        "Barangayan supports barangay operations; it does not replace official decision-making or provider responsibilities.",
        font=font(21),
        fill=MUTED,
    )
    image.save(OUT, quality=95)


if __name__ == "__main__":
    main()
