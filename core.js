/* 纯逻辑层：不依赖 Zotero，可用 `node core.test.js` 直接自检。
   三件事：按正则从字段值里取值 → 生成排序友好的字符串 → 决定显示文本与颜色。 */

(function (factory) {
	const api = factory();
	if (typeof module === "object" && module.exports) module.exports = api; // node
	else globalThis.CustomColumnsCore = api;                                // Zotero 沙箱
})(function () {

	/* 补零。Zotero 条目列表的列排序是**字符串**排序，不补零会出现 10 排在 8 前面。
	   只处理非负整数（分数、计数），这是本插件的唯一用途。 */
	function pad(num, width) {
		const w = width || 6;
		const s = String(num);
		return s.length >= w ? s : "0".repeat(w - s.length) + s;
	}

	/* 从字段值里取值。无 regex → 整字段 trim；有 regex → 取捕获组（默认第 1 组）。 */
	function resolveField(value, def) {
		const src = value == null ? "" : String(value);
		if (!def || !def.regex) return src.trim();
		let re;
		try {
			re = new RegExp(def.regex, def.flags || "m");
		}
		catch (e) {
			return ""; // 配置里正则写错，只让这一列为空，不炸掉整棵树
		}
		const m = re.exec(src);
		if (!m) return "";
		const g = def.group === undefined ? 1 : def.group;
		const got = m[g];
		return (got === undefined ? m[0] : got).trim();
	}

	/* 喂给 item tree 的值：数字列补零，其余原样。 */
	function sortKey(value, def) {
		if (!def || !def.numeric) return value == null ? "" : String(value);
		const n = parseFloat(value);
		return isNaN(n) ? "" : pad(n, def.padWidth);
	}

	/* 单元格显示文本：数字列去掉补的零。 */
	function display(value, def) {
		if (!def || !def.numeric) return value == null ? "" : String(value);
		return String(value).replace(/^0+(?=\d)/, "");
	}

	/* 可选着色：配了 color，且（没配 min 或 数值 >= min）时生效。 */
	function colorFor(value, def) {
		if (!def || !def.color) return "";
		if (def.min === undefined) return def.color;
		const n = parseFloat(display(value, def));
		return (!isNaN(n) && n >= def.min) ? def.color : "";
	}

	/* 配置规范化：丢掉没有 label 或没有取值方式的行。 */
	function normalize(cfg) {
		const cols = ((cfg && cfg.columns) || []).filter(d => d && d.label && (d.field || d.derived));
		return cols.map((d, i) => Object.assign({}, d, { _index: i }));
	}

	return { pad, resolveField, sortKey, display, colorFor, normalize };
});
