// Reading structure only: stored report content and cited business snapshots remain unchanged.
export function parseReportDocument(content='') {
 const lines=content.replace(/\r\n?/g,'\n').split('\n'),blocks=[];
 let paragraph=[],headingCount=0,itemSection=false;
 const flush=()=>{if(paragraph.length){blocks.push({type:'paragraph',text:paragraph.join('\n')});paragraph=[]}};
 const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(value=>value.trim().replace(/&#124;|&#10;|&#13;|&amp;/g,entity=>({'&#124;':'|','&#10;':'\n','&#13;':'\r','&amp;':'&'})[entity]));
 const itemRow=line=>{const row=line.split(' · ');return row.length===3&&row.every(value=>value.trim())?row.map(value=>value.trim()):null};
 for(let i=0;i<lines.length;i++){
  const line=lines[i],trim=line.trim(),markdown=trim.match(/^(#{1,6})\s+(.+)$/),chinese=/^[一二三四五六七八九十百]+[、．.]\s*\S/.test(trim);
  if(!trim){flush();continue}
  if(markdown||chinese){flush();const text=markdown?markdown[2]:trim;itemSection=/^(?:[一二三四五六七八九十百]+[、．.]\s*)?事项进展$/.test(text);blocks.push({type:'heading',text,level:markdown?Math.max(2,Math.min(4,markdown[1].length)):2,id:'report-section-'+(++headingCount)});continue}
  if(trim.includes('|')&&lines[i+1]?.includes('|')){
   const headers=cells(line),separator=cells(lines[i+1]),rows=[];let end=i+2;
   if(headers.length>1&&separator.length===headers.length&&separator.every(value=>/^:?-{3,}:?$/.test(value))){
    while(end<lines.length&&lines[end].trim().includes('|')){const row=cells(lines[end]);if(row.length!==headers.length)break;rows.push(row);end++}
    if(rows.length){flush();blocks.push({type:'table',headers,rows});i=end-1;continue}
   }
  }
  if(itemSection&&itemRow(line)){
   flush();const rows=[];while(i<lines.length&&itemRow(lines[i]))rows.push(itemRow(lines[i++]));i--;
   blocks.push({type:'table',headers:['事项','状态','责任'],rows});continue;
  }
  paragraph.push(line);
 }
 flush();return blocks;
}
export function formatReportDate(value){
 if(!value)return '时间未记录';
 const date=new Date(value);if(Number.isNaN(date.getTime()))return String(value);
 const parts=Object.fromEntries(new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(part=>[part.type,part.value]));
 return `${parts.year}年${parts.month}月${parts.day}日 ${parts.hour}:${parts.minute}`;
}
export function formatReportText(value){
 return value.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/g,date=>formatReportDate(date)+'（北京时间）');
}
export function renderReportDocument(content,scrollContainer){
 const body=document.createElement('div');body.className='report-content structured-report';
 const navigation=document.createElement('nav');navigation.className='report-toc';navigation.setAttribute('aria-label','报告目录');
 const label=document.createElement('h2');label.textContent='本文目录';navigation.append(label);
 const blocks=parseReportDocument(content);let section=body;
 for(const block of blocks){
  if(block.type==='heading'){
   section=document.createElement('section');section.id=block.id;
   const title=document.createElement('h'+block.level);title.textContent=block.text;title.tabIndex=-1;section.append(title);body.append(section);
   const link=document.createElement('a');link.href='#'+block.id;link.textContent=block.text;link.className='toc-level-'+block.level;
   link.onclick=event=>{event.preventDefault();if(!title.isConnected)return;scrollContainer.scrollTop+=title.getBoundingClientRect().top-scrollContainer.getBoundingClientRect().top-20;title.focus({preventScroll:true})};navigation.append(link);
  }else if(block.type==='table'){
   const wrap=document.createElement('div');wrap.className='report-table-wrap';wrap.tabIndex=0;wrap.setAttribute('aria-label','报告数据表，可横向滚动');
   const table=document.createElement('table'),head=document.createElement('thead'),header=document.createElement('tr'),rows=document.createElement('tbody');
   for(const value of block.headers){const cell=document.createElement('th');cell.scope='col';cell.textContent=value;header.append(cell)}head.append(header);
   for(const values of block.rows){const row=document.createElement('tr');for(const value of values){const cell=document.createElement('td');cell.textContent=formatReportText(value);row.append(cell)}rows.append(row)}
   table.append(head,rows);wrap.append(table);section.append(wrap);
  }else{const paragraph=document.createElement('p');paragraph.textContent=formatReportText(block.text);section.append(paragraph)}
 }
 if(!blocks.some(block=>block.type==='heading')){const message=document.createElement('p');message.textContent='本版本为连续正文';navigation.append(message)}
 return {body,navigation};
}
