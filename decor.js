// Disegni (SVG) del calendario: fiocco, cuore, illustrazioni delle caselle, rami di pino.
window.DECOR = (() => {
  const RED = "#c0262d", LEAF = "#2f6b45", FLAME = "#f5c76a";

  let bowN = 0;
  const BOW_TPL = `<svg viewBox="0 0 120 80" aria-hidden="true">
    <defs>
      <linearGradient id="bw1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0444b"/><stop offset="1" stop-color="#8d121a"/></linearGradient>
      <linearGradient id="bw2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b81f27"/><stop offset="1" stop-color="#6e0d14"/></linearGradient>
    </defs>
    <path fill="url(#bw2)" d="M56 38 L34 76 L44 72 L48 80 L62 40Z"/>
    <path fill="url(#bw2)" d="M64 38 L86 76 L76 72 L72 80 L58 40Z"/>
    <path fill="url(#bw1)" d="M60 36 C44 10 14 4 10 20 C6 36 34 44 60 36Z"/>
    <path fill="url(#bw1)" d="M60 36 C76 10 106 4 110 20 C114 36 86 44 60 36Z"/>
    <path fill="none" stroke="#6e0d14" stroke-opacity=".45" stroke-width="1.5" d="M58 34 C42 18 22 14 18 22 M62 34 C78 18 98 14 102 22"/>
    <path fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2" d="M20 16 C30 10 44 16 54 30 M100 16 C90 10 76 16 66 30"/>
    <ellipse cx="60" cy="37" rx="9" ry="8" fill="#a3161e"/>
    <ellipse cx="58" cy="35" rx="3.5" ry="2.5" fill="#fff" fill-opacity=".25"/>
  </svg>`;
  const bow = () => { bowN++; return BOW_TPL.replaceAll("bw1", "bw1_" + bowN).replaceAll("bw2", "bw2_" + bowN); };

  const HEART = `<svg viewBox="0 0 60 50" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M30 46 C14 34 4 24 7 13 C10 3 24 3 29 15 C33 2 52 2 54 14 C56 25 44 34 30 46 C28 47 26 45 27 44"/></svg>`;

  const HOLLY = `<g stroke="none">
      <path fill="${LEAF}" d="M32 34 C24 22 12 22 4 28 C10 29 10 35 6 38 C15 41 25 41 32 34Z"/>
      <path fill="${LEAF}" d="M32 34 C40 22 52 22 60 28 C54 29 54 35 58 38 C49 41 39 41 32 34Z"/>
      <path fill="#245639" d="M32 32 C28 22 30 12 38 6 C38 12 44 14 46 12 C44 22 38 30 32 32Z"/>
      <circle fill="${RED}" cx="28" cy="38" r="4.5"/><circle fill="${RED}" cx="36" cy="38" r="4.5"/><circle fill="${RED}" cx="32" cy="32" r="4.5"/>
      <circle fill="#fff" fill-opacity=".5" cx="30.5" cy="30.5" r="1.3"/></g>`;

  const ICONS = {
    tree: `<path d="M32 6 L23 20 H28 L19 33 H26 L16 47 H48 L38 33 H45 L36 20 H41 Z"/><path d="M32 47 V53"/><path d="M2 58 Q18 50 32 56 T64 54"/><path d="M32 2 l1 2 2 .3 -1.5 1.4 .4 2 -1.9-1 -1.9 1 .4-2 -1.5-1.4 2-.3z"/>`,
    mug: `<path d="M14 28 H42 V46 Q42 56 32 56 H24 Q14 56 14 46 Z"/><path d="M42 31 Q53 31 53 39 Q53 47 42 46"/><path d="M23 22 Q19 17 23 12 Q27 7 23 2"/><path d="M33 22 Q29 17 33 12"/><path d="M28 47 C20 41 22 35 26 36 C28 36.5 28 38 28 38 C28 38 28 36.5 30 36 C34 35 36 41 28 47Z"/>`,
    mountains: `<path d="M0 56 L20 24 L29 36 L38 18 L64 56"/><path d="M16 30 L20 24 L25 31 L22 29 Z"/><path d="M34 25 L38 18 L43 26 L39 24 Z"/><path d="M44 56 L48 44 L52 56 M50 56 L54 40 L58 56"/><path d="M6 10 l.8 1.6 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.2z"/>`,
    house: `<path d="M14 54 V34 L30 20 L46 34 V54 Z"/><path d="M38 27 V16 H43 V31"/><path d="M41 12 Q37 8 41 5 Q45 2 42 -1"/><path d="M26 54 V43 H34 V54"/><path d="M18 38 h5 v5 h-5z M37 38 h5 v5 h-5z"/><path d="M2 54 L6 42 L10 54 M50 54 L55 38 L60 54"/><path d="M0 56 H64"/>`,
    ornaments: `<path d="M20 0 V20 M44 0 V28"/><path d="M17 20 h6 v3 h-6z M41 28 h6 v3 h-6z"/><circle cx="20" cy="33" r="10"/><circle cx="44" cy="40" r="9"/><path d="M10.5 30 Q20 35 29.5 30 M11 36 Q20 40 29 36 M36 37 Q44 42 52 37"/>`,
    sprig: `<path d="M6 58 Q26 40 58 8"/><path d="M18 46 Q12 38 16 32 Q22 38 18 46Z M28 38 Q34 30 40 32 Q36 40 28 38Z M34 30 Q28 22 32 16 Q38 22 34 30Z M44 22 Q50 14 56 16 Q52 24 44 22Z"/><g fill="${RED}" stroke="none"><circle cx="24" cy="44" r="3"/><circle cx="40" cy="27" r="3"/><circle cx="52" cy="12" r="3"/><circle cx="12" cy="52" r="2.5"/></g>`,
    lantern: `<path d="M32 2 V8"/><path d="M26 8 H38 L41 14 H23 Z"/><path d="M24 14 H40 V46 H24 Z"/><path d="M21 46 H43 V51 H21Z"/><path d="M28 18 V42 M36 18 V42"/><path fill="${FLAME}" stroke="none" d="M32 25 C28.5 30 29 34 32 36 C35 34 35.5 30 32 25Z"/>`,
    star: `<path d="M32 4 L36.5 25.5 L58 30 L36.5 34.5 L32 56 L27.5 34.5 L6 30 L27.5 25.5 Z"/><path d="M52 8 v8 M48 12 h8 M10 46 v6 M7 49 h6"/>`,
    snowflake: `<path d="M32 4 V60 M8 18 L56 46 M8 46 L56 18"/><path d="M26 9 L32 15 L38 9 M26 55 L32 49 L38 55 M9 25 L17 23 L15 15 M55 39 L47 41 L49 49 M9 39 L17 41 L15 49 M55 25 L47 23 L49 15"/>`,
    candle: `<path d="M25 28 H39 V58 H25Z"/><path d="M32 28 V22"/><path fill="${FLAME}" stroke="none" d="M32 7 C26.5 14 27.5 20 32 22 C36.5 20 37.5 14 32 7Z"/><path d="M18 58 H46"/><path d="M14 12 l.8 1.6 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.2z"/>`,
    gift: `<path d="M12 28 H52 V56 H12Z"/><path d="M8 20 H56 V28 H8Z"/><path d="M32 20 V56"/><path d="M32 20 C24 8 14 10 18 18 C20 21 28 20 32 20 C36 20 44 21 46 18 C50 10 40 8 32 20Z"/>`,
    stars: `<path d="M20 14 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5-6 -6-2.5 6-2.5z"/><path d="M46 30 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6-4 -4-1.6 4-1.6z"/><path d="M0 58 Q22 44 40 52 T64 50"/><circle cx="54" cy="10" r=".8"/><circle cx="34" cy="8" r=".8"/>`,
    reindeer: `<path d="M14 40 Q16 30 26 30 H42 Q48 30 50 24 L53 18"/><path d="M53 18 Q57 17 58 20 L55 23 Q52 24 50 24"/><path d="M53 18 L50 10 M50 10 L46 6 M50 10 L54 6 M52 14 L57 11 M51 13 L47 13"/><path d="M18 40 L12 52 M24 40 L22 54 M38 40 L42 52 M44 38 L52 50"/><path d="M14 40 Q10 38 9 34"/><path d="M2 58 Q30 54 62 58"/>`,
    candycane: `<path d="M24 58 V22 Q24 8 36 8 Q48 8 48 20 V24"/><path d="M24 50 l6-4 M24 40 l6-4 M24 30 l6-4 M26 18 l7 2 M37 10 l2 7 M44 14 l-5 5"/><path d="M40 26 C34 22 30 26 36 31 C38 33 40 34 40 34 C40 34 42 33 44 31 C50 26 46 22 40 26Z" stroke-width="1.2"/>`,
    pinecone: `<path d="M32 6 V12"/><path d="M32 12 C18 18 16 36 22 48 C26 56 38 56 42 48 C48 36 46 18 32 12Z"/><path d="M24 22 Q32 28 40 22 M20 32 Q32 40 44 32 M21 42 Q32 50 43 42 M32 14 V54 M26 18 L22 48 M38 18 L42 48"/><path d="M32 8 Q24 2 18 6 M32 8 Q40 2 46 6"/>`,
    village: `<path d="M0 54 H64"/><path d="M22 54 V38 L32 30 L42 38 V54"/><path d="M29 54 V46 H35 V54 M25 41 h4 v4 h-4z M35 41 h4 v4 h-4z"/><path d="M38 34 V28 H41 V36"/><path d="M4 54 L9 38 L14 54 M7 46 H11 M48 54 L54 34 L60 54 M51 46 H57 M50 40 H58"/><circle cx="20" cy="12" r=".9"/><circle cx="46" cy="16" r=".9"/><circle cx="56" cy="8" r=".9"/>`,
    holly: HOLLY,
  };

  function icon(name) {
    const raw = ICONS[name];
    return `<svg class="ico" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${raw}</svg>`;
  }

  // Ramo di pino disegnato con aghi, neve, bacche e lucine
  function branch(seed) {
    let s = seed;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    let svg = `<svg viewBox="0 0 260 220" aria-hidden="true">
      <defs><radialGradient id="lg${seed}"><stop offset="0" stop-color="#fff6d6"/><stop offset=".35" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#ffb84a" stop-opacity="0"/></radialGradient></defs>`;
    const stems = [
      [[-10, -10], [120, 70], [230, 95]],
      [[-10, 40], [70, 120], [120, 190]],
      [[40, -10], [140, 20], [200, 20]],
    ];
    const needles = [], snow = [];
    for (const [a, c, b] of stems) {
      svg += `<path d="M${a} Q${c} ${b}" fill="none" stroke="#3b2a1c" stroke-width="3"/>`;
      for (let t = 0.05; t <= 1; t += 0.022) {
        const x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0];
        const y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1];
        const dx = 2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
        const dy = 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
        const ang = Math.atan2(dy, dx);
        const len = 24 * (1 - t * 0.55) + rnd() * 6;
        for (const side of [-1, 1]) {
          const a2 = ang + side * (0.75 + rnd() * 0.3);
          const col = ["#1d4a30", "#2a5e3d", "#3a7a50", "#24553a"][Math.floor(rnd() * 4)];
          needles.push(`<path d="M${x.toFixed(1)} ${y.toFixed(1)} l${(Math.cos(a2) * len).toFixed(1)} ${(Math.sin(a2) * len).toFixed(1)}" stroke="${col}" stroke-width="${(2 + rnd()).toFixed(1)}" stroke-linecap="round"/>`);
        }
        if (rnd() > 0.72) snow.push(`<ellipse cx="${(x + rnd() * 6 - 3).toFixed(1)}" cy="${(y - 6).toFixed(1)}" rx="${(7 + rnd() * 7).toFixed(1)}" ry="${(3 + rnd() * 2).toFixed(1)}" fill="#f4f7f6" opacity=".92"/>`);
      }
    }
    svg += needles.join("") + snow.join("");
    svg += `<circle cx="150" cy="100" r="6" fill="${RED}"/><circle cx="160" cy="96" r="6" fill="${RED}"/><circle cx="154" cy="108" r="6" fill="#a51e25"/>`;
    // filo di lucine
    svg += `<path d="M0 60 Q60 110 120 70 T250 60" fill="none" stroke="#2a2a22" stroke-width="1.2"/>`;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, x = t * 250;
      const y = t < .48 ? 60 + Math.sin(t / .48 * Math.PI) * 26 : 70 - Math.sin((t - .48) / .52 * Math.PI) * 22 + (t - .48) * -15;
      svg += `<g class="light" style="animation-delay:${(i * 0.37) % 2}s"><circle cx="${x.toFixed(1)}" cy="${(y + 4).toFixed(1)}" r="14" fill="url(#lg${seed})"/><circle cx="${x.toFixed(1)}" cy="${(y + 4).toFixed(1)}" r="2.6" fill="#fff4cc"/></g>`;
    }
    return svg + "</svg>";
  }

  function mount() {
    document.querySelectorAll("[data-bow]").forEach((n) => (n.innerHTML = bow()));
    document.querySelectorAll("[data-heart]").forEach((n) => (n.innerHTML = HEART));
    document.querySelectorAll("[data-holly]").forEach((n) => (n.innerHTML = icon("holly") + icon("sprig")));
    document.querySelectorAll(".branch").forEach((n, i) => (n.innerHTML = branch(7 + i * 13)));
  }

  return { icon, mount, bow };
})();
