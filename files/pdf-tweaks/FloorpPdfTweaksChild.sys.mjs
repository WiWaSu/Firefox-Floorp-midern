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
    if (msg.name === "FM:pdf-refresh") {
      return this.#refreshPages();
    }
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
        let artwork = "";
        try {
          const list = [...(win.navigator.mediaSession?.metadata?.artwork || [])];
          artwork = list.length ? String(list[list.length - 1].src || "") : "";
        } catch {}
        // позиция: первый играющий (или поставленный нами на паузу) звук с длительностью
        const m = media.find(x => (!x.paused || x.hasAttribute("data-fm-paused")) && isFinite(x.duration) && x.duration > 0);
        return {
          title: title.slice(0, 120),
          artist: artist.slice(0, 80),
          artwork: artwork.slice(0, 2000),
          playing: media.some(x => !x.paused),
          position: m ? m.currentTime : 0,
          duration: m ? m.duration : 0,
        };
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
    try {
      this.#setupResume();
    } catch (e) {
      console.error("[pdf-tweaks] resume:", e);
    }
    try {
      this.#setupBookmarks();
    } catch (e) {
      console.error("[pdf-tweaks] bookmarks:", e);
    }
    try {
      this.#setupRenderKick();
    } catch (e) {
      console.error("[pdf-tweaks] render kick:", e);
    }
    try {
      this.#setupQuickText();
    } catch (e) {
      console.error("[pdf-tweaks] quick text:", e);
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

  /* Открывать документ там, где остановился.
     Номер страницы запоминается для каждого файла (последние 150 файлов). */
  #setupResume() {
    const doc = this.document;
    const win = this.contentWindow;
    const signal = this.#ac.signal;
    const key = String(win.location.href).split("#")[0];
    if (!key || /#page=|#nameddest=/.test(win.location.href)) {
      return;
    }
    let saved = 0;
    try {
      const map = JSON.parse(Services.prefs.getStringPref("floorp.pdftweaks.pages", "{}"));
      saved = Number(map[key]?.p) || 0;
    } catch {}
    const input = () => doc.getElementById("pageNumber");
    const total = () => Number(input()?.max) || 0;
    let last = 0;
    let restored = saved < 2;
    const timer = win.setInterval(() => {
      const el = input();
      if (!el || !total()) {
        return; // документ ещё грузится
      }
      const now = Number(el.value) || 0;
      if (!restored) {
        restored = true;
        if (now <= 1 && saved > 1 && saved <= total()) {
          el.value = String(saved);
          el.dispatchEvent(new win.Event("change", { bubbles: true }));
          this.#notice(`Открыто на стр. ${saved} — там, где вы остановились`, "С начала", () => {
            el.value = "1";
            el.dispatchEvent(new win.Event("change", { bubbles: true }));
          });
          last = saved;
          return;
        }
      }
      if (now && now !== last) {
        last = now;
        try {
          this.sendAsyncMessage("PdfTweaks:page", { url: key, page: now });
        } catch {}
      }
    }, 1500);
    signal.addEventListener("abort", () => win.clearInterval(timer));
  }

  /* Закладки страниц: кнопка-ленточка на панели, список закладок файла,
     Ctrl+B — добавить или убрать закладку на текущей странице.
     На страницах с закладкой в углу видна ленточка. Хранятся для каждого файла. */
  #setupBookmarks() {
    const doc = this.document;
    const win = this.contentWindow;
    const signal = this.#ac.signal;
    const key = String(win.location.href).split("#")[0];
    const right = doc.getElementById("toolbarViewerRight");
    if (!key || !right || doc.getElementById("xBookWrap")) {
      return;
    }
    const load = () => {
      try {
        const all = JSON.parse(Services.prefs.getStringPref("floorp.pdftweaks.bookmarks", "{}"));
        return Array.isArray(all[key]) ? all[key].filter(b => b && b.p > 0) : [];
      } catch {
        return [];
      }
    };
    let list = load();
    const save = () => {
      try {
        this.sendAsyncMessage("PdfTweaks:bookmarks", { url: key, list });
      } catch {}
    };
    const pageInput = () => doc.getElementById("pageNumber");
    const current = () => Number(pageInput()?.value) || 0;
    const goTo = n => {
      const el = pageInput();
      if (!el) {
        return;
      }
      el.value = String(n);
      el.dispatchEvent(new win.Event("change", { bubbles: true }));
    };
    const noteFor = n => {
      // начало текста страницы — чтобы в списке было понятно, что там
      const spans = doc.querySelectorAll(`.page[data-page-number="${n}"] .textLayer span`);
      let t = "";
      for (const sp of spans) {
        t += (sp.textContent || "") + " ";
        if (t.length > 80) {
          break;
        }
      }
      return t.replace(/\s+/g, " ").trim().slice(0, 70);
    };

    const wrap = doc.createElement("div");
    wrap.id = "xBookWrap";
    wrap.className = "toolbarHorizontalGroup";
    const btn = doc.createElement("button");
    btn.id = "xBookButton";
    btn.className = "toolbarButton";
    btn.type = "button";
    btn.title = "Закладки (Ctrl+B — закладка на этой странице)";
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    const label = doc.createElement("span");
    label.textContent = "Закладки";
    btn.append(label);
    const menu = doc.createElement("div");
    menu.id = "xBookMenu";
    menu.hidden = true;
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-label", "Закладки");
    wrap.append(btn, menu);
    const themeWrap = doc.getElementById("xThemeWrap");
    if (themeWrap && themeWrap.parentNode === right) {
      right.insertBefore(wrap, themeWrap);
    } else {
      right.append(wrap);
    }

    const has = n => list.some(b => b.p === n);
    const toggle = n => {
      if (!n) {
        return;
      }
      if (has(n)) {
        list = list.filter(b => b.p !== n);
        this.#notice(`Закладка со стр. ${n} убрана`);
      } else {
        list.push({ p: n, note: noteFor(n), t: Date.now() });
        list.sort((a, b) => a.p - b.p);
        this.#notice(`Стр. ${n} в закладках`);
      }
      save();
      sync();
      render();
    };
    // элементы меню — div с ролью кнопки: правила PDF.js для <button> их не ломают
    const act = (cls, text, fn) => {
      const el = doc.createElement("div");
      el.className = cls;
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      if (text) {
        el.textContent = text;
      }
      el.addEventListener("click", fn, { signal });
      el.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fn(e);
        }
      }, { signal });
      return el;
    };
    const render = () => {
      if (menu.hidden) {
        return;
      }
      menu.textContent = "";
      const now = current();
      const head = doc.createElement("div");
      head.className = "x-head";
      const title = doc.createElement("span");
      title.className = "x-title";
      title.textContent = "Закладки";
      const add = act("x-add", has(now) ? `Убрать стр. ${now}` : `+ Стр. ${now || 1}`, () => toggle(now || 1));
      if (has(now)) {
        add.setAttribute("data-on", "");
      }
      head.append(title, add);
      menu.append(head);
      if (!list.length) {
        const empty = doc.createElement("div");
        empty.className = "x-empty";
        empty.textContent = "Пока пусто. Нажмите «+», чтобы запомнить страницу, или Ctrl+B в любой момент.";
        menu.append(empty);
        return;
      }
      for (const b of list) {
        const row = doc.createElement("div");
        row.className = "x-item";
        if (b.p === now) {
          row.setAttribute("data-current", "");
        }
        const go = act("x-go", "", () => {
          goTo(b.p);
          setOpen(false);
        });
        const num = doc.createElement("span");
        num.className = "x-num";
        num.textContent = String(b.p);
        const note = doc.createElement("span");
        note.className = "x-note";
        note.textContent = b.note || `Страница ${b.p}`;
        go.append(num, note);
        go.title = `Перейти на стр. ${b.p}`;
        const del = act("x-del", "×", e => {
          e.stopPropagation();
          toggle(b.p);
        });
        del.title = "Убрать закладку";
        row.append(go, del);
        menu.append(row);
      }
    };
    // ленточки на страницах и состояние кнопки
    const sync = () => {
      const set = new Set(list.map(b => b.p));
      for (const page of doc.querySelectorAll(".pdfViewer .page[data-page-number]")) {
        page.classList.toggle("x-bookmarked", set.has(Number(page.getAttribute("data-page-number"))));
      }
      btn.toggleAttribute("data-on", set.has(current()));
    };
    const setOpen = open => {
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      if (open) {
        render();
        // не даём списку вылезти за край окна
        menu.style.setProperty("translate", "0 0");
        const r = menu.getBoundingClientRect();
        const dx = r.right > win.innerWidth - 8 ? win.innerWidth - 8 - r.right : (r.left < 8 ? 8 - r.left : 0);
        menu.style.setProperty("translate", `${Math.round(dx)}px 0`);
      }
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
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.code === "KeyB")) {
        if (e.target?.closest?.("input, textarea, [contenteditable='true'], .freeTextEditor")) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        toggle(current());
      }
    }, { capture: true, signal });
    const timer = win.setInterval(sync, 1500);
    signal.addEventListener("abort", () => win.clearInterval(timer));
    sync();
  }

  /* Перерисовать все страницы PDF. Нужно после переключения видеокарты
     (встроенная ↔ дискретная): Windows сбрасывает графику, и уже нарисованные
     страницы становятся пустыми, а PDF.js об этом не знает. */
  #refreshPages() {
    const doc = this.document;
    const win = this.contentWindow;
    try {
      if (!doc || doc.nodePrincipal.originNoSuffix !== "resource://pdf.js") {
        return false;
      }
      const viewer = win.wrappedJSObject?.PDFViewerApplication?.pdfViewer;
      if (!viewer) {
        return false;
      }
      if (typeof viewer.refresh === "function") {
        viewer.refresh();
      } else {
        // старые версии PDF.js: меняем масштаб туда и обратно
        const scale = viewer.currentScaleValue;
        viewer.currentScaleValue = scale === "page-fit" ? "page-width" : "page-fit";
        viewer.currentScaleValue = scale;
      }
      return true;
    } catch (e) {
      console.error("[pdf-tweaks] refresh:", e);
      return false;
    }
  }

  /* Иногда (после быстрого перехода по страницам) PDF.js не начинает рисовать
     видимую страницу, и она остаётся пустой, пока не прокрутишь. Следим за этим:
     если видимая страница не нарисована дольше 2 с — слегка «шевелим» прокрутку,
     и PDF.js дорисовывает её сам. */
  #setupRenderKick() {
    const doc = this.document;
    const win = this.contentWindow;
    const signal = this.#ac.signal;
    // ручная кнопка в меню «Тема» — на случай, если страницы пропали
    const menu = doc.getElementById("xThemeMenu");
    if (menu && !doc.getElementById("xRefreshPages")) {
      const b = doc.createElement("button");
      b.type = "button";
      b.id = "xRefreshPages";
      b.className = "x-refresh";
      b.textContent = "↻ Перерисовать страницы";
      b.addEventListener("click", () => {
        this.#refreshPages();
        menu.hidden = true;
        doc.getElementById("xThemeButton")?.setAttribute("aria-expanded", "false");
      }, { signal });
      menu.append(b);
    }
    const waiting = new Map(); // номер страницы → когда заметили пустой
    const timer = win.setInterval(() => {
      const box = doc.getElementById("viewerContainer");
      if (!box || doc.hidden) {
        return;
      }
      const vr = box.getBoundingClientRect();
      const now = Date.now();
      let stuck = false;
      for (const page of doc.querySelectorAll(".pdfViewer .page[data-page-number]")) {
        const r = page.getBoundingClientRect();
        if (r.bottom < vr.top || r.top > vr.bottom) {
          continue; // не на экране
        }
        const n = page.getAttribute("data-page-number");
        if (page.hasAttribute("data-loaded")) {
          waiting.delete(n);
          continue;
        }
        if (!waiting.has(n)) {
          waiting.set(n, now);
        } else if (now - waiting.get(n) > 2000) {
          stuck = true;
          waiting.set(n, now);
        }
      }
      if (stuck) {
        const y = box.scrollTop;
        box.scrollTop = y + 1;
        win.requestAnimationFrame(() => {
          box.scrollTop = y;
          box.dispatchEvent(new win.Event("scroll"));
        });
      }
    }, 1000);
    signal.addEventListener("abort", () => win.clearInterval(timer));
  }

  /* Короткое уведомление внизу просмотрщика с кнопкой действия. */
  #notice(text, actionLabel, action) {
    const doc = this.document;
    const win = this.contentWindow;
    doc.getElementById("xNotice")?.remove();
    const box = doc.createElement("div");
    box.id = "xNotice";
    const span = doc.createElement("span");
    span.textContent = text;
    box.append(span);
    if (actionLabel) {
      const b = doc.createElement("button");
      b.type = "button";
      b.textContent = actionLabel;
      b.addEventListener("click", () => {
        box.remove();
        action?.();
      });
      box.append(b);
    }
    doc.body.append(box);
    win.setTimeout(() => box.classList.add("x-out"), 5000);
    win.setTimeout(() => box.remove(), 5400);
  }

  /* Быстрый текст: клик по пропуску «……» в тексте или двойной клик по пустому
     месту страницы — сразу появляется поле, можно печатать. Когда закончил
     и кликнул мимо, инструмент «Текст» сам выключается. */
  #setupQuickText() {
    const doc = this.document;
    const win = this.contentWindow;
    const signal = this.#ac.signal;
    const toolBtn = () => doc.getElementById("editorFreeTextButton");
    const modeOn = () => {
      const b = toolBtn();
      return !!b && (b.getAttribute("aria-pressed") === "true" || b.classList.contains("toggled"));
    };
    const anyMode = () => !!doc.querySelector("#editorModeButtons [aria-pressed='true'], #editorModeButtons .toggled");
    const GAP = /[.…_]{3,}|…{2,}/;
    let ours = false;

    const create = (page, x, y) => {
      const btn = toolBtn();
      if (!btn || btn.disabled) {
        return;
      }
      if (!modeOn()) {
        btn.click();
      }
      let tries = 0;
      const go = () => {
        const layer = page.querySelector(".annotationEditorLayer");
        if (!layer || layer.hidden || layer.classList.contains("disabled") || !modeOn()) {
          if (++tries < 20) {
            win.setTimeout(go, 50);
          }
          return;
        }
        ours = true;
        const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1, pointerId: 1, isPrimary: true, pointerType: "mouse" };
        layer.dispatchEvent(new win.PointerEvent("pointerdown", opts));
        layer.dispatchEvent(new win.PointerEvent("pointerup", { ...opts, buttons: 0 }));
      };
      win.setTimeout(go, 60);
    };

    // клик по пропуску с точками
    doc.addEventListener("click", e => {
      if (e.button !== 0 || anyMode()) {
        return;
      }
      const span = e.target?.closest?.(".textLayer span");
      if (!span || !GAP.test(span.textContent || "")) {
        return;
      }
      const sel = win.getSelection();
      if (sel && !sel.isCollapsed) {
        return; // человек выделял текст
      }
      const page = span.closest(".page");
      if (page) {
        create(page, e.clientX, e.clientY);
      }
    }, { signal });

    // двойной клик по месту без текста (подходит и для сканов)
    doc.addEventListener("dblclick", e => {
      if (e.button !== 0 || anyMode()) {
        return;
      }
      const t = e.target;
      const word = t?.closest?.(".textLayer span");
      if (word && (word.textContent || "").trim() && !GAP.test(word.textContent)) {
        return; // по слову — обычное выделение слова
      }
      const page = t?.closest?.(".page");
      if (!page) {
        return;
      }
      win.getSelection()?.removeAllRanges();
      create(page, e.clientX, e.clientY);
    }, { signal });

    // закончил печатать и ушёл из поля — выключаем инструмент «Текст»
    doc.addEventListener("focusout", e => {
      if (!ours || !e.target?.closest?.(".freeTextEditor")) {
        return;
      }
      win.setTimeout(() => {
        if (doc.activeElement?.closest?.(".freeTextEditor, #editorFreeTextParamsToolbar")) {
          return;
        }
        ours = false;
        if (modeOn()) {
          toolBtn()?.click();
        }
      }, 250);
    }, { signal });
  }

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
