
const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(selected) {
  tabs.forEach(tab => {
    const active = tab === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
  });
}
tabs.forEach(tab => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    const target = { ArrowLeft: tabs[1 - tabs.indexOf(tab)], ArrowRight: tabs[1 - tabs.indexOf(tab)], Home: tabs[0], End: tabs.at(-1) }[event.key];
    if (!target) return;
    event.preventDefault();
    selectTab(target);
    target.focus();
  });
});

const get = id => document.getElementById(id);
const find = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
const steps = ['发现事项', '分析建议', '现场核查', '处置决策', '现场处置', '结果复核', '归档'];
const stages = ['全部', '待核查', '处理中', '待复核', '已结束'];
const stageParams=new URLSearchParams(location.search);
const stagePreview=stageParams.has('preview');
const requestedPhase=stageParams.get('preview');
const previewPhase=StageMaterials.phases.includes(requestedPhase)?requestedPhase:'review';
if(stagePreview)Product.act=async()=>{throw Error('阶段体验仅供查看，请返回当前事项办理')};
let items = [], store;
const draft = new Map();
let selected;
const remembered=JSON.parse(sessionStorage.getItem('product-business-view')||'{}');
let status = remembered.status>=0&&remembered.status<4?remembered.status:0;
const isClosed=item=>item.phase==='closed'||item.completed===true||item.stage===4;
let businessView='current';
const currentPosition={detail:0,list:0,side:0,page:0};
const archiveState={query:'',category:'',date:'',selected:null,open:false,scroll:0,positions:new Map(),tabs:new Map()};
get('category-filter').value=remembered.category||'';
get('event-search').value=remembered.query||'';
function remember(){if(stagePreview)return;sessionStorage.setItem('product-business-view',JSON.stringify({status,category:get('category-filter').value,query:get('event-search').value,id:selected?.id,listScroll:get('event-list').scrollTop,pageScroll:window.scrollY,detailScroll:businessView==='current'?find('.tracking-detail').scrollTop:currentPosition.detail}));}
function persistDraft(){if(stagePreview||!selected)return;const {feedbackAttachments,attachmentsLoading,...saved}=draft.get(selected);localStorage.setItem('product-draft-'+selected.id,JSON.stringify(saved));}
const disclosure = (button, panel, open) => {
  get(button).setAttribute('aria-expanded', String(open));
  if (button === 'source-button' || button === 'analysis-button') {
    const subject = button === 'source-button' ? '来源' : '分析依据';
    get(button).firstChild.textContent = (open ? '收起' : '查看') + subject + ' ';
  }
  get(panel).hidden = !open;
};
for (const [button, panel] of [['source-button','source-panel']]) {
  get(button).onclick = () => disclosure(button, panel, get(panel).hidden);
}
function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}
function displayTime(value){if(value==='当前')return '初始快照';if(!value?.includes('T'))return value;return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));}
function lines(panel, values) {
  get(panel).replaceChildren(...values.map(value => element('p', value)));
}
function renderList() {
  const category = get('category-filter').value;
  const query = get('event-search').value.trim().toLowerCase();
  const eligible = items.filter(item => (stagePreview||!isClosed(item)) && (!category || item.category === category) && [item.title, item.location].some(field => field.toLowerCase().includes(query)));
  const matches = eligible.filter(item => !status || item.stage === status);
  all('#status-filters button').forEach((chip,i) => {
    chip.replaceChildren(element('span',stages[i]),element('span',String(eligible.filter(item => !i || item.stage === i).length),'filter-count'));
    chip.setAttribute('aria-pressed', String(status === i));
  });
  get('list-total').textContent = items.filter(item=>stagePreview||!isClosed(item)).length + ' 项';
  updateViewCounts();
  get('list-summary').textContent = matches.length ? '显示 ' + matches.length + ' 项' : '没有匹配事项';
  if (!matches.includes(selected)) renderItem(matches[0]);
  get('event-list').replaceChildren(...matches.map(item => {
    const button = element('button','', 'event-card');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(item === selected));
    const heading = element('span','','card-heading');
    if (!category) heading.append(element('span',item.category,'card-type'));
    const spec = assistProfiles[['road','cable','rail','clean'].indexOf(item.businessType||item.id)];
    const badge = element('span',item.severity?item.severity+'风险':'等级未记录','semantic-badge risk-'+(item.severity||'unknown'));
    badge.title = '严重程度：'+(item.severity||'未记录');
    heading.append(badge);
    const meta = element('span','','event-meta');
    const state = element('span',stages[item.stage],'card-status state-'+item.stage);
    const place = element('span',item.location,'event-location');
    place.title = item.location;
    meta.append(state,place,element('time',item.time));
    button.append(heading,element('strong',item.title),meta);
    button.setAttribute('aria-label',[item.category,item.title,'严重程度'+item.severity,stages[item.stage],item.location,item.time].join('，'));
    button.onclick = () => {
      if(stagePreview){location.href='index.html?item='+item.id+'&preview='+(previewPhase==='decision'&&item.id!=='road'?'assign':previewPhase);return;}
      if (item !== selected) {persistDraft();renderItem(item);remember();}
      all('.event-card').forEach(card => card.setAttribute('aria-pressed', String(card === button)));
    };
    return button;
  }));
  const list = get('event-list');
  const active = list.querySelector('[aria-pressed=true]');
  if (active) {
    const offset = active.getBoundingClientRect().bottom - list.getBoundingClientRect().bottom;
    if (offset > 0) list.scrollTop += offset + 3;
  }
}
stages.slice(0,4).forEach((label,i) => {
  const chip = element('button',label);
  chip.type = 'button';
  chip.onclick = () => { status = i; renderList();remember(); };
  get('status-filters').append(chip);
});
get('category-filter').onchange = ()=>{renderList();remember()};
get('event-search').oninput = ()=>{renderList();remember()};


const evidenceScenes={
 road:{image:'road-scene.png',title:'入口道路场景示意',note:'复用认可稿道路素材；不代表该监测点当前现场。',values:[4,7,10,15,18],times:['14:00','14:05','14:10','14:15','14:20'],unit:'辆',trend:'排队车辆变化'},
 cable:{image:'cable-context.png',title:'索道候乘区场景示意',note:'AI生成的通用候乘场景，不是花台索道现场照片。',values:[26,34,42,38],times:['14:31','14:35','14:38','14:42'],unit:'人',trend:'候乘排队变化'},
 rail:{image:'rail-context.png',title:'步道护栏场景示意',note:'AI生成的通用护栏场景，不证明护栏松动或现场通行状态。'},
 clean:{image:'waste-context.png',title:'游客休息区场景示意',note:'AI生成的通用垃圾桶场景，不代表满溢现状，也不是清运后照片。'}
};
StageDetail.setScenes(evidenceScenes);
const evidenceDialog=element('dialog','','evidence-dialog');evidenceDialog.id='evidence-dialog';evidenceDialog.setAttribute('aria-label','查看事项场景示意');document.body.append(evidenceDialog);
function openEvidence(item,spec){
 evidenceDialog.replaceChildren();const header=element('div','','dialog-heading'),close=element('button','×');close.setAttribute('aria-label','关闭图片');close.onclick=()=>evidenceDialog.close();header.append(element('h2',item.title),close);
 const image=element('img','','evidence-large');image.alt=spec.title+' · 非现场证据';image.src='assets/'+spec.image;image.onerror=()=>{image.replaceWith(element('p','图片加载失败，未使用其他事项图片替代。','evidence-empty'))};
 evidenceDialog.append(header,image,element('p','场景示意 · 非现场证据 · '+spec.note,'evidence-caption'));evidenceDialog.showModal();
}
function renderEvidence(item) {
 if(evidenceDialog.open)evidenceDialog.close();
 const panel=get('other-evidence'),spec=evidenceScenes[item.id];
 const heading=element('div','','evidence-heading');heading.append(element('h2','事实与证据'));panel.replaceChildren(heading);
 const media=element('div','','item-evidence-media');
 if(spec){
  const figure=element('figure','','item-scene'),button=element('button','','evidence-image-button');button.type='button';button.disabled=true;button.setAttribute('aria-label','放大'+spec.title);
  const image=element('img');image.alt=spec.title+' · 非现场证据';const status=element('span','正在加载场景示意…','image-state');
  image.onload=()=>{status.textContent='示意 · 非现场证据';button.disabled=false};
  image.onerror=()=>{image.hidden=true;status.textContent='场景图加载失败 · 无现场照片可替代';button.disabled=true};
  image.src='assets/'+spec.image;button.append(image,status);button.onclick=()=>openEvidence(item,spec);
  figure.append(element('figcaption','场景预览','evidence-card-title'),button);media.append(figure);
  if(spec.values){
   const chart=element('section','','evidence-trend'),title=element('div','','evidence-card-heading');title.append(element('h3',spec.trend),element('span','示例数据','evidence-sample-tag'));chart.append(title,element('p',spec.times[0]+'—'+spec.times.at(-1)+' · 单位：'+spec.unit,'evidence-caption'));
   const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 360 140');svg.setAttribute('class','evidence-curve');svg.setAttribute('role','img');svg.setAttribute('aria-label',spec.times.map((t,i)=>t+' '+spec.values[i]+spec.unit).join('；')+'，示例趋势');
   const add=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;svg.append(n)};
   const max=item.id==='road'?20:50,x=i=>36+i*300/(spec.values.length-1),y=v=>108-v/max*80;
   [0,max/2,max].forEach(v=>{add('line',{x1:28,y1:y(v),x2:345,y2:y(v),class:'curve-grid'});add('text',{x:22,y:y(v)+4,'text-anchor':'end',class:'curve-label'},String(v))});
   add('path',{d:spec.values.map((v,i)=>(i?'L':'M')+x(i)+' '+y(v)).join(' '),class:'curve-line'});
   spec.values.forEach((v,i)=>{add('circle',{cx:x(i),cy:y(v),r:4,class:'curve-point'});add('text',{x:x(i),y:y(v)-10,'text-anchor':'middle',class:'curve-value'},String(v));add('text',{x:x(i),y:132,'text-anchor':'middle',class:'curve-label'},spec.times[i])});
   chart.append(svg);media.append(chart);
  }else{const facts=element('section','','evidence-facts');facts.append(element('h3','材料摘要'),element('p',item.evidence,'evidence-summary'));media.append(facts)}
 }
 panel.append(media);
 const missing=item.id==='clean'?'未提交清运前后影像':'现场影像未提交';
 heading.append(element('span',missing,'evidence-caption'));
 const records=(item.records||[]).filter(row=>row[0]!=='当前'&&!/AI|分析建议/.test(row[1]));
 const details=element('details','','evidence-record-details'),summary=element('summary','来源与反馈 · '+records.length+'条');details.append(summary,element('p',item.basis,'evidence-summary'));if(spec?.values)details.append(element('p',item.evidence,'evidence-summary'),element('p','趋势为示例数据，不作为现场分析依据。','evidence-caption'));
 const list=element('ol','','evidence-records');
 for(const [time,title,body] of records){const row=element('li','','evidence-record');row.append(element('time',displayTime(time)),element('strong',title),element('p',body));list.append(row)}
 if(!records.length)list.append(element('li','暂无可用文字记录，不能据此作出现场判断。'));
 details.append(list);panel.append(details);
}

function renderStagePreview(item){
 const banner=get('stage-preview-banner');banner.replaceChildren();banner.hidden=false;
 if(!stagePreview){banner.hidden=true;let a=get('stage-preview-link');if(!a){a=element('a','查看各阶段预览 →','product-link');a.id='stage-preview-link';find('.data-note p').append(a)}a.href='index.html?item='+item.id+'&preview='+item.phase;return;}
 banner.className='stage-preview-banner';const copy=element('div');copy.append(element('strong','阶段体验'),element('span','示例上传材料 · 只读预览'));const label=element('label','当前阶段 '),select=element('select');select.id='stage-preview-phase';select.setAttribute('aria-label','体验阶段');for(const key of StageMaterials.phases){if(key==='decision'&&item.id!=='road')continue;select.add(new Option(StageMaterials.map[key],key))}select.value=item.phase;select.onchange=()=>location.href='index.html?item='+item.id+'&preview='+select.value;label.append(select);const back=element('a','返回当前事项','product-link');back.href='index.html?item='+item.id;banner.append(copy,label,back);
 const url=new URL(location.href);url.searchParams.set('item',item.id);url.searchParams.set('preview',item.phase);window.history.replaceState(null,'',url);
 find('.product-role').hidden=true;get('assistant-toggle').hidden=true;get('assistant-panel').hidden=true;find('.next-step').hidden=true;
}
function renderItem(item) {
  closeSource(false);
  const changed=selected?.id!==item?.id;
  selected = item;
  if(changed)find('.tracking-detail').scrollTop=0;
  get('selected-detail').hidden = businessView!=='current'||!item;
  get('empty-detail').hidden = businessView!=='current'||!!item;
  if (!item) return;
  const road = item === items[0];
  get('event-title').textContent = item.title;
  const badge = find('.object-summary .status');
  badge.replaceChildren(element('span', item.status || stages[item.stage]));
  badge.className = 'status stage-' + item.stage;
  const stamp = find('.object-summary time');
  const occurred=archiveOccurred(item);
  stamp.textContent=occurred?archiveTime(occurred):'日期未登记 · '+item.time;
  if(occurred)stamp.dateTime=occurred;else stamp.removeAttribute('datetime');
  stamp.hidden=true;let context=get('event-context');if(!context){context=element('div','','object-context');context.id='event-context';find('.object-header').append(context)}context.replaceChildren(element('span',item.category),element('span','编号 '+item.id),element('span',occurred?displayTime(occurred):'发现时刻 '+item.time));
  const current = ({verify:2,verify_feedback:2,decision:3,assign:4,feedback:4,review:5,closed:6})[item.phase];
  const patterns=[/收到|上报/,/分析建议/,/核查有效|确认队尾|现场确认/,/人工确认方案|安排保洁/,/登记本地安排|开始分段|安排保洁/,/复核通过/,/复核通过|误报终止|重复合并/];
  const terminated=item.phase==='closed'&&item.resolution!=='正常完成';
  all('.workflow li').forEach((step,i)=>{
    const record=!road&&i===3?null:item.records.find(row=>patterns[i].test(row[1]));
    const done=!!record, active=item.phase!=='closed'&&i===current;
    step.className=active?'current':done?'done':'';
    if(active)step.setAttribute('aria-current','step');else step.removeAttribute('aria-current');
    step.querySelector('.step-dot').textContent=active?i+1:done?'✓':i+1;
    step.querySelector('strong').textContent=i===6&&terminated?'终止留存':road&&i===0?'发现预警':steps[i];
    step.querySelector('small').textContent=active?'当前阶段':record?(record[0]==='体验材料'?'已记录':record[0].includes('T')?record[0].slice(11,16):record[0]):active?'当前阶段':i===3&&!road?'按业务无需决策':terminated?'未执行':i<current?'未单独记录':'待开始';
  });
  find('.fact-summary').textContent = item.summary;
  const facts = all('.fact-grid dd');
  facts[0].textContent = item.location;
  const factTime = element('time',item.time);
  if(occurred)factTime.dateTime=occurred;
  facts[1].replaceChildren(factTime);
  facts[2].textContent = item.source;
  find('.fact-grid dt').lastChild.textContent = road ? '预警位置' : '事项位置';
  find('.scope-note').hidden = true;
  get('other-evidence').hidden=true;
  find('.fact-block').hidden=true;
  StageDetail.render(item,{preview:stagePreview,phase:item.phase});
  renderStagePreview(item);
  const sourceNotes = [
    ['原始记录：14:20 道路预警。', '附件说明：页面图片与趋势为示意，不属于原始监测附件。'],
    ['关联记录：14:38 现场巡查 · 14:41 分段放行处置记录。'],
    ['记录形式：巡查文字上报；未附现场照片。'],
    ['关联记录：13:59 满溢巡查 · 14:16 保洁清运反馈。']
  ];
  lines('source-panel', [...sourceNotes[items.indexOf(item)], '覆盖范围：'+item.scope]);
  disclosure('source-button','source-panel',false);
  StageDetail.renderRecords(item,find('.timeline'));
  selectTab(get('detail-tab'));
  find('.action-intro h3').textContent = item.action;find('.action-intro h3').hidden=true;
  find('.action-intro .not-sent').textContent = item.flag;
  find('.action-block > p').textContent = item.task;
  find('.next-step span').textContent = item.next;
  const actionLabel = ['','核查安排','跟进安排','复核安排'][item.stage];
  get('review-button').firstChild.textContent = '预览' + actionLabel + ' ';
  get('assignee-label').textContent = ['','现场核查人员','处置跟进人员','结果复核人员'][item.stage];
  get('assignee').replaceChildren(new Option('请选择人员',''), ...item.people.map(person => new Option(person)));
  get('note').placeholder = item.placeholder;
  get('assignee').value = draft.get(item)[item.phase==='assign'?'disposalPerson':'person']||'';
  get('note').value = draft.get(item)[item.phase==='assign'?'disposalNote':'note']||'';
  get('assistant-context').textContent = '当前事项：' + item.title;
  get('assistant-input').value = draft.get(item).input;
  showAssistant(draft.get(item).assistant);
  renderChat();
  renderAssist();
  get('assist-strip').hidden=stagePreview||!['verify','feedback'].includes(item.phase);
  renderActions();
}

get('assignee').onchange = event => { draft.get(selected)[selected.phase==='assign'?'disposalPerson':'person'] = event.target.value; persistDraft(); };
get('note').oninput = event => { draft.get(selected)[selected.phase==='assign'?'disposalNote':'note'] = event.target.value; updateAdoption(); persistDraft(); };
const dialog = get('preview-dialog');
get('assignment-form').onsubmit = event => {event.preventDefault();previewAssignment()};
get('close-dialog').onclick = () => dialog.close();

function showAssistant(open) {
  disclosure('assistant-toggle','assistant-panel',open);
  find('#assistant-toggle > span').textContent = open ? '收起小岚' : '询问小岚';
}
const assistantAvatar=element('img','','scenic-avatar');assistantAvatar.src='assets/scenic-ip.png';assistantAvatar.alt='';assistantAvatar.setAttribute('aria-hidden','true');find('#assistant-toggle > svg').replaceWith(assistantAvatar);
get('assistant-toggle').onclick = () => {
  const open = get('assistant-panel').hidden;
  draft.get(selected).assistant = open;
  showAssistant(open);
  if (open) get('assistant-input').focus();
};
get('assistant-input').oninput = event => { draft.get(selected).input = event.target.value; persistDraft(); };
function reply(item, question) {
  if (/(天气|票价|全园|其他事项|代我|帮我派|立即派|直接派|执行|通知)/.test(question) || items.some(other => other !== item && question.includes(other.title))) return '当前助手只能解释「' + item.title + '」的样例记录，无法查询外部信息或执行操作。';
  if (/依据|来源|证据|数据|照片|趋势/.test(question)) return item.evidence + ' ' + item.scope;
  if (/建议|为什么|原因|分析|待核实/.test(question)) return item.reason + ' ' + item.advice + '。';
  if (/下一步|怎么|如何处理|安排|还要/.test(question)) return item.task + ' ' + item.next;
  if (/进展|状态|处理了|反馈|进度/.test(question)) return '当前' + stages[item.stage] + '。' + item.summary;
  if (/发生|事实|哪里|位置|时间|何时|情况/.test(question)) return item.time + ' · ' + item.location + '。' + item.summary;
  return '当前记录没有提供这方面的信息。可以问我这件事项的事实、分析依据、进展或下一步。';
}
function renderChat() {
  const log = get('chat-log');
  const messages = draft.get(selected).messages;
  log.replaceChildren(...(messages.length ? messages.map(([role,message]) => {
    const row = element('div','', 'chat-message ' + (role === '你' ? 'chat-user' : 'chat-assistant'));
    if(role!=='你'){const image=element('img','','scenic-avatar');image.src='assets/scenic-ip.png';image.alt='小岚';row.append(image)}
    row.append(element('strong',role==='你'?role:'小岚'), element('p',message));
    return row;
  }) : [element('p','可以问这件事项的事实、依据、进展或下一步。','chat-empty')]));
  log.scrollTop = log.scrollHeight;
}
get('assistant-form').onsubmit = async event => {
 event.preventDefault(); const item=selected, state=draft.get(item), text=get('assistant-input').value.trim();if(!text||busy)return;
 busy=true;
 try{if(!state.sessionId){const r=await Product.act({type:'session.create',context:{itemId:item.id}});store=r.state;state.sessionId=r.result.id||r.result.sessionId;}
 const session=store.sessions.find(x=>x.id===state.sessionId);
 const r=await Product.act({type:'session.message',id:state.sessionId,version:session.version,text});store=r.state;
 const current=store.sessions.find(x=>x.id===state.sessionId);state.messages=current.messages.map(m=>[m.role==='user'?'你':'助手',m.text||m.content]);state.input='';
 if(selected===item){get('assistant-input').value='';renderChat();}persistDraft();
 }catch(e){e.uncertain?Product.pendingNotice():Product.notify(e.message,true)}finally{busy=false}
};
// Local illustrative sources are not published procedures or real work orders.
const assistProfiles = [
  {badge:'拥堵偏高',tone:'warning',kind:'action',note:'核实入口上游排队原因和影响范围，并反馈现场情况。',sourceIndexes:[0],boundary:'示例趋势与场景图不作为分析依据；取得现场反馈后再决定是否疏导。'},
  {badge:'排队积聚',tone:'warning',kind:'fyi',note:'',sourceIndexes:[1,2],boundary:'跟进提示：分段放行已经开始，当前仅提示观察队尾变化，不预填新的处置安排。'},
  {badge:'护栏异常',tone:'warning',kind:'action',risk:'unapproved',note:'核实护栏松动程度与通行风险。',sourceIndexes:[0],boundary:'只有文字线索，通行风险与授权尚未核实；请先核实现场，暂不提供采纳。'},
  {badge:'清运待复核',tone:'neutral',kind:'action',note:'复核垃圾桶是否恢复使用，检查周边地面残留并反馈结果。',sourceIndexes:[1,3],boundary:'清运反馈不等于复核通过；本建议仅辅助填写复核要点。'}
];
let activeSource = null;
let sourceTrigger = null;
function adoptionPolicy(item, spec, state) {
  if (!['verify','assign'].includes(item.phase) || Product.role!=='operator' || state.adopted || item.adviceHistorical || item.completed || item.archived || !item.action || spec.kind === 'fyi' || !spec.sourceIndexes.length || spec.risk === 'unapproved' || spec.ambiguous) return 'readonly';
  return spec.note ? 'adopt' : 'readonly';
}
function currentProfile() { return assistProfiles[['road','cable','rail','clean'].indexOf(selected.businessType||selected.id)]; }
function sourceTarget() { return get('stage-detail'); }
function highlightSource(on) {
  all('.source-highlight').forEach(node=>node.classList.remove('source-highlight'));
  if(on && selected) sourceTarget().classList.add('source-highlight');
}
function closeSource(restore=true) {
  if (!get('source-drawer')) return;
  get('source-drawer').hidden = true;
  highlightSource(false);
  all('.source-chip').forEach(node=>{node.setAttribute('aria-expanded','false');node.textContent=node.dataset.closedLabel||node.textContent;node.setAttribute('aria-label','查看来源：'+node.title)});
  activeSource = null;
  const trigger = sourceTrigger;
  sourceTrigger = null;
  if(restore && trigger?.isConnected) trigger.focus({preventScroll:true});
}
function assistSources(item) {
  const spec=assistProfiles[['road','cable','rail','clean'].indexOf(item.businessType||item.id)];
  return [
    {label:'核查要点',title:'本事项核查与反馈要点',meta:'根据当前事项内容整理 · 未引用已发布规程',body:[item.task,spec.boundary],full:item.task+' '+item.next},
    {label:'事项记录',title:item.title+' · 记录依据',meta:item.location+' · 本地业务记录',body:[item.summary,item.scope],full:item.records.map(row=>displayTime(row[0])+' · '+row.slice(1).join(' · ')).join('；')}
  ];
}

function openSource(index,button) {
  const record=assistSources(selected)[index];
  if(activeSource===index&&!get('source-drawer').hidden){closeSource();return;}
  activeSource=index;sourceTrigger=button;
  get('source-drawer-title').textContent=record.title;
  get('source-drawer-meta').textContent=record.meta;
  get('source-drawer').querySelector('.source-disclaimer').textContent='内容来自本事项记录和核查要点，不表示已发布规程或外部工单。';
  get('source-drawer-body').replaceChildren(...record.body.map(text=>element('p',text)));
  get('source-drawer-full').textContent=record.full;
  get('source-drawer').querySelector('details').open=false;
  get('assist-strip').append(get('source-drawer'));
  get('source-drawer').hidden=false;
  all('.source-chip').forEach(node=>{node.setAttribute('aria-expanded',String(node===button));node.textContent=node===button?'收起'+record.label:node.dataset.closedLabel;node.setAttribute('aria-label',(node===button?'收起':'查看')+'来源：'+node.title)});
  highlightSource(true);

}
get('close-source-drawer').onclick=()=>closeSource();
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!get('source-drawer').hidden&&!get('preview-dialog').open){event.preventDefault();closeSource();}
});
function updateAdoption() {
  if(!selected)return;
  const state=draft.get(selected),spec=currentProfile();
  const readonly=adoptionPolicy(selected,spec,state)==='readonly';
  get('assist-actions').hidden=readonly;
  const occupied=!!state.note.trim()&&state.note.trim()!==spec.note;
  get('assist-adopt').disabled=occupied;
  get('assist-feedback').textContent=!readonly&&occupied?'已有补充说明，已保留。请手动合并建议要点。':'';
  get('suggestion-origin').hidden=!state.adopted||selected.phase!=='verify';
  get('suggestion-origin').textContent=state.note===spec.note?'来自建议：'+selected.advice:'来自建议，已由你编辑';
  get('prefill-status').hidden=!state.adopted||selected.phase!=='verify';
  find('.action-intro .not-sent').hidden=state.adopted&&selected.phase==='verify';
}
function followupAdvice(item){
 if(item.records.some(row=>row[1]==='退回补充'))return '按复核退回要求补充处置反馈和关联材料';
 return ({cable:'继续跟进分段放行，核实队尾位置和入口通行情况',road:'跟进入口引导情况，补充影响范围与通行反馈',rail:'跟进护栏处理，补充检修结果与通行限制',clean:'跟进清运与周边清扫，补充桶点使用情况'})[item.id];
}
function renderAssist() {
  const state=draft.get(selected),spec=currentProfile();
  get('assist-strip').dataset.state=state.adopted?'adopted':state.dismissed?'dismissed':state.assistOpen?'expanded':'hint';
  get('assist-advice').textContent=selected.phase==='feedback'?followupAdvice(selected):selected.advice;
  get('assist-toggle').setAttribute('aria-expanded',String(state.assistOpen));
  get('assist-toggle').replaceChildren(document.createTextNode(state.assistOpen?'收起':'展开'),element('span',state.assistOpen?'⌃':'⌄'));
  get('assist-state').textContent=state.adopted?'已采纳':state.dismissed?'暂不采纳':selected.phase==='feedback'||spec.kind==='fyi'?'跟进提示':state.assistOpen?'已展开':'';
  get('assist-state').classList.toggle('adopted',state.adopted);
  get('assist-content').hidden=!state.assistOpen;
  get('assist-reason').textContent=selected.phase==='feedback'?'根据已登记的处置记录整理跟进要点；效果以补充的现场反馈为准。':selected.reason;
  get('assist-sources').replaceChildren(...assistSources(selected).map((record,index)=>{
    const chip=element('button',(activeSource===index?'收起':'查看')+record.label,'source-chip');chip.type='button';chip.dataset.closedLabel='查看'+record.label;
    chip.dataset.sourceIndex=String(index);
    chip.title=record.title;chip.setAttribute('aria-label','查看来源：'+record.title);
    chip.setAttribute('aria-controls','source-drawer');chip.setAttribute('aria-expanded',String(activeSource===index));
    chip.onmouseenter=()=>highlightSource(true);chip.onmouseleave=()=>highlightSource(activeSource!==null);
    chip.onfocus=()=>highlightSource(true);chip.onblur=()=>highlightSource(activeSource!==null);
    chip.onclick=()=>openSource(index,chip);
    return chip;
  }));
  if(activeSource!==null) sourceTrigger=get('assist-sources').querySelector('[data-source-index="'+activeSource+'"]');
  const unread=items.filter(item=>!isClosed(item)&&assistProfiles[['road','cable','rail','clean'].indexOf(item.businessType||item.id)]?.kind==='action'&&!draft.get(item).seen).length;
  get('assist-unread').textContent=String(unread);get('assist-unread').hidden=!unread;
  get('assist-unread').title='本页还有 '+unread+' 条建议未查看';
  updateAdoption();
}
get('assist-toggle').onclick=()=>{
  const state=draft.get(selected);state.assistOpen=!state.assistOpen;
  if(state.assistOpen){state.seen=true;state.dismissed=false;}else closeSource(false);
  renderAssist();persistDraft();
};
get('assist-adopt').onclick=()=>{
  const state=draft.get(selected),spec=currentProfile();
  if(adoptionPolicy(selected,spec,state)==='readonly'||state.note.trim()&&state.note.trim()!==spec.note)return;
  state.note=spec.note;state.adopted=true;state.dismissed=false;state.assistOpen=true;
  get('note').value=state.note;
  renderAssist();persistDraft();
};
get('assist-dismiss').onclick=()=>{
  const state=draft.get(selected);state.dismissed=true;state.assistOpen=false;
  closeSource(false);renderAssist();persistDraft();get('assist-toggle').focus();
};

let busy=false;
const actionHost=element('div','','product-actions');actionHost.id='product-actions';get('assignment-form').after(actionHost);
const expand=element('a','展开到智能助手 ↗','product-link');expand.href='assistant.html';get('assistant-panel').append(expand);
expand.onclick=()=>{persistDraft();expand.href='assistant.html?item='+selected.id+(draft.get(selected).sessionId?'&session='+draft.get(selected).sessionId:'');};
function field(label,tag='textarea',options=[]){const wrap=element('label',label),input=document.createElement(tag);input.setAttribute('aria-label',label);input.disabled=busy;if(tag==='select')options.forEach(([value,text])=>input.add(new Option(text,value)));wrap.append(input);actionHost.append(wrap);return input;}
async function performAction(item,payload){
 if(stagePreview||busy)return false;busy=true;renderActions();
 try{
  const r=await Product.act(payload);store=r.state;Object.assign(item,store.items.find(x=>x.id===item.id));if(payload.type==='item.feedback')draft.get(item).feedbackAttachments=[];persistDraft();renderItem(item);renderList();if(businessView==='history')renderArchiveList();
  Product.notify('已保存本地业务记录；未向外部系统发送通知');return true;
 }catch(e){
  e.uncertain?Product.pendingNotice():Product.notify(e.message,true);
  if(!e.uncertain)try{store=await Product.read();store.items.forEach(x=>Object.assign(items.find(i=>i.id===x.id)||{},x));renderItem(item);renderList()}catch{}
  return false;
 }finally{busy=false;renderActions()}
}
function command(label,op,values,primary=false){
 const button=element('button',label,primary?'primary':'');button.type='button';
 button.disabled=busy||!!draft.get(selected)?.attachmentsLoading||Product.role==='viewer'||(op==='review'&&Product.role!=='reviewer')||(op!=='review'&&Product.role!=='operator');
 button.onclick=()=>{if(![...actionHost.querySelectorAll('[required]')].every(input=>input.reportValidity()))return;const item=selected,payload={type:'item.'+op,id:item.id,version:item.version,...values()};return performAction(item,payload)};
 actionHost.append(button);
}
function previewAssignment(){
 if(stagePreview||busy||Product.role!=='operator'||!['verify','assign'].includes(selected.phase))return;
 if(!get('assignment-form').reportValidity())return;
 const item=selected,isVerification=item.phase==='verify';
 const payload={type:isVerification?'item.verify_assign':'item.assign',id:item.id,version:item.version,owner:get('assignee').value,note:get('note').value};
 get('dialog-title').textContent=isVerification?'确认核查安排':'确认处置安排';
 lines('dialog-content',['事项：'+item.title,'安排类型：'+(isVerification?'现场核查':'现场处置'),'责任人员 / 班组：'+payload.owner,'补充说明：'+(payload.note.trim()||'无'),'保存后'+(isVerification?'等待核查反馈，再决定后续处置。':'等待处置反馈，再进入结果复核。'),'仅保存本地安排，不表示通知已送达、人员已接单或现场已执行。']);
 const actions=element('div','','product-toolbar'),cancel=element('button','返回修改'),confirm=element('button',isVerification?'确认保存核查安排':'确认保存处置安排');
 cancel.type=confirm.type='button';cancel.onclick=()=>dialog.close();
 confirm.onclick=async()=>{confirm.disabled=true;cancel.disabled=true;const done=await performAction(item,payload);if(done)dialog.close();else{confirm.disabled=false;cancel.disabled=false}};
 actions.append(cancel,confirm);get('dialog-content').append(actions);dialog.showModal();
}
function renderFeedbackAttachments(item){
 const state=draft.get(item),section=element('section','','feedback-materials'),label=element('label','','feedback-upload-zone'),input=element('input');input.id='feedback-images';input.type='file';input.multiple=true;input.accept='image/jpeg,image/png,image/webp';input.setAttribute('aria-label','选择现场图片');input.disabled=busy||state.attachmentsLoading||Product.role!=='operator';label.append(input,element('span','＋ 添加照片','feedback-upload-title'),element('small','JPG、PNG、WebP'));const heading=element('div','','feedback-material-heading');heading.append(element('strong','现场材料'),element('span','选填'));section.append(heading,label);
 const attachments=state.feedbackAttachments||[];
 section.append(element('p',state.attachmentsLoading?'正在读取所选图片…':attachments.length?attachments.length+' 张待提交 · 提交反馈后保存':'最多 3 张 · 单张不超过 2 MB','feedback-material-status'));
 const previews=element('div','','feedback-previews');
 attachments.forEach((file,index)=>{const figure=element('figure'),image=element('img');image.src='data:'+file.type+';base64,'+file.data;image.alt=file.name+' · 待提交';const caption=element('figcaption',file.name),remove=element('button','×');remove.type='button';remove.setAttribute('aria-label','移除图片：'+file.name);remove.disabled=busy||state.attachmentsLoading||Product.role!=='operator';remove.onclick=()=>{state.feedbackAttachments.splice(index,1);renderActions()};figure.append(image,caption,remove);previews.append(figure)});
 section.append(previews);actionHost.append(section);
 input.onchange=async()=>{
  const files=[...input.files];if(!files.length)return;
  if(files.length+state.feedbackAttachments.length>3){input.value='';Product.notify('最多选择 3 张现场图片，请先移除不需要的图片。',true);return}
  const invalid=files.find(file=>!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size===0||file.size>2*1024*1024);
  if(invalid){input.value='';Product.notify('请选择 JPG、PNG 或 WebP 图片，每张不超过 2 MB。',true);return}
  state.attachmentsLoading=true;renderActions();
  try{
   const attachments=await Promise.all(files.map(file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({name:file.name,type:file.type,data:String(reader.result).split(',')[1]});reader.onerror=()=>reject(Error('图片读取失败，请重新选择。'));reader.readAsDataURL(file)})));
   state.feedbackAttachments.push(...attachments);
  }catch(error){Product.notify(error.message,true)}finally{state.attachmentsLoading=false;if(selected===item)renderActions()}
 };
}
function renderActions(){
 const item=selected;if(!item)return;actionHost.replaceChildren();
 const assign=item.phase==='assign',verification=item.phase==='verify',arrange=assign||verification;
 get('assignment-form').hidden=!arrange;get('review-button').hidden=!arrange;
 get('review-button').disabled=stagePreview||busy||Product.role!=='operator';get('review-button').firstChild.textContent=verification?'预览核查安排 ':'预览处置安排 ';
 get('assignee').disabled=busy||!arrange||Product.role!=='operator';get('note').readOnly=busy||Product.role!=='operator';get('assignee').closest('label').hidden=!arrange;get('assignee').required=arrange;
 get('assignee-label').textContent=verification?'现场核查人员 / 班组':'现场处置人员 / 班组';
 const phaseLabels={verify:'安排现场核查',verify_feedback:'等待核查反馈',decision:'人工处置决策',assign:'安排现场处置',feedback:'提交处置反馈',review:'复核处置结果',closed:'已结束'};
 const descriptions={verify:'指定人员核实现场情况和影响范围，并反馈核查依据。',verify_feedback:'登记责任组反馈的现场事实、依据及核查结论。',decision:'结合已登记核查事实，确认景区职责内的处置方案。',assign:'核对处置责任组与要求，预览后确认安排。',feedback:'将已经获得的处置结果和来源登记到本事项。',review:'核对处置反馈与依据，决定通过或退回补充。',closed:'本事项已经结束，原始事实与完整过程保留。'};
 get('action-heading').textContent=phaseLabels[item.phase];find('.action-intro h3').textContent=phaseLabels[item.phase];find('.action-intro h3').hidden=true;find('.action-block > p').textContent=descriptions[item.phase];find('.action-block > p').hidden=item.phase==='feedback';
 find('.action-intro .not-sent').textContent=verification?'尚未安排':item.phase==='feedback'?'待反馈':item.waitingFor||item.owner||item.status;
 find('.next-step span').textContent=verification?'确认安排后等待核查反馈，再评估是否需要处置。':item.next;
 if(item.phase==='closed'){
  all('.action-block input,.action-block textarea,.action-block select,.action-block button').forEach(control=>control.disabled=true);
  actionHost.append(element('p',item.resolution||'事项已结束，原始记录保留。'));
  if(item.duplicateOf){const a=element('a','查看关联主事项：'+(items.find(row=>row.id===item.duplicateOf)?.title||item.duplicateOf)+' ↗','product-link');a.href='index.html?item='+item.duplicateOf;actionHost.append(a)}return;
 }
 if(Product.role==='viewer')actionHost.append(element('p','当前角色只读，可查看事实与完整处理记录。','product-record-note'));
 if(item.phase==='verify_feedback'){
  actionHost.append(element('p','等待对象：'+(item.verificationAssignment?.owner||item.waitingFor||'原核查责任组'),'waiting-owner'));
  const itemDraft=draft.get(item);itemDraft.verificationDrafts??={};const cycle=String(item.verificationAssignment?.version||item.version);const state=itemDraft.verificationDrafts[cycle]??={};const note=field('核查反馈说明'),evidence=field('核查反馈来源与证据');
  note.value=state.verificationText||'';evidence.value=state.verificationEvidence||'';
  note.oninput=()=>{state.verificationText=note.value;persistDraft()};evidence.oninput=()=>{state.verificationEvidence=evidence.value;persistDraft()};
  const outcome=field('核查结果','select',[['valid','确认有效，进入后续办理'],['false','误报，终止留存'],['duplicate','重复，关联原事项']]);outcome.value=state.verificationOutcome||'valid';
  const target=field('关联原事项','select',[['','请选择原事项'],...items.filter(x=>x.id!==item.id&&!x.completed&&!x.duplicateOf).map(x=>[x.id,x.title])]);target.value=state.verificationTarget||'';target.parentElement.hidden=outcome.value!=='duplicate';
  outcome.onchange=()=>{state.verificationOutcome=outcome.value;target.parentElement.hidden=outcome.value!=='duplicate';persistDraft()};target.onchange=()=>{state.verificationTarget=target.value;persistDraft()};
  command('保存核查反馈','verify_feedback',()=>({text:note.value,evidence:evidence.value,outcome:outcome.value,targetId:target.value}),true);
 }else if(item.phase==='decision'){
  const note=field('人工决定与处置范围');note.value=draft.get(item).decisionNote||'';note.oninput=()=>{draft.get(item).decisionNote=note.value;persistDraft()};
  actionHost.append(element('p','仅登记景区职责范围内的安排；外部交通管制需有权部门办理。','product-record-note'));
  command('确认处置方案','decide',()=>({approve:true,note:note.value}),true);command('退回重新核查','decide',()=>({approve:false,note:note.value}));
 }else if(item.phase==='feedback'){
  const state=draft.get(item);state.feedbackAttachments??=[];
  actionHost.append(element('p','现场责任：'+(item.owner||item.assignment?.owner||'尚未登记责任班组'),'feedback-owner'));
  const condition=field('当前情况','select',[['','请选择当前情况'],['ongoing','仍需处置'],['improved','情况改善'],['resolved','已恢复']]);condition.id='feedback-condition';condition.required=true;condition.value=state.condition||'';
  condition.parentElement.insertBefore(element('span','必填','required'),condition);condition.onchange=()=>{state.condition=condition.value;persistDraft()};
  const note=field('现场反馈说明');note.rows=3;note.required=true;note.parentElement.insertBefore(element('span','必填','required'),note);note.value=state.feedback||'';const source=element('details','','feedback-source-note');source.append(element('summary','补充来源说明（选填）'));const evidence=element('input');evidence.id='feedback-source';evidence.setAttribute('aria-label','补充来源说明');evidence.type='text';evidence.placeholder='有其他来源或材料说明时填写';evidence.value=state.evidence||'';source.append(evidence);
  note.oninput=()=>{state.feedback=note.value;persistDraft()};evidence.oninput=()=>{state.evidence=evidence.value;persistDraft()};
  renderFeedbackAttachments(item);actionHost.append(source);
  command('提交处置反馈','feedback',()=>({text:note.value,evidence:evidence.value,condition:condition.value,attachments:state.feedbackAttachments.map(({name,type,data})=>({name,type,data}))}),true);
 }else if(item.phase==='review'){
  const reason=field('复核结论');reason.value=draft.get(item).review||'';reason.oninput=()=>{draft.get(item).review=reason.value;persistDraft()};
  command('复核通过并结束','review',()=>({approve:true,reason:reason.value}),true);command('退回补充反馈','review',()=>({approve:false,reason:reason.value}));
 }

 updateAdoption();
 if(stagePreview){all('.action-block input,.action-block textarea,.action-block select,.action-block button').forEach(control=>control.disabled=true);actionHost.querySelectorAll('.product-record-note').forEach(note=>note.remove());}
}
function updateViewCounts(){
 if(!get('current-view'))return;
 get('current-view').replaceChildren(document.createTextNode('当前事件'),element('span',String(items.filter(item=>!isClosed(item)).length)));
 get('history-view').replaceChildren(document.createTextNode('历史事件'),element('span',String(items.filter(isClosed).length)));
}
function archiveOccurred(item){
 const value=item.occurredAt||item.createdAt||item.records?.[0]?.[0];
 return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)?value:null;
}
function archiveEnded(item){return [...(item.records||[])].reverse().find(row=>/复核通过|误报终止|重复合并/.test(row[1]))?.[0]||null}
function archiveDuration(item){const begin=archiveOccurred(item),end=archiveEnded(item);if(!begin||!end?.includes('T'))return '未记录';const minutes=Math.round((new Date(end)-new Date(begin))/60000);return minutes>=0?minutes+' 分钟':'未记录'}
function archiveTime(value,fallback){return value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)):'日期未记录'+(fallback?' · '+fallback:'')}
function archiveSavePosition(){if(archiveState.open&&archiveState.selected)archiveState.positions.set(archiveState.selected,get('archive-drawer').scrollTop)}
function switchBusinessView(next){
 if(stagePreview||businessView===next)return;
 const detail=find('.tracking-detail'),side=find('.tracking-list');
 if(businessView==='current'){persistDraft();currentPosition.detail=detail.scrollTop;currentPosition.list=get('event-list').scrollTop;currentPosition.side=side.scrollTop;currentPosition.page=window.scrollY;}
 else{archiveSavePosition();archiveState.scroll=detail.scrollTop;}
 businessView=next;const history=next==='history';
 find('.page-shell').classList.toggle('archive-mode',history);
 get('current-view').setAttribute('aria-pressed',String(!history));get('history-view').setAttribute('aria-pressed',String(history));
 for(const child of [...side.children])if(!child.classList.contains('event-navigation')&&!child.classList.contains('tracking-heading'))child.hidden=history;
 get('selected-detail').hidden=history||!selected;get('empty-detail').hidden=history||!!selected;get('history-view-panel').hidden=!history;
 if(history){renderArchiveList();detail.scrollTop=archiveState.scroll;side.scrollTop=0;if(archiveState.open&&archiveState.selected)openArchive(archiveState.selected,true);}
 else{detail.scrollTop=currentPosition.detail;get('event-list').scrollTop=currentPosition.list;side.scrollTop=currentPosition.side;window.scrollTo(0,currentPosition.page);}
}
function renderArchiveList(){
 const rows=items.filter(isClosed).sort((a,b)=>(Date.parse(archiveEnded(b))||0)-(Date.parse(archiveEnded(a))||0)).filter(item=>(!archiveState.category||item.category===archiveState.category)&&(!archiveState.query||[item.title,item.location,item.id].some(v=>String(v).toLowerCase().includes(archiveState.query.toLowerCase())))&&(!archiveState.date||archiveOccurred(item)?.slice(0,10)===archiveState.date));
 const body=get('archive-rows');body.replaceChildren();updateViewCounts();get('archive-count').textContent=rows.length+' 条记录';
 if(archiveState.open&&!rows.some(item=>item.id===archiveState.selected)){archiveSavePosition();archiveState.open=false;get('archive-drawer').hidden=true;}
 for(const item of rows){
  const row=element('tr');row.dataset.archive=item.id;row.tabIndex=0;row.setAttribute('aria-label','查看历史事件：'+item.title);row.setAttribute('aria-selected',String(archiveState.open&&archiveState.selected===item.id));row.classList.toggle('selected-archive',archiveState.open&&archiveState.selected===item.id);
  const name=element('td');name.append(element('strong',item.title,'archive-name'),element('span',item.location,'archive-location'));
  row.append(name,element('td',item.category),element('td',archiveTime(archiveOccurred(item),item.time)),element('td',archiveDuration(item)),element('td',item.resolution||'已结束'));
  const view=element('td'),button=element('button','查看详情','text-button');button.type='button';button.tabIndex=-1;view.append(button);row.append(view);
  row.onclick=()=>openArchive(item.id);row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openArchive(item.id)}};body.append(row);
 }
 get('archive-empty').hidden=rows.length>0;
}
function openArchive(id,restore=false){
 const item=items.find(item=>item.id===id&&isClosed(item));if(!item)return;
 if(archiveState.open&&archiveState.selected===id&&!restore)return;
 if(!restore)archiveSavePosition();archiveState.selected=id;archiveState.open=true;
 const drawer=get('archive-drawer');drawer.replaceChildren();drawer.hidden=false;
 const close=element('button','×','drawer-close');close.id='close-archive-detail';close.type='button';close.setAttribute('aria-label','关闭历史详情');close.onclick=()=>{archiveSavePosition();archiveState.open=false;drawer.hidden=true;renderArchiveList();get('archive-rows').querySelector('[data-archive="'+item.id+'"]')?.focus({preventScroll:true})};drawer.append(close);
 const heading=element('header','','object-header'),context=element('div','','object-context');context.append(element('span',item.category),element('span','编号 '+item.id),element('span','只读档案'));
 heading.append(element('p','历史事件 / 结束详情','breadcrumb'),element('h1',item.title),context);drawer.append(heading);
 const result=element('section','','archive-result');result.dataset.result=item.resolution==='正常完成'?'success':'neutral';result.append(element('h2',item.resolution||'已结束'),element('p',item.records?.at(-1)?.[2]||'结束说明未单独记录'));
 const facts=element('dl','','archive-facts');for(const [label,value]of [['位置',item.location],['发生时间',archiveTime(archiveOccurred(item),item.time)],['结束时间',archiveEnded(item)?.includes('T')?archiveTime(archiveEnded(item)):'未记录完整时间'],['处理用时',archiveDuration(item)],['责任班组',item.owner||item.verificationAssignment?.owner||'未记录'],['复核人员',item.reviewer||'未记录具体姓名']]){const group=element('div');group.append(element('dt',label),element('dd',value));facts.append(group)}result.append(facts);drawer.append(result);
 if(item.duplicateOf){const link=element('a','查看关联主事项：'+(items.find(row=>row.id===item.duplicateOf)?.title||item.duplicateOf)+' ↗','product-link');link.href='index.html?item='+encodeURIComponent(item.duplicateOf);drawer.append(link)}
 const tablist=element('div','','archive-tabs detail-tabs');tablist.setAttribute('role','tablist');tablist.setAttribute('aria-label','历史事件内容');
 const details=element('section','','archive-materials'),records=element('section','','archive-records');details.id='archive-detail-panel';records.id='archive-records-panel';
 const detailTab=element('button','处理结果与材料'),recordTab=element('button','全部记录');detailTab.type=recordTab.type='button';detailTab.dataset.archiveTab='detail';recordTab.dataset.archiveTab='records';
 for(const [button,panel]of [[detailTab,details],[recordTab,records]]){button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);panel.setAttribute('role','tabpanel');tablist.append(button)}
 const select=tab=>{archiveState.tabs.set(id,tab);const isDetail=tab==='detail';details.hidden=!isDetail;records.hidden=isDetail;detailTab.setAttribute('aria-selected',String(isDetail));recordTab.setAttribute('aria-selected',String(!isDetail));detailTab.tabIndex=isDetail?0:-1;recordTab.tabIndex=isDetail?-1:0};
 detailTab.onclick=()=>select('detail');recordTab.onclick=()=>select('records');tablist.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const tab=e.key==='Home'?'detail':e.key==='End'?'records':details.hidden?'detail':'records';select(tab);(tab==='detail'?detailTab:recordTab).focus()}};
 drawer.append(tablist,details,records);StageDetail.render(item,{host:details,phase:item.phase});const list=element('ol','','timeline');records.append(list);StageDetail.renderRecords(item,list);select(archiveState.tabs.get(id)||'detail');
 renderArchiveList();drawer.scrollTop=archiveState.positions.get(id)||0;
}
function setupBusinessViews(){
 const nav=element('nav','','event-navigation');nav.setAttribute('aria-label','事件视图');
 for(const [id,label,view]of [['current-view','当前事件','current'],['history-view','历史事件','history']]){const button=element('button',label);button.id=id;button.type='button';button.setAttribute('aria-pressed',String(view==='current'));button.onclick=()=>switchBusinessView(view);nav.append(button)}
 find('.tracking-heading').after(nav);nav.hidden=stagePreview;
 const panel=element('section','','archive-panel');panel.id='history-view-panel';panel.hidden=true;
 const title=element('header','','archive-title');title.append(element('h1','历史事件'),element('p','查看已结束事项的处理结果、材料与完整记录'),element('span','','archive-count'));title.lastChild.id='archive-count';panel.append(title);
 const filters=element('div','','archive-tools');
 const searchLabel=element('label','搜索事件'),search=element('input');search.id='archive-search';search.type='search';search.placeholder='名称、位置或编号';searchLabel.append(search);
 const categoryLabel=element('label','业务类别'),category=element('select');category.id='archive-category';category.add(new Option('全部类别',''));for(const text of [...new Set(items.map(item=>item.category))])category.add(new Option(text));categoryLabel.append(category);
 const dateLabel=element('label','发生日期'),date=element('input');date.id='archive-date';date.type='date';dateLabel.append(date);
 const reset=element('button','重置筛选','text-button');reset.type='button';reset.onclick=()=>{search.value=category.value=date.value='';archiveState.query=archiveState.category=archiveState.date='';renderArchiveList()};
 search.oninput=()=>{archiveState.query=search.value.trim();renderArchiveList()};category.onchange=()=>{archiveState.category=category.value;renderArchiveList()};date.onchange=()=>{archiveState.date=date.value;renderArchiveList()};filters.append(searchLabel,categoryLabel,dateLabel,reset);panel.append(filters);
 const table=element('table','','archive-table');table.setAttribute('aria-label','历史事件列表');const head=element('thead'),header=element('tr');for(const text of ['事件 / 位置','类别','发生时间','处理用时','处理结果','']){const cell=element('th',text);cell.scope='col';header.append(cell)}head.append(header);const body=element('tbody');body.id='archive-rows';table.append(head,body);panel.append(table);
 const empty=element('div','','detail-empty');empty.id='archive-empty';empty.append(element('h2','没有匹配的历史事件'),element('p','可调整筛选条件；未完成事项仍在当前事件中。'));panel.append(empty);
 const drawer=element('aside','','archive-drawer');drawer.id='archive-drawer';drawer.hidden=true;drawer.setAttribute('aria-label','历史事件只读详情');panel.append(drawer);find('.tracking-detail').append(panel);
}
async function boot(){get('selected-detail').hidden=true;get('empty-detail').hidden=false;get('empty-detail').textContent='正在读取业务事项…';try{
 store=await Product.read();items=stagePreview?store.items.map(item=>isClosed(item)?item:StageMaterials.previewItem(item,previewPhase==='decision'&&(item.businessType||item.id)!=='road'?'assign':previewPhase)):store.items;get('empty-detail').replaceChildren(element('h2','没有符合条件的事项'),element('p','可调整类别、状态或搜索词。'));
 if(!get('current-view'))setupBusinessViews();
 items.forEach(item=>{const saved=stagePreview?{}:JSON.parse(localStorage.getItem('product-draft-'+item.id)||'{}');draft.set(item,{person:'',note:'',input:'',messages:[],assistant:false,assistOpen:false,adopted:false,dismissed:false,seen:false,...saved})});
 if(stagePreview){status=0;get('category-filter').value='';get('event-search').value='';}
 const target=new URLSearchParams(location.search).get('item')||remembered.id;
 if(target){selected=items.find(x=>x.id===target);if(!selected)Product.notify('该事项不存在或不可见',true);if(new URLSearchParams(location.search).has('item')){status=0;get('category-filter').value='';get('event-search').value='';}}
 const archiveTarget=!stagePreview&&new URLSearchParams(location.search).has('item')&&selected&&isClosed(selected)?selected.id:null;
 renderList();if(selected)renderItem(selected);if(archiveTarget){switchBusinessView('history');openArchive(archiveTarget);}
 if(!new URLSearchParams(location.search).has('item'))requestAnimationFrame(()=>{get('event-list').scrollTop=remembered.listScroll||0;find('.tracking-detail').scrollTop=remembered.detailScroll||0;window.scrollTo(0,remembered.pageScroll||0)});
 }catch(e){get('selected-detail').hidden=true;get('empty-detail').hidden=false;get('empty-detail').textContent='读取失败：'+e.message+'。请刷新重试。';e.uncertain?Product.pendingNotice():Product.notify(e.message,true)}}
const originParams=new URLSearchParams(location.search);if(originParams.get('from')){const back=element('a','← 返回来源','product-link');back.href=originParams.get('from')==='screen'?'screen.html':originParams.get('report')?'assistant.html?report='+encodeURIComponent(originParams.get('report'))+(originParams.get('version')?'&version='+encodeURIComponent(originParams.get('version')):''):'assistant.html?session='+encodeURIComponent(originParams.get('session')||'');find('.breadcrumb').prepend(back)}
window.addEventListener('pagehide',()=>{persistDraft();remember()});boot();
