"""Build the README showcase from real Rocket Lunch screenshots."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "assets" / "readme" / "showcase.png"
SCREENSHOTS = [
    (
        "ГОЛОСОВАНИЕ",
        ROOT
        / "frontend-new"
        / "docs"
        / "frontend-redesign"
        / "screenshots"
        / "phase-4"
        / "home-light.png",
    ),
    (
        "ЗАКУПКА",
        ROOT
        / "frontend-new"
        / "docs"
        / "frontend-redesign"
        / "screenshots"
        / "phase-3d"
        / "participant-light.png",
    ),
    (
        "СТАТИСТИКА",
        ROOT
        / "frontend-new"
        / "docs"
        / "frontend-redesign"
        / "screenshots"
        / "phase-6"
        / "stats-dark.png",
    ),
]


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    names = (
        ["C:/Windows/Fonts/seguisb.ttf", "C:/Windows/Fonts/segoeuib.ttf"]
        if bold
        else ["C:/Windows/Fonts/segoeui.ttf"]
    )
    names += [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    ]
    for name in names:
        if Path(name).exists():
            return ImageFont.truetype(name, size)
    return ImageFont.load_default()


def rounded_screen(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    width, height = size
    scale = width / source.width
    resized = source.resize(
        (width, round(source.height * scale)),
        Image.Resampling.LANCZOS,
    )
    cropped = resized.crop((0, 0, width, height))
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width, height), radius=24, fill=255)
    result = Image.new("RGB", size, "#202A37")
    result.paste(cropped, mask=mask)
    return result


def main() -> None:
    canvas = Image.new("RGB", (1200, 800), "#202A37")
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(38, bold=True)
    label_font = load_font(18, bold=True)
    body_font = load_font(20)

    draw.text((58, 42), "Rocket Lunch в работе", fill="#EDF1F6", font=title_font)
    draw.text(
        (58, 91),
        "Реальные состояния Mini App · светлая и тёмная темы",
        fill="#A9B7C6",
        font=body_font,
    )

    frame_width = 326
    frame_height = 610
    x_positions = (58, 437, 816)
    accents = ("#FF9066", "#E8AC4A", "#82C972")

    for (label, path), x, accent in zip(SCREENSHOTS, x_positions, accents):
        draw.rounded_rectangle(
            (x - 8, 144, x + frame_width + 8, 779),
            radius=32,
            fill="#18212C",
        )
        draw.rounded_rectangle(
            (x, 152, x + frame_width, 198),
            radius=20,
            fill=accent,
        )
        text_box = draw.textbbox((0, 0), label, font=label_font)
        text_width = text_box[2] - text_box[0]
        draw.text(
            (x + (frame_width - text_width) / 2, 164),
            label,
            fill="#202A37",
            font=label_font,
        )
        with Image.open(path) as source:
            screen = rounded_screen(source.convert("RGB"), (frame_width, frame_height))
        canvas.paste(screen, (x, 210))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUTPUT, optimize=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()
