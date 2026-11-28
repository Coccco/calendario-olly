(() => {
  const C = window.CONFIG;
  const $ = (id) => document.getElementById(id);
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY);
  const MAX = 50 * 1024 * 1024;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  if (window.DECOR) DECOR.mount();
  let cal = null;       // il calendario di questo admin: { slug, her_name, signature, intro, code }
  let days = new Map(); // giorno -> riga
  const her = () => (cal && cal.her_name) || "lei";
  let current = null;   // riga in modifica

  // Data di oggi a Roma, "AAAA-MM-GG"
  const romeToday = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const visibleUpTo = () => {
    const t = romeToday();
    return t < "2026-12-01" ? 0 : t > "2026-12-24" ? 24 : Number(t.slice(8));
  };

  // ---------- login ----------
  async function boot() {
    const { data } = await sb.auth.getSession();
    if (data.session) showPanel();
    else if ($("signup").hidden) $("login").hidden = false;
  }

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("login-error").textContent = "";
    const { error } = await sb.auth.signInWithPassword({
      email: $("email").value.trim(), password: $("password").value,
    });
    if (error) return ($("login-error").textContent = "Email o password non corretti.");
    $("login").hidden = true;
    showPanel();
  });

  // ---------- nuovo calendario con invito ----------
  const base = new URL("./", location.href).href;
  const slugify = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
  let slugTouched = false;
  const showSlug = () => ($("u-slug-hint").textContent = $("u-slug").value
    ? `Il suo link sarà ${base}?c=${$("u-slug").value}` : "Solo minuscole, numeri e trattini.");

  $("to-signup").addEventListener("click", () => { $("login").hidden = true; $("signup").hidden = false; });
  $("to-login").addEventListener("click", () => { $("signup").hidden = true; $("login").hidden = false; });
  if (new URLSearchParams(location.search).has("nuovo")) { $("login").hidden = true; $("signup").hidden = false; }
  $("u-her").addEventListener("input", () => { if (!slugTouched) { $("u-slug").value = slugify($("u-her").value); showSlug(); } });
  $("u-slug").addEventListener("input", () => { slugTouched = true; $("u-slug").value = slugify($("u-slug").value); showSlug(); });

  $("signup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("signup-error");
    err.textContent = "";
    const btn = $("u-save");
    btn.disabled = true;
    const email = $("u-email").value.trim(), password = $("u-password").value;
    try {
      const res = await fetch(`${C.SUPABASE_URL}/functions/v1/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: C.SUPABASE_KEY, Authorization: `Bearer ${C.SUPABASE_KEY}` },
        body: JSON.stringify({
          invite: $("u-invite").value, her_name: $("u-her").value, signature: $("u-sign").value,
          slug: $("u-slug").value, code: $("u-code").value, email, password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Qualcosa è andato storto, riprova.");
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error("Calendario creato, ma il login non è riuscito: prova a entrare.");
      $("signup").hidden = true;
      await showPanel();
      toast("Calendario creato 🎉 Ora riempi le caselle!");
    } catch (ex) {
      err.textContent = ex.message;
    } finally {
      btn.disabled = false;
    }
  });

  $("logout").addEventListener("click", async () => {
    await sb.auth.signOut();
    location.reload();
  });

  async function showPanel() {
    $("signup").hidden = true;
    $("panel").hidden = false;
    const { data, error } = await sb.from("calendars").select("*").maybeSingle();
    if (error || !data) return toast("Questo account non ha un calendario: sei admin?");
    cal = data;
    fillSettings();
    const v = visibleUpTo();
    $("today-line").textContent = v === 0
      ? `${her()} non vede ancora nessuna casella: si parte il 1° dicembre.`
      : `Oggi ${her()} può aprire le caselle fino al ${v} dicembre (bordo dorato).`;
    const t = romeToday();
    if (t >= "2026-12-01" && t <= "2026-12-26") $("preview-date").value = t;
    await loadDays();
  }

  // ---------- elenco giorni ----------
  async function loadDays() {
    const { data, error } = await sb.from("days").select("*").eq("calendar", cal.slug).order("day");
    if (error) return toast("Non riesco a leggere i giorni: sei admin?");
    days = new Map(data.map((r) => [r.day, r]));
    renderDays();
  }

  const isFilled = (r) => r && (r.title || r.message || r.link_url || (r.media && r.media.length));

  // Piccole icone a linee per il tipo di contenuto
  const SVG = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  const KIND = {
    text: ["Messaggio", SVG("M5 4h14v16H5zM8 8h8M8 12h8M8 16h5")],
    image: ["Foto", SVG("M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01")],
    video: ["Video", SVG("M3 6h13v12H3zM16 10l5-3v10l-5-3")],
    audio: ["Audio", SVG("M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3")],
    link: ["Link", SVG("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1")],
    voucher: ["Buono", SVG("M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 7v10")],
  };
  const ILL = ["star", "sprig", "gift", "tree", "mug", "candycane", "snowflake", "ornaments", "lantern", "reindeer", "house", "pinecone",
    "stars", "candle", "village", "mountains", "holly", "mug", "tree", "gift", "snowflake", "star", "candle", "ornaments"];

  function kindsOf(r) {
    if (!r) return [];
    const k = [];
    if (r.message) k.push("text");
    for (const t of ["image", "video", "audio", "voucher"]) if ((r.media || []).some((m) => m.type === t)) k.push(t);
    if (r.link_url) k.push("link");
    return k;
  }
  const kindIcons = (r) => kindsOf(r).map((k) => `<i title="${KIND[k][0]}">${KIND[k][1]}</i>`).join("");
  const firstEmpty = () => { for (let d = 1; d <= 24; d++) if (!isFilled(days.get(d))) return d; return 0; };

  function renderDays() {
    const box = $("days"), list = $("days-list"), nl = $("notify-list");
    box.textContent = ""; list.textContent = ""; nl.textContent = "";
    const v = visibleUpTo();
    let ready = 0;
    for (let d = 1; d <= 24; d++) {
      const r = days.get(d);
      const filled = !!isFilled(r);
      if (filled) ready++;
      const files = (r?.media || []).filter((m) => m.path).length;

      // casella nella griglia
      const b = document.createElement("button");
      b.type = "button";
      b.className = "day " + (filled ? "ready" : "empty") + (d <= v ? " visible" : "");
      b.innerHTML = `
        <span class="n">${d}</span>
        <span class="pill">${filled ? "✓ Pronta" : "○ Vuota"}</span>
        <span class="t"></span>
        ${filled ? `<span class="meta">${files ? `<span class="files">${SVG("M7 3h7l4 4v14H7zM14 3v4h4")} ${files} file</span>` : ""}<span class="kinds">${kindIcons(r)}</span></span>` : `<span class="plus" aria-hidden="true">+</span>`}
        <span class="ill">${window.DECOR ? DECOR.icon(ILL[d - 1]) : ""}</span>`;
      b.querySelector(".t").textContent = filled ? (r.title || "(senza titolo)") : "Tocca per riempire";
      b.setAttribute("aria-label", `${d} dicembre, ${filled ? "pronta" : "vuota"}`);
      b.addEventListener("click", () => openEditor(d));
      box.appendChild(b);

      // riga nella lista
      const row = document.createElement("button");
      row.type = "button";
      row.className = "lrow " + (filled ? "ready" : "empty");
      row.innerHTML = `<span class="ln">${d}</span><span class="lt"></span><span class="kinds">${kindIcons(r)}</span><span class="pill">${filled ? "✓ Pronta" : "○ Vuota"}</span>`;
      row.querySelector(".lt").textContent = filled ? (r.title || "(senza titolo)") : "—";
      row.addEventListener("click", () => openEditor(d));
      list.appendChild(row);

      // riga nelle notifiche
      const nr = document.createElement("button");
      nr.type = "button";
      nr.className = "lrow nrow";
      nr.innerHTML = `<span class="ln">${d}</span><span class="lt"><small>ore 8</small><span class="m"></span><small>ore 20</small><span class="e"></span></span>`;
      for (const [cls, val] of [[".m", r?.notify_morning], [".e", r?.notify_evening]]) {
        const n = nr.querySelector(cls);
        n.textContent = val === "-" ? "Spenta" : val || "Messaggio predefinito";
        if (!val || val === "-") n.classList.add("def");
      }
      nr.addEventListener("click", () => openEditor(d));
      nl.appendChild(nr);
    }
    const pct = Math.round((ready / 24) * 100);
    $("st-ready").textContent = ready;
    $("st-todo").textContent = 24 - ready;
    $("pr-pct").textContent = pct + "%";
    $("pr-bar").style.width = pct + "%";
    $("pr-line").textContent = `${ready} ${ready === 1 ? "sorpresa" : "sorprese"} su 24 ${ready === 1 ? "pronta" : "pronte"}`;
    $("continue").textContent = ready === 24 ? "Tutto pronto 🎉 Rivedi le caselle" : "Continua a creare le sorprese →";
  }

  // ---------- schede e viste ----------
  function showTab(name) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    document.querySelectorAll("#panel .pane").forEach((p) => (p.hidden = p.dataset.pane !== name));
    $("view-switch").hidden = name !== "caselle";
  }
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));
  function setView(v) {
    document.querySelectorAll("#view-switch [data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
    $("days").hidden = v !== "grid";
    $("days-list").hidden = v !== "list";
    store.set("admin-vista", v);
  }
  document.querySelectorAll("#view-switch [data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  const go = (tab, field) => { showTab(tab); $(field).focus(); $(field).scrollIntoView({ behavior: "smooth", block: "center" }); };
  $("go-name").addEventListener("click", () => go("grafica", "s-her"));
  $("go-code").addEventListener("click", () => go("impostazioni", "s-code"));
  $("continue").addEventListener("click", () => {
    const d = firstEmpty();
    if (d) openEditor(d);
    else { showTab("caselle"); $("days").scrollIntoView({ behavior: "smooth" }); }
  });
  $("preview-quick").addEventListener("click", () => $("preview-btn").click());
  setView(store.get("admin-vista") === "list" ? "list" : "grid");

  // ---------- editor ----------
  const dlg = $("editor");
  const DEF_LABEL = "Un regalo per te";
  const OFF = "-"; // notifica spenta per quel giorno
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  // confronto stabile (jsonb riordina le chiavi)
  const stable = (o) => JSON.stringify(o, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));
  const snapshot = () => stable({ ...current, updated_at: null, created_at: null });
  let original = null, saved = "", autoT = null, pane = "msg", thumbs = new Map();

  function setAuto(text, cls = "") { const a = $("ed-auto"); a.textContent = text; a.className = "ed-auto " + cls; }

  function setNotify(k, val) {
    const off = val === OFF;
    $("f-on-" + k).checked = !off;
    $("f-notify-" + k).value = off ? "" : val || "";
    $("f-notify-" + k).disabled = off;
  }

  function fillForm(r) {
    $("f-title").value = r.title || "";
    $("f-message").value = r.message || "";
    $("f-link").value = r.link_url || "";
    $("f-link-label").value = r.link_label || "";
    const v = (r.media || []).find((m) => m.type === "voucher");
    $("f-voucher").value = v?.caption || "";
    $("f-voucher-label").value = v && typeof v.label === "string" ? v.label : DEF_LABEL;
    $("f-download").checked = r.allow_download !== false;
    setNotify("m", r.notify_morning);
    setNotify("e", r.notify_evening);
    $("f-count").textContent = `${$("f-message").value.length} / 1000`;
  }

  function openEditor(day) {
    clearTimeout(autoT);
    current = structuredClone(days.get(day) || {
      day, title: "", message: "", link_url: "", link_label: "", media: [],
    });
    current.media = current.media || [];
    original = structuredClone(current);
    $("ed-title").textContent = `${day} dicembre${day === 24 ? " · il gran giorno" : ""}`;
    const badge = $("ed-badge");
    if (day <= visibleUpTo()) {
      badge.textContent = `⚠️ ${her()} può già aprire questa casella: le modifiche le vede subito.`;
      badge.className = "badge-line warn";
    } else {
      badge.textContent = `Crea la sorpresa del ${day} dicembre di ${her()}. Puoi cambiarla quando vuoi.`;
      badge.className = "badge-line";
    }
    fillForm(current);
    $("f-notify-m").placeholder = `Buongiorno${cal.her_name ? " " + cal.her_name : ""}! La casella del ${day} dicembre è pronta da aprire 🎁`;
    $("f-notify-e").placeholder = `La sorpresa del ${day} dicembre ti sta ancora aspettando 👀`;
    $("ed-prev").disabled = day <= 1;
    $("ed-next").disabled = day >= 24;
    $("upload-status").textContent = "";
    $("save-error").textContent = "";
    readForm();
    saved = snapshot();
    setAuto("Salvataggio automatico ✓");
    thumbs = new Map();
    showPane("msg", false);
    renderMedia(true);
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
    // giorni salvati prima dell'anteprima dei link: la aggiungo appena apri la casella
    if (/^https?:\/\//i.test(current.link_url || "") && !current.media.some((m) => m.type === "link" && m.href === current.link_url && m.image)) {
      const d0 = day;
      (async () => {
        await refreshLink();
        if (current.day !== d0) return;
        try { await saveRow(); renderPreview(false); } catch {}
      })();
    }
  }

  function readForm() {
    current.title = $("f-title").value.trim();
    current.message = $("f-message").value.trim();
    current.link_url = $("f-link").value.trim();
    current.link_label = $("f-link-label").value.trim();
    current.allow_download = $("f-download").checked;
    current.notify_morning = $("f-on-m").checked ? $("f-notify-m").value.trim() : OFF;
    current.notify_evening = $("f-on-e").checked ? $("f-notify-e").value.trim() : OFF;
    const v = $("f-voucher").value.trim();
    current.media = current.media.filter((m) => m.type !== "voucher");
    if (v) current.media.push({ type: "voucher", caption: v, label: $("f-voucher-label").value.trim(), name: "buono" });
  }

  // Anteprima del link (copertina e titolo di una playlist, un video…): la chiede al server quando il link cambia.
  async function linkInfo(url) {
    try {
      const { data } = await sb.auth.getSession();
      const ac = new AbortController(); setTimeout(() => ac.abort(), 9000);
      const r = await fetch(`${C.SUPABASE_URL}/functions/v1/linkinfo`, {
        method: "POST", signal: ac.signal,
        headers: { "Content-Type": "application/json", apikey: C.SUPABASE_KEY, Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify({ url }),
      });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }
  async function refreshLink() {
    const url = current.link_url;
    const old = current.media.find((m) => m.type === "link");
    if (!/^https?:\/\//i.test(url || "")) { current.media = current.media.filter((m) => m.type !== "link"); return; }
    if (old && old.href === url && (old.image || old.checked > Date.now() - 60000)) return;
    const info = await linkInfo(url);
    if (current.link_url !== url) return;
    current.media = current.media.filter((m) => m.type !== "link");
    current.media.push({ type: "link", name: "anteprima", href: url, title: info?.title || "", image: info?.image || "", provider: info?.provider || "", checked: Date.now() });
  }

  async function saveRow() {
    readForm();
    await refreshLink();
    const row = { ...current, calendar: cal.slug, updated_at: new Date().toISOString() };
    delete row.created_at;
    const { data, error } = await sb.from("days").upsert(row, { onConflict: "calendar,day" }).select().single();
    if (error) throw error;
    days.set(data.day, data);
    current = structuredClone(data);
    saved = snapshot();
    renderDays();
  }

  // salvataggio automatico: 1,2 secondi dopo l'ultima modifica
  function onChange() {
    readForm();
    renderPreview(false);
    updateDots();
    $("f-count").textContent = `${$("f-message").value.length} / 1000`;
    clearTimeout(autoT);
    if (snapshot() === saved) return setAuto("Salvataggio automatico ✓");
    setAuto("Modifiche non salvate…", "wait");
    autoT = setTimeout(autoSave, 1200);
  }
  async function autoSave() {
    clearTimeout(autoT);
    readForm();
    if (snapshot() === saved) return true;
    setAuto("Salvo…", "wait");
    try {
      await saveRow();
      renderPreview(false);
      setAuto("Salvato automaticamente ✓");
      $("save-error").textContent = "";
      return true;
    } catch (err) {
      setAuto("Non salvato", "err");
      $("save-error").textContent = "Salvataggio non riuscito: " + err.message;
      return false;
    }
  }
  $("day-form").addEventListener("input", (e) => { if (e.target.id !== "file") onChange(); });
  $("day-form").addEventListener("change", (e) => { if (e.target.id !== "file") onChange(); });
  for (const k of ["m", "e"]) {
    $("f-on-" + k).addEventListener("change", (e) => {
      const f = $("f-notify-" + k);
      f.disabled = !e.target.checked;
      if (e.target.checked) f.focus();
    });
  }
  $("label-chips").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-v]");
    if (!b) return;
    $("f-voucher-label").value = b.dataset.v;
    onChange();
    renderPreview(true);
  });

  async function closeEditor() {
    if (await autoSave()) dlg.close();
  }

  $("day-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("save");
    btn.disabled = true;
    try {
      clearTimeout(autoT);
      await saveRow();
      dlg.close();
      toast(`${current.day} dicembre salvato 💛`);
    } catch (err) {
      $("save-error").textContent = "Salvataggio non riuscito: " + err.message;
    } finally {
      btn.disabled = false;
    }
  });

  $("ed-close").addEventListener("click", closeEditor);
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); closeEditor(); });
  $("ed-prev").addEventListener("click", async () => { if (current.day > 1 && (await autoSave())) openEditor(current.day - 1); });
  $("ed-next").addEventListener("click", async () => { if (current.day < 24 && (await autoSave())) openEditor(current.day + 1); });

  // Annulla: rimette i testi com'erano all'apertura (i file caricati o tolti restano come sono)
  $("ed-cancel").addEventListener("click", async () => {
    clearTimeout(autoT);
    fillForm(original);
    readForm();
    if (snapshot() !== saved) {
      try { await saveRow(); } catch (err) { $("save-error").textContent = "Non riesco ad annullare: " + err.message; return; }
      toast("Modifiche annullate");
    }
    dlg.close();
  });

  $("clear-day").addEventListener("click", async () => {
    if (!confirm(`Svuotare il ${current.day} dicembre? Testo e file verranno cancellati.`)) return;
    clearTimeout(autoT);
    const paths = current.media.map((m) => m.path).filter(Boolean);
    if (paths.length) await sb.storage.from("surprises").remove(paths);
    const { error } = await sb.from("days").delete().eq("calendar", cal.slug).eq("day", current.day);
    if (error) return ($("save-error").textContent = error.message);
    days.delete(current.day);
    renderDays();
    dlg.close();
    toast("Giorno svuotato");
  });

  // Audio che parte da solo quando lei apre la casella (stessa regola del calendario)
  function autoAudio(media = current.media) {
    const a = media.filter((m) => m.type === "audio");
    return a.some((m) => typeof m.autoplay === "boolean") ? a.find((m) => m.autoplay) : a[0];
  }
  function setAutoAudio(target) {
    for (const m of current.media) if (m.type === "audio") m.autoplay = m === target;
  }

  // ---------- schede del contenuto ----------
  const ATTACH = {
    image: ["image/*", "Aggiungi foto", "Le foto diventano polaroid. Sotto ognuna puoi scrivere una didascalia.", "Ancora nessuna foto."],
    video: ["video/*", "Aggiungi un video", "Lei preme play per guardarlo. Meglio video corti (max 50 MB).", "Ancora nessun video."],
    audio: ["audio/*", "Carica un audio", "Scegli tu con l'interruttore se un audio parte da solo quando lei apre la casella; se lo spegni, lei lo ascolta premendo ▶. Senza audio suonano dei campanellini. Meglio vocali brevi, fino a 2 minuti.", "Ancora nessun audio."],
  };
  function showPane(name, play = true) {
    pane = name;
    dlg.querySelectorAll(".ed-tab").forEach((t) => {
      t.classList.toggle("on", t.dataset.pane === name);
      t.setAttribute("aria-selected", t.dataset.pane === name);
    });
    dlg.querySelectorAll(".ed-pane").forEach((p) => (p.hidden = !p.dataset.pane.split(" ").includes(name)));
    const a = ATTACH[name];
    if (a) {
      $("file").accept = a[0];
      $("upload-text").textContent = a[1];
      $("attach-hint").textContent = a[2];
      $("rec-box").hidden = name !== "audio";
      drawMedia();
    }
    updateDots();
    if (play && name === "voucher") renderPreview(true);
  }
  document.querySelectorAll(".ed-tab").forEach((t) => t.addEventListener("click", () => showPane(t.dataset.pane)));

  function updateDots() {
    const has = {
      msg: !!($("f-title").value.trim() || $("f-message").value.trim()),
      link: !!$("f-link").value.trim(),
      voucher: !!$("f-voucher").value.trim(),
    };
    for (const t of ["image", "video", "audio"]) has[t] = current.media.some((m) => m.type === t);
    document.querySelectorAll(".ed-tab").forEach((t) => t.classList.toggle("has", !!has[t.dataset.pane]));
  }

  // ---------- anteprima dal vivo ----------
  function voucherNode(f, day, play) {
    const wrap = el("div", "voucher" + (play ? " play" : ""));
    wrap.style.setProperty("--v-delay", ".1s");
    const ticket = el("div", "ticket"), paper = el("div", "t-paper"), main = el("div", "t-main");
    const label = typeof f.label === "string" ? f.label : DEF_LABEL;
    if (label.trim()) main.append(el("span", "v-small", label.trim()));
    main.append(el("strong", "", f.caption || "una sorpresa"), el("i", "", "♡"));
    paper.append(main);
    ticket.append(paper);
    const seal = el("span", "v-seal");
    seal.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5C5 15.6 3 12.3 3 9.3 3 6.6 5.1 4.6 7.6 4.6c1.9 0 3.4 1 4.4 2.6 1-1.6 2.5-2.6 4.4-2.6C18.9 4.6 21 6.6 21 9.3c0 3-2 6.3-9 11.2z" fill="#7a0d15"/></svg>';
    wrap.append(el("span", "v-mat"), ticket, seal);
    return wrap;
  }

  function renderPreview(play) {
    const pv = $("pv");
    const d = current, media = d.media || [];
    pv.textContent = "";
    const sheet = el("div", "pv-sheet");
    sheet.append(el("p", "pv-date", `${d.day} dicembre`));
    if (!isFilled(d)) {
      sheet.append(el("p", "pv-empty", "Ancora vuota: inizia da un titolo, una foto o un vocale ✨"));
      return pv.append(sheet);
    }
    const h = el("h4", "pv-title", d.title || (d.day === 24 ? "Buon Natale!" : "La sorpresa di oggi"));
    h.append(el("span", "", " ♡"));
    sheet.append(h);
    if (window.DECOR) { const bw = el("span", "pv-bow"); bw.innerHTML = DECOR.bow(); sheet.append(bw); }
    const v = media.find((m) => m.type === "voucher");
    if (v) sheet.append(voucherNode(v, d.day, play));
    media.filter((m) => m.type === "image").forEach((m, i) => {
      const fig = el("figure", "pv-pol");
      fig.style.setProperty("--tilt", (i % 2 ? 2 : -2) + "deg");
      const ph = el("span", "ph");
      if (thumbs.get(m.path)) ph.style.backgroundImage = `url("${thumbs.get(m.path)}")`;
      fig.append(ph, el("figcaption", "", m.caption || "♡"));
      sheet.append(fig);
    });
    if (d.message) sheet.append(el("p", "pv-msg", d.message));
    const extra = [];
    const aud = media.filter((m) => m.type === "audio").length, vid = media.filter((m) => m.type === "video").length;
    if (aud) extra.push(`🎧 ${aud === 1 ? "vocale" : aud + " audio"}${autoAudio(media) ? " (uno parte da solo)" : " (lei preme ▶)"}`.replace("vocale (uno parte", "vocale (parte"));
    if (vid) extra.push(`🎬 ${vid === 1 ? "video" : vid + " video"}`);
    if (extra.length) sheet.append(el("p", "pv-extra", extra.join("  ·  ")));
    if (d.link_url) {
      const li = media.find((m) => m.type === "link" && m.href === d.link_url);
      const card = el("span", "pv-lcard");
      if (li && li.image) { const im = document.createElement("img"); im.src = li.image; im.alt = ""; im.referrerPolicy = "no-referrer"; card.append(im); }
      const t = el("span", "pv-lt");
      t.append(el("small", "", (li && li.provider) || "Link"), el("b", "", d.link_label || (li && li.title) || "Apri il link ✨"));
      card.append(t, el("i", "", "▶"));
      sheet.append(card);
      if (li && !li.image && /spotify|youtu/i.test(d.link_url)) sheet.append(el("p", "pv-note", "Niente copertina: Spotify/YouTube non la danno per le playlist private. Rendila pubblica e riapri la casella."));
    }
    if (d.allow_download !== false) sheet.append(el("span", "pv-save", "⬇ Salva la cartolina"));
    pv.append(sheet);
  }

  // ---------- file ----------
  function kindOf(file) {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    const ext = file.name.split(".").pop().toLowerCase();
    if (["heic", "jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
    if (["mp4", "mov", "m4v", "webm"].includes(ext)) return "video";
    if (["mp3", "m4a", "aac", "wav", "ogg", "opus"].includes(ext)) return "audio";
    return null;
  }

  $("file").addEventListener("change", async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    for (const [i, file] of files.entries()) await uploadFile(file, `${i + 1} di ${files.length}`);
  });

  // Carica un file nel giorno aperto e lo salva subito. true se è andato bene.
  async function uploadFile(file, label = "") {
    const status = $("upload-status");
    {
      const type = kindOf(file);
      if (!type) { status.textContent = `"${file.name}" non è foto, video o audio.`; return false; }
      if (file.size > MAX) { status.textContent = `"${file.name}" pesa più di 50 MB: comprimilo e riprova.`; return false; }
      status.textContent = `Caricamento ${label ? label + ": " : ""}${file.name}…`;
      const safe = file.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-60);
      const path = `${cal.slug}/giorno-${current.day}/${Date.now()}-${safe}`;
      const { error } = await sb.storage.from("surprises").upload(path, file, { contentType: file.type || undefined });
      if (error) { status.textContent = `Errore con "${file.name}": ${error.message}`; return false; }
      const item = { path, type, name: file.name };
      if (type === "audio") {
        const first = !current.media.some((m) => m.type === "audio");
        if (!first) setAutoAudio(autoAudio()); // rende esplicita la scelta attuale
        item.autoplay = first;
      }
      current.media.push(item);
      try { await saveRow(); } catch (err) { status.textContent = "File caricato ma non salvato: " + err.message; return false; }
      renderMedia(); updateDots();
      status.textContent = `Caricato: ${file.name} ✓`;
      return true;
    }
  }

  // ---------- registra un vocale ----------
  const REC_MAX = 120; // secondi
  let rec = null, recStream = null, recBlob = null, recTimer = null, recUrl = null;
  const recType = () => ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"]
    .find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";

  function recUI(mode, text = "") {
    $("rec-start").hidden = mode !== "idle";
    $("rec-live").hidden = mode !== "live";
    $("rec-done").hidden = mode !== "done";
    $("rec-msg").textContent = text;
  }
  function recReset() {
    clearInterval(recTimer);
    try { if (rec && rec.state !== "inactive") rec.stop(); } catch {}
    recStream?.getTracks().forEach((t) => t.stop());
    rec = recStream = recBlob = null;
    if (recUrl) URL.revokeObjectURL(recUrl);
    recUrl = null;
    $("rec-play").removeAttribute("src");
    recUI("idle");
  }

  $("rec-start").addEventListener("click", async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      return recUI("idle", "Questo browser non registra: usa \"Carica un audio\" con un vocale fatto dal telefono.");
    }
    recUI("idle", "Il telefono ti chiederà di usare il microfono: tocca Consenti.");
    try {
      recStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      return recUI("idle", "Senza il permesso del microfono non posso registrare. Puoi riattivarlo nelle impostazioni del browser.");
    }
    const type = recType();
    rec = new MediaRecorder(recStream, type ? { mimeType: type, audioBitsPerSecond: 64000 } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      clearInterval(recTimer);
      recStream?.getTracks().forEach((t) => t.stop());
      recBlob = new Blob(chunks, { type: rec.mimeType || type || "audio/webm" });
      recUrl = URL.createObjectURL(recBlob);
      $("rec-play").src = recUrl;
      recUI("done", "Riascoltalo: se ti piace tocca \"Usa questo\".");
    };
    const start = Date.now();
    rec.start(1000);
    recUI("live");
    const tick = () => {
      const sec = Math.floor((Date.now() - start) / 1000);
      $("rec-time").textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} / 2:00`;
      if (sec >= REC_MAX && rec.state === "recording") rec.stop();
    };
    tick();
    recTimer = setInterval(tick, 250);
  });

  $("rec-stop").addEventListener("click", () => { if (rec && rec.state === "recording") rec.stop(); });
  $("rec-redo").addEventListener("click", () => { recReset(); $("rec-start").click(); });
  $("rec-use").addEventListener("click", async () => {
    if (!recBlob) return;
    const btn = $("rec-use");
    btn.disabled = true;
    const ext = /mp4|aac/.test(recBlob.type) ? "m4a" : /ogg/.test(recBlob.type) ? "ogg" : "webm";
    const file = new File([recBlob], `vocale-${current.day}.${ext}`, { type: recBlob.type.split(";")[0] });
    const ok = await uploadFile(file);
    btn.disabled = false;
    if (ok) { recReset(); $("upload-status").textContent = `Vocale salvato ✓ ${autoAudio() && autoAudio().name === file.name ? "Parte da solo quando apre la casella." : "Lei lo ascolta premendo ▶ (puoi farlo partire da solo con l'interruttore)."}`; }
  });
  dlg.addEventListener("close", recReset);
  // tornando al calendario: rimetti la scheda Caselle visibile e ricarica l'elenco dal server
  dlg.addEventListener("close", () => {
    if (!document.querySelector("#panel .pane:not([hidden])")) showTab("caselle");
    renderDays();
    loadDays().catch(() => {});
  });

  async function renderMedia(play = false) {
    const day = current.day;
    const need = current.media.filter((m) => m.type === "image" && m.path && !thumbs.has(m.path)).map((m) => m.path);
    drawMedia();
    renderPreview(play);
    if (!need.length) return;
    const { data } = await sb.storage.from("surprises").createSignedUrls(need, 600);
    if (current.day !== day) return;
    for (const s of data || []) if (s.signedUrl) thumbs.set(s.path, s.signedUrl);
    drawMedia();
    renderPreview(false);
  }

  function drawMedia() {
    const list = $("media-list");
    list.textContent = "";
    const show = ATTACH[pane] ? pane : null;
    let n = 0;
    current.media.forEach((m) => {
      if (m.type === "voucher" || m.type !== show) return;
      n++;
      const li = document.createElement("li");
      const th = document.createElement("span");
      th.className = "thumb";
      if (thumbs.get(m.path)) th.style.backgroundImage = `url("${thumbs.get(m.path)}")`;
      else th.textContent = m.type === "video" ? "🎬" : m.type === "audio" ? "🎧" : "🖼️";
      const name = document.createElement("span");
      name.className = "name"; name.textContent = m.name;
      if (m.type === "image") {
        name.textContent = "";
        const cap = document.createElement("input");
        cap.className = "caption"; cap.maxLength = 80;
        cap.placeholder = "Didascalia (facoltativa)";
        cap.value = m.caption || "";
        cap.addEventListener("input", () => { m.caption = cap.value.trim(); });
        const fn = document.createElement("small");
        fn.textContent = m.name;
        name.append(cap, fn);
      }
      if (m.type === "audio") {
        const sw = el("label", "auto-sw");
        const inp = document.createElement("input");
        inp.type = "checkbox"; inp.checked = autoAudio() === m;
        inp.addEventListener("change", async () => {
          setAutoAudio(inp.checked ? m : null);
          drawMedia(); renderPreview(false);
          try { await saveRow(); setAuto("Salvato automaticamente ✓"); } catch (err) { $("save-error").textContent = "Non salvato: " + err.message; }
        });
        const knob = el("span", "switch");
        knob.append(inp, el("span"));
        sw.append(knob, el("small", "", "Parte da solo"));
        name.append(sw);
      }
      const del = document.createElement("button");
      del.type = "button"; del.textContent = "Togli";
      del.addEventListener("click", async () => {
        del.disabled = true;
        await sb.storage.from("surprises").remove([m.path]);
        current.media = current.media.filter((x) => x !== m);
        try { await saveRow(); } catch {}
        renderMedia();
        updateDots();
      });
      li.append(th, name, del);
      list.append(li);
    });
    $("attach-none").hidden = n > 0 || !show;
    if (show) $("attach-none").textContent = ATTACH[show][3];
  }

  // ---------- anteprima ----------
  $("preview-btn").addEventListener("click", () => {
    const d = $("preview-date").value;
    if (d) window.open(`index.html?preview=${d}${cal.slug === "olly" ? "" : "&c=" + cal.slug}`, "_blank");
  });

  // ---------- impostazioni del calendario ----------
  const herLink = () => new URL(cal.slug === "olly" ? "./" : `./?c=${cal.slug}`, location.href).href;

  function fillSettings() {
    $("panel-title").textContent = `Le sorprese di ${her()}`;
    document.title = `Admin · ${her()}`;
    $("s-her").value = cal.her_name;
    $("s-sign").value = cal.signature;
    $("s-intro").value = cal.intro;
    $("s-code").value = cal.code || "";
    $("s-code").placeholder = cal.slug === "olly" ? "(quella già impostata in Supabase)" : "Es. il nome del vostro posto";
    $("s-link").value = herLink();
    $("s-notify-line").textContent = `Ogni giorno alle 8 e, se non ha ancora aperto la casella, alle 20. ${her()} le attiva con il bottone 🔔 nel calendario.`;
    document.querySelectorAll(".her-name").forEach((n) => (n.textContent = her()));
    peek();
    if (!cal.her_name) showTab("grafica");
    else if (!cal.code && cal.slug !== "olly") showTab("impostazioni");
  }
  function peek() {
    $("peek-her").textContent = $("s-her").value.trim() || "lei";
    $("peek-intro").textContent = $("s-intro").value.trim();
    $("peek-sign").textContent = $("s-sign").value.trim();
  }
  ["s-her", "s-intro", "s-sign"].forEach((id) => $(id).addEventListener("input", peek));

  $("settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("s-error").textContent = "";
    const code = $("s-code").value.trim();
    if (!$("s-her").value.trim()) { showTab("grafica"); return ($("s-error").textContent = "Scrivi il nome di lei."); }
    if (!code && cal.slug !== "olly") { showTab("impostazioni"); return ($("s-error").textContent = "Scegli una parola segreta, sennò lei non può entrare."); }
    const patch = {
      her_name: $("s-her").value.trim(), signature: $("s-sign").value.trim(),
      intro: $("s-intro").value.trim(), code: code || null,
    };
    const saves = document.querySelectorAll(".s-save");
    saves.forEach((b) => (b.disabled = true));
    const { data, error } = await sb.from("calendars").update(patch).eq("slug", cal.slug).select().single();
    saves.forEach((b) => (b.disabled = false));
    if (error) return ($("s-error").textContent = "Non salvato: " + error.message);
    cal = data;
    fillSettings();
    renderDays();
    toast("Calendario salvato 💛");
  });

  $("s-test").addEventListener("click", async () => {
    const btn = $("s-test");
    btn.disabled = true;
    try {
      const { data } = await sb.auth.getSession();
      const res = await fetch(`${C.SUPABASE_URL}/functions/v1/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: C.SUPABASE_KEY, Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ test: true }),
      });
      const r = await res.json();
      if (!res.ok) throw new Error();
      $("s-notify-line").textContent = r.devices
        ? `Notifiche: attive su ${r.devices} ${r.devices === 1 ? "telefono" : "telefoni"}. Prova mandata a ${r.sent}.`
        : `Notifiche: ${her()} non le ha ancora attivate (bottone 🔔 nel calendario).`;
    } catch {
      $("s-notify-line").textContent = "Notifiche: non riesco a mandare la prova, riprova tra poco.";
    } finally { btn.disabled = false; }
  });

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(herLink()); toast("Link copiato 🔗"); }
    catch { go("impostazioni", "s-link"); $("s-link").select(); }
  };
  $("s-copy").addEventListener("click", copyLink);
  $("s-copy2").addEventListener("click", copyLink);

  let toastTimer;
  function toast(text) {
    const t = $("toast");
    t.textContent = text; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
  }

  boot();
})();
