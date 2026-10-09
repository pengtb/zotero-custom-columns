/* Zotero 侧：读配置 → 注册列 → 提供取值与渲染。
   配置在数据目录下 custom-columns.json，首次启动自动写入一份默认配置。 */

const PLUGIN_ID = "custom-columns@ptbia";
const CONFIG_NAME = "custom-columns.json";
const Core = typeof CustomColumnsCore !== "undefined" ? CustomColumnsCore : globalThis.CustomColumnsCore;
/* 派生值清单：derived() 的 switch 与设置界面的下拉共用这一份 */
const DERIVED = ["collections", "noteCount", "attachmentCount", "readStatus", "dateAdded"];

Zotero.CustomColumns = {
	DERIVED,
	rootURI: "",
	defs: [],
	keys: [],

	configPath() {
		return PathUtils.join(Zotero.DataDirectory.dir, CONFIG_NAME);
	},

	async init(rootURI) {
		this.rootURI = rootURI;
		await this.load();
	},

	/* 诊断日志（和设置面板共用同一份）：Zotero 不把插件里的错误写进任何日志文件，
	   而注册失败是**静默**的（registerColumn 校验不过就返回 false），所以自己记一条。 */
	async log(msg) {
		try {
			const path = PathUtils.join(Zotero.DataDirectory.dir, "custom-columns.log");
			let prev = "";
			try {
				prev = await Zotero.File.getContentsAsync(path);
			}
			catch (e) { /* 第一次还没有这个文件 */ }
			await Zotero.File.putContentsAsync(
				path, prev + new Date().toTimeString().slice(0, 8) + " " + msg + "\n");
		}
		catch (e) { /* 日志本身不许报错 */ }
	},

	/* 读配置并（重新）注册所有列。改完配置在设置界面点保存，或在开发者控制台跑 Zotero.CustomColumns.load()。 */
	async load() {
		try {
			this.defs = Core.normalize(await this.readConfig());
			this.register();
		}
		catch (e) {
			Zotero.logError(e);
		}
	},

	/* 原始配置对象（未规范化）——设置界面要靠它把未加工的内容显示出来。 */
	async readConfig() {
		await this.ensureConfig();
		return JSON.parse(await Zotero.File.getContentsAsync(this.configPath()));
	},

	/* 写回配置并立即重建列。设置界面「保存并应用」走这里。 */
	async writeConfig(cfg) {
		await Zotero.File.putContentsAsync(this.configPath(), JSON.stringify(cfg, null, 2) + "\n");
		await this.load();
	},

	/* 首次运行：把插件里那份默认配置写到数据目录，之后就以数据目录那份为准。 */
	async ensureConfig() {
		if (!(await IOUtils.exists(this.configPath()))) {
			const def = await Zotero.File.getContentsAsync(this.rootURI + CONFIG_NAME);
			await Zotero.File.putContentsAsync(this.configPath(), def);
			Zotero.debug("CustomColumns: 已写入默认配置 " + this.configPath());
		}
	},

	register() {
		this.unregister();
		for (const d of this.defs) {
			/* dataKey 要跨重载稳定：Zotero 用它（以及它在生成样式表里的规则）记住列宽/排序。
			   cc_col_ 前缀是历史遗留，改掉会让已记的列宽失效。label 可能全是中文，replace
			   后为空也没关系——序号保证唯一。 */
			const key = "cc_col_" + d._index + "_" + d.label.replace(/[^A-Za-z0-9]/g, "");
			const opts = {
				dataKey: key,
				label: d.label,
				pluginID: PLUGIN_ID,
				showInColumnPicker: true,
				columnPickerSubMenu: !!d.submenu,
				sortReverse: !!d.descending,
				flex: d.width ? 0 : 1,
				zoteroPersist: ["width", "hidden", "sortDirection"],
				dataProvider: (item) => this.value(item, d),
				renderCell: (index, data, column, isFirstColumn, doc) => this.render(data, d, column, doc),
			};
			/* width 的类型是 string（见 itemTreeManager.js 里的 optionTypeDefinition）。
			   给 number 会让整份选项校验不过，registerColumn 静默返回 false、一列都不注册。 */
			if (d.width) opts.width = String(d.width);
			/* defaultIn 才是 itemTree.js 真正读取的字段（官方内置列都用它）：
			   让新列默认就显示，省得去列选择器里手动勾。配 "show": false 则不默认显示。 */
			if (d.show !== false) opts.defaultIn = ["default"];
			const got = Zotero.ItemTreeManager.registerColumn(opts);
			if (got) {
				this.keys.push(got);
			}
			else {
				this.log(`列 "${d.label}" 注册被拒：选项不合法`
					+ `（width=${typeof opts.width}:${opts.width}，flex=${typeof opts.flex}）`);
			}
		}
		this.log(`注册完成：配置 ${this.defs.length} 列，成功 ${this.keys.length} 列`);
		Zotero.debug("CustomColumns: 注册了 " + this.keys.length + " 列");
	},

	unregister() {
		for (const k of this.keys) {
			try {
				Zotero.ItemTreeManager.unregisterColumn(k);
			}
			catch (e) { /* 已经没了就算了 */ }
		}
		this.keys = [];
	},

	destroy() {
		this.unregister();
	},

	/* 一个条目的某一列该显示什么。返回的是"排序友好"的字符串，显示时再加工。 */
	value(item, d) {
		let raw = "";
		try {
			if (d.derived) raw = this.derived(item, d.derived);
			else if (d.field) raw = Core.resolveField(item.getField(d.field) || "", d);
		}
		catch (e) {
			return "";
		}
		if (raw === "" && d.fallback !== undefined) raw = String(d.fallback);
		return Core.sortKey(raw, d);
	},

	/* 现成的派生值。要加新的就在这里加一个 case。 */
	derived(item, kind) {
		switch (kind) {
			case "collections": {
				return item.getCollections().map(id => {
					const c = Zotero.Collections.get(id);
					return c ? c.name : "";
				}).filter(Boolean).join(", ");
			}
			case "noteCount":
				return String(item.getNotes().length);
			case "attachmentCount":
				return String(item.getAttachments().length);
			case "readStatus": {
				const m = /Read_Status:\s*([A-Za-z ]+)/.exec(item.getField("extra") || "");
				return m ? m[1].trim() : "";
			}
			case "dateAdded":
				return (item.dateAdded || "").slice(0, 10);
			default:
				return "";
		}
	},

	/* 返回的元素必须自己带上 "cell" + column.className（官方 typedef 里 column 就写的是
	   ItemTreeColumnOptions | {className}）：列宽/溢出/省略号这些样式是按
	   .<dataKey>-<styleKey> 作用在带 cell class 的元素上的，默认渲染路径
	   （virtualized-table.js 的 renderCell）也是这么建的。少了它，拖列宽时内容不跟着变。 */
	render(data, d, column, doc) {
		try {
			const span = doc.createElement("span");
			span.className = "cell " + ((column && column.className) || "");
			span.textContent = Core.display(data, d);
			const color = Core.colorFor(data, d);
			if (color) span.style.color = color;
			if (d.bold) span.style.fontWeight = "600";
			return span;
		}
		catch (e) {
			return null; // 渲染失败就让 Zotero 走默认渲染，别让整行报错
		}
	},
};
