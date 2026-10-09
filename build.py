"""打包成 Zotero 可安装的 .xpi（就是个 zip，manifest.json 必须在根目录）。
用法: python build.py

zip 内部结构刻意对齐社区发布的 xpi（create_system=3 + UTF-8 文件名标志）：
python zipfile 默认写 create_system=0、不带 UTF-8 标志，虽然都在标准范围内，
但没必要跟"能当场装上"的文件长得不一样。
"""
import json
import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = ["manifest.json", "bootstrap.js", "core.js", "columns.js", "custom-columns.json",
         "prefs.xhtml", "prefs.js", "prefs.css", "icon.png", "icon@2x.png"]
OUT = os.path.join(HERE, "custom-columns.xpi")


def add(z, name):
    zi = zipfile.ZipInfo(name, date_time=(2026, 10, 8, 12, 0, 0))
    zi.compress_type = zipfile.ZIP_DEFLATED
    zi.create_system = 3              # Unix
    zi.external_attr = 0o644 << 16
    # 文件名 UTF-8 标志位（0x800）交给 zipfile 自己管：它只对非 ASCII 名字设置，
    # 而我们的文件名全是 ASCII，手工设了也会被 _open_to_write 覆盖。
    with open(os.path.join(HERE, name), "rb") as f:
        z.writestr(zi, f.read())


with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for f in FILES:
        add(z, f)

# 自检：zip 可读、manifest 在根且排第一、八个文件齐全、create_system 对齐参考 xpi
with zipfile.ZipFile(OUT) as z:
    assert z.testzip() is None, "zip 损坏"
    names = z.namelist()
    assert names[0] == "manifest.json", f"manifest.json 必须是第一个条目，实际 {names[0]}"
    assert sorted(names) == sorted(FILES), f"内容不对: {names}"
    for i in z.infolist():
        assert i.create_system == 3, f"{i.filename} create_system={i.create_system}"
    # Zotero 对插件清单有三个硬性要求（在它 patch 过的 Extension.sys.mjs 里），缺任何一个
    # 都会在安装时被拒、且只给一句笼统的"无法安装"——Firefox 的校验器查不出来，所以在这里拦。
    zotero = json.loads(z.read("manifest.json"))["applications"]["zotero"]
    for key in ("id", "update_url", "strict_max_version"):
        assert zotero.get(key), f"applications.zotero.{key} 缺失，Zotero 会拒绝安装"

print(f"已打包: {OUT}  {os.path.getsize(OUT)} 字节  内含 {len(FILES)} 个文件")
