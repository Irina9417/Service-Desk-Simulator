function fillSelect(sel, items) {
  if (!sel) return;
  sel.innerHTML = "";
  const def = document.createElement("option");
  def.value = "";
  def.textContent = "Выберите...";
  sel.appendChild(def);
  for (const it of items) {
    const opt = document.createElement("option");
    opt.value = it.value;
    opt.textContent = it.label;
    sel.appendChild(opt);
  }
}
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}
function showModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}
function hideModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("active");
}
function getOrg(id) { return ORGS.find(o => o.id === id); }
function getContactsByOrg(id) { return CONTACTS.filter(c => c.orgId === id); }
function getCatList(group) { if (!group || !TAX[group]) return []; return TAX[group]; }
function getSubList(group, catName) {
  const list = getCatList(group);
  const c = list.find(x => x.name === catName);
  if (!c) return [];
  return c.subs;
}
function calcPriority(imp, urg) {
  const key = imp + "|" + urg;
  return MATRIX[key] || null;
}
function getOrgVersions(org) {
  if (!org || !org.products) return [];
  return org.products.map(p => ({ name: p.name, ver: p.ver }));
}

// Хелперы для уровней
function getTickets() { return state.level === 1 ? TICKETS : state.level === 2 ? TICKETS_L2 : TICKETS_L3; }
function getResults() { return state.level === 1 ? state.results : state.level === 2 ? state.resultsL2 : state.resultsL3; }
function getTicket(id) { return getTickets().find(x => x.id === id); }