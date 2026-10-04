#!/usr/bin/env python3
"""Floorp Modern: userChrome.css layer (browser UI) + userContent.css layer (about: pages)."""

def svg(body, fill=False, sw="1.9"):
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
  --fm-accent: light-dark(#3d57c9, #8ea2ff);
  --fm-on-accent: light-dark(#ffffff, #10142a);
  --fm-radius: 12px;          /* скругление области страницы */
  --fm-gap: 6px;              /* отступ вокруг области страницы */
  /* -------------------------------------------- */

  --fm-frame:  light-dark(#e9ebf0, #0f1116);
  --fm-bar:    light-dark(#f4f5f8, #16181e);
  --fm-field:  light-dark(#ffffff, #1f222a);
  --fm-line:   light-dark(#d6dae3, #2a2e39);
  --fm-ink:    light-dark(#1c2130, #e4e7ef);
  --fm-muted:  light-dark(#646c80, #9098ab);
  --fm-hover:  light-dark(rgb(28 33 48 / .07), rgb(228 231 239 / .08));
  --fm-press:  light-dark(rgb(28 33 48 / .13), rgb(228 231 239 / .14));
  --fm-soft:   color-mix(in srgb, var(--fm-accent) 18%, transparent);
  --fm-pop:    0 2px 6px light-dark(rgb(20 30 60 / .10), rgb(0 0 0 / .35)),
               0 16px 44px light-dark(rgb(20 30 60 / .18), rgb(0 0 0 / .55));
  --fm-card:   0 1px 2px light-dark(rgb(20 30 60 / .08), rgb(0 0 0 / .4)),
               0 6px 22px light-dark(rgb(20 30 60 / .08), rgb(0 0 0 / .3));
  --fm-font:   "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif;
"""

CHROME = r"""
/* ======================= FLOORP-MODERN BEGIN ======================= */
/* Floorp Modern — новый вид интерфейса Floorp.
   Блок ставит и убирает установщик. Правки внутри пропадут при переустановке. */

:root {
@TOKENS@
  /* общие токены Firefox: акцент, скругления, фон панелей */
  --color-accent-primary: var(--fm-accent) !important;
  --color-accent-primary-hover: color-mix(in srgb, var(--fm-accent) 88%, var(--fm-ink)) !important;
  --color-accent-primary-active: color-mix(in srgb, var(--fm-accent) 76%, var(--fm-ink)) !important;
  --focus-outline-color: var(--fm-accent) !important;
  --toolbar-field-focus-border-color: var(--fm-accent) !important;
  --toolbarbutton-border-radius: 9px !important;
  --tab-border-radius: 10px !important;
  --tab-background-color-hover: var(--fm-hover) !important;
  --tab-box-shadow-selected: 0 1px 2px light-dark(rgb(20 30 60 / .10), rgb(0 0 0 / .45)) !important;
  --chrome-block-radius: var(--fm-radius) !important;
  --border-radius-medium: 10px !important;
  --panel-border-radius: 14px !important;
  --arrowpanel-border-radius: 14px !important;
  --arrowpanel-menuitem-border-radius: 8px !important;
  --menuitem-border-radius: 7px !important;
  --panel-shadow: var(--fm-pop) !important;
  --urlbarview-border-radius: 14px !important;
}

/* ---------- шрифт ---------- */
#navigator-toolbox, #sidebar-main, #panel-sidebar-select-box, menupopup, panel, tooltip {
  font-family: var(--fm-font) !important;
}

/* ---------- рамка окна и плавающая область страницы ---------- */
:root:not([lwtheme]) {
  --toolbox-background-color: var(--fm-frame) !important;
  --toolbox-background-color-inactive: var(--fm-frame) !important;
  --toolbar-background-color: var(--fm-frame) !important;
  --toolbar-bgcolor: var(--fm-frame) !important;
  --sidebar-background-color: var(--fm-frame) !important;
  --panel-sidebar-background-color: var(--fm-frame) !important;
  --toolbox-background-image: none !important;
}
:root:not([lwtheme]) :is(#navigator-toolbox, #nav-bar, #PersonalToolbar, #TabsToolbar, #browser, #sidebar-main, #sidebar-box, #panel-sidebar-select-box, #panel-sidebar-box, #nora-statusbar) {
  background-color: var(--fm-frame) !important;
  background-image: none !important;
}
#navigator-toolbox { border-bottom: 0 !important; }
#nav-bar { box-shadow: none !important; border-top: 0 !important; }

:root:not([inDOMFullscreen], [inFullscreen]) #tabbrowser-tabbox {
  padding: 0 var(--fm-gap) var(--fm-gap) !important;
  background: transparent !important;
  box-shadow: none !important;
  outline: none !important;
}
:root:not([inDOMFullscreen], [inFullscreen]) #tabbrowser-tabpanels .browserContainer {
  border-radius: var(--fm-radius) !important;
  overflow: clip !important;
  border: 1px solid var(--fm-line) !important;
  box-shadow: var(--fm-card) !important;
  outline: none !important;
}
#tabbrowser-tabpanels { background: transparent !important; }
.browserStack > browser { border-radius: 0 !important; }

/* ---------- кнопки панели ---------- */
toolbar .toolbarbutton-1 {
  --toolbarbutton-hover-background: var(--fm-hover) !important;
  --toolbarbutton-active-background: var(--fm-press) !important;
}
toolbar .toolbarbutton-1 > :is(.toolbarbutton-icon, .toolbarbutton-badge-stack, .toolbarbutton-text) {
  border-radius: 9px !important;
  transition: background-color .12s ease !important;
}
toolbar .toolbarbutton-1:not([disabled]):active > :is(.toolbarbutton-icon, .toolbarbutton-badge-stack) {
  scale: .94;
}
toolbar .toolbarbutton-1[disabled] { opacity: .35 !important; }
toolbarbutton[open] > :is(.toolbarbutton-icon, .toolbarbutton-badge-stack),
toolbarbutton[checked] > :is(.toolbarbutton-icon, .toolbarbutton-badge-stack) {
  background-color: var(--fm-soft) !important;
  fill: var(--fm-accent) !important;
}

/* новые иконки */
@ICONS@

/* ---------- адресная строка ---------- */
#urlbar {
  --toolbar-field-background-color: var(--fm-field) !important;
  --toolbar-field-focus-background-color: var(--fm-field) !important;
  --toolbar-field-border-color: var(--fm-line) !important;
}
#urlbar-background, .urlbar-background {
  border-radius: 12px !important;
  background-color: var(--fm-field) !important;
  border: 1px solid var(--fm-line) !important;
  box-shadow: none !important;
}
#urlbar:is([focused], [open]) > :is(#urlbar-background, .urlbar-background) {
  border-color: transparent !important;
  outline: 2px solid var(--fm-accent) !important;
  outline-offset: -1px !important;
  box-shadow: var(--fm-pop) !important;
}
#urlbar-input { font-size: 13.5px !important; }
.urlbarView-row { border-radius: 9px !important; }
.urlbarView-row:is([selected], :hover) > .urlbarView-row-inner,
.urlbarView-row[selected] {
  border-radius: 9px !important;
}
.urlbarView-row[selected] > .urlbarView-row-inner {
  background-color: var(--fm-soft) !important;
  color: inherit !important;
}
.urlbarView-row[selected] :is(.urlbarView-title, .urlbarView-url, .urlbarView-action) { color: inherit !important; }
#identity-box, #tracking-protection-icon-container, .searchmode-switcher, #urlbar-searchmode-switcher {
  border-radius: 8px !important;
}

/* ---------- вкладки ---------- */
.tabbrowser-tab > .tab-stack > .tab-background {
  border-radius: 10px !important;
  outline: none !important;
}
.tabbrowser-tab[selected] > .tab-stack > .tab-background,
.tabbrowser-tab[multiselected] > .tab-stack > .tab-background {
  background: var(--fm-bar) !important;
  box-shadow: var(--tab-box-shadow-selected), inset 0 0 0 1px var(--fm-line) !important;
}
.tabbrowser-tab[selected] > .tab-stack > .tab-background::before {
  content: "" !important;
  position: absolute !important;
  inset-block: 25%;
  inset-inline-start: 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--fm-accent);
}
.tabbrowser-tab[selected] > .tab-stack > .tab-background { position: relative !important; }
.tabbrowser-tab:not([selected]):hover > .tab-stack > .tab-background {
  background: var(--fm-hover) !important;
}
.tab-label { font-size: 12.5px !important; }
.tab-close-button { border-radius: 7px !important; }
.tab-close-button:hover { background: var(--fm-hover) !important; }
.tab-loading-burst, .tab-throbber { color: var(--fm-accent) !important; }
#tabbrowser-tabs[orient="vertical"] .tabbrowser-tab { padding-block: 1px !important; }

/* ---------- панель закладок ---------- */
#PersonalToolbar { padding-block: 2px 4px !important; }
#PersonalToolbar .toolbarbutton-1,
#PlacesToolbarItems > .bookmark-item {
  border-radius: 8px !important;
  padding: 4px 8px !important;
  margin-inline: 1px !important;
}
#PlacesToolbarItems > .bookmark-item:hover { background: var(--fm-hover) !important; }
#PlacesToolbarItems > .bookmark-item[open] { background: var(--fm-soft) !important; }
#PlacesToolbarItems > .bookmark-item > .toolbarbutton-text { font-size: 12.5px !important; }
#PlacesToolbarItems > toolbarseparator { opacity: .4 !important; }

/* ---------- боковая панель сайтов Floorp ---------- */
#panel-sidebar-select-box {
  border-inline: 0 !important;
  padding-block: 6px !important;
  gap: 2px !important;
}
.panel-sidebar-panel, .panel-sidebar-actions {
  border-radius: 10px !important;
  box-shadow: none !important;
  position: relative !important;
  transition: background-color .12s ease !important;
}
.panel-sidebar-panel:hover, .panel-sidebar-actions:hover {
  background-color: var(--fm-hover) !important;
  box-shadow: none !important;
}
.panel-sidebar-panel[data-checked="true"] {
  background-color: var(--fm-soft) !important;
  box-shadow: none !important;
}
.panel-sidebar-panel[data-checked="true"]::after {
  content: "";
  position: absolute;
  inset-block: 28%;
  inset-inline-start: -4px;
  width: 3px;
  border-radius: 3px;
  background: var(--fm-accent);
}
.panel-sidebar-panel:active { scale: .94; }
#panel-sidebar-box {
  border-radius: var(--fm-radius) !important;
  margin-block-end: var(--fm-gap) !important;
  overflow: clip !important;
  border: 1px solid var(--fm-line) !important;
  background: var(--fm-bar) !important;
}
#panel-sidebar-header { background: var(--fm-bar) !important; background-image: none !important; }
#panel-sidebar-splitter { background: transparent !important; border: 0 !important; }

/* боковая панель Firefox (закладки, история) */
#sidebar-box:not([hidden]) #sidebar,
#sidebar-box #sidebar {
  border-radius: var(--fm-radius) !important;
}
#sidebar-splitter { background: transparent !important; border: 0 !important; }

/* ---------- меню и всплывающие панели ---------- */
menupopup, panel {
  --panel-background: var(--fm-bar) !important;
  --panel-color: var(--fm-ink) !important;
  --panel-border-color: var(--fm-line) !important;
  --panel-padding: 6px !important;
  --menuitem-padding: 6px 10px !important;
  --arrowpanel-background: var(--fm-bar) !important;
  --arrowpanel-color: var(--fm-ink) !important;
  --arrowpanel-border-color: var(--fm-line) !important;
  --arrowpanel-dimmed: var(--fm-hover) !important;
  --arrowpanel-dimmed-further: var(--fm-press) !important;
  --panel-item-hover-bgcolor: var(--fm-hover) !important;
  --panel-item-active-bgcolor: var(--fm-press) !important;
}
menupopup > :is(menuitem, menu) {
  border-radius: 7px !important;
  min-height: 30px !important;
}
menupopup > :is(menuitem, menu):is([_moz-menuactive], :hover):not([disabled]) {
  background-color: var(--fm-hover) !important;
  color: inherit !important;
}
menupopup > menuseparator { opacity: .5 !important; margin-inline: 8px !important; }
.subviewbutton { border-radius: 8px !important; }
.subviewbutton:not([disabled]):hover { background-color: var(--fm-hover) !important; }
.panel-footer > button { border-radius: 9px !important; }
button.primary, .popup-notification-primary-button {
  background-color: var(--fm-accent) !important;
  color: var(--fm-on-accent) !important;
  border-radius: 9px !important;
}
tooltip {
  appearance: none !important;
  background: var(--fm-bar) !important;
  color: var(--fm-ink) !important;
  border: 1px solid var(--fm-line) !important;
  border-radius: 8px !important;
  padding: 5px 9px !important;
}

/* ---------- мелочи ---------- */
#downloads-indicator-progress-inner, #downloads-button[progress] .toolbarbutton-badge {
  color: var(--fm-accent) !important;
  fill: var(--fm-accent) !important;
}
.toolbarbutton-badge {
  background-color: var(--fm-accent) !important;
  color: var(--fm-on-accent) !important;
  box-shadow: none !important;
}
#nav-bar toolbarspring { max-width: 64px !important; }
findbar {
  border-top: 0 !important;
  background: var(--fm-frame) !important;
}
findbar .findbar-textbox { border-radius: 9px !important; }

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; }
}
/* ======================= FLOORP-MODERN END ======================= */
"""

CONTENT = r"""
/* ======================= FLOORP-MODERN BEGIN ======================= */
/* Floorp Modern — страницы about: (настройки, дополнения, загрузки...) */
@-moz-document url-prefix("about:"), url-prefix("chrome://browser/content/"), url-prefix("chrome://mozapps/") {
  :root {
@TOKENS@
    --color-accent-primary: var(--fm-accent) !important;
    --color-accent-primary-hover: color-mix(in srgb, var(--fm-accent) 88%, var(--fm-ink)) !important;
    --color-accent-primary-active: color-mix(in srgb, var(--fm-accent) 76%, var(--fm-ink)) !important;
    --button-text-color-primary: var(--fm-on-accent) !important;
    --focus-outline-color: var(--fm-accent) !important;
    --link-color: var(--fm-accent) !important;
    --border-radius-small: 6px !important;
    --border-radius-medium: 10px !important;
    --border-radius-large: 14px !important;
    --button-border-radius: 9px !important;
    --in-content-primary-button-background: var(--fm-accent) !important;
    --in-content-primary-button-text-color: var(--fm-on-accent) !important;
    --in-content-focus-outline-color: var(--fm-accent) !important;
    --in-content-accent-color: var(--fm-accent) !important;
  }
  :root:not(.fm-skip) body { font-family: var(--fm-font) !important; }
  .card, moz-card, .addon.card {
    border-radius: 14px !important;
  }
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
