/* Custom Columns —— Zotero 7+ bootstrap 插件。
   骨架照 Zotero 官方 Make It Red 示例（与 zotero-reading-list 同一种写法）。
   本插件不注册 chrome:// 资源、不改 Zotero 界面结构：只在启动时按配置注册若干自定义列。 */

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
	await Zotero.initializationPromise;

	// Zotero 7 起参数是 rootURI，之前是 resourceURI.spec
	if (!rootURI) rootURI = resourceURI.spec;

	const ctx = { rootURI };
	ctx._globalThis = ctx;

	Services.scriptloader.loadSubScript(rootURI + "core.js", ctx);    // 纯逻辑，可 node 自检
	Services.scriptloader.loadSubScript(rootURI + "columns.js", ctx); // Zotero 侧：读配置 + 注册列

	await Zotero.CustomColumns.init(rootURI);

	// 设置界面（工具 → 设置 → 自定义列）
	await Zotero.PreferencePanes.register({
		pluginID: id,
		src: rootURI + "prefs.xhtml",
		id: "custom-columns-pane",
		label: "自定义列 / Custom Columns",
		scripts: [rootURI + "prefs.js"],
		stylesheets: [rootURI + "prefs.css"],
	});
}

async function onMainWindowLoad({ window }, reason) {}
async function onMainWindowUnload({ window }, reason) {}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
	if (reason === APP_SHUTDOWN) {
		return; // 应用退出，Zotero 自己会按 pluginID 清掉注册的列
	}
	if (typeof Zotero === "undefined") {
		Zotero = Components.classes["@zotero.org/Zotero;1"]
			.getService(Components.interfaces.nsISupports).wrappedJSObject;
	}
	Zotero.CustomColumns?.destroy();
}

function uninstall(data, reason) {}
