/* Floorp Modern — новые функции окна браузера.
 * Загружается в каждое окно Floorp загрузчиком из папки программы (config.js).
 *
 *  1. Полоска загрузки страницы под панелью (цвет акцента).
 *  2. Всплывающие уведомления в стиле One UI («тосты»).
 *  3. Alt+Shift+C — скопировать адрес страницы.
 *  4. Уведомление о завершённой загрузке файла.
 *  5. Кнопка быстрой смены темы: Авто / Светлая / Тёмная.
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
})();
