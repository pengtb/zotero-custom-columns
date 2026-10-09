# Custom Columns（Zotero 插件）

给 Zotero 条目列表加**任意自定义列**——列由一份 JSON 定义，配一个可视化设置界面，界面支持中英文。

Zotero 的列只能来自条目字段，所以「评分」「阅读状态」这类写在 `extra` 里的信息没法单独成列，只能挤在「其他」里看。这个插件把「取哪个字段 → 怎么提取 → 怎么显示」变成配置，要什么列自己加。

## 功能

- **任意列**：取任意条目字段（`extra`、`DOI`、`publicationTitle`…），或用现成的派生值（所在集合名、子笔记数、附件数、阅读状态、入库日期）
- **正则提取**：从字段值里挖出你要的那一段，例如 `Score:\s*(\d+)/10`
- **显示控制**：数字排序、固定列宽、着色（颜色 + 阈值）、加粗、默认降序、默认显示
- **设置界面**：一列一行，可增删、上下移序，「保存并应用」立即重建列；写错的行会被拦下并说明原因（缺名称 / 正则无效 / 派生值不认识）
- **中英文界面**：面板右上角切换，默认跟随 Zotero 界面语言
- 纯本地：不联网、除 Python 标准库外无依赖，配置就是数据目录里的一个 JSON

## 安装

```bash
python build.py     # 生成 custom-columns.xpi
```

也可以直接从 [Releases](https://github.com/pengtb/zotero-custom-columns/releases/latest) 下载打包好的 `custom-columns.xpi`，不用自己构建。

Zotero → 工具 → 插件 → 把 `custom-columns.xpi` 拖进窗口（提示未签名，允许即可，社区插件普遍如此）。装完去 工具 → 设置 → **自定义列 / Custom Columns** 配置。

Zotero 7 起可用（当前按 Zotero 9 声明 `strict_max_version: 9.0.*`）。

## 使用

设置界面里一列一行，每行两排控件：

    名称 | 取值方式（字段 / 派生） | 字段名或派生值 | 正则
    数字排序 | 宽度 | 颜色 | 阈值 | 加粗 | 默认降序 | 默认显示 | ↑ ↓ 删除

「＋ 新增列」加一行，「保存并应用」写回配置文件并立刻重建条目列表里的列。新列默认直接显示，不用去列选择器里勾（相当于 Zotero 内置列用的 `defaultIn`）。

## 手动改配置

配置在 **`<Zotero 数据目录>/custom-columns.json`**——首次启动会把插件里那份默认配置写到这儿，之后只认这份（升级插件不会覆盖你的配置）。改完在 Zotero 里 `Ctrl+Shift+J` 打开开发者控制台运行 `Zotero.CustomColumns.load()`，或重启 Zotero。

| 键 | 说明 |
|---|---|
| `label` | 列名（必填） |
| `field` | 取哪个条目字段，如 `extra` / `publicationTitle` / `DOI` |
| `regex` | 可选。从字段值里提取，捕获组默认第 1 组，可用 `group` 指定 |
| `derived` | 改用现成的派生值：`collections` / `noteCount` / `attachmentCount` / `readStatus` / `dateAdded` |
| `numeric` | true = 按数字排序（内部补零），显示时去掉补零 |
| `width` | 列宽像素；不给则自动伸缩 |
| `color` + `min` | 可选着色：数值 >= `min` 时用 `color` |
| `bold` | 加粗 |
| `descending` | 该列默认降序 |
| `show` | 缺省 true；设 false = 列默认不显示，要到列选择器里手动勾 |
| `submenu` | 放到列选择器「更多列」子菜单里 |
| `fallback` | 取不到值时的显示文本 |

要加新的派生值：在 `columns.js` 的 `derived()` 里加一个 `case`（两三行），设置界面的下拉会自动带上。

## 自检

```bash
node core.test.js          # 纯逻辑：正则取值 / 补零排序 / 显示 / 颜色 / 配置规范化
python check_prefs.py      # 设置面板：片段良构 + 不用 innerHTML + class 一致 + 两种语言 key 对齐
python make_icon.py        # 重新生成图标（改配色/形状时用）
```

设置面板里的失败都是**静默**的（Zotero 不把插件的 JS 错误写进任何日志文件），所以插件自己往数据目录写一份诊断日志：**`<Zotero 数据目录>/custom-columns.log`**——注册了几列、面板走到哪一步、未捕获异常的调用栈，都在里面。列没出现或面板空白时先看它。

## 已知限制

- 设置界面只写配置、不做实时预览；点「保存并应用」才落盘并重建列。
- 只挂在主列表（`enabledTreeIDs` 未指定 = main），Feeds 视图里不出现。
- 侧栏那条面板名固定显示「自定义列 / Custom Columns」；面板名在注册时就确定，要跟着语言变就得重挂面板（会重载整个偏好窗），不划算。
- 工具→插件 里显示的插件名/描述是清单里的固定值，不跟界面语言开关走（那需要 `_locales` + `__MSG_…__`）。
- 更新走仓库根目录的 `updates.json`，清单里的 `update_url` 指向它的 **jsDelivr 镜像**（`cdn.jsdelivr.net/gh/…@main/updates.json`）——`raw.githubusercontent.com` 在国内常被连接重置，Zotero 拉不到清单就等于没有自动更新。发新版流程：改 `manifest.json` 的 `version` → `python build.py` → 打 tag 发 Release 并把 `custom-columns.xpi` 传成附件 → 更新 `updates.json` 的 `version` / `update_link` / `update_hash`。（jsDelivr 对分支引用有缓存，新版清单可能延迟几小时生效，Zotero 定期比对，无妨。）
- Zotero 大版本升级后要改 `manifest.json` 里的 `strict_max_version`。

## 目录结构

    manifest.json        插件清单（Zotero 7+ bootstrap 插件）
    bootstrap.js         启动/关闭钩子：载入脚本、注册设置面板
    columns.js           Zotero 侧：读配置 → 注册列 → 取值与渲染；诊断日志
    core.js              纯逻辑（正则取值/补零/颜色/配置规范化），能脱离 Zotero 自检
    prefs.xhtml prefs.js prefs.css   设置面板（XHTML 片段 + 脚本 + 样式）
    custom-columns.json  默认配置（首次启动复制到数据目录）
    icon.png icon@2x.png 图标（48 / 96）
    build.py             打包成 .xpi（含清单必填项断言）
    make_icon.py         生成图标
    check_prefs.py       设置面板静态检查
    core.test.js         纯逻辑自检

## 许可

未声明许可证，个人自用为主。
