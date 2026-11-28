(() => {
  const C = window.CONFIG;
  const $ = (id) => document.getElementById(id);
  // Ogni coppia ha il suo calendario: ?c=nome. Senza parametro è quello di Olly.
  const SLUG = (new URLSearchParams(location.search).get("c") || (C.DEFAULT_SLUG ?? "olly")).trim().toLowerCase();
  if (!SLUG) {
    // Sito senza calendario predefinito: serve il link personale.
    document.querySelector("#intro .intro-title").innerHTML = "Ti serve<br><em>il tuo link</em>";
    document.querySelector("#intro .kicker").textContent = "Calendario dell'avvento";
    for (const id of ["gift", "gift-hint", "code-form"]) document.getElementById(id).hidden = true;
    return;
  }
  const IS_DEFAULT = SLUG === "olly";
  const CODE_KEY = IS_DEFAULT ? "avvento-codice" : `avvento-codice-${SLUG}`;
  const SEEN_KEY = IS_DEFAULT ? "avvento-visti" : `avvento-visti-${SLUG}`;
  // Nomi: quelli di config.js per Olly, poi arrivano dal server per ogni calendario.
  const names = IS_DEFAULT
    ? { her: C.NOME_LEI, sign: C.FIRMA, intro: C.INTRO }
    : { her: "", sign: "", intro: C.INTRO };

  // Ordine "mescolato" delle caselle e forme del mosaico
  const ORDER = [24, 3, 11, 7, 21, 15, 1, 12, 18, 5, 4, 9, 20, 2, 14, 17, 6, 13, 8, 10, 22, 19, 16, 23];
  const SHAPE = { 24: "big", 11: "w2", 12: "w2", 10: "w2", 16: "w2", 6: "w2", 17: "w2", 4: "w2", 20: "w2", 9: "w2", 19: "w2", 5: "h2", 13: "h2", 21: "h2" };
  const GREEN = [11, 18, 4, 2, 13, 14], RED = [7, 15, 12, 20, 17, 10, 23], TARTAN = [8, 19];
  const ICON = { 11: "tree", 15: "mug", 12: "village", 21: "ornaments", 5: "holly", 20: "sprig", 6: "candycane", 10: "house", 16: "mountains", 1: "star", 13: "lantern", 18: "snowflake", 17: "pinecone", 14: "reindeer", 9: "stars", 3: "gift", 22: "candle" };

  const EMPTY = [
    ["💌", "La sorpresa di oggi si sta ancora incartando da sola… torna più tardi, ne vale la pena."],
    ["🤫", () => `Oggi la sorpresa è segreta anche per il calendario. Chiedi a ${names.sign || "lui"}, forse è in tasca sua.`],
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
  const LAST = () => `Buon Natale${names.her ? ", " + names.her : ""}! Il calendario finisce qui 🎄`;

  const params = new URLSearchParams(location.search);
  const previewDate = params.get("preview");

  let lastOpened = 0;
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
  function applyNames() {
    $("tag-name").textContent = names.her;
    $("her-name").textContent = names.her;
    $("intro-text").textContent = names.intro;
    $("signature").textContent = names.sign;
    document.title = names.her ? `Per ${names.her} 🎁` : "Calendario dell'avvento 🎁";
    const t = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (t) t.content = names.her ? `Per ${names.her}` : "Avvento";
  }
  applyNames();
  if (!IS_DEFAULT && C.DEFAULT_SLUG === undefined) {
    // App sulla schermata Home: deve riaprire questo calendario, non quello di Olly.
    const base = new URL("./", location.href).href;
    const link = document.querySelector('link[rel="manifest"]');
    if (link) {
      const m = {
        name: "Calendario dell'avvento", short_name: "Avvento", id: `./?c=${SLUG}`,
        start_url: `${base}?c=${SLUG}`, scope: base, display: "standalone",
        background_color: "#10261b", theme_color: "#10261b",
        icons: [
          { src: base + "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: base + "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      };
      link.href = "data:application/manifest+json," + encodeURIComponent(JSON.stringify(m));
    }
  }
  if (!IS_DEFAULT) {
    fetch(`${C.SUPABASE_URL}/functions/v1/calendar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: C.SUPABASE_KEY, Authorization: `Bearer ${C.SUPABASE_KEY}` },
      body: JSON.stringify({ calendar: SLUG, info: true }),
    }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d && d.her_name && !names.her) { names.her = d.her_name; applyNames(); }
    }).catch(() => {});
  }

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
      body: JSON.stringify({ ...body, calendar: SLUG }),
    });
    if (res.status === 404) throw new Error("calendario");
    if (res.status === 401) throw new Error("codice");
    if (!res.ok) throw new Error("server");
    const data = await res.json();
    fetchedAt = Date.now();
    if (data.calendar) {
      names.her = data.calendar.her_name || names.her;
      names.sign = data.calendar.signature || names.sign;
      names.intro = data.calendar.intro || names.intro;
      applyNames();
    }
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
        : e.message === "calendario" ? "Questo calendario non esiste: controlla il link."
        : "Il calendario non risponde. Riprova tra un attimo.";
      const f = $("code-form");
      f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake");
    } finally {
      btn.disabled = false;
    }
  });

  function showCalendar() {
    setupNotify();
    $("intro").hidden = true;
    $("calendar").hidden = false;
    document.body.classList.add("in-calendar");
    document.querySelector('meta[name="theme-color"]').content = "#2a0b12";
    window.scrollTo(0, 0);
  }

  // ---------- notifiche ----------
  const api = (body) => fetch(`${C.SUPABASE_URL}/functions/v1/calendar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: C.SUPABASE_KEY, Authorization: `Bearer ${C.SUPABASE_KEY}` },
    body: JSON.stringify({ ...body, calendar: SLUG }),
  });
  const NOTIFY_KEY = `avvento-notifiche-${SLUG}`;
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js?v=1").catch(() => {});

  async function subscribe() {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription())
      || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(C.VAPID_PUBLIC) });
    const res = await api({ action: "subscribe", code: creds.code, subscription: sub.toJSON(), page_url: location.href.split("#")[0] });
    if (!res.ok) throw new Error("server");
    store.set(NOTIFY_KEY, "1");
  }

  function setupNotify() {
    if (previewDate || !creds.code || !C.VAPID_PUBLIC || $("notify")) return;
    const box = el("div", "notify");
    box.id = "notify";
    const btn = el("button", "notify-btn", "🔔 Avvisami ogni mattina alle 8");
    btn.type = "button";
    const note = el("p", "notify-note");
    box.append(btn, note);
    document.querySelector(".cal-head").append(box);

    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const done = () => { btn.hidden = true; note.textContent = "🔔 Notifiche attive: ti avviso alle 8 quando c'è una nuova casella."; };

    if (!supported) {
      if (isIOS && !standalone) {
        btn.hidden = true;
        note.innerHTML = "Vuoi un avviso ogni mattina? Tocca <b>Condividi</b> e poi <b>Aggiungi alla schermata Home</b>, poi apri il calendario dall'icona.";
      } else box.hidden = true;
      return;
    }
    if (Notification.permission === "denied") { box.hidden = true; return; }
    if (Notification.permission === "granted") {
      // Già consentite: rinnova l'iscrizione in silenzio (es. dopo un cambio di telefono).
      subscribe().then(done).catch(() => {});
      if (store.get(NOTIFY_KEY)) done();
    }
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") { box.hidden = true; return; }
        await subscribe();
        done();
        toast("Fatto! Domattina alle 8 ti avviso 🔔");
      } catch {
        note.textContent = "Non sono riuscito ad attivarle, riprova più tardi.";
      } finally { btn.disabled = false; }
    });
  }

  // ---------- calendario ----------
  function seenSet() {
    try { return new Set(JSON.parse(store.get(SEEN_KEY) || "[]")); } catch { return new Set(); }
  }
  function markSeen(day) {
    if (previewDate) return;
    const s = seenSet(); s.add(day);
    store.set(SEEN_KEY, JSON.stringify([...s]));
    // Per il promemoria delle 20: oggi l'ha già aperta.
    if (creds.code) api({ action: "opened", day, code: creds.code }).catch(() => {});
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
      t.dataset.day = day;
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
          const tag = el("span", "htag" + (day === lastOpened ? " swing" : ""));
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
    // Prima del 1° dicembre: caselle sfocate con un lucchetto sopra.
    grid.classList.toggle("waiting", unlocked === 0);
    let lock = $("wait-lock");
    if (unlocked === 0 && !lock) {
      lock = el("div", "wait-lock"); lock.id = "wait-lock";
      const card = el("div", "wait-card");
      card.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.2" r="1.3"/></svg>';
      card.append(el("strong", "", "Si apre il 1° dicembre"), el("span", "", "24 piccole sorprese ti aspettano ✨"));
      lock.append(card);
      grid.before(lock);
    } else if (unlocked > 0 && lock) lock.remove();
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
  // ---------- suono all'apertura ----------
  // Il primo audio del giorno (es. un vocale) parte da solo quando lei apre la casella;
  // se non c'è, suonano dei campanellini leggeri. I browser lo permettono solo dopo un tocco,
  // quindi "sblocchiamo" l'audio subito, dentro il tocco, e lo facciamo partire dopo l'animazione.
  const SOUND_KEY = "avvento-suono";
  let soundOn = store.get(SOUND_KEY) !== "off";
  const voice = document.createElement("audio");
  voice.controls = true; voice.preload = "auto"; voice.setAttribute("playsinline", "");
  const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
  let actx = null, unlocked = false;

  function unlockAudio() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
    } catch {}
    if (!unlocked) {
      voice.src = SILENT;
      const p = voice.play();
      if (p) p.then(() => { unlocked = true; }).catch(() => {});
    }
  }

  function chime() {
    if (!actx || !soundOn) return;
    const t0 = actx.currentTime + 0.05;
    [1318.5, 1568, 1975.5, 2637].forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "sine"; o.frequency.value = f;
      const t = t0 + i * 0.11;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + 1.2);
    });
  }

  function stopVoice() { try { voice.pause(); } catch {} }
  function detachVoice() { const w = voice.parentElement; if (w && w.classList.contains("aplayer")) w.remove(); else voice.remove(); }

  // ---------- lettore audio con onda (al posto dei controlli del browser) ----------
  const ICO = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
    spotify: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M6.5 9.2c3.8-1.1 8-.8 11.2 1M7.2 12.4c3.1-.9 6.4-.6 9.1.9M7.9 15.4c2.4-.6 4.9-.4 7 .7" fill="none" stroke="#fbf3e3" stroke-width="1.7" stroke-linecap="round"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="5" width="21" height="14" rx="4" fill="currentColor"/><path d="M10 9v6l5-3z" fill="#fbf3e3"/></svg>',
    maps: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.4 7-12a7 7 0 0 0-14 0c0 5.6 7 12 7 12z" fill="currentColor"/><circle cx="12" cy="10" r="2.6" fill="#fbf3e3"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const fmtTime = (t) => (isFinite(t) && t > 0 ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}` : "0:00");
  function player(a, seed = "") {
    a.controls = false;
    const wrap = el("div", "aplayer");
    const btn = el("button", "ap-play"); btn.type = "button"; btn.setAttribute("aria-label", "Ascolta");
    const wave = el("div", "ap-wave");
    const time = el("span", "ap-time", "0:00");
    let h = 7; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const N = 38, bars = [];
    let prev = 0.5;
    for (let i = 0; i < N; i++) {
      h = (h * 1103515245 + 12345) >>> 0;
      prev = Math.min(1, Math.max(0.18, prev * 0.45 + ((h >>> 8) % 1000) / 1000 * 0.75));
      const b = el("i"); b.style.height = Math.round(prev * 100) + "%"; bars.push(b); wave.append(b);
    }
    wrap.append(btn, wave, time, a);
    if (a._ac) a._ac.abort();
    const ac = new AbortController(); a._ac = ac;
    const upd = () => {
      const p = a.duration && isFinite(a.duration) ? a.currentTime / a.duration : 0;
      bars.forEach((b, i) => b.classList.toggle("on", i / N < p));
      time.textContent = a.duration && isFinite(a.duration) ? `${fmtTime(a.currentTime)} / ${fmtTime(a.duration)}` : fmtTime(a.currentTime);
      btn.innerHTML = a.paused ? ICO.play : ICO.pause;
      wrap.classList.toggle("playing", !a.paused);
    };
    for (const e of ["timeupdate", "loadedmetadata", "durationchange", "play", "pause", "ended"]) a.addEventListener(e, upd, { signal: ac.signal });
    btn.addEventListener("click", () => {
      unlockAudio();
      if (a.paused) { document.querySelectorAll("#s-body audio").forEach((x) => x !== a && x.pause()); a.play().catch(() => {}); } else a.pause();
    });
    wave.addEventListener("click", (e) => {
      if (!a.duration || !isFinite(a.duration)) return;
      const r = wave.getBoundingClientRect();
      a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * a.duration;
    });
    upd();
    return wrap;
  }

  // ---------- link con anteprima (copertina e titolo presi dall'admin) ----------
  function linkCard(d, info) {
    const url = d.link_url;
    let host = "", path = "";
    try { const u = new URL(url); host = u.hostname.replace(/^www\./, ""); path = u.pathname; } catch {}
    const kind = /spotify\./.test(host) ? "spotify" : /youtu\.?be/.test(host) ? "youtube"
      : /maps/.test(host + path) ? "maps" : "link";
    const media = kind === "spotify" || kind === "youtube" || /vimeo|soundcloud/.test(host);
    const a = el("a", "lcard " + kind + (info && info.image ? " big" : ""));
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    const prov = (info && info.provider) || { spotify: "Spotify", youtube: "YouTube", maps: "Mappa" }[kind] || host;
    const title = d.link_label || (info && info.title) || "Apri il link ✨";
    const sub = d.link_label && info && info.title && info.title !== d.link_label ? info.title : "";
    if (info && info.image) {
      const cov = el("span", "lc-cover");
      const img = document.createElement("img");
      img.src = info.image; img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer";
      img.onerror = () => { a.classList.remove("big"); cov.remove(); };
      cov.append(img);
      a.append(cov);
    }
    const row = el("span", "lc-row");
    const icon = el("span", "lc-icon"); icon.innerHTML = ICO[kind] || ICO.link;
    const text = el("span", "lc-text");
    text.append(el("small", "", prov));
    text.append(el("strong", "", title));
    if (sub) text.append(el("span", "lc-sub", sub));
    const go = el("span", "lc-go"); go.innerHTML = media ? ICO.play : ICO.out;
    row.append(icon, text, go);
    a.append(row);
    return a;
  }

  // Mette il lettore audio del giorno nella sorpresa e, se il suono è attivo, lo fa partire.
  function playDaySound(audioFile, box, silent = false) {
    stopVoice();
    if (silent) {
      detachVoice();
    } else if (audioFile && audioFile.url) {
      voice.src = audioFile.url;
      box.prepend(player(voice, audioFile.name || audioFile.url));
      if (soundOn) voice.play().catch(() => {});
    } else {
      detachVoice();
      chime();
    }
  }

  function renderSoundBtn() {
    const b = $("s-sound");
    b.textContent = soundOn ? "🔊" : "🔇";
    b.setAttribute("aria-label", soundOn ? "Togli il suono" : "Metti il suono");
  }
  $("s-save").addEventListener("click", () => saveCard(currentDay));
  $("s-sound").addEventListener("click", () => {
    soundOn = !soundOn;
    store.set(SOUND_KEY, soundOn ? "on" : "off");
    renderSoundBtn();
    if (!soundOn) stopVoice();
    else { unlockAudio(); if (voice.isConnected && voice.src.startsWith("http")) voice.play().catch(() => {}); }
  });
  renderSoundBtn();

  async function onTile(day, tile) {
    if (opening) return;
    if (day <= state.unlocked) unlockAudio();
    if (day > state.unlocked && Date.now() - fetchedAt > 60e3) {
      try { await reload(); } catch {}
      if (day <= state.unlocked) return onTile(day, $("grid").querySelector(`[data-day="${day}"]`) || tile);
    }
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
    letter.append(el("span", "", `${day} dicembre`), el("b", "", "Per " + names.her));
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
  let soundBox = null, soundFile = null, soundSilent = false;
  function openSurprise(day) {
    currentDay = day;
    soundBox = null; soundFile = null; soundSilent = false;
    const d = state.days.get(day);
    const body = $("s-body");
    body.textContent = "";
    $("s-date").textContent = `${day} dicembre`;
    const title = $("s-title");

    const media = (d && d.media) || [];
    const voucher = media.find((f) => f.type === "voucher");
    const hasContent = d && (d.title || d.message || d.link_url || media.length);
    if (!hasContent) {
      const [emoji, t] = EMPTY[day % EMPTY.length];
      const text = typeof t === "function" ? t() : t;
      title.textContent = "Un attimo di pazienza";
      const box = el("div", "empty");
      box.append(el("div", "big-emoji", emoji), el("p", "", text));
      body.append(box);
    } else {
      title.textContent = d.title || (day === 24 ? "Buon Natale!" : "La sorpresa di oggi");
      title.append(el("span", "t-heart", " ♡"));
      if (voucher) body.append(voucherCard(voucher, day));
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
      // Audio che parte da solo: quello scelto nell'admin (autoplay); per i giorni vecchi senza scelta, il primo.
      const audios = media.filter((f) => f.url && f.type === "audio");
      const chosen = audios.some((f) => typeof f.autoplay === "boolean");
      const firstAudio = chosen ? audios.find((f) => f.autoplay) : audios[0];
      if (audios.length && !firstAudio) soundSilent = true; // ha degli audio ma nessuno parte da solo: niente campanellini
      const others = media.filter((f) => f.url && (f.type === "video" || f.type === "audio") && f !== firstAudio);
      const m = el("div", "media");
      if (firstAudio) { soundBox = m; soundFile = firstAudio; }
      if (others.length || firstAudio) {
        for (const f of others) {
          const node = document.createElement(f.type);
          node.controls = true; node.preload = "metadata"; node.src = f.url;
          if (f.type === "video") { node.playsInline = true; m.append(node); }
          else m.append(player(node, f.name || f.url));
        }
        body.append(m);
      }
      if (/^https?:\/\//i.test(d.link_url || "")) {
        body.append(linkCard(d, media.find((f) => f.type === "link")));
      }
    }
    const phrase = day === 24 ? LAST() : day < state.unlocked ? PAST : NEXT[day % NEXT.length];
    body.append(el("p", "see-you", phrase));
    $("s-save").hidden = !(hasContent && d.allow_download !== false);

    // frecce: solo tra i giorni che può già aprire
    $("s-count").textContent = `${day} / 24`;
    $("s-prev").disabled = day <= 1;
    $("s-next").disabled = day >= Math.min(state.unlocked, 24);

    const dlg = $("surprise");
    const sheetEl = dlg.querySelector(".sheet");
    sheetEl.classList.remove("enter"); void sheetEl.offsetWidth; sheetEl.classList.add("enter");
    sheetEl.classList.toggle("xmas", day === 24 && !!hasContent);
    lastOpened = day;
    if (!dlg.open) { dlg.showModal(); startSnow(); }
    playDaySound(soundFile, soundBox, soundSilent);
    dlg.scrollTop = 0;
    dlg.querySelector(".sheet").scrollTop = 0;
  }

  // ---------- salva la cartolina (immagine) e i file originali ----------
  const slugName = (t) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  async function saveCard(day) {
    const d = state.days.get(day);
    const dlg = $("surprise");
    dlg.querySelector(".save-ov")?.remove();
    const ov = el("div", "save-ov");
    const box = el("div", "save-box");
    const close = el("button", "save-x", "×"); close.type = "button"; close.setAttribute("aria-label", "Chiudi");
    close.addEventListener("click", () => ov.remove());
    const status = el("p", "save-status", "Preparo la cartolina…");
    box.append(close, el("h3", "", "La tua cartolina ✨"), status);
    ov.append(box);
    dlg.append(ov);
    const base = [slugName(names.her) || "cartolina", day, "dicembre"].join("-");
    let blob;
    try {
      blob = await window.POSTCARD.make(day, d, { her: names.her, sign: names.sign });
    } catch {
      status.textContent = "Non sono riuscito a preparare la cartolina. Riprova tra poco.";
      return;
    }
    const url = URL.createObjectURL(blob);
    const file = new File([blob], base + ".jpg", { type: "image/jpeg" });
    const img = document.createElement("img");
    img.className = "save-img"; img.src = url; img.alt = `Cartolina del ${day} dicembre`;
    status.replaceWith(img);
    const btn = el("button", "save-go", "");
    btn.type = "button";
    const canShare = navigator.canShare && navigator.canShare({ files: [file] });
    if (canShare && (isIOS || matchMedia("(pointer: coarse)").matches)) {
      btn.textContent = isIOS ? "Salva nelle Foto" : "Salva o condividi";
      btn.addEventListener("click", () => navigator.share({ files: [file] }).catch(() => {}));
    } else {
      btn.textContent = "⬇ Scarica la cartolina";
      btn.addEventListener("click", () => { const a = document.createElement("a"); a.href = url; a.download = file.name; document.body.append(a); a.click(); a.remove(); });
    }
    box.append(btn);
    if (isIOS) box.append(el("p", "save-hint", "Se non va, tieni premuto sull'immagine e scegli «Salva nelle Foto»."));
    const files = ((d && d.media) || []).filter((f) => f.url && ["image", "video", "audio"].includes(f.type));
    if (files.length) {
      const ul = el("div", "save-files");
      ul.append(el("p", "", "Anche i file originali:"));
      files.forEach((f, i) => {
        const ext = (f.name.split(".").pop() || "").toLowerCase().slice(0, 5);
        const name = `${base}-${i + 1}${ext ? "." + ext : ""}`;
        const n = files.slice(0, i + 1).filter((x) => x.type === f.type).length;
        const a = el("a", "", (f.type === "image" ? "📷 Foto" : f.type === "video" ? "🎬 Video" : "🎧 Audio") + ` ${n}`);
        a.href = f.url + (f.url.includes("?") ? "&" : "?") + "download=" + encodeURIComponent(name);
        a.download = name; a.rel = "noopener";
        ul.append(a);
      });
      box.append(ul);
    }
  }

  // Buono: busta che si apre e biglietto con intestazione modificabile (vuota = nessuna intestazione)
  function voucherCard(f, day) {
    const wrap = el("div", "voucher play");
    const ticket = el("div", "ticket");
    const paper = el("div", "t-paper");
    const main = el("div", "t-main");
    const label = typeof f.label === "string" ? f.label : "Un regalo per te";
    if (label.trim()) main.append(el("span", "v-small", label.trim()));
    main.append(el("strong", "", f.caption || "una sorpresa"), el("i", "", "♡"));
    const stub = el("div", "t-stub");
    stub.append(el("span", "", "N°"), el("b", "", String(day).padStart(2, "0")), el("em", "", "♥"));
    paper.append(main, stub);
    ticket.append(paper);
    wrap.append(el("span", "env-back"), el("span", "env-flap"), ticket, el("span", "env-front"), el("span", "twine"));
    return wrap;
  }

  function goTo(day) {
    if (day < 1 || day > state.unlocked || day > 24) return;
    unlockAudio();
    const sheet = $("surprise").querySelector(".sheet");
    const dir = day > currentDay ? 1 : -1;
    sheet.animate([{ opacity: 1, transform: "translateX(0)" }, { opacity: 0, transform: `translateX(${-30 * dir}px)` }], { duration: 160, fill: "forwards" })
      .finished.then(() => {
        openSurprise(day);
        markSeen(day);
        sheet.animate([{ opacity: 0, transform: `translateX(${30 * dir}px)` }, { opacity: 1, transform: "translateX(0)" }], { duration: 220, easing: "ease-out", fill: "forwards" });
      });
  }


  const dlg = $("surprise");
  dlg.querySelector(".close").addEventListener("click", () => dlg.close());
  $("s-prev").addEventListener("click", () => goTo(currentDay - 1));
  $("s-next").addEventListener("click", () => goTo(currentDay + 1));
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  // scorri col dito a destra/sinistra per cambiare giorno
  let touch = null;
  dlg.addEventListener("touchstart", (e) => { const t = e.touches[0]; touch = { x: t.clientX, y: t.clientY }; }, { passive: true });
  dlg.addEventListener("touchend", (e) => {
    if (!touch) return;
    const t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8 && !e.target.closest("video, audio, input")) goTo(currentDay + (dx < 0 ? 1 : -1));
  }, { passive: true });
  dlg.addEventListener("close", () => {
    dlg.querySelectorAll("video, audio").forEach((m) => m.pause());
    stopVoice();
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
      if (input.value) location.search = `?preview=${input.value}${IS_DEFAULT ? "" : "&c=" + SLUG}`;
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
