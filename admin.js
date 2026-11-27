(() => {
  const C = window.CONFIG;
  const $ = (id) => document.getElementById(id);
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY);
  const MAX = 50 * 1024 * 1024;

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
    if (data.session) showPanel(); else $("login").hidden = false;
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

  $("logout").addEventListener("click", async () => {
    await sb.auth.signOut();
    location.reload();
  });

  async function showPanel() {
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

  function renderDays() {
    const box = $("days");
    box.textContent = "";
    const v = visibleUpTo();
    for (let d = 1; d <= 24; d++) {
      const r = days.get(d);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "day" + (d <= v ? " visible" : "");
      const filled = isFilled(r);
      const media = (r?.media || []).filter((m) => m.type !== "voucher").length;
      b.innerHTML = `
        <span class="pill ${filled ? "ready" : "empty"}">${filled ? "pronto" : "vuoto"}</span>
        <span class="n">${d}</span>
        <span class="t"></span>
        <span class="meta">${media ? media + (media === 1 ? " file" : " file") : ""}${r?.link_url ? (media ? " · " : "") + "link" : ""}</span>`;
      b.querySelector(".t").textContent = r?.title || (filled ? "(senza titolo)" : "Tocca per riempire");
      b.addEventListener("click", () => openEditor(d));
      box.appendChild(b);
    }
  }

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
    const status = $("upload-status");
    for (const [i, file] of files.entries()) {
      const type = kindOf(file);
      if (!type) { status.textContent = `"${file.name}" non è foto, video o audio.`; continue; }
      if (file.size > MAX) { status.textContent = `"${file.name}" pesa più di 50 MB: comprimilo e riprova.`; continue; }
      status.textContent = `Caricamento ${i + 1} di ${files.length}: ${file.name}…`;
      const safe = file.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-60);
      const path = `${cal.slug}/giorno-${current.day}/${Date.now()}-${safe}`;
      const { error } = await sb.storage.from("surprises").upload(path, file, { contentType: file.type || undefined });
      if (error) { status.textContent = `Errore con "${file.name}": ${error.message}`; continue; }
      current.media.push({ path, type, name: file.name });
      try { await saveRow(); } catch (err) { status.textContent = "File caricato ma non salvato: " + err.message; continue; }
      renderMedia();
      status.textContent = `Caricato: ${file.name} ✓`;
    }
  });

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
    if (!cal.her_name || (!cal.code && cal.slug !== "olly")) $("settings").open = true;
  }

  $("settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("s-error").textContent = "";
    const code = $("s-code").value.trim();
    if (!code && cal.slug !== "olly") return ($("s-error").textContent = "Scegli una parola segreta, sennò lei non può entrare.");
    const patch = {
      her_name: $("s-her").value.trim(), signature: $("s-sign").value.trim(),
      intro: $("s-intro").value.trim(), code: code || null,
    };
    $("s-save").disabled = true;
    const { data, error } = await sb.from("calendars").update(patch).eq("slug", cal.slug).select().single();
    $("s-save").disabled = false;
    if (error) return ($("s-error").textContent = "Non salvato: " + error.message);
    cal = data;
    fillSettings();
    renderDays();
    toast("Calendario salvato 💛");
  });

  $("s-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(herLink()); toast("Link copiato"); }
    catch { $("s-link").select(); }
  });

  let toastTimer;
  function toast(text) {
    const t = $("toast");
    t.textContent = text; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
  }

  boot();
})();
