(function(){
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el};
 const focusTitles={verify:'核查重点',verify_feedback:'等待核查反馈',decision:'决策重点',assign:'安排前核对',feedback:'跟进重点',review:'复核重点',closed:'结束记录核对'};
 let scenes={},dialog,sequence=0;
 function formatTime(value){
  if(!value)return '时间未登记';if(!String(value).includes('T'))return String(value);
  const match=String(value).match(/\d{4}-\d{2}-\d{2}T[0-9:.+-]+(?:Z)?/),date=new Date(match?match[0]:value);if(Number.isNaN(date.getTime()))return String(value);
  return (match?String(value).slice(0,match.index):'')+new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
 }
 function person(text,ai=false){const line=node('span','','record-person');line.innerHTML=ai?'<img src="assets/scenic-ip.png" alt="小岚" width="22" height="22">':'<svg class="icon" aria-hidden="true"><use href="#user"/></svg>';line.append(document.createTextNode(text));return line}
 function enlarge(item,spec,trigger){
  if(!dialog){dialog=node('dialog','','stage-material-dialog');dialog.id='stage-image-dialog';dialog.setAttribute('aria-label','图片查看器');document.body.append(dialog)}
  dialog.replaceChildren();const header=node('div','','stage-material-dialog-heading'),close=node('button','×','stage-material-close');close.type='button';close.setAttribute('aria-label','关闭图片');close.onclick=()=>dialog.close();header.append(node('h2',spec.title),close);
  const image=node('img','','stage-large-image');image.src=spec.url||'assets/'+spec.image;image.alt=spec.title;image.onerror=()=>image.replaceWith(node('p','图片无法加载，请稍后重试。'));
  dialog.append(header,image,node('p',spec.url?'已保存的反馈材料':'场景参考 · 非现场影像','stage-media-note'));
  const scrolls=[...document.querySelectorAll('.tracking-detail,.archive-drawer')].map(el=>[el,el.scrollTop]);
  dialog.onclose=()=>{for(const [el,top] of scrolls)el.scrollTop=top;if(trigger.isConnected)trigger.focus({preventScroll:true})};dialog.showModal();
 }
 function savedFiles(host,attachments){
  if(!attachments?.length)return;
  const gallery=node('div','','stage-saved-files');
  for(const file of attachments){
   if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(file.url||''))continue;
   const figure=node('figure'),img=node('img');img.src=file.url;img.alt=file.name;img.onerror=()=>img.replaceWith(node('p','图片暂不可用'));
   const open=node('button','放大查看');open.type='button';open.onclick=()=>enlarge(null,{title:file.name,url:file.url},open);
   figure.append(img,node('figcaption',file.name),open);gallery.append(figure);
  }host.append(gallery);
 }
 function trend(spec,cutoff){
  const values=spec.values.map((value,i)=>({value,time:spec.times[i]})).filter(row=>!cutoff||row.time<=cutoff);
  if(values.length<2)return null;
  const section=node('section','','stage-trend');section.append(node('h3',spec.trend));
  const latest=values.at(-1).value,peak=Math.max(...values.map(row=>row.value)),first=values[0].value;
  const metric=node('div','','stage-metric');metric.append(node('strong',String(latest)),node('span',spec.unit+'排队'));section.append(metric);
  const change=latest<peak?'较峰值减少 '+(peak-latest)+' '+spec.unit:latest>first?'较 '+values[0].time+' 增加 '+(latest-first)+' '+spec.unit:'与 '+values[0].time+' 持平';
  section.append(node('p',change,'stage-change'));
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 360 155');svg.setAttribute('role','img');svg.setAttribute('aria-label',values.map(x=>x.time+' '+x.value+spec.unit).join('；'));
  const add=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;svg.append(e)};
  const max=Math.ceil(Math.max(...spec.values)/10)*10,x=i=>36+i*290/(values.length-1),y=v=>118-v/max*85;
  [0,max/2,max].forEach(v=>{add('line',{x1:28,y1:y(v),x2:340,y2:y(v),stroke:'#e2e8f4'});add('text',{x:22,y:y(v)+4,'text-anchor':'end',fill:'#70809c','font-size':11},String(v))});
  add('path',{d:values.map((r,i)=>(i?'L':'M')+x(i)+' '+y(r.value)).join(' '),fill:'none',stroke:'#4768ff','stroke-width':2.5});
  values.forEach((r,i)=>{add('circle',{cx:x(i),cy:y(r.value),r:3.5,fill:'#4768ff'});add('text',{x:x(i),y:y(r.value)-9,'text-anchor':'middle',fill:'#344c77','font-size':11},String(r.value));add('text',{x:x(i),y:144,'text-anchor':'middle',fill:'#70809c','font-size':10},r.time)});section.append(svg,node('p',values[0].time+'—'+values.at(-1).time,'stage-media-note'));return section;
 }
 function media(item,cutoff){
  const source=scenes[item.businessType||item.id];if(!source)return null;const spec=item.sample?{...source,values:null}:source;const host=node('div','','stage-context-media'),photo=node('section','','stage-photo');photo.append(node('h3','现场画面'));
  const image=node('img');image.src='assets/'+spec.image;image.alt=spec.title;const open=node('button','放大查看','stage-image-open');open.type='button';open.onclick=()=>enlarge(item,spec,open);image.onerror=()=>{image.replaceWith(node('p','场景图片暂不可用','stage-material-empty'));open.hidden=true};photo.append(image,node('p',spec.title+' · 非现场影像','stage-media-note'),open);host.append(photo);
  if(spec.values){const chart=trend(spec,cutoff);if(chart)host.append(chart)}return host;
 }
 function disclosure(label,body,cls='stage-material-disclosure'){
  const name=label.replace(/^查看|^收起/,'');const wrap=node('div','',cls),button=node('button','查看'+name),panel=node('div','','stage-material-inline');button.type='button';button.setAttribute('aria-label','查看'+name);button.setAttribute('aria-expanded','false');panel.id='stage-inline-'+(++sequence);button.setAttribute('aria-controls',panel.id);panel.hidden=true;panel.append(body);button.onclick=()=>{const open=panel.hidden;panel.hidden=!open;button.setAttribute('aria-expanded',String(open));button.textContent=(open?'收起':'查看')+name;button.setAttribute('aria-label',(open?'收起':'查看')+name);if(!open)button.focus({preventScroll:true})};wrap.append(button,panel);return wrap;
 }
 function phaseFacts(item,phase){
  const original=item.originalSnapshot||{},feedback=item.feedback?.at(-1),verified=item.verificationFeedback?.filter(row=>item.verificationAssignment&&row.assignmentVersion===item.verificationAssignment.version).at(-1),records=item.records||[];
  let headline=item.summary,description='';
  if(phase==='verify'){headline=item.decision?.approved===false?'处置方案已退回，等待重新核查':original.summary||item.summary;description=item.decision?.approved===false?item.decision.note:(item.businessType||item.id)==='road'?'先核实排队原因及入口通行情况。':''}
  if(phase==='verify_feedback'){headline='现场核查已安排，等待核查反馈';description=original.summary||''}
  if(phase==='decision'){headline='现场核查已完成，等待处置决策';description=verified?.text||original.summary||''}
  if(phase==='assign'){headline=item.decision?.approved?'处置方案已确认，等待安排责任组':'问题已核实，等待安排处置责任';description=verified?.text||original.summary||''}
  if(phase==='feedback'){
   const returned=[...records].reverse().find(row=>row[1]==='退回补充');
   if(returned){headline='处置反馈已退回，等待补充';description=returned[2]}
   else if(item.id==='cable'&&item.version===1){headline='候乘人数正在回落，现场仍在分段放行';description=original.summary||item.summary}
   else{headline='现场处置进行中，等待结果反馈';description=item.assignment?.note||original.summary||item.summary}
  }
  if(phase==='review'){headline='处置反馈已提交，等待结果复核';description=feedback?([({ongoing:'仍需处置',improved:'情况改善',resolved:'已恢复'})[feedback.condition],feedback.text].filter(Boolean).join(' · ')):original.summary||''}
  return {headline,description};
 }
 function materialList(materials,title){
  if(!materials.length)return null;
  const section=node('section','','stage-material-section');section.append(node('h3',title));
  for(const material of materials){const body=node('div');body.append(node('p',material.text,'stage-material-fulltext'),node('p',[material.source,formatTime(material.time)].filter(Boolean).join(' · '),'stage-media-note'));const entry=disclosure(material.name,body);entry.firstChild.setAttribute('aria-label','查看材料：'+material.name);savedFiles(entry,material.attachments);section.append(entry)}return section;
 }
 function feedbackOwner(item,action){return item.feedback?.at(-1)?.owner||(/保洁/.test(action[1])?'保洁组（反馈方）':'处置反馈')}
 function renderBusiness(item,host,data){
  const phase=item.phase,facts=phaseFacts(item,phase);
  const heading=node('div','','stage-detail-heading');heading.append(node('h2','事件概况','stage-detail-title'));
  host.append(heading,node('p',facts.headline,'stage-detail-summary'));if(facts.description)host.append(node('p',facts.description,'stage-description'));
  const attrs=node('dl','','stage-attributes');for(const [label,value]of [['发生位置',item.location],['发现时刻',item.time],['当前状态',item.status]]){const cell=node('div');cell.append(node('dt',label),node('dd',value));attrs.append(cell)}host.append(attrs);
  if(phase==='review'){const material=materialList(data.materials,'反馈与复核依据');if(material)host.append(material)}
  const visual=media(item);if(visual){host.append(node('h2',phase==='review'?'原始现场与数据':'现场与数据','stage-media-heading'),visual)}
  const records=(item.records||[]).filter(row=>row[0]!=='当前'&&!/AI|分析建议/.test(row[1]));
  const action=[...records].reverse().find(row=>/安排|分段放行|处置|清运|反馈|退回|核查有效/.test(row[1]));
  if(action&&phase!=='verify'){
   const section=node('section','','stage-progress');section.append(node('h2',phase==='review'?'处置结果':'处置进展'));
   const meta=node('div','','stage-progress-meta'),recordMeta=item.recordMeta?.[item.records.indexOf(action)];
   const owner=recordMeta?.owner||recordMeta?.actor||(/反馈/.test(action[1])?(feedbackOwner(item,action)):(item.assignment?.owner||(phase==='feedback'?item.owner:'')));
   if(owner)meta.append(person(owner));meta.append(node('time',formatTime(action[0])));section.append(meta,node('p',action[1]+'。'+action[2]));host.append(section);
  }
  if(phase!=='review'){const material=materialList(data.materials,phase==='verify'?'来源材料':'相关材料');if(material)host.append(material)}
 }
 function render(item,options={}){
  const host=options.host||document.getElementById('stage-detail');if(!host)return;
  const phase=options.phase||item.phase,data=window.StageMaterials.get(item,{preview:!!options.preview,phase});
  host.replaceChildren();host.dataset.phase=phase;
  if(!options.preview&&!options.host&&phase!=='closed'){renderBusiness(item,host,data);return;}
  const heading=node('div','','stage-detail-heading'),title=node('h2',data.title,'stage-detail-title');heading.append(title);host.append(heading,node('p',data.summary,'stage-detail-summary'));
  const attrs=node('dl','','stage-attributes');for(const [label,value]of [['位置',item.location],['责任',item.owner||'待安排'],['来源',item.source]]){const cell=node('div');cell.append(node('dt',label),node('dd',value||'未登记'));attrs.append(cell)}host.append(attrs);
  const materials=data.materials||[],materialSection=node('section','','stage-material-section');
  materialSection.append(node('h3',phase==='review'?'反馈与复核依据':phase==='closed'?'结束材料':'阶段材料'));
  for(const material of materials){const body=node('div');body.append(node('p',material.text,'stage-material-fulltext'),node('p',[material.source,formatTime(material.time)].filter(Boolean).join(' · '),'stage-media-note'));const entry=disclosure(material.name,body);entry.firstChild.setAttribute('aria-label','查看材料：'+material.name);savedFiles(entry,material.attachments);materialSection.append(entry)}
  if(!materials.length)materialSection.append(node('p','尚未收到本阶段材料。','stage-material-empty'));host.append(materialSection);
  const visual=media(item);if(visual)host.append(visual);
  if(data.focus?.length&&phase!=='closed'){const focus=node('details','','stage-focus');focus.append(node('summary',focusTitles[phase]||'当前重点'));const list=node('ol','','stage-focus-list');for(const text of data.focus)list.append(node('li',text));focus.append(list);host.append(focus)}
  if(data.history?.length){const history=node('details','','stage-history');history.append(node('summary','原始情况与前序记录'));const list=node('div','','stage-history-list');for(const entry of data.history){const row=node('section');row.append(node('h4',entry.title),node('p',entry.text));list.append(row)}history.append(list);host.append(history)}
 }
 function renderRecords(item,host){
  host.replaceChildren();
  const entries=(item.records||[]).map(([time,title,text],index)=>({time,title,text,index,meta:item.recordMeta?.[index]}));
  for(const record of [...(item.processRecords||[])].sort((a,b)=>a.time.localeCompare(b.time))){
   const entry={...record,meta:record},position=entries.findIndex(row=>row.time==='当前'||String(row.time).includes('T')||row.time>record.time);
   entries.splice(position<0?entries.length:position,0,entry);
  }
  for(const entry of entries){
   const {time,title,text,index,meta}=entry,row=node('li','','record-entry'),body=node('div','','record-content');
   const actor=meta?.actor||(/AI|分析建议/.test(title)?'小岚':'');
   body.append(node('strong',title));if(actor)body.append(person(actor,/AI|分析建议/.test(title)));body.append(node('p',text));
   if(meta?.owner)body.append(node('p','责任班组：'+meta.owner,'stage-media-note'));
   for(const material of entry.materials||meta?.materials||[]){
    const content=node('div');content.append(node('p',material.text),node('p',material.source,'stage-media-note'));
    body.append(disclosure('查看'+material.name,content,'record-materials'));
   }
   const recordMaterial=node('div');savedFiles(recordMaterial,meta?.attachments);recordMaterial.append(node('p',meta?.evidence||text),node('p','来源：本条处理记录 · '+formatTime(time),'stage-media-note'));
   if(index===0){const cutoff=String(time).match(/\d{2}:\d{2}/)?.[0],visual=media(item,cutoff);if(visual)recordMaterial.append(visual)}
   if(index===0||(meta?.evidence&&meta.evidence.trim()!==text.trim())||meta?.attachments?.length)body.append(disclosure(index===0?'查看原始材料':'查看关联材料',recordMaterial,'record-materials'));
   row.append(node('time',time==='当前'?'初始状态快照':formatTime(time)),body);host.append(row);
  }
  if(!host.childElementCount)host.append(node('li','暂无处理记录。'));
 }
 window.StageDetail={render,renderRecords,setScenes(value){scenes=value}};
})();
