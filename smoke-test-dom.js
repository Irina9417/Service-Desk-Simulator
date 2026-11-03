const fs = require("fs");
const vm = require("vm");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync("index.html", "utf8");
const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" });
const { window } = dom;
const doc = window.document;

// Инжектируем скрипты в body (на случай DOMContentLoaded)
const allJs = ["js/data.js", "js/utils.js", "js/app.js", "js/test.js"]
  .map(f => fs.readFileSync(f, "utf8"))
  .join("\n;\n");

// Исполняем код в контексте, где document = jsdom document, и все объявления
// живут в одном lexical scope (как в <script>)
const sandbox = {
  window,
  document: doc,
  navigator: window.navigator,
  location: window.location,
  alert: () => {},
  confirm: () => true,
  prompt: () => "",
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  JSON,
  Math,
  Date,
  Set,
  Map,
  Array,
  Object,
  String,
  Number,
  Boolean,
  RegExp,
  Error,
  parseInt,
  parseFloat,
  isNaN,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(allJs, sandbox, { filename: "game.js" });

// Доступ к переменным из хоста
sandbox.__bridge = { get: (name) => vm.runInContext(name, sandbox) };
const ev = (code) => vm.runInContext(code, sandbox);

let fail = 0;
const err = (m) => { console.error("FAIL:", m); fail++; };

// DOMContentLoaded: init() уже зарегистрирован, шлём событие
doc.dispatchEvent(new window.Event("DOMContentLoaded", { bubbles: true }));

// Старт: уровень 1 -> 2 -> 3
doc.getElementById("btn-start").click();
doc.getElementById("btn-next-level-1").click();
ev("hideModal('modal-l2-intro')");
doc.getElementById("btn-next-level-2").click();
ev("hideModal('modal-l3-intro')");

if (!doc.getElementById("screen-queue-l3").classList.contains("active")) err("не открыт экран очереди L3");

const tickets = ev("TICKETS_L3");
// Прогон всех тикетов
for (const t of tickets) {
  ev(`openL3Work('${t.id}')`);
  ev("l3RequestClarify()");

  ev(`document.getElementById('l3-root').value = ${JSON.stringify("причина: " + t.rootKeywords.join(", "))}`);
  ev(`document.getElementById('l3-workaround').value = '${t.workaroundCorrect}'`);
  ev(`document.getElementById('l3-radical').value = '${t.radicalCorrect}'`);
  ev(`document.getElementById('l3-outcome').value = '${t.outcome.correct}'`);
  ev("onL3Outcome()");
  if (t.problem) {
    ev(`
      document.querySelectorAll('.l3-prob-inc-check').forEach(c => c.checked = true);
      document.getElementById('l3-prob-impact').value = ${JSON.stringify(t.problem.impact)};
      document.getElementById('l3-prob-prob').value = ${JSON.stringify(t.problem.prob)};
      document.getElementById('l3-prob-owner').value = ${JSON.stringify(t.problem.owner)};
      document.getElementById('l3-prob-method').value = ${JSON.stringify(t.problem.method)};
      document.getElementById('l3-prob-rfc').value = (PROBLEMS.find(p => p.id === ${JSON.stringify(t.problem.record)}).rfc);
    `);
  }
  if (t.problem) {
  ev(`... l3-prob-* ...`);
} else if (t.linkedProblemId) {
  ev(`document.getElementById('l3-problem-link').value = '${t.linkedProblemId}'`);
}
if (t.duplicateOf) ev(`document.getElementById('l3-dup-of').value = '${t.duplicateOf}'`);
  ev("l3Validate()");
  ev("l3Submit()");
  ev("hideModal('modal-reg')");

  const res = ev(`state.resultsL3['${t.id}']`);
  if (!res) err(t.id + ": результат не сохранён");
  else if (!res.ok) {
    err(t.id + ": эталонный ответ не прошёл. Ошибки: " + res.errs.join(", "));
    for (const c of res.comparison) if (c.isError) console.error("   - " + c.field + ": " + c.value + " | нужно: " + c.expected);
  }
}

ev("renderQueue()"); const done = doc.getElementById("q-done-l3").textContent;
if (done !== "10") err("счётчик очереди: " + done + " вместо 10");

doc.getElementById("btn-finish-l3").click();
if (!doc.getElementById("screen-res").classList.contains("active")) err("не открыт экран результатов");
const rows = doc.querySelectorAll("#res-table tbody tr").length;
if (rows !== 10) err("в итоговой таблице строк: " + rows + " вместо 10");
const okCount = doc.querySelectorAll("#res-table .tag.ok").length;
console.log("INFO: 'Успех' в итогах: " + okCount + " / 10");

ev("openProblems()");
const probCards = doc.querySelectorAll("#problems-body > div").length;
if (probCards !== 3) err("карточек проблем: " + probCards + " вместо 3");
ev("hideModal('modal-problems')");

// Негативный тест: сломанный ответ должен ловиться
ev("state.level = 3");
ev(`openL3Work('TK-302')`);
const tk302 = tickets.find(t => t.id === "TK-302");
ev(`document.getElementById('l3-root').value = 'неизвестно'`);
ev(`document.getElementById('l3-workaround').value = '${(tk302.workaroundCorrect + 1) % tk302.workarounds.length}'`);
ev(`document.getElementById('l3-radical').value = '1'`);
ev(`document.getElementById('l3-outcome').value = 'new_problem'`);
ev("onL3Outcome()");
// специально не заполняем блок Problem Record - должно поймать много ошибок
ev("l3Validate()");
ev("l3Submit()");
ev("hideModal('modal-reg')");
const res2 = ev(`state.resultsL3['TK-302']`);
if (!res2 || res2.errs.length < 2) err("негативный тест: сломанный ответ не пойман (errs=" + (res2 ? res2.errs.length : 0) + ")");

// Автотесты L3 (как в игре)
ev("runAutotestsL3()");
ev("hideModal('modal-autotest')");
const atOk = doc.querySelectorAll("#autotest-report-body .tag.ok").length;
const atBad = doc.querySelectorAll("#autotest-report-body .tag.bad").length;
console.log("Автотесты L3: " + atOk + " OK / " + atBad + " BAD (ожидалось 20 OK / 0 BAD)");
if (atBad > 0) err("автотесты L3 провалились: " + atBad + " BAD");

console.log(fail === 0 ? "PASS: все проверки L3 пройдены" : "FAIL: " + fail + " ошибок");
process.exit(fail === 0 ? 0 : 1);

