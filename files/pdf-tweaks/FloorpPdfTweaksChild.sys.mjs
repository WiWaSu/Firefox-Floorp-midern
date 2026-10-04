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

  /* Палитра цветов вместо системного окна Windows «Цвет» (оно из 90-х).
     Ловим клик по <input type="color"> в панели рисования/текста и
     показываем свою всплывающую палитру. «Другой цвет…» открывает
     системное окно, если очень нужен точный оттенок. */
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
    let pop = null;
    let target = null;
    let allowNative = false;

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
      input.value = color;
      input.dispatchEvent(new win.Event("input", { bubbles: true }));
      input.dispatchEvent(new win.Event("change", { bubbles: true }));
    };
    const open = input => {
      close();
      target = input;
      pop = doc.createElement("div");
      pop.id = "xColorPop";
      const grid = doc.createElement("div");
      grid.className = "x-grid";
      const current = String(input.value || "").toLowerCase();
      for (const c of COLORS) {
        const b = doc.createElement("button");
        b.className = "x-dot";
        b.style.setProperty("--c", c);
        b.title = c;
        if (c.toLowerCase() === current) {
          b.setAttribute("aria-pressed", "true");
        }
        b.addEventListener("click", () => apply(c), { signal });
        grid.append(b);
      }
      const more = doc.createElement("button");
      more.className = "x-more";
      more.textContent = "Другой цвет…";
      more.addEventListener("click", () => {
        const input2 = target;
        close();
        if (input2) {
          allowNative = true;
          input2.click();
          allowNative = false;
        }
      }, { signal });
      pop.append(grid, more);
      doc.body.append(pop);
      const r = input.getBoundingClientRect();
      const w = pop.offsetWidth;
      const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, win.innerWidth - w - 8));
      pop.style.left = left + "px";
      pop.style.top = (r.bottom + 10) + "px";
    };

    doc.addEventListener("click", e => {
      const input = e.target?.closest?.('input[type="color"]');
      if (!input || allowNative) {
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
      if (input && !allowNative && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
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
