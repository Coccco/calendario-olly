// "Cartolina": disegna la sorpresa del giorno su un canvas (niente librerie, funziona anche su iPhone).
// POSTCARD.make(day, data, { her, sign }) -> Promise<Blob> (JPEG verticale 1080px)
window.POSTCARD = (() => {
  const W = 1080, PAD = 70, CW = W - PAD * 2; // larghezza del foglio
  const INK = "#3a1017", WINE = "#7c1622", RED = "#b3222a", CREAM = "#fbf3e3";
  const SERIF = "'Playfair Display', Georgia, serif";
  const BODY = "'EB Garamond', Georgia, serif";
  const HAND = "Caveat, 'Segoe Script', cursive";

  const loadImg = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });

  // Foto da un altro dominio: la scarico come blob così il canvas non si "sporca" (CORS).
  async function photo(url) {
    const blob = await fetch(url, { mode: "cors" }).then((r) => { if (!r.ok) throw 0; return r.blob(); });
    const u = URL.createObjectURL(blob);
    try { return await loadImg(u); } finally { setTimeout(() => URL.revokeObjectURL(u), 5000); }
  }
  // Copertina di un video: un fotogramma dopo mezzo secondo (se il telefono lo permette).
  function videoFrame(url) {
    return new Promise((ok, ko) => {
      const v = document.createElement("video");
      v.crossOrigin = "anonymous"; v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
      const t = setTimeout(() => ko(new Error("timeout")), 6000);
      v.addEventListener("loadeddata", () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); }, { once: true });
      v.addEventListener("seeked", () => {
        clearTimeout(t);
        const c = document.createElement("canvas");
        c.width = v.videoWidth; c.height = v.videoHeight;
        try { c.getContext("2d").drawImage(v, 0, 0); ok(c); } catch (e) { ko(e); }
      }, { once: true });
      v.addEventListener("error", () => { clearTimeout(t); ko(new Error("video")); }, { once: true });
    });
  }

  function lines(ctx, text, max) {
    const out = [];
    for (const para of String(text).split(/\n/)) {
      let cur = "";
      for (const w of para.split(/\s+/)) {
        const t = cur ? cur + " " + w : w;
        if (ctx.measureText(t).width > max && cur) { out.push(cur); cur = w; } else cur = t;
      }
      out.push(cur);
    }
    return out;
  }
  function spaced(ctx, text, x, y, sp) { // testo con spaziatura tra le lettere, centrato su x
    const chars = [...text];
    const w = chars.reduce((a, ch) => a + ctx.measureText(ch).width + sp, -sp);
    let cx = x - w / 2;
    ctx.textAlign = "left";
    for (const ch of chars) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; }
    ctx.textAlign = "center";
    return w;
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function cover(ctx, img, x, y, w, h) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const s = Math.max(w / iw, h / ih), sw = w / s, sh = h / s;
    ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
  }

  async function make(day, d, opt = {}) {
    await Promise.all([
      `italic 700 60px ${SERIF}`, `700 30px ${SERIF}`, `400 40px ${BODY}`, `600 60px ${HAND}`,
    ].map((f) => document.fonts?.load(f).catch(() => {})));

    const media = (d && d.media) || [];
    // carico in anticipo foto, copertine e fiocco
    const pics = [];
    for (const f of media) {
      if (!f.url || (f.type !== "image" && f.type !== "video")) continue;
      if (pics.length >= 3) break;
      let img = null;
      try { img = f.type === "image" ? await photo(f.url) : await videoFrame(f.url); } catch { img = null; }
      pics.push({ img, type: f.type, caption: f.caption || "" });
    }
    let bow = null;
    if (window.DECOR) {
      const svg = DECOR.bow().replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" ');
      try { bow = await loadImg("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)); } catch { bow = null; }
    }

    // prima misuro, poi disegno (stessa funzione, con draw=false/true)
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    const voucher = media.find((f) => f.type === "voucher");
    const audios = media.filter((f) => f.type === "audio").length;
    const title = (d && d.title) || (day === 24 ? "Buon Natale!" : "La sorpresa di oggi");

    function layout(draw) {
      let y = PAD + 90;
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      // data
      ctx.font = `700 30px ${SERIF}`; ctx.fillStyle = WINE;
      if (draw) {
        const w = spaced(ctx, `${day} DICEMBRE`, W / 2, y, 9);
        ctx.fillRect(W / 2 - w / 2 - 110, y - 10, 80, 2); ctx.fillRect(W / 2 + w / 2 + 30, y - 10, 80, 2);
      }
      y += 95;
      // titolo
      ctx.font = `italic 700 72px ${SERIF}`;
      for (const l of lines(ctx, title + " ♡", CW - 120)) { if (draw) { ctx.fillStyle = WINE; ctx.fillText(l, W / 2, y); } y += 84; }
      // fiocco
      if (bow) { if (draw) ctx.drawImage(bow, W / 2 - 120, y - 40, 240, 160); y += 140; } else y += 20;

      // buono
      if (voucher) {
        const bx = PAD + 70, bw = CW - 140, th = 300;
        if (draw) {
          // busta
          ctx.save(); ctx.shadowColor = "rgba(40,0,6,.35)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
          ctx.fillStyle = "#8f141b"; rr(ctx, bx - 20, y + 130, bw + 40, 260, 14); ctx.fill(); ctx.restore();
          // biglietto
          ctx.save(); ctx.translate(W / 2, y + th / 2 + 20); ctx.rotate(-0.025);
          ctx.shadowColor = "rgba(60,10,14,.3)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
          ctx.fillStyle = CREAM; rr(ctx, -bw / 2, -th / 2, bw, th, 10); ctx.fill(); ctx.shadowColor = "transparent";
          ctx.fillStyle = "#8f141b"; for (const sx of [-bw / 2, bw / 2]) { ctx.beginPath(); ctx.arc(sx, 0, 20, 0, Math.PI * 2); ctx.fill(); }
          ctx.setLineDash([8, 8]); ctx.strokeStyle = "rgba(142,27,34,.35)"; ctx.lineWidth = 3;
          ctx.strokeRect(-bw / 2 + 26, -th / 2 + 18, bw - 160, th - 36);
          ctx.beginPath(); ctx.moveTo(bw / 2 - 110, -th / 2 + 10); ctx.lineTo(bw / 2 - 110, th / 2 - 10); ctx.stroke(); ctx.setLineDash([]);
          const mid = -55;
          const label = typeof voucher.label === "string" ? voucher.label.trim() : "Un regalo per te";
          ctx.fillStyle = "#a6464b"; ctx.font = `700 24px ${SERIF}`;
          if (label) spaced(ctx, "✦ " + label.toUpperCase() + " ✦", mid, -th / 2 + 70, 5);
          ctx.fillStyle = "#8e1b22"; ctx.font = `600 64px ${HAND}`;
          const vl = lines(ctx, voucher.caption || "una sorpresa", bw - 220).slice(0, 3);
          vl.forEach((l, i) => ctx.fillText(l, mid, -th / 2 + (label ? 140 : 110) + i * 64 + (3 - vl.length) * 18));
          ctx.fillStyle = "#a6464b"; ctx.font = `700 22px ${SERIF}`; ctx.fillText("N°", bw / 2 - 55, -30);
          ctx.fillStyle = "#8e1b22"; ctx.font = `italic 700 44px ${SERIF}`; ctx.fillText(String(day).padStart(2, "0"), bw / 2 - 55, 22);
          ctx.restore();
          // tasca davanti
          ctx.fillStyle = "#a3191f";
          ctx.beginPath(); ctx.moveTo(bx - 20, y + 300); ctx.lineTo(W / 2, y + 360); ctx.lineTo(bx + bw + 20, y + 300);
          ctx.lineTo(bx + bw + 20, y + 390); ctx.lineTo(bx - 20, y + 390); ctx.closePath(); ctx.fill();
        }
        y += 440;
      }

      // polaroid
      pics.forEach((p, i) => {
        const pw = 760, ph = 620, fh = ph + 130;
        if (draw) {
          ctx.save(); ctx.translate(W / 2, y + fh / 2); ctx.rotate(i % 2 ? 0.03 : -0.035);
          ctx.shadowColor = "rgba(0,0,0,.28)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12;
          ctx.fillStyle = "#fffdf8"; ctx.fillRect(-pw / 2 - 26, -fh / 2, pw + 52, fh); ctx.shadowColor = "transparent";
          if (p.img) cover(ctx, p.img, -pw / 2, -fh / 2 + 26, pw, ph);
          else { ctx.fillStyle = "#e9dfcf"; ctx.fillRect(-pw / 2, -fh / 2 + 26, pw, ph); ctx.fillStyle = WINE; ctx.font = `400 44px ${BODY}`; ctx.fillText(p.type === "video" ? "🎬 un video per te" : "📷", 0, -fh / 2 + 26 + ph / 2); }
          if (p.type === "video" && p.img) { // simbolo play sulla copertina
            ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.beginPath(); ctx.arc(0, -fh / 2 + 26 + ph / 2, 60, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#fff"; ctx.beginPath(); const cy = -fh / 2 + 26 + ph / 2; ctx.moveTo(-18, cy - 30); ctx.lineTo(32, cy); ctx.lineTo(-18, cy + 30); ctx.fill();
          }
          ctx.fillStyle = "rgba(225,205,160,.75)"; ctx.fillRect(-90, -fh / 2 - 22, 180, 48); // scotch
          ctx.fillStyle = "#4a2a22"; ctx.font = `600 50px ${HAND}`;
          ctx.fillText((p.caption || "♡").slice(0, 40), 0, fh / 2 - 38);
          ctx.restore();
        }
        y += fh + 50;
      });

      // messaggio
      if (d && d.message) {
        ctx.font = `400 42px ${BODY}`; ctx.fillStyle = INK;
        y += 20;
        for (const l of lines(ctx, d.message, CW - 140)) { if (draw) ctx.fillText(l, W / 2, y); y += 58; }
      }
      // audio e link
      const extra = [];
      if (audios) extra.push(audios === 1 ? "🎧 con un vocale" : `🎧 con ${audios} audio`);
      if (d && d.link_url) extra.push("🔗 " + (d.link_label || "e un link"));
      if (extra.length) {
        y += 20; ctx.font = `italic 400 34px ${BODY}`; ctx.fillStyle = "#8a6a6f";
        if (draw) ctx.fillText(extra.join("   ·   "), W / 2, y);
        y += 40;
      }
      // firma
      y += 50;
      if (opt.sign) { ctx.font = `600 56px ${HAND}`; ctx.fillStyle = WINE; if (draw) ctx.fillText(`con affetto, ${opt.sign} ♡`, W / 2, y); y += 40; }
      y += 30;
      ctx.font = `700 22px ${SERIF}`; ctx.fillStyle = "rgba(124,22,34,.6)";
      if (draw) spaced(ctx, "CALENDARIO DELL'AVVENTO 2026", W / 2, y, 5);
      return y + PAD + 40;
    }

    c.width = W; c.height = 10;
    const H = Math.max(1350, Math.ceil(layout(false)));
    c.width = W; c.height = H;

    // sfondo verde con neve
    const g = ctx.createRadialGradient(W / 2, 0, 100, W / 2, H / 2, H);
    g.addColorStop(0, "#24503a"); g.addColorStop(1, "#0e2218");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,.55)";
    for (let i = 0; i < 90; i++) { const r = ((i * 37) % 5) + 1.5; ctx.beginPath(); ctx.arc((i * 211) % W, (i * 389) % H, r, 0, Math.PI * 2); ctx.fill(); }
    // foglio con bordi strappati
    const top = PAD - 20, bottom = H - PAD + 20;
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
    ctx.beginPath(); ctx.moveTo(PAD - 10, top + 10);
    for (let x = PAD - 10, i = 0; x <= W - PAD + 10; x += 18, i++) ctx.lineTo(x, top + ((i * 7) % 3) * 6);
    ctx.lineTo(W - PAD + 10, bottom);
    for (let x = W - PAD + 10, i = 0; x >= PAD - 10; x -= 18, i++) ctx.lineTo(x, bottom - ((i * 5) % 3) * 6);
    ctx.closePath();
    const pg = ctx.createLinearGradient(0, 0, W, H); pg.addColorStop(0, "#fdf6e8"); pg.addColorStop(1, "#ecdcbc");
    ctx.fillStyle = pg; ctx.fill(); ctx.restore();
    layout(true);

    return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("canvas"))), "image/jpeg", 0.9));
  }

  return { make };
})();
