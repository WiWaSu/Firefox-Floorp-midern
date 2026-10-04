/* Floorp Modern — новые функции окна браузера.
 * Загружается в каждое окно Floorp загрузчиком из папки программы (config.js).
 *
 *  1. Полоска загрузки страницы под панелью (цвет акцента).
 *  2. Всплывающие уведомления в стиле One UI («тосты»).
 *  3. Alt+Shift+C — скопировать адрес страницы.
 *  4. Уведомление о завершённой загрузке файла.
 *  5. Кнопка быстрой смены темы: Авто / Светлая / Тёмная.
 *  6. «Now Bar»: музыка играет в другой вкладке — плашка внизу с паузой и звуком.
 *  7. Уведомления о масштабе страницы и о выключенном звуке вкладки.
 *  8. Alt+Shift+D — закрыть повторяющиеся вкладки.
 *  9. Alt+Shift+Z — режим фокуса (прячет закладки и боковые панели).
 */
(function () {
  "use strict";
  const win = window;
  const doc = document;
  if (win.__floorpModern) {
    return;
  }
  win.__floorpModern = true;

  const HTML = "http://www.w3.org/1999/xhtml";
  const el = (tag, cls) => {
    const e = doc.createElementNS(HTML, tag);
    if (cls) {
      e.className = cls;
    }
    return e;
  };
  const onUnload = [];

  /* журнал: ошибки пишутся в pdf-tweaks/fm-log.json, чтобы их можно было прочитать */
  const LOG = [];
  const logDir = (() => {
    try {
      return PathUtils.join(Services.dirsvc.get("UChrm", Ci.nsIFile).path, "pdf-tweaks");
    } catch (e) {
      return null;
    }
  })();
  let logTimer = 0;
  const log = (what, err) => {
    LOG.push({ t: new Date().toISOString(), what, err: err ? String(err && err.stack || err) : null });
    if (!logDir) return;
    win.clearTimeout(logTimer);
    logTimer = win.setTimeout(() => {
      IOUtils.writeJSON(PathUtils.join(logDir, "fm-log.json"), LOG).catch(() => {});
    }, 500);
  };
  log("скрипт загружен в окно");
  const safe = (name, fn) => {
    try {
      fn();
      log(name + ": ok");
    } catch (e) {
      log(name + ": ОШИБКА", e);
    }
  };
  win.addEventListener("unload", () => onUnload.forEach(f => {
    try { f(); } catch (e) {}
  }), { once: true });

  /* ------------------------------ тосты ------------------------------ */
  const host = el("div", "fm-toasts");
  try {
    (doc.getElementById("browser") || doc.documentElement).append(host);
    log("toasts: ok");
  } catch (e) {
    log("toasts: ОШИБКА", e);
  }

  function toast(text, kind = "info") {
    const t = el("div", "fm-toast");
    t.dataset.kind = kind;
    const dot = el("span", "fm-toast-dot");
    const label = el("span", "fm-toast-text");
    label.textContent = text;
    t.append(dot, label);
    host.append(t);
    win.requestAnimationFrame(() => t.classList.add("fm-in"));
    win.setTimeout(() => {
      t.classList.remove("fm-in");
      t.classList.add("fm-out");
      win.setTimeout(() => t.remove(), 300);
    }, 2400);
  }
  win.FloorpModernToast = toast;

  safe("progress bar", () => {
    /* ----------------------- полоска загрузки ------------------------- */
    const bar = el("div", "fm-progress");
    const fill = el("div", "fm-progress-fill");
    bar.append(fill);
    const toolbox = doc.getElementById("navigator-toolbox");
    if (toolbox) {
      toolbox.append(bar);
    }
    let hideTimer = 0;
    const setProgress = value => {
      win.clearTimeout(hideTimer);
      bar.classList.add("fm-active");
      fill.style.transform = `scaleX(${Math.max(0.04, Math.min(1, value))})`;
      if (value >= 1) {
        hideTimer = win.setTimeout(() => {
          bar.classList.remove("fm-active");
          hideTimer = win.setTimeout(() => (fill.style.transform = "scaleX(0)"), 250);
        }, 350);
      }
    };
    const progressListener = {
      QueryInterface: ChromeUtils.generateQI(["nsIWebProgressListener", "nsISupportsWeakReference"]),
      onStateChange(webProgress, request, flags) {
        if (!webProgress?.isTopLevel) {
          return;
        }
        const WPL = Ci.nsIWebProgressListener;
        if (flags & WPL.STATE_IS_NETWORK) {
          if (flags & WPL.STATE_START) {
            setProgress(0.08);
          } else if (flags & WPL.STATE_STOP) {
            setProgress(1);
          }
        }
      },
      onProgressChange(webProgress, request, curSelf, maxSelf, curTotal, maxTotal) {
        if (webProgress?.isTopLevel && maxTotal > 0) {
          setProgress(0.08 + 0.87 * (curTotal / maxTotal));
        }
      },
      onLocationChange() {},
      onStatusChange() {},
      onSecurityChange() {},
      onContentBlockingEvent() {},
    };
    if (win.gBrowser) {
      win.gBrowser.addProgressListener(progressListener);
      onUnload.push(() => win.gBrowser.removeProgressListener(progressListener));
      win.gBrowser.tabContainer.addEventListener("TabSelect", () => {
        const busy = win.gBrowser.selectedTab.hasAttribute("busy");
        if (!busy) {
          win.clearTimeout(hideTimer);
          bar.classList.remove("fm-active");
          fill.style.transform = "scaleX(0)";
        }
      });
    }

  });
  safe("copy url", () => {
    /* -------------------- Alt+Shift+C: копировать адрес ------------------- */
    win.addEventListener("keydown", e => {
      if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === "KeyC") {
        e.preventDefault();
        e.stopPropagation();
        try {
          const uri = win.gBrowser.currentURI;
          const url = uri?.displaySpec || uri?.spec;
          if (url) {
            Cc["@mozilla.org/widget/clipboardhelper;1"]
              .getService(Ci.nsIClipboardHelper)
              .copyString(url);
            toast("Ссылка скопирована", "ok");
          }
        } catch (err) {
          toast("Не получилось скопировать ссылку", "warn");
        }
      }
    }, true);

  });
  safe("download toast", () => {
    /* -------------------- уведомление о загрузке файла -------------------- */
    (async () => {
      try {
        const { Downloads } = ChromeUtils.importESModule("resource://gre/modules/Downloads.sys.mjs");
        const list = await Downloads.getList(Downloads.ALL);
        const done = new WeakSet();
        const view = {
          onDownloadChanged(d) {
            if (!d.succeeded || done.has(d)) {
              return;
            }
            done.add(d);
            const topWin = Services.wm.getMostRecentWindow("navigator:browser");
            if (topWin !== win) {
              return;
            }
            const name = (d.target?.path || "").split(/[\\/]/).pop() || "файл";
            toast(`Загружено: ${name}`, "ok");
          },
          onDownloadAdded(d) {
            if (d.succeeded) {
              done.add(d);
            }
          },
        };
        await list.addView(view);
        onUnload.push(() => list.removeView(view));
      } catch (e) {
        console.error("[floorp-modern] downloads:", e);
      }
    })();

  });
  safe("theme button", () => {
    /* ---------------------- кнопка смены темы ---------------------- */
    const THEME_PREFS = ["browser.theme.toolbar-theme", "browser.theme.content-theme"];
    // 0 = тёмная, 1 = светлая, 2 = как в системе
    const ORDER = [2, 1, 0];
    const NAMES = { 0: "Тёмная", 1: "Светлая", 2: "Авто" };
    const currentTheme = () => {
      try {
        return Services.prefs.getIntPref(THEME_PREFS[0], 2);
      } catch (e) {
        return 2;
      }
    };
    const CustomizableUI = win.CustomizableUI;
    const WIDGET = "fm-theme-button";
    if (CustomizableUI.getWidget(WIDGET)?.provider !== CustomizableUI.PROVIDER_API) {
      try {
        CustomizableUI.createWidget({
          id: WIDGET,
          type: "button",
          defaultArea: CustomizableUI.AREA_NAVBAR,
          label: "Тема",
          tooltiptext: "Тема: Авто / Светлая / Тёмная",
          onCreated(node) {
            node.setAttribute("fm-theme", String(currentTheme()));
          },
          onCommand(event) {
            const now = currentTheme();
            const next = ORDER[(ORDER.indexOf(now) + 1) % ORDER.length];
            for (const p of THEME_PREFS) {
              Services.prefs.setIntPref(p, next);
            }
            const w = event.target.ownerGlobal;
            w.FloorpModernToast?.(`Тема: ${NAMES[next]}`, "info");
          },
        });
      } catch (e) {
        // виджет уже создан в другом окне
      }
    }
    const syncThemeButton = () => {
      const node = doc.getElementById(WIDGET);
      if (node) {
        node.setAttribute("fm-theme", String(currentTheme()));
      }
    };
    const prefObserver = { observe: syncThemeButton };
    Services.prefs.addObserver(THEME_PREFS[0], prefObserver);
    onUnload.push(() => Services.prefs.removeObserver(THEME_PREFS[0], prefObserver));
    syncThemeButton();

  });
  safe("now bar", () => {
    /* ------------- «Now Bar»: что играет в другой вкладке ------------- */
    const gB = win.gBrowser;
    if (!gB) {
      return;
    }
    const bar = el("div", "fm-nowbar");
    const eq = el("div", "fm-nowbar-eq");
    eq.append(el("span"), el("span"), el("span"));
    const title = el("div", "fm-nowbar-title");
    const prev = el("div", "fm-nowbar-btn fm-nowbar-prev");
    const play = el("div", "fm-nowbar-btn fm-nowbar-play");
    const next = el("div", "fm-nowbar-btn fm-nowbar-next");
    const mute = el("div", "fm-nowbar-btn fm-nowbar-mute");
    const close = el("div", "fm-nowbar-btn fm-nowbar-close");
    prev.title = "Назад";
    next.title = "Вперёд";
    play.title = "Пауза / продолжить";
    mute.title = "Звук вкладки";
    close.title = "Скрыть";
    bar.append(eq, title, prev, play, next, mute, close);
    host.after(bar);

    let current = null;      // вкладка, которую показывает плашка
    let pausedByUs = false;  // мы поставили на паузу — плашку не прячем
    const dismissed = new WeakSet();

    const controller = tab => {
      try {
        return tab.linkedBrowser.browsingContext.mediaController;
      } catch (e) {
        return null;
      }
    };
    const pick = () => {
      if (current && current.isConnected && (current.hasAttribute("soundplaying") || pausedByUs)) {
        return current;
      }
      pausedByUs = false;
      return [...gB.tabs].reverse().find(t => t.hasAttribute("soundplaying") && !dismissed.has(t)) || null;
    };
    const render = () => {
      current = pick();
      const show = !!current && current !== gB.selectedTab && !dismissed.has(current);
      bar.classList.toggle("fm-in", show);
      doc.documentElement.toggleAttribute("fm-nowbar", show);
      if (!current) {
        return;
      }
      title.textContent = current.label || "Музыка";
      bar.toggleAttribute("data-paused", pausedByUs);
      bar.toggleAttribute("data-muted", current.hasAttribute("muted"));
      // «назад/вперёд» показываем, только если сайт их поддерживает (YouTube, Spotify, ВК…)
      let keys = [];
      try {
        keys = [...(controller(current)?.supportedKeys || [])];
      } catch (e) {}
      prev.hidden = !keys.includes("previoustrack") && !keys.includes("seekbackward");
      next.hidden = !keys.includes("nexttrack") && !keys.includes("seekforward");
      if (show) {
        placeSaved();
      }
    };

    /* ---- перетаскивание плашки; место запоминается ---- */
    const POS_PREF = "floorp.modern.nowbar.pos";
    const area = () => bar.offsetParent || bar.parentNode;
    const placeAt = (x, y) => {
      const p = area();
      const maxX = Math.max(0, p.clientWidth - bar.offsetWidth - 8);
      const maxY = Math.max(0, p.clientHeight - bar.offsetHeight - 8);
      bar.style.left = Math.min(maxX, Math.max(8, x)) + "px";
      bar.style.top = Math.min(maxY, Math.max(8, y)) + "px";
      bar.style.bottom = "auto";
      bar.setAttribute("data-moved", "true");
    };
    function placeSaved() {
      let saved = "";
      try {
        saved = Services.prefs.getStringPref(POS_PREF, "");
      } catch (e) {}
      const m = /^([\d.]+),([\d.]+)$/.exec(saved);
      if (!m) {
        return;
      }
      const p = area();
      placeAt(+m[1] * p.clientWidth, +m[2] * p.clientHeight);
    }
    let drag = null;
    bar.addEventListener("pointerdown", e => {
      if (e.button !== 0 || e.target.closest(".fm-nowbar-btn")) {
        return;
      }
      const r = bar.getBoundingClientRect();
      const pr = area().getBoundingClientRect();
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: e.clientX - r.left + pr.left, dy: e.clientY - r.top + pr.top, moved: false };
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener("pointermove", e => {
      if (!drag || e.pointerId !== drag.id) {
        return;
      }
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) {
        return;
      }
      drag.moved = true;
      bar.classList.add("fm-dragging");
      placeAt(e.clientX - drag.dx, e.clientY - drag.dy);
    });
    const endDrag = e => {
      if (!drag || e.pointerId !== drag.id) {
        return;
      }
      if (drag.moved) {
        const p = area();
        const x = parseFloat(bar.style.left) / p.clientWidth;
        const y = parseFloat(bar.style.top) / p.clientHeight;
        try {
          Services.prefs.setStringPref(POS_PREF, `${x.toFixed(4)},${y.toFixed(4)}`);
        } catch (err) {}
        // после перетаскивания клик по названию не должен переключать вкладку
        bar.addEventListener("click", ev => ev.stopPropagation(), { capture: true, once: true });
      }
      bar.classList.remove("fm-dragging");
      drag = null;
    };
    bar.addEventListener("pointerup", endDrag);
    bar.addEventListener("pointercancel", endDrag);
    // двойной клик по пустому месту — вернуть плашку вниз по центру
    bar.addEventListener("dblclick", e => {
      if (e.target.closest(".fm-nowbar-btn")) {
        return;
      }
      try {
        Services.prefs.clearUserPref(POS_PREF);
      } catch (err) {}
      bar.removeAttribute("data-moved");
      bar.style.left = bar.style.top = bar.style.bottom = "";
    });
    win.addEventListener("resize", () => bar.classList.contains("fm-in") && placeSaved());

    title.addEventListener("click", () => current && (gB.selectedTab = current));
    play.addEventListener("click", () => {
      const mc = current && controller(current);
      if (!mc) {
        return;
      }
      try {
        if (pausedByUs) {
          mc.play();
          pausedByUs = false;
        } else {
          mc.pause();
          pausedByUs = true;
        }
      } catch (e) {
        log("now bar: пауза не сработала", e);
      }
      render();
    });
    const mediaKey = (main, alt) => {
      const mc = current && controller(current);
      if (!mc) {
        return;
      }
      try {
        const keys = [...(mc.supportedKeys || [])];
        if (keys.includes(main)) {
          main === "previoustrack" ? mc.prevTrack() : mc.nextTrack();
        } else if (keys.includes(alt)) {
          alt === "seekbackward" ? mc.seekBackward(10) : mc.seekForward(10);
        }
      } catch (e) {
        log("now bar: назад/вперёд не сработало", e);
      }
    };
    prev.addEventListener("click", () => mediaKey("previoustrack", "seekbackward"));
    next.addEventListener("click", () => mediaKey("nexttrack", "seekforward"));
    mute.addEventListener("click", () => {
      current?.toggleMuteAudio();
      render();
    });
    close.addEventListener("click", () => {
      if (current) {
        dismissed.add(current);
      }
      pausedByUs = false;
      render();
    });

    const tc = gB.tabContainer;
    const onAttr = e => {
      const changed = e.detail?.changed || [];
      if (changed.includes("soundplaying") || changed.includes("muted") || changed.includes("label")) {
        if (changed.includes("soundplaying") && e.target.hasAttribute("soundplaying")) {
          dismissed.delete(e.target);
          if (e.target === current) {
            pausedByUs = false;
          }
        }
        render();
      }
    };
    tc.addEventListener("TabAttrModified", onAttr);
    tc.addEventListener("TabSelect", render);
    tc.addEventListener("TabClose", () => win.setTimeout(render, 0));
    onUnload.push(() => {
      tc.removeEventListener("TabAttrModified", onAttr);
      tc.removeEventListener("TabSelect", render);
    });
  });

  safe("zoom and mute toasts", () => {
    /* ---------------- масштаб страницы и звук вкладки ---------------- */
    const gB = win.gBrowser;
    if (!gB) {
      return;
    }
    let lastBrowser = gB.selectedBrowser;
    const zoomOf = b => {
      try {
        return Math.round(win.ZoomManager.getZoomForBrowser(b) * 100);
      } catch (e) {
        return 0;
      }
    };
    let lastZoom = zoomOf(lastBrowser);
    let zoomTimer = 0;
    win.addEventListener("FullZoomChange", () => {
      win.clearTimeout(zoomTimer);
      zoomTimer = win.setTimeout(() => {
        const b = gB.selectedBrowser;
        const z = zoomOf(b);
        if (b === lastBrowser && z && z !== lastZoom) {
          toast(`Масштаб ${z}%`, "info");
        }
        lastBrowser = b;
        lastZoom = z;
      }, 120);
    }, true);
    gB.tabContainer.addEventListener("TabSelect", () => {
      lastBrowser = gB.selectedBrowser;
      lastZoom = zoomOf(lastBrowser);
    });
    gB.tabContainer.addEventListener("TabAttrModified", e => {
      if (e.target === gB.selectedTab && (e.detail?.changed || []).includes("muted")) {
        toast(e.target.hasAttribute("muted") ? "Звук вкладки выключен" : "Звук вкладки включён", "info");
      }
    });
  });

  safe("shortcuts", () => {
    /* ------------ Alt+Shift+D — дубли, Alt+Shift+Z — режим фокуса ------------ */
    win.addEventListener("keydown", e => {
      if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) {
        return;
      }
      if (e.code === "KeyD") {
        e.preventDefault();
        e.stopPropagation();
        const gB = win.gBrowser;
        const seen = new Set();
        const extra = [];
        // выбранная вкладка остаётся, закрываем её копии
        for (const t of [gB.selectedTab, ...gB.tabs]) {
          if (t.pinned) {
            continue;
          }
          const url = t.linkedBrowser?.currentURI?.spec;
          if (!url || url === "about:blank") {
            continue;
          }
          if (seen.has(url)) {
            if (t !== gB.selectedTab) {
              extra.push(t);
            }
          } else {
            seen.add(url);
          }
        }
        const uniq = [...new Set(extra)];
        if (uniq.length) {
          gB.removeTabs(uniq);
          toast(`Закрыто одинаковых вкладок: ${uniq.length}`, "ok");
        } else {
          toast("Одинаковых вкладок нет", "info");
        }
      } else if (e.code === "KeyZ") {
        e.preventDefault();
        e.stopPropagation();
        const on = !doc.documentElement.hasAttribute("fm-focus");
        doc.documentElement.toggleAttribute("fm-focus", on);
        toast(on ? "Режим фокуса: Alt+Shift+Z — выйти" : "Режим фокуса выключен", "info");
      }
    }, true);
  });
})();
