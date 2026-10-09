/* node core.test.js —— 纯逻辑自检，无框架，失败即抛。 */
const assert = require("assert");
const C = require("./core.js");

// 1) 正则取值
assert.strictEqual(C.resolveField("Score: 9/10\nRead_Status: New", { regex: "Score:\\s*(\\d+)/10" }), "9");
assert.strictEqual(C.resolveField("Score: 10/10", { regex: "Score:\\s*(\\d+)/10" }), "10");
assert.strictEqual(C.resolveField("没有这一行", { regex: "Score:\\s*(\\d+)/10" }), "");
assert.strictEqual(C.resolveField("  裸字段  ", {}), "裸字段", "无正则应整字段 trim");
assert.strictEqual(C.resolveField("Score: 9/10", { regex: "Score:(\\d+" }), "", "坏正则应为空而不是抛错");
assert.strictEqual(C.resolveField("a=1 b=2", { regex: "b=(\\d+)", group: 1 }), "2");
assert.strictEqual(C.resolveField(null, {}), "");

// 2) 排序键补零——数字列的关键：字符串排序下 10 必须排在 8 之后
const num = { numeric: true };
assert.ok(C.sortKey("10", num) > C.sortKey("8", num), "10 应排在 8 之后");
assert.strictEqual(C.sortKey("9", num), "000009");
assert.strictEqual(C.sortKey("abc", num), "", "非数字给空串");
assert.strictEqual(C.sortKey("2026-10-08", {}), "2026-10-08", "非数字列原样返回");

// 3) 显示去掉补零
assert.strictEqual(C.display(C.sortKey("9", num), num), "9");
assert.strictEqual(C.display(C.sortKey("0", num), num), "0");
assert.strictEqual(C.display("New", {}), "New");

// 4) 颜色阈值
assert.strictEqual(C.colorFor("000009", { numeric: true, color: "#0a0", min: 8 }), "#0a0");
assert.strictEqual(C.colorFor("000007", { numeric: true, color: "#0a0", min: 8 }), "");
assert.strictEqual(C.colorFor("New", { color: "#0a0" }), "#0a0");
assert.strictEqual(C.colorFor("000009", { numeric: true }), "");

// 5) 配置规范化：缺 label 或缺取值方式的行丢掉，并补上稳定序号
const defs = C.normalize({ columns: [{ label: "A", field: "extra" }, { label: "B" }, { field: "x" }, null] });
assert.strictEqual(defs.length, 1);
assert.strictEqual(defs[0]._index, 0);
assert.strictEqual(C.normalize({}).length, 0, "空配置不炸");

console.log("core.js 自检通过（5 组断言）");
