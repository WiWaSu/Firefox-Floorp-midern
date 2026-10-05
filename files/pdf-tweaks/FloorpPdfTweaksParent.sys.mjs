/* Floorp PDF tweaks — родительская часть.
 *  1. Сохраняет тему, выбранную в просмотрщике PDF.
 *  2. Запасной загрузчик: подключает floorp-modern.uc.js во все окна браузера
 *     (если основной загрузчик этого не сделал) и пишет журнал fm-boot.json.
 */

const ALLOWED = {
  ui: ["auto", "light", "dark"],
  page: ["auto", "paper", "sepia", "night"],
};

let booted = false;
const bootLog = [];

function logDir() {
  try {
    return PathUtils.join(Services.dirsvc.get("UChrm", Ci.nsIFile).path, "pdf-tweaks");
  } catch (e) {
    return null;
  }
}

function writeLog() {
  const dir = logDir();
  if (dir) {
    IOUtils.writeJSON(PathUtils.join(dir, "fm-boot.json"), bootLog).catch(() => {});
  }
}

function loadInto(win) {
  try {
    if (!win || win.closed || win.location?.href !== "chrome://browser/content/browser.xhtml") {
      return;
    }
    if (win.__floorpModern) {
      bootLog.push({ t: new Date().toISOString(), msg: "окно уже со скриптом (основной загрузчик сработал)" });
      return;
    }
    Services.scriptloader.loadSubScriptWithOptions("resource://pdftweaks/floorp-modern.uc.js", {
      target: win,
      ignoreCache: true,
    });
    bootLog.push({ t: new Date().toISOString(), msg: "скрипт подключён запасным загрузчиком" });
  } catch (e) {
    bootLog.push({ t: new Date().toISOString(), msg: "ОШИБКА: " + e, stack: String(e?.stack || "") });
  }
  writeLog();
}

export function boot() {
  if (booted) {
    return;
  }
  booted = true;
  bootLog.push({ t: new Date().toISOString(), msg: "запасной загрузчик запущен" });
  try {
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      if (win.gBrowserInit?.delayedStartupFinished) {
        loadInto(win);
      }
    }
    Services.obs.addObserver(subject => loadInto(subject), "browser-delayed-startup-finished");
  } catch (e) {
    bootLog.push({ t: new Date().toISOString(), msg: "ОШИБКА запуска: " + e });
  }
  writeLog();
}

export class FloorpPdfTweaksParent extends JSWindowActorParent {
  receiveMessage(msg) {
    if (msg.name === "PdfTweaks:boot") {
      boot();
      return;
    }
    if (msg.name === "PdfTweaks:page") {
      // запоминаем страницу для файла (последние 150 файлов)
      const { url, page } = msg.data || {};
      if (typeof url !== "string" || !url || url.length > 2000 || !(page > 0)) {
        return;
      }
      let map = {};
      try {
        map = JSON.parse(Services.prefs.getStringPref("floorp.pdftweaks.pages", "{}")) || {};
      } catch (e) {}
      map[url] = { p: Math.floor(page), t: Date.now() };
      const keys = Object.keys(map);
      if (keys.length > 150) {
        keys.sort((a, b) => (map[a].t || 0) - (map[b].t || 0));
        for (const k of keys.slice(0, keys.length - 150)) {
          delete map[k];
        }
      }
      Services.prefs.setStringPref("floorp.pdftweaks.pages", JSON.stringify(map));
      return;
    }
    if (msg.name !== "PdfTweaks:save") {
      return;
    }
    const { ui, page } = msg.data || {};
    if (ALLOWED.ui.includes(ui)) {
      Services.prefs.setStringPref("floorp.pdftweaks.ui", ui);
    }
    if (ALLOWED.page.includes(page)) {
      Services.prefs.setStringPref("floorp.pdftweaks.page", page);
    }
  }
}
