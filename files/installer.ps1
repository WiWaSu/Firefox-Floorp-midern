param(
  [ValidateSet("install", "uninstall")]
  [string]$Action = "install",
  # ask | floorp | firefox | both
  [ValidateSet("ask", "floorp", "firefox", "both")]
  [string]$Target = "ask",
  # ask | oneui | ios
  [ValidateSet("ask", "oneui", "ios")]
  [string]$Theme = "ask",
  # ask | yes | no — новый просмотрщик PDF
  [ValidateSet("ask", "yes", "no")]
  [string]$Pdf = "ask",
  [switch]$Gui,
  [string]$UserAppData = $env:APPDATA,
  # для тестов: принудительные пути к папкам браузеров
  [string]$FloorpDir = "",
  [string]$FirefoxDir = "",
  [switch]$SkipAdmin
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

# версия установщика (меняется вместе с файлом VERSION и CHANGELOG.md)
$Version = "1.4.2"
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
    $_ -notmatch 'toolkit\.legacyUserProfileCustomizations\.stylesheets|browser\.nova\.enabled|widget\.windows\.mica|sidebar\.visibility|floorp\.pdftweaks\.enabled|^// (Floorp PDF|Floorp Modern|Включает userChrome)'
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
function Invoke-Modern($action, $keys, $theme, $pdf = $true) {
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
              @{ File = "userContent.css"; Blocks = $(if ($pdf) { @($blocks.Content, $blocks.Pdf) } else { @($blocks.Content) }) },
              @{ File = "userChrome.css";  Blocks = @($blocks.Chrome) })) {
            $path = Join-Path $chrome $pair.File
            $text = Read-Text $path
            if ($text -and -not (Test-Path "$path.bak-floorp-modern")) { Copy-Item $path "$path.bak-floorp-modern" }
            $text = Remove-OurBlocks $text
            foreach ($blk in $pair.Blocks) { $text = $text.TrimEnd() + "`n`n" + $blk.Trim() + "`n" }
            Write-Text $path $text.TrimStart()
          }
          Write-Text (Join-Path $chrome "floorp-modern-theme.txt") $theme
          Write-Text (Join-Path $chrome "floorp-modern-version.txt") $Version

          $userJs = Join-Path $p.FullName "user.js"
          $u = Remove-OurPrefs (Read-Text $userJs)
          $pdfPref = "// Floorp Modern: new PDF viewer on/off`nuser_pref(""floorp.pdftweaks.enabled"", $(if ($pdf) { 'true' } else { 'false' }));"
          Write-Text $userJs ($u.TrimEnd() + "`n" + $OurPrefs.Trim() + "`n" + $pdfPref + "`n").TrimStart()

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
          Say ((T "  ✓ профиль " "  ✓ profile ") + $p.Name + $(if ($pdf) { T " (с просмотрщиком PDF)" " (with PDF viewer)" } else { "" })) Green
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
          foreach ($f in @("floorp-modern-theme.txt", "floorp-modern-version.txt")) {
            $themeFile = Join-Path $chrome $f
            if (Test-Path $themeFile) { Remove-Item $themeFile -Force }
          }
          $userJs = Join-Path $p.FullName "user.js"
          if (Test-Path $userJs) {
            $u = Remove-OurPrefs (Read-Text $userJs)
            Write-Text $userJs ($u.TrimEnd() + "`n$PrefComment`n$PrefLine`n").TrimStart()
          }
          $prefsJs = Join-Path $p.FullName "prefs.js"
          $prefs = Read-Text $prefsJs
          $prefs = [regex]::Replace($prefs, '(?m)^user_pref\("(browser\.nova\.enabled|widget\.windows\.mica[a-z.-]*|sidebar\.visibility|floorp\.pdftweaks\.enabled)",[^\n]*\n', '')
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

# ================================================================ окно установщика (стекло Windows 11)
function Get-WindowsAccent {
  try {
    $v = [uint32](Get-ItemProperty "HKCU:\Software\Microsoft\Windows\DWM" -Name AccentColor -ErrorAction Stop).AccentColor
    $r = [byte]($v -band 0xFF); $g = [byte](($v -shr 8) -band 0xFF); $b = [byte](($v -shr 16) -band 0xFF)
    # как в браузере: в тёмной теме акцент чуть светлее
    $mix = { param($c) [byte]([math]::Round($c * 0.7 + 255 * 0.3)) }
    return [Windows.Media.Color]::FromRgb((& $mix $r), (& $mix $g), (& $mix $b))
  } catch {
    return [Windows.Media.Color]::FromRgb(0x4C, 0x9A, 0xFF)
  }
}

function Show-Gui {
  Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
  $xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Floorp Modern" Width="470" SizeToContent="Height" WindowStartupLocation="CenterScreen"
        ResizeMode="NoResize" Background="Transparent"
        FontFamily="Segoe UI Variable Display, Segoe UI" UseLayoutRounding="True" TextOptions.TextFormattingMode="Display">
  <WindowChrome.WindowChrome>
    <WindowChrome CaptionHeight="0" ResizeBorderThickness="0" GlassFrameThickness="-1" CornerRadius="0" UseAeroCaptionButtons="False"/>
  </WindowChrome.WindowChrome>
  <Window.Resources>
    <SolidColorBrush x:Key="Accent" Color="#4C9AFF"/>
    <SolidColorBrush x:Key="SwitchOn" Color="#4C9AFF"/>
    <SolidColorBrush x:Key="Ink" Color="#FFFFFFFF"/>
    <SolidColorBrush x:Key="Muted" Color="#99EBEBF5"/>
    <LinearGradientBrush x:Key="Rim" StartPoint="0,0" EndPoint="0,1">
      <GradientStop Color="#66FFFFFF" Offset="0"/>
      <GradientStop Color="#14FFFFFF" Offset="0.45"/>
      <GradientStop Color="#26FFFFFF" Offset="1"/>
    </LinearGradientBrush>
    <LinearGradientBrush x:Key="Sheen" StartPoint="0,0" EndPoint="0,1">
      <GradientStop Color="#24FFFFFF" Offset="0"/>
      <GradientStop Color="#0DFFFFFF" Offset="0.6"/>
      <GradientStop Color="#12FFFFFF" Offset="1"/>
    </LinearGradientBrush>

    <!-- стеклянная плитка -->
    <Style x:Key="Cell" TargetType="Border">
      <Setter Property="CornerRadius" Value="20"/>
      <Setter Property="Background" Value="{StaticResource Sheen}"/>
      <Setter Property="BorderBrush" Value="{StaticResource Rim}"/>
      <Setter Property="BorderThickness" Value="1"/>
    </Style>
    <Style x:Key="Caption" TargetType="TextBlock">
      <Setter Property="Foreground" Value="{StaticResource Muted}"/>
      <Setter Property="FontSize" Value="12"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Margin" Value="18,20,0,8"/>
    </Style>

    <!-- переключатель: ползунок едет с «пружинкой» -->
    <Style x:Key="Switch" TargetType="CheckBox">
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="CheckBox">
            <Border x:Name="Track" Width="52" Height="32" CornerRadius="16" Background="#33FFFFFF" BorderBrush="#22FFFFFF" BorderThickness="1">
              <Ellipse x:Name="Knob" Width="26" Height="26" Fill="White" Margin="2,0,0,0" HorizontalAlignment="Left" VerticalAlignment="Center">
                <Ellipse.RenderTransform><TranslateTransform x:Name="KnobMove" X="0"/></Ellipse.RenderTransform>
                <Ellipse.Effect><DropShadowEffect BlurRadius="8" ShadowDepth="1" Opacity="0.3"/></Ellipse.Effect>
              </Ellipse>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsChecked" Value="True">
                <Setter TargetName="Track" Property="Background" Value="{DynamicResource SwitchOn}"/>
                <Trigger.EnterActions>
                  <BeginStoryboard>
                    <Storyboard>
                      <DoubleAnimation Storyboard.TargetName="KnobMove" Storyboard.TargetProperty="X" To="20" Duration="0:0:0.32">
                        <DoubleAnimation.EasingFunction><BackEase EasingMode="EaseOut" Amplitude="0.45"/></DoubleAnimation.EasingFunction>
                      </DoubleAnimation>
                    </Storyboard>
                  </BeginStoryboard>
                </Trigger.EnterActions>
                <Trigger.ExitActions>
                  <BeginStoryboard>
                    <Storyboard>
                      <DoubleAnimation Storyboard.TargetName="KnobMove" Storyboard.TargetProperty="X" To="0" Duration="0:0:0.32">
                        <DoubleAnimation.EasingFunction><BackEase EasingMode="EaseOut" Amplitude="0.45"/></DoubleAnimation.EasingFunction>
                      </DoubleAnimation>
                    </Storyboard>
                  </BeginStoryboard>
                </Trigger.ExitActions>
              </Trigger>
              <Trigger Property="IsEnabled" Value="False">
                <Setter TargetName="Track" Property="Opacity" Value="0.35"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>

    <!-- сегмент выбора темы: прозрачный, подложка едет отдельно -->
    <Style x:Key="Segment" TargetType="RadioButton">
      <Setter Property="Foreground" Value="White"/>
      <Setter Property="FontSize" Value="14.5"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="RadioButton">
            <Border Background="Transparent" Padding="0,9">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>

    <!-- главная кнопка: капсула цвета акцента с бликом -->
    <Style x:Key="Primary" TargetType="Button">
      <Setter Property="Foreground" Value="White"/>
      <Setter Property="FontSize" Value="17"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Grid Height="54">
              <Border x:Name="Bg" CornerRadius="27" Background="{DynamicResource Accent}">
                <Border.Effect><DropShadowEffect BlurRadius="22" ShadowDepth="4" Opacity="0.4"/></Border.Effect>
              </Border>
              <Border CornerRadius="27" BorderThickness="1">
                <Border.Background>
                  <LinearGradientBrush StartPoint="0,0" EndPoint="0,1">
                    <GradientStop Color="#40FFFFFF" Offset="0"/>
                    <GradientStop Color="#00FFFFFF" Offset="0.6"/>
                  </LinearGradientBrush>
                </Border.Background>
                <Border.BorderBrush>
                  <LinearGradientBrush StartPoint="0,0" EndPoint="0,1">
                    <GradientStop Color="#80FFFFFF" Offset="0"/>
                    <GradientStop Color="#10FFFFFF" Offset="1"/>
                  </LinearGradientBrush>
                </Border.BorderBrush>
              </Border>
              <Border x:Name="Shade" CornerRadius="27" Background="#000000" Opacity="0"/>
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Grid>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="Bg" Property="Opacity" Value="0.92"/></Trigger>
              <Trigger Property="IsPressed" Value="True"><Setter TargetName="Shade" Property="Opacity" Value="0.15"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter Property="Opacity" Value="0.5"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="Link" TargetType="Button">
      <Setter Property="Foreground" Value="{DynamicResource Accent}"/>
      <Setter Property="FontSize" Value="14.5"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="B" Background="Transparent" CornerRadius="16" Padding="14,8"><ContentPresenter HorizontalAlignment="Center"/></Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="B" Property="Background" Value="#14FFFFFF"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter Property="Opacity" Value="0.4"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
  </Window.Resources>

  <Grid x:Name="Root" Background="#3A0E0F14" RenderTransformOrigin="0.5,0.5">
    <Grid.RenderTransform><ScaleTransform x:Name="RootScale" ScaleX="0.96" ScaleY="0.96"/></Grid.RenderTransform>

    <!-- цветное свечение за содержимым, как обои под стеклом -->
    <Ellipse x:Name="GlowA" Width="320" Height="320" HorizontalAlignment="Left" VerticalAlignment="Top" Margin="-140,-150,0,0" Opacity="0.55" IsHitTestVisible="False">
      <Ellipse.Fill>
        <RadialGradientBrush><GradientStop x:Name="GlowAColor" Color="#4C9AFF" Offset="0"/><GradientStop Color="#004C9AFF" Offset="1"/></RadialGradientBrush>
      </Ellipse.Fill>
    </Ellipse>
    <Ellipse x:Name="GlowB" Width="300" Height="300" HorizontalAlignment="Right" VerticalAlignment="Top" Margin="0,-120,-150,0" Opacity="0.4" IsHitTestVisible="False">
      <Ellipse.Fill>
        <RadialGradientBrush><GradientStop x:Name="GlowBColor" Color="#8E6BFF" Offset="0"/><GradientStop Color="#008E6BFF" Offset="1"/></RadialGradientBrush>
      </Ellipse.Fill>
    </Ellipse>

    <Grid Margin="26,20,26,24">
      <!-- основное содержимое -->
      <StackPanel x:Name="MainPanel">
        <Grid x:Name="DragArea" Background="Transparent">
          <Button x:Name="CloseBtn" HorizontalAlignment="Right" VerticalAlignment="Top" Width="32" Height="32" Cursor="Hand" Margin="0,-4,-10,0">
            <Button.Template>
              <ControlTemplate TargetType="Button">
                <Border x:Name="B" CornerRadius="16" Background="#1AFFFFFF" BorderBrush="{StaticResource Rim}" BorderThickness="1">
                  <TextBlock Text="✕" Foreground="#CCFFFFFF" FontSize="12" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                </Border>
                <ControlTemplate.Triggers>
                  <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="B" Property="Background" Value="#E0FF453A"/></Trigger>
                </ControlTemplate.Triggers>
              </ControlTemplate>
            </Button.Template>
          </Button>
          <StackPanel Orientation="Horizontal" Margin="0,8,0,0">
            <Border x:Name="AppIcon" Width="58" Height="58" CornerRadius="17" BorderBrush="{StaticResource Rim}" BorderThickness="1">
              <Border.Effect><DropShadowEffect BlurRadius="18" ShadowDepth="3" Opacity="0.4"/></Border.Effect>
              <Grid>
                <TextBlock Text="F" Foreground="White" FontSize="30" FontWeight="Bold" HorizontalAlignment="Center" VerticalAlignment="Center"/>
              </Grid>
            </Border>
            <StackPanel Margin="16,2,0,0" VerticalAlignment="Center">
              <StackPanel Orientation="Horizontal">
                <TextBlock Text="Floorp Modern" Foreground="{StaticResource Ink}" FontSize="26" FontWeight="Bold"/>
                <Border CornerRadius="9" Background="#1FFFFFFF" BorderBrush="{StaticResource Rim}" BorderThickness="1" Padding="8,2" Margin="10,0,0,0" VerticalAlignment="Center">
                  <TextBlock x:Name="VersionLabel" Foreground="{StaticResource Muted}" FontSize="12" FontWeight="SemiBold"/>
                </Border>
              </StackPanel>
              <TextBlock x:Name="Subtitle" Foreground="{StaticResource Muted}" FontSize="14" Margin="0,1,0,0"/>
            </StackPanel>
          </StackPanel>
        </Grid>

        <!-- живое превью темы -->
        <Grid Height="150" Margin="0,22,0,0">
          <Border x:Name="PrevOneUi" CornerRadius="22" Background="#000000" BorderBrush="#26FFFFFF" BorderThickness="1" ClipToBounds="True">
            <Grid Margin="12">
              <Grid.RowDefinitions><RowDefinition Height="30"/><RowDefinition Height="*"/></Grid.RowDefinitions>
              <StackPanel Orientation="Horizontal">
                <Ellipse Width="22" Height="22" Fill="#1F2022"/>
                <Ellipse Width="22" Height="22" Fill="#1F2022" Margin="6,0,0,0"/>
              </StackPanel>
              <Border Height="26" CornerRadius="13" Background="#1F2022" BorderBrush="{DynamicResource Accent}" BorderThickness="1.5" Margin="62,0,30,0" VerticalAlignment="Center" Opacity="0.95">
                <TextBlock Text="floorp.app" Foreground="#C8FFFFFF" FontSize="11.5" HorizontalAlignment="Center" VerticalAlignment="Center"/>
              </Border>
              <Ellipse Width="22" Height="22" Fill="#1F2022" HorizontalAlignment="Right"/>
              <Border Grid.Row="1" CornerRadius="16" Background="#0B0C12" Margin="0,8,0,0" ClipToBounds="True">
                <Grid>
                  <Ellipse Width="200" Height="140" HorizontalAlignment="Left" Margin="-40,-30,0,0" Opacity="0.75">
                    <Ellipse.Fill><RadialGradientBrush><GradientStop x:Name="PrevAccentStop" Color="#4C9AFF" Offset="0"/><GradientStop Color="#00000000" Offset="1"/></RadialGradientBrush></Ellipse.Fill>
                  </Ellipse>
                  <Ellipse Width="200" Height="140" HorizontalAlignment="Right" Margin="0,-10,-40,0" Opacity="0.6">
                    <Ellipse.Fill><RadialGradientBrush><GradientStop Color="#965AFF" Offset="0"/><GradientStop Color="#00000000" Offset="1"/></RadialGradientBrush></Ellipse.Fill>
                  </Ellipse>
                  <TextBlock Text="18:18" Foreground="White" FontSize="40" FontWeight="Light" HorizontalAlignment="Center" VerticalAlignment="Top" Margin="0,4,0,0"/>
                  <Border Width="180" Height="22" CornerRadius="11" Background="#E6161719" BorderBrush="#2AFFFFFF" BorderThickness="1" VerticalAlignment="Bottom" Margin="0,0,0,10"/>
                </Grid>
              </Border>
            </Grid>
          </Border>
          <Border x:Name="PrevIos" CornerRadius="22" BorderBrush="#40FFFFFF" BorderThickness="1" ClipToBounds="True" Visibility="Collapsed" Opacity="0">
            <Border.Background>
              <LinearGradientBrush StartPoint="0,0" EndPoint="1,1">
                <GradientStop Color="#2F7BFF" Offset="0"/>
                <GradientStop Color="#2A1C8C" Offset="0.45"/>
                <GradientStop Color="#7A3CC8" Offset="0.75"/>
                <GradientStop Color="#FF5C8C" Offset="1"/>
              </LinearGradientBrush>
            </Border.Background>
            <Grid Margin="12">
              <Grid.RowDefinitions><RowDefinition Height="32"/><RowDefinition Height="*"/></Grid.RowDefinitions>
              <Border CornerRadius="16" Background="#30FFFFFF" BorderBrush="{StaticResource Rim}" BorderThickness="1">
                <Grid>
                  <Ellipse Width="18" Height="18" Fill="#40FFFFFF" HorizontalAlignment="Left" Margin="8,0,0,0"/>
                  <Border Height="22" CornerRadius="11" Background="#26FFFFFF" BorderBrush="#664FA3FF" BorderThickness="1" Margin="34,0,34,0">
                    <TextBlock Text="floorp.app" Foreground="#E6FFFFFF" FontSize="11.5" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                  </Border>
                  <Ellipse Width="18" Height="18" Fill="#40FFFFFF" HorizontalAlignment="Right" Margin="0,0,8,0"/>
                </Grid>
              </Border>
              <Grid Grid.Row="1">
                <TextBlock Text="18:18" FontSize="46" FontWeight="Bold" HorizontalAlignment="Center" VerticalAlignment="Top" Margin="0,2,0,0">
                  <TextBlock.Foreground>
                    <LinearGradientBrush StartPoint="0,0" EndPoint="0,1">
                      <GradientStop Color="#F5FFFFFF" Offset="0"/>
                      <GradientStop Color="#99E1E8FF" Offset="1"/>
                    </LinearGradientBrush>
                  </TextBlock.Foreground>
                </TextBlock>
                <Border Width="190" Height="24" CornerRadius="12" Background="#26FFFFFF" BorderBrush="{StaticResource Rim}" BorderThickness="1" VerticalAlignment="Bottom" Margin="0,0,0,6"/>
              </Grid>
            </Grid>
          </Border>
        </Grid>

        <!-- тема -->
        <TextBlock x:Name="ThemeCaption" Style="{StaticResource Caption}"/>
        <Border x:Name="SegBox" Style="{StaticResource Cell}" CornerRadius="16" Padding="3">
          <Grid>
            <Border x:Name="SegThumb" CornerRadius="13" HorizontalAlignment="Left" Background="#2EFFFFFF" BorderBrush="{StaticResource Rim}" BorderThickness="1">
              <Border.RenderTransform><TranslateTransform x:Name="SegMove" X="0"/></Border.RenderTransform>
              <Border.Effect><DropShadowEffect BlurRadius="10" ShadowDepth="1" Opacity="0.3"/></Border.Effect>
            </Border>
            <UniformGrid Columns="2">
              <RadioButton x:Name="ThemeOneUi" Style="{StaticResource Segment}" GroupName="theme" Content="One UI" IsChecked="True"/>
              <RadioButton x:Name="ThemeIos" Style="{StaticResource Segment}" GroupName="theme" Content="iOS · Liquid Glass"/>
            </UniformGrid>
          </Grid>
        </Border>
        <TextBlock x:Name="ThemeHint" Foreground="{StaticResource Muted}" FontSize="13" Margin="18,9,18,0" TextWrapping="Wrap" MinHeight="36"/>

        <!-- браузеры -->
        <TextBlock x:Name="BrowsersCaption" Style="{StaticResource Caption}"/>
        <Border Style="{StaticResource Cell}">
          <StackPanel>
            <Grid Margin="18,12,14,12">
              <StackPanel VerticalAlignment="Center">
                <TextBlock Text="Floorp" Foreground="{StaticResource Ink}" FontSize="16" FontWeight="SemiBold"/>
                <TextBlock x:Name="FloorpPath" Foreground="{StaticResource Muted}" FontSize="12" TextTrimming="CharacterEllipsis" Margin="0,1,66,0"/>
              </StackPanel>
              <CheckBox x:Name="FloorpSwitch" Style="{StaticResource Switch}" HorizontalAlignment="Right" VerticalAlignment="Center"/>
            </Grid>
            <Border Height="1" Background="#1AFFFFFF" Margin="18,0,0,0"/>
            <Grid Margin="18,12,14,12">
              <StackPanel VerticalAlignment="Center">
                <TextBlock Text="Firefox" Foreground="{StaticResource Ink}" FontSize="16" FontWeight="SemiBold"/>
                <TextBlock x:Name="FirefoxPath" Foreground="{StaticResource Muted}" FontSize="12" TextTrimming="CharacterEllipsis" Margin="0,1,66,0"/>
              </StackPanel>
              <CheckBox x:Name="FirefoxSwitch" Style="{StaticResource Switch}" HorizontalAlignment="Right" VerticalAlignment="Center"/>
            </Grid>
          </StackPanel>
        </Border>

        <!-- дополнительно -->
        <TextBlock x:Name="ExtraCaption" Style="{StaticResource Caption}"/>
        <Border Style="{StaticResource Cell}">
          <Grid Margin="18,12,14,12">
            <StackPanel VerticalAlignment="Center">
              <TextBlock x:Name="PdfTitle" Foreground="{StaticResource Ink}" FontSize="16" FontWeight="SemiBold"/>
              <TextBlock x:Name="PdfHint" Foreground="{StaticResource Muted}" FontSize="12" TextWrapping="Wrap" Margin="0,1,66,0"/>
            </StackPanel>
            <CheckBox x:Name="PdfSwitch" Style="{StaticResource Switch}" HorizontalAlignment="Right" VerticalAlignment="Center" IsChecked="True"/>
          </Grid>
        </Border>

        <!-- журнал -->
        <Border x:Name="LogBox" Style="{StaticResource Cell}" Margin="0,18,0,0" Visibility="Collapsed" MaxHeight="140">
          <ScrollViewer VerticalScrollBarVisibility="Auto" Margin="16,10">
            <TextBlock x:Name="Log" Foreground="#D9FFFFFF" FontSize="12.5" TextWrapping="Wrap" FontFamily="Cascadia Mono, Consolas, Segoe UI"/>
          </ScrollViewer>
        </Border>

        <Button x:Name="InstallBtn" Style="{StaticResource Primary}" Margin="0,24,0,0"/>
        <Button x:Name="UninstallBtn" Style="{StaticResource Link}" Margin="0,8,0,0" HorizontalAlignment="Center"/>
      </StackPanel>

      <!-- экран «Готово» -->
      <Grid x:Name="DonePanel" Visibility="Collapsed" Opacity="0">
        <StackPanel VerticalAlignment="Center">
          <Grid Width="112" Height="112" RenderTransformOrigin="0.5,0.5">
            <Grid.RenderTransform><ScaleTransform x:Name="DoneScale" ScaleX="0.4" ScaleY="0.4"/></Grid.RenderTransform>
            <Ellipse Fill="#30D158">
              <Ellipse.Effect><DropShadowEffect BlurRadius="40" ShadowDepth="0" Opacity="0.7" Color="#30D158"/></Ellipse.Effect>
            </Ellipse>
            <Ellipse Stroke="#80FFFFFF" StrokeThickness="1.5">
              <Ellipse.Fill>
                <LinearGradientBrush StartPoint="0,0" EndPoint="0,1">
                  <GradientStop Color="#55FFFFFF" Offset="0"/>
                  <GradientStop Color="#00FFFFFF" Offset="0.6"/>
                </LinearGradientBrush>
              </Ellipse.Fill>
            </Ellipse>
            <Path Data="M 34,58 L 50,74 L 80,40" Stroke="White" StrokeThickness="9" StrokeStartLineCap="Round" StrokeEndLineCap="Round" StrokeLineJoin="Round"/>
          </Grid>
          <TextBlock x:Name="DoneTitle" Foreground="{StaticResource Ink}" FontSize="28" FontWeight="Bold" HorizontalAlignment="Center" Margin="0,26,0,0"/>
          <TextBlock x:Name="DoneText" Foreground="{StaticResource Muted}" FontSize="14.5" HorizontalAlignment="Center" TextAlignment="Center" TextWrapping="Wrap" Margin="20,8,20,0"/>
          <Button x:Name="DoneBtn" Style="{StaticResource Primary}" Margin="0,30,0,0"/>
          <Button x:Name="DoneLogBtn" Style="{StaticResource Link}" Margin="0,8,0,0" HorizontalAlignment="Center"/>
        </StackPanel>
      </Grid>
    </Grid>
  </Grid>
</Window>
'@
  $window = [Windows.Markup.XamlReader]::Parse($xaml)
  $script:GuiWindow = $window
  $get = { param($n) $window.FindName($n) }

  # ---------- настоящее стекло Windows 11 (акрил под окном) ----------
  $glass = $false
  try {
    if ([Environment]::OSVersion.Version.Build -ge 22621) {
      if (-not ("FloorpModern.Dwm" -as [type])) {
        Add-Type -Namespace FloorpModern -Name Dwm -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("dwmapi.dll")]
public static extern int DwmSetWindowAttribute(System.IntPtr hwnd, int attr, ref int value, int size);
'@
      }
      $hwnd = (New-Object System.Windows.Interop.WindowInteropHelper($window)).EnsureHandle()
      [System.Windows.Interop.HwndSource]::FromHwnd($hwnd).CompositionTarget.BackgroundColor = [Windows.Media.Colors]::Transparent
      $v = 1; [void][FloorpModern.Dwm]::DwmSetWindowAttribute($hwnd, 20, [ref]$v, 4)   # тёмная рамка
      $v = 2; [void][FloorpModern.Dwm]::DwmSetWindowAttribute($hwnd, 33, [ref]$v, 4)   # скруглённые углы
      $v = 3; $glass = ([FloorpModern.Dwm]::DwmSetWindowAttribute($hwnd, 38, [ref]$v, 4) -eq 0)  # акрил
    }
  } catch { $glass = $false }
  if (-not $glass) {
    # Windows 10 или старая сборка 11: плотный тёмный фон вместо стекла
    (& $get "Root").Background = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(0x12, 0x13, 0x17))
  }

  # ---------- тексты ----------
  (& $get "VersionLabel").Text = "v$Version"
  $window.Title = "Floorp Modern $Version"
  (& $get "Subtitle").Text = T "Новый вид для Floorp и Firefox" "A fresh look for Floorp and Firefox"
  (& $get "ThemeCaption").Text = T "ТЕМА" "THEME"
  (& $get "BrowsersCaption").Text = T "БРАУЗЕРЫ" "BROWSERS"
  (& $get "ExtraCaption").Text = T "ДОПОЛНИТЕЛЬНО" "EXTRAS"
  (& $get "PdfTitle").Text = T "Новый просмотрщик PDF" "New PDF viewer"
  (& $get "PdfHint").Text = T "Панель-«капсулы», тёмные и сепия-страницы, рисование как в Edge" "Pill toolbar, dark and sepia pages, Edge-style ink"
  (& $get "InstallBtn").Content = T "Установить" "Install"
  (& $get "UninstallBtn").Content = T "Удалить оформление" "Remove theme"
  (& $get "DoneBtn").Content = T "Закрыть" "Close"
  (& $get "DoneLogBtn").Content = T "Показать подробности" "Show details"

  # ---------- темы: акцент, иконка, свечение, превью ----------
  $winAccent = Get-WindowsAccent
  $hints = @{
    oneui = (T "Как Samsung Galaxy: чёрный фон, «таблетки», акцент из Windows, часы как на экране блокировки Galaxy, плашка музыки Now Bar." `
               "Samsung Galaxy style: pure black, pills, Windows accent, Galaxy lock-screen clock, Now Bar for music.")
    ios   = (T "Как iOS 26: жидкое стекло с бликами, обои под окном, иконки-квадраты, зелёные переключатели, стеклянные часы." `
               "iOS 26 style: Liquid Glass with highlights, wallpaper behind the window, square icons, green switches, glass clock.")
  }
  $hint = & $get "ThemeHint"
  $icon = & $get "AppIcon"
  $prevOne = & $get "PrevOneUi"; $prevIos = & $get "PrevIos"
  # ресурсы окна принимают любой object: PowerShell завернул бы кисть в PSObject,
  # и WPF её не узнал бы. Поэтому везде явное приведение к SolidColorBrush
  $brush = { param($c) [Windows.Media.SolidColorBrush]::new([Windows.Media.Color]$c) }
  $rgb = { param($r, $g, $b) [Windows.Media.Color]::FromRgb($r, $g, $b) }
  $ms = { param($n) New-Object System.Windows.Duration ([TimeSpan]::FromMilliseconds($n)) }
  $animate = {
    param($target, $prop, $to, $dur, $amp)
    $a = New-Object System.Windows.Media.Animation.DoubleAnimation
    $a.To = $to
    $a.Duration = & $ms $dur
    $e = New-Object System.Windows.Media.Animation.BackEase
    $e.EasingMode = "EaseOut"; $e.Amplitude = $amp
    $a.EasingFunction = $e
    $target.BeginAnimation($prop, $a)
  }
  $iconBrush = {
    param($c1, $c2, $c3)
    $g = New-Object Windows.Media.LinearGradientBrush
    $g.StartPoint = "0,0"; $g.EndPoint = "1,1"
    $g.GradientStops.Add((New-Object Windows.Media.GradientStop ($c1, 0)))
    $g.GradientStops.Add((New-Object Windows.Media.GradientStop ($c2, 0.55)))
    $g.GradientStops.Add((New-Object Windows.Media.GradientStop ($c3, 1)))
    $g
  }
  $applyTheme = {
    param($t)
    if ($t -eq "ios") {
      $acc = & $rgb 0x0A 0x84 0xFF
      $window.Resources["Accent"] = [Windows.Media.SolidColorBrush](& $brush $acc)
      $window.Resources["SwitchOn"] = [Windows.Media.SolidColorBrush](& $brush (& $rgb 0x30 0xD1 0x58))
      $icon.Background = & $iconBrush (& $rgb 0x5A 0xC8 0xFA) (& $rgb 0x0A 0x84 0xFF) (& $rgb 0x5E 0x5C 0xE6)
      (& $get "GlowAColor").Color = $acc
      (& $get "GlowBColor").Color = & $rgb 0xFF 0x37 0x5F
      $hint.Text = $hints.ios
      $show = $prevIos; $hide = $prevOne
    } else {
      $window.Resources["Accent"] = [Windows.Media.SolidColorBrush](& $brush $winAccent)
      $window.Resources["SwitchOn"] = [Windows.Media.SolidColorBrush](& $brush $winAccent)
      $icon.Background = & $iconBrush $winAccent (& $rgb 0x8E 0x6B 0xFF) (& $rgb 0xFF 0x5C 0x8A)
      (& $get "GlowAColor").Color = $winAccent
      (& $get "PrevAccentStop").Color = $winAccent
      (& $get "GlowBColor").Color = & $rgb 0x8E 0x6B 0xFF
      $hint.Text = $hints.oneui
      $show = $prevOne; $hide = $prevIos
    }
    $hide.Visibility = "Collapsed"; $hide.BeginAnimation([Windows.UIElement]::OpacityProperty, $null); $hide.Opacity = 0
    $show.Visibility = "Visible"
    $fade = New-Object System.Windows.Media.Animation.DoubleAnimation (0, 1, (& $ms 260))
    $show.BeginAnimation([Windows.UIElement]::OpacityProperty, $fade)
  }

  # подложка сегмента едет к выбранной теме
  $segBox = & $get "SegBox"; $thumb = & $get "SegThumb"; $segMove = & $get "SegMove"
  $oneui = & $get "ThemeOneUi"; $ios = & $get "ThemeIos"
  $segBox.Add_SizeChanged({
    $w = [math]::Max(0, ($segBox.ActualWidth - 8) / 2)
    $thumb.Width = $w
    $segMove.BeginAnimation([Windows.Media.TranslateTransform]::XProperty, $null)
    $segMove.X = $(if ($ios.IsChecked) { $w } else { 0 })
  })
  $oneui.Add_Checked({ & $animate $segMove ([Windows.Media.TranslateTransform]::XProperty) 0 380 0.35; & $applyTheme "oneui" })
  $ios.Add_Checked({ & $animate $segMove ([Windows.Media.TranslateTransform]::XProperty) $thumb.Width 380 0.35; & $applyTheme "ios" })
  & $applyTheme "oneui"

  foreach ($pair in @(@("floorp", "FloorpSwitch", "FloorpPath"), @("firefox", "FirefoxSwitch", "FirefoxPath"))) {
    $sw = & $get $pair[1]; $lbl = & $get $pair[2]
    if ($found.Contains($pair[0])) {
      $sw.IsChecked = $true; $lbl.Text = $found[$pair[0]]
    } else {
      $sw.IsChecked = $false; $sw.IsEnabled = $false; $lbl.Text = T "не установлен" "not installed"
    }
  }

  # появление окна
  $rootScale = & $get "RootScale"
  $window.Add_Loaded({
    & $animate $rootScale ([Windows.Media.ScaleTransform]::ScaleXProperty) 1 420 0.3
    & $animate $rootScale ([Windows.Media.ScaleTransform]::ScaleYProperty) 1 420 0.3
  })

  $script:GuiLog = & $get "Log"
  (& $get "DragArea").Add_MouseLeftButtonDown({ try { $window.DragMove() } catch {} })
  (& $get "CloseBtn").Add_Click({ $window.Close() })
  (& $get "DoneBtn").Add_Click({ $window.Close() })

  $showDone = {
    param($action)
    $main = & $get "MainPanel"; $done = & $get "DonePanel"
    (& $get "DoneTitle").Text = $(if ($action -eq "install") { T "Готово!" "All set!" } else { T "Оформление удалено" "Theme removed" })
    (& $get "DoneText").Text = $(if ($action -eq "install") { T "Откройте браузер — он уже в новом виде. Нажмите кнопку с луной на панели, чтобы сменить светлую и тёмную тему." "Open the browser — it already has the new look. Use the moon button on the toolbar to switch light and dark." } else { T "После перезапуска браузер выглядит как раньше." "The browser looks as before after a restart." })
    $done.MinHeight = $main.ActualHeight
    $main.Visibility = "Collapsed"
    $done.Visibility = "Visible"
    $done.BeginAnimation([Windows.UIElement]::OpacityProperty, (New-Object System.Windows.Media.Animation.DoubleAnimation (0, 1, (& $ms 300))))
    $ds = & $get "DoneScale"
    & $animate $ds ([Windows.Media.ScaleTransform]::ScaleXProperty) 1 600 0.6
    & $animate $ds ([Windows.Media.ScaleTransform]::ScaleYProperty) 1 600 0.6
  }
  (& $get "DoneLogBtn").Add_Click({
    (& $get "DonePanel").Visibility = "Collapsed"
    (& $get "MainPanel").Visibility = "Visible"
    (& $get "InstallBtn").Content = T "Закрыть" "Close"
  })

  $run = {
    param($action)
    if ($script:guiFinished) { $window.Close(); return }
    $keys = @()
    if ((& $get "FloorpSwitch").IsChecked) { $keys += "floorp" }
    if ((& $get "FirefoxSwitch").IsChecked) { $keys += "firefox" }
    if ($keys.Count -eq 0) {
      [System.Windows.MessageBox]::Show((T "Включите хотя бы один браузер." "Turn on at least one browser."), "Floorp Modern") | Out-Null
      return
    }
    $theme = if ((& $get "ThemeIos").IsChecked) { "ios" } else { "oneui" }
    $pdf = [bool](& $get "PdfSwitch").IsChecked
    (& $get "LogBox").Visibility = "Visible"
    $script:GuiLog.Text = ""
    $btn = & $get "InstallBtn"
    $btn.IsEnabled = $false; (& $get "UninstallBtn").IsEnabled = $false
    $btn.Content = $(if ($action -eq "install") { T "Устанавливаю…" "Installing…" } else { T "Удаляю…" "Removing…" })
    $ok = Invoke-Modern $action $keys $theme $pdf
    if ($ok) {
      $script:guiFinished = $true
      $btn.IsEnabled = $true
      & $showDone $action
    } else {
      Say ""
      Say (T "Что-то пошло не так — подробности выше." "Something went wrong — see above.")
      $btn.Content = T "Попробовать ещё раз" "Try again"
      $btn.IsEnabled = $true; (& $get "UninstallBtn").IsEnabled = $true
    }
  }
  $script:guiFinished = $false
  (& $get "InstallBtn").Add_Click({ & $run "install" })
  (& $get "UninstallBtn").Add_Click({ & $run "uninstall" })
  [void]$window.ShowDialog()
}

# ================================================================ запуск
if (-not $SkipAdmin -and -not (Test-Admin)) {
  $argList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"",
               "-Action", $Action, "-Target", $Target, "-Theme", $Theme, "-Pdf", $Pdf, "-UserAppData", "`"$UserAppData`"")
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
      [System.Windows.Forms.MessageBox]::Show((T "Окно установщика не открылось. Запустите install.cmd — он сделает то же самое в консоли.`n`n" "The setup window failed to open. Run install.cmd instead.`n`n") + $_.Exception.Message, "Floorp Modern") | Out-Null
    } catch {}
    exit 1
  }
  exit 0
}

# ---------------- консольный режим ----------------
Say ""
Say "Floorp Modern $Version" Cyan
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
if ($Action -eq "install" -and $Pdf -eq "ask") {
  $a = Read-Host (T "Поставить новый просмотрщик PDF (панель, темы страниц, рисование как в Edge)? [Д/н]" "Install the new PDF viewer (toolbar, page themes, Edge-style ink)? [Y/n]")
  $Pdf = if ($a -match '^[nNнН]') { "no" } else { "yes" }
}
$keys = if ($Target -eq "both") { @($found.Keys) } else { @($Target) }
$ok = Invoke-Modern $Action $keys $Theme ($Pdf -ne "no")
Say ""
if ($Action -eq "install") { Say (T "Готово! Откройте браузер." "Done! Start the browser.") Green }
else { Say (T "Готово. После перезапуска браузер выглядит как раньше." "Done. The browser looks as before after a restart.") Green }
if (-not $SkipAdmin) { Say ""; Read-Host (T "Нажмите Enter, чтобы закрыть окно" "Press Enter to close") | Out-Null }
if ($ok) { exit 0 } else { exit 1 }
