import {renderReportDocument,formatReportDate} from './report-document.js';
const $=id=>document.getElementById(id), node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n};
let store,current=null,busy=false,reportId=null,reportVersion=null,sourceTrigger=null,returnToReport=false,reportScrollTop=0,context={};
const params=new URLSearchParams(location.search);if(params.get('item'))context.itemId=params.get('item');
document.querySelector('.environment')?.setAttribute('title','仅保存在当前浏览器；未接入实时业务数据、外部通知或在线大模型。');
const history=node('div','','history-list');$('history').replaceWith(history);
const historyHeading=document.querySelector('.history-label');historyHeading.textContent='会话记录';
const historyContent=$('history-content');
const historySearch=historyContent.querySelector('.history-search');historySearch.oninput=()=>renderHistory();
const historyToggle=$('history-toggle');
historyContent.hidden=matchMedia('(max-width:700px)').matches;
historyToggle.hidden=!matchMedia('(max-width:700px)').matches;
historyToggle.setAttribute('aria-expanded',String(!historyContent.hidden));
historyToggle.onclick=()=>{historyContent.hidden=!historyContent.hidden;historyToggle.setAttribute('aria-expanded',String(!historyContent.hidden))};
$('conversation').replaceChildren();$('report-library').replaceChildren();$('report-reader').replaceChildren();
 $('source-panel').append($('report-reader'));
function avatar(){const image=node('img','','scenic-avatar');image.src='assets/scenic-ip.png';image.alt='小岚';return image}
function session(){return store?.sessions.find(s=>s.id===current)}
function busyUI(value){busy=value;document.querySelectorAll('#chat-tab,#reports-tab,#clear-context,.history-list button').forEach(button=>button.disabled=value);document.querySelector('.send').disabled=value;$('new-chat').disabled=value;document.querySelector('.composer-bottom>span').textContent=value?'小岚正在处理…':'回答附带来源，业务操作需确认';$('assistant-loading')?.remove();if(value&&!$('chat-view').hidden){const row=node('article','','answer assistant-loading');row.id='assistant-loading';row.setAttribute('role','status');const label=node('div','','answer-label');label.append(avatar(),node('strong','小岚 · 智能助手'));row.append(label,node('p','正在读取本地记录，请稍候…'));$('conversation').hidden=false;$('empty-chat').hidden=true;$('conversation').append(row);row.scrollIntoView({block:'end'})}else if(!$('conversation').children.length){$('conversation').hidden=true;$('empty-chat').hidden=false}}
async function action(payload){const r=await Product.act(payload);store=r.state;return r.result}
function closeSource(){if(returnToReport){returnToReport=false;$('source-body').replaceChildren();$('report-reader').hidden=false;document.querySelector('.source-panel-heading').hidden=true;document.querySelector('.assistant-shell').classList.remove('has-source');document.querySelector('.assistant-shell').classList.add('has-report');$('report-panel-scroll').scrollTop=reportScrollTop;return} $('source-panel').hidden=true;$('source-body').replaceChildren();$('report-reader').hidden=true;$('report-library').hidden=$('reports-view').hidden;document.querySelector('.source-panel-heading').hidden=false;document.querySelector('.assistant-shell').classList.remove('has-source','has-report');sourceTrigger?.focus({preventScroll:true});const url=new URL(location.href);url.searchParams.delete('report');url.searchParams.delete('version');window.history.replaceState(null,'',url);}
function sources(records,trigger){sourceTrigger=trigger;returnToReport=!$('report-reader').hidden;if(returnToReport)reportScrollTop=$('report-panel-scroll').scrollTop;$('report-reader').hidden=true;$('source-body').replaceChildren();document.querySelector('.source-panel-heading').hidden=false;$('source-title').textContent=returnToReport?'报告来源':'引用来源';if(returnToReport){const back=node('button','← 返回报告','text-button');back.onclick=closeSource;$('source-body').append(back)}$('source-body').append(node('p','引用为回答或报告生成时保存的事项版本。'));for(const ref of records||[]){const item=store.items.find(i=>i.id===ref.id);const a=node('a',(ref.title||item?.title||ref.id)+' · v'+ref.version,'event-reference');a.href='index.html?item='+encodeURIComponent(ref.id)+'&from=assistant&session='+encodeURIComponent(current||'')+(reportId?'&report='+reportId+(reportVersion?'&version='+reportVersion:''):'');$('source-body').append(a,node('p',item?'当前：'+item.status+' · v'+item.version:'当前记录不可见'));}const shell=document.querySelector('.assistant-shell');shell.classList.toggle('has-report',returnToReport);shell.classList.toggle('has-source',!returnToReport);$('source-panel').hidden=false;}
$('close-source').onclick=closeSource;document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSource()});
function tab(reports){closeSource();$('chat-view').hidden=reports;$('reports-view').hidden=!reports;$('chat-tab').setAttribute('aria-selected',String(!reports));$('reports-tab').setAttribute('aria-selected',String(reports));$('chat-tab').tabIndex=reports?-1:0;$('reports-tab').tabIndex=reports?0:-1;if(reports)renderReports();else{if(session())context=session().context;reportId=null;reportVersion=null;sessionStorage.removeItem('product-report-view');sessionStorage.removeItem('product-report-version');if(current)sessionStorage.setItem('product-session',current);else sessionStorage.removeItem('product-session');const url=new URL(location.href);url.searchParams.delete('report');url.searchParams.delete('version');if(current)url.searchParams.set('session',current);else url.searchParams.delete('session');if(context.itemId)url.searchParams.set('item',context.itemId);else url.searchParams.delete('item');window.history.replaceState(null,'',url);renderChat();}}
let chartIndex=0;
function chart(metrics,heading='事项状态统计（起）',caption='来源：事项处理记录'){
 const box=node('section','','chat-data'),title=node('h4',heading),controls=node('div','','chart-switch'),graph=node('div'),table=node('table','','product-stat-table'),id='assistant-chart-'+(++chartIndex);
 controls.setAttribute('role','group');controls.setAttribute('aria-label','数据展示方式');
 graph.id=id+'-view';graph.setAttribute('role','img');graph.setAttribute('aria-label',heading+'图表');
 table.id=id+'-table';table.hidden=true;table.setAttribute('aria-label',heading+'数据表');
 const captionRow=node('caption',heading+'数据表');captionRow.className='sr-only';table.append(captionRow);
 const head=node('thead'),headRow=node('tr');headRow.append(node('th','项目'),node('th','数量'));head.append(headRow);table.append(head);
 const body=node('tbody'),total=metrics.reduce((sum,m)=>sum+m.value,0);
 for(const m of metrics){
  const row=node('div','','bar-row'),track=node('div','','bar-track'),bar=node('i','','processing');bar.style.width=(total?m.value/total*100:0)+'%';track.append(bar);row.append(node('span',m.label),track,node('b',String(m.value)));graph.append(row);
  const tr=node('tr');tr.append(node('td',m.label),node('td',String(m.value)));body.append(tr);
 }
 table.append(body);
 for(const [label,on]of [['图表',true],['数据',false]]){
  const button=node('button',label,on?'is-selected':'');button.type='button';button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-controls',id+(on?'-view':'-table'));
  button.onclick=()=>{graph.hidden=!on;table.hidden=on;controls.querySelectorAll('button').forEach(tab=>{const selected=tab===button;tab.setAttribute('aria-pressed',String(selected));tab.classList.toggle('is-selected',selected)})};controls.append(button);
 }
 box.append(title,controls,graph,table,node('p',caption,'product-record-note'));return box;
}
function sessionTitle(s){return s.messages.find(m=>m.role==='user'&&m.text?.trim())?.text.trim()||((s.title&&!/^(新会话|新对话|今天|今日)$/.test(s.title))?s.title:'新对话')}
function historyDate(value){const date=value?new Date(value):null;return date&&!Number.isNaN(date.getTime())?date:null}
function renderHistory(){
 const query=historySearch.value.trim().toLocaleLowerCase(),today=new Date(),yesterday=new Date();yesterday.setDate(today.getDate()-1);
 const day=date=>date.toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'});
 const rows=store.sessions.filter(s=>s.messages.some(m=>m.role==='user'&&m.text?.trim())&&s.messages.some(m=>m.role==='assistant'&&m.text?.trim())).map(s=>{const last=s.messages.at(-1),date=historyDate(last?.time||(!last?s.createdAt:null)),title=sessionTitle(s);
  return {s,date,title};
 }).filter(row=>row.title.toLocaleLowerCase().includes(query)).sort((a,b)=>(b.date?.getTime()||0)-(a.date?.getTime()||0));
 history.replaceChildren();historyHeading.textContent=query?'搜索结果':'会话记录';
 let group='';
 for(const {s,date,title} of rows){
  const label=!date?'日期未记录':day(date)===day(today)?'今天':day(date)===day(yesterday)?'昨天':day(date);
  if(label!==group){history.append(node('h3',label,'history-group'));group=label}
  const button=node('button','','history'+(s.id===current?' active':''));button.type='button';button.disabled=busy;button.setAttribute('aria-current',s.id===current?'true':'false');button.title=title;
  const time=node('time',date?date.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}):'时间未记录','history-time');if(date){time.dateTime=date.toISOString();time.title=date.toLocaleString('zh-CN')}
  button.append(node('strong',title,'history-title'),time);
  button.onclick=()=>{savePrompt();if(matchMedia('(max-width:700px)').matches){historyContent.hidden=true;historyToggle.setAttribute('aria-expanded','false')}current=s.id;context=s.context;sessionStorage.setItem('product-session',current);tab(false)};history.append(button);
 }
 if(!rows.length)history.append(node('p',query?'没有匹配的会话':'暂无会话，从新建对话开始','history-empty'));
}
function savePrompt(){sessionStorage.setItem('product-prompt-'+(current||'new'),$('prompt').value)}
function itemUrl(id){
 const url=new URL('index.html',location.href);
 url.searchParams.set('item',id);
 url.searchParams.set('from','assistant');
 if(current)url.searchParams.set('session',current);
 return url.href;
}
function workflowBox(steps,active=false){
 const box=node(active?'section':'details','','assistant-workflow');
 const heading=node(active?'h4':'summary',active?'正在整理运营分析':'查看查询步骤');
 const list=node('ol');
 for(const step of steps){
  const row=node('li');
  row.dataset.state=step.state||'done';
  row.append(node('strong',step.label));
  if(step.detail)row.append(node('span',step.detail));
  list.append(row);
 }
 box.append(heading,list);
 return box;
}
function setWorkflow(steps){
 const loading=$('assistant-loading');
 if(!loading)return;
 loading.querySelector('.assistant-workflow')?.remove();
 loading.querySelector('p')?.remove();
 loading.append(workflowBox(steps,true));
 loading.scrollIntoView({block:'nearest'});
}
function eventProgress(event,section){
 const item=store.items.find(row=>row.id===event.id);
 if(!item)return;
 const openDetail=section.querySelector('.assistant-event-detail');
 if(openDetail){
  const openRow=section.querySelector('[data-event-id="'+CSS.escape(openDetail.dataset.detailFor)+'"]');
  const openButton=openRow?.querySelector('button');
  if(openButton){openButton.textContent=openButton.dataset.defaultLabel;openButton.setAttribute('aria-expanded','false')}
  openDetail.remove();
 }
 const row=section.querySelector('[data-event-id="'+CSS.escape(item.id)+'"]');
 if(row)row.querySelector('.assistant-event-stage').textContent=item.resolution||item.status;
 const panel=node('section','','assistant-event-detail');panel.id='assistant-event-detail-'+item.id;panel.dataset.detailFor=item.id;panel.setAttribute('aria-label',item.title+'当前进展');
 const header=node('div','','assistant-event-summary-heading');
 header.append(node('strong',item.title),node('span',item.resolution||item.status,'assistant-event-stage'));
 panel.append(header,node('p',[item.location,'责任：'+(item.owner||'尚未指定')].filter(Boolean).join(' · '),'assistant-event-meta'));
 const minute=value=>{const match=String(value||'').match(/(?:T|^)(\d{1,2}):(\d{2})/);return match?Number(match[1])*60+Number(match[2]):0};
 const timeline=[...(item.records||[]).map((record,index)=>({record,index})).filter(({record})=>record[0]!=='当前').map(({record,index})=>({time:record[0],title:record[1],text:record[2],materials:item.recordMeta?.[index]?.materials||[],attachments:item.recordMeta?.[index]?.attachments||[]})),...(item.processRecords||[])].sort((a,b)=>minute(a.time)-minute(b.time));
 const latest=timeline.at(-1);
 if(latest)panel.append(node('p','最近进展：'+latest.title+' · '+latest.text,'assistant-event-latest'));
 panel.append(node('p','当前下一步：'+(item.completed?'查看归档材料与处理记录':item.next||item.waitingFor),'assistant-event-next'));
 const history=node('details','','assistant-event-history'),historyTitle=node('summary','处理记录与材料（'+timeline.length+'）'),facts=node('ol','','assistant-progress-timeline');
 for(const record of timeline){
  const row=node('li'),detail=node('div');
  const text=(record.text||'').replace('清运任务已记录于演示事项。','清运任务已登记。');
  detail.append(node('strong',record.time+' · '+record.title),node('p',text));
  const materials=[...(record.materials||[]),...(record.attachments||[])];
  if(materials.length){const list=node('div','','assistant-progress-material-item');list.append(node('strong','关联材料'));for(const material of materials)list.append(node('p',(material.name||'材料')+(material.text?'：'+material.text:'')+(material.source?' · 来源：'+material.source:'')));detail.append(list)}
  row.append(detail);facts.append(row);
 }
 history.append(historyTitle,facts);panel.append(history);
 const link=node('a',item.completed?'查看归档与材料 ↗':'打开业务工作区 ↗','inline-business');
 link.href=itemUrl(item.id);
 panel.append(link);
 if(item.phase==='verify'&&Product.role==='operator'){
  const actionDisclosure=node('details','','assistant-action-disclosure');
  actionDisclosure.append(node('summary','安排现场核查'));
  const form=node('form','','assistant-action-form');
  const group=node('label','核查责任组'),owner=node('select');
  owner.required=true;
  for(const name of ['',...(item.people||[])]){
   const option=node('option',name||'选择责任组');
   option.value=name;
   owner.append(option);
  }
  group.append(owner);
  const noteLabel=node('label','核查说明（选填）'),note=node('textarea');
  note.rows=2;
  note.placeholder='填写需要现场核实的情况';
  noteLabel.append(note);
  const submit=node('button','确认安排现场核查','assistant-primary');
  const status=node('p','','assistant-action-status');
  status.setAttribute('role','status');
  form.append(group,noteLabel,submit,status);
  form.onsubmit=async e=>{
   e.preventDefault();
   if(busy)return;
   submit.disabled=true;
   try{
    await action({type:'item.verify_assign',id:item.id,version:item.version,owner:owner.value,note:note.value.trim()});
    eventProgress(event,section);
    Product.notify('已保存核查安排，等待现场反馈');
   }catch(error){
    status.textContent=error.status===409?'事项阶段已变化。请重新查看进展后办理。':error.message;
   }finally{submit.disabled=false}
  };
  actionDisclosure.append(form);panel.append(actionDisclosure);
 }
 section.append(panel);
 panel.scrollIntoView({block:'nearest'});
}
function eventList(events,title){
 const section=node('section','','assistant-events');
 section.append(node('h4',title));
 for(const event of events){
  const row=node('div','','assistant-event-row');
  row.dataset.eventId=event.id;
  const identity=node('div');
  identity.append(node('strong',event.title),node('small',[event.site,event.location].filter(Boolean).join(' · ')));
  const stage=node('span',event.resolution||event.status,'assistant-event-stage');
  const view=node('button',event.phase==='closed'?'查看归档':'查看进展');
  view.type='button';view.dataset.defaultLabel=view.textContent;view.setAttribute('aria-expanded','false');view.setAttribute('aria-controls','assistant-event-detail-'+event.id);
  view.onclick=async()=>{
   if(busy||view.disabled)return;
   if(section.querySelector('.assistant-event-detail[data-detail-for="'+CSS.escape(event.id)+'"]')){
    section.querySelector('.assistant-event-detail')?.remove();view.textContent=view.dataset.defaultLabel;view.setAttribute('aria-expanded','false');return;
   }
   view.disabled=true;
   try{store=await Product.read();eventProgress(event,section);view.textContent='收起进展';view.setAttribute('aria-expanded','true')}
   catch(error){Product.notify(error.message,true)}
   finally{view.disabled=false}
  };
  row.append(identity,stage,view);
  section.append(row);
 }
 return section;
}
function eventArchive(events,title){
 const section=node('details','','assistant-event-archive');
 section.append(node('summary',title+'（'+events.length+'）'),eventList(events,''));
 return section;
}
function downloadReportFile(report,snapshot){
 const blob=new Blob(['# '+report.title+'\n\n版本 v'+snapshot.version+' · '+report.status+'\n\n'+snapshot.content+'\n\n来源：事项处理记录。'],{type:'text/markdown;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=report.title+'-v'+snapshot.version+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function renderAnswer(m){
 const a=node('article','','answer'),label=node('div','','answer-label');a.dataset.answerType=m.kind||'';
 label.append(avatar(),node('strong','小岚 · 智能助手'));
 const kindLabels={statistics:'统计结果',comparison:'片区对比',reason:'现象与原因',progress:'当前进展',records:'处理记录',evidence:'复核依据',advice:'处置建议',list:'事项清单'};
 if(kindLabels[m.kind])label.append(node('span',kindLabels[m.kind],'answer-kind-label'));
 if(m.time)label.append(node('time',formatReportDate(m.time),'answer-time'));
 a.append(label);
 if(m.kind==='records'){
  const count=m.itemSnapshots?.length||0,history=node('details','','answer-record-history');
  history.append(node('summary','查看完整处理记录'),node('p',m.text,'answer-record-body'));
  a.append(node('p',count?'已整理 '+count+' 项事项的处理记录，按时间展开查看。':'已整理当前范围的处理记录，按时间展开查看。','answer-lead'),history);
 }else if(['list','advice','progress'].includes(m.kind)&&m.text.includes('\n')){
  const lines=m.text.split(/\n+/).filter(Boolean),list=node('ul','','answer-lines');
  for(const line of lines)list.append(node('li',line));
  a.append(list);
 }else{
  const [lead,...supporting]=m.text.split(/\n+/).filter(Boolean);
  if(lead)a.append(node('p',lead,'answer-lead'));
  for(const line of supporting)a.append(node('p',line,'answer-supporting'));
 }
 if(m.sources?.some(ref=>store.items.find(item=>item.id===ref.id)?.version!==ref.version))a.append(node('p','此回答为历史记录，相关事项已有更新。打开进展可查看当前状态。','answer-snapshot-note'));
 if(m.workflow?.length)a.append(workflowBox(m.workflow));
 const toolbar=node('div','','product-toolbar assistant-answer-tools'),source=node('button','查看依据');
 source.onclick=()=>sources(m.sources,source);
 if(m.sources?.length)toolbar.append(source);
 const savedReport=store.reports.find(report=>report.messageId===m.id||(report.revisions||[]).some(revision=>revision.messageId===m.id));
 if(savedReport){
  const revision=(savedReport.revisions||[]).find(row=>row.messageId===m.id),cardVersion=revision?.version||savedReport.version;
  const card=node('div','','assistant-report-file assistant-report-card'),meta=node('div');
  meta.append(node('strong',savedReport.title),node('small',`Markdown · v${cardVersion} · 已保存到当前浏览器`));
  const open=node('button','打开报告 ↗','assistant-primary');
  open.onclick=()=>{if(!busy)readReport(savedReport.id,cardVersion===savedReport.version?null:cardVersion)};
  const download=node('button','下载 Markdown');
  download.onclick=()=>{const snapshot=cardVersion===savedReport.version?savedReport:savedReport.history.find(row=>row.version===cardVersion);if(snapshot)downloadReportFile(savedReport,snapshot)};
  card.append(meta,open,download);a.append(card);
  if(cardVersion<savedReport.version){const latest=node('button','查看最新第 '+savedReport.version+' 版','text-button');latest.onclick=()=>{if(!busy)readReport(savedReport.id)};card.append(latest)}
 }else if(!m.unsupported&&(m.itemSnapshots?.length||m.operations?.weekly||m.operations?.snapshot)){
  const generate=node('button',m.operations?.daily?'生成运营日报':m.operations?.weekly?'生成运营周报':'生成报告草稿',m.operations?.daily||m.operations?.weekly?'assistant-primary':'');
  generate.onclick=()=>generateReport(false,m.id);
  toolbar.prepend(generate);
 }
 if(toolbar.childElementCount)a.append(toolbar);
 const weekly=m.operations?.weekly;
 if(weekly){
  if(weekly.areas.length)a.append(chart(weekly.areas.map(row=>({label:row.name,value:row.count})),'上周片区事件（起）',m.operations.periodLabel+' · 来源：事项处理记录'));
  const {normal,false:falseCount,duplicate,pending}=weekly.outcomes;
  a.append(chart([{label:'正常完成',value:normal},{label:'误报终止',value:falseCount},{label:'重复合并',value:duplicate},{label:'尚未结束',value:pending}],'上周事项结束结果（起）',m.operations.periodLabel+' · 来源：事项处理记录'));
 }else if(m.kind==='statistics'&&m.metrics?.length&&!m.unsupported&&m.itemSnapshots?.length)a.append(chart(m.metrics));
 const observation=m.operations?.snapshot;
 if(observation){
  a.append(chart(observation.areas.map(row=>({label:row.name,value:row.people})),'在园人数（人）',observation.capturedAt+' · 来源：运营观测记录'));
  if(observation.traffic){
   const {queueVehicles,waitMinutes}=observation.traffic,{available,total}=observation.parking;
   a.append(node('p',`同一时点 · 入口排队 ${queueVehicles} 辆，预计等待 ${waitMinutes} 分钟，停车空位 ${available} / ${total} 个。`,'assistant-observation-note'));
  }
 }
 if(m.analysis?.series?.length){
  a.append(chart(m.analysis.series.map(point=>({label:point.time,value:point.value})),m.analysis.title,m.analysis.scope+' · 来源：处理记录中的现场观测'));
  a.append(node('p','已确认 · '+m.analysis.facts.join('；'),'assistant-observation-note assistant-analysis-facts'));
  a.append(node('p','待核实 · '+m.analysis.unknown,'assistant-observation-note assistant-analysis-unknown'));
 }
 if(m.events?.length&&m.kind!=='comparison')a.append(eventList(m.events,weekly?'当前待跟进事项':'相关事项'));
 if(weekly&&m.itemSnapshots.length){
  const archive=m.itemSnapshots.map(row=>({id:row.id,title:row.title,location:row.location,phase:row.phase,resolution:row.resolution,status:row.status,site:row.createdAt?.slice(0,10)}));
  a.append(eventArchive(archive,'上周事件清单'));
 }
 if(!m.events?.length&&!weekly){
  for(const ref of m.sources||[]){
   const link=node('a',ref.title+' ↗','event-reference');
   link.href=itemUrl(ref.id);
   a.append(link);
  }
 }
 return a;
}
function renderChat(){
 const s=session();
 if(s)context=s.context;
 $('view-title').textContent=s?sessionTitle(s):'新对话';
 document.querySelector('.snapshot').textContent='当前浏览器保存';
 document.querySelector('.conversation-header>div>span').textContent='九华山景区';
 $('context-text').textContent=context.itemId?'当前事项：'+(store.items.find(x=>x.id===context.itemId)?.title||'不可见事项'):'九华山景区 · 全部可见事项';
 $('prompt').value=sessionStorage.getItem('product-prompt-'+(current||'new'))||'';
 const messages=s?.messages||[];
 $('conversation').replaceChildren();
 $('conversation').hidden=!messages.length;
 $('empty-chat').hidden=!!messages.length;
 $('starter-prompts').hidden=!!messages.length||!!context.itemId;
 $('chat-view').classList.toggle('is-new',!messages.length);
 for(const m of messages){
  if(m.role==='user'){
   const q=node('div','','question');
   q.append(node('span','我','user-avatar'),node('p',m.text));
   $('conversation').append(q);
  }else $('conversation').append(renderAnswer(m));
 }
 renderHistory();
 [...$('conversation').querySelectorAll('.question')].at(-1)?.scrollIntoView({block:'start'});
}
async function ensureSession(){if(current)return session();const r=await action({type:'session.create',context});current=r.sessionId;sessionStorage.setItem('product-session',current);return session()}
const letStepRender=()=>new Promise(resolve=>setTimeout(resolve,700));
$('composer').onsubmit=async e=>{
 e.preventDefault();
 const text=$('prompt').value.trim();
 if(!text||busy)return;
 const originDraftKey='product-prompt-'+(current||'new');
 const weekly=/上周/.test(text)&&/运营|周报|简报|报告/.test(text)&&!!window.BrowserStore;
 const reportRequested=/(?:生成|整理|制作|出一份).*(?:报告|周报|日报|简报)/.test(text);
 const stagedQuery=!!window.BrowserStore&&(/(?:对比|比较|排名|原因|为什么|进展|进度|日报|周报|运营)/.test(text)||reportRequested);
 busyUI(true);
 try{
  if(weekly){
   $('chat-view').classList.remove('is-new');
   $('starter-prompts').hidden=true;
   setWorkflow([{label:'确定统计口径',detail:'正在核对请求的景区范围和时间',state:'active'}]);
   await letStepRender();
   store=await Product.read();
   setWorkflow([{label:'确定统计口径',detail:'按上报日期匹配请求范围'},{label:'读取事项与汇总数据',detail:'按片区和办理结果整理记录',state:'active'}]);
   await letStepRender();
  }else if(stagedQuery){
   $('chat-view').classList.remove('is-new');
   $('starter-prompts').hidden=true;
   setWorkflow([{label:'识别问题与查询范围',detail:'正在确认片区、时间和问题类型',state:'active'}]);
   await letStepRender();
   store=await Product.read();
   setWorkflow([{label:'识别问题与查询范围',detail:'已确定问题的片区与时间条件'},{label:'读取事项和观测快照',detail:'正在读取当前浏览器中保存的记录',state:'active'}]);
   await letStepRender();
  }
  const s=await ensureSession();
  savePrompt();
  const result=await action({type:'session.message',id:current,version:s.version,text,reportId:reportId||undefined});
  if(result.message?.reportRevision){
   const report=store.reports.find(row=>row.id===result.message.reportRevision.reportId);
   if(report){
    let content=report.content;
    const refs=new Map((report.sources||[]).map(ref=>[ref.id,ref]));
    for(const item of result.message.itemSnapshots||[])refs.set(item.id,{id:item.id,title:item.title,version:item.version});
    if(result.message.reportRevision.command==='shorten-summary'){
     content=content.replace(/(## 运行摘要\n)([\s\S]*?)(?=\n\n## |$)/,(_,heading,body)=>heading+body.trim().split(/[。！？]/)[0]+'。');
    }else{
     const details=(result.message.itemSnapshots||[]).map(item=>{
      const timeline=[...(item.records||[]).filter(row=>row[0]!=='当前').map(row=>({time:row[0],title:row[1],text:row[2]})),...(item.processRecords||[])].sort((a,b)=>String(a.time).localeCompare(String(b.time)));
      return `### ${item.title}\n当前阶段：${item.status||item.phase} · 责任：${item.owner||'未指定'}\n`+timeline.map(row=>`- ${row.time} ${row.title}：${row.text}`).join('\n')+`\n下一步：${item.next||item.waitingFor}`;
     }).join('\n\n');
     content+='\n\n## 最新处置进展\n'+details;
    }
    await action({type:'report.edit',id:report.id,version:report.version,content,sources:[...refs.values()],messageId:result.message.id});
    readReport(report.id);
   }
  }
  if(stagedQuery&&!weekly){
   setWorkflow([{label:'识别问题与查询范围',detail:'已确认查询对象'},{label:'读取事项和观测快照',detail:'已读取匹配的事项与观测记录'},{label:'核对统计口径和处理阶段',detail:'正在整理可核验的数据与待确认项',state:'active'}]);
   await letStepRender();
  }
  if($('prompt').value.trim()===text){
   $('prompt').value='';
   sessionStorage.removeItem('product-prompt-'+current);
  }else savePrompt();
  if(originDraftKey!=='product-prompt-'+current)sessionStorage.removeItem(originDraftKey);
  if(reportRequested&&!result.message?.unsupported&&(result.message?.itemSnapshots?.length||result.message?.operations?.weekly||result.message?.operations?.snapshot)){
   if(weekly){
    setWorkflow([...(result.message.workflow||[]),{label:'生成报告草稿',detail:'保存这次统计和事项版本',state:'active'}]);
    await letStepRender();
   }else{
    setWorkflow([...(result.message.workflow||[]),{label:'生成报告文档',detail:'保存本次查询快照与来源',state:'active'}]);
    await letStepRender();
   }
   await generateReport(true,result.message.id,true);
  }
  if(!$('chat-view').hidden)renderChat();
 }catch(error){
  savePrompt();
  if(weekly)renderChat();
  error.uncertain?Product.pendingNotice():Product.notify(error.message,true);
 }finally{busyUI(false)}
};
$('prompt').oninput=savePrompt;
$('new-chat').onclick=()=>{savePrompt();current=null;context={};sessionStorage.removeItem('product-session');tab(false)};
$('clear-context').onclick=()=>{savePrompt();current=null;context={};sessionStorage.removeItem('product-session');tab(false);Product.notify('已创建无事项范围的新对话，原会话保留')};
$('chat-tab').onclick=()=>tab(false);$('reports-tab').onclick=()=>tab(true);
document.querySelector('.view-tabs').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[$('chat-tab'),$('reports-tab')],active=tabs.indexOf(document.activeElement),index=e.key==='Home'?0:e.key==='End'?1:(active+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[index].focus();tab(index===1)};
document.querySelectorAll('[data-starter]').forEach(button=>button.onclick=()=>{
 if(busy)return;
 $('prompt').value=button.dataset.starter;
 savePrompt();
 $('composer').requestSubmit();
});
async function generateReport(alreadyBusy=false,messageId=null,openReader=true){
 if(busy&&!alreadyBusy)return;
 if(!alreadyBusy)busyUI(true);
 try{
  await ensureSession();
  const reply=session()?.messages.find(m=>m.id===messageId)||session()?.messages.filter(m=>m.role==='assistant').at(-1);
  const result=await action({type:'report.generate',sessionId:current,messageId:messageId||reply?.id,template:reply?.operations?.daily?'daily':reply?.operations?.weekly?'weekly':undefined});
  if(openReader)readReport(result.reportId)
 }catch(error){error.uncertain?Product.pendingNotice():Product.notify(error.message,true)}
 finally{if(!alreadyBusy)busyUI(false)}
}
function renderReports(){ const url=new URL(location.href);url.searchParams.delete('report');url.searchParams.delete('version');window.history.replaceState(null,'',url);reportId=null;reportVersion=null;sessionStorage.removeItem('product-report-view');sessionStorage.removeItem('product-report-version');$('report-reader').hidden=true;$('source-panel').hidden=true;document.querySelector('.source-panel-heading').hidden=false;document.querySelector('.assistant-shell').classList.remove('has-report','has-source');$('view-title').textContent='报告文档';$('report-library').hidden=false;const box=$('report-library');box.replaceChildren(node('h3','报告文档'));const search=node('input','','report-filter');search.type='search';search.placeholder='搜索报告名称';search.setAttribute('aria-label','搜索报告');box.append(search);const list=node('div');box.append(list);const render=()=>{const rows=store.reports.filter(r=>r.title.includes(search.value));list.replaceChildren(...rows.map(r=>{const b=node('button','','report-row');b.append(node('strong',r.title),node('span',r.status+' · v'+r.version,'report-state'),node('span',formatReportDate(r.updatedAt),'report-date'));const names=(r.sources||[]).map(source=>source.title).filter(Boolean);b.append(node('span',names.length?'范围：'+names.slice(0,2).join('、')+(names.length>2?' 等'+names.length+'项':''):'范围：未记录','report-scope'));b.onclick=()=>{current=r.sessionId;context=session()?.context||{};readReport(r.id)};return b}));if(!rows.length)list.append(node('p','暂无匹配文档。可从对话生成报告草稿。','product-empty'))};search.oninput=render;render();}
function readReport(id,version=null){
 reportId=id;reportVersion=version;sessionStorage.setItem('product-report-view',id);if(version)sessionStorage.setItem('product-report-version',String(version));else sessionStorage.removeItem('product-report-version');
 const r=store.reports.find(x=>x.id===id);
 if(!r){Product.notify('报告不存在或不可见',true);return}
 if(version===r.version){version=null;reportVersion=null;sessionStorage.removeItem('product-report-version')}
 const snapshot=version?r.history.find(h=>h.version===version):r;
 if(!snapshot){Product.notify('该报告版本不存在',true);return}
 closeSource();$('report-library').hidden=true;$('report-reader').hidden=false;$('source-panel').hidden=false;document.querySelector('.source-panel-heading').hidden=true;
 document.querySelector('.assistant-shell').classList.remove('has-source');document.querySelector('.assistant-shell').classList.add('has-report');
 $('view-title').textContent=session()?sessionTitle(session()):'报告阅读';
 const url=new URL(location.href);url.searchParams.set('session',r.sessionId);url.searchParams.set('report',r.id);if(version)url.searchParams.set('version',String(version));else url.searchParams.delete('version');window.history.replaceState(null,'',url);
 const box=$('report-reader');box.replaceChildren();$('report-library').hidden=$('reports-view').hidden;
 const panel=node('section','','report-panel');panel.id='report-panel';const scroll=node('div','','report-panel-scroll');scroll.id='report-panel-scroll';panel.append(scroll);box.append(panel);
 const toolbar=node('div','','reader-toolbar'),back=node('button','← 关闭报告','text-button'),chat=node('button','返回对话 ↗','text-button'),sourceButton=node('button','查看来源','text-button');
 back.onclick=closeSource;chat.onclick=()=>{tab(false);$('prompt').focus()};toolbar.append(back,chat,sourceButton);scroll.append(toolbar);
 const layout=node('div','','reader-layout'),paper=node('article','','report-paper'),outline=node('aside','','report-outline');
 paper.setAttribute('aria-label','报告阅读正文');
 paper.append(node('div',r.status+' · 第 '+snapshot.version+' 版'+(version?' · 历史版本':''),'report-eyebrow'),node('h1',r.title));
 const metadata=node('dl','','report-document-meta');
 for(const [label,value] of [['本版保存（北京时间）',formatReportDate(snapshot.updatedAt)],['引用快照（北京时间）',formatReportDate(r.snapshotAt)]]){
  const group=node('div');group.append(node('dt',label),node('dd',value));metadata.append(group);
 }
 paper.append(metadata);
 const {body,navigation}=renderReportDocument(snapshot.content,scroll);paper.append(body);outline.append(navigation);
 const tools=node('div','','product-toolbar report-document-actions'),edit=node('button','编辑报告'),save=node('button','保存新版本'),exporter=node('button','导出 Markdown');
 save.hidden=true;edit.disabled=Product.role!=='operator'||!!version;
 let input;
 edit.onclick=()=>{
  input=node('textarea','','report-editor');input.setAttribute('aria-label','报告正文');
  const saved=JSON.parse(localStorage.getItem('product-report-draft-'+r.id)||'null');input.value=saved?.content??r.content;
  if(saved&&saved.version!==r.version)Product.notify('报告已有新版本，已保留你的草稿，请核对后保存',true);
  input.oninput=()=>localStorage.setItem('product-report-draft-'+r.id,JSON.stringify({version:r.version,content:input.value}));
  body.replaceWith(input);navigation.hidden=true;save.hidden=false;edit.hidden=true;
 };
 save.onclick=async()=>{
  if(busy)return;busyUI(true);save.disabled=true;input.disabled=true;
  try{await action({type:'report.edit',id:r.id,version:r.version,content:input.value});localStorage.removeItem('product-report-draft-'+r.id);readReport(r.id);Product.notify('新版本已保存')}
  catch(e){if(e.uncertain)Product.pendingNotice();else if(e.status===409){try{store=await Product.read();readReport(r.id);Product.notify('报告已更新，已读取最新版本。你的手写草稿仍保留；点击编辑核对合并后再保存。',true)}catch{Product.notify('读取最新版本失败；手写草稿已保留，请刷新后核对。',true)}}else Product.notify(e.message+'；手写草稿已保留，重新打开编辑可恢复',true);save.disabled=false}
  finally{input.disabled=false;busyUI(false)}
 };
 exporter.onclick=()=>downloadReportFile(r,snapshot);
 sourceButton.onclick=()=>sources(snapshot.sources,sourceButton);tools.append(edit,save,exporter);paper.append(tools);
 const limitations=node('section','','report-document-limitations');limitations.append(node('h2','来源与适用边界'),node('p','统计依照正文所列日期与范围。事项进展和引用版本可在右侧核对。'));
 if(!(snapshot.sources||[]).length)limitations.append(node('p','本版本没有已记录的事项引用，请核对正文来源。'));
 paper.append(limitations);
 const versions=node('section','','report-version-list');versions.append(node('h2','版本记录'));
 for(const v of [r,...r.history.slice().reverse()]){
  const b=node('button','第 '+v.version+' 版'+(v.version===r.version?' · 最新':''),'text-button');
  b.setAttribute('aria-pressed',String(v.version===snapshot.version));b.append(node('small',formatReportDate(v.updatedAt)));
  b.onclick=()=>readReport(id,v.version===r.version?null:v.version);versions.append(b);
 }
 outline.append(versions);
 const references=node('section','','report-document-references');references.append(node('h2','事项来源'));
 for(const ref of snapshot.sources||[]){const a=node('a',ref.title+' · 引用第 '+ref.version+' 版');a.href='index.html?item='+encodeURIComponent(ref.id)+'&from=assistant&report='+encodeURIComponent(r.id)+'&version='+snapshot.version;references.append(a)}
 outline.append(references);layout.append(paper,outline);scroll.append(layout);
}

async function boot(){try{store=await Product.read();const report=params.get('report')||sessionStorage.getItem('product-report-view'),version=Number(params.get('version')||sessionStorage.getItem('product-report-version'))||null;const saved=store.sessions.find(s=>s.id===sessionStorage.getItem('product-session'));current=params.get('session')||(report?store.reports.find(r=>r.id===report)?.sessionId:null)||((!context.itemId||saved?.context.itemId===context.itemId)?saved?.id:null);if(current&&!session()){current=null;Product.notify('会话不存在，已打开新对话',true)}renderChat();if(report)readReport(report,version)}catch(e){$('conversation').hidden=false;$('conversation').textContent='读取失败：'+e.message+'。请刷新重试。';e.uncertain?Product.pendingNotice():Product.notify(e.message,true)}}
window.addEventListener('pagehide',savePrompt);boot();
