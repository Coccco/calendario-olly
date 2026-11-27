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
      const files = (r?.media || []).filter((m) => m.type !== "voucher").length;

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
      nr.querySelector(".m").textContent = r?.notify_morning || "Messaggio predefinito";
      nr.querySelector(".e").textContent = r?.notify_evening || "Messaggio predefinito";
      if (!r?.notify_morning) nr.querySelector(".m").classList.add("def");
      if (!r?.notify_evening) nr.querySelector(".e").classList.add("def");
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
    document.querySelectorAll(".pane").forEach((p) => (p.hidden = p.dataset.pane !== name));
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

  function openEditor(day) {
    current = structuredClone(days.get(day) || {
      day, title: "", message: "", link_url: "", link_label: "", media: [],
    });
    $("ed-title").textContent = `${day} dicembre${day === 24 ? " · il gran giorno" : ""}`;
    const badge = $("ed-badge");
    if (day <= visibleUpTo()) {
      badge.textContent = `⚠️ ${her()} può già aprire questa casella: le modifiche le vede subito.`;
      badge.className = "badge-line warn";
    } else {
      badge.textContent = `${her()} la potrà aprire dal ${day} dicembre. Puoi cambiarla quando vuoi fino ad allora.`;
      badge.className = "badge-line";
    }
    $("f-title").value = current.title;
    $("f-message").value = current.message;
    $("f-link").value = current.link_url;
    $("f-link-label").value = current.link_label;
    $("f-voucher").value = (current.media.find((m) => m.type === "voucher") || {}).caption || "";
    $("f-notify-m").value = current.notify_morning || "";
    $("f-notify-e").value = current.notify_evening || "";
    $("f-notify-m").placeholder = `Buongiorno${cal.her_name ? " " + cal.her_name : ""}! La casella del ${day} dicembre è pronta da aprire 🎁`;
    $("f-notify-e").placeholder = `La sorpresa del ${day} dicembre ti sta ancora aspettando 👀`;
    $("upload-status").textContent = "";
    $("save-error").textContent = "";
    renderMedia();
    dlg.showModal();
  }

  function readForm() {
    current.title = $("f-title").value.trim();
    current.message = $("f-message").value.trim();
    current.link_url = $("f-link").value.trim();
    current.link_label = $("f-link-label").value.trim();
    current.notify_morning = $("f-notify-m").value.trim();
    current.notify_evening = $("f-notify-e").value.trim();
    const v = $("f-voucher").value.trim();
    current.media = current.media.filter((m) => m.type !== "voucher");
    if (v) current.media.push({ type: "voucher", caption: v, name: "buono" });
  }

  async function saveRow() {
    readForm();
    const row = { ...current, calendar: cal.slug, updated_at: new Date().toISOString() };
    const { data, error } = await sb.from("days").upsert(row, { onConflict: "calendar,day" }).select().single();
    if (error) throw error;
    days.set(data.day, data);
    current = structuredClone(data);
    renderDays();
  }

  $("day-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("save");
    btn.disabled = true;
    try {
      await saveRow();
      dlg.close();
      toast(`${current.day} dicembre salvato 💛`);
    } catch (err) {
      $("save-error").textContent = "Salvataggio non riuscito: " + err.message;
    } finally {
      btn.disabled = false;
    }
  });

  $("ed-close").addEventListener("click", () => dlg.close());

  $("clear-day").addEventListener("click", async () => {
    if (!confirm(`Svuotare il ${current.day} dicembre? Testo e file verranno cancellati.`)) return;
    const paths = current.media.map((m) => m.path).filter(Boolean);
    if (paths.length) await sb.storage.from("surprises").remove(paths);
    const { error } = await sb.from("days").delete().eq("calendar", cal.slug).eq("day", current.day);
    if (error) return ($("save-error").textContent = error.message);
    days.delete(current.day);
    renderDays();
    dlg.close();
    toast("Giorno svuotato");
  });

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
      current.media.push({ path, type, name: file.name });
      try { await saveRow(); } catch (err) { status.textContent = "File caricato ma non salvato: " + err.message; return false; }
      renderMedia();
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
      return recUI("idle", "Questo browser non registra: usa \"Aggiungi file\" con un vocale fatto dal telefono.");
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
    if (ok) { recReset(); $("upload-status").textContent = "Vocale salvato ✓ Parte da solo quando apre la casella."; }
  });
  dlg.addEventListener("close", recReset);

  async function renderMedia() {
    const list = $("media-list");
    list.textContent = "";
    const imgs = current.media.filter((m) => m.type === "image" && m.path).map((m) => m.path);
    const thumbs = new Map();
    if (imgs.length) {
      const { data } = await sb.storage.from("surprises").createSignedUrls(imgs, 600);
      for (const s of data || []) thumbs.set(s.path, s.signedUrl);
    }
    current.media.forEach((m, idx) => {
      if (m.type === "voucher") return;
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
      const del = document.createElement("button");
      del.type = "button"; del.textContent = "Togli";
      del.addEventListener("click", async () => {
        del.disabled = true;
        await sb.storage.from("surprises").remove([m.path]);
        current.media.splice(idx, 1);
        try { await saveRow(); } catch {}
        renderMedia();
      });
      li.append(th, name, del);
      list.append(li);
    });
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
