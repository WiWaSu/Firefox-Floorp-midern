#!/usr/bin/env python3
"""Floorp Modern: userChrome.css layer (browser UI) + userContent.css layer (about: pages)."""

def svg(body, fill=False, sw="2.1"):
    attrs = ("fill='context-fill'" if fill else
             f"fill='none' stroke='context-fill' stroke-width='{sw}' stroke-linecap='round' stroke-linejoin='round'")
    return ("url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' "
            + attrs + ">" + body + "</svg>\")")

P = lambda d: f"<path d='{d}'/>"

ICONS = {
    "#back-button": svg(P("M19 12H5") + P("M11 6l-6 6 6 6")),
    "#forward-button": svg(P("M5 12h14") + P("M13 6l6 6-6 6")),
    "#reload-button": svg(P("M20 12a8 8 0 1 1-2.35-5.65") + P("M20 4v5h-5")),
    "#stop-button": svg(P("M6 6l12 12M18 6L6 18")),
    "#home-button": svg(P("M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z")),
    "#downloads-button": svg(P("M12 3.5v11") + P("M7 10l5 5 5-5") + P("M4.5 20h15")),
    "#PanelUI-menu-button": svg(P("M4 7h16M4 12h16M4 17h16")),
    "#unified-extensions-button": svg(P("M9.5 4.5a2 2 0 0 1 4 0V6H17a1 1 0 0 1 1 1v3.5h1.5a2 2 0 0 1 0 4H18V18a1 1 0 0 1-1 1h-3.5v-1.5a2 2 0 0 0-4 0V19H6a1 1 0 0 1-1-1v-3.5h1.5a2 2 0 0 0 0-4H5V7a1 1 0 0 1 1-1h3.5z")),
    "#sidebar-button": svg("<rect x='3' y='4' width='18' height='16' rx='3.5'/>" + P("M9.5 4v16")),
    "#new-tab-button, #tabs-newtab-button, #vertical-tabs-newtab-button": svg(P("M12 5v14M5 12h14")),
    "#alltabs-button": svg(P("M7 10l5 5 5-5")),
    "#PlacesChevron": svg(P("M7 7l5 5-5 5M13 7l5 5-5 5")),
    "#fxa-toolbar-menu-button": svg("<circle cx='12' cy='8.5' r='3.5'/>" + P("M5 19.5c1.3-3.3 4-5 7-5s5.7 1.7 7 5")),
    "#bookmarks-menu-button": svg(P("M7 3.5h10v17l-5-4-5 4z")),
    "#history-panelmenu": svg("<circle cx='12' cy='12' r='8.5'/>" + P("M12 7.5V12l3 2")),
    "#print-button": svg(P("M7 9V3.5h10V9") + "<rect x='3.5' y='9' width='17' height='8' rx='2.5'/>" + P("M7 14h10v6.5H7z")),
    "#screenshot-button": svg(P("M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2")),
    "#developer-button": svg(P("M9 8l-4 4 4 4M15 8l4 4-4 4")),
    "#preferences-button": svg("<circle cx='12' cy='12' r='3'/>" + P("M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z")),
}

icon_rules = "\n".join(
    f"  :is({sel}) {{ list-style-image: {url} !important; }}" for sel, url in ICONS.items()
)

TOKENS = r"""
  /* ---------- НАСТРОЙКИ: меняйте тут ---------- */
  /* цвет акцента берётся из Windows (Параметры > Персонализация > Цвета) */
  --fm-accent: light-dark(AccentColor, color-mix(in srgb, AccentColor 62%, white));
  --fm-on-accent: light-dark(AccentColorText, color-mix(in srgb, AccentColor 22%, black));
  --fm-radius: 22px;          /* скругление карточки со страницей */
  --fm-gap: 8px;              /* отступ вокруг карточки */
  /* -------------------------------------------- */

  --fm-frame:  light-dark(#f2f3f5, #000000);
  --fm-bar:    light-dark(#ffffff, #17181a);
  --fm-field:  light-dark(#ffffff, #1f2022);
  --fm-line:   light-dark(rgb(0 0 0 / .07), rgb(255 255 255 / .07));
  --fm-ink:    light-dark(#111214, #f2f2f3);
  --fm-muted:  light-dark(#6b6f76, #9a9da3);
  --fm-hover:  light-dark(rgb(0 0 0 / .05), rgb(255 255 255 / .08));
  --fm-press:  light-dark(rgb(0 0 0 / .10), rgb(255 255 255 / .14));
  --fm-soft:   color-mix(in srgb, var(--fm-accent) 17%, transparent);
  --fm-glass:  light-dark(rgb(255 255 255 / .78), rgb(36 37 40 / .72));
  --fm-shine:  inset 0 1px 0 light-dark(rgb(255 255 255 / .95), rgb(255 255 255 / .07));
  --fm-pop:    0 4px 10px light-dark(rgb(0 0 0 / .06), rgb(0 0 0 / .45)),
               0 22px 56px light-dark(rgb(0 0 0 / .14), rgb(0 0 0 / .65));
  --fm-card:   0 1px 3px light-dark(rgb(0 0 0 / .05), rgb(0 0 0 / .6)),
               0 10px 30px light-dark(rgb(0 0 0 / .06), rgb(0 0 0 / .4));
  --fm-font:   "Segoe UI Variable Display", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif;
"""

CHROME = r"""
/* ======================= FLOORP-MODERN BEGIN ======================= */
/* Floorp Modern · стиль Samsung One UI 8.5.
   Блок ставит и убирает установщик. Правки внутри пропадут при переустановке. */

:root {
@TOKENS@
  --color-accent-primary: var(--fm-accent) !important;
  --color-accent-primary-hover: color-mix(in srgb, var(--fm-accent) 88%, var(--fm-ink)) !important;
  --color-accent-primary-active: color-mix(in srgb, var(--fm-accent) 76%, var(--fm-ink)) !important;
  --focus-outline-color: var(--fm-accent) !important;
  --toolbar-field-focus-border-color: var(--fm-accent) !important;
  --toolbarbutton-border-radius: 999px !important;
  --tab-border-radius: 999px !important;
  --tab-background-color-hover: var(--fm-hover) !important;
  --chrome-block-radius: var(--fm-radius) !important;
  --border-radius-medium: 14px !important;
  --panel-border-radius: 26px !important;
  --arrowpanel-border-radius: 26px !important;
  --arrowpanel-menuitem-border-radius: 16px !important;
  --menuitem-border-radius: 14px !important;
  --panel-shadow: var(--fm-pop) !important;
  --urlbarview-border-radius: 26px !important;
}

#navigator-toolbox, #sidebar-main, #panel-sidebar-select-box, menupopup, panel, tooltip {
  font-family: var(--fm-font) !important;
}

/* ---------- фон окна: чистый чёрный / светло-серый, как в One UI ---------- */
:root:not([lwtheme]) {
  --toolbox-background-color: var(--fm-frame) !important;
  --toolbox-background-color-inactive: var(--fm-frame) !important;
  --toolbar-background-color: var(--fm-frame) !important;
  --toolbar-bgcolor: var(--fm-frame) !important;
  --sidebar-background-color: var(--fm-frame) !important;
  --panel-sidebar-background-color: var(--fm-frame) !important;
  --toolbox-background-image: none !important;
}
:root:not([lwtheme]) :is(#navigator-toolbox, #nav-bar, #PersonalToolbar, #TabsToolbar, #browser, #sidebar-main, #sidebar-box, #panel-sidebar-select-box, #nora-statusbar) {
  background-color: var(--fm-frame) !important;
  background-image: none !important;
}
#navigator-toolbox { border-bottom: 0 !important; }
#nav-bar { box-shadow: none !important; border-top: 0 !important; padding-block: 4px !important; }

/* ---------- карточка со страницей ---------- */
:root:not([inDOMFullscreen], [inFullscreen]) #tabbrowser-tabbox {
  padding: 0 var(--fm-gap) var(--fm-gap) !important;
  background: transparent !important;
  box-shadow: none !important;
  outline: none !important;
}
:root:not([inDOMFullscreen], [inFullscreen]) #tabbrowser-tabpanels .browserContainer {
  border-radius: var(--fm-radius) !important;
  overflow: clip !important;
  border: 0 !important;
  box-shadow: var(--fm-card) !important;
  outline: none !important;
}
#tabbrowser-tabpanels { background: transparent !important; }

/* ---------- кнопки: круглые, с мягким «объёмом» ---------- */
toolbar .toolbarbutton-1 {
  --toolbarbutton-hover-background: var(--fm-hover) !important;
  --toolbarbutton-active-background: var(--fm-press) !important;
}
toolbar .toolbarbutton-1 > :is(.toolbarbutton-icon, .toolbarbutton-badge-stack, .toolbarbutton-text) {
  border-radius: 999px !important;
}
toolbar .toolbarbutton-1[disabled] { opacity: .3 !important; }
toolbarbutton:is([open], [checked]) > :is(.toolbarbutton-icon, .toolbarbutton-badge-stack) {
  background-color: var(--fm-soft) !important;
  fill: var(--fm-accent) !important;
}

@ICONS@

/* ---------- адресная строка: «таблетка» ---------- */
#urlbar {
  --toolbar-field-background-color: var(--fm-frame) !important;
  --toolbar-field-focus-background-color: var(--fm-frame) !important;
  --toolbar-field-border-color: transparent !important;
  --urlbar-min-height: 36px !important;
}
#urlbar-background, .urlbar-background {
  border-radius: 999px !important;
  background-color: color-mix(in srgb, currentColor 9%, var(--toolbar-field-background-color, transparent)) !important;
  border: 0 !important;
  box-shadow: var(--fm-shine), 0 1px 3px light-dark(rgb(0 0 0 / .08), rgb(0 0 0 / .5)) !important;
}
#urlbar[fm-unused-legacy] > :is(#urlbar-background, .urlbar-background) {
  outline: 2px solid var(--fm-accent) !important;
  outline-offset: -1px !important;
}
#urlbar[open] > :is(#urlbar-background, .urlbar-background) {
  border-radius: 26px !important;
}
#urlbar-input { font-size: 14px !important; }
#urlbar-input-container { padding-inline: 6px !important; }
.urlbarView-row, .urlbarView-row-inner { border-radius: 16px !important; }
.urlbarView-row[selected] > .urlbarView-row-inner {
  background-color: var(--fm-soft) !important;
  color: inherit !important;
}
.urlbarView-row[selected] :is(.urlbarView-title, .urlbarView-url, .urlbarView-action) { color: inherit !important; }
#identity-box, #tracking-protection-icon-container, .searchmode-switcher, #urlbar-searchmode-switcher,
#identity-icon-box, #identity-permission-box, .urlbar-page-action {
  border-radius: 999px !important;
}

/* ---------- вкладки: «таблетки» ---------- */
.tabbrowser-tab > .tab-stack > .tab-background {
  border-radius: 999px !important;
  outline: none !important;
}
.tabbrowser-tab[selected] > .tab-stack > .tab-background,
.tabbrowser-tab[multiselected] > .tab-stack > .tab-background {
  background: var(--fm-soft) !important;
  box-shadow: none !important;
}
.tabbrowser-tab[selected] .tab-label { color: var(--fm-accent) !important; }
.tabbrowser-tab:not([selected]):hover > .tab-stack > .tab-background { background: var(--fm-hover) !important; }
.tab-label { font-size: 13px !important; }
.tab-close-button { border-radius: 999px !important; }
.tab-close-button:hover { background: var(--fm-hover) !important; }
.tab-throbber, .tab-loading-burst { color: var(--fm-accent) !important; }

/* ---------- закладки: «таблетки» ---------- */
#PersonalToolbar { padding-block: 0 6px !important; }
#PlacesToolbarItems > .bookmark-item, #PersonalToolbar .toolbarbutton-1 {
  border-radius: 999px !important;
  padding: 5px 11px !important;
  margin-inline: 2px !important;
}
/* цвет «таблеток» считается от цвета текста: так он всегда верный,
   даже если при запуске Floorp на миг считает тему светлой */
#PlacesToolbarItems > .bookmark-item {
  background: color-mix(in srgb, currentColor 9%, transparent) !important;
  box-shadow: inset 0 1px 0 color-mix(in srgb, currentColor 7%, transparent) !important;
}
#PlacesToolbarItems > .bookmark-item:hover { background: color-mix(in srgb, currentColor 15%, transparent) !important; }
#PlacesToolbarItems > .bookmark-item[open] { background: var(--fm-soft) !important; color: var(--fm-accent) !important; }
#PlacesToolbarItems > .bookmark-item > .toolbarbutton-text { font-size: 12.5px !important; font-weight: 500 !important; }
#PlacesToolbarItems > toolbarseparator { display: none !important; }

/* ---------- боковая панель сайтов Floorp ----------
   Без обрезки, теней и анимаций: внутри панели живая веб-страница,
   и такие эффекты заставляют её перерисовываться (тормоза). */
#panel-sidebar-select-box { border-inline: 0 !important; }
.panel-sidebar-panel, .panel-sidebar-actions {
  border-radius: 999px !important;
  box-shadow: none !important;
  transition: none !important;
}
.panel-sidebar-panel:hover, .panel-sidebar-actions:hover {
  background-color: var(--fm-hover) !important;
  box-shadow: none !important;
}
.panel-sidebar-panel[data-checked="true"] {
  background-color: var(--fm-soft) !important;
  box-shadow: none !important;
}
#panel-sidebar-box, #panel-sidebar-header {
  background: var(--fm-bar) !important;
  background-image: none !important;
}
#panel-sidebar-splitter, #sidebar-splitter { border: 0 !important; }

/* ---------- меню: крупные карточки ---------- */
menupopup, panel {
  --panel-background: var(--fm-bar) !important;
  --panel-color: var(--fm-ink) !important;
  --panel-border-color: var(--fm-line) !important;
  --panel-padding: 8px !important;
  --menuitem-padding: 8px 14px !important;
  --arrowpanel-background: var(--fm-bar) !important;
  --arrowpanel-color: var(--fm-ink) !important;
  --arrowpanel-border-color: var(--fm-line) !important;
  --arrowpanel-dimmed: var(--fm-hover) !important;
  --arrowpanel-dimmed-further: var(--fm-press) !important;
  --panel-item-hover-bgcolor: var(--fm-hover) !important;
  --panel-item-active-bgcolor: var(--fm-press) !important;
}
menupopup > :is(menuitem, menu) { border-radius: 14px !important; min-height: 36px !important; }
menupopup > :is(menuitem, menu):is([_moz-menuactive], :hover):not([disabled]) {
  background-color: var(--fm-hover) !important;
  color: inherit !important;
}
menupopup > menuseparator { opacity: .4 !important; margin-inline: 14px !important; }
.subviewbutton { border-radius: 16px !important; min-height: 38px !important; }
.subviewbutton:not([disabled]):hover { background-color: var(--fm-hover) !important; }
.panel-footer > button, button.primary, .popup-notification-primary-button,
.popup-notification-secondary-button, .footer-button {
  border-radius: 999px !important;
}
button.primary, .popup-notification-primary-button {
  background-color: var(--fm-accent) !important;
  color: var(--fm-on-accent) !important;
}
tooltip {
  appearance: none !important;
  background: var(--fm-bar) !important;
  color: var(--fm-ink) !important;
  border: 1px solid var(--fm-line) !important;
  border-radius: 999px !important;
  padding: 6px 12px !important;
}

/* ---------- мелочи ---------- */
.toolbarbutton-badge {
  background-color: var(--fm-accent) !important;
  color: var(--fm-on-accent) !important;
  box-shadow: none !important;
  border-radius: 999px !important;
}
#nav-bar toolbarspring { max-width: 64px !important; }
findbar { border-top: 0 !important; background: var(--fm-frame) !important; }
findbar .findbar-textbox { border-radius: 999px !important; }
.notificationbox-stack notification-message, .infobar { border-radius: 18px !important; }

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; }
}

/* ======== ВАУ-СЛОЙ ======== */


/* ======== НОВЫЕ ФУНКЦИИ (скрипт floorp-modern.uc.js) ======== */

/* полоска загрузки страницы */
#navigator-toolbox { position: relative !important; }
.fm-progress {
  position: absolute; inset-inline: 0; bottom: 0; height: 2px;
  pointer-events: none; opacity: 0; transition: opacity .25s ease; z-index: 10;
}
.fm-progress.fm-active { opacity: 1; }
.fm-progress-fill {
  height: 100%; transform-origin: 0 50%; transform: scaleX(0);
  background: linear-gradient(90deg, var(--fm-accent), color-mix(in srgb, var(--fm-accent) 55%, #22d3ee));
  box-shadow: 0 0 10px var(--fm-accent);
  border-radius: 0 2px 2px 0;
  transition: transform .35s cubic-bezier(.2, .8, .2, 1);
}

/* всплывающие уведомления */
.fm-toasts {
  position: absolute; inset-inline: 0; bottom: 28px; z-index: 1000;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  pointer-events: none;
}
.fm-toast {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 18px 11px 14px; border-radius: 999px;
  background: var(--fm-bar); color: var(--fm-ink);
  font: 500 13.5px var(--fm-font);
  box-shadow: var(--fm-shine), var(--fm-pop);
  border: 1px solid var(--fm-line);
  opacity: 0; transform: translateY(14px) scale(.96);
  transition: opacity .28s ease, transform .35s cubic-bezier(.2, .9, .25, 1.2);
}
.fm-toast.fm-in { opacity: 1; transform: none; }
.fm-toast.fm-out { opacity: 0; transform: translateY(8px) scale(.98); }
.fm-toast-dot {
  width: 9px; height: 9px; border-radius: 50%; background: var(--fm-accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--fm-accent) 22%, transparent);
}
.fm-toast[data-kind="ok"] .fm-toast-dot { background: #34c759; box-shadow: 0 0 0 4px rgb(52 199 89 / .22); }
.fm-toast[data-kind="warn"] .fm-toast-dot { background: #ff9f0a; box-shadow: 0 0 0 4px rgb(255 159 10 / .22); }

/* кнопка темы */
#fm-theme-button { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='context-fill' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='8'/><path d='M12 4a8 8 0 0 1 0 16z' fill='context-fill'/></svg>") !important; }
#fm-theme-button[fm-theme="1"] { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='context-fill' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='4'/><path d='M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4'/></svg>") !important; }
#fm-theme-button[fm-theme="0"] { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='context-fill' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'><path d='M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'/></svg>") !important; }

/* плавное появление страницы при переключении вкладок */
#tabbrowser-tabpanels > .deck-selected .browserStack {
  animation: fm-tab-in .22s cubic-bezier(.2, .8, .2, 1);
}
@keyframes fm-tab-in { from { opacity: .55; transform: scale(.995); } to { opacity: 1; transform: none; } }

/* ======== ПАНЕЛИ ======== */
/* загрузки */
#downloadsPanel { --panel-padding: 8px !important; }
#downloadsListBox > richlistitem {
  border-radius: 16px !important; margin: 2px 0 !important; padding-block: 6px !important;
}
#downloadsListBox > richlistitem:hover { background: var(--fm-hover) !important; }
#downloadsListBox > richlistitem[selected] { background: var(--fm-soft) !important; }
.downloadProgress::-moz-progress-bar { background: var(--fm-accent) !important; border-radius: 999px !important; }
.downloadProgress { border-radius: 999px !important; background: var(--fm-hover) !important; }
.downloadButton { border-radius: 999px !important; }
/* расширения */
.unified-extensions-item, .unified-extensions-item-action-button, .unified-extensions-item-menu-button {
  border-radius: 16px !important;
}
.unified-extensions-item-icon, .unified-extensions-item .webextension-browser-action > .toolbarbutton-badge-stack {
  border-radius: 10px !important;
}
/* главное меню */
#appMenu-popup .panel-header, .panel-header { padding-block: 10px !important; }
.panel-header > h1 { font-weight: 600 !important; font-size: 15px !important; }
.panel-subview-body { padding-inline: 4px !important; }
toolbarseparator, .panel-subview-body > toolbarseparator { opacity: .45 !important; }
.toolbaritem-combined-buttons > .subviewbutton { border-radius: 999px !important; }
#appMenu-zoom-controls .subviewbutton { border-radius: 999px !important; }
/* разрешения сайтов, защита */
#identity-popup, #permission-popup, #protections-popup { --panel-border-radius: 26px !important; }
.protections-popup-section, .identity-popup-section { border-radius: 18px !important; }
moz-toggle { --toggle-background-color-pressed: var(--fm-accent) !important; --color-accent-primary: var(--fm-accent) !important; }



/* ======== ЦВЕТА ЧЕРЕЗ ПЕРЕМЕННЫЕ FIREFOX 156 (доходят и внутрь встроенных компонентов) ======== */
:root, menupopup, panel, tooltip, #urlbar, .urlbarView {
  --fm-menu: light-dark(#ffffff, #1c1d20);
  /* меню и всплывающие панели */
  --panel-background-color: var(--fm-menu) !important;
  --panel-text-color: var(--fm-ink) !important;
  --panel-border-color: var(--fm-line) !important;
  --panel-border-radius: 24px !important;
  --panel-separator-color: var(--fm-line) !important;
  --panel-item-hover-bgcolor: color-mix(in srgb, var(--fm-ink) 8%, transparent) !important;
  --panel-item-active-bgcolor: color-mix(in srgb, var(--fm-ink) 13%, transparent) !important;
  --menuitem-hover-background-color: color-mix(in srgb, var(--fm-ink) 8%, transparent) !important;
  --menu-background-color: var(--fm-menu) !important;
  --menu-color: var(--fm-ink) !important;
  --menu-border-color: var(--fm-line) !important;
  --arrowpanel-background: var(--fm-menu) !important;
  --arrowpanel-color: var(--fm-ink) !important;
  --arrowpanel-border-color: var(--fm-line) !important;
  --background-color-box: var(--fm-menu) !important;
  /* адресная строка и её выпадающий список */
  --toolbar-field-background-color: color-mix(in srgb, currentColor 9%, var(--fm-frame)) !important;
  --toolbar-field-background-color-focus: var(--fm-menu) !important;
  --toolbar-field-focus-background-color: var(--fm-menu) !important;
  --toolbar-field-border-color: transparent !important;
  --toolbar-field-border-color-focus: var(--fm-accent) !important;
  --urlbar-background-color: color-mix(in srgb, currentColor 9%, var(--fm-frame)) !important;
  --urlbar-background-color-focus: var(--fm-menu) !important;
  --urlbar-border-radius: 22px !important;
  --urlbar-box-background-color-hover: color-mix(in srgb, var(--fm-ink) 9%, transparent) !important;
  --urlbar-box-background-color-active: color-mix(in srgb, var(--fm-ink) 14%, transparent) !important;
  --urlbarview-border-radius: 16px !important;
  --urlbarview-row-min-height: 44px !important;
  --urlbarview-background-color-hover: color-mix(in srgb, var(--fm-ink) 7%, transparent) !important;
  --urlbarview-background-color-selected: var(--fm-soft) !important;
  --urlbarview-text-color-selected: var(--fm-ink) !important;
  --urlbarview-text-color-secondary: var(--fm-muted) !important;
  --urlbarview-text-color-action: var(--fm-accent) !important;
  --urlbarview-separator-color: var(--fm-line) !important;
  --urlbarview-action-button-background-color-hover: color-mix(in srgb, var(--fm-ink) 10%, transparent) !important;
}
tooltip { --panel-background-color: var(--fm-menu) !important; }

/* ======== МЕНЮ И ПАНЕЛИ В СТИЛЕ GALAXY ======== */
:root { --fm-menu: light-dark(#ffffff, #1c1d20); }
/* рисуем фон меню сами: у Nova свой серо-фиолетовый */
menupopup::part(content), panel::part(content) {
  background-color: var(--fm-menu) !important;
  color: var(--fm-ink) !important;
  border: 1px solid var(--fm-line) !important;
  border-radius: 24px !important;
  box-shadow: var(--fm-pop) !important;
}
menupopup, panel {
  --panel-background: var(--fm-menu) !important;
  --arrowpanel-background: var(--fm-menu) !important;
  --panel-item-hover-bgcolor: color-mix(in srgb, var(--fm-ink) 8%, transparent) !important;
}
menupopup > :is(menuitem, menu) { padding-block: 7px !important; margin-inline: 4px !important; }
menupopup > :is(menuitem, menu):is([_moz-menuactive], :hover):not([disabled]) {
  background-color: color-mix(in srgb, var(--fm-ink) 8%, transparent) !important;
  color: var(--fm-ink) !important;
}
menupopup > :is(menuitem, menu)[_moz-menuactive] > .menu-icon { scale: 1.06; }
.menu-accel, .menu-text + .menu-accel-container, .subviewbutton > .toolbarbutton-text + .toolbarbutton-accel {
  color: var(--fm-muted) !important; opacity: 1 !important;
}

/* главное меню: цветные круглые иконки у пунктов, как в настройках Galaxy */
#appMenu-new-tab-button2 { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 5v14M5 12h14'/></svg>") !important; --fm-tile: #3e91ff; }
#appMenu-new-window-button2, #appMenu-new-classic-window-button { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><rect x='3.5' y='5' width='17' height='14' rx='3'/><path d='M3.5 9.5h17'/></svg>") !important; --fm-tile: #19b5a5; }
#appMenu-new-private-window-button2 { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M3 11c2-1 5.5-1.5 9-1.5s7 .5 9 1.5'/><circle cx='8' cy='14.5' r='2.5'/><circle cx='16' cy='14.5' r='2.5'/></svg>") !important; --fm-tile: #8e6bff; }
#appMenu-history-button { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='8'/><path d='M12 7.5V12l3 2'/></svg>") !important; --fm-tile: #ff8a3d; }
#appMenu-bookmarks-button { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M7 3.5h10v17l-5-4-5 4z'/></svg>") !important; --fm-tile: #f5a300; }
#appMenu-downloads-button { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 4v10.5'/><path d='M7.5 10.5L12 15l4.5-4.5'/><path d='M5 19.5h14'/></svg>") !important; --fm-tile: #2fb85a; }
#appMenu-passwords-button { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><circle cx='8' cy='12' r='3.5'/><path d='M11.5 12H20v3M17 12v2.5'/></svg>") !important; --fm-tile: #6b7a99; }
#appMenu-extensions-themes-button, #appMenu-unified-extensions-button { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M9.5 4.5a2 2 0 0 1 4 0V6H17a1 1 0 0 1 1 1v3.5h1.5a2 2 0 0 1 0 4H18V18a1 1 0 0 1-1 1h-3.5v-1.5a2 2 0 0 0-4 0V19H6a1 1 0 0 1-1-1v-3.5h1.5a2 2 0 0 0 0-4H5V7a1 1 0 0 1 1-1h3.5z'/></svg>") !important; --fm-tile: #a35cff; }
#appMenu-print-button2 { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M7 9V3.5h10V9'/><rect x='3.5' y='9' width='17' height='8' rx='2.5'/><path d='M7 14h10v6.5H7z'/></svg>") !important; --fm-tile: #7a7f87; }
#appMenu-save-file-button2 { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M5 4h11l3 3v13H5z'/><path d='M8 4v5h7V4M8 20v-6h8v6'/></svg>") !important; --fm-tile: #3e91ff; }
#appMenu-translate-button { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 6h9M8.5 4v2M6 6c.5 3 2.5 5.5 5 7M11 6c-.5 3-3 6-6 8'/><path d='M13 20l3.5-8 3.5 8M14 17.5h5'/></svg>") !important; --fm-tile: #00a8e8; }
#appMenu-find-button2 { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='6'/><path d='M20 20l-4.2-4.2'/></svg>") !important; --fm-tile: #5b8cff; }
#appMenu-settings-button { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='3'/><path d='M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8'/></svg>") !important; --fm-tile: #8a8f98; }
#appMenu-more-button2 { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><circle cx='6' cy='12' r='1.3' fill='white'/><circle cx='12' cy='12' r='1.3' fill='white'/><circle cx='18' cy='12' r='1.3' fill='white'/></svg>") !important; --fm-tile: #5e6470; }
#appMenu-help-button2 { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='8.5'/><path d='M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4'/><circle cx='12' cy='17' r='.6' fill='white'/></svg>") !important; --fm-tile: #34aadc; }
#appMenu-profiles-button, #appMenu-create-profile-button { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='8.5' r='3.5'/><path d='M5 19.5c1.3-3.3 4-5 7-5s5.7 1.7 7 5'/></svg>") !important; --fm-tile: #ff5c8a; }
#appMenu-tab-groups-button { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><rect x='3.5' y='4' width='7' height='7' rx='2'/><rect x='13.5' y='4' width='7' height='7' rx='2'/><rect x='3.5' y='14' width='7' height='7' rx='2'/></svg>") !important; --fm-tile: #19b5a5; }
#appMenu-quit-button2 { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 3.5v8'/><path d='M7 6.5a7.5 7.5 0 1 0 10 0'/></svg>") !important; --fm-tile: #ff453a; }
#appMenu-fullscreen-button2 { list-style-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'/></svg>") !important; --fm-tile: #5e6470; }
#appMenu-mainView .subviewbutton:is(#appMenu-new-tab-button2, #appMenu-new-window-button2, #appMenu-new-classic-window-button, #appMenu-new-private-window-button2, #appMenu-history-button, #appMenu-bookmarks-button, #appMenu-downloads-button, #appMenu-passwords-button, #appMenu-extensions-themes-button, #appMenu-unified-extensions-button, #appMenu-print-button2, #appMenu-save-file-button2, #appMenu-translate-button, #appMenu-find-button2, #appMenu-settings-button, #appMenu-more-button2, #appMenu-help-button2, #appMenu-profiles-button, #appMenu-create-profile-button, #appMenu-tab-groups-button, #appMenu-quit-button2, #appMenu-fullscreen-button2) > .toolbarbutton-icon {
  display: flex !important;
  width: 30px !important; height: 30px !important;
  padding: 7px !important; box-sizing: border-box !important;
  margin-inline-end: 12px !important;
  border-radius: 50% !important;
  background: var(--fm-tile) !important;
  box-shadow: inset 0 -2px 3px rgb(0 0 0 / .15), 0 2px 6px color-mix(in srgb, var(--fm-tile) 40%, transparent) !important;
}
#appMenu-mainView .subviewbutton { min-height: 44px !important; padding-inline: 10px !important; border-radius: 16px !important; }
#appMenu-mainView .subviewbutton > .toolbarbutton-text { font-size: 14px !important; font-weight: 500 !important; }
#appMenu-mainView .subviewbutton:not([disabled]):hover { background: color-mix(in srgb, var(--fm-ink) 7%, transparent) !important; }
#appMenu-popup toolbarseparator { margin-inline: 14px !important; }

/* выпадающий список адресной строки */
#urlbar[open] > :is(#urlbar-background, .urlbar-background) {
  background: var(--fm-menu) !important;
  border-radius: 26px !important;
  border: 1px solid var(--fm-line) !important;
}
.urlbarView { margin-inline: 4px !important; }
.urlbarView-body-outer, .urlbarView-body-inner { border: 0 !important; }
.urlbarView-row { background: transparent !important; padding-block: 1px !important; }
.urlbarView-row-inner { min-height: 44px !important; padding-block: 6px !important; padding-inline: 8px !important; }
.urlbarView-row:not([selected]):hover > .urlbarView-row-inner { background: color-mix(in srgb, var(--fm-ink) 7%, transparent) !important; }
.urlbarView-row[selected] > .urlbarView-row-inner { background: var(--fm-soft) !important; }
.urlbarView-favicon {
  width: 32px !important; height: 32px !important; padding: 8px !important; box-sizing: border-box !important;
  margin-inline-end: 12px !important; border-radius: 50% !important;
  background: color-mix(in srgb, var(--fm-ink) 9%, transparent) !important;
}
.urlbarView-row[selected] .urlbarView-favicon { background: var(--fm-accent) !important; fill: var(--fm-on-accent) !important; }
.urlbarView-title { font-size: 14px !important; font-weight: 500 !important; }
.urlbarView-row[selected] .urlbarView-title { color: var(--fm-ink) !important; }
.urlbarView-action, .urlbarView-url, .urlbarView-title-separator::before { color: var(--fm-muted) !important; }
.urlbarView-row[selected] :is(.urlbarView-action, .urlbarView-url) { color: var(--fm-accent) !important; }
.urlbarView-button { border-radius: 999px !important; }
.search-one-offs, #urlbar .search-panel-one-offs-header { border-top: 0 !important; }
.searchbar-engine-one-off-item { border-radius: 999px !important; }

/* адресная строка: мягкая обводка цветом акцента ВСЕГДА (не только в фокусе).
   Цвет приглушён: берём акцент и смешиваем с фоном, чтобы даже яркий
   акцент Windows не резал глаз. В фокусе обводка чуть плотнее. */
:root {
  --fm-ring: color-mix(in srgb, var(--fm-accent) 42%, transparent);
  --fm-ring-focus: color-mix(in srgb, var(--fm-accent) 62%, transparent);
  --fm-ring-glow: color-mix(in srgb, var(--fm-accent) 12%, transparent);
  --urlbar-background-outline-focused: none !important;
  --urlbar-input-container-outline-open-focused: none !important;
}
#urlbar > :is(#urlbar-background, .urlbar-background),
.urlbar > .urlbar-background {
  outline: 1.5px solid var(--fm-ring) !important;
  outline-offset: -1.5px !important;
  border-color: transparent !important;
  box-shadow: 0 0 14px var(--fm-ring-glow) !important;
  animation: none !important;
}
#urlbar:is([focused], [open], [popover-open], [breakout-extend], :focus-within) > :is(#urlbar-background, .urlbar-background),
.urlbar:is([focused], [open], [popover-open], :focus-within) > .urlbar-background {
  outline: 2px solid var(--fm-ring-focus) !important;
  outline-offset: -2px !important;
  box-shadow: 0 0 18px color-mix(in srgb, var(--fm-accent) 16%, transparent) !important;
}
.urlbar > .urlbar-input-container { outline: none !important; }

/* активная вкладка мягко светится цветом акцента */
.tabbrowser-tab[selected] > .tab-stack > .tab-background {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--fm-accent) 35%, transparent),
              0 4px 16px color-mix(in srgb, var(--fm-accent) 22%, transparent) !important;
}

/* кнопки в фокусе меню: акцентная подсветка вместо серой */
menupopup > :is(menuitem, menu):is([_moz-menuactive]):not([disabled]) {
  background-color: color-mix(in srgb, var(--fm-accent) 16%, transparent) !important;
}


/* ======== ПАНЕЛИ ЗАКЛАДОК И ЖУРНАЛА (старое «дерево» Firefox) ======== */
@-moz-document url-prefix("chrome://browser/content/places/"), url-prefix("chrome://browser/content/sidebar/"), url-prefix("chrome://browser/content/bookmarks/"), url-prefix("chrome://browser/content/history/") {
  :root, body, #bookmarksPanel, #history-panel, page, window {
    background-color: var(--fm-frame, light-dark(#f2f3f5, #000)) !important;
    color: var(--fm-ink, light-dark(#111214, #f2f2f3)) !important;
    font-family: "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif !important;
  }
  #sidebar-search-container, .sidebar-search-container {
    padding: 10px 12px 8px !important;
    background: transparent !important;
  }
  :is(search-textbox, moz-input-search, input[type="search"], #search-box) {
    border-radius: 999px !important;
    border: 0 !important;
    background-color: color-mix(in srgb, currentColor 9%, transparent) !important;
    min-height: 36px !important;
    padding-inline: 12px !important;
    outline: none !important;
  }
  :is(search-textbox, moz-input-search, input[type="search"], #search-box):focus-within {
    outline: 2px solid var(--fm-accent, AccentColor) !important;
    outline-offset: -2px !important;
  }
  tree, #bookmarks-view, #historyTree {
    background-color: transparent !important;
    border: 0 !important;
    color: inherit !important;
    margin: 0 6px !important;
    appearance: none !important;
  }
  tree:focus-visible { outline: none !important; }
  treechildren::-moz-tree-row {
    min-height: 36px !important;
    background-color: transparent !important;
    border: 0 !important;
  }
  treechildren::-moz-tree-row(hover) {
    background-color: color-mix(in srgb, currentColor 7%, transparent) !important;
  }
  treechildren::-moz-tree-row(selected),
  treechildren::-moz-tree-row(selected, focus),
  treechildren::-moz-tree-row(selected, current, focus) {
    background-color: color-mix(in srgb, var(--fm-accent, AccentColor) 22%, transparent) !important;
    border: 0 !important;
    outline: none !important;
  }
  treechildren::-moz-tree-row(current, focus) { outline: none !important; border: 0 !important; }
  treechildren::-moz-tree-cell-text {
    color: inherit !important;
    padding-inline-start: 6px !important;
    font-size: 13.5px !important;
  }
  treechildren::-moz-tree-cell-text(selected),
  treechildren::-moz-tree-cell-text(selected, focus) {
    color: var(--fm-ink, light-dark(#111214, #f2f2f3)) !important;
    font-weight: 600 !important;
  }
  treechildren::-moz-tree-twisty { padding-inline: 6px !important; opacity: .7; }
  treechildren::-moz-tree-image { margin-inline-end: 4px !important; }
  .sidebar-placesTree, .sidebar-panel { background: transparent !important; }
  /* новый список вкладок/истории (html) */
  :is(.sidebar-row, sidebar-tab-row, .history-item, fxview-tab-row) { border-radius: 14px !important; }
}
/* ======================= FLOORP-MODERN END ======================= */
"""

CONTENT = r"""
/* ======================= FLOORP-MODERN BEGIN ======================= */
/* Floorp Modern · One UI — страницы about: (настройки, дополнения, загрузки...) */
@-moz-document url-prefix("about:"), url-prefix("chrome://browser/content/"), url-prefix("chrome://mozapps/"), url-prefix("chrome://global/content/") {
  :root {
@TOKENS@
    /* ---- One UI: чёрный (или светло-серый) фон, белые/графитовые карточки ---- */
    --background-color-canvas: var(--fm-frame) !important;
    --background-color-box: var(--fm-bar) !important;
    --background-color-list-item-hover: var(--fm-hover) !important;
    --text-color: var(--fm-ink) !important;
    --text-color-deemphasized: var(--fm-muted) !important;
    --border-color: var(--fm-line) !important;
    --border-color-deemphasized: var(--fm-line) !important;
    --border-color-interactive: color-mix(in srgb, var(--fm-ink) 28%, transparent) !important;
    --border-color-selected: var(--fm-accent) !important;

    --color-accent-primary: var(--fm-accent) !important;
    --color-accent-primary-hover: color-mix(in srgb, var(--fm-accent) 88%, var(--fm-ink)) !important;
    --color-accent-primary-active: color-mix(in srgb, var(--fm-accent) 76%, var(--fm-ink)) !important;
    --color-accent-primary-selected: color-mix(in srgb, var(--fm-accent) 18%, transparent) !important;
    --focus-outline-color: var(--fm-accent) !important;
    --link-color: var(--fm-accent) !important;
    --link-color-hover: color-mix(in srgb, var(--fm-accent) 85%, var(--fm-ink)) !important;

    --border-radius-xsmall: 6px !important;
    --border-radius-small: 10px !important;
    --border-radius-medium: 16px !important;
    --border-radius-large: 26px !important;
    --border-radius-xlarge: 30px !important;

    /* карточки и группы настроек */
    --card-background-color: var(--fm-bar) !important;
    --card-border: 0 solid transparent !important;
    --card-border-color: transparent !important;
    --card-border-radius: 26px !important;
    --card-box-shadow: none !important;
    --card-box-shadow-hover: none !important;
    --card-padding: 20px !important;
    --box-border: 0 solid transparent !important;
    --box-border-radius: 26px !important;
    --box-border-radius-inner: 18px !important;

    /* кнопки — «таблетки» */
    --button-border-radius: 999px !important;
    --button-min-height: 36px !important;
    --button-padding-inline: 18px !important;
    --button-font-weight: 600 !important;
    --button-background-color: color-mix(in srgb, var(--fm-ink) 9%, transparent) !important;
    --button-background-color-hover: color-mix(in srgb, var(--fm-ink) 14%, transparent) !important;
    --button-background-color-active: color-mix(in srgb, var(--fm-ink) 20%, transparent) !important;
    --button-border-color: transparent !important;
    --button-background-color-primary: var(--fm-accent) !important;
    --button-background-color-primary-hover: color-mix(in srgb, var(--fm-accent) 88%, var(--fm-ink)) !important;
    --button-background-color-primary-active: color-mix(in srgb, var(--fm-accent) 76%, var(--fm-ink)) !important;
    --button-text-color-primary: var(--fm-on-accent) !important;
    --button-text-color-primary-hover: var(--fm-on-accent) !important;
    --button-border-color-primary: transparent !important;

    /* поля ввода и списки */
    --input-text-border-radius: 999px !important;
    --input-search-border-radius: 999px !important;
    --input-text-background-color: var(--fm-field) !important;
    --input-text-border-color: transparent !important;
    --input-text-min-height: 38px !important;
    --select-border-radius: 999px !important;
    --select-background-color: color-mix(in srgb, var(--fm-ink) 9%, transparent) !important;
    --select-border-color: transparent !important;

    /* переключатели в стиле One UI */
    --toggle-background-color-pressed: var(--fm-accent) !important;
    --toggle-background-color-pressed-hover: color-mix(in srgb, var(--fm-accent) 88%, var(--fm-ink)) !important;
    --toggle-border-color: transparent !important;
    --toggle-background-color: color-mix(in srgb, var(--fm-ink) 22%, transparent) !important;
    --toggle-dot-background-color: #fff !important;
    --toggle-height: 22px !important;
    --toggle-width: 40px !important;

    /* навигация слева: «таблетки», выбранный пункт — цвет акцента */
    --page-nav-button-border-radius: 999px !important;
    --page-nav-button-background-color-selected: var(--fm-soft) !important;
    --page-nav-button-text-color-selected: var(--fm-accent) !important;
    --page-nav-button-background-color-hover: var(--fm-hover) !important;
    --page-nav-button-indicator-background-color: transparent !important;
    --page-nav-border-color: transparent !important;

    /* старые переменные страниц */
    --in-content-page-background: var(--fm-frame) !important;
    --in-content-box-background: var(--fm-bar) !important;
    --in-content-primary-button-background: var(--fm-accent) !important;
    --in-content-primary-button-text-color: var(--fm-on-accent) !important;
    --in-content-focus-outline-color: var(--fm-accent) !important;
    --in-content-accent-color: var(--fm-accent) !important;
    --in-content-border-radius: 16px !important;
  }
  :root { background-color: var(--fm-frame) !important; }
  body { font-family: var(--fm-font) !important; }
  h1 { font-weight: 700 !important; letter-spacing: -0.01em !important; }

  /* группы настроек = большие карточки, как в One UI */
  setting-group, groupbox, .card, moz-card, .addon.card, #searchInput + *, .info-box-container {
    border-radius: 26px !important;
  }
  :is(setting-group, groupbox):not([hidden]) {
    background: var(--fm-bar) !important;
    padding: 18px 22px !important;
    margin-block-end: 14px !important;
    border: 0 !important;
  }
  .card, .addon.card { background: var(--fm-bar) !important; border: 0 !important; box-shadow: none !important; }
  .card:hover, .addon.card:hover { box-shadow: none !important; background: color-mix(in srgb, var(--fm-bar) 92%, var(--fm-ink)) !important; }

  /* старые элементы about:addons / about:preferences */
  .category, .page-nav-button { border-radius: 999px !important; }
  .category[selected], .category:is([selected], :hover) { border-radius: 999px !important; }
  .category[selected] { background: var(--fm-soft) !important; color: var(--fm-accent) !important; }
  .category[selected]::before, .category::before { display: none !important; }
  button:not(.ghost-button):not([type="icon"]), select, menulist, input[type="search"], input[type="text"] {
    border-radius: 999px !important;
  }
  input[type="checkbox"] { accent-color: var(--fm-accent) !important; border-radius: 6px !important; }
  input[type="radio"] { accent-color: var(--fm-accent) !important; }
  richlistbox, .list, tree { border-radius: 18px !important; border-color: var(--fm-line) !important; }
  dialog, .dialogBox { border-radius: 26px !important; }
}
/* ---------- стартовая страница Floorp: экран блокировки Galaxy ---------- */
@-moz-document url-prefix("chrome://noraneko-newtab/"), url("about:newtab"), url("about:home") {
  :root {
    --fm-accent: AccentColor;
    --fm-glow: color-mix(in srgb, AccentColor 75%, white);
  }
  html { background: #04050a !important; }
  html, body {
    font-family: "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif !important;
  }
  body { background: transparent !important; }

  /* живой фон «аврора» в цвете акцента Windows (если не выбрана своя картинка) */
  #root::before {
    content: "";
    position: fixed;
    inset: -15%;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(38% 46% at 22% 28%, color-mix(in srgb, AccentColor 92%, transparent), transparent 70%),
      radial-gradient(34% 42% at 78% 22%, rgb(150 90 255 / .72), transparent 70%),
      radial-gradient(40% 50% at 62% 82%, rgb(0 200 255 / .5), transparent 70%),
      radial-gradient(30% 36% at 18% 86%, rgb(255 80 170 / .38), transparent 70%),
      #04050a;
    /* без filter: blur — на большом слое Firefox рисует вместо него серый блок */
    animation: fm-aurora 38s ease-in-out infinite alternate;
    will-change: transform;
  }
  #root::after {
    /* лёгкое «зерно» и затемнение краёв, как на обоях Galaxy */
    content: "";
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background: radial-gradient(120% 90% at 50% 40%, transparent 55%, rgb(0 0 0 / .55));
  }
  @keyframes fm-aurora {
    0%   { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
    50%  { transform: translate3d(4%, -3%, 0) rotate(8deg) scale(1.08); }
    100% { transform: translate3d(-4%, 3%, 0) rotate(-6deg) scale(1.04); }
  }
  /* встроенные картинки Floorp прячем, свои картинки пользователя остаются */
  .bg-cover[style*="noraneko-newtab"] { display: none !important; }

  /* логотип с тёмной надписью не нужен */
  .flex.justify-center.items-center.mb-8:has(> img[alt="Logo"]) { display: none !important; }

  /* часы: огромные и тонкие, по центру сверху */
  /* раскладка: часы сверху, поиск по центру, ярлыки ниже */
  .w-full.min-h-screen.flex.flex-col.justify-center.items-center {
    padding-top: 16vh !important;
  }
  .absolute.top-4.right-4 {
    position: fixed !important;
    top: 12vh !important;
    left: 50% !important;
    right: auto !important;
    transform: translateX(-50%);
    z-index: 1;
  }
  .absolute.top-4.right-4 > div {
    background: none !important;
    backdrop-filter: none !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
  .absolute.top-4.right-4 > div > .flex {
    flex-direction: column !important;
    align-items: center !important;
    gap: 6px !important;
  }
  .absolute.top-4.right-4 .tabular-nums {
    font-size: clamp(72px, 10.5vw, 156px) !important;
    font-weight: 250 !important;
    line-height: .95 !important;
    letter-spacing: -0.03em !important;
    color: #fff !important;
    text-shadow: 0 6px 40px rgb(0 0 0 / .35), 0 0 60px color-mix(in srgb, AccentColor 35%, transparent);
  }
  .absolute.top-4.right-4 .tabular-nums > .animate-pulse {
    animation: fm-blink 2s ease-in-out infinite !important;
    opacity: .9;
  }
  @keyframes fm-blink { 50% { opacity: .25; } }
  .absolute.top-4.right-4 .flex-col.text-right {
    flex-direction: row !important;
    gap: 8px !important;
    text-align: center !important;
  }
  .absolute.top-4.right-4 .flex-col.text-right > div {
    font-size: 19px !important;
    font-weight: 500 !important;
    color: rgb(255 255 255 / .88) !important;
    letter-spacing: .01em;
  }
  .absolute.top-4.right-4 .flex-col.text-right > div:first-child { text-transform: capitalize; }

  /* поиск: стеклянная «таблетка» */
  .group.cursor-pointer:has(input[readonly]) {
    min-height: 62px !important;
    padding: 0 12px 0 24px !important;
    border-radius: 999px !important;
    background: rgb(22 23 26 / .92) !important;
    border: 1px solid rgb(255 255 255 / .16) !important;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / .25), 0 20px 60px rgb(0 0 0 / .35) !important;
    transition: transform .3s cubic-bezier(.2, .8, .2, 1), background-color .3s ease, box-shadow .3s ease !important;
  }
  .group.cursor-pointer:has(input[readonly]):hover {
    background: rgb(30 31 35 / .96) !important;
    transform: translateY(-2px) scale(1.012);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / .3), 0 26px 70px rgb(0 0 0 / .4), 0 0 0 4px color-mix(in srgb, AccentColor 25%, transparent) !important;
  }
  .group.cursor-pointer:has(input[readonly]) input {
    font-size: 17px !important;
    color: #fff !important;
  }
  .group.cursor-pointer:has(input[readonly]) input::placeholder { color: rgb(255 255 255 / .72) !important; }
  .group.cursor-pointer:has(input[readonly]) svg { color: #fff !important; }

  /* ярлыки сайтов: стеклянный «док» с круглыми иконками */
  .inline-block.backdrop-blur-sm.p-3 {
    border-radius: 30px !important;
    background: rgb(22 23 26 / .9) !important;
    border: 1px solid rgb(255 255 255 / .12) !important;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / .18), 0 20px 50px rgb(0 0 0 / .3) !important;
    padding: 14px 10px !important;
  }
  a.group.flex.flex-col.items-center { border-radius: 20px !important; }
  a.group.flex.flex-col.items-center:hover { background: rgb(255 255 255 / .10) !important; }
  a.group .overflow-hidden.bg-gray-700 {
    border-radius: 999px !important;
    background: rgb(255 255 255 / .92) !important;
    box-shadow: inset 0 -2px 4px rgb(0 0 0 / .12), 0 6px 16px rgb(0 0 0 / .3) !important;
  }

  /* кнопка настроек */
  button.fixed.bottom-4.right-4 {
    background: rgb(22 23 26 / .9) !important;
    border: 1px solid rgb(255 255 255 / .12) !important;
  }

  @media (max-height: 640px) {
    .absolute.top-4.right-4 { top: 6vh !important; }
    .absolute.top-4.right-4 .tabular-nums { font-size: 64px !important; }
  }
  @media (prefers-reduced-motion: reduce) {
    #root::before, .animate-pulse { animation: none !important; }
  }
}

/* ---------- настройки Floorp (chrome://noraneko-settings) в стиле One UI ---------- */
@-moz-document url-prefix("chrome://noraneko-settings/") {
  :root, :root[data-theme], .floorp-standard-ui {
    --floorp-brand: AccentColor !important;
    --floorp-brand-hover: color-mix(in srgb, AccentColor 85%, black) !important;
    --floorp-action: AccentColor !important;
    --floorp-focus: AccentColor !important;
    --floorp-switch-on: AccentColor !important;
    --floorp-font: "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif !important;
    --chakra-colors-purple-solid: AccentColor !important;
    --chakra-colors-purple-fg: AccentColor !important;
    --chakra-colors-purple-contrast: AccentColorText !important;
    --chakra-colors-purple-focus-ring: AccentColor !important;
    --chakra-colors-purple-subtle: color-mix(in srgb, AccentColor 14%, transparent) !important;
    --chakra-colors-purple-muted: color-mix(in srgb, AccentColor 24%, transparent) !important;
    --chakra-colors-purple-emphasized: color-mix(in srgb, AccentColor 34%, transparent) !important;
    --chakra-radii-l1: 10px !important;
    --chakra-radii-l2: 14px !important;
    --chakra-radii-l3: 22px !important;
    --chakra-radii-sm: 8px !important;
    --chakra-radii-md: 12px !important;
    --chakra-radii-lg: 18px !important;
    --chakra-radii-xl: 22px !important;
    --chakra-radii-2xl: 26px !important;
    --chakra-fonts-body: var(--floorp-font) !important;
    --chakra-fonts-heading: var(--floorp-font) !important;
  }
  @media (prefers-color-scheme: dark) {
    :root, :root[data-theme], .floorp-standard-ui {
      --floorp-action: color-mix(in srgb, AccentColor 62%, white) !important;
      --floorp-canvas: #000 !important;
      --floorp-subtle: #17181a !important;
      --floorp-surface: #17181a !important;
      --floorp-line: rgb(255 255 255 / .08) !important;
      --chakra-colors-bg: #000 !important;
      --chakra-colors-bg-muted: #17181a !important;
      --chakra-colors-bg-panel: #17181a !important;
      --chakra-colors-bg-subtle: #17181a !important;
      --chakra-colors-border: rgb(255 255 255 / .08) !important;
      --chakra-colors-purple-fg: color-mix(in srgb, AccentColor 62%, white) !important;
    }
  }
  @media (prefers-color-scheme: light) {
    :root, :root[data-theme], .floorp-standard-ui {
      --floorp-canvas: #f2f3f5 !important;
      --floorp-subtle: #fff !important;
      --floorp-surface: #fff !important;
      --floorp-line: rgb(0 0 0 / .07) !important;
      --chakra-colors-bg: #f2f3f5 !important;
      --chakra-colors-bg-muted: #fff !important;
      --chakra-colors-bg-panel: #fff !important;
      --chakra-colors-border: rgb(0 0 0 / .07) !important;
    }
  }
  body { font-family: var(--floorp-font) !important; }
  button, input, select, textarea { font-family: inherit !important; }
}


/* ======== ПАНЕЛИ ЗАКЛАДОК И ЖУРНАЛА (старое «дерево» Firefox) ======== */
@-moz-document url-prefix("chrome://browser/content/places/"), url-prefix("chrome://browser/content/sidebar/"), url-prefix("chrome://browser/content/bookmarks/"), url-prefix("chrome://browser/content/history/") {
  :root, body, #bookmarksPanel, #history-panel, page, window {
    background-color: var(--fm-frame, light-dark(#f2f3f5, #000)) !important;
    color: var(--fm-ink, light-dark(#111214, #f2f2f3)) !important;
    font-family: "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif !important;
  }
  #sidebar-search-container, .sidebar-search-container {
    padding: 10px 12px 8px !important;
    background: transparent !important;
  }
  :is(search-textbox, moz-input-search, input[type="search"], #search-box) {
    border-radius: 999px !important;
    border: 0 !important;
    background-color: color-mix(in srgb, currentColor 9%, transparent) !important;
    min-height: 36px !important;
    padding-inline: 12px !important;
    outline: none !important;
  }
  :is(search-textbox, moz-input-search, input[type="search"], #search-box):focus-within {
    outline: 2px solid var(--fm-accent, AccentColor) !important;
    outline-offset: -2px !important;
  }
  tree, #bookmarks-view, #historyTree {
    background-color: transparent !important;
    border: 0 !important;
    color: inherit !important;
    margin: 0 6px !important;
    appearance: none !important;
  }
  tree:focus-visible { outline: none !important; }
  treechildren::-moz-tree-row {
    min-height: 36px !important;
    background-color: transparent !important;
    border: 0 !important;
  }
  treechildren::-moz-tree-row(hover) {
    background-color: color-mix(in srgb, currentColor 7%, transparent) !important;
  }
  treechildren::-moz-tree-row(selected),
  treechildren::-moz-tree-row(selected, focus),
  treechildren::-moz-tree-row(selected, current, focus) {
    background-color: color-mix(in srgb, var(--fm-accent, AccentColor) 22%, transparent) !important;
    border: 0 !important;
    outline: none !important;
  }
  treechildren::-moz-tree-row(current, focus) { outline: none !important; border: 0 !important; }
  treechildren::-moz-tree-cell-text {
    color: inherit !important;
    padding-inline-start: 6px !important;
    font-size: 13.5px !important;
  }
  treechildren::-moz-tree-cell-text(selected),
  treechildren::-moz-tree-cell-text(selected, focus) {
    color: var(--fm-ink, light-dark(#111214, #f2f2f3)) !important;
    font-weight: 600 !important;
  }
  treechildren::-moz-tree-twisty { padding-inline: 6px !important; opacity: .7; }
  treechildren::-moz-tree-image { margin-inline-end: 4px !important; }
  .sidebar-placesTree, .sidebar-panel { background: transparent !important; }
  /* новый список вкладок/истории (html) */
  :is(.sidebar-row, sidebar-tab-row, .history-item, fxview-tab-row) { border-radius: 14px !important; }
}
/* ======================= FLOORP-MODERN END ======================= */
"""

chrome_css = CHROME.replace("@TOKENS@", TOKENS).replace("@ICONS@", icon_rules)
content_css = CONTENT.replace("@TOKENS@", TOKENS.replace("\n  ", "\n    "))

if __name__ == "__main__":
    import sys, pathlib
    out = pathlib.Path(sys.argv[1])
    (out / "floorp-modern-chrome.css").write_text(chrome_css, encoding="utf-8")
    (out / "floorp-modern-content.css").write_text(content_css, encoding="utf-8")
    print("ok")
