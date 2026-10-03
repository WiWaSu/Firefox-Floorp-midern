#!/usr/bin/env python3
"""Floorp Modern — iOS theme overlay.

The iOS look is applied on top of the One UI base: the installer inserts these
blocks right before the END markers of the base blocks, so uninstalling works
the same way. Writes ios-chrome.css, ios-content.css, ios-pdf.css."""

import sys, pathlib

def W(body):
    return ("url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' "
            "fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'>" + body + "</svg>\")")

# iOS system colors (dark variants)
BLUE, GREEN, ORANGE, RED, PURPLE, GRAY, TEAL, PINK, YELLOW, INDIGO = (
    "#0A84FF", "#30D158", "#FF9F0A", "#FF453A", "#BF5AF2", "#8E8E93", "#40C8E0", "#FF375F", "#FFCC00", "#5E5CE6")

TILES = {
    "#appMenu-new-tab-button2": BLUE,
    "#appMenu-new-window-button2, #appMenu-new-classic-window-button": TEAL,
    "#appMenu-new-private-window-button2": INDIGO,
    "#appMenu-history-button": ORANGE,
    "#appMenu-bookmarks-button": YELLOW,
    "#appMenu-downloads-button": GREEN,
    "#appMenu-passwords-button": GRAY,
    "#appMenu-extensions-themes-button, #appMenu-unified-extensions-button": PURPLE,
    "#appMenu-print-button2": GRAY,
    "#appMenu-save-file-button2": BLUE,
    "#appMenu-translate-button": TEAL,
    "#appMenu-find-button2": BLUE,
    "#appMenu-settings-button": GRAY,
    "#appMenu-more-button2": GRAY,
    "#appMenu-help-button2": BLUE,
    "#appMenu-profiles-button, #appMenu-create-profile-button": PINK,
    "#appMenu-tab-groups-button": TEAL,
    "#appMenu-quit-button2": RED,
    "#appMenu-fullscreen-button2": GRAY,
}
tile_rules = "\n".join(f"{sel} {{ --fm-tile: {c} !important; }}" for sel, c in TILES.items())
tile_sel = ", ".join(TILES.keys())

IOS_TOKENS = """
  --fm-accent: light-dark(#007AFF, #0A84FF) !important;
  --fm-on-accent: #ffffff !important;
  --fm-frame: light-dark(#F2F2F7, #000000) !important;
  --fm-bar: light-dark(#FFFFFF, #1C1C1E) !important;
  --fm-field: light-dark(#E5E5EA, #1C1C1E) !important;
  --fm-menu: light-dark(#FFFFFF, #1C1C1E) !important;
  --fm-ink: light-dark(#000000, #FFFFFF) !important;
  --fm-muted: light-dark(#8A8A8E, #8D8D93) !important;
  --fm-line: light-dark(rgb(60 60 67 / .16), rgb(84 84 88 / .55)) !important;
  --fm-hover: light-dark(rgb(120 120 128 / .12), rgb(120 120 128 / .24)) !important;
  --fm-press: light-dark(rgb(120 120 128 / .2), rgb(120 120 128 / .36)) !important;
  --fm-soft: light-dark(rgb(0 122 255 / .14), rgb(10 132 255 / .22)) !important;
  --fm-radius: 18px !important;
  --fm-font: "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif !important;
"""

CHROME = f"""
/* ---------------- iOS theme overlay ---------------- */
:root, menupopup, panel, tooltip, #urlbar, .urlbarView {{
{IOS_TOKENS}
  --fm-ring: light-dark(rgb(0 122 255 / .35), rgb(10 132 255 / .40)) !important;
  --fm-ring-focus: light-dark(rgb(0 122 255 / .7), rgb(10 132 255 / .75)) !important;
  --fm-ring-glow: transparent !important;
}}

/* иконки меню: скруглённые квадраты, как в Настройках iPhone */
{tile_rules}
#appMenu-mainView .subviewbutton:is({tile_sel}) > .toolbarbutton-icon {{
  border-radius: 8px !important;
  width: 29px !important; height: 29px !important; padding: 6.5px !important;
  box-shadow: none !important;
}}
#appMenu-mainView .subviewbutton {{ border-radius: 12px !important; min-height: 44px !important; }}
#appMenu-mainView .subviewbutton > .toolbarbutton-text {{ font-weight: 400 !important; font-size: 14.5px !important; }}

/* меню: ровные списки с тонкими разделителями */
menupopup::part(content), panel::part(content) {{ border-radius: 14px !important; }}
menupopup > :is(menuitem, menu) {{ border-radius: 8px !important; }}
menupopup > :is(menuitem, menu):is([_moz-menuactive], :hover):not([disabled]) {{
  background-color: var(--fm-accent) !important;
  color: #fff !important;
}}

/* вкладки: выбранная — светлая «плашка», как сегмент в iOS */
.tabbrowser-tab[selected] > .tab-stack > .tab-background,
.tabbrowser-tab[multiselected] > .tab-stack > .tab-background {{
  background: light-dark(#FFFFFF, #2C2C2E) !important;
  box-shadow: 0 1px 3px light-dark(rgb(0 0 0 / .12), rgb(0 0 0 / .5)) !important;
}}
.tabbrowser-tab[selected] .tab-label {{ color: var(--fm-ink) !important; font-weight: 600 !important; }}
.tabbrowser-tab[selected] > .tab-stack > .tab-background::before {{ display: none !important; }}

/* кнопки: без заливки акцентом, только цвет значка — как в iOS */
toolbarbutton:is([open], [checked]) > :is(.toolbarbutton-icon, .toolbarbutton-badge-stack) {{
  background-color: var(--fm-hover) !important;
}}

/* закладки: без «таблеток», просто текст, как в Safari */
#PlacesToolbarItems > .bookmark-item {{ background: transparent !important; box-shadow: none !important; }}
#PlacesToolbarItems > .bookmark-item:hover {{ background: var(--fm-hover) !important; }}

/* боковая панель сайтов: выбранный — плашка */
.panel-sidebar-panel[data-checked="true"] {{ background-color: var(--fm-hover) !important; box-shadow: none !important; }}

/* выпадающий список адресной строки */
.urlbarView-row[selected] > .urlbarView-row-inner {{ background: var(--fm-accent) !important; color: #fff !important; }}
.urlbarView-row[selected] :is(.urlbarView-title, .urlbarView-action, .urlbarView-url) {{ color: #fff !important; }}
.urlbarView-favicon {{ border-radius: 8px !important; }}
.urlbarView-row[selected] .urlbarView-favicon {{ background: rgb(255 255 255 / .22) !important; fill: #fff !important; }}

/* уведомления */
.fm-toast {{ border-radius: 16px !important; }}
.fm-toast[data-kind="ok"] .fm-toast-dot {{ background: #30D158 !important; }}
"""

CONTENT_PREFIXES = '@-moz-document url-prefix("about:"), url-prefix("chrome://browser/content/"), url-prefix("chrome://mozapps/"), url-prefix("chrome://global/content/")'

CONTENT = f"""
/* ---------------- iOS theme overlay ---------------- */
{CONTENT_PREFIXES} {{
  :root {{
{IOS_TOKENS}
    --color-accent-primary: var(--fm-accent) !important;
    --button-background-color-primary: var(--fm-accent) !important;
    --link-color: var(--fm-accent) !important;
    --focus-outline-color: var(--fm-accent) !important;
    /* переключатели iPhone: зелёные */
    --toggle-background-color-pressed: #34C759 !important;
    --toggle-background-color-pressed-hover: #30B350 !important;
    --toggle-height: 24px !important;
    --toggle-width: 42px !important;
    --page-nav-button-background-color-selected: var(--fm-accent) !important;
    --page-nav-button-text-color-selected: #ffffff !important;
    --card-border-radius: 22px !important;
    --box-border-radius: 22px !important;
  }}
  :is(setting-group, groupbox):not([hidden]), .card, .addon.card {{ border-radius: 22px !important; }}
  .category[selected] {{ background: var(--fm-accent) !important; color: #fff !important; }}
}}

@-moz-document url-prefix("chrome://noraneko-settings/") {{
  :root, :root[data-theme], .floorp-standard-ui {{
    --floorp-brand: #0A84FF !important;
    --floorp-action: #0A84FF !important;
    --floorp-focus: #0A84FF !important;
    --floorp-switch-on: #34C759 !important;
    --chakra-colors-purple-solid: #0A84FF !important;
    --chakra-colors-purple-fg: #0A84FF !important;
    --chakra-colors-purple-focus-ring: #0A84FF !important;
    --chakra-colors-purple-subtle: rgb(10 132 255 / .16) !important;
  }}
  @media (prefers-color-scheme: dark) {{
    :root, :root[data-theme], .floorp-standard-ui {{
      --floorp-surface: #1C1C1E !important; --floorp-subtle: #1C1C1E !important;
      --chakra-colors-bg-panel: #1C1C1E !important; --chakra-colors-bg-muted: #1C1C1E !important;
    }}
  }}
}}

/* стартовая страница: экран блокировки iPhone — дата сверху, жирные часы */
@-moz-document url-prefix("chrome://noraneko-newtab/"), url("about:newtab"), url("about:home") {{
  #root::before {{
    background:
      radial-gradient(42% 50% at 25% 25%, rgb(10 132 255 / .85), transparent 70%),
      radial-gradient(36% 46% at 80% 22%, rgb(94 92 230 / .80), transparent 70%),
      radial-gradient(44% 52% at 62% 85%, rgb(255 55 95 / .45), transparent 70%),
      radial-gradient(30% 36% at 15% 85%, rgb(100 210 255 / .40), transparent 70%),
      #000 !important;
  }}
  .absolute.top-4.right-4 > div > .flex {{ flex-direction: column-reverse !important; gap: 2px !important; }}
  .absolute.top-4.right-4 .tabular-nums {{
    font-weight: 700 !important;
    letter-spacing: -0.02em !important;
    font-size: clamp(80px, 11vw, 168px) !important;
  }}
  .absolute.top-4.right-4 .tabular-nums > .animate-pulse {{ animation: none !important; opacity: 1 !important; }}
  .absolute.top-4.right-4 .flex-col.text-right > div {{ font-size: 21px !important; font-weight: 600 !important; }}
  .group.cursor-pointer:has(input[readonly]) {{
    border-radius: 16px !important;
    background: rgb(28 28 30 / .9) !important;
    border: 0 !important;
    min-height: 54px !important;
  }}
}}
"""

PDF = """
/* ---------------- iOS theme overlay ---------------- */
:root:has(#outerContainer #viewerContainer) {
  & {
    --x-accent: light-dark(#007AFF, #0A84FF) !important;
    --x-on-accent: #ffffff !important;
    --x-ground: light-dark(#F2F2F7, #000000) !important;
    --x-bar: light-dark(#FFFFFF, #1C1C1E) !important;
    --x-well: light-dark(#E5E5EA, #2C2C2E) !important;
    --x-field: light-dark(#FFFFFF, #2C2C2E) !important;
  }
}
"""

if __name__ == "__main__":
    out = pathlib.Path(sys.argv[1])
    (out / "ios-chrome.css").write_text(CHROME, encoding="utf-8")
    (out / "ios-content.css").write_text(CONTENT, encoding="utf-8")
    (out / "ios-pdf.css").write_text(PDF, encoding="utf-8")
    print("ok")
