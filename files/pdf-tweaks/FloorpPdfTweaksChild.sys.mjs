/* Floorp PDF tweaks — runs inside the built-in PDF viewer (PDF.js).
 *  1. Theme button: interface light / dark / auto + page tone.
 *  2. Ink: each separate drawing becomes its own annotation, so its
 *     selection box hugs the drawing and you can keep drawing next to it.
 */

// Пауза после штриха, после которой рисунок считается законченным (мс)
const IDLE_MS = 1100;
// Если новый штрих начат дальше этого расстояния от рисунка (px) — это новый рисунок
const GAP_PX = 36;
// Насколько близко к линии рисунка нужно навести, чтобы его можно было схватить (px)
const GRAB_PX = 5;

const PREF_UI = "floorp.pdftweaks.ui"; // auto | light | dark
const PREF_PAGE = "floorp.pdftweaks.page"; // auto | paper | sepia | night
const UI_VALUES = ["auto", "light", "dark"];
const PAGE_VALUES = ["auto", "paper", "sepia", "night"];

function readPref(name, allowed) {
  try {
    const v = Services.prefs.getStringPref(name, allowed[0]);
    return allowed.includes(v) ? v : allowed[0];
  } catch {
    return allowed[0];
  }
}

let bootSent = false;

export class FloorpPdfTweaksChild extends JSWindowActorChild {
  #ac = null;
  #ui = "auto";
  #page = "auto";
  #menu = null;
  #buttons = [];
  #session = null;
  #timer = 0;
  #prefObserver = null;

  /* Плашка Now Bar в окне спрашивает страницу о плеере:
     info — название трека, pause/play — пауза для <audio>/<video>, seek — перемотка. */
  receiveMessage(msg) {
    if (msg.name !== "FM:media") {
      return null;
    }
    const doc = this.document;
    const win = this.contentWindow;
    if (!doc || !win) {
      return null;
    }
    const { action, delta } = msg.data || {};
    const media = [...doc.querySelectorAll("audio, video")];
    const text = sel => {
      for (const s of sel) {
        const t = doc.querySelector(s)?.textContent?.trim();
        if (t) {
          return t;
        }
      }
      return "";
    };
    try {
      if (action === "info") {
        let title = "", artist = "";
        try {
          const md = win.navigator.mediaSession?.metadata;
          title = md?.title || "";
          artist = md?.artist || "";
        } catch {}
        if (!title) {
          // плееры Telegram (Web K и Web A) и общие варианты
          title = text([".pinned-audio-title", ".pinned-container .audio-title", ".AudioPlayer-content .title",
            ".audio-player .title", "[class*='AudioPlayer'] [class*='title']"]);
          artist = text([".pinned-audio-subtitle", ".pinned-container .audio-subtitle", ".AudioPlayer-content .subtitle",
            ".audio-player .subtitle", "[class*='AudioPlayer'] [class*='subtitle']"]);
        }
        return { title: title.slice(0, 120), artist: artist.slice(0, 80), playing: media.some(m => !m.paused) };
      }
      if (action === "pause") {
        let count = 0;
        for (const m of media) {
          if (!m.paused) {
            m.setAttribute("data-fm-paused", "1");
            m.pause();
            count++;
          }
        }
        return { count };
      }
      if (action === "play") {
        let count = 0;
        for (const m of media) {
          if (m.hasAttribute("data-fm-paused")) {
            m.removeAttribute("data-fm-paused");
            m.play()?.catch?.(() => {});
            count++;
          }
        }
        return { count };
      }
      if (action === "seek") {
        let count = 0;
        for (const m of media) {
          if (!m.paused || m.hasAttribute("data-fm-paused")) {
            m.currentTime = Math.max(0, m.currentTime + (Number(delta) || 0));
            count++;
          }
        }
        return { count };
      }
    } catch (e) {
      return { error: String(e) };
    }
    return null;
  }

  handleEvent(event) {
    // один раз на процесс: разбудить запасной загрузчик функций окна
    if (!bootSent) {
      bootSent = true;
      try {
        this.sendAsyncMessage("PdfTweaks:boot");
      } catch (e) {}
    }
    if (event.type !== "DOMContentLoaded" || this.#ac) {
      return;
    }
    const doc = this.document;
    if (!doc || event.target !== doc) {
      return;
    }
    let isViewer = false;
    try {
      isViewer = doc.nodePrincipal.originNoSuffix === "resource://pdf.js";
    } catch {}
    if (!isViewer || !doc.getElementById("viewerContainer")) {
      return;
    }
    // установщик может выключить новый просмотрщик PDF
    try {
      if (!Services.prefs.getBoolPref("floorp.pdftweaks.enabled", true)) {
        return;
      }
    } catch {}
    this.#ac = new AbortController();
    try {
      this.#setupTheme();
    } catch (e) {
      console.error("[pdf-tweaks] theme:", e);
    }
    try {
      this.#setupInk();
    } catch (e) {
      console.error("[pdf-tweaks] ink:", e);
    }
    try {
      this.#setupColorPicker();
    } catch (e) {
      console.error("[pdf-tweaks] colors:", e);
    }
  }

  #clearTimer() {
    try {
      this.contentWindow?.clearTimeout(this.#timer);
    } catch {}
    this.#timer = 0;
  }

  didDestroy() {
    this.#ac?.abort();
    this.#clearTimer();
    if (this.#prefObserver) {
      try {
        Services.prefs.removeObserver("floorp.pdftweaks.", this.#prefObserver);
      } catch {}
    }
  }

  /* ------------------------------ theme ------------------------------ */

  #setupTheme() {
    const doc = this.document;
    const win = this.contentWindow;
    const signal = this.#ac.signal;
    this.#ui = readPref(PREF_UI, UI_VALUES);
    this.#page = readPref(PREF_PAGE, PAGE_VALUES);

    const right = doc.getElementById("toolbarViewerRight");
    if (right && !doc.getElementById("xThemeWrap")) {
      const wrap = doc.createElement("div");
      wrap.id = "xThemeWrap";
      wrap.className = "toolbarHorizontalGroup";

      const btn = doc.createElement("button");
      btn.id = "xThemeButton";
      btn.className = "toolbarButton";
      btn.type = "button";
      btn.title = "Тема";
      btn.setAttribute("aria-haspopup", "true");
      btn.setAttribute("aria-expanded", "false");
      const label = doc.createElement("span");
      label.textContent = "Тема";
      btn.append(label);

      const menu = doc.createElement("div");
      menu.id = "xThemeMenu";
      menu.hidden = true;
      menu.setAttribute("role", "dialog");
      menu.setAttribute("aria-label", "Тема просмотрщика");

      const section = (title, cls, items, key) => {
        const h = doc.createElement("div");
        h.className = "x-h";
        h.textContent = title;
        const seg = doc.createElement("div");
        seg.className = "x-seg " + cls;
        for (const [value, text, swatch] of items) {
          const b = doc.createElement("button");
          b.type = "button";
          b.dataset.key = key;
          b.dataset.value = value;
          if (swatch) {
            const sw = doc.createElement("span");
            sw.className = "x-sw";
            sw.style.background = swatch;
            b.append(sw);
          }
          b.append(doc.createTextNode(text));
          b.addEventListener("click", () => this.#set(key, value), { signal });
          this.#buttons.push(b);
          seg.append(b);
        }
        menu.append(h, seg);
      };
      section("Интерфейс", "", [
        ["auto", "Авто"],
        ["light", "Светлая"],
        ["dark", "Тёмная"],
      ], "ui");
      section("Страницы", "x-4", [
        ["auto", "Авто", "linear-gradient(90deg,#fff 50%,#2a2d33 50%)"],
        ["paper", "Бумага", "#ffffff"],
        ["sepia", "Сепия", "#efe2c6"],
        ["night", "Ночь", "#2a2d33"],
      ], "page");

      wrap.append(btn, menu);
      const toggle = doc.getElementById("secondaryToolbarToggle");
      if (toggle && toggle.parentNode === right) {
        right.insertBefore(wrap, toggle);
      } else {
        right.append(wrap);
      }
      this.#menu = menu;

      const setOpen = open => {
        menu.hidden = !open;
        btn.setAttribute("aria-expanded", String(open));
      };
      btn.addEventListener("click", e => {
        e.stopPropagation();
        setOpen(menu.hidden);
      }, { signal });
      doc.addEventListener("pointerdown", e => {
        if (!menu.hidden && !wrap.contains(e.target)) {
          setOpen(false);
        }
      }, { capture: true, signal });
      doc.addEventListener("keydown", e => {
        if (e.key === "Escape" && !menu.hidden) {
          setOpen(false);
          btn.focus();
        }
      }, { capture: true, signal });
    }

    win.matchMedia("(prefers-color-scheme: dark)").addEventListener(
      "change", () => this.#apply(), { signal });

    this.#prefObserver = {
      observe: () => {
        this.#ui = readPref(PREF_UI, UI_VALUES);
        this.#page = readPref(PREF_PAGE, PAGE_VALUES);
        this.#apply();
      },
    };
    Services.prefs.addObserver("floorp.pdftweaks.", this.#prefObserver);
    this.#apply();
  }

  #set(key, value) {
    if (key === "ui" && UI_VALUES.includes(value)) {
      this.#ui = value;
    } else if (key === "page" && PAGE_VALUES.includes(value)) {
      this.#page = value;
    } else {
      return;
    }
    this.#apply();
    try {
      this.sendAsyncMessage("PdfTweaks:save", { ui: this.#ui, page: this.#page });
    } catch {}
  }

  #apply() {
    const doc = this.document;
    const win = this.contentWindow;
    if (!doc || !win) {
      return;
    }
    const root = doc.documentElement;
    root.setAttribute("data-x-ui", this.#ui);
    if (this.#ui === "auto") {
      root.style.removeProperty("color-scheme");
    } else {
      root.style.setProperty("color-scheme", this.#ui, "important");
    }
    const dark = this.#ui === "dark" ||
      (this.#ui === "auto" && win.matchMedia("(prefers-color-scheme: dark)").matches);
    const page = this.#page === "auto" ? (dark ? "night" : "paper") : this.#page;
    root.setAttribute("data-x-page", page);
    for (const b of this.#buttons) {
      const current = b.dataset.key === "ui" ? this.#ui : this.#page;
      b.setAttribute("aria-pressed", String(b.dataset.value === current));
    }
  }

  /* ------------------------------- ink ------------------------------- */

  /* Своя палитра вместо системного окна Windows «Цвет» (оно из 90-х).
     Ловим клик по <input type="color"> в панели рисования/текста и
     показываем всплывающую палитру: готовые цвета + свой цвет
     (поле оттенка/яркости, полоса цветов, HEX). Системное окно не открывается никогда. */
  #setupColorPicker() {
    const doc = this.document;
    const win = this.contentWindow;
    const signal = this.#ac.signal;
    const COLORS = [
      "#000000", "#3A3A3C", "#8E8E93", "#C7C7CC", "#FFFFFF",
      "#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#00C7BE",
      "#30B0C7", "#007AFF", "#5856D6", "#AF52DE", "#FF2D55",
      "#A2845E", "#FF6B6B", "#FFD60A", "#64D2FF", "#BF5AF2",
    ];
    const recent = [];
    let pop = null;
    let target = null;

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const toHex = n => Math.round(n).toString(16).padStart(2, "0");
    const hsvToHex = (h, sat, val) => {
      const f = n => {
        const k = (n + h / 60) % 6;
        return val - val * sat * Math.max(0, Math.min(k, 4 - k, 1));
      };
      return "#" + toHex(f(5) * 255) + toHex(f(3) * 255) + toHex(f(1) * 255);
    };
    const hexToHsv = hex => {
      const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
      if (!m) {
        return null;
      }
      const n = parseInt(m[1], 16);
      const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
      const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
      let h = 0;
      if (d) {
        h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
      }
      return { h, s: max ? d / max : 0, v: max };
    };
    // стиль задаём через CSSOM (style.setProperty): атрибут style="" просмотрщик
    // запрещает своей политикой безопасности (CSP), и такие стили молча не применяются
    const css = (node, props) => {
      for (const [k, v] of Object.entries(props)) {
        node.style.setProperty(k, v);
      }
    };
    const el = (tag, cls) => {
      const e = doc.createElement(tag);
      if (cls) {
        e.className = cls;
      }
      return e;
    };

    const close = () => {
      pop?.remove();
      pop = null;
      target = null;
    };
    const apply = color => {
      const input = target;
      close();
      if (!input) {
        return;
      }
      const c = color.toLowerCase();
      if (!COLORS.some(x => x.toLowerCase() === c)) {
        const i = recent.indexOf(c);
        if (i >= 0) {
          recent.splice(i, 1);
        }
        recent.unshift(c);
        recent.length = Math.min(recent.length, 5);
      }
      input.value = c;
      input.dispatchEvent(new win.Event("input", { bubbles: true }));
      input.dispatchEvent(new win.Event("change", { bubbles: true }));
    };
    const dot = (c, current) => {
      const b = el("button", "x-dot");
      b.type = "button";
      css(b, { "--c": c });
      b.title = c.toUpperCase();
      if (c.toLowerCase() === current) {
        b.setAttribute("aria-pressed", "true");
      }
      b.addEventListener("click", () => apply(c), { signal });
      return b;
    };
    const place = input => {
      const r = input.getBoundingClientRect();
      const w = pop.offsetWidth, h = pop.offsetHeight;
      const below = r.bottom + 10;
      css(pop, {
        left: clamp(r.left + r.width / 2 - w / 2, 8, win.innerWidth - w - 8) + "px",
        top: (below + h > win.innerHeight - 8 ? Math.max(8, r.top - h - 10) : below) + "px",
      });
    };

    // свой цвет: поле насыщенность/яркость, полоса оттенка, HEX
    const buildCustom = (input, start) => {
      const hsv = hexToHsv(start) || { h: 210, s: 1, v: 1 };
      const box = el("div", "x-custom");
      const sv = el("div", "x-sv");
      const svKnob = el("div", "x-knob");
      sv.append(svKnob);
      const hue = el("div", "x-hue");
      const hueKnob = el("div", "x-knob");
      hue.append(hueKnob);
      const row = el("div", "x-row");
      const preview = el("div", "x-preview");
      const hex = el("input", "x-hex");
      hex.type = "text";
      hex.maxLength = 7;
      hex.spellcheck = false;
      const ok = el("button", "x-ok");
      ok.type = "button";
      ok.textContent = "Готово";
      row.append(preview, hex, ok);
      box.append(sv, hue, row);

      const render = (fromHex = false) => {
        const c = hsvToHex(hsv.h, hsv.s, hsv.v);
        css(sv, { "--h": `hsl(${hsv.h.toFixed(1)} 100% 50%)` });
        css(svKnob, { left: (hsv.s * 100).toFixed(2) + "%", top: ((1 - hsv.v) * 100).toFixed(2) + "%", "--c": c });
        css(hueKnob, { left: (hsv.h / 360 * 100).toFixed(2) + "%", "--c": `hsl(${hsv.h.toFixed(1)} 100% 50%)` });
        css(preview, { "--c": c });
        if (!fromHex) {
          hex.value = c.toUpperCase();
        }
      };
      const drag = (area, onMove) => {
        const go = e => {
          const r = area.getBoundingClientRect();
          onMove(clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1));
          render();
        };
        area.addEventListener("pointerdown", e => {
          e.preventDefault();
          area.setPointerCapture(e.pointerId);
          go(e);
        }, { signal });
        area.addEventListener("pointermove", e => {
          if (area.hasPointerCapture(e.pointerId)) {
            go(e);
          }
        }, { signal });
      };
      drag(sv, (x, y) => { hsv.s = x; hsv.v = 1 - y; });
      drag(hue, x => { hsv.h = Math.min(359.9, x * 360); });
      hex.addEventListener("input", () => {
        let v = hex.value.trim();
        if (!v.startsWith("#")) {
          v = "#" + v;
        }
        const parsed = hexToHsv(v);
        if (parsed) {
          Object.assign(hsv, parsed);
          render(true);
        }
      }, { signal });
      hex.addEventListener("keydown", e => {
        e.stopPropagation();
        if (e.key === "Enter") {
          apply(hsvToHex(hsv.h, hsv.s, hsv.v));
        } else if (e.key === "Escape") {
          close();
        }
      }, { signal });
      ok.addEventListener("click", () => apply(hsvToHex(hsv.h, hsv.s, hsv.v)), { signal });
      render();
      return box;
    };

    const open = input => {
      close();
      target = input;
      const current = String(input.value || "").toLowerCase();
      pop = el("div");
      pop.id = "xColorPop";
      const grid = el("div", "x-grid");
      for (const c of COLORS) {
        grid.append(dot(c, current));
      }
      pop.append(grid);
      if (recent.length) {
        const r = el("div", "x-grid x-recent");
        for (const c of recent) {
          r.append(dot(c, current));
        }
        pop.append(r);
      }
      const more = el("button", "x-more");
      more.type = "button";
      more.textContent = "Свой цвет…";
      more.addEventListener("click", () => {
        if (pop.querySelector(".x-custom")) {
          return;
        }
        more.remove();
        pop.append(buildCustom(input, current));
        place(input);
        pop.querySelector(".x-hex")?.focus();
      }, { signal });
      pop.append(more);
      doc.body.append(pop);
      place(input);
    };

    doc.addEventListener("click", e => {
      const input = e.target?.closest?.('input[type="color"]');
      if (!input) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (target === input) {
        close();
      } else {
        open(input);
      }
    }, { capture: true, signal });
    doc.addEventListener("keydown", e => {
      const input = e.target?.closest?.('input[type="color"]');
      if (input && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        e.stopPropagation();
        open(input);
      } else if (e.key === "Escape" && pop) {
        close();
      }
    }, { capture: true, signal });
    doc.addEventListener("pointerdown", e => {
      if (pop && !pop.contains(e.target) && !e.target?.closest?.('input[type="color"]')) {
        close();
      }
    }, { capture: true, signal });
    win.addEventListener("resize", close, { signal });
  }

  #setupInk() {
    const win = this.contentWindow;
    const signal = this.#ac.signal;
    const opts = { capture: true, signal };

    win.addEventListener("pointerdown", e => this.#onDown(e), opts);
    win.addEventListener("pointermove", e => this.#onMove(e), opts);
    win.addEventListener("pointerup", e => this.#onUp(e), opts);
    win.addEventListener("pointercancel", () => {
      if (this.#session) {
        this.#session.drawing = false;
      }
    }, opts);

    // Хватать рисунок только за сами линии, без рамки вокруг
    win.addEventListener("pointermove", e => this.#queueHover(e), opts);
    win.addEventListener("pointerleave", () => this.#setHot(null, null), opts);
    win.addEventListener("pointerup", () => this.#queueSync(), opts);
    win.addEventListener("keyup", () => this.#queueSync(), opts);
  }

  /* ---------------------- grab ink by its strokes --------------------- */

  #hoverRaf = 0;
  #hoverEvent = null;
  #hotDiv = null;
  #hotSvg = null;
  #samples = new Map(); // path "d" -> [x0, y0, x1, y1, ...] in SVG user units

  #queueHover(e) {
    this.#hoverEvent = { x: e.clientX, y: e.clientY, buttons: e.buttons };
    if (this.#hoverRaf) {
      return;
    }
    this.#hoverRaf = this.contentWindow.requestAnimationFrame(() => {
      this.#hoverRaf = 0;
      try {
        this.#hover(this.#hoverEvent);
      } catch (err) {
        console.error("[pdf-tweaks] hover:", err);
      }
    });
  }

  #pointsFor(path) {
    const d = path.getAttribute("d") || "";
    let pts = this.#samples.get(d);
    if (pts) {
      return pts;
    }
    pts = [];
    const total = path.getTotalLength();
    if (total > 0) {
      const n = Math.min(4000, Math.max(8, Math.ceil(total * 1500)));
      for (let i = 0; i <= n; i++) {
        const p = path.getPointAtLength((total * i) / n);
        pts.push(p.x, p.y);
      }
    }
    if (this.#samples.size > 500) {
      this.#samples.clear();
    }
    this.#samples.set(d, pts);
    return pts;
  }

  /* distance in screen px from the point to the drawn line of an ink SVG */
  #strokeDistance(svg, x, y) {
    const path = svg.querySelector("defs > path");
    const m = svg.getScreenCTM();
    if (!path || !m) {
      return Infinity;
    }
    const pts = this.#pointsFor(path);
    let best = Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      const sx = m.a * pts[i] + m.c * pts[i + 1] + m.e;
      const sy = m.b * pts[i] + m.d * pts[i + 1] + m.f;
      const dd = (sx - x) * (sx - x) + (sy - y) * (sy - y);
      if (dd < best) {
        best = dd;
      }
    }
    const width = parseFloat(svg.getAttribute("stroke-width")) || 1;
    return Math.sqrt(best) - width / 2;
  }

  /* the ink editor box that belongs to a drawing SVG (same position/size) */
  #editorFor(svg, page) {
    const r = svg.getBoundingClientRect();
    let best = null;
    let bestScore = 12;
    for (const div of page.querySelectorAll(".annotationEditorLayer .inkEditor")) {
      const q = div.getBoundingClientRect();
      const score = Math.abs(q.left - r.left) + Math.abs(q.top - r.top) +
        Math.abs(q.right - r.right) + Math.abs(q.bottom - r.bottom);
      if (score < bestScore) {
        bestScore = score;
        best = div;
      }
    }
    return best;
  }

  #hover(ev) {
    if (!ev || ev.buttons || this.#session?.drawing) {
      return; // не трогаем, пока что-то тащат или рисуют
    }
    const doc = this.document;
    const under = doc.elementFromPoint(ev.x, ev.y);
    const page = under?.closest?.(".page");
    if (!page || page.querySelector(".annotationEditorLayer.drawing")) {
      this.#setHot(null, null);
      return;
    }
    let hitSvg = null;
    let hitDist = Infinity;
    for (const svg of page.querySelectorAll(".canvasWrapper svg.draw")) {
      if (svg.querySelector("use.mainOutline")) {
        continue; // это выделение маркером, не рисунок
      }
      const r = svg.getBoundingClientRect();
      const pad = GRAB_PX + (parseFloat(svg.getAttribute("stroke-width")) || 1);
      if (ev.x < r.left - pad || ev.x > r.right + pad || ev.y < r.top - pad || ev.y > r.bottom + pad) {
        continue;
      }
      const dist = this.#strokeDistance(svg, ev.x, ev.y);
      if (dist <= GRAB_PX && dist < hitDist) {
        hitDist = dist;
        hitSvg = svg;
      }
    }
    const div = hitSvg ? this.#editorFor(hitSvg, page) : null;
    this.#setHot(div ? hitSvg : null, div);
  }

  #setHot(svg, div) {
    if (this.#hotDiv !== div) {
      this.#hotDiv?.classList.remove("x-hot");
      div?.classList.add("x-hot");
      this.#hotDiv = div;
    }
    if (this.#hotSvg !== svg) {
      this.#hotSvg?.classList.remove("x-hover");
      svg?.classList.add("x-hover");
      this.#hotSvg = svg;
    }
  }

  #syncRaf = 0;
  #queueSync() {
    if (this.#syncRaf) {
      return;
    }
    this.#syncRaf = this.contentWindow.requestAnimationFrame(() => {
      this.#syncRaf = 0;
      try {
        this.#syncSelected();
      } catch {}
    });
  }

  /* подсветить линии выбранного рисунка (вместо рамки) */
  #syncSelected() {
    const doc = this.document;
    for (const svg of doc.querySelectorAll(".canvasWrapper svg.draw.x-sel")) {
      svg.classList.remove("x-sel");
    }
    for (const div of doc.querySelectorAll(".annotationEditorLayer .inkEditor.selectedEditor")) {
      const page = div.closest(".page");
      if (!page) {
        continue;
      }
      const r = div.getBoundingClientRect();
      let best = null;
      let bestScore = 12;
      for (const svg of page.querySelectorAll(".canvasWrapper svg.draw")) {
        const q = svg.getBoundingClientRect();
        const score = Math.abs(q.left - r.left) + Math.abs(q.top - r.top) +
          Math.abs(q.right - r.right) + Math.abs(q.bottom - r.bottom);
        if (score < bestScore) {
          bestScore = score;
          best = svg;
        }
      }
      best?.classList.add("x-sel");
    }
  }

  #local(e, div) {
    const r = div.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  #grow(e) {
    const s = this.#session;
    const [x, y] = this.#local(e, s.div);
    if (!s.box) {
      s.box = [x, y, x, y];
    } else {
      s.box[0] = Math.min(s.box[0], x);
      s.box[1] = Math.min(s.box[1], y);
      s.box[2] = Math.max(s.box[2], x);
      s.box[3] = Math.max(s.box[3], y);
    }
  }

  #distance(e) {
    const s = this.#session;
    if (!s.box) {
      return 0;
    }
    const [x, y] = this.#local(e, s.div);
    const dx = Math.max(s.box[0] - x, 0, x - s.box[2]);
    const dy = Math.max(s.box[1] - y, 0, y - s.box[3]);
    return Math.hypot(dx, dy);
  }

  #onDown(e) {
    if (e.button !== 0) {
      return;
    }
    this.#clearTimer();
    const target = e.target;
    const layerDiv = target?.closest?.(".annotationEditorLayer") || null;
    const s = this.#session;
    if (s) {
      const newDrawing =
        layerDiv !== s.div ||
        Date.now() - s.lastUp > IDLE_MS ||
        this.#distance(e) > GAP_PX;
      if (newDrawing) {
        this.#finish();
      }
    }
    if (layerDiv && target === layerDiv && layerDiv.classList.contains("inkEditing")) {
      if (!this.#session) {
        this.#session = { div: layerDiv, box: null, lastUp: 0, drawing: false };
      }
      this.#session.drawing = true;
      this.#grow(e);
    }
  }

  #onMove(e) {
    const s = this.#session;
    if (s?.drawing && (e.buttons & 1)) {
      this.#grow(e);
    }
  }

  #onUp() {
    const s = this.#session;
    if (!s?.drawing) {
      return;
    }
    s.drawing = false;
    s.lastUp = Date.now();
    this.#clearTimer();
    this.#timer = this.contentWindow.setTimeout(() => {
      if (this.#session === s && !s.drawing) {
        this.#finish();
      }
    }, IDLE_MS);
  }

  /* Commit the current ink drawing so it becomes a separate annotation. */
  #finish() {
    const s = this.#session;
    this.#session = null;
    this.#clearTimer();
    if (!s) {
      return;
    }
    try {
      const pageDiv = s.div.closest(".page");
      const n = parseInt(pageDiv?.getAttribute("data-page-number"), 10);
      const app = this.contentWindow.wrappedJSObject.PDFViewerApplication;
      const view = app?.pdfViewer?.getPageView(n - 1);
      const layer = view?.annotationEditorLayer?.annotationEditorLayer;
      if (layer && typeof layer.endDrawingSession === "function") {
        layer.endDrawingSession(false);
      }
    } catch (e) {
      console.error("[pdf-tweaks] finish:", e);
    }
  }
}
