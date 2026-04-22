const STORAGE_KEYS = {
  users: "et.users.v1",
  session: "et.session.v1",
  tx: (userId) => `et.tx.v1.${userId}`,
  budget: (userId) => `et.budget.v1.${userId}`,
  ui: (userId) => `et.ui.v1.${userId}`,
};

const CATEGORIES = [
  "Food",
  "Transport",
  "Utilities",
  "Entertainment",
  "Health",
  "Shopping",
  "Bills",
  "Other",
];

function $(sel) {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatINR(amount) {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `₹${n.toFixed(2)}`;
  }
}

function toISODate(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseMoney(input) {
  const cleaned = String(input).trim().replaceAll(",", "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function safeJsonParse(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function load(key, fallback) {
  return safeJsonParse(localStorage.getItem(key), fallback);
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function hashPassword(pw) {
  // Local-only obfuscation (NOT security). Prevents plain-text casual viewing.
  let h = 2166136261;
  const s = String(pw);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d) {
  const x = startOfDay(d);
  // Monday as first day
  const day = x.getDay(); // 0..6 (Sun..Sat)
  const diff = (day + 6) % 7; // 0 for Mon
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

function startOfYear(d) {
  const x = startOfDay(d);
  x.setMonth(0, 1);
  return x;
}

function isWithinRange(dateISO, range, now = new Date()) {
  const d = startOfDay(new Date(`${dateISO}T00:00:00`));
  const today = startOfDay(now);

  let start;
  if (range === "daily") start = today;
  else if (range === "weekly") start = startOfWeek(today);
  else if (range === "monthly") start = startOfMonth(today);
  else start = startOfYear(today);

  return d.getTime() >= start.getTime() && d.getTime() <= today.getTime();
}

function daysBetweenInclusive(fromISO, toISO) {
  const a = startOfDay(new Date(`${fromISO}T00:00:00`));
  const b = startOfDay(new Date(`${toISO}T00:00:00`));
  const diff = Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
  return diff + 1;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function createToast(el) {
  let t = null;
  return {
    show(msg, ms = 2400) {
      el.textContent = msg;
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => {
        el.textContent = "";
      }, ms);
    },
  };
}

// ---------- Auth ----------

function getUsers() {
  return load(STORAGE_KEYS.users, []);
}

function setUsers(users) {
  save(STORAGE_KEYS.users, users);
}

function getSession() {
  return load(STORAGE_KEYS.session, null);
}

function setSession(session) {
  save(STORAGE_KEYS.session, session);
}

function logout() {
  setSession(null);
  bootstrap();
}

function requireSession() {
  const s = getSession();
  if (!s?.userId) return null;
  return s;
}

function findUserByEmail(email) {
  const users = getUsers();
  return users.find((u) => u.email === email) ?? null;
}

function createUser(email, password) {
  const users = getUsers();
  const user = { id: uid(), email, pwHash: hashPassword(password), createdAt: Date.now() };
  users.push(user);
  setUsers(users);
  return user;
}

// ---------- Data ----------

function getTx(userId) {
  return load(STORAGE_KEYS.tx(userId), []);
}

function setTx(userId, txs) {
  save(STORAGE_KEYS.tx(userId), txs);
}

function getBudget(userId) {
  return load(STORAGE_KEYS.budget(userId), null);
}

function setBudget(userId, budget) {
  save(STORAGE_KEYS.budget(userId), budget);
}

function getUI(userId) {
  return load(STORAGE_KEYS.ui(userId), { range: "daily" });
}

function setUI(userId, ui) {
  save(STORAGE_KEYS.ui(userId), ui);
}

// ---------- UI ----------

const toast = createToast($("#toast"));
const authToast = createToast($("#authToast"));
const authToast2 = createToast($("#authToast2"));

function setAuthedView(isAuthed) {
  const app = $("#app");
  const auth = $("#auth");
  app.setAttribute("aria-hidden", String(!isAuthed));
  app.style.display = isAuthed ? "block" : "none";
  auth.style.display = isAuthed ? "none" : "grid";
}

function fillCategories() {
  const sel = $("#category");
  sel.innerHTML = CATEGORIES.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

function setActiveRange(range) {
  document.querySelectorAll(".seg__btn").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.range === range);
  });
  $("#summaryRangeLabel").textContent = range[0].toUpperCase() + range.slice(1);
}

function setDefaultDates() {
  const today = toISODate(new Date());
  $("#date").value = today;
  $("#budgetStart").value = today;
  $("#budgetFrom").value = today;
  $("#budgetTo").value = today;
}

function renderTransactions(userId, range) {
  const all = getTx(userId);
  const txs = all
    .filter((t) => isWithinRange(t.date, range))
    .sort((a, b) => b.createdAt - a.createdAt);

  const list = $("#txList");
  if (txs.length === 0) {
    list.innerHTML = `<div class="empty">No transactions in this range.</div>`;
    return { txs, total: 0 };
  }

  list.innerHTML = txs
    .map((t) => {
      return `
        <div class="row" data-id="${escapeHtml(t.id)}">
          <div title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>
          <div><span class="tag">${escapeHtml(t.category)}</span></div>
          <div>${escapeHtml(t.date)}</div>
          <div class="right">${escapeHtml(formatINR(t.amount))}</div>
          <div class="right"><button class="danger" type="button" data-del="${escapeHtml(t.id)}">Delete</button></div>
        </div>
      `;
    })
    .join("");

  const total = txs.reduce((s, t) => s + t.amount, 0);
  return { txs, total };
}

function renderSummary({ txs, total }) {
  $("#totalSpent").textContent = formatINR(total);
  $("#txCount").textContent = String(txs.length);

  const byCat = new Map(CATEGORIES.map((c) => [c, 0]));
  txs.forEach((t) => byCat.set(t.category, (byCat.get(t.category) || 0) + t.amount));

  const bars = $("#categoryBars");
  const max = Math.max(1, ...Array.from(byCat.values()));
  const rows = Array.from(byCat.entries())
    .filter(([, amt]) => amt > 0 || total === 0)
    .sort((a, b) => b[1] - a[1]);

  if (total === 0) {
    bars.innerHTML = `<div class="empty">Add a transaction to see category breakdown.</div>`;
    return;
  }

  bars.innerHTML = rows
    .map(([cat, amt]) => {
      const pct = total > 0 ? (amt / total) * 100 : 0;
      const w = clamp((amt / max) * 100, 0, 100);
      return `
        <div class="bar">
          <div class="bar__top">
            <div class="bar__name">${escapeHtml(cat)}</div>
            <div class="bar__pct">${pct.toFixed(1)}%</div>
          </div>
          <div class="bar__track"><div class="bar__fill" style="width:${w.toFixed(2)}%"></div></div>
          <div class="bar__meta">
            <div>${escapeHtml(formatINR(amt))}</div>
            <div>${Math.round(pct)}% share</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function txTotalInDateRange(userId, fromISO, toISO) {
  const all = getTx(userId);
  const from = startOfDay(new Date(`${fromISO}T00:00:00`)).getTime();
  const to = startOfDay(new Date(`${toISO}T00:00:00`)).getTime();
  return all.reduce((sum, t) => {
    const d = startOfDay(new Date(`${t.date}T00:00:00`)).getTime();
    if (d >= from && d <= to) return sum + t.amount;
    return sum;
  }, 0);
}

function txTotalForDay(userId, dayISO) {
  const all = getTx(userId);
  return all.reduce((sum, t) => (t.date === dayISO ? sum + t.amount : sum), 0);
}

function renderBudgetInsights(userId) {
  const box = $("#budgetInsights");
  const b = getBudget(userId);
  if (!b) {
    box.innerHTML = `<div class="empty">No budget set.</div>`;
    return;
  }

  const todayISO = toISODate(new Date());
  const now = new Date();

  const startISO = b.startISO;
  const endISO = b.endISO;
  const totalDays = daysBetweenInclusive(startISO, endISO);
  const elapsedDays = daysBetweenInclusive(startISO, clampISO(todayISO, startISO, endISO));
  const remainingDays = Math.max(1, totalDays - elapsedDays + 1);

  const spentSoFar = txTotalInDateRange(userId, startISO, clampISO(todayISO, startISO, endISO));
  const remaining = Math.max(0, b.amount - spentSoFar);

  const suggestedDaily = remaining / remainingDays;
  const spentToday = txTotalForDay(userId, todayISO);
  const todayStatus =
    spentToday > suggestedDaily
      ? { label: "Over today", cls: "pill pill--danger" }
      : { label: "Within today", cls: "pill pill--ok" };

  const endsInPast = startOfDay(new Date(`${endISO}T00:00:00`)).getTime() < startOfDay(now).getTime();
  const statusPill = endsInPast
    ? `<span class="pill pill--danger">Ended</span>`
    : `<span class="${todayStatus.cls}">${todayStatus.label}</span>`;

  box.innerHTML = `
    <div class="insight">
      <div class="insight__k">Budget</div>
      <div class="insight__v">${escapeHtml(formatINR(b.amount))}</div>
    </div>
    <div class="insight">
      <div class="insight__k">Period</div>
      <div class="insight__v">${escapeHtml(startISO)} → ${escapeHtml(endISO)}</div>
    </div>
    <div class="insight">
      <div class="insight__k">Spent so far</div>
      <div class="insight__v">${escapeHtml(formatINR(spentSoFar))}</div>
    </div>
    <div class="insight">
      <div class="insight__k">Remaining</div>
      <div class="insight__v">${escapeHtml(formatINR(remaining))}</div>
    </div>
    <div class="insight">
      <div class="insight__k">Suggested per day</div>
      <div class="insight__v">${escapeHtml(formatINR(suggestedDaily))}</div>
    </div>
    <div class="insight">
      <div class="insight__k">Today</div>
      <div class="insight__v">${statusPill}</div>
    </div>
  `;
}

function clampISO(v, minISO, maxISO) {
  const t = startOfDay(new Date(`${v}T00:00:00`)).getTime();
  const a = startOfDay(new Date(`${minISO}T00:00:00`)).getTime();
  const b = startOfDay(new Date(`${maxISO}T00:00:00`)).getTime();
  if (t < a) return minISO;
  if (t > b) return maxISO;
  return v;
}

function renderAll(userId) {
  const ui = getUI(userId);
  setActiveRange(ui.range);
  const { txs, total } = renderTransactions(userId, ui.range);
  renderSummary({ txs, total });
  renderBudgetInsights(userId);
}

// ---------- Events ----------

function currentUserId() {
  return requireSession()?.userId ?? null;
}

function wireAuth() {
  const tabBtns = Array.from(document.querySelectorAll("[data-auth-tab]"));
  const forms = Array.from(document.querySelectorAll("[data-auth-form]"));

  function setTab(tab) {
    tabBtns.forEach((b) => b.classList.toggle("is-active", b.dataset.authTab === tab));
    forms.forEach((f) => f.classList.toggle("is-hidden", f.dataset.authForm !== tab));
  }

  tabBtns.forEach((b) => {
    b.addEventListener("click", () => setTab(b.dataset.authTab));
  });

  $("#signupForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim().toLowerCase();
    const password = String(fd.get("password") || "");

    if (!email || !email.includes("@")) return authToast2.show("Enter a valid email.");
    if (password.length < 6) return authToast2.show("Password must be at least 6 characters.");
    if (findUserByEmail(email)) return authToast2.show("Account already exists. Please login.");

    const user = createUser(email, password);
    setSession({ userId: user.id });
    authToast2.show("Account created. Logging in…", 1200);
    window.setTimeout(bootstrap, 450);
  });

  $("#loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim().toLowerCase();
    const password = String(fd.get("password") || "");

    const user = findUserByEmail(email);
    if (!user) return authToast.show("No account found. Please sign up.");
    if (user.pwHash !== hashPassword(password)) return authToast.show("Incorrect password.");

    setSession({ userId: user.id });
    authToast.show("Logged in.", 1200);
    window.setTimeout(bootstrap, 350);
  });
}

function wireApp() {
  $("#logoutBtn").addEventListener("click", logout);

  document.querySelectorAll(".seg__btn").forEach((b) => {
    b.addEventListener("click", () => {
      const userId = currentUserId();
      if (!userId) return;
      const ui = getUI(userId);
      ui.range = b.dataset.range;
      setUI(userId, ui);
      renderAll(userId);
    });
  });

  $("#expenseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const userId = currentUserId();
    if (!userId) return bootstrap();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") || "").trim();
    const amount = parseMoney(fd.get("amount"));
    const date = String(fd.get("date") || "").trim();
    const category = String(fd.get("category") || "").trim();

    if (!title) return toast.show("Please add a title.");
    if (amount == null) return toast.show("Please enter a valid amount (> 0).");
    if (!date) return toast.show("Please select a date.");
    if (!category) return toast.show("Please select a category.");

    const txs = getTx(userId);
    txs.push({ id: uid(), title, amount, date, category, createdAt: Date.now() });
    setTx(userId, txs);

    $("#title").value = "";
    $("#amount").value = "";
    $("#category").value = CATEGORIES[0];
    $("#date").value = toISODate(new Date());

    toast.show("Added.");
    renderAll(userId);
  });

  $("#txList").addEventListener("click", (e) => {
    const userId = currentUserId();
    if (!userId) return bootstrap();
    const btn = e.target?.closest?.("[data-del]");
    if (!btn) return;
    const id = btn.getAttribute("data-del");
    const txs = getTx(userId);
    const next = txs.filter((t) => t.id !== id);
    setTx(userId, next);
    toast.show("Deleted.");
    renderAll(userId);
  });

  $("#clearAllBtn").addEventListener("click", () => {
    const userId = currentUserId();
    if (!userId) return bootstrap();
    const ok = window.confirm("This will delete ALL transactions and budget for this account. Continue?");
    if (!ok) return;
    setTx(userId, []);
    setBudget(userId, null);
    toast.show("Cleared.");
    renderAll(userId);
  });

  // Budget UI toggles
  function syncBudgetMode() {
    const mode = document.querySelector('input[name="budgetMode"]:checked')?.value || "days";
    $("#budgetDaysRow").classList.toggle("is-hidden", mode !== "days");
    $("#budgetRangeRow").classList.toggle("is-hidden", mode !== "range");
    if (mode === "days") {
      $("#budgetStart").setAttribute("required", "required");
      $("#budgetDays").setAttribute("required", "required");
      $("#budgetFrom").removeAttribute("required");
      $("#budgetTo").removeAttribute("required");
    } else {
      $("#budgetFrom").setAttribute("required", "required");
      $("#budgetTo").setAttribute("required", "required");
      $("#budgetStart").removeAttribute("required");
      $("#budgetDays").removeAttribute("required");
    }
  }
  document.querySelectorAll('input[name="budgetMode"]').forEach((r) => r.addEventListener("change", syncBudgetMode));
  syncBudgetMode();

  $("#budgetForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const userId = currentUserId();
    if (!userId) return bootstrap();
    const fd = new FormData(e.currentTarget);
    const amount = parseMoney(fd.get("budgetAmount"));
    const mode = String(fd.get("budgetMode") || "days");

    if (amount == null) return toast.show("Enter a valid budget amount (> 0).");

    let startISO;
    let endISO;
    if (mode === "days") {
      startISO = String(fd.get("budgetStart") || "").trim();
      const daysRaw = String(fd.get("budgetDays") || "").trim();
      const days = Number(daysRaw);
      if (!startISO) return toast.show("Select budget start date.");
      if (!Number.isFinite(days) || days < 1 || days > 3660) return toast.show("Days must be between 1 and 3660.");
      const start = startOfDay(new Date(`${startISO}T00:00:00`));
      const end = new Date(start);
      end.setDate(end.getDate() + (Math.floor(days) - 1));
      endISO = toISODate(end);
    } else {
      startISO = String(fd.get("budgetFrom") || "").trim();
      endISO = String(fd.get("budgetTo") || "").trim();
      if (!startISO || !endISO) return toast.show("Select budget date range.");
      if (startOfDay(new Date(`${endISO}T00:00:00`)).getTime() < startOfDay(new Date(`${startISO}T00:00:00`)).getTime()) {
        return toast.show("End date must be after start date.");
      }
    }

    setBudget(userId, { amount, startISO, endISO, createdAt: Date.now() });
    toast.show("Budget saved.");
    renderAll(userId);
  });

  $("#clearBudgetBtn").addEventListener("click", () => {
    const userId = currentUserId();
    if (!userId) return bootstrap();
    setBudget(userId, null);
    toast.show("Budget removed.");
    renderAll(userId);
  });
}

// ---------- Bootstrap ----------

function bootstrap() {
  const session = requireSession();
  if (!session) {
    setAuthedView(false);
    return;
  }

  const userId = session.userId;
  setAuthedView(true);

  // One-time fill and defaults
  fillCategories();
  setDefaultDates();

  renderAll(userId);
}

// Entry
if (!window.__etWiredAuth) {
  wireAuth();
  window.__etWiredAuth = true;
}
if (!window.__etWiredApp) {
  wireApp();
  window.__etWiredApp = true;
}
bootstrap();

