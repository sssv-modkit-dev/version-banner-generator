"""Draw six original, transparent character sprites. Pillow is only needed to refresh the demo."""
from pathlib import Path
from math import sin, cos, pi
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
S = 3
image = Image.new("RGBA", (720*S, 480*S))
draw = ImageDraw.Draw(image)
ink = "#172936"

def poly(points, colour, outline=ink, width=4):
    points = [(round(x*S), round(y*S)) for x,y in points]
    draw.polygon(points, fill=colour)
    if outline: draw.line(points+[points[0]], fill=outline, width=width*S, joint="curve")

def oval(box, colour, outline=ink, width=4):
    draw.ellipse(tuple(round(v*S) for v in box), fill=colour, outline=outline, width=width*S)

def line(points, colour=ink, width=4):
    draw.line([(round(x*S),round(y*S)) for x,y in points], fill=colour, width=width*S, joint="curve")

def eyes(x,y,gap=21):
    for ex in [x-gap/2,x+gap/2]:
        oval((ex-6,y-9,ex+6,y+9), "#fff9e6", None)
        oval((ex-3,y-4,ex+3,y+5), ink, None)
    line([(x-7,y+20),(x,y+24),(x+7,y+20)], ink, 3)

# A little gemstone with oversized boots.
oval((65,177,111,204), "#529bc5"); oval((126,177,172,204), "#529bc5")
poly([(118,35),(183,92),(160,165),(118,187),(61,154),(48,93)], "#7ed9f1")
poly([(118,35),(118,106),(48,93)], "#d8faff", None)
poly([(118,106),(183,92),(160,165),(118,187)], "#3c7baf", None)
line([(48,93),(118,106),(183,92)], "#326886", 3)
eyes(116,121,34)
poly([(63,46),(67,31),(72,47),(85,52),(72,57),(68,71),(63,57),(50,52)], "#fff3a4", None)
# A round, single-wheel space explorer.
line([(360,53),(360,30)],ink,5); oval((351,20,369,38),"#ffdb74")
line([(303,105),(277,135),(292,150)],ink,10); line([(419,105),(441,132),(429,149)],ink,10)
oval((296,53,424,181),"#ffad61")
oval((310,76,409,147),"#273b50")
oval((319,86,340,125),"#a7e8e7",None); oval((367,86,388,125),"#a7e8e7",None)
line([(332,138),(354,145),(378,138)],"#ffe9ac",3)
oval((336,165,384,210),"#3c5162"); oval((349,177,371,199),"#f9ca6e",None)
# A leafy cat with a plant-pot body.
poly([(546,117),(545,45),(580,70),(615,48),(653,72),(672,43),(670,123),(645,160),(572,160)],"#86d399")
poly([(557,66),(558,97),(576,80)],"#eaf2ba",None); poly([(651,83),(660,66),(658,103)],"#eaf2ba",None)
eyes(608,111,36)
poly([(563,161),(654,161),(641,204),(576,204)],"#f8b684")
line([(575,173),(642,173)],"#c56f58",3)
# A candy-coloured caterpillar. All segments touch so auto-cuts keep it together.
for i in range(5):
    x=52+i*30; y=383-32*sin(i*pi/4)
    oval((x-24,y-26,x+27,y+26),["#a882d6","#c58bdc","#e18dbf","#f2a1b9","#ffc7ae"][i])
for x in [52,87,120,154,181]: oval((x-8,400,x+8,413),ink,None)
eyes(177,367,22); line([(170,338),(162,324)],ink,3); line([(183,337),(188,320)],ink,3)
# A shy star-shaped ghost.
poly([(360,275),(384,321),(433,337),(402,367),(414,421),(360,399),(306,421),(317,368),(287,337),(337,320)],"#c7eff4")
poly([(360,275),(360,344),(287,337),(337,320)],"#f5fff4",None)
poly([(360,344),(402,367),(414,421),(360,399)],"#6ea9ca",None)
eyes(360,351,28)
# A flower with a mischievous face.
line([(599,373),(599,425)],ink,9)
poly([(596,406),(569,384),(556,399),(580,417)],"#8ed8a5")
poly([(603,406),(627,384),(644,397),(620,416)],"#8ed8a5")
for i in range(7):
    a=i*2*pi/7; x=600+42*cos(a); y=338+42*sin(a)
    oval((x-28,y-28,x+28,y+28),["#b195ee","#b7a4f7","#c1a7ed","#d0a5e6","#d5a7df","#ba9ee9","#a08adb"][i])
oval((561,300,639,379),"#ffe59b"); eyes(600,335,28)
image.resize((720,480), Image.Resampling.LANCZOS).save(root/"web/assets/demo-sheet.png")
print("Wrote six original character sprites to web/assets/demo-sheet.png")
