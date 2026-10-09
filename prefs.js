/* 设置界面：列的可视化编辑器。只管 DOM 和 JSON，不碰 item tree 内部。
   注意：这里的全局与插件沙箱不是同一个，所以不用 CustomColumnsCore，只用挂在 Zotero 下的接口。 */
"use strict";

const CC_XHTML_NS = "http://www.w3.org/1999/xhtml";

/* 界面文案。带参数的写成函数。日志（写进 custom-columns.log 的那些）不走这里。 */
const CC_STR = {
	zh: {
		hint: "自定义列 —— 每一列由「取哪个字段 / 用哪个派生值 + 正则提取 + 显示方式」定义。",
		langLabel: "语言",
		add: "＋ 新增列",
		save: "保存并应用",
		footLabel: "配置文件：",
		name: "名称",
		kind: "取值方式",
		optField: "字段",
		optDerived: "派生",
		srcField: "字段名",
		srcDerived: "派生值",
		regex: "正则",
		numeric: "数字排序",
		width: "宽度",
		color: "颜色",
		min: "阈值",
		bold: "加粗",
		desc: "默认降序",
		show: "默认显示",
		up: "上移",
		down: "下移",
		del: "删除",
		added: "加了一列，填完点「保存并应用」",
		readFail: (m) => "读取配置失败：" + m,
		loaded: (n) => `已载入 ${n} 列`,
		empty: "还没有列，点「新增列」",
		delConfirm: "删除这一列？（点「保存并应用」后才落到配置里）",
		deleted: "删了一列，记得点「保存并应用」",
		rowAt: (i) => `第 ${i + 1} 行`,
		errNoName: (at) => `${at}缺名称`,
		errNoSrc: (at, label, what) => `${at}（${label}）没填${what}`,
		errBadDerived: (at, label, src) => `${at}（${label}）没有这个派生值：${src}`,
		errBadRegex: (at, label, msg) => `${at}（${label}）正则无效：${msg}`,
		join: "；",
		notSaved: (errs) => "没有保存 —— " + errs,
		emptySave: "列表里一列都没有，仍要保存成空配置吗？",
		cancelled: "已取消保存",
		saved: (n) => `已保存并应用 ${n} 列，条目列表里应已出现`,
		saveFail: (m) => "保存失败：" + m,
	},
	en: {
		hint: "Each column is defined by its source (a field or a derived value), an optional regex extraction, and how it is displayed.",
		langLabel: "Language",
		add: "＋ Add column",
		save: "Save & apply",
		footLabel: "Config file: ",
		name: "Name",
		kind: "Source",
		optField: "Field",
		optDerived: "Derived",
		srcField: "Field name",
		srcDerived: "Derived value",
		regex: "Regex",
		numeric: "Numeric sort",
		width: "Width",
		color: "Color",
		min: "Min",
		bold: "Bold",
		desc: "Descending by default",
		show: "Visible by default",
		up: "Move up",
		down: "Move down",
		del: "Delete",
		added: "Column added — fill it in, then click Save & apply",
		readFail: (m) => "Failed to read the config: " + m,
		loaded: (n) => `Loaded ${n} column(s)`,
		empty: "No columns yet — click “Add column”",
		delConfirm: "Delete this column? (it only takes effect after Save & apply)",
		deleted: "Column removed — remember to click Save & apply",
		rowAt: (i) => `Row ${i + 1}`,
		errNoName: (at) => `${at}: name is missing`,
		errNoSrc: (at, label, what) => `${at} (${label}): ${what} is missing`,
		errBadDerived: (at, label, src) => `${at} (${label}): unknown derived value “${src}”`,
		errBadRegex: (at, label, msg) => `${at} (${label}): invalid regex — ${msg}`,
		join: "; ",
		notSaved: (errs) => "Not saved — " + errs,
		emptySave: "There are no columns in the list. Save an empty config anyway?",
		cancelled: "Save cancelled",
		saved: (n) => `Saved and applied ${n} column(s) — they should be in the item list now`,
		saveFail: (m) => "Save failed: " + m,
	},
};

const CC_LANG_PREF = "customColumns.lang";

Zotero_Preferences.CustomColumns = {
	_inited: false,
	lang: "zh",

	async init() {
		if (this._inited) {
			return;
		}
		this._inited = true;
		this.rows = document.getElementById("cc-rows");
		this.doc = document;
		/* 语言：存过就用存的，没存过跟 Zotero 界面语言走 */
		this.lang = Zotero.Prefs.get(CC_LANG_PREF)
			|| (String(Zotero.locale || "").toLowerCase().startsWith("zh") ? "zh" : "en");
		/* 面板里的异常不会有任何提示，接住它们写进日志（带调用栈，能直接指到行号） */
		window.addEventListener("error", (e) => this.log(
			"未捕获异常: " + (e.error && e.error.stack ? e.error.stack : e.message)
			+ " @" + (e.filename || "?") + ":" + (e.lineno || "?")));
		this.log("init 开始 (lang=" + this.lang + ")");
		const dl = document.getElementById("cc-derived");
		for (const v of Zotero.CustomColumns.DERIVED) {
			dl.appendChild(this.el("option", { value: v }));
		}
		document.getElementById("cc-add").addEventListener("click", () => {
			this.appendRow({ label: "", field: "extra" });
			this.status(this.t("added"));
		});
		document.getElementById("cc-save").addEventListener("click", () => this.save());
		const langSel = document.getElementById("cc-lang");
		langSel.value = this.lang;
		langSel.addEventListener("change", () => this.setLang(langSel.value));
		this.applyLabels();
		await this.reload();
	},

	/* 取当前语言的文案 */
	t(key, ...args) {
		const s = (CC_STR[this.lang] || CC_STR.zh)[key];
		return typeof s === "function" ? s(...args) : s;
	},

	/* 切换语言：存 pref → 换静态文案 → 重建各行（行里的文案也要跟着换） */
	async setLang(lang) {
		this.lang = CC_STR[lang] ? lang : "zh";
		Zotero.Prefs.set(CC_LANG_PREF, this.lang);
		this.applyLabels();
		await this.reload();
		this.log("语言切到 " + this.lang);
	},

	/* 静态部分的文案（xhtml 里留空的那几个 + 按钮 + 配置路径） */
	applyLabels() {
		document.getElementById("cc-hint").textContent = this.t("hint");
		document.getElementById("cc-lang-label").textContent = this.t("langLabel");
		document.getElementById("cc-add").textContent = this.t("add");
		document.getElementById("cc-save").textContent = this.t("save");
		document.getElementById("cc-foot-label").textContent = this.t("footLabel");
		document.getElementById("cc-path").textContent = Zotero.CustomColumns.configPath();
	},

	/* 建元素一律走这里：createElementNS + appendChild，不经过任何解析器。
	   面板是 XHTML(=XML) 文档，innerHTML 要过 XML 解析器，命名空间/自闭合稍有闪失就
	   静默失败（两种都踩过一次），所以这里不留那个口子。 */
	el(tag, attrs, ...kids) {
		const e = this.mk(tag);
		const a = attrs || {};
		for (const k of Object.keys(a)) {
			e.setAttribute(k, a[k]);
		}
		for (const kid of kids) {
			e.appendChild(typeof kid === "string" ? this.doc.createTextNode(kid) : kid);
		}
		return e;
	},

	/* 诊断日志统一走 columns.js 那份实现（同一时刻只有一个写者，不会互相覆盖） */
	log(msg) {
		Zotero.CustomColumns.log(msg);
	},

	async reload() {
		let cols = [];
		try {
			cols = (await Zotero.CustomColumns.readConfig()).columns || [];
		}
		catch (e) {
			this.status(this.t("readFail", e.message), true);
			this.log("reload 失败: " + e.message);
		}
		this.rows.replaceChildren();
		for (const c of cols) {
			this.appendRow(c);
		}
		this.status(cols.length ? this.t("loaded", cols.length) : this.t("empty"));
		this.log("reload 完成: 配置里 " + cols.length + " 列, 界面 " + this.rows.childElementCount + " 行");
	},

	mk(tag, cls) {
		const el = document.createElementNS(CC_XHTML_NS, tag);
		if (cls) {
			el.className = cls;
		}
		return el;
	},

	appendRow(d) {
		const row = this.mk("div", "cc-row");
		/* 一律用 DOM API 建元素，不用 innerHTML（原因见 el()） */
		const inp = (cls, attrs) => this.el("input", Object.assign({ class: cls }, attrs || {}));
		const box = (cls) => this.el("input", { type: "checkbox", class: cls });

		const line1 = this.mk("div", "cc-line");
		line1.appendChild(this.el("label", {}, this.t("name") + " ",
			inp("cc-label", { size: 10, value: d.label || "" })));
		const kindSel = this.el("select", { class: "cc-kind" },
			this.el("option", { value: "field" }, this.t("optField")),
			this.el("option", { value: "derived" }, this.t("optDerived")));
		kindSel.value = d.derived ? "derived" : "field";
		line1.appendChild(this.el("label", {}, this.t("kind") + " ", kindSel));
		line1.appendChild(this.el("label", {},
			this.el("span", { class: "cc-src-title" }, this.t("srcField")), " ",
			inp("cc-src", { list: "cc-derived", size: 18, value: d.derived || d.field || "" })));
		line1.appendChild(this.el("label", { class: "cc-regex-label" }, this.t("regex") + " ",
			inp("cc-regex", { size: 30, value: d.regex || "" })));

		const line2 = this.mk("div", "cc-line");
		line2.appendChild(this.el("label", {}, box("cc-numeric"), " " + this.t("numeric")));
		line2.appendChild(this.el("label", {}, this.t("width") + " ",
			inp("cc-width", { type: "number", min: 20, max: 600 })));
		line2.appendChild(this.el("label", {}, this.t("color") + " ",
			inp("cc-color", { size: 8, placeholder: "#1a7f37" })));
		line2.appendChild(this.el("label", {}, this.t("min") + " ",
			inp("cc-min", { type: "number" })));
		line2.appendChild(this.el("label", {}, box("cc-bold"), " " + this.t("bold")));
		line2.appendChild(this.el("label", {}, box("cc-desc"), " " + this.t("desc")));
		line2.appendChild(this.el("label", {}, box("cc-show"), " " + this.t("show")));
		line2.appendChild(this.el("span", { class: "cc-btns" },
			this.el("button", { class: "cc-up", title: this.t("up") }, "↑"),
			this.el("button", { class: "cc-down", title: this.t("down") }, "↓"),
			this.el("button", { class: "cc-del" }, this.t("del"))));

		row.appendChild(line1);
		row.appendChild(line2);
		this.log("appendRow 建好行: rows=" + (this.rows ? this.rows.childElementCount : "-")
			+ " 行命名空间=" + (line1.namespaceURI || "无") + " 输入框=" + row.querySelectorAll("input").length);

		const q = (sel) => row.querySelector(sel);
		q(".cc-kind").value = d.derived ? "derived" : "field";
		q(".cc-numeric").checked = !!d.numeric;
		if (d.width) {
			q(".cc-width").value = d.width;
		}
		q(".cc-color").value = d.color || "";
		if (d.min !== undefined) {
			q(".cc-min").value = d.min;
		}
		q(".cc-bold").checked = !!d.bold;
		q(".cc-desc").checked = !!d.descending;
		q(".cc-show").checked = d.show !== false;
		q(".cc-kind").addEventListener("change", () => this.syncRow(row));
		this.syncRow(row);

		q(".cc-del").addEventListener("click", () => {
			if (!confirm(this.t("delConfirm"))) {
				return;
			}
			row.remove();
			this.status(this.t("deleted"));
		});
		q(".cc-up").addEventListener("click", () => {
			const prev = row.previousElementSibling;
			if (prev) {
				this.rows.insertBefore(row, prev);
			}
		});
		q(".cc-down").addEventListener("click", () => {
			const next = row.nextElementSibling;
			if (next) {
				this.rows.insertBefore(next, row);
			}
		});

		this.rows.appendChild(row);
	},

	/* 派生值没有正则；切到派生时把正则框禁掉，免得填了不生效还不知道为什么 */
	syncRow(row) {
		const derived = row.querySelector(".cc-kind").value === "derived";
		row.querySelector(".cc-regex").disabled = derived;
		row.querySelector(".cc-regex-label").style.opacity = derived ? "0.4" : "1";
		row.querySelector(".cc-src-title").textContent = this.t(derived ? "srcDerived" : "srcField");
	},

	/* 从 DOM 读回配置。校验失败的行不进 columns，并把原因攒起来告诉用户。 */
	collect() {
		const columns = [];
		const errors = [];
		const rows = [...this.rows.querySelectorAll(".cc-row")];
		rows.forEach((row, i) => {
			const q = (sel) => row.querySelector(sel);
			const at = this.t("rowAt", i);
			const label = q(".cc-label").value.trim();
			const kind = q(".cc-kind").value;
			const src = q(".cc-src").value.trim();
			if (!label) {
				errors.push(this.t("errNoName", at));
				return;
			}
			if (!src) {
				errors.push(this.t("errNoSrc", at, label,
					this.t(kind === "derived" ? "srcDerived" : "srcField")));
				return;
			}
			const d = { label };
			if (kind === "derived") {
				if (!Zotero.CustomColumns.DERIVED.includes(src)) {
					errors.push(this.t("errBadDerived", at, label, src));
					return;
				}
				d.derived = src;
			}
			else {
				d.field = src;
				const regex = q(".cc-regex").value.trim();
				if (regex) {
					try {
						new RegExp(regex);
					}
					catch (e) {
						errors.push(this.t("errBadRegex", at, label, e.message));
						return;
					}
					d.regex = regex;
				}
			}
			if (q(".cc-numeric").checked) {
				d.numeric = true;
			}
			const width = parseInt(q(".cc-width").value, 10);
			if (width > 0) {
				d.width = width;
			}
			const color = q(".cc-color").value.trim();
			if (color) {
				d.color = color;
			}
			const min = q(".cc-min").value.trim();
			if (min !== "" && !isNaN(parseInt(min, 10))) {
				d.min = parseInt(min, 10);
			}
			if (q(".cc-bold").checked) {
				d.bold = true;
			}
			if (q(".cc-desc").checked) {
				d.descending = true;
			}
			if (!q(".cc-show").checked) {
				d.show = false;
			}
			columns.push(d);
		});
		return { columns, errors };
	},

	async save() {
		const { columns, errors } = this.collect();
		if (errors.length) {
			this.status(this.t("notSaved", errors.join(this.t("join"))), true);
			return;
		}
		/* 列全被删/模板没渲染出来时，别让一次点击把配置清空 */
		if (!columns.length && !confirm(this.t("emptySave"))) {
			this.status(this.t("cancelled"));
			return;
		}
		try {
			await Zotero.CustomColumns.writeConfig({ columns });
			this.status(this.t("saved", columns.length));
		}
		catch (e) {
			this.status(this.t("saveFail", e.message), true);
		}
	},

	status(msg, isError) {
		const el = document.getElementById("cc-status");
		el.textContent = msg || "";
		el.classList.toggle("cc-err", !!isError);
	},
};
