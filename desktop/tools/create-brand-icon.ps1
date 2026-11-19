Add-Type -AssemblyName System.Drawing
$iconDir = Join-Path $PSScriptRoot '../app/assets'
$bitmap = New-Object System.Drawing.Bitmap(256,256)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::FromArgb(20,16,35))
$violet = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(169,112,255))
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(236,231,255))
function DrawPolygon($brush, $coords) { $points = @(); for($i=0;$i -lt $coords.Length;$i+=2){$points += New-Object System.Drawing.PointF($coords[$i],$coords[$i+1])}; $graphics.FillPolygon($brush,[System.Drawing.PointF[]]$points) }
DrawPolygon $violet @(44,35,157,35,187,80,155,139,105,139,146,205,94,205,48,133,20,205,0,205)
DrawPolygon $white @(159,35,222,35,256,79,219,145,159,145,180,109,204,109,223,79,180,79)
$png = Join-Path $iconDir 'icon.png'
$bitmap.Save($png,[System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose();$bitmap.Dispose();$bytes=[System.IO.File]::ReadAllBytes($png)
$ico=Join-Path $iconDir 'icon.ico';$stream=[System.IO.File]::Create($ico);$writer=New-Object System.IO.BinaryWriter($stream)
$writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]1)
$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([byte]0)
$writer.Write([uint16]1);$writer.Write([uint16]32);$writer.Write([uint32]$bytes.Length);$writer.Write([uint32]22);$writer.Write($bytes)
$writer.Close()
