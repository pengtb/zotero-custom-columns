"""生成插件图标（48 / 96 px PNG，三根不同高度的柱子 = “自定义列”）。
不用任何第三方库：直接按 PNG 规范写（zlib + struct），生成后回读校验。
用法: python make_icon.py
"""
import struct
import zlib

# 在 48x48 画布上的柱状图：x0, x1, y_top（底边都在 44）
BARS = [(6, 16, 24), (19, 29, 10), (32, 42, 30)]
COLORS = [(0x7B, 0x8B, 0x9A), (0xC0, 0x39, 0x2B), (0x7B, 0x8B, 0x9A)]
BOTTOM = 44
BASE = 48


def pixels(size):
    k = size / BASE

    def px(x, y):
        X, Y = (x + 0.5) / k, (y + 0.5) / k
        for (x0, x1, top), c in zip(BARS, COLORS):
            if x0 <= X < x1 and top <= Y < BOTTOM:
                return c + (255,)
        return (0, 0, 0, 0)

    return px


def write_png(path, size):
    fn = pixels(size)
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # 每行的 filter type
        for x in range(size):
            raw.extend(fn(x, y))

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8bit RGBA
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
        f.write(chunk(b"IEND", b""))

    # 回读校验：magic + IHDR 尺寸 + IDAT 能解开且长度正确
    with open(path, "rb") as f:
        blob = f.read()
    assert blob[:8] == b"\x89PNG\r\n\x1a\n", "不是 PNG"
    w, h = struct.unpack(">II", blob[16:24])
    assert (w, h) == (size, size), f"尺寸不对 {(w, h)}"
    idat = blob[blob.index(b"IDAT") + 4:]
    idat = idat[:struct.unpack(">I", blob[blob.index(b"IDAT") - 4:blob.index(b"IDAT")])[0]]
    assert len(zlib.decompress(idat)) == size * (1 + size * 4), "像素数据长度不对"


for name, size in (("icon.png", 48), ("icon@2x.png", 96)):
    write_png(name, size)
    print(f"已生成 {name} ({size}x{size})")

try:  # 有 PIL 就再独立验一遍
    from PIL import Image
    for name in ("icon.png", "icon@2x.png"):
        im = Image.open(name)
        im.load()
        print(f"  PIL 校验 {name}: {im.size} {im.mode}")
except ImportError:
    print("  （本机没有 PIL，跳过独立校验）")
