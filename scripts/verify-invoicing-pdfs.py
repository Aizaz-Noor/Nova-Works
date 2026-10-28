from pathlib import Path
import json,re,math,sys
from pypdf import PdfReader
import pdfplumber
import pypdfium2 as pdfium
from PIL import Image,ImageDraw
folder=Path(sys.argv[1] if len(sys.argv)>1 else 'tmp/invoicing-browser');out=folder/'pdf-rendered';out.mkdir(parents=True,exist_ok=True)
required={
 'invoice.pdf':['INVOICE','INV-000001','10 Saved Street, Fictional City','USD 2938.68'],
 'credit.pdf':['CREDIT NOTE','CN-000001','Original invoice: INV-000001','Replace the original billing address','USD 2938.68'],
 'long-invoice.pdf':['INVOICE','INV-000003','Milestone 24:','USD 246.00']}
results=[];thumbs=[]
for name,phrases in required.items():
 path=folder/name;reader=PdfReader(path);text='\n'.join(page.extract_text() or '' for page in reader.pages);normalized=' '.join(re.sub(r'(?:INV|CN)-\d+ \| Page \d+ of \d+','',text).split())
 for phrase in phrases:assert phrase in normalized,(name,phrase)
 assert '\ufffd' not in text and '\x00' not in text,name
 if name=='long-invoice.pdf':
  assert len(reader.pages)>=3
  for page in reader.pages:
   page_text=' '.join((page.extract_text() or '').split())
   assert len(re.findall(r'Milestone \d+:',page_text))==page_text.count('Line subtotal USD 10.00'), 'Item amounts separated from descriptions'
  for number in range(1,25):assert f'Milestone {number}:' in normalized
  assert normalized.count('Each milestone includes documented scope, client review, and delivery acceptance.')==80
 with pdfplumber.open(path) as doc:
  for index,page in enumerate(doc.pages):
   for char in page.chars:
    assert char['x0']>=45 and char['x1']<=page.width-45,(name,index,'horizontal clipping',char['text'])
    assert char['top']>=35 and char['bottom']<=page.height-10,(name,index,'vertical clipping',char['text'])
 rendered=pdfium.PdfDocument(str(path))
 for index in range(len(rendered)):
  image=rendered[index].render(scale=1.25).to_pil().convert('RGB');image.save(out/f'{path.stem}-{index+1}.png');image.thumbnail((290,410));thumb=Image.new('RGB',(310,445),'#e8eaed');thumb.paste(image,((310-image.width)//2,25));ImageDraw.Draw(thumb).text((10,8),f'{path.stem} / {index+1}',fill='black');thumbs.append(thumb)
 results.append({'file':name,'pages':len(reader.pages),'requiredText':True,'allGlyphBoundsInsideMargins':True})
columns=3;sheet=Image.new('RGB',(columns*310,math.ceil(len(thumbs)/columns)*445),'#d4d7db')
for index,thumb in enumerate(thumbs):sheet.paste(thumb,((index%columns)*310,(index//columns)*445))
sheet.save(out/'contact-sheet.png');evidence={'result':'PASS','documents':results,'renderedPages':len(thumbs),'contactSheet':str(out/'contact-sheet.png')};(folder/'pdf-verification.json').write_text(json.dumps(evidence,indent=2),encoding='utf-8');print(json.dumps(evidence,indent=2))
