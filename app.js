(() => {
  const C = window.CONFIG;
  const $ = (id) => document.getElementById(id);
  const CODE_KEY = "avvento-codice";
  const SEEN_KEY = "avvento-visti";

  // Ordine "mescolato" delle caselle e forme del mosaico
  const ORDER = [24, 3, 11, 7, 21, 15, 1, 12, 18, 5, 4, 9, 20, 2, 14, 17, 6, 13, 8, 10, 22, 19, 16, 23];
  const SHAPE = { 24: "big", 11: "w2", 12: "w2", 10: "w2", 16: "w2", 6: "w2", 17: "w2", 4: "w2", 20: "w2", 9: "w2", 19: "w2", 5: "h2", 13: "h2", 21: "h2" };
  const GREEN = [11, 18, 4, 2, 13, 14], RED = [7, 15, 12, 20, 17, 10, 23], TARTAN = [8, 19];
  const ICON = { 11: "tree", 15: "mug", 12: "village", 21: "ornaments", 5: "holly", 20: "sprig", 6: "candycane", 10: "house", 16: "mountains", 1: "star", 13: "lantern", 18: "snowflake", 17: "pinecone", 14: "reindeer", 9: "stars", 3: "gift", 22: "candle" };

  const EMPTY = [
    ["💌", "La sorpresa di oggi si sta ancora incartando da sola… torna più tardi, ne vale la pena."],
    ["🤫", "Oggi la sorpresa è segreta anche per il calendario. Chiedi a Cocco, forse è in tasca sua."],
    ["🫶", "Oggi niente pacchetto qui dentro: vale un abbraccio, da riscuotere appena vi vedete."],
    ["⭐", "Questa casella oggi custodisce solo una cosa: un bacio. Da ritirare di persona."],
    ["☕", "Il regalo di oggi è in viaggio. Nel frattempo, sappi che stai benissimo anche oggi."],
  ];

  const NEXT = [
    "Domani c'è un'altra casella che ti aspetta ✨",
    "Torna domani: la prossima sorpresa è già incartata 🎁",
    "Ci vediamo domani, stesso calendario 😉",
    "A domani! E niente trucchi con l'orologio 🤫",
  ];
  const PAST = "Questa era di qualche giorno fa: hai già aperto quella di oggi? 👀";
  const LAST = "Buon Natale, Olly! Il calendario finisce qui 🎄";

  const params = new URLSearchParams(location.search);
  const previewDate = params.get("preview");

  let state = null; // { today, unlocked, days: Map }
  let fetchedAt = 0;
  let creds = {};   // { code } oppure { preview_date, token }

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  // ---------- testi e neve ----------
  DECOR.mount();
  $("tag-name").textContent = C.NOME_LEI;
  $("her-name").textContent = C.NOME_LEI;
  $("intro-text").textContent = C.INTRO;
  $("signature").textContent = C.FIRMA;
  document.title = `Per ${C.NOME_LEI} 🎁`;

  const snow = document.querySelector(".snow");
  for (let i = 0; i < 26; i++) {
    const f = document.createElement("i");
    f.style.left = Math.random() * 100 + "%";
    f.style.setProperty("--s", 2 + Math.random() * 4 + "px");
    f.style.setProperty("--d", 9 + Math.random() * 12 + "s");
    f.style.setProperty("--delay", -Math.random() * 20 + "s");
    f.style.setProperty("--drift", (Math.random() * 80 - 40) + "px");
    snow.appendChild(f);
  }

  // ---------- server ----------
  async function fetchCalendar(body, token) {
    const res = await fetch(`${C.SUPABASE_URL}/functions/v1/calendar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: C.SUPABASE_KEY,
        Authorization: `Bearer ${token || C.SUPABASE_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401) throw new Error("codice");
    if (!res.ok) throw new Error("server");
    const data = await res.json();
    fetchedAt = Date.now();
    return { ...data, days: new Map(data.days.map((d) => [d.day, d])) };
  }

  async function reload() {
    const { token, ...body } = creds;
    state = await fetchCalendar(body, token);
    render();
  }

  // ---------- intro ----------
  const gift = $("gift");
  gift.addEventListener("click", async () => {
    if (gift.classList.contains("open")) return;
    gift.classList.add("open");
    $("gift-hint").hidden = true;
    burst(gift.getBoundingClientRect(), 26);
    await wait(750);

    const saved = store.get(CODE_KEY);
    if (saved) {
      try {
        creds = { code: saved };
        await reload();
        return showCalendar();
      } catch (e) {
        if (e.message === "codice") store.del(CODE_KEY);
        else return showCodeForm("Il calendario non risponde. Riprova tra un attimo.");
      }
    }
    showCodeForm();
  });

  function showCodeForm(msg = "") {
    $("code-form").hidden = false;
    $("code-error").textContent = msg;
    $("code").focus();
  }

  $("code-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const btn = ev.submitter || ev.target.querySelector("button");
    const code = $("code").value;
    btn.disabled = true;
    $("code-error").textContent = "";
    try {
      creds = { code };
      await reload();
      store.set(CODE_KEY, code);
      showCalendar();
    } catch (e) {
      $("code-error").textContent = e.message === "codice"
        ? "Mmm, non è questa. Riprova 💭"
        : "Il calendario non risponde. Riprova tra un attimo.";
      const f = $("code-form");
      f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake");
    } finally {
      btn.disabled = false;
    }
  });

  function showCalendar() {
    $("intro").hidden = true;
    $("calendar").hidden = false;
    document.body.classList.add("in-calendar");
    document.querySelector('meta[name="theme-color"]').content = "#2a0b12";
    window.scrollTo(0, 0);
  }

  // ---------- calendario ----------
  function seenSet() {
    try { return new Set(JSON.parse(store.get(SEEN_KEY) || "[]")); } catch { return new Set(); }
  }
  function markSeen(day) {
    if (previewDate) return;
    const s = seenSet(); s.add(day);
    store.set(SEEN_KEY, JSON.stringify([...s]));
  }

  function render() {
    const { unlocked, today } = state;
    const seen = previewDate ? new Set() : seenSet();
    const todayNum = today.startsWith("2026-12-") ? Number(today.slice(8)) : 0;
    const grid = $("grid");
    grid.textContent = "";

    ORDER.forEach((day, i) => {
      const t = document.createElement("button");
      t.type = "button";
      const color = TARTAN.includes(day) ? "c-tartan" : GREEN.includes(day) ? "c-green" : RED.includes(day) ? "c-red" : "c-cream";
      t.className = `tile ${SHAPE[day] || "sq"} ${color}`;
      t.style.setProperty("--i", i);
      if (ICON[day] && day !== 24) {
        t.classList.add("has-ico");
        t.insertAdjacentHTML("beforeend", DECOR.icon(ICON[day]));
      }
      const num = el("span", "num", day);
      if (SHAPE[day] || !ICON[day]) num.append(el("small", "mon", "dic"));
      t.append(el("span", "frame"), num);
      if (day === 24) {
        const bow = el("span", "ribbon-bow");
        bow.innerHTML = DECOR.bow();
        const holly = el("span", "holly");
        holly.innerHTML = DECOR.icon("holly");
        t.prepend(bow, holly);
        t.append(el("span", "label", "Natale"));
      }
      if (day > unlocked) {
        t.classList.add("locked");
        t.append(el("span", "lock"));
        t.setAttribute("aria-label", `${day} dicembre, ancora chiusa`);
      } else {
        t.classList.add(seen.has(day) ? "seen" : "new");
        if (!seen.has(day)) t.append(el("span", "dot"));
        else if (day !== 24) {
          // casella già aperta: diventa un cartellino appeso
          const tag = el("span", "htag");
          tag.append(el("b", "", day), el("i", "", "♡"));
          t.append(tag);
        }
        if (day === todayNum) {
          t.classList.add("today");
          if (day !== 24) t.append(el("span", "label", "Oggi"));
        }
        t.setAttribute("aria-label", `${day} dicembre, da aprire`);
      }
      t.addEventListener("click", () => onTile(day, t));
      grid.appendChild(t);
    });

    $("status").textContent = statusText(today, unlocked, seen);
    requestAnimationFrame(() => grid.classList.add("no-pop"));
  }

  function statusText(today, unlocked, seen) {
    if (unlocked > 0) {
      const n = [...seen].filter((d) => d <= unlocked).length;
      return `${n} di 24 sorprese aperte`;
    }
    if (unlocked === 0) {
      const days = Math.round((Date.parse("2026-12-01") - Date.parse(today)) / 864e5);
      return days === 1 ? "Domani si apre la prima casella ✨" : `Mancano ${days} giorni alla prima casella ✨`;
    }
    if (unlocked >= 24) return today === "2026-12-24" ? "È la vigilia! Oggi si apre il regalo grande 🎄" : "Tutte le caselle sono aperte 🎄";
    return `Oggi è il ${unlocked} dicembre · ${unlocked === 1 ? "la prima casella è aperta" : unlocked + " caselle aperte"}`;
  }

  let opening = false;
  async function onTile(day, tile) {
    if (opening) return;
    if (day > state.unlocked) {
      tile.classList.remove("shake"); void tile.offsetWidth; tile.classList.add("shake");
      const left = day - state.unlocked;
      toast(left === 1 && state.unlocked > 0
        ? `Questa si apre domani. Resisti ancora un po' 🤫`
        : `Si apre il ${day} dicembre. Niente sbirciatine 🤫`);
      return;
    }
    // i link ai file scadono: se è passato tanto tempo, ricarica prima
    if (Date.now() - fetchedAt > 2 * 3600e3) {
      try { await reload(); } catch {}
    }
    opening = true;
    try { await playOpening(tile, day); } catch {}
    opening = false;
    openSurprise(day);
    markSeen(day);
    tile.classList.remove("new"); tile.classList.add("seen");
    tile.querySelector(".dot")?.remove();
  }

  // Animazione: il fiocco si scioglie, la casella si solleva, luce calda, si apre la lettera
  async function playOpening(tile, day) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = tile.getBoundingClientRect();
    const color = ["c-cream", "c-red", "c-green"].find((c) => tile.classList.contains(c)) || "c-cream";
    const ov = el("div", "opener");
    const glow = el("div", "op-glow");
    const card = el("div", `op-card ${color}`);
    card.append(el("span", "op-num", day));
    const bow = el("span", "op-bow");
    bow.innerHTML = DECOR.bow();
    card.append(bow);
    Object.assign(card.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });

    const env = el("div", "op-env");
    const letter = el("div", "op-letter");
    letter.append(el("span", "", `${day} dicembre`), el("b", "", "Per " + C.NOME_LEI));
    const flap = el("div", "op-flap");
    const seal = el("i", "op-seal");
    env.append(el("div", "op-back"), letter, el("div", "op-front"), flap, seal);
    ov.append(glow, card, env);
    document.body.append(ov);
    tile.style.visibility = "hidden";

    const ease = "cubic-bezier(.3,.9,.3,1)";
    ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: "forwards" });
    // 1. il fiocco si scioglie
    await bow.animate([
      { transform: "translate(-50%,-55%) scale(1) rotate(0)", opacity: 1 },
      { transform: "translate(-50%,-75%) scale(1.25) rotate(-8deg)", opacity: 1, offset: .4 },
      { transform: "translate(-50%,-160%) scale(.6) rotate(25deg)", opacity: 0 },
    ], { duration: 650, easing: "ease-in", fill: "forwards" }).finished;
    // 2. la casella si solleva al centro
    const size = Math.min(220, innerWidth * .55);
    const dx = innerWidth / 2 - (r.left + r.width / 2), dy = innerHeight / 2 - (r.top + r.height / 2);
    const sc = size / Math.max(r.width, r.height);
    glow.animate([{ transform: "translate(-50%,-50%) scale(.2)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1 }], { duration: 900, easing: "ease-out", fill: "forwards" });
    await card.animate([
      { transform: "translate(0,0) scale(1)", boxShadow: "0 6px 14px rgba(0,0,0,.4)" },
      { transform: `translate(${dx}px,${dy}px) scale(${sc}) rotate(-2deg)`, boxShadow: "0 30px 60px rgba(0,0,0,.55)" },
    ], { duration: 650, easing: ease, fill: "forwards" }).finished;
    // 3. diventa una lettera
    card.animate([{ opacity: 1 }, { opacity: 0, transform: `translate(${dx}px,${dy}px) scale(${sc * .8}) rotate(-2deg)` }], { duration: 300, fill: "forwards" });
    await env.animate([{ opacity: 0, transform: "translate(-50%,-40%) scale(.85)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)" }], { duration: 380, easing: ease, fill: "forwards" }).finished;
    // 4. si apre la busta e la lettera esce
    seal.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.4)" }], { duration: 250, fill: "forwards" });
    await flap.animate([{ transform: "rotateX(0)" }, { transform: "rotateX(180deg)" }], { duration: 450, easing: "ease-in-out", fill: "forwards" }).finished;
    flap.style.zIndex = 0;
    burst(env.getBoundingClientRect(), 22);
    await letter.animate([{ transform: "translateY(0)" }, { transform: "translateY(-62%)" }], { duration: 550, easing: ease, fill: "forwards" }).finished;
    await wait(150);
    ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, fill: "forwards" }).finished.then(() => ov.remove());
    tile.style.visibility = "";
  }

  let currentDay = 0;
  function openSurprise(day) {
    currentDay = day;
    const d = state.days.get(day);
    const body = $("s-body");
    body.textContent = "";
    $("s-date").textContent = `${day} dicembre`;
    const title = $("s-title");

    const media = (d && d.media) || [];
    const voucher = media.find((f) => f.type === "voucher");
    const hasContent = d && (d.title || d.message || d.link_url || media.length);
    if (!hasContent) {
      const [emoji, text] = EMPTY[day % EMPTY.length];
      title.textContent = "Un attimo di pazienza";
      const box = el("div", "empty");
      box.append(el("div", "big-emoji", emoji), el("p", "", text));
      body.append(box);
    } else {
      title.textContent = d.title || (day === 24 ? "Buon Natale!" : "La sorpresa di oggi");
      title.append(el("span", "t-heart", " ♡"));
      if (voucher) body.append(voucherCard(voucher.caption));
      const photos = media.filter((f) => f.url && f.type === "image");
      photos.forEach((f, i) => {
        const fig = el("figure", "polaroid");
        fig.style.setProperty("--tilt", (i % 2 ? 2 : -2.2) + "deg");
        fig.append(el("span", "tape"));
        const img = document.createElement("img");
        img.alt = f.caption || ""; img.src = f.url; img.decoding = "async";
        fig.append(img, el("figcaption", "", f.caption || "♡"));
        body.append(fig);
      });
      if (d.message) body.append(el("p", "message", d.message));
      const others = media.filter((f) => f.url && (f.type === "video" || f.type === "audio"));
      if (others.length) {
        const m = el("div", "media");
        for (const f of others) {
          const node = document.createElement(f.type);
          node.controls = true; node.preload = "metadata"; node.src = f.url;
          if (f.type === "video") node.playsInline = true;
          m.append(node);
        }
        body.append(m);
      }
      if (/^https?:\/\//i.test(d.link_url || "")) {
        const a = el("a", "link-btn", d.link_label || "Apri il link ✨");
        a.href = d.link_url; a.target = "_blank"; a.rel = "noopener";
        body.append(a);
      }
    }
    const phrase = day === 24 ? LAST : day < state.unlocked ? PAST : NEXT[day % NEXT.length];
    body.append(el("p", "see-you", phrase));

    // frecce: solo tra i giorni che può già aprire
    $("s-count").textContent = `${day} / 24`;
    $("s-prev").disabled = day <= 1;
    $("s-next").disabled = day >= Math.min(state.unlocked, 24);

    const dlg = $("surprise");
    if (!dlg.open) { dlg.showModal(); startSnow(); }
    dlg.scrollTop = 0;
    dlg.querySelector(".sheet").scrollTop = 0;
  }

  function voucherCard(text) {
    const wrap = el("div", "voucher");
    const ticket = el("div", "ticket");
    ticket.append(el("span", "v-small", "Buono per"), el("strong", "", text || "una sorpresa"), el("i", "", "♡"));
    wrap.append(el("span", "envelope"), ticket, el("span", "twine"));
    return wrap;
  }

  function goTo(day) {
    if (day < 1 || day > state.unlocked || day > 24) return;
    const sheet = $("surprise").querySelector(".sheet");
    sheet.animate([{ opacity: 1, transform: "translateX(0)" }, { opacity: 0, transform: `translateX(${day > currentDay ? -30 : 30}px)` }], { duration: 160, fill: "forwards" })
      .finished.then(() => {
        openSurprise(day);
        markSeen(day);
        sheet.animate([{ opacity: 0, transform: `translateX(${day > currentDay ? 30 : -30}px)` }, { opacity: 1, transform: "translateX(0)" }], { duration: 220, easing: "ease-out", fill: "forwards" });
      });
  }


  const dlg = $("surprise");
  dlg.querySelector(".close").addEventListener("click", () => dlg.close());
  $("s-prev").addEventListener("click", () => goTo(currentDay - 1));
  $("s-next").addEventListener("click", () => goTo(currentDay + 1));
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("close", () => {
    dlg.querySelectorAll("video, audio").forEach((m) => m.pause());
    stopSnow();
    if (state) render();
  });

  // Neve che cade sopra la sorpresa appena si apre
  const snowLayer = el("canvas", "snowfall");
  snowLayer.setAttribute("aria-hidden", "true");
  if ("showPopover" in snowLayer) snowLayer.setAttribute("popover", "manual");
  document.body.append(snowLayer);
  let snowRaf = 0;
  function startSnow() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    stopSnow();
    if (snowLayer.showPopover) { try { snowLayer.showPopover(); } catch {} }
    else $("surprise").append(snowLayer);
    const ctx = snowLayer.getContext("2d");
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = innerWidth, H = innerHeight;
    snowLayer.width = W * dpr; snowLayer.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = W < 500 ? 55 : 90;
    const flakes = Array.from({ length: n }, (_, i) => ({
      x: Math.random() * W,
      y: i < n * .5 ? Math.random() * H * .8 - H * .1 : -Math.random() * H, // metà già in volo, metà in arrivo
      r: 1.2 + Math.random() * 3.2,
      v: 50 + Math.random() * 70,
      w: Math.random() * Math.PI * 2,
      s: .6 + Math.random() * 1.2,
    }));
    const t0 = performance.now();
    let last = t0;
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, .05); last = now;
      const fade = Math.min((now - t0) / 600, 1);
      ctx.clearRect(0, 0, W, H);
      for (const f of flakes) {
        f.y += f.v * dt;
        f.w += f.s * dt;
        f.x += Math.sin(f.w) * 18 * dt;
        if (f.y > H + 6) { f.y = -6; f.x = Math.random() * W; }
        ctx.globalAlpha = fade * (.45 + f.r / 8);
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = "#fbfdff";
        ctx.fill();
        ctx.lineWidth = .8;
        ctx.strokeStyle = "rgba(110,135,160,.35)"; // bordino per vederla anche sul foglio crema
        ctx.stroke();
      }
      snowRaf = requestAnimationFrame(frame);
    };
    snowRaf = requestAnimationFrame(frame);
  }
  function stopSnow() {
    cancelAnimationFrame(snowRaf);
    if (snowLayer.hidePopover) { try { snowLayer.hidePopover(); } catch {} }
    else snowLayer.remove();
  }

  // Se la pagina resta aperta (es. passa la mezzanotte), aggiorna al rientro
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state && Date.now() - fetchedAt > 10 * 60e3) {
      reload().catch(() => {});
    }
  });

  // ---------- piccoli aiuti ----------
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  let toastTimer;
  function toast(text) {
    const t = $("toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  function burst(rect, n) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#e3b860", "#f6eee2", "#d9463a", "#ffd98a"];
    for (let i = 0; i < n; i++) {
      const s = el("span", "sparkle");
      const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 110;
      s.style.left = rect.left + rect.width / 2 + "px";
      s.style.top = rect.top + rect.height / 2 + "px";
      s.style.background = colors[i % colors.length];
      s.style.setProperty("--x", Math.cos(a) * r + "px");
      s.style.setProperty("--y", Math.sin(a) * r + "px");
      s.style.setProperty("--r", Math.random() * 540 + "deg");
      document.body.append(s);
      setTimeout(() => s.remove(), 1100);
    }
  }

  // ---------- anteprima admin ----------
  async function startPreview() {
    $("intro").hidden = true;
    $("preview-bar").hidden = false;
    const input = $("preview-date");
    input.value = previewDate;
    await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js");
    const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY);
    const { data } = await sb.auth.getSession();
    if (!data.session) {
      document.body.innerHTML = '<p style="padding:24px">Per l\'anteprima fai prima il login nella pagina admin.</p>';
      return;
    }
    creds = { preview_date: previewDate, token: data.session.access_token };
    try {
      await reload();
      showCalendar();
    } catch {
      document.body.innerHTML = '<p style="padding:24px">Anteprima non permessa: rifai il login nella pagina admin.</p>';
    }
    input.addEventListener("change", () => {
      if (input.value) location.search = `?preview=${input.value}`;
    });
  }

  function loadScript(src) {
    return new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = ko;
      document.head.append(s);
    });
  }

  if (previewDate) startPreview();
})();
