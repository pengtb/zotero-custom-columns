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

## 实现札记（踩过的坑）

- **清单里 `applications.zotero` 有三项必填**：`id`、`update_url`、`strict_max_version`。这是 Zotero 给 Firefox 平台打的补丁（`Extension.sys.mjs` 里对 `type == "extension"` 逐条 `manifestError`），缺任何一个都会在安装时被拒，而且只弹一句笼统的「插件无法安装」。Firefox 的 addons-linter **查不出来**（那边 `update_url` 是可选的）。`build.py` 里有断言拦这条。
- **注册列的选项类型必须严格匹配** `itemTreeManager.js` 里的 `optionTypeDefinition`：`width` 要**字符串**（给数字则整份选项校验不过），`flex` 要数字，`dataProvider`/`renderCell` 要函数。类型不对不会报错——`registerColumn` 直接静默返回 false，一列都不注册。所以插件把每次注册的结果和失败原因写进日志。
- **`renderCell` 返回的元素必须自己带 `class="cell " + column.className`**：列宽是动态样式表里的 `.<dataKey>-<styleKey> { width: … }`，作用在带 `cell` class 的元素上；少了这个 class，拖列宽时单元格内容不跟着变（宽度/溢出/省略号都拿不到），看起来还像「对齐不对」。
- **设置面板是 XHTML(XML) 文档**：`innerHTML` 走 XML 解析器，void 标签没自闭合、命名空间没写对都会**静默失败**（按钮点下去没反应）。所以面板一律用 `createElementNS` 建元素，并挂 `window` 的 error 监听把异常写进日志。
- **列排序是字符串排序**：数字列必须在取值时补零（返回 `000009`）、显示时再剥零，否则 10 会排在 8 前面。排序与显示分开处理是这套 API 的固有形态。
- `dataProvider` 每行每次渲染都会被调用，里面不要做 IO（几百条量级无感）。

## 已知限制

- 设置界面只写配置、不做实时预览；点「保存并应用」才落盘并重建列。
- 只挂在主列表（`enabledTreeIDs` 未指定 = main），Feeds 视图里不出现。
- 侧栏那条面板名固定显示「自定义列 / Custom Columns」；面板名在注册时就确定，要跟着语言变就得重挂面板（会重载整个偏好窗），不划算。
- 工具→插件 里显示的插件名/描述是清单里的固定值，不跟界面语言开关走（那需要 `_locales` + `__MSG_…__`）。
- `update_url` 指向本仓库的 `updates.json`（Zotero 硬性要求这个字段）。该文件目前不存在，Zotero 校验更新时 404——无害；要做自动更新就发 Release 并补上 `updates.json`。
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
