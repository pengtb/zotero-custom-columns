"""设置面板的静态检查。用法: python check_prefs.py

查三件事（面板里的失败都是静默的，所以能在本地拦的都拦下来）：
  1. prefs.xhtml 片段良构、void 元素自闭合（XML 文档，不自闭合解析失败）
  2. prefs.js 里不许出现 innerHTML —— 面板是 XML 文档，innerHTML 走 XML 解析器，
     命名空间/自闭合稍有闪失就静默失败，所以约定：一律用 createElementNS 建元素
  3. prefs.js 里 querySelector 查到的 class，必须在建元素时真的建了出来（防拼错）
"""
import re
import sys
import xml.etree.ElementTree as ET

VOID = ("input", "br", "img", "hr", "area", "base", "col", "embed", "link", "meta", "source", "track", "wbr")

pane = open("prefs.xhtml", encoding="utf-8").read()
ET.fromstring('<root xmlns:html="http://www.w3.org/1999/xhtml">' + pane + "</root>")
for tag in VOID:
    bad = re.findall(r"<html:" + tag + r"\b[^>]*[^/]>", pane)
    assert not bad, f"prefs.xhtml 里这些 {tag} 没自闭合: {bad[:3]}"
print("1) prefs.xhtml 良构 + void 自闭合 OK")

src = open("prefs.js", encoding="utf-8").read()

assert not re.search(r"\b(?:inner|outer)HTML\s*=", src), \
    "prefs.js 里出现了 innerHTML/outerHTML 赋值（XML 文档里的静默失败陷阱）"
print("2) prefs.js 没有 innerHTML 赋值 OK")

# 建出来的 class：class: "X" / inp("X") / box("X") / mk("div", "X")
created = set(re.findall(r'class:\s*"([\w-]+)"', src))
created |= set(re.findall(r'\b(?:inp|box)\("([\w-]+)"', src))
created |= set(re.findall(r'\bmk\("[a-z]+",\s*"([\w-]+)"', src))
# 查的 class：querySelector(".X") / querySelectorAll(".X") / q(".X")
queried = set(re.findall(r'querySelector(?:All)?\("\.([\w-]+)"\)', src))
queried |= set(re.findall(r'\bq\("\.([\w-]+)"\)', src))

missing = sorted(queried - created)
assert not missing, f"prefs.js 查了没建出来的 class: {missing}（建出来的有 {sorted(created)}）"
print(f"3) class 一致 OK（建 {len(created)} 个，查 {len(queried)} 个）")

# 4) 两种语言的文案 key 必须一一对应，代码里用到的 key 必须都存在
#    （少了 key 界面会显示 undefined，而且不报错）
def lang_keys(lang):
    blk = re.search(lang + r": \{(.*?)\n\t\},", src, re.S)
    assert blk, f"prefs.js 里找不到 {lang} 的文案块"
    return set(re.findall(r"^\t\t(\w+):", blk.group(1), re.M))

zh, en = lang_keys("zh"), lang_keys("en")
assert zh == en, f"两种语言的 key 不一致：zh 独有 {sorted(zh - en)}，en 独有 {sorted(en - zh)}"
used = set(re.findall(r'this\.t\("(\w+)"', src)) | set(re.findall(r'this\.t\([^)]*?"(\w+)":', src))
assert used <= zh, f"代码里用到但没定义的文案 key: {sorted(used - zh)}"
print(f"4) 文案 key 一致 OK（{len(zh)} 条，代码用到 {len(used)} 条）")
sys.exit(0)
