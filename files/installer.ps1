param(
  [ValidateSet("install", "uninstall")]
  [string]$Action = "install",
  # ask | floorp | firefox | both
  [ValidateSet("ask", "floorp", "firefox", "both")]
  [string]$Target = "ask",
  # ask | oneui | ios
  [ValidateSet("ask", "oneui", "ios")]
  [string]$Theme = "ask",
  [switch]$Gui,
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

$script:GuiLog = $null
$script:GuiWindow = $null
function Say($text, $color = "Gray") {
  if ($script:GuiLog) {
    $script:GuiLog.Text += "$text`n"
    $script:GuiLog.Parent.ScrollToEnd()
    $script:GuiWindow.Dispatcher.Invoke([action] {}, "Render")
  } else {
    Write-Host $text -ForegroundColor $color
  }
}

# ================================================================ браузеры
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

$found = [ordered]@{}
foreach ($key in $Browsers.Keys) {
  $dir = Find-BrowserDir $Browsers[$key]
  if ($dir) { $found[$key] = $dir }
}

# ================================================================ права администратора
function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  return (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# ================================================================ файлы и блоки
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
# вставить надстройку темы перед END-маркером блока (одна замена)
function Add-Overlay($block, $overlay, $endName) {
  if (-not $overlay) { return $block }
  $rx = New-Object System.Text.RegularExpressions.Regex ('(/\*\s*=+\s*' + $endName + ')')
  $safe = $overlay.Replace('$', '$$')
  return $rx.Replace($block, ($safe.TrimEnd() + "`n`n`$1"), 1)
}

function Get-Blocks($theme) {
  $chrome  = Read-Text (Join-Path $Here "floorp-modern-chrome.css")
  $content = Read-Text (Join-Path $Here "floorp-modern-content.css")
  $pdf     = Read-Text (Join-Path $Here "pdf-viewer-theme.css")
  if ($theme -eq "ios") {
    $chrome  = Add-Overlay $chrome  (Read-Text (Join-Path $Here "themes\ios-chrome.css"))  "FLOORP-MODERN END"
    $content = Add-Overlay $content (Read-Text (Join-Path $Here "themes\ios-content.css")) "FLOORP-MODERN END"
    $pdf     = Add-Overlay $pdf     (Read-Text (Join-Path $Here "themes\ios-pdf.css"))     "PDF-TWEAKS END"
  }
  return @{ Chrome = $chrome; Content = $content; Pdf = $pdf }
}

function Close-Browser($b) {
  $procs = Get-Process -Name $b.Process -ErrorAction SilentlyContinue
  if (-not $procs) { return $true }
  if ($SkipAdmin) { return $true }
  if ($script:GuiWindow) {
    $msg = T "$($b.Name) сейчас открыт. Закрыть его, чтобы применить оформление?`n(Вкладки восстановятся при следующем запуске.)" `
             "$($b.Name) is running. Close it to apply the theme?`n(Tabs are restored on next start.)"
    $r = [System.Windows.MessageBox]::Show($msg, "Floorp Modern", "YesNo", "Question")
    if ($r -ne "Yes") { return $false }
    foreach ($p in $procs) { try { [void]$p.CloseMainWindow() } catch {} }
    for ($i = 0; $i -lt 16 -and (Get-Process -Name $b.Process -ErrorAction SilentlyContinue); $i++) {
      Start-Sleep -Milliseconds 500
      $script:GuiWindow.Dispatcher.Invoke([action] {}, "Render")
    }
    Get-Process -Name $b.Process -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 600
    return $true
  }
  while (Get-Process -Name $b.Process -ErrorAction SilentlyContinue) {
    Say ""
    Say (T "$($b.Name) сейчас открыт. Закройте все его окна и нажмите Enter." "$($b.Name) is running. Close all its windows and press Enter.") Yellow
    Say (T "(или введите «п» и Enter, чтобы продолжить так — тогда перезапустите браузер потом)" "(or type 's' and Enter to skip — then restart the browser later)") DarkGray
    $answer = Read-Host
    if ($answer -match '^[pпPПsS]') { return $true }
  }
  return $true
}

# ================================================================ установка / удаление
function Invoke-Modern($action, $keys, $theme) {
  $ok = $true
  $blocks = if ($action -eq "install") { Get-Blocks $theme } else { $null }
  foreach ($key in $keys) {
    $b = $Browsers[$key]
    $appDir = $found[$key]
    Say ""
    Say "— $($b.Name) —" Cyan
    if (-not $appDir) { Say (T "  не установлен, пропускаю" "  not installed, skipping") Red; continue }
    $profiles = Get-Profiles $b
    if ($profiles.Count -eq 0) {
      Say (T "  нет профилей — запустите $($b.Name) хотя бы раз" "  no profiles — start $($b.Name) at least once") Red
      $ok = $false; continue
    }
    if (-not (Close-Browser $b)) { Say (T "  пропущено: браузер открыт" "  skipped: browser is running") Yellow; $ok = $false; continue }

    try {
      if ($action -eq "install") {
        Copy-Item (Join-Path $Here "config.js") (Join-Path $appDir "config.js") -Force
        $prefDir = Join-Path $appDir "defaults\pref"
        New-Item -ItemType Directory -Force -Path $prefDir | Out-Null
        Copy-Item (Join-Path $Here "config-prefs.js") (Join-Path $prefDir "config-prefs.js") -Force
        Say (T "  ✓ загрузчик скриптов" "  ✓ script loader") Green

        foreach ($p in $profiles) {
          $chrome = Join-Path $p.FullName "chrome"
          New-Item -ItemType Directory -Force -Path $chrome | Out-Null
          $dst = Join-Path $chrome "pdf-tweaks"
          New-Item -ItemType Directory -Force -Path $dst | Out-Null
          Copy-Item (Join-Path $Here "pdf-tweaks\*") $dst -Recurse -Force

          foreach ($pair in @(
              @{ File = "userContent.css"; Blocks = @($blocks.Content, $blocks.Pdf) },
              @{ File = "userChrome.css";  Blocks = @($blocks.Chrome) })) {
            $path = Join-Path $chrome $pair.File
            $text = Read-Text $path
            if ($text -and -not (Test-Path "$path.bak-floorp-modern")) { Copy-Item $path "$path.bak-floorp-modern" }
            $text = Remove-OurBlocks $text
            foreach ($blk in $pair.Blocks) { $text = $text.TrimEnd() + "`n`n" + $blk.Trim() + "`n" }
            Write-Text $path $text.TrimStart()
          }
          Write-Text (Join-Path $chrome "floorp-modern-theme.txt") $theme

          $userJs = Join-Path $p.FullName "user.js"
          $u = Remove-OurPrefs (Read-Text $userJs)
          Write-Text $userJs ($u.TrimEnd() + "`n" + $OurPrefs.Trim() + "`n").TrimStart()

          $prefsJs = Join-Path $p.FullName "prefs.js"
          $prefs = Read-Text $prefsJs
          $prefs = [regex]::Replace($prefs, '(?m)^user_pref\("widget\.windows\.mica[a-z.-]*",[^\n]*\n', '')
          if ($key -eq "floorp") {
            $m = [regex]::Match($prefs, $UiRegex)
            if ($m.Success -and $m.Groups[2].Value -ne "proton") {
              $backup = Join-Path $chrome "floorp-modern-previous-ui.txt"
              if (-not (Test-Path $backup)) { Write-Text $backup $m.Groups[2].Value }
              $prefs = [regex]::Replace($prefs, $UiRegex, '${1}proton${3}')
            }
          }
          Write-Text $prefsJs $prefs
          Say ((T "  ✓ профиль " "  ✓ profile ") + $p.Name) Green
        }
      } else {
        foreach ($f in @((Join-Path $appDir "config.js"), (Join-Path $appDir "defaults\pref\config-prefs.js"))) {
          if (Test-Path $f) { Remove-Item $f -Force }
        }
        Say (T "  ✓ загрузчик удалён" "  ✓ loader removed") Green
        foreach ($p in $profiles) {
          $chrome = Join-Path $p.FullName "chrome"
          $dst = Join-Path $chrome "pdf-tweaks"
          if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
          foreach ($file in @("userContent.css", "userChrome.css")) {
            $path = Join-Path $chrome $file
            if (Test-Path $path) { Write-Text $path ((Remove-OurBlocks (Read-Text $path)).TrimEnd() + "`n") }
          }
          $themeFile = Join-Path $chrome "floorp-modern-theme.txt"
          if (Test-Path $themeFile) { Remove-Item $themeFile -Force }
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
          Say ((T "  ✓ профиль очищен: " "  ✓ profile cleaned: ") + $p.Name) Green
        }
      }
    } catch {
      Say ((T "  ✗ ошибка: " "  ✗ error: ") + $_.Exception.Message) Red
      $ok = $false
    }
  }
  return $ok
}

# ================================================================ окно в стиле iOS
function Show-Gui {
  Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
  $xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Floorp Modern" Width="440" SizeToContent="Height" WindowStartupLocation="CenterScreen"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent" ResizeMode="NoResize"
        FontFamily="Segoe UI Variable Display, Segoe UI" UseLayoutRounding="True">
  <Window.Resources>
    <!-- переключатель как на iPhone -->
    <Style x:Key="IosSwitch" TargetType="CheckBox">
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="CheckBox">
            <Border x:Name="Track" Width="51" Height="31" CornerRadius="15.5" Background="#39393D">
              <Ellipse x:Name="Knob" Width="27" Height="27" Fill="White" Margin="2" HorizontalAlignment="Left">
                <Ellipse.Effect><DropShadowEffect BlurRadius="6" ShadowDepth="1" Opacity="0.25"/></Ellipse.Effect>
              </Ellipse>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsChecked" Value="True">
                <Setter TargetName="Track" Property="Background" Value="#34C759"/>
                <Setter TargetName="Knob" Property="HorizontalAlignment" Value="Right"/>
              </Trigger>
              <Trigger Property="IsEnabled" Value="False">
                <Setter TargetName="Track" Property="Opacity" Value="0.35"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <!-- сегмент переключателя темы -->
    <Style x:Key="Segment" TargetType="RadioButton">
      <Setter Property="Foreground" Value="White"/>
      <Setter Property="FontSize" Value="14"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="RadioButton">
            <Border x:Name="Seg" CornerRadius="9" Background="Transparent" Padding="0,8">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsChecked" Value="True">
                <Setter TargetName="Seg" Property="Background" Value="#636366"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <!-- большая синяя кнопка -->
    <Style x:Key="Primary" TargetType="Button">
      <Setter Property="Foreground" Value="White"/>
      <Setter Property="FontSize" Value="17"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="Bg" CornerRadius="25" Background="#0A84FF" Height="50">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="Bg" Property="Background" Value="#2A95FF"/></Trigger>
              <Trigger Property="IsPressed" Value="True"><Setter TargetName="Bg" Property="Background" Value="#0A6FD8"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter TargetName="Bg" Property="Opacity" Value="0.4"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <!-- текстовая кнопка -->
    <Style x:Key="Link" TargetType="Button">
      <Setter Property="Foreground" Value="#0A84FF"/>
      <Setter Property="FontSize" Value="15"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border Background="Transparent" Padding="10,8"><ContentPresenter HorizontalAlignment="Center"/></Border>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
  </Window.Resources>

  <Border CornerRadius="28" Background="#000000" BorderBrush="#2C2C2E" BorderThickness="1" Margin="12">
    <Border.Effect><DropShadowEffect BlurRadius="30" ShadowDepth="0" Opacity="0.55"/></Border.Effect>
    <Grid Margin="24,18,24,22">
      <StackPanel>
        <!-- шапка -->
        <Grid x:Name="DragArea" Background="Transparent">
          <Button x:Name="CloseBtn" HorizontalAlignment="Right" VerticalAlignment="Top" Width="30" Height="30" Cursor="Hand">
            <Button.Template>
              <ControlTemplate TargetType="Button">
                <Border x:Name="B" CornerRadius="15" Background="#2C2C2E">
                  <TextBlock Text="✕" Foreground="#8E8E93" FontSize="13" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                </Border>
                <ControlTemplate.Triggers>
                  <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="B" Property="Background" Value="#3A3A3C"/></Trigger>
                </ControlTemplate.Triggers>
              </ControlTemplate>
            </Button.Template>
          </Button>
          <StackPanel Margin="0,14,0,0">
            <Border Width="64" Height="64" CornerRadius="16" HorizontalAlignment="Left">
              <Border.Background>
                <LinearGradientBrush StartPoint="0,0" EndPoint="1,1">
                  <GradientStop Color="#0A84FF" Offset="0"/>
                  <GradientStop Color="#5E5CE6" Offset="0.55"/>
                  <GradientStop Color="#FF375F" Offset="1"/>
                </LinearGradientBrush>
              </Border.Background>
              <TextBlock Text="F" Foreground="White" FontSize="34" FontWeight="Bold" HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <TextBlock Text="Floorp Modern" Foreground="White" FontSize="30" FontWeight="Bold" Margin="0,14,0,0"/>
            <TextBlock x:Name="Subtitle" Foreground="#8E8E93" FontSize="15" Margin="0,2,0,0" TextWrapping="Wrap"/>
          </StackPanel>
        </Grid>

        <!-- тема -->
        <TextBlock x:Name="ThemeCaption" Foreground="#8E8E93" FontSize="12.5" Margin="16,24,0,7"/>
        <Border CornerRadius="11" Background="#1C1C1E" Padding="2">
          <UniformGrid Columns="2">
            <RadioButton x:Name="ThemeOneUi" Style="{StaticResource Segment}" GroupName="theme" Content="One UI" IsChecked="True"/>
            <RadioButton x:Name="ThemeIos" Style="{StaticResource Segment}" GroupName="theme" Content="iOS"/>
          </UniformGrid>
        </Border>
        <TextBlock x:Name="ThemeHint" Foreground="#8E8E93" FontSize="13" Margin="16,8,16,0" TextWrapping="Wrap"/>

        <!-- браузеры -->
        <TextBlock x:Name="BrowsersCaption" Foreground="#8E8E93" FontSize="12.5" Margin="16,22,0,7"/>
        <Border CornerRadius="14" Background="#1C1C1E">
          <StackPanel>
            <Grid Margin="16,11,12,11">
              <StackPanel VerticalAlignment="Center">
                <TextBlock Text="Floorp" Foreground="White" FontSize="16"/>
                <TextBlock x:Name="FloorpPath" Foreground="#8E8E93" FontSize="12" TextTrimming="CharacterEllipsis" Margin="0,1,60,0"/>
              </StackPanel>
              <CheckBox x:Name="FloorpSwitch" Style="{StaticResource IosSwitch}" HorizontalAlignment="Right" VerticalAlignment="Center"/>
            </Grid>
            <Border Height="1" Background="#38383A" Margin="16,0,0,0"/>
            <Grid Margin="16,11,12,11">
              <StackPanel VerticalAlignment="Center">
                <TextBlock Text="Firefox" Foreground="White" FontSize="16"/>
                <TextBlock x:Name="FirefoxPath" Foreground="#8E8E93" FontSize="12" TextTrimming="CharacterEllipsis" Margin="0,1,60,0"/>
              </StackPanel>
              <CheckBox x:Name="FirefoxSwitch" Style="{StaticResource IosSwitch}" HorizontalAlignment="Right" VerticalAlignment="Center"/>
            </Grid>
          </StackPanel>
        </Border>

        <!-- журнал -->
        <Border x:Name="LogBox" CornerRadius="14" Background="#1C1C1E" Margin="0,18,0,0" Visibility="Collapsed" MaxHeight="150">
          <ScrollViewer VerticalScrollBarVisibility="Auto" Margin="14,10">
            <TextBlock x:Name="Log" Foreground="#D1D1D6" FontSize="12.5" TextWrapping="Wrap" FontFamily="Cascadia Mono, Consolas, Segoe UI"/>
          </ScrollViewer>
        </Border>

        <Button x:Name="InstallBtn" Style="{StaticResource Primary}" Margin="0,22,0,0"/>
        <Button x:Name="UninstallBtn" Style="{StaticResource Link}" Margin="0,6,0,0" HorizontalAlignment="Center"/>
      </StackPanel>
    </Grid>
  </Border>
</Window>
'@
  $window = [Windows.Markup.XamlReader]::Parse($xaml)
  $script:GuiWindow = $window
  $get = { param($n) $window.FindName($n) }

  (& $get "Subtitle").Text = T "Новый вид для Floorp и Firefox" "A fresh look for Floorp and Firefox"
  (& $get "ThemeCaption").Text = T "ТЕМА" "THEME"
  (& $get "BrowsersCaption").Text = T "БРАУЗЕРЫ" "BROWSERS"
  (& $get "InstallBtn").Content = T "Установить" "Install"
  (& $get "UninstallBtn").Content = T "Удалить оформление" "Remove theme"

  $hint = & $get "ThemeHint"
  $hints = @{
    oneui = (T "Как Samsung Galaxy: круглые кнопки и «таблетки», акцент из Windows, часы как на экране блокировки Galaxy." `
               "Samsung Galaxy style: round buttons and pills, Windows accent color, Galaxy lock-screen clock.")
    ios   = (T "Как iPhone: синий Apple, иконки-квадраты как в Настройках, зелёные переключатели, жирные часы как на экране блокировки." `
               "iPhone style: Apple blue, rounded-square icons like Settings, green switches, bold lock-screen clock.")
  }
  $oneui = & $get "ThemeOneUi"; $ios = & $get "ThemeIos"
  $hint.Text = $hints.oneui
  $oneui.Add_Checked({ $hint.Text = $hints.oneui })
  $ios.Add_Checked({ $hint.Text = $hints.ios })

  foreach ($pair in @(@("floorp", "FloorpSwitch", "FloorpPath"), @("firefox", "FirefoxSwitch", "FirefoxPath"))) {
    $sw = & $get $pair[1]; $lbl = & $get $pair[2]
    if ($found.Contains($pair[0])) {
      $sw.IsChecked = $true; $lbl.Text = $found[$pair[0]]
    } else {
      $sw.IsChecked = $false; $sw.IsEnabled = $false; $lbl.Text = T "не установлен" "not installed"
    }
  }

  $script:GuiLog = & $get "Log"
  (& $get "DragArea").Add_MouseLeftButtonDown({ try { $window.DragMove() } catch {} })
  (& $get "CloseBtn").Add_Click({ $window.Close() })

  $run = {
    param($action)
    $keys = @()
    if ((& $get "FloorpSwitch").IsChecked) { $keys += "floorp" }
    if ((& $get "FirefoxSwitch").IsChecked) { $keys += "firefox" }
    if ($keys.Count -eq 0) {
      [System.Windows.MessageBox]::Show((T "Включите хотя бы один браузер." "Turn on at least one browser."), "Floorp Modern") | Out-Null
      return
    }
    $theme = if ((& $get "ThemeIos").IsChecked) { "ios" } else { "oneui" }
    (& $get "LogBox").Visibility = "Visible"
    $script:GuiLog.Text = ""
    (& $get "InstallBtn").IsEnabled = $false; (& $get "UninstallBtn").IsEnabled = $false
    $ok = Invoke-Modern $action $keys $theme
    Say ""
    if ($ok) {
      Say ($(if ($action -eq "install") { T "Готово! Откройте браузер." "Done! Start the browser." } else { T "Готово. После перезапуска браузер выглядит как раньше." "Done. Restart the browser." }))
      (& $get "InstallBtn").Content = T "Готово" "Done"
      (& $get "InstallBtn").IsEnabled = $true
      (& $get "InstallBtn").Remove_Click($script:installHandler)
      (& $get "InstallBtn").Add_Click({ $window.Close() })
    } else {
      Say (T "Что-то пошло не так — подробности выше." "Something went wrong — see above.")
      (& $get "InstallBtn").IsEnabled = $true; (& $get "UninstallBtn").IsEnabled = $true
    }
  }
  $script:installHandler = { & $run "install" }
  (& $get "InstallBtn").Add_Click($script:installHandler)
  (& $get "UninstallBtn").Add_Click({ & $run "uninstall" })
  [void]$window.ShowDialog()
}

# ================================================================ запуск
if (-not $SkipAdmin -and -not (Test-Admin)) {
  $argList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"",
               "-Action", $Action, "-Target", $Target, "-Theme", $Theme, "-UserAppData", "`"$UserAppData`"")
  if ($Gui) { $argList = @("-STA", "-WindowStyle", "Hidden") + $argList + @("-Gui") }
  else { Write-Host (T "Нужны права администратора (чтобы положить загрузчик в папку браузера). Сейчас Windows спросит разрешение..." "Administrator rights are needed. Windows will ask now...") -ForegroundColor Yellow }
  try {
    $p = Start-Process powershell -Verb RunAs -ArgumentList $argList -Wait -PassThru
    exit $p.ExitCode
  } catch {
    Write-Host (T "Без прав администратора установить не получится." "Cannot continue without administrator rights.") -ForegroundColor Red
    exit 1
  }
}

if ($Gui) {
  try {
    Show-Gui
  } catch {
    try {
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.MessageBox]::Show("Floorp Modern: " + $_.Exception.Message) | Out-Null
    } catch {}
    exit 1
  }
  exit 0
}

# ---------------- консольный режим ----------------
Say ""
Say "Floorp Modern" Cyan
if ($found.Count -eq 0) {
  Say (T "Не нашёл ни Floorp, ни Firefox. Установите браузер и запустите его хотя бы раз." "Neither Floorp nor Firefox was found.") Red
  if (-not $SkipAdmin) { Read-Host (T "Нажмите Enter" "Press Enter") | Out-Null }
  exit 1
}
if ($Target -eq "ask") {
  Say $(if ($Action -eq "install") { T "Куда установить?" "Install into:" } else { T "Откуда удалить?" "Remove from:" })
  $menu = @($found.Keys)
  if ($found.Count -gt 1) { $menu += "both" }
  for ($i = 0; $i -lt $menu.Count; $i++) {
    $label = if ($menu[$i] -eq "both") { T "Оба браузера" "Both browsers" } else { "$($Browsers[$menu[$i]].Name)  ($($found[$menu[$i]]))" }
    Say ("  {0}. {1}" -f ($i + 1), $label)
  }
  $choice = 0
  if ($menu.Count -eq 1) { $choice = 1 } else {
    while ($choice -lt 1 -or $choice -gt $menu.Count) { [int]::TryParse((Read-Host (T "Введите номер" "Enter a number")), [ref]$choice) | Out-Null }
  }
  $Target = $menu[$choice - 1]
}
if ($Action -eq "install" -and $Theme -eq "ask") {
  Say (T "Какая тема?" "Which theme?")
  Say (T "  1. One UI (как Samsung Galaxy)" "  1. One UI (Samsung Galaxy style)")
  Say (T "  2. iOS (как iPhone)" "  2. iOS (iPhone style)")
  $c = 0
  while ($c -lt 1 -or $c -gt 2) { [int]::TryParse((Read-Host (T "Введите номер" "Enter a number")), [ref]$c) | Out-Null }
  $Theme = @("oneui", "ios")[$c - 1]
}
$keys = if ($Target -eq "both") { @($found.Keys) } else { @($Target) }
$ok = Invoke-Modern $Action $keys $Theme
Say ""
if ($Action -eq "install") { Say (T "Готово! Откройте браузер." "Done! Start the browser.") Green }
else { Say (T "Готово. После перезапуска браузер выглядит как раньше." "Done. The browser looks as before after a restart.") Green }
if (-not $SkipAdmin) { Say ""; Read-Host (T "Нажмите Enter, чтобы закрыть окно" "Press Enter to close") | Out-Null }
if ($ok) { exit 0 } else { exit 1 }
