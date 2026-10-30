param(
    [string]$Project = 'MY MODKIT',
    [string]$Name = '',
    [string]$ImagePath = '',
    [string]$Version = 'CONCEPT',
    [string]$Out = '',
    [ValidateSet('blue', 'orange', 'green')][string]$Palette = 'blue',
    [ValidateSet('random', 'english', 'french', 'spanish', 'german', 'japanese')][string]$QuoteStyle = 'random',
    [switch]$Batch
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
if (!$ImagePath) { $ImagePath = Join-Path $root 'assets/demo-prism.png' }
if (!(Test-Path -LiteralPath $ImagePath -PathType Leaf)) { throw 'ImagePath must point to a local PNG render' }
if ($Batch) {
    if (!$Out) { $Out = Join-Path $root 'build/future-banners' }
    foreach ($choice in @('blue', 'orange', 'green')) {
        & $PSCommandPath -Palette $choice -QuoteStyle $QuoteStyle -Project $Project -ImagePath $ImagePath -Version 'FUTURE CONCEPT' -Out (Join-Path $Out "$choice-banner.png")
    }
    return
}
$presets = @{
    blue = @('Ceruleanish Facet Prism', '#8dc4ed')
    orange = @('Amberish Facet Prism', '#efb16b')
    green = @('Jadeish Facet Prism', '#91cbb1')
}
if (!$Name) { $Name = $presets[$Palette][0] }
$quotes = @{
    english = @([string][char]0x201C, [string][char]0x201D)
    french = @(([string][char]0x00AB + [char]0x202F), ([string][char]0x202F + [char]0x00BB))
    spanish = @([string][char]0x00AB, [string][char]0x00BB)
    german = @([string][char]0x201E, [string][char]0x201C)
    japanese = @([string][char]0x300C, [string][char]0x300D)
}
if ($QuoteStyle -eq 'random') { $QuoteStyle = Get-Random -InputObject @('english', 'french', 'spanish', 'german', 'japanese') }
if (!$Out) { $Out = Join-Path $root 'build/release-banner.png' }
$Out = [System.IO.Path]::GetFullPath($Out)
if (Test-Path -LiteralPath $Out) { throw "Output exists; choose a new -Out path: $Out" }
$metadataPath = [System.IO.Path]::ChangeExtension($Out, '.json')
if (Test-Path -LiteralPath $metadataPath) { throw "Output metadata exists: $metadataPath" }
$bitmap = New-Object System.Drawing.Bitmap 1500,500
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$head = [System.Drawing.Image]::FromFile([System.IO.Path]::GetFullPath($ImagePath))
$resources = [System.Collections.Generic.List[System.IDisposable]]::new()
try {
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#111b29'))
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    function Brush($hex) {
        $b = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($hex))
        $resources.Add($b)
        return $b
    }
    function Font($size, $style, $family = 'Segoe UI') {
        $f = [System.Drawing.Font]::new($family, [single]$size, $style, [System.Drawing.GraphicsUnit]::Pixel)
        $resources.Add($f)
        return $f
    }
    $accent = Brush $presets[$Palette][1]
    $muted = Brush '#9ba9b9'
    $rule = Brush '#26384b'
    $small = Font 21 ([System.Drawing.FontStyle]::Regular)
    $graphics.FillRectangle($accent, 70, 76, 32, 3)
    if ($graphics.MeasureString($Project, $small).Width -gt 890) { throw 'Project name is too long for the layout' }
    $graphics.DrawString($Project, $small, $accent, 70, 100)
    $graphics.FillRectangle($rule, 70, 382, 890, 1)
    $graphics.FillRectangle($accent, 70, 382, 64, 2)
    $size = 60
    $caption = $quotes[$QuoteStyle][0] + $Name + $quotes[$QuoteStyle][1] + ' edition'
    $format = [System.Drawing.StringFormat]::GenericTypographic
    $resources.Add($format)
    do {
        $title = Font $size ([System.Drawing.FontStyle]::Italic) 'Segoe UI Semibold'
        if ($graphics.MeasureString($caption, $title, 2000, $format).Width -le 890) { break }
        $size--
    } while ($size -gt 12)
    if ($graphics.MeasureString($caption, $title, 2000, $format).Width -gt 890) { throw 'Release title is too long for the layout' }
    $graphics.DrawString($caption, $title, $accent, [System.Drawing.PointF]::new(70, 205), $format)
    $graphics.DrawString($Version, $small, $muted, 70, 315)
    $scale = [Math]::Min(340 / $head.Width, 340 / $head.Height)
    $rect = [System.Drawing.RectangleF]::new(1230 - $head.Width*$scale/2, 250 - $head.Height*$scale/2, $head.Width*$scale, $head.Height*$scale)
    $graphics.DrawImage($head, $rect)
    [System.IO.Directory]::CreateDirectory((Split-Path $Out -Parent)) | Out-Null
    $bitmap.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "Banner saved: $Out"
    Write-Output "Quotation style: $QuoteStyle"
    $metadata = [ordered]@{
        format = 'version-banner-generator-v1'
        project = $Project; name = $Name; version = $Version
        palette = $Palette; accent = $presets[$Palette][1]; quoteStyle = $QuoteStyle
        caption = $caption; width = 1500; height = 500
        image = [System.IO.Path]::GetFileName($ImagePath)
        imageSha256 = (Get-FileHash -LiteralPath $ImagePath -Algorithm SHA256).Hash.ToLowerInvariant()
        titleFont = $title.FontFamily.Name; titleSize = $size; titleStyle = 'semibold italic'
    }
    $metadata | ConvertTo-Json | Set-Content -LiteralPath $metadataPath -Encoding UTF8
    Write-Output "Recipe saved: $metadataPath"
} finally {
    foreach ($resource in $resources) { $resource.Dispose() }
    $head.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
