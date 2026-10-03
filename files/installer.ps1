param(
  [ValidateSet("install", "uninstall")]
  [string]$Action = "install",
  # ask | floorp | firefox | both
  [ValidateSet("ask", "floorp", "firefox", "both")]
  [string]$Target = "ask",
  [string]$UserAppData = $env:APPDATA,
  # для тестов: принудительные пути к папкам браузеров
  [string]$FloorpDir = "",
  [string]$FirefoxDir = "",
  [switch]$SkipAdmin
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$Here = $PSScriptRoot
$Utf8 = New-Object System.Text.UTF8Encoding($false)
$Ru = $true
try { $Ru = (Get-UICulture).Name -like "ru*" } catch {}
function T($ru, $en) { if ($Ru) { $ru } else { $en } }
function Say($text, $color = "Gray") { Write-Host $text -ForegroundColor $color }

# ------------------------------------------------------------------ браузеры
$Browsers = [ordered]@{
  floorp = @{
    Name = "Floorp"; Exe = "floorp.exe"; Process = "floorp"
    Dirs = @("$env:ProgramFiles\Ablaze Floorp", "${env:ProgramFiles(x86)}\Ablaze Floorp",
             "$env:LOCALAPPDATA\Programs\Ablaze Floorp", "$env:LOCALAPPDATA\Ablaze Floorp")
    Profiles = "Floorp\Profiles"; Override = $FloorpDir
  }
  firefox = @{
    Name = "Firefox"; Exe = "firefox.exe"; Process = "firefox"
    Dirs = @("$env:ProgramFiles\Mozilla Firefox", "${env:ProgramFiles(x86)}\Mozilla Firefox",
             "$env:LOCALAPPDATA\Mozilla Firefox", "$env:LOCALAPPDATA\Programs\Mozilla Firefox")
    Profiles = "Mozilla\Firefox\Profiles"; Override = $FirefoxDir
  }
}

function Find-BrowserDir($b) {
  if ($b.Override) { if (Test-Path (Join-Path $b.Override $b.Exe)) { return $b.Override } else { return $null } }
  $candidates = @()
  foreach ($hive in @("HKLM:", "HKCU:")) {
    try {
      $exe = (Get-ItemProperty -Path "$hive\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$($b.Exe)" -ErrorAction Stop).'(default)'
      if ($exe) { $candidates += (Split-Path $exe.Trim('"') -Parent) }
    } catch {}
  }
  $candidates += $b.Dirs
  foreach ($c in $candidates) {
    if ($c -and (Test-Path (Join-Path $c $b.Exe))) { return $c }
  }
  return $null
}

function Get-Profiles($b) {
  $root = Join-Path $UserAppData $b.Profiles
  if (-not (Test-Path $root)) { return @() }
  return @(Get-ChildItem $root -Directory | Where-Object { Test-Path (Join-Path $_.FullName "prefs.js") })
}

# что установлено на этом компьютере
$found = [ordered]@{}
foreach ($key in $Browsers.Keys) {
  $dir = Find-BrowserDir $Browsers[$key]
  if ($dir) { $found[$key] = $dir }
}

# ------------------------------------------------------------------ выбор
if ($Target -eq "ask") {
  Say ""
  Say "Floorp Modern" Cyan
  if ($found.Count -eq 0) {
    Say (T "Не нашёл ни Floorp, ни Firefox. Установите браузер и запустите его хотя бы раз." `
           "Neither Floorp nor Firefox was found. Install a browser and start it at least once.") Red
    Read-Host (T "Нажмите Enter" "Press Enter") | Out-Null
    exit 1
  }
  $verb = if ($Action -eq "install") { T "Куда установить?" "Install into:" } else { T "Откуда удалить?" "Remove from:" }
  Say $verb
  $menu = @()
  foreach ($key in $found.Keys) { $menu += $key }
  if ($found.Count -gt 1) { $menu += "both" }
  for ($i = 0; $i -lt $menu.Count; $i++) {
    $label = if ($menu[$i] -eq "both") { T "Оба браузера" "Both browsers" } else { "$($Browsers[$menu[$i]].Name)  ($($found[$menu[$i]]))" }
    Say ("  {0}. {1}" -f ($i + 1), $label)
  }
  $choice = 0
  if ($menu.Count -eq 1) {
    $choice = 1
  } else {
    while ($choice -lt 1 -or $choice -gt $menu.Count) {
      $raw = Read-Host (T "Введите номер" "Enter a number")
      [int]::TryParse($raw, [ref]$choice) | Out-Null
    }
  }
  $Target = $menu[$choice - 1]
}
$targets = if ($Target -eq "both") { @($found.Keys) } else { @($Target) }

# ------------------------------------------------------------------ права администратора
function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  return (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
if (-not $SkipAdmin -and -not (Test-Admin)) {
  Say (T "Нужны права администратора (чтобы положить загрузчик в папку браузера). Сейчас Windows спросит разрешение..." `
         "Administrator rights are needed to put the loader into the browser folder. Windows will ask now...") Yellow
  $argList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"",
               "-Action", $Action, "-Target", $Target, "-UserAppData", "`"$UserAppData`"")
  try {
    $p = Start-Process powershell -Verb RunAs -ArgumentList $argList -Wait -PassThru
    exit $p.ExitCode
  } catch {
    Say (T "Без прав администратора установить не получится." "Cannot continue without administrator rights.") Red
    exit 1
  }
}

function Finish([int]$code) {
  if (-not $SkipAdmin) { Say ""; Read-Host (T "Нажмите Enter, чтобы закрыть окно" "Press Enter to close") | Out-Null }
  exit $code
}

# ------------------------------------------------------------------ общие помощники
function Read-Text($path) { if (Test-Path $path) { return [IO.File]::ReadAllText($path, $Utf8) } return "" }
function Write-Text($path, $text) { [IO.File]::WriteAllText($path, $text, $Utf8) }

$PdfRegex    = '(?s)\r?\n?/\*\s*=+\s*PDF-TWEAKS.*?PDF-TWEAKS END\s*=+\s*\*/\r?\n?'
$ModernRegex = '(?s)\r?\n?/\*\s*=+\s*FLOORP-MODERN BEGIN.*?FLOORP-MODERN END\s*=+\s*\*/\r?\n?'
$UiRegex     = '(user_pref\("floorp\.design\.configs", ".*?\\"userInterface\\":\\")([a-z]+)(\\")'
$PrefComment = '// Floorp Modern: enables userChrome.css / userContent.css'
$PrefLine    = 'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);'
$OurPrefs = @"
$PrefComment
$PrefLine
// Floorp Modern: Firefox Nova design, tabs expand on hover
user_pref("browser.nova.enabled", true);
user_pref("sidebar.visibility", "expand-on-hover");
"@

function Remove-OurBlocks($text) {
  $text = [regex]::Replace($text, $PdfRegex, "`n")
  return [regex]::Replace($text, $ModernRegex, "`n")
}
function Remove-OurPrefs($text) {
  $lines = $text -split "`r?`n" | Where-Object {
    $_ -notmatch 'toolkit\.legacyUserProfileCustomizations\.stylesheets|browser\.nova\.enabled|widget\.windows\.mica|sidebar\.visibility|^// (Floorp PDF|Floorp Modern|Включает userChrome)'
  }
  return ($lines -join "`n")
}

function Wait-Closed($b) {
  while ((-not $SkipAdmin) -and (Get-Process -Name $b.Process -ErrorAction SilentlyContinue)) {
    Say ""
    Say (T "$($b.Name) сейчас открыт. Закройте все его окна и нажмите Enter." "$($b.Name) is running. Close all its windows and press Enter.") Yellow
    Say (T "(или введите «п» и Enter, чтобы продолжить так — тогда перезапустите браузер потом)" "(or type 's' and Enter to skip — then restart the browser later)") DarkGray
    $answer = Read-Host
    if ($answer -match '^[pпPПsS]') { return }
  }
}

$pdfBlock     = Read-Text (Join-Path $Here "pdf-viewer-theme.css")
$chromeBlock  = Read-Text (Join-Path $Here "floorp-modern-chrome.css")
$contentBlock = Read-Text (Join-Path $Here "floorp-modern-content.css")

# ------------------------------------------------------------------ установка / удаление
foreach ($key in $targets) {
  $b = $Browsers[$key]
  $appDir = $found[$key]
  if (-not $appDir) { $appDir = Find-BrowserDir $b }
  Say ""
  Say "=== $($b.Name) ===" Cyan
  if (-not $appDir) {
    Say (T "Не нашёл папку $($b.Name), пропускаю." "$($b.Name) folder not found, skipping.") Red
    continue
  }
  $profiles = Get-Profiles $b
  if ($profiles.Count -eq 0) {
    Say (T "Нет профилей в $UserAppData\$($b.Profiles). Запустите $($b.Name) хотя бы раз." `
           "No profiles in $UserAppData\$($b.Profiles). Start $($b.Name) at least once.") Red
    continue
  }
  Say "$appDir" DarkGray
  Say ((T "Профили: " "Profiles: ") + (($profiles | ForEach-Object Name) -join ", ")) DarkGray
  Wait-Closed $b

  if ($Action -eq "install") {
    # 1. загрузчик в папке программы
    Copy-Item (Join-Path $Here "config.js") (Join-Path $appDir "config.js") -Force
    $prefDir = Join-Path $appDir "defaults\pref"
    New-Item -ItemType Directory -Force -Path $prefDir | Out-Null
    Copy-Item (Join-Path $Here "config-prefs.js") (Join-Path $prefDir "config-prefs.js") -Force
    Say (T "  загрузчик скриптов установлен" "  script loader installed") Green

    foreach ($p in $profiles) {
      $chrome = Join-Path $p.FullName "chrome"
      New-Item -ItemType Directory -Force -Path $chrome | Out-Null

      # 2. скрипты (PDF + функции окна)
      $dst = Join-Path $chrome "pdf-tweaks"
      New-Item -ItemType Directory -Force -Path $dst | Out-Null
      Copy-Item (Join-Path $Here "pdf-tweaks\*") $dst -Recurse -Force

      # 3. стили: наши блоки заменяются, чужие правила не трогаются
      foreach ($pair in @(
          @{ File = "userContent.css"; Blocks = @($contentBlock, $pdfBlock) },
          @{ File = "userChrome.css";  Blocks = @($chromeBlock) })) {
        $path = Join-Path $chrome $pair.File
        $text = Read-Text $path
        if ($text -and -not (Test-Path "$path.bak-floorp-modern")) { Copy-Item $path "$path.bak-floorp-modern" }
        $text = Remove-OurBlocks $text
        foreach ($blk in $pair.Blocks) { $text = $text.TrimEnd() + "`n`n" + $blk.Trim() + "`n" }
        Write-Text $path $text.TrimStart()
      }

      # 4. настройки
      $userJs = Join-Path $p.FullName "user.js"
      $u = Remove-OurPrefs (Read-Text $userJs)
      Write-Text $userJs ($u.TrimEnd() + "`n" + $OurPrefs.Trim() + "`n").TrimStart()

      $prefsJs = Join-Path $p.FullName "prefs.js"
      $prefs = Read-Text $prefsJs
      $prefs = [regex]::Replace($prefs, '(?m)^user_pref\("widget\.windows\.mica[a-z.-]*",[^\n]*\n', '')
      # 5. только Floorp: старый дизайн Lepton/Photon -> Proton (основа для Nova)
      if ($key -eq "floorp") {
        $m = [regex]::Match($prefs, $UiRegex)
        if ($m.Success -and $m.Groups[2].Value -ne "proton") {
          $backup = Join-Path $chrome "floorp-modern-previous-ui.txt"
          if (-not (Test-Path $backup)) { Write-Text $backup $m.Groups[2].Value }
          $prefs = [regex]::Replace($prefs, $UiRegex, '${1}proton${3}')
        }
      }
      Write-Text $prefsJs $prefs
      Say ((T "  профиль " "  profile ") + $p.Name + (T ": готово" ": done")) Green
    }
  } else {
    foreach ($f in @((Join-Path $appDir "config.js"), (Join-Path $appDir "defaults\pref\config-prefs.js"))) {
      if (Test-Path $f) { Remove-Item $f -Force }
    }
    Say (T "  загрузчик скриптов удалён" "  script loader removed") Green
    foreach ($p in $profiles) {
      $chrome = Join-Path $p.FullName "chrome"
      $dst = Join-Path $chrome "pdf-tweaks"
      if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
      foreach ($file in @("userContent.css", "userChrome.css")) {
        $path = Join-Path $chrome $file
        if (Test-Path $path) { Write-Text $path ((Remove-OurBlocks (Read-Text $path)).TrimEnd() + "`n") }
      }
      $userJs = Join-Path $p.FullName "user.js"
      if (Test-Path $userJs) {
        $u = Remove-OurPrefs (Read-Text $userJs)
        Write-Text $userJs ($u.TrimEnd() + "`n$PrefComment`n$PrefLine`n").TrimStart()
      }
      $prefsJs = Join-Path $p.FullName "prefs.js"
      $prefs = Read-Text $prefsJs
      $prefs = [regex]::Replace($prefs, '(?m)^user_pref\("(browser\.nova\.enabled|widget\.windows\.mica[a-z.-]*|sidebar\.visibility)",[^\n]*\n', '')
      $backup = Join-Path $chrome "floorp-modern-previous-ui.txt"
      if (Test-Path $backup) {
        $old = (Read-Text $backup).Trim()
        if ($old -match '^[a-z]+$') { $prefs = [regex]::Replace($prefs, $UiRegex, '${1}' + $old + '${3}') }
        Remove-Item $backup -Force
      }
      Write-Text $prefsJs $prefs
      Say ((T "  профиль " "  profile ") + $p.Name + (T ": очищен" ": cleaned")) Green
    }
  }
}

Say ""
if ($Action -eq "install") {
  Say (T "Готово! Откройте браузер." "Done! Start the browser.") Green
} else {
  Say (T "Готово. После перезапуска браузер выглядит как раньше." "Done. The browser looks as before after a restart.") Green
}
Finish 0
