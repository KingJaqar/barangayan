from pathlib import Path
import zipfile, xml.etree.ElementTree as ET, io
from PIL import Image, ImageOps, ImageDraw
p=Path(r'C:\Users\User\AppData\Local\Packages\openai.codex_2p2nqsd0c76g0\AC\#!sandbox.{0c86b10e-b58e-4197-b7c5-554dbe54d332}\Temp\browser-use\exports\ALCANTARA_ARROJADO_ENZON_MUEGA_DELOSREYES_Chapter1to3(revised)-842b1b30-dba4-40cb-826f-66bb44ffca6a.docx')
z=zipfile.ZipFile(p)
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
rels={e.get('Id'):e.get('Target') for e in ET.fromstring(z.read('word/_rels/document.xml.rels'))}
root=ET.fromstring(z.read('word/document.xml'))
items=[]; active=False
for el in root.iter():
 if el.tag=='{'+ns['w']+'}t' and el.text and el.text.strip()=='Appendix D': active=True; items=[]
 if active and el.tag=='{'+ns['a']+'}blip':
  rid=el.get('{'+ns['r']+'}embed')
  if rid: items.append(rels[rid])
out=Path('appendix_review'); out.mkdir(exist_ok=True)
for batch in range(0,len(items),12):
 canvas=Image.new('RGB',(1600,1200),'#dddddd'); d=ImageDraw.Draw(canvas)
 for j,target in enumerate(items[batch:batch+12]):
  im=Image.open(io.BytesIO(z.read('word/'+target))).convert('RGB'); im.thumbnail((390,370))
  x=(j%4)*400; y=(j//4)*400
  canvas.paste(im,(x+(400-im.width)//2,y+25)); d.text((x+10,y+5),str(batch+j+1),fill='black')
 canvas.save(out/f'sheet{batch//12}.jpg')
print('Images',len(items),'Sheets',len(list(out.glob('*.jpg'))))
