$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$root=Split-Path $PSScriptRoot -Parent
$out=Join-Path $root ('build/smoke-'+[guid]::NewGuid().ToString('N'))
$inputHash=(Get-FileHash -LiteralPath (Join-Path $root 'assets/demo-prism.png') -Algorithm SHA256).Hash.ToLowerInvariant()
foreach($style in @('english','french','spanish','german','japanese')){
    $png=Join-Path $out "$style.png"
    & "$PSScriptRoot/make-banner.ps1" -QuoteStyle $style -Out $png
    $recipe=Get-Content -LiteralPath ([System.IO.Path]::ChangeExtension($png,'.json')) -Raw | ConvertFrom-Json
    if($recipe.quoteStyle -ne $style -or $recipe.imageSha256 -ne $inputHash){throw 'Invalid recipe'}
    $image=[System.Drawing.Image]::FromFile($png)
    try{if($image.Width -ne 1500 -or $image.Height -ne 500){throw 'Invalid dimensions'}}finally{$image.Dispose()}
}
& "$PSScriptRoot/make-banner.ps1" -Batch -Out (Join-Path $out 'batch')
if(@(Get-ChildItem (Join-Path $out 'batch') -Filter '*.png').Count -ne 3){throw 'Batch output missing'}
$existing=Join-Path $out 'english.png'
$before=(Get-FileHash $existing).Hash
$refused=$false
try { & "$PSScriptRoot/make-banner.ps1" -Out $existing } catch { $refused=$true }
if(!$refused -or (Get-FileHash $existing).Hash -ne $before){throw 'Overwrite protection failed'}
Write-Output "PASS: quote styles, dimensions, recipes, batch and overwrite protection. Outputs: $out"
