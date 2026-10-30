# Original geometric sample, not a game asset. Recreate with Windows PowerShell.
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$out=Join-Path (Split-Path $PSScriptRoot -Parent) 'assets/demo-prism.png'
if (Test-Path -LiteralPath $out) { throw 'Demo already exists; preserve it or choose a separate output.' }
$image=[System.Drawing.Bitmap]::new(512,512)
$g=[System.Drawing.Graphics]::FromImage($image)
$g.Clear([System.Drawing.Color]::Transparent)
$g.SmoothingMode='AntiAlias'
$facets=@(
    @{color='#8dc4ed';points=@(256,38,65,181,256,266)},
    @{color='#5998c6';points=@(256,38,447,181,256,266)},
    @{color='#315775';points=@(65,181,256,266,256,474)},
    @{color='#467da4';points=@(447,181,256,266,256,474)}
)
try {
    foreach($facet in $facets){
        $points=[System.Drawing.PointF[]]@(for($i=0;$i -lt 6;$i+=2){[System.Drawing.PointF]::new($facet.points[$i],$facet.points[$i+1])})
        $brush=[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($facet.color))
        try{$g.FillPolygon($brush,$points)}finally{$brush.Dispose()}
    }
    $image.Save($out,[System.Drawing.Imaging.ImageFormat]::Png)
} finally {$g.Dispose();$image.Dispose()}
Write-Output $out
