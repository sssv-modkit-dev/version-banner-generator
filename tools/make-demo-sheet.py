"""Generate the original geometric sheet; Pillow is only needed to refresh it."""
from pathlib import Path
from math import sin, cos, pi
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
scale = 3
image = Image.new('RGBA', (720 * scale, 480 * scale))
draw = ImageDraw.Draw(image)

def polygon(points, fill):
    draw.polygon([(round(x*scale), round(y*scale)) for x,y in points], fill=fill)

def ellipse(box, fill, outline=None, width=1):
    draw.ellipse(tuple(round(v*scale) for v in box), fill=fill, outline=outline, width=width*scale)

prism = Image.open(root / 'assets/demo-prism.png').convert('RGBA')
prism.thumbnail((180*scale, 180*scale))
image.alpha_composite(prism, ((240*scale-prism.width)//2, (240*scale-prism.height)//2))
ellipse((290,55,430,185), '#6c412c', '#f1c58c', 8)
ellipse((312,77,408,163), '#dfa16b')
polygon([(266,150),(436,70),(450,84),(280,164)], '#ffe0a6')
polygon([(520,151),(514,65),(554,105),(600,48),(644,105),(685,65),(676,151),(656,178),(540,178)], '#567e60')
polygon([(540,151),(554,115),(600,73),(644,115),(656,151)], '#b4dda1')
polygon([(554,115),(600,73),(600,151),(540,151)], '#80b58b')
for i in range(7):
    x = 120+65*cos((i/12+.2)*2*pi)
    y = 360+65*sin((i/12+.2)*2*pi)
    ellipse((x-22,y-22,x+22,y+22), ['#f4c9ae','#e7a69a','#d98099','#c8759e','#ad72a7','#8d6eaa','#72699f'][i])
polygon([(360,282),(378,337),(429,360),(378,380),(360,438),(340,380),(292,360),(340,337)], '#b1d9ed')
polygon([(360,282),(360,360),(292,360),(340,337)], '#e5f3f2')
polygon([(360,360),(429,360),(378,380),(360,438)], '#5d8cba')
for i in range(6):
    a=i*pi/3; x=600+42*cos(a);y=360+42*sin(a)
    ellipse((x-30,y-30,x+30,y+30), '#9a8dc6', '#c5b6e4', 2)
ellipse((573,333,627,387), '#e1d4ea')
image.resize((720,480), Image.Resampling.LANCZOS).save(root / 'web/assets/demo-sheet.png')
print('Wrote web/assets/demo-sheet.png (six original geometric subjects)')
