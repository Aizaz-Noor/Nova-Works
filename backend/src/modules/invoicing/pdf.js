import PDFDocument from 'pdfkit';
import {ApiError} from '../../middleware/errorHandler.js';
const money=(minor,currency)=>{const value=BigInt(minor);return`${currency} ${value/100n}.${String(value%100n).padStart(2,'0')}`;};
const rate=bps=>`${Math.floor(bps/100)}.${String(bps%100).padStart(2,'0')}%`;
export function invoicePdf(invoice,credit=null){
 if(invoice.status!=='ISSUED')throw new ApiError(409,'INVOICE_DRAFT','Only issued documents can be exported');
 const strings=[invoice.title,invoice.terms,invoice.issuer_name,invoice.issuer_address,invoice.customer_name,invoice.customer_email,invoice.customer_address,invoice.payment_instructions,...invoice.items.map(item=>item.description),...(credit?[credit.reason]:[])];
 if(strings.some(value=>/[^\x09\x0a\x0d\x20-\x7e]/.test(value)))throw new ApiError(422,'PDF_TEXT_UNSUPPORTED','This initial PDF export supports basic Latin text. Your full saved text remains available in the online invoice.');
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:'A4',margin:48,bufferPages:true,info:{Title:`${credit?'Credit note':'Invoice'} ${credit?.number||invoice.number}`,Author:invoice.issuer_name}}),chunks=[];
  doc.on('data',chunk=>chunks.push(chunk));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
  const ensure=height=>{if(doc.y+height>doc.page.height-doc.page.margins.bottom)doc.addPage();};
  const paragraph=(value,size=10.5,bold=false)=>{doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(size).fillColor('#17212b').text(value,{width:doc.page.width-96,lineGap:3});doc.moveDown(0.5);};
  const block=(heading,value)=>{ensure(60);paragraph(heading,10,true);paragraph(value||'Not provided');};
  try{
   paragraph(credit?'CREDIT NOTE':'INVOICE',24,true);paragraph(credit?.number||invoice.number,15,true);paragraph(`Issued: ${credit?.issued_on||invoice.issued_on}${credit?` | Original invoice: ${invoice.number}`:` | Due: ${invoice.due_on||'Not specified'}`}`);
   block('From',`${invoice.issuer_name}\n${invoice.issuer_address||'Address not provided'}`);block('Bill to',`${invoice.customer_name}\n${invoice.customer_email||''}\n${invoice.customer_address||'Address not provided'}`);block('Scope',invoice.title);
   if(invoice.source_kind==='TIME')paragraph('Billing source: approved time. No tax configured.',10.5);if(credit)block('Reason for full credit',credit.reason);
   ensure(80);paragraph(credit?'Items fully credited':'Invoice items',13,true);
   for(const item of invoice.items){
    const allocation=invoice.timeAllocations?.find(line=>line.position===item.position);const description=invoice.source_kind==='TIME'?`${allocation?.minutes} minutes | Hourly rate ${money(allocation?.hourly_minor||'0',invoice.currency)} | Work date ${allocation?.work_date} | No tax configured`:`Quantity ${item.quantity} | Unit ${money(item.unit_minor,invoice.currency)} | Tax ${rate(item.tax_rate_bps)}`;const lines=[{text:`${item.position}. ${item.description}`,size:11,bold:true},{text:description,size:10.5},{text:`Line subtotal ${money(item.subtotal_minor,invoice.currency)} | Tax ${money(item.tax_minor,invoice.currency)} | Total ${money(item.total_minor,invoice.currency)}`,size:10.5}];
    const height=lines.reduce((sum,line)=>{doc.font(line.bold?'Helvetica-Bold':'Helvetica').fontSize(line.size);return sum+doc.heightOfString(line.text,{width:doc.page.width-96,lineGap:3})+doc.currentLineHeight(true)*0.5;},4);
    ensure(Math.min(height,doc.page.height-doc.page.margins.top-doc.page.margins.bottom));
    for(const line of lines)paragraph(line.text,line.size,line.bold);
   }
   ensure(110);paragraph(`Subtotal: ${money(invoice.subtotal_minor,invoice.currency)}`,12);paragraph(`Tax: ${money(invoice.tax_minor,invoice.currency)}`,12);paragraph(`${credit?'Full credit total':'Invoice total'}: ${money(invoice.total_minor,invoice.currency)}`,15,true);
   if(credit)paragraph(`This full credit cancels the amount billed on ${invoice.number}.`);else{block('Agreed terms',invoice.terms);block('Payment instructions',invoice.payment_instructions);}
   const range=doc.bufferedPageRange();for(let index=range.start;index<range.start+range.count;index++){doc.switchToPage(index);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.font('Helvetica').fontSize(8).fillColor('#52606d').text(`${credit?.number||invoice.number} | Page ${index+1} of ${range.count}`,48,doc.page.height-28,{width:doc.page.width-96,lineBreak:false});doc.page.margins.bottom=bottom;}
   doc.end();
  }catch(error){doc.destroy();reject(error);}
 });
}
