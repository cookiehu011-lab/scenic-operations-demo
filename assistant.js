import {renderReportDocument,formatReportDate} from './report-document.js';
const $=id=>document.getElementById(id), node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n};
let store,current=null,busy=false,reportId=null,reportVersion=null,sourceTrigger=null,context={};
const params=new URLSearchParams(location.search);if(params.get('item'))context.itemId=params.get('item');
const history=node('div','','history-list');$('history').replaceWith(history);
const historyHeading=document.querySelector('.history-label');historyHeading.textContent='会话记录';
const historySearch=node('input','','history-search');historySearch.type='search';historySearch.placeholder='搜索问题标题';historySearch.setAttribute('aria-label','搜索问题标题');history.before(historySearch);historySearch.oninput=()=>renderHistory();
$('conversation').replaceChildren();$('report-library').replaceChildren();$('report-reader').replaceChildren();
const returnLink=node('a','← 返回业务事项','product-link');returnLink.href='index.html'+(context.itemId?'?item='+encodeURIComponent(context.itemId):'');document.querySelector('.conversation-header').append(returnLink);
function avatar(){const image=node('img','','scenic-avatar');image.src='assets/scenic-ip.png';image.alt='小岚';return image}
function session(){return store?.sessions.find(s=>s.id===current)}
function busyUI(value){busy=value;document.querySelectorAll('#chat-tab,#reports-tab,#clear-context,.history-list button').forEach(button=>button.disabled=value);document.querySelector('.send').disabled=value;$('new-chat').disabled=value;document.querySelector('.composer-bottom>span').textContent=value?'小岚正在处理…':'回答附带来源，业务操作需确认';$('assistant-loading')?.remove();if(value&&!$('chat-view').hidden){const row=node('article','','answer assistant-loading');row.id='assistant-loading';row.setAttribute('role','status');const label=node('div','','answer-label');label.append(avatar(),node('strong','小岚 · 智能助手'));row.append(label,node('p','正在读取本地记录，请稍候…'));$('conversation').hidden=false;$('empty-chat').hidden=true;$('conversation').append(row);row.scrollIntoView({block:'end'})}else if(!$('conversation').children.length){$('conversation').hidden=true;$('empty-chat').hidden=false}}
async function action(payload){const r=await Product.act(payload);store=r.state;return r.result}
function closeSource(){ $('source-panel').hidden=true;document.querySelector('.assistant-shell').classList.remove('has-source');sourceTrigger?.focus();}
function sources(records,trigger){sourceTrigger=trigger;$('source-body').replaceChildren(node('p','引用为回答或报告生成时保存的事项版本。'));for(const ref of records||[]){const item=store.items.find(i=>i.id===ref.id);const a=node('a',(ref.title||item?.title||ref.id)+' · v'+ref.version,'event-reference');a.href='index.html?item='+encodeURIComponent(ref.id)+'&from=assistant&session='+encodeURIComponent(current||'')+(reportId?'&report='+reportId+(reportVersion?'&version='+reportVersion:''):'');$('source-body').append(a,node('p',item?'当前：'+item.status+' · v'+item.version:'当前记录不可见'));}document.querySelector('.assistant-shell').classList.add('has-source');$('source-panel').hidden=false;}
$('close-source').onclick=closeSource;document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSource()});
function tab(reports){closeSource();$('chat-view').hidden=reports;$('reports-view').hidden=!reports;$('chat-tab').setAttribute('aria-selected',String(!reports));$('reports-tab').setAttribute('aria-selected',String(reports));if(reports)renderReports();else{if(session())context=session().context;reportId=null;reportVersion=null;sessionStorage.removeItem('product-report-view');sessionStorage.removeItem('product-report-version');if(current)sessionStorage.setItem('product-session',current);else sessionStorage.removeItem('product-session');const url=new URL(location.href);url.searchParams.delete('report');url.searchParams.delete('version');if(current)url.searchParams.set('session',current);else url.searchParams.delete('session');if(context.itemId)url.searchParams.set('item',context.itemId);else url.searchParams.delete('item');window.history.replaceState(null,'',url);renderChat();}}
function chart(metrics,heading='事项状态统计（起）',caption='来源：事项处理记录'){const box=node('section','','chat-data'),title=node('h4',heading),controls=node('div','','product-toolbar'),graph=node('div'),table=node('table','','product-stat-table');table.hidden=true;const total=metrics.reduce((sum,m)=>sum+m.value,0);for(const m of metrics){const row=node('div','','bar-row'),track=node('div','','bar-track'),bar=node('i','','processing');bar.style.width=(total?m.value/total*100:0)+'%';track.append(bar);row.append(node('span',m.label),track,node('b',String(m.value)));graph.append(row);const tr=node('tr');tr.append(node('td',m.label),node('td',String(m.value)));table.append(tr)}for(const [label,on]of [['图表',true],['数据',false]]){const b=node('button',label);b.onclick=()=>{graph.hidden=!on;table.hidden=on};controls.append(b)}box.append(title,controls,graph,table,node('p',caption,'product-record-note'));return box}
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
  button.onclick=()=>{savePrompt();current=s.id;context=s.context;sessionStorage.setItem('product-session',current);tab(false)};history.append(button);
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
 const heading=node(active?'h4':'summary',active?'正在整理运营分析':'查看分析过程');
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
 section.querySelector('.assistant-event-detail')?.remove();
 const row=section.querySelector('[data-event-id="'+CSS.escape(item.id)+'"]');
 if(row)row.querySelector('.assistant-event-stage').textContent=item.resolution||item.status;
 const panel=node('section','','assistant-event-detail');
 panel.append(node('h4',item.title),node('p',[item.location,item.status,item.owner].filter(Boolean).join(' · '),'assistant-event-meta'));
 const latest=[...(item.records||[])].reverse().find(record=>record[0]!=='当前');
 const rows=[['最近记录',latest?[latest[1],latest[2]].filter(Boolean).join(' · '):'暂无处理记录'],['当前下一步',item.completed?'查看归档材料与处理记录':item.next||item.waitingFor]];
 const facts=node('dl');
 for(const [title,detail] of rows){
  const desc=node('div');
  desc.append(node('dt',title),node('dd',detail));
  facts.append(desc);
 }
 panel.append(facts);
 const link=node('a',item.completed?'查看归档与材料 ↗':'打开业务工作区 ↗','inline-business');
 link.href=itemUrl(item.id);
 panel.append(link);
 if(item.phase==='verify'&&Product.role==='operator'){
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
  form.append(node('h4','安排现场核查'),group,noteLabel,submit,status);
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
  panel.append(form);
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
  view.type='button';
  view.onclick=async()=>{
   if(busy||view.disabled)return;
   view.disabled=true;
   try{store=await Product.read();eventProgress(event,section)}
   catch(error){Product.notify(error.message,true)}
   finally{view.disabled=false}
  };
  row.append(identity,stage,view);
  section.append(row);
 }
 return section;
}
function renderAnswer(m){
 const a=node('article','','answer'),label=node('div','','answer-label');
 label.append(avatar(),node('strong','小岚 · 智能助手'));
 if(m.time)label.append(node('time',formatReportDate(m.time),'answer-time'));
 a.append(label,node('p',m.text,'answer-lead'));
 if(m.sources?.some(ref=>store.items.find(item=>item.id===ref.id)?.version!==ref.version))a.append(node('p','此回答为历史记录，相关事项已有更新。打开进展可查看当前状态。','answer-snapshot-note'));
 if(m.workflow?.length)a.append(workflowBox(m.workflow));
 const toolbar=node('div','','product-toolbar assistant-answer-tools'),source=node('button','查看依据');
 source.onclick=()=>sources(m.sources,source);
 if(m.sources?.length)toolbar.append(source);
 const savedReport=store.reports.find(report=>report.messageId===m.id);
 if(savedReport){
  const open=node('button','打开'+savedReport.title,'assistant-primary');
  open.onclick=()=>{if(!busy){tab(true);readReport(savedReport.id)}};
  toolbar.prepend(open);
 }else if(!m.unsupported&&(m.itemSnapshots?.length||m.operations?.weekly)){
  const generate=node('button',m.operations?.weekly?'生成运营周报':'生成报告草稿',m.operations?.weekly?'assistant-primary':'');
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
  a.append(chart(observation.areas.map(row=>({label:row.name,value:row.people})),'在园人数（人）',observation.capturedAt+' · 来源：运营大屏观测记录'));
  if(observation.traffic){
   const {queueVehicles,waitMinutes}=observation.traffic,{available,total}=observation.parking;
   a.append(node('p',`同一时点 · 入口排队 ${queueVehicles} 辆，预计等待 ${waitMinutes} 分钟，停车空位 ${available} / ${total} 个。`,'assistant-observation-note'));
  }
 }
 if(m.events?.length)a.append(eventList(m.events,weekly?'当前待跟进事项':'相关事项'));
 if(weekly&&m.itemSnapshots.length){
  const archive=m.itemSnapshots.map(row=>({id:row.id,title:row.title,location:row.location,phase:row.phase,resolution:row.resolution,status:row.status,site:row.createdAt?.slice(0,10)}));
  a.append(eventList(archive,'上周事件清单'));
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
 returnLink.href='index.html'+(context.itemId?'?item='+encodeURIComponent(context.itemId):'');
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
const letStepRender=()=>new Promise(resolve=>setTimeout(resolve,350));
$('composer').onsubmit=async e=>{
 e.preventDefault();
 const text=$('prompt').value.trim();
 if(!text||busy)return;
 const originDraftKey='product-prompt-'+(current||'new');
 const weekly=/上周/.test(text)&&/运营|周报|简报|报告/.test(text)&&!!window.BrowserStore;
 const reportRequested=/(?:生成|整理|制作|出一份).*(?:报告|周报|简报)/.test(text);
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
  }
  const s=await ensureSession();
  savePrompt();
  const result=await action({type:'session.message',id:current,version:s.version,text});
  if($('prompt').value.trim()===text){
   $('prompt').value='';
   sessionStorage.removeItem('product-prompt-'+current);
  }else savePrompt();
  if(originDraftKey!=='product-prompt-'+current)sessionStorage.removeItem(originDraftKey);
  if(reportRequested&&!result.message?.unsupported&&(result.message?.itemSnapshots?.length||result.message?.operations?.weekly)){
   if(weekly){
    setWorkflow([...(result.message.workflow||[]),{label:'生成报告草稿',detail:'保存这次统计和事项版本',state:'active'}]);
    await letStepRender();
   }
   await generateReport(true,result.message.id,!weekly);
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
  const reply=session()?.messages.filter(m=>m.role==='assistant').at(-1);
  const result=await action({type:'report.generate',sessionId:current,messageId:messageId||reply?.id});
  if(openReader){tab(true);readReport(result.reportId)}
  Product.notify('报告草稿已保存');
 }catch(error){error.uncertain?Product.pendingNotice():Product.notify(error.message,true)}
 finally{if(!alreadyBusy)busyUI(false)}
}
function renderReports(){ const url=new URL(location.href);url.searchParams.delete('report');url.searchParams.delete('version');window.history.replaceState(null,'',url);reportId=null;reportVersion=null;sessionStorage.removeItem('product-report-view');sessionStorage.removeItem('product-report-version'); $('view-title').textContent='报告文档';$('report-reader').hidden=true;$('report-library').hidden=false;const box=$('report-library');box.replaceChildren(node('h3','报告文档'));const search=node('input','','report-filter');search.type='search';search.placeholder='搜索报告名称';search.setAttribute('aria-label','搜索报告');box.append(search);const list=node('div');box.append(list);const render=()=>{const rows=store.reports.filter(r=>r.title.includes(search.value));list.replaceChildren(...rows.map(r=>{const b=node('button','','report-row');b.append(node('strong',r.title),node('span',r.status+' · v'+r.version,'report-state'),node('span',formatReportDate(r.updatedAt),'report-date'));const names=(r.sources||[]).map(source=>source.title).filter(Boolean);b.append(node('span',names.length?'范围：'+names.slice(0,2).join('、')+(names.length>2?' 等'+names.length+'项':''):'范围：未记录','report-scope'));b.onclick=()=>readReport(r.id);return b}));if(!rows.length)list.append(node('p','暂无匹配文档。可从对话生成报告草稿。','product-empty'))};search.oninput=render;render();}
function readReport(id,version=null){
 reportId=id;reportVersion=version;sessionStorage.setItem('product-report-view',id);if(version)sessionStorage.setItem('product-report-version',String(version));else sessionStorage.removeItem('product-report-version');
 const r=store.reports.find(x=>x.id===id);
 if(!r){Product.notify('报告不存在或不可见',true);return}
 if(version===r.version){version=null;reportVersion=null;sessionStorage.removeItem('product-report-version')}
 const snapshot=version?r.history.find(h=>h.version===version):r;
 if(!snapshot){Product.notify('该报告版本不存在',true);return}
 closeSource();$('report-library').hidden=true;$('report-reader').hidden=false;
 $('view-title').textContent=r.title;
 const box=$('report-reader');box.replaceChildren();
 const toolbar=node('div','','reader-toolbar'),back=node('button','← 报告文档','text-button'),chat=node('button','返回来源对话 ↗','text-button');
 back.onclick=renderReports;chat.onclick=()=>{savePrompt();current=r.sessionId;tab(false)};toolbar.append(back,chat);box.append(toolbar);
 const layout=node('div','','reader-layout'),paper=node('article','','report-paper'),outline=node('aside','','report-outline');
 paper.setAttribute('aria-label','报告阅读正文');
 paper.append(node('div',r.status+' · 第 '+snapshot.version+' 版'+(version?' · 历史版本':''),'report-eyebrow'),node('h1',r.title));
 const metadata=node('dl','','report-document-meta');
 for(const [label,value] of [['本版保存（北京时间）',formatReportDate(snapshot.updatedAt)],['引用快照（北京时间）',formatReportDate(r.snapshotAt)]]){
  const group=node('div');group.append(node('dt',label),node('dd',value));metadata.append(group);
 }
 paper.append(metadata);
 const {body,navigation}=renderReportDocument(snapshot.content,$('reports-view'));paper.append(body);outline.append(navigation);
 const tools=node('div','','product-toolbar report-document-actions'),edit=node('button','编辑报告'),save=node('button','保存新版本'),exporter=node('button','导出 Markdown'),source=node('button','查看来源');
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
 exporter.onclick=()=>{
  const blob=new Blob(['# '+r.title+'\n\n版本 v'+snapshot.version+' · '+r.status+'\n\n'+snapshot.content+'\n\n来源：事项处理记录。'],{type:'text/markdown;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=r.title+'-v'+snapshot.version+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 source.onclick=()=>sources(snapshot.sources,source);tools.append(edit,save,exporter,source);paper.append(tools);
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
 outline.append(references);layout.append(paper,outline);box.append(layout);
}

async function boot(){try{store=await Product.read();const report=params.get('report')||sessionStorage.getItem('product-report-view'),version=Number(params.get('version')||sessionStorage.getItem('product-report-version'))||null;const saved=store.sessions.find(s=>s.id===sessionStorage.getItem('product-session'));current=params.get('session')||(report?store.reports.find(r=>r.id===report)?.sessionId:null)||((!context.itemId||saved?.context.itemId===context.itemId)?saved?.id:null);if(current&&!session()){current=null;Product.notify('会话不存在，已打开新对话',true)}renderChat();if(report){tab(true);readReport(report,version)}}catch(e){$('conversation').hidden=false;$('conversation').textContent='读取失败：'+e.message+'。请刷新重试。';e.uncertain?Product.pendingNotice():Product.notify(e.message,true)}}
window.addEventListener('pagehide',savePrompt);boot();
