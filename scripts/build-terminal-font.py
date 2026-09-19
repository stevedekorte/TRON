"""Build the local COLRv0 terminal font. Requires fonttools and skia-pathops.
The source outline is retained as a monochrome fallback. Color layers divide
its 80-unit pixel rows into bright faces and 15-unit, 68%-brightness bands.
"""
from pathlib import Path
import math
import pathops
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.colorLib.builder import buildCOLR, buildCPAL

font=TTFont('public/fonts/VT323-Regular.ttf')
glyphs=font.getGlyphSet()
order=font.getGlyphOrder()[:]
layers={}
for name in order[:]:
    outline=pathops.Path()
    glyphs[name].draw(outline.getPen(glyphs))
    if not len(outline):
        continue
    x0,y0,x1,y1=outline.bounds
    stripes=pathops.Path()
    for row in range(math.floor(y0/80),math.ceil(y1/80)+1):
        y=row*80
        stripes.moveTo(x0-1,y);stripes.lineTo(x1+1,y)
        stripes.lineTo(x1+1,y+15);stripes.lineTo(x0-1,y+15);stripes.close()
    dark=pathops.op(outline,stripes,pathops.PathOp.INTERSECTION)
    bright=pathops.op(outline,stripes,pathops.PathOp.DIFFERENCE)
    layers[name]=[]
    for suffix,path,index in [('bright',bright,0),('raster',dark,1)]:
        layer=name+'.'+suffix
        pen=TTGlyphPen(None);path.draw(Cu2QuPen(pen,1))
        font['glyf'][layer]=pen.glyph()
        font['hmtx'][layer]=font['hmtx'][name]
        order.append(layer);layers[name].append((layer,index))
font.setGlyphOrder(order)
font['COLR']=buildCOLR(layers,version=0,glyphMap=font.getReverseGlyphMap())
def palette(rgb):
    return [tuple(c/255 for c in rgb)+(1,),tuple(c*.68/255 for c in rgb)+(1,)]
font['CPAL']=buildCPAL([palette((21,157,221)),palette((255,48,37))])
# Modified font has a distinct family/name; retain original copyright/license.
for record in font['name'].names:
    names={1:'Interface Raster',2:'Regular',3:'Interface Raster Regular 1.0',4:'Interface Raster Regular',6:'InterfaceRaster-Regular',16:'Interface Raster',17:'Regular'}
    if record.nameID in names:
        record.string=names[record.nameID].encode(record.getEncoding())
font['name'].setName('Raster color layers added for the TRON fan tribute. Based on VT323 by Peter Hull; SIL OFL 1.1.',10,3,1,0x409)
out=Path('public/fonts/InterfaceRaster-Regular.ttf')
font.save(out)
check=TTFont(out)
assert check['COLR'].version==0
assert len(check['CPAL'].palettes)==2
print(f'{out}: {len(layers)} raster glyphs, {out.stat().st_size} bytes')
