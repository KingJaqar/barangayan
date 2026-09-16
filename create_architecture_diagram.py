from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(r"C:\Users\User\barangayan\barangayan project paper\Barangayan System Architecture.png")
W, H = 1800, 1200
BG = "#F8FAFC"
NAVY = "#12355B"
BLUE = "#1D4E89"
TEAL = "#0F766E"
SLATE = "#334155"
LIGHT_BLUE = "#EAF2FB"
LIGHT_TEAL = "#E6F6F3"
LIGHT_SLATE = "#EEF2F6"
WHITE = "#FFFFFF"
LINE = "#94A3B8"


def font(size, bold=False):
    names = [
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
    ]
    for name in names:
        if Path(name).exists():
            return ImageFont.truetype(name, size)
    return ImageFont.load_default()


def centered_text(draw, box, text, font_obj, fill):
    left, top, right, bottom = box
    bbox = draw.multiline_textbbox((0, 0), text, font=font_obj, spacing=8, align="center")
    x = left + (right - left - (bbox[2] - bbox[0])) / 2
    y = top + (bottom - top - (bbox[3] - bbox[1])) / 2
    draw.multiline_text((x, y), text, font=font_obj, fill=fill, spacing=8, align="center")


def rounded_box(draw, box, fill, outline, radius=26, width=3):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def arrow(draw, start, end, color=LINE, width=6, head=18):
    draw.line([start, end], fill=color, width=width)
    x1, y1 = start
    x2, y2 = end
    if y2 > y1:
        points = [(x2, y2), (x2 - head, y2 - head), (x2 + head, y2 - head)]
    else:
        points = [(x2, y2), (x2 - head, y2 + head), (x2 + head, y2 + head)]
    draw.polygon(points, fill=color)


def card(draw, box, title, subtitle, fill, outline, title_color=NAVY):
    rounded_box(draw, box, fill, outline)
    left, top, right, bottom = box
    title_font = font(31, bold=True)
    sub_font = font(22)
    draw.text((left + 36, top + 28), title, font=title_font, fill=title_color)
    draw.multiline_text((left + 36, top + 83), subtitle, font=sub_font, fill=SLATE, spacing=6)


def main():
    image = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(image)

    # Title
    draw.text((100, 62), "Barangayan System Architecture", font=font(48, bold=True), fill=NAVY)
    draw.text(
        (102, 125),
        "Mobile and web clients connected to secure shared services and approved external integrations",
        font=font(24),
        fill=SLATE,
    )
    draw.line((100, 175, 1700, 175), fill="#CBD5E1", width=3)

    # Client applications
    card(
        draw, (150, 235, 800, 395),
        "Resident Mobile Application",
        "Resident services, requests, incident reports,\nemergency information, and status tracking",
        LIGHT_BLUE, "#93C5FD",
    )
    card(
        draw, (1000, 235, 1650, 395),
        "Web Application",
        "Administrative workflows, content management,\ndashboards, and resident web access",
        LIGHT_BLUE, "#93C5FD",
    )

    # Converging arrows
    arrow(draw, (475, 395), (805, 475))
    arrow(draw, (1325, 395), (995, 475))

    # Shared application services
    rounded_box(draw, (400, 475, 1400, 590), WHITE, BLUE, radius=28, width=4)
    centered_text(draw, (400, 492, 1400, 570), "Shared Schemas and Application Services", font(34, bold=True), NAVY)

    # Supabase auth
    arrow(draw, (900, 590), (900, 660))
    rounded_box(draw, (525, 660, 1275, 765), LIGHT_TEAL, "#5EEAD4", radius=28, width=4)
    centered_text(draw, (525, 675, 1275, 748), "Supabase Authentication and Sessions", font(32, bold=True), TEAL)

    # data services
    arrow(draw, (900, 765), (900, 835))
    rounded_box(draw, (275, 835, 1525, 940), WHITE, "#94A3B8", radius=28, width=4)
    centered_text(draw, (275, 850, 1525, 922), "PostgreSQL  •  Row-Level Security  •  Storage  •  Realtime", font(29, bold=True), NAVY)

    # Edge functions
    arrow(draw, (900, 940), (900, 1005))
    rounded_box(draw, (525, 1005, 1275, 1110), LIGHT_SLATE, "#94A3B8", radius=28, width=4)
    centered_text(draw, (525, 1020, 1275, 1094), "Server-side Edge Functions", font(32, bold=True), SLATE)

    # Footer integrations label
    draw.text((100, 1142), "Approved external integrations: PayMongo and QR Ph  •  Maps  •  Notifications  •  Messaging", font=font(22), fill=SLATE)

    image.save(OUT, quality=95)


if __name__ == "__main__":
    main()
