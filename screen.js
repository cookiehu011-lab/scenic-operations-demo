const $=id=>document.getElementById(id);
const allLayers=['people','vehicles','parking','events','base'];
const initialState=()=>({layers:[...allLayers],view:'overview',topic:null,video:'entrance',result:false,source:'默认展示',question:'',alertDetail:false});
let state=initialState(),history=[],recognition=null,listening=false,pending=null,lastQuery=null,lastSuccess=null;
const videos={entrance:{name:'入口上游道路',image:'assets/road-scene.png'},temple:{name:'九华街片区',image:'assets/people-temple-scene.png'},peak:{name:'天台游览区',image:'assets/scenic-overlook.png'}};
Object.assign(videos,{p1:{name:'迎宾停车场 P1',image:'assets/parking-p1.png'},p2:{name:'松风停车场 P2',image:'assets/parking-p2.png'},p3:{name:'云谷停车场 P3',image:'assets/parking-p3.png'}});
const views={overview:{title:'全园整体运行，3处异常需关注',body:'当前在园6,420人，停车场可用368个车位。九华街片区人群聚集、入口缓行和P1车位紧张需持续跟进。',source:'全园运营汇总 · 14:30',layers:allLayers,video:'entrance',metric:[1,3,5]},people:{title:'九华街片区人数最多：2,680人',body:'占当前在园人数41.7%，超过该区域2,500人的关注阈值。天台1,840人、入口1,120人、花台780人。已关联九华街场景示意。',source:'区域人流记录 · 14:30',layers:['people','events','base'],video:'temple',metric:[1]},parking:{title:'P3余位最多，P1停车紧张',body:'P3可用176个，P2可用160个，P1仅余32个。全园可用368个；可结合目的地选择停车场，不能仅按余位判断到达路线。',source:'停车场状态 · 14:30',layers:['parking','vehicles','base'],video:'entrance',metric:[3]},road:{title:'入口排队18辆，拥堵原因待核实',body:'预计等待8分钟，附近P1占用率92%。这些是同时发生的观测，尚不足以认定停车紧张是缓行原因；需结合现场反馈进一步核查。',source:'道路观测＋停车数据＋事件记录 · 14:30',layers:['vehicles','parking','people','events'],video:'entrance',metric:[2,3,5]},crowd:{title:'九华街片区聚集，正在跟进',body:'当前2,680人，区域关注阈值2,500人。现场巡查组正在跟进疏导，尚未收到完成反馈；大屏仅展示当前记录，不执行调度。',source:'人流监测＋事项处置记录 · 14:30',layers:['people','events','base'],video:'temple',metric:[1,4,5]},event:{title:'入口道路事件：待现场核查',body:'14:20收到预警，14:24形成分析建议；截至14:30仍待核查，无现场确认结果。优先核实排队原因和影响范围，再判断后续处置。',source:'入口上游事件记录 · 14:30',layers:['events','vehicles','base'],video:'entrance',metric:[4]},temple:{title:'九华街片区 · 2,680人在园',body:'全园人数最多的区域，占在园人数41.7%。当前聚集事项正在跟进，可查看九华街场景示意。',source:'区域人流记录 · 14:30',layers:['people','events','base'],video:'temple',metric:[1]},peak:{title:'天台游览区 · 1,840人在园',body:'占全园在园人数28.7%。已定位山岳游览区域并切换对应场景，周边索道与步道可在基础图层查看。',source:'区域人流记录 · 14:30',layers:['people','base'],video:'peak',metric:[1]},entrance:{title:'入口服务区 · 1,120人在园',body:'入口上游道路存在缓行，P1停车场可用32个车位。人流、道路与停车状态需结合观察。',source:'区域人流＋道路＋停车数据 · 14:30',layers:['people','vehicles','parking','events','base'],video:'entrance',metric:[1,2]},lake:{title:'花台游览区 · 780人在园',body:'占全园在园人数12.1%。地图已定位花台游览片区，当前未列入重点异常清单。',source:'区域人流记录 · 14:30',layers:['people','base'],video:'peak',metric:[1]},p1:{title:'迎宾停车场 P1 · 可用32个车位',body:'总车位400个，已占用368个，占用率92%。停车紧张，P2与P3合计仍有336个可用车位。',source:'停车场状态 · 14:30',layers:['parking','vehicles','events','base'],video:'entrance',metric:[3,5]},p2:{title:'松风停车场 P2 · 可用160个车位',body:'总车位520个，已占用360个，占用率69.2%。停车场与接驳枢纽相邻，可进一步查看接驳运行情况。',source:'停车场状态 · 14:30',layers:['parking','vehicles','base'],video:'entrance',metric:[3]},p3:{title:'云谷停车场 P3 · 可用176个车位',body:'总车位320个，已占用144个，占用率45%。三个停车场中当前余位最多。',source:'停车场状态 · 14:30',layers:['parking','vehicles','base'],video:'entrance',metric:[3]},cable:{title:'索道站 · 山岳游览连接点',body:'已定位索道站与周边游览区域。当前可联合人流图层查看天台片区分布，不从人数直接推断索道等待时间。',source:'基础设施＋区域人流 · 14:30',layers:['base','people'],video:'peak',metric:[1]},center:{title:'游客中心 · 综合服务节点',body:'关联入口服务区、P1停车场和主入园通道。可通过人流、停车、道路及事件图层查看周边状态。',source:'基础设施目录 · 14:30',layers:allLayers,video:'entrance',metric:[]},shuttle:{title:'接驳枢纽 · 16辆接驳车运行',body:'当前运行16辆。此指标为运营车辆数量，不等于实时可乘坐余位，也不代表所有站点等待时间。',source:'接驳运行记录 · 14:30',layers:['vehicles','base'],video:'entrance',metric:[2]}};

// Scope statistics use the same 14:30 snapshot as the global totals.
const regions={temple:{name:'九华街片区',people:2680},peak:{name:'天台游览区',people:1840},entrance:{name:'入口服务区',people:1120},lake:{name:'花台游览区',people:780}};
const parks={p1:{name:'迎宾停车场 P1',free:32,total:400},p2:{name:'松风停车场 P2',free:160,total:520},p3:{name:'云谷停车场 P3',free:176,total:320}};
const incidents={
 crowd:{title:'九华街片区人群聚集',signal:'超过关注阈值 180 人',status:'跟进中',time:'首次发生时间暂无记录',team:'现场巡查组',update:'正在跟进疏导；尚无完成反馈',limit:'最近反馈时间、变化趋势暂无记录'},
 road:{title:'入口上游道路缓行',signal:'排队 18 辆 · 预计等待 8 分钟',status:'待核查',time:'14:20 预警 · 距快照 10 分钟',team:'暂无责任团队记录',update:'14:24 形成分析建议；现场反馈未到',limit:'排队原因、影响范围尚未核实'},
 p1:{title:'游客中心停车场余位不足',signal:'占用率 92% · 可用 32 / 400',status:'持续关注',time:'首次发生时间暂无记录',team:'暂无责任团队记录',update:'暂无处置反馈记录',limit:'余位变化趋势暂无记录'}
};
const regionKey=key=>({people:'temple',crowd:'temple',road:'entrance',event:'entrance',cable:'peak',center:'entrance',shuttle:'entrance'}[key]||key);
const pointKey=key=>({people:'temple',parking:'p3',event:'road'}[key]||key);
const incidentKey=key=>({people:'crowd',temple:'crowd',event:'road',entrance:'road'}[key]||key);
const videoFor=key=>key==='parking'?'p3':parks[key]?key:['lake','shuttle'].includes(key)?null:views[key].video;
function save(){history.push(JSON.parse(JSON.stringify(state)))}
function setQueryBusy(busy){
 document.querySelector('.send').disabled=busy;
 if($('cancel-query'))$('cancel-query').hidden=!busy;
 $('refresh-query').disabled=busy;
 $('refresh-query').textContent=busy&&pending?.refresh?'正在重新查询…':'重新查询';
 if(busy)$('query-form').setAttribute('aria-busy','true');
 else $('query-form').removeAttribute('aria-busy');
}
function cancelPending(){
 if(!pending)return false;
 pending.controller?.abort();finishProcess(pending,'cancelled',pending.committed?'已停止 · 保留已呈现内容':'已取消');
 pending=null;setQueryBusy(false);if(!document.body.classList.contains('map-focus'))setCardsInert(false);
 return true;
}
function queryPhase(phase,label){document.querySelector('.query-feedback').dataset.phase=phase;$('query-phase').textContent=label;$('retry-query').hidden=phase!=='error'}
function feedback(phase,label,text){queryPhase(phase,label);$('query-status').textContent=text;fitMap()}
function scopeMarkup(label,value){return '<div><span>'+label+'</span><strong>'+value+'</strong></div>'}
function renderScope(){
 document.querySelectorAll('.parking-row').forEach(el=>el.classList.toggle('selected',el.dataset.view===state.view));
 const key=regionKey(state.view),r=regions[key],p=parks[state.view],isOverview=state.view==='overview';
 $('park-trend').hidden=!isOverview;$('trend-note').hidden=!isOverview;$('park-areas').hidden=!isOverview;$('scope-details').hidden=isOverview;
 $('scope-time').textContent='数据截至 14:30';
 if(isOverview){$('scope-title').textContent='全园人流';$('scope-summary').innerHTML='<span>当前在园</span><strong>6,420<small>人</small></strong><span class="mini-pill">全园</span>';return}
 if(r){$('scope-title').textContent=r.name;$('scope-summary').innerHTML='<span>区域在园</span><strong>'+r.people.toLocaleString()+'<small>人</small></strong><span class="mini-pill">区域</span>';
 let detail=scopeMarkup('占全园在园人数',(r.people/6420*100).toFixed(1)+'%')+scopeMarkup('全园在园基准','6,420 人');
 if(key==='temple')detail+=scopeMarkup('关注阈值','2,500 人')+scopeMarkup('超出阈值','180 人');
 if(key==='entrance')detail+=scopeMarkup('入口排队','18 辆')+scopeMarkup('预计等待','8 分钟');
 if(key==='peak'||key==='lake')detail+=scopeMarkup('本区关注阈值','暂无记录')+scopeMarkup('本区变化趋势','暂无数据');
 $('scope-details').innerHTML='<div class="scope-grid">'+detail+'</div><p class="scope-note">暂无该区域历史趋势。</p>';
 }else if(p||state.view==='parking'){
 $('scope-title').textContent=p?p.name:'全园停车分布';$('scope-summary').innerHTML='<span>当前可用</span><strong>'+(p?p.free:368)+'<small>个</small></strong><span class="mini-pill">'+(p?'停车场':'全园')+'</span>';
 $('scope-details').innerHTML='<div class="scope-grid">'+(p?scopeMarkup('总车位',p.total+' 个')+scopeMarkup('占用率',((p.total-p.free)/p.total*100).toFixed(1)+'%'):scopeMarkup('余位最多','P3 · 176 个')+scopeMarkup('重点关注','P1 · 32 个'))+scopeMarkup('全园可用基准','368 / 1,240')+scopeMarkup('余位变化','暂无历史数据')+'</div><p class="scope-note">全园停车占用率 70.3% · 数据截至 14:30。</p>';
 }else{$('scope-title').textContent='当前关注';$('scope-summary').textContent=(state.evidenceResult||views[state.view]).title;$('scope-details').textContent='全园统计保留在顶部。'}

}
function renderAlerts(){
 const item=state.eventSnapshot||incidents[incidentKey(state.view)],detail=state.alertDetail&&item;
 $('alert-list').hidden=!!detail;$('alert-detail').hidden=!detail;$('back-alerts').hidden=!detail;document.querySelector('.alert-count').hidden=!!detail;
 $('alert-heading').textContent=detail?'异常跟进':'重点异常';
 if(detail)$('alert-detail').innerHTML='<h3>'+item.title+'</h3><p class="risk-signal">'+item.signal+'</p><div class="incident-meta"><span>'+item.status+'</span><span>等级待核定</span></div><dl><dt>时间</dt><dd>'+item.time+'</dd><dt>责任</dt><dd>'+item.team+'</dd><dt>进展</dt><dd>'+item.update+'</dd></dl><p class="scope-note">'+item.limit+'</p>';
}
function setVideo(key){
 const video=videos[key];$('main-video').hidden=!video;$('video-empty').hidden=!!video;
 if(!video){const location=state.view==='parking'?parks.p3.name:parks[state.view]?.name||regions[state.view]?.name||(state.evidenceResult||views[state.view]).title;$('video-empty').textContent='暂无该区域现场画面';$('video-link-label').textContent='无对应现场画面';$('video-context').textContent=location+' · 暂无画面';return}
 $('video-image').src=video.image;$('video-image').alt=video.name+'场景快照';$('video-caption').innerHTML=video.name+' <small>点击放大 ↗</small>';$('main-video').dataset.video=key;
 document.querySelector('.video-time').textContent='场景示意 · 非实时';
 const related=['center','shuttle','cable'].includes(state.view);
 $('video-link-label').textContent=state.view==='overview'?'全园关注点':related?'周边关联画面':'当前区域画面';
 $('video-context').textContent=video.name+' · 14:30 场景快照'+(related?' · 非所选设施现场':'');
 if(parks[key]){
  $('video-context').textContent=video.name+' · '+({p1:'车位紧张',p2:'仍有余位',p3:'余位充足'}[key]);
  document.querySelector('.video-time').textContent='AI 生成示意';
  document.querySelector('.preview-label').textContent='非实时';
  $('video-link-label').textContent='选中停车场';
 }
 document.querySelector('.play-icon').textContent='⤢';
}
const topics={
 people:{name:'人流分布',scope:'全园四个片区',map:'片区人数分布',legend:'亮框：选中片区 · !：人群聚集事项',layers:['people','events'],points:['temple','peak','entrance','lake','crowd'],heading:'片区人数排名',note:'关注阈值仅适用于九华街片区。'},
 parking:{name:'停车余位',scope:'全园三个停车场',map:'停车场余位分布',legend:'蓝标 · 停车场　｜　余位数据截至 14:30',layers:['parking'],points:['p1','p2','p3'],heading:'停车场余位对比',note:'对比条显示余位比例（可用车位 ÷ 总车位）。地图仅示意点位。'},
 road:{name:'入口缓行核查',scope:'入口上游道路及相邻 P1',map:'入口排队关注范围',legend:'橙色 · 缓行路段　｜　P1 · 周边停车观测',layers:['vehicles','parking','events'],points:['road','p1'],heading:'现场观测与核查',note:'当前为单时点观测，暂无历史排队趋势。'}
};
function topicNode(tag,text,className){
 const node=document.createElement(tag);
 if(text)node.textContent=text;
 if(className)node.className=className;
 return node;
}
const peopleScenes={
 temple:{name:'九华街片区',image:'assets/people-temple-scene.png'},
 peak:videos.peak,
 entrance:videos.entrance
};
function renderPeople(){
 const id=regionKey(state.view),region=regions[id],scene=peopleScenes[id];
 $('view-caption').textContent='选中 · '+region.name;
 $('people-scene-title').textContent=region.name;
 $('people-scene-location').textContent='与地图选中片区关联';
 $('people-scene-preview').hidden=!scene;
 $('people-scene-empty').hidden=!!scene;
 $('people-scene-empty').textContent='暂无该片区的场景示意';
 if(scene){
  $('people-scene-image').alt=scene.name+'场景示意';
  $('people-scene-image').src=scene.image;
 }
 $('people-scene-source').textContent=(id==='entrance'?'画面范围为入口上游道路 · ':'')+'人数来源：区域人流记录 · 14:30';
 const rows=$('people-rank-rows');
 if(!rows.childElementCount)for(const [key,item] of Object.entries(regions)){
  const button=topicNode('button','','topic-row');
  button.type='button';
  button.dataset.region=key;
  const bar=topicNode('i'),fill=topicNode('b');
  fill.style.width=(item.people/2680)*100+'%';
  bar.setAttribute('aria-hidden','true');bar.append(fill);
  button.append(topicNode('span',item.name),topicNode('strong',item.people.toLocaleString()+' 人'),bar);
  button.onclick=()=>show(key);
  rows.append(button);
 }
 for(const button of rows.children)button.setAttribute('aria-pressed',String(button.dataset.region===id));
}
function topicMetrics(key,selection){
 if(key==='people'){
  const id=regionKey(selection),region=regions[id];
  const comparison=id==='temple'?['关注阈值','2,500 人','超 180 人（7.2%）']:['关注阈值','—','该片区暂无记录'];
  return [[region.name,region.people.toLocaleString()+' 人','占全园 '+(region.people/6420*100).toFixed(1)+'%'],comparison,['全园在园','6,420 人','全园承载率 45.9%']];
 }
 if(key==='parking'){
  const park=parks[selection]||parks.p3;
  return [['当前停车场',park.free+' / '+park.total+' 个',park.name+' · 可用 / 总数'],['全园可用','368 个','全园总车位 1,240 个'],['P1 占用率','92%','游客中心 · 余 32 个']];
 }
 return [['入口排队','18 辆','入口上游道路 · 已观测'],['预计等待','8 分钟','入口上游道路 · 估计值'],['拥堵原因','待核查','现场反馈暂缺']];
}
function renderTopic(){
 const key=state.topic,topic=topics[key],screen=document.querySelector('.screen'),metrics=$('topic-metrics'),panel=$('topic-panel');
 screen.dataset.topic=key||'overview';
 document.querySelector('.metrics').hidden=!!topic;
 metrics.hidden=$('topic-legend').hidden=!topic;
 panel.hidden=!topic||key==='people';
 for(const id of ['people-scene','people-rank','people-trend'])$(id).hidden=key!=='people';
 document.querySelector('.layer-selector').hidden=!!topic;
 document.querySelector('.map-legend').hidden=!!topic;
 $('map-badge').textContent=topic?topic.map:'空间态势';
 $('video-heading').textContent=parks[state.video]?'停车场现场示意':topic?'关联现场画面':'重点区域视频';
 
 if(key==='road')$('video-context').textContent='入口上游道路 · 场景示意，非实时';
 if(key==='parking'||key==='road')document.querySelector('.preview-label').textContent='场景示意 · 非实时';
 else document.querySelector('.preview-label').textContent='场景预览';
 $('topic-adjacent-video').hidden=key!=='parking'||!!state.video;
 if(!topic)return;
 $('view-caption').textContent=topic.scope+' · '+(state.view===key?'14:30 快照':(state.evidenceResult||views[state.view]).title);
 $('topic-legend').textContent=topic.legend;
 const label=topicNode('div','','topic-heading');
 if(key!=='people')label.append(topicNode('span','专题视图'));
 label.append(topicNode('h2',topic.name),topicNode('p',topic.scope+' · 14:30 快照'));
 metrics.replaceChildren(label);
 for(const [name,value,scope] of topicMetrics(key,state.view)){
  const cell=topicNode('div','','topic-kpi');
  cell.append(topicNode('span',name),topicNode('strong',value),topicNode('small',scope));
  metrics.append(cell);
 }
 if(key==='people'){renderPeople();return}
 panel.replaceChildren(topicNode('h2',topic.heading));
 if(key==='road'){
  const timeline=topicNode('ol','','road-evidence');
  for(const [time,title,detail] of [['14:20','发现入口缓行','道路预警记录'],['14:24','形成核查建议','现场原因与影响范围待确认'],['14:30','当前观测快照','排队18辆 · 预计等待8分钟']]){
   const item=topicNode('li');item.append(topicNode('time',time),topicNode('strong',title),topicNode('small',detail));timeline.append(item);
  }
  panel.append(timeline,topicNode('p','相邻 P1：占用率 92% · 余 32 个','topic-road-observation'),topicNode('p','尚不能确认拥堵原因，需现场反馈。','topic-road-unknown'));
 }else{
  const rows=Object.entries(parks).sort((a,b)=>b[1].free-a[1].free);
  for(const [id,row] of rows){
   const button=topicNode('button','','topic-row');
   button.type='button';
   button.setAttribute('aria-pressed',String(id===pointKey(state.view)));
   const bar=topicNode('i'),fill=topicNode('b');
   const value=row.free+' / '+row.total+' 个';
   fill.style.width=(row.free/row.total)*100+'%';
   bar.setAttribute('aria-hidden','true');bar.append(fill);
   button.append(topicNode('span',row.name),topicNode('strong',value),bar);
   button.onclick=()=>show(id);
   panel.append(button);
  }
 }
 if(key==='parking'){
  const park=parks[state.view]||parks.p3;
  const detail=topicNode('div','','parking-selection');
  detail.append(topicNode('span','选中 · '+park.name),topicNode('strong','占用 '+((park.total-park.free)/park.total*100).toFixed(1)+'%'),topicNode('small','已停 '+(park.total-park.free)+' 辆 · 空余 '+park.free+' 个'));
  panel.append(detail);
 }
 panel.append(topicNode('p',topic.note,'topic-note'));
}
function renderEvidence(){
 let panel=$('query-evidence');
 if(!panel){panel=document.createElement('section');panel.id='query-evidence';panel.setAttribute('aria-label','本次查询的场景与统计');document.querySelector('.map-stage').append(panel)}
 const key=state.view,kind=state.kind,stage=state.evidenceStage??4,item=state.evidenceResult||views[key],region=regions[regionKey(key)],park=parks[key],road=['road','event'].includes(key);
 panel.replaceChildren();panel.dataset.stage=stage;panel.hidden=!state.question&&!state.result;
 panel.append(topicNode('h3','当前情况'),topicNode('p',['','已定位相关区域','已更新关键统计','已展示相关场景','地图 · 场景 · 数据'][stage],'evidence-scope'));
 const stats=topicNode('div','','evidence-stats');stats.hidden=stage<2;stats.classList.toggle('progress-stats',kind==='progress');
 let values;
 if(kind==='progress'){const record=state.eventSnapshot||incidents[incidentKey(key)];values=[['当前进度',record.status],['责任团队',record.team],['记录时间',key==='event'?(record.updatedAt==='当前'?'未登记':record.updatedAt||'未登记'):record.time]];}
 else if(kind==='occupancy')values=park?[['占用率',((park.total-park.free)/park.total*100).toFixed(1)+'%'],['已占用',(park.total-park.free)+' 个'],['可用车位',park.free+' 个']]:[['全园占用率','70.3%'],['已占用','872 个'],['总车位','1,240 个'],['可用车位','368 个']];
 else if(kind==='trend')values=[['08:00 在园','1,860 人'],['14:30 在园','6,420 人'],['净增加','4,560 人']];
 else if(kind==='total')values=[['全园当前在园','6,420 人'],['统计范围','四个片区'],['承载利用率','45.9%']];
 else if(kind==='admissions')values=[['今日累计入园','12,860 人次'],['统计时段','00:00—14:30'],['当前在园','6,420 人']];
 else if(key==='shuttle')values=[['运行接驳车','16 辆'],['可乘余位','暂无数据'],['站点等待','暂无数据']];
 else if(key==='overview')values=[['当前在园','6,420 人'],['停车可用','368 个'],['重点异常','3 处']];
 else if(park||key==='parking')values=park?[['当前余位',park.free+' 个'],['总车位',park.total+' 个'],['占用率',((park.total-park.free)/park.total*100).toFixed(1)+'%']]:[['全园可用','368 个'],['全园占用率','70.3%'],['P3 余位最多','176 个'],['P1 需关注','32 个']];
 else if(road)values=[['入口排队','18 辆'],['预计等待','8 分钟'],['相邻 P1 占用','92%']];
 else if(region)values=[['区域在园',region.people.toLocaleString()+' 人'],['占全园人数',(region.people/6420*100).toFixed(1)+'%'],[regionKey(key)==='temple'?'关注阈值':'全园在园',regionKey(key)==='temple'?'2,500 人':'6,420 人']];
 else values=[['数据范围','当前点位'],['关联情况',item.title]];
 for(const [label,value] of values){const cell=topicNode('div');cell.append(topicNode('span',label),topicNode('strong',value));stats.append(cell)}
 panel.append(stats);
 if(kind==='trend'&&stage>=2){
  const chart=topicNode('div','','evidence-trend');
  chart.append(topicNode('h4','全园在园人数 · 今日'));
  const svg=$('park-trend').querySelector('svg').cloneNode(true);
  svg.querySelector('linearGradient').id='evidence-chart-fill';svg.querySelector('[fill="url(#chart-fill)"]').setAttribute('fill','url(#evidence-chart-fill)');
  const times=topicNode('p','','evidence-trend-times');for(const time of ['08:00','10:00','12:00','14:30'])times.append(topicNode('span',time));chart.append(svg,times);panel.append(chart);
 }
 const scene=topicNode('div','','evidence-scene');scene.hidden=stage<3;
 const video=videoFor(key),image=videos[video];
 scene.append(topicNode('h4',key==='overview'?'局部参考场景 · 入口上游':'相关场景'));
 if(stage>=3&&image&&!state.pictureFailed){const button=topicNode('button');button.type='button';button.setAttribute('aria-label','放大'+image.name+'场景示意');const img=document.createElement('img');img.src=image.image;img.alt=image.name+'场景示意';const evidenceState=state;img.onerror=()=>{if(state===evidenceState){state.pictureFailed=true;button.replaceWith(topicNode('p','对应场景无法加载'))}};button.append(img);button.onclick=()=>{$('main-video').click()};scene.append(button,topicNode('p',image.name+' · 场景示意，非实时'));}
 else if(stage>=3)scene.append(topicNode('p','暂无可用的对应场景画面'));
 panel.append(scene);
 const explanation=topicNode('p',item.body,'evidence-explanation');explanation.hidden=stage<4;panel.append(explanation);
 const source=topicNode('p',(key==='event'?'':'样例数据 · ')+item.source,'evidence-source');source.hidden=stage<2;panel.append(source);
}
async function presentResult(request,index,message){
 if(pending!==request)throw new DOMException('查询已取消','AbortError');
 const step=request.process.steps[index];step.lastElementChild.textContent='已呈现 · 阅读中';
 request.process.current.textContent='第 '+(index+1)+' 步 · '+message;request.process.summary.textContent='正在呈现结果';feedback('running','结果呈现',message);
 // This is a declared reading interval after work finishes, not simulated computation.
 await new Promise((resolve,reject)=>{
  const abort=()=>{clearTimeout(timer);reject(new DOMException('查询已取消','AbortError'))};
  const timer=setTimeout(()=>{request.controller.signal.removeEventListener('abort',abort);resolve()},3200);
  request.controller.signal.addEventListener('abort',abort,{once:true});
 });
 if(pending!==request)throw new DOMException('查询已取消','AbortError');
}
async function revealEvidence(request,stage){
 state.evidenceStage=stage;renderEvidence();
 const target=stage===2?'.evidence-stats':stage===3?'.evidence-scene':'.evidence-explanation';
 await motion(document.querySelector(target),[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:450,easing:'ease-out'},request);
}
function render(){
 document.querySelectorAll('[data-layer]').forEach(el=>el.toggleAttribute('hidden',!state.layers.includes(el.dataset.layer)));
 const topic=topics[state.topic];
 if(topic)document.querySelectorAll('.map-point[data-layer]').forEach(el=>{if(!topic.points.includes(el.dataset.view)||el.classList.contains('park-alert'))el.hidden=true});
 document.querySelectorAll('[data-toggle]').forEach(b=>b.setAttribute('aria-pressed',String(state.layers.includes(b.dataset.toggle))));
 document.querySelectorAll('.map-point').forEach(el=>{const selected=state.view!=='overview'&&(el.dataset.view===pointKey(state.view)||(state.topic==='people'&&el.dataset.view===regionKey(state.view)));el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',String(selected))});
 document.querySelectorAll('.metrics>div').forEach((el,i)=>el.classList.toggle('focused-metric',state.result&&views[state.view].metric.includes(i)));
 $('view-caption').textContent=state.view==='overview'?(state.kind?state.evidenceResult.title:state.layers.length===5?'全园 · 全部图层':'全园 · '+state.layers.length+'个图层'):'聚焦 · '+(state.evidenceResult||views[state.view]).title.split(' · ')[0];
 document.querySelectorAll('.alert-item').forEach(el=>el.classList.toggle('focused-alert',state.result&&el.dataset.view===incidentKey(state.view)));
 $('map-canvas').classList.toggle('focus',state.result);$('previous-view').hidden=history.length===0;
 $('executed-context').textContent='当前视图：'+(state.view==='overview'?'全园概况':(state.evidenceResult||views[state.view]).title)+' · '+state.source+(state.question?' · 已执行「'+state.question+'」':'');
 renderScope();renderAlerts();setVideo(state.video);renderTopic();renderEvidence();fitMap();
}
function show(key,source='手动选择',question='',fromRequest=false,kind=null){
 if(!fromRequest)cancelPending();save();
 const topic=key==='overview'?null:source==='问答'&&topics[key]?key:topics[state.topic]?.points.includes(pointKey(key))?state.topic:null;
 state={view:key,kind,topic,layers:[...(['total','trend'].includes(kind)?['people','base']:topics[topic]?.layers||views[key].layers)],result:key!=='overview',video:videoFor(key),source,question,evidenceStage:fromRequest?1:4,evidenceResult:queryResult(key,kind),eventSnapshot:fromRequest&&incidents[incidentKey(key)]?{...incidents[incidentKey(key)]}:null,alertDetail:!!incidents[incidentKey(key)]};
 $('clarify-options').hidden=true;render();if(!fromRequest)feedback('success',source==='问答'?'已更新':'已定位',views[key].title+' · '+views[key].source);
}
function queryResult(key,kind){
 const item={...views[key]};
 if(kind==='occupancy'){const park=parks[key];Object.assign(item,{title:park?park.name+' · 占用率 '+((park.total-park.free)/park.total*100).toFixed(1)+'%':'全园停车占用率 70.3%',body:park?'总车位'+park.total+'个，已占用'+(park.total-park.free)+'个，可用'+park.free+'个。占用率按已占用车位占总车位计算。':'三个停车场共1,240个车位，已占用872个，可用368个，按总车位加权计算占用率70.3%；不是三个停车场占用率的简单平均。'});}
 if(kind==='total')Object.assign(item,{title:'全园当前在园 6,420 人',body:'九华街2,680人、天台1,840人、入口1,120人、花台780人，合计6,420人。当前在园人数与今日累计入园人次口径不同。',source:'全园在园人数及四片区记录 · 14:30'});
 if(kind==='admissions')Object.assign(item,{title:'今日累计入园 12,860 人次',body:'统计时段为今日00:00—14:30。累计入园按人次统计，不等于当前仍在园的6,420人；暂无各入口入园人次明细。',source:'全园入园累计记录 · 14:30'});
 if(kind==='trend')Object.assign(item,{title:'今日全园在园人数逐步增加',body:'08:00为1,860人，14:30为6,420人，增加4,560人；已列观测点中峰值6,420人。曲线仅表示全园在园人数，不能推断各片区趋势或未来变化。',source:'全园在园人数观测序列 · 08:00—14:30'});
 if(kind==='progress'&&key!=='event'){
  const record=incidents[incidentKey(key)];
  Object.assign(item,{title:record.title+'：'+record.status,body:'样例事项记录：'+record.update+'。责任：'+record.team+'。'+record.limit+'；未接入该事项的实时处置反馈。',source:'样例事项记录（非实时）'});
 }
 return item;
}
function overview(){cancelPending();save();state=initialState();state.source='恢复全园';$('question').value='';$('clarify-options').hidden=true;render();feedback('ready','全园视图','已恢复全园概况、全部图层与入口画面')}
function previousView(){if(!history.length)return;cancelPending();state=history.pop();$('question').value='';$('clarify-options').hidden=true;render();feedback('success','已返回',(state.evidenceResult||views[state.view]).title+' · '+(state.evidenceResult||views[state.view]).source)}
function query(text,context){
 $('clarify-options').hidden=true;
 if(/黄山|泰山|张家界|南门|西门|东门/.test(text))return {phase:'unavailable',label:'范围未接入',message:'当前仅支持九华山已列区域与停车场，未找到所问地点的数据；已保留当前视图。'};
 if(/索道|候乘|排队/.test(text)&&/多少人|几人|人数|人多|几个人/.test(text))return {phase:'unavailable',label:'数据不足',message:'暂无该处排队或候乘人数，区域在园人数不能代替排队人数；已保留当前视图。'};
 if(/派发|调度|关闭事件|审核|发送通知/.test(text))return {phase:'unsupported',label:'仅供查询',message:'运行大屏仅查询展示，不执行调度或业务操作。'};
 const unavailableTime=/昨天|昨日|上周|去年|前天|同比|环比|对比|相比|比较|比.*(多|少|增|减)|历史|过去|最近|近一|预测|明天|未来|\d{1,2}[点时]|\d{1,2}[:：]\d{2}/.test(text);
 if(unavailableTime)return {phase:'unavailable',label:'数据不足',message:'缺少所需时段或同口径历史数据，未完成查询；已保留当前视图。'};
 if(/用电|噪音|积水|水质|空气|能耗|餐饮|营业额|天气|气温|下雨|票价|票务|营收|收入|垃圾|厕所|门票|营业|开放|索道等待|收费|费用|停车费|路线|导航/.test(text))return {phase:'unavailable',label:'暂无数据',message:'当前没有该指标的查询数据，已保留当前视图。'};
 if(/上升|下降|变化|趋势|增长|减少|增加/.test(text)){
  if(/全园/.test(text)&&/今日|今天/.test(text)&&/人流|人数|客流/.test(text)&&/趋势|变化/.test(text))return {key:'overview',kind:'trend'};
  return {phase:'unavailable',label:'数据不足',message:'缺少该范围的历史序列，未完成变化查询；已保留当前视图。'};
 }
 const entities=[['peak',/天台/],['temple',/九华街/],['lake',/花台/],['p1',/P1|迎宾|游客中心停车场/i],['p2',/P2|松风|换乘中心停车场/i],['p3',/P3|云谷|北入口停车场/i],['entrance',/入口|道路/]];
 const entityText=text.replace(/北入口停车场/g,'P3');
 const matches=entities.filter(([,re])=>re.test(entityText)).map(([key])=>key);
 if(matches.length>1)return {phase:'clarify',label:'待明确',message:'问题涉及多个区域，请一次选择一个区域查看；当前视图保持不变。'};
 if(!matches.length&&!/九华山|全园|整个景区/.test(text)&&/(?:[\u4e00-\u9fff]{2,}(?:景区|公园|古镇|街区|停车场)|黄山|泰山|张家界|南门|西门|东门)/.test(text))return {phase:'unavailable',label:'范围未接入',message:'未找到该地点的观测数据，请选择九华街、天台、花台、入口或P1/P2/P3；当前视图保持不变。'};
 const entity=matches[0],progress=/处理|进展|哪一步|跟进|责任|负责|事件|事项/.test(text),people=/人流|人数|多少人|人多|客流|人群|入园|进园/.test(text),parking=/停车|车位|空位|余位|占用率/.test(text);
 if(people&&parking)return {phase:'clarify',label:'待明确',message:'问题同时涉及人流和停车，请分别查询以便展示对应范围与指标。'};
 if(/入园|进园/.test(text)&&!/在园/.test(text)){if(matches.length)return {phase:'unavailable',label:'数据不足',message:'仅有全园今日累计入园人次，暂无所问区域入园明细；已保留当前视图。'};return {key:'overview',kind:'admissions'};}
 if(/接驳/.test(text)){if(matches.length||/等待|多久|时刻|班次|几点|余位/.test(text))return {phase:'unavailable',label:'数据不足',message:'仅有全园运行接驳车16辆的样例记录，暂无各站点班次、等待时间或余位。'};return {key:'shuttle'};}
 if(progress){
  if(!entity&&/全园|整体|全部/.test(text)){$('clarify-options').hidden=false;return {phase:'clarify',label:'请选择事项',message:'请明确要跟进的事项，当前视图保持不变。'}}
  const target=entity||regionKey(context.view);
  if(parking&&target!=='p1'&&target!=='entrance')return {phase:'unavailable',label:'暂无记录',message:'暂无该区域停车事项的处置进展，已保留当前视图。'};
  if(target==='entrance')return {key:parking?'p1':'event',kind:'progress'};
  if(target==='temple')return {key:'crowd',kind:'progress'};
  if(target==='p1')return {key:'p1',kind:'progress'};
  if(entity||((regions[target]||parks[target])&&/这里|这边|该区域|这个区域|那里|当前区域/.test(text)))return {phase:'unavailable',label:'暂无记录',message:'暂无该区域对应事件的处置进展，已保留当前视图。'};
  $('clarify-options').hidden=false;return {phase:'clarify',label:'待明确',message:'请选择要跟进的事件。候选仅填入问题，确认提交后再切换。'};
 }
 if(entity){
  if(!people&&!parking&&!/概况|情况|怎么样|看看|查看|在哪|堵|缓行|车流|交通/.test(text))return {phase:'clarify',label:'待明确',message:'请补充要查看的指标，例如当前人数、停车余位或道路情况。'};
  if(parking&&!parks[entity]){if(entity==='entrance')return {key:'p1',kind:/占用率/.test(text)?'occupancy':null};return {phase:'unavailable',label:'数据不足',message:'暂无该区域独立停车统计，已保留当前视图。'}};
  if(people&&parks[entity])return {phase:'unavailable',label:'数据不足',message:'停车场暂无独立人流统计，已保留当前视图。'};
  if(/堵|缓行|车流|交通/.test(text)&&entity!=='entrance')return {phase:'unavailable',label:'暂无记录',message:'暂无该区域道路观测数据，已保留当前视图。'};
  return {key:entity==='entrance'&&!people&&!parking?'road':entity,kind:/占用率/.test(text)?'occupancy':null};
 }
 if(/这里|这边|该区域|这个区域|那里|当前区域/.test(text)){
  const current=regionKey(context.view);
  if(people&&regions[current])return {key:current};
  if(parking&&parks[context.view])return {key:context.view};
  return {phase:'clarify',label:'待明确',message:'请明确区域和可查询指标，当前视图保持不变。'};
 }
 if(/人最多|人多|最拥挤/.test(text))return {key:'people'};
 if(/全园|整体|全部|整个景区/.test(text)){if(/交通|道路|车流|拥堵|缓行/.test(text))return {phase:'unavailable',label:'范围数据不足',message:'当前仅有入口上游道路观测，不能代表全园交通；可询问“入口道路情况”。'};return {key:parking?'parking':'overview',kind:people?'total':/占用率/.test(text)?'occupancy':null};}
 if(/人最多|最拥挤|人流|人数|客流/.test(text))return {key:'people'};
 if(parking)return {key:'parking',kind:/占用率/.test(text)?'occupancy':null};
 if(/拥堵|缓行|堵|车流/.test(text))return {key:'road'};
 return {phase:'clarify',label:'待明确',message:'请说明区域与指标，例如“天台有多少人”或“P1还有多少车位”。'};
}
const refreshButton=document.createElement('button');
refreshButton.type='button';refreshButton.id='refresh-query';refreshButton.hidden=true;
refreshButton.textContent='重新查询';
refreshButton.title='按原问题和查询范围重新检查最近一次成功结果';
document.querySelector('.query-actions').prepend(refreshButton);
refreshButton.onclick=()=>submitQuery(lastSuccess,true);

function createProcess(refresh,text){
 const detail=document.createElement('details');
 detail.className='analysis-process';detail.dataset.status='running';detail.open=true;
 const summary=document.createElement('summary');summary.textContent=refresh?'正在重新查询…':'正在查询…';
 const note=document.createElement('p');note.className='analysis-mode';note.textContent='实际执行摘要 · 本地台账与样例观测';
 const task=document.createElement('p');task.className='analysis-task';task.textContent='任务：'+text;
 const current=document.createElement('p');current.className='analysis-current';current.setAttribute('role','status');current.setAttribute('aria-live','polite');
 const basis=document.createElement('p');basis.className='analysis-basis';basis.textContent='依据：正在读取本地业务台账；观测为2026-11-13 14:30样例快照。';
 const gap=document.createElement('p');gap.className='analysis-gap';gap.textContent='缺口：未接入真实实时观测、视频或模型。';
 const list=document.createElement('ol');
 const steps=[];
 detail.append(summary,note,task,current,list,basis,gap);$('chat-messages').append(detail);$('chat-messages').scrollTop=$('chat-messages').scrollHeight;
 return {detail,summary,steps,current,basis,gap,list};
}
function setStep(step,status,text){step.dataset.status=status;step.lastElementChild.textContent=text;if(status==='running')step.setAttribute('aria-current','step');else step.removeAttribute('aria-current');}
async function processStage(request,index,description,work=()=>{}){
 if(pending!==request)throw new DOMException('查询已取消','AbortError');
 const process=request.process,step=document.createElement('li'),name=document.createElement('span'),stateLabel=document.createElement('span');
 name.textContent=description;stateLabel.className='analysis-step-state';step.append(name,stateLabel);process.list.append(step);process.steps[index]=step;
 setStep(step,'running','进行中');process.summary.textContent=request.refresh?'正在重新查询':'正在查询';
 process.current.textContent='第 '+(index+1)+' 步 · '+description;
 feedback('running',request.refresh?'重新查询中':'正在查询',description+'；观测使用固定样例');
 $('chat-messages').scrollTop=$('chat-messages').scrollHeight;
 await new Promise(resolve=>requestAnimationFrame(resolve));
 if(pending!==request)throw new DOMException('查询已取消','AbortError');
 const result=await work();
 if(pending!==request)throw new DOMException('查询已取消','AbortError');
 return result;
}
function finishProcess(request,status,label){
 const {detail,summary,steps,current}=request.process;detail.dataset.status=status;summary.textContent=label;
 current.textContent=status==='success'?'当前工作：已完成，地图与统计已联动。':status==='cancelled'?(request.committed?'已停止，保留已呈现的地图与内容。':'当前工作：已取消，未更新地图。'):(request.committed?'后续执行未完成，已呈现内容保留。':'当前工作：本次未完成地图更新。');
 if(status==='success'){detail.open=true;for(const step of steps)if(step.dataset.status==='running')setStep(step,'done','已更新');}
 else steps.forEach(step=>{
  if(step.dataset.status==='running')setStep(step,status,status==='cancelled'?'已取消':status==='error'?'失败':'未完成');
  if(step.dataset.status==='waiting')setStep(step,'skipped','未执行');
 });
 $('chat-messages').scrollTop=$('chat-messages').scrollHeight;
}
async function submitQuery(previous=null,refresh=false){
 if(pending)return;
 const text=previous?.text??$('question').value.trim();
 if(!text){feedback('ready','待输入','请先输入问题，再点击发送');return}
 if(!openAssistant(true))return;
 const context=structuredClone(previous?.context??state);
 if(!refresh)appendMessage('user',text);
 $('clarify-options').hidden=true;
 const request={text,context,refresh,process:createProcess(refresh,text),controller:new AbortController(),committed:false};pending=request;lastQuery=request;setQueryBusy(true);request.layoutTask=focusMap(request).catch(error=>{if(pending===request)throw error});
 const {steps,basis,gap}=request.process;feedback('running','正在查询','正在读取本地台账；旧地图保持可见，观测使用固定样例');
 try{
  const data=await processStage(request,0,'核对问题所需的数据依据',async()=>{
   const response=window.BrowserStore?{ok:true,json:()=>BrowserStore.read()}:await fetch('/api/product/state',{signal:request.controller.signal,headers:{'X-Role':'viewer'}});
   if(!response.ok)throw Error('台账服务暂不可用');
   const data=await response.json();if(!Array.isArray(data.items))throw Error('台账数据格式不可用');await settleLayout(request);return data;
  });
  basis.textContent='依据：本地业务台账已读取；观测为2026-11-13 14:30样例快照。';await presentResult(request,0,'已读取 '+data.items.length+' 条业务记录，读取结果已就绪');setStep(steps[0],'done','台账读取完成');
  const outcome=await processStage(request,1,'识别问题范围并定位地图',()=>query(text,context));
  if(!outcome.key){
   setStep(steps[1],'done',outcome.label);gap.textContent='缺口：'+outcome.message;finishProcess(request,outcome.phase,outcome.label+' · 查看依据');pending=null;setQueryBusy(false);feedback(outcome.phase,outcome.label,outcome.message);appendMessage('assistant',outcome.message,outcome.label);return;
  }
  const key=outcome.key,video=videoFor(key);
  const road=data.items.find(x=>x.id==='road');
  if(key==='event'&&!road){const message='本地台账中未找到入口道路事项，已保留当前视图。';setStep(steps[1],'done','事项未找到');gap.textContent=message;finishProcess(request,'unavailable','暂无事项记录');pending=null;setQueryBusy(false);feedback('unavailable','暂无事项记录',message);appendMessage('assistant',message,'暂无事项记录');return;}
  if(road){views.event.source='本地业务台账';views.event.title=road.title+'：'+road.status;views.event.body='责任：'+(road.owner||'尚未安排')+'。最近记录：'+road.records.at(-1).slice(1).join('；').replace(/[。；]+$/,'')+'。本地业务记录，不表示已执行外部调度。';incidents.road.updatedAt=road.records.at(-1)[0];incidents.road.status=road.status;incidents.road.team=road.owner||'尚未安排';incidents.road.update=road.records.at(-1).slice(1).join('；');}
  const result=queryResult(key,outcome.kind);
  basis.textContent='依据：'+(key==='event'?'本地业务台账最新记录；场景仅为示意。':result.source+'（样例数据）');
  gap.textContent='缺口：'+(outcome.kind==='trend'?'仅有已列时段全园序列，不代表各片区趋势或未来预测。':outcome.kind==='admissions'?'暂无各入口入园明细；累计人次不等于当前在园人数。':key==='shuttle'?'仅有运行车辆数量，暂无站点等待、班次与乘坐余位。':outcome.kind==='progress'?'进度按已记录事项呈现，场景图不代表最新处置结果。':key==='road'||key==='event'?'排队原因及影响范围仍待实际核查；停车观测不证明因果。':key==='parking'||parks[key]?'余位为固定样例，非实时；不包含路线、费用或变化趋势。':'人数为固定样例，不能推断全园趋势或未覆盖区域状态。');
  await mapTransition(request,()=>show(key,'问答',text,true,outcome.kind));
  await presentResult(request,1,key==='overview'?'已展示全园范围，查看各片区分布':'范围已定位，查看地图高亮点位');
  setStep(steps[1],'done','范围已定位');
  const statsLabel=outcome.kind==='progress'?'展示事项状态、责任与最近记录':outcome.kind==='trend'?'绘制全园在园人数趋势':outcome.kind==='admissions'?'展示今日累计入园人次':outcome.kind==='total'?'汇总全园在园人数':parks[key]||key==='parking'?'展示停车余位与占用情况':'展示当前范围的关键统计';
  await processStage(request,2,statsLabel,()=>revealEvidence(request,2));
  await presentResult(request,2,'统计已呈现，查看地图旁的关键指标');setStep(steps[2],'done','关键统计已呈现');
  const pictureReady=await processStage(request,3,video?'加载并展示相关场景':'核对对应场景是否可用',async()=>{
   let ready=false;
   if(video){const picture=new Image();picture.src=videos[video].image;try{await picture.decode();ready=true}catch{}}
   if(pending!==request)throw new DOMException('查询已取消','AbortError');
   state.pictureFailed=!ready;await revealEvidence(request,3);return ready;
  });
  await presentResult(request,3,pictureReady?'场景已呈现，可对照地图与统计':'该范围暂无可用画面，已明确标注');
  setStep(steps[3],pictureReady?'done':'skipped',pictureReady?'场景示意 · 非实时':'无可用画面');
  if(!pictureReady)gap.textContent+=' 对应场景图不可用。';
  await processStage(request,4,'汇总当前情况与待核实事项',()=>revealEvidence(request,4));
  await presentResult(request,4,'情况说明已呈现，完成本次查询');
  pending=null;setQueryBusy(false);setStep(steps[4],'done','情况说明已呈现');finishProcess(request,'success','查询已完成 · 查看执行摘要');lastSuccess={text,context};refreshButton.hidden=false;appendAnswer(key);
  if(key==='event'||key==='road'){const link=document.createElement('a');link.href='index.html?item=road&from=screen';link.textContent='查看同一业务事项 ↗';link.className='business-jump';$('chat-messages').append(link)}
  if(refresh)feedback('success','已重新查询','观测数据暂无变化 · 仍为 2026-11-13 14:30 样例快照；业务进度已读取最新本地记录');
  else{if($('question').value.trim()===text)$('question').value='';feedback('success','更新完成',(key==='event'?'本地业务台账 · ':'样例快照 · ')+result.title)}
 }catch(error){if(pending!==request)return;finishProcess(request,'error','查询失败 · 查看过程');pending=null;setQueryBusy(false);feedback('error','执行未完成',request.committed?'已保留已呈现内容，可重新查询':'本次未更新大屏，请重试');appendMessage('assistant',error.message+(request.committed?'，已呈现的内容保留。':'，已保留原视图。'),'执行未完成')}
}
function draft(text){if(!document.body.classList.contains('chat-open')&&!openQuestion())return;cancelPending();$('question').value=text;$('question').focus({preventScroll:true});feedback('ready','待提交','问题已填入，可编辑；点击发送或按 Enter 才更新大屏')}
$('query-form').onsubmit=e=>{e.preventDefault();submitQuery()};
$('question').oninput=()=>{cancelPending();feedback('ready','草稿未提交','当前画面保持不变，点击发送或按 Enter 提交')};
document.querySelectorAll('[data-query]').forEach(b=>b.onclick=()=>draft(b.dataset.query));
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>show(b.dataset.view));
document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{cancelPending();save();const key=b.dataset.toggle;state.layers=state.layers.includes(key)?state.layers.filter(x=>x!==key):[...state.layers,key];state.source='手动筛选';render();feedback('success','图层已更新',state.layers.length?'当前显示 '+state.layers.length+' 个图层，统计范围保持不变':'全部图层已隐藏，可选择图层或恢复全园')});
$('previous-view').onclick=previousView;$('reset-map').onclick=overview;$('restore-overview').onclick=overview;
$('back-alerts').onclick=()=>{state.alertDetail=false;renderAlerts()};
$('continue-query').onclick=()=>{draft('');$('query-status').textContent='可继续询问当前区域或事件，当前画面保持不变'};
$('retry-query').onclick=()=>{if(lastQuery)submitQuery(lastQuery,lastQuery.refresh)};
function videoPreview(key,scene){
 const video=scene||videos[key];if(!video)return;
 $('video-dialog-title').textContent=video.name;
 $('video-large').src=video.image;
 $('video-dialog-context').textContent=scene||parks[key]?'AI 场景示意 · 非实时':'场景预览 · 14:30 快照';
 $('video-dialog').showModal()
}
$('people-scene-preview').onclick=()=>videoPreview(null,peopleScenes[regionKey(state.view)]);
$('people-scene-image').onerror=()=>{
 $('people-scene-preview').hidden=true;
 $('people-scene-empty').hidden=false;
 $('people-scene-empty').textContent='当前场景示意无法加载';
};
$('main-video').onclick=()=>videoPreview(state.video);
$('topic-adjacent-video').onclick=()=>videoPreview('entrance');
document.querySelectorAll('.video-thumbs [data-video],.map-point[data-video]').forEach(b=>b.onclick=()=>show(b.dataset.video,'视频选区'));
$('close-video').onclick=()=>$('video-dialog').close();
$('video-switch').onclick=()=>{const keys=['entrance','temple','peak'];const key=keys[(keys.indexOf(state.video)+1)%keys.length];show(key,'视频选区')};
$('video-image').onerror=()=>{$('main-video').hidden=true;$('video-empty').hidden=false;$('video-empty').textContent='当前画面无法加载';$('video-context').textContent='画面不可用，不以其他位置图片替代'};
$('video-image').onload=()=>{$('video-empty').textContent='暂无该区域现场画面'};
function fitMap(){document.querySelector('.map-stage').style.marginBottom='0px'}
const compactViewport=window.matchMedia('(max-width: 1100px), (max-height: 719px)');
const separator=$('chat-resizer');
let chatWidth=innerWidth>=1800?440:innerWidth<=1300?360:400;
let drag=null;
function setChatWidth(width=chatWidth){
 const max=Math.max(320,Math.min(640,innerWidth-760));
 chatWidth=Math.max(320,Math.min(max,Math.round(width)));
 document.body.style.setProperty('--chat-width',chatWidth+'px');
 separator.setAttribute('aria-valuemin','320');
 separator.setAttribute('aria-valuemax',String(max));
 separator.setAttribute('aria-valuenow',String(chatWidth));
 separator.setAttribute('aria-valuetext',chatWidth+' 像素');
}
function stopDrag(){
 if(!drag)return;
 const id=drag.id;drag=null;
 document.body.classList.remove('chat-dragging');
 if(separator.hasPointerCapture(id))separator.releasePointerCapture(id);
}
separator.onpointerdown=e=>{
 if(!e.isPrimary||e.button!==0)return;
 separator.focus();e.preventDefault();
 drag={id:e.pointerId,start:e.clientX,width:chatWidth};
 separator.setPointerCapture(e.pointerId);
 document.body.classList.add('chat-dragging');
};
separator.onpointermove=e=>{if(drag?.id===e.pointerId)setChatWidth(drag.width+drag.start-e.clientX)};
separator.onpointerup=separator.onpointercancel=separator.onlostpointercapture=e=>{if(drag?.id===e.pointerId)stopDrag()};
separator.onkeydown=e=>{
 if(!['ArrowLeft','ArrowRight'].includes(e.key))return;
 e.preventDefault();setChatWidth(chatWidth+(e.key==='ArrowLeft'?20:-20));
};
setChatWidth();
function resizePreview(){
 setChatWidth();
 if(compactViewport.matches&&document.body.classList.contains('query-entry'))closeQuestion(false);
 if(compactViewport.matches&&document.body.classList.contains('chat-open')){
  closeAssistant();
  $('guard-chat-hint').focus();
 }
 if(document.body.classList.contains('fit-preview')){
  document.body.style.setProperty('--preview-scale',Math.max(0,Math.min(innerWidth/1440,(innerHeight-132)/900)));
 }
 fitMap();
}
$('guard-preview').onclick=()=>{document.body.classList.toggle('fit-preview');$('guard-preview').textContent=document.body.classList.contains('fit-preview')?'退出等比预览':'查看等比预览';resizePreview()};
$('guard-fullscreen').onclick=()=>document.documentElement.requestFullscreen().catch(()=>{document.querySelector('.guard-detail').textContent='请展开浏览器窗口，或使用浏览器全屏功能。'});
window.addEventListener('resize',resizePreview);
new ResizeObserver(fitMap).observe(document.querySelector('.assistant-dock'));
$('voice').onclick=()=>{$('voice-popover').hidden=!$('voice-popover').hidden};function stopVoice(){if(recognition)recognition.stop();listening=false;$('start-voice').textContent='开始语音输入'}$('close-voice').onclick=()=>{stopVoice();$('voice-popover').hidden=true};$('voice-example').onclick=()=>{stopVoice();$('transcript').value='哪里人最多？';$('voice-state').textContent='示例转写已填入，可编辑后确认联动'};
$('start-voice').onclick=()=>{if(listening){stopVoice();return}const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Speech){$('voice-state').textContent='当前浏览器不支持语音识别，可使用示例或输入文字体验。';return}recognition=new Speech();recognition.lang='zh-CN';recognition.interimResults=true;recognition.onstart=()=>{listening=true;$('start-voice').textContent='停止录音';$('voice-state').textContent='正在聆听…识别后请核对文字再提交'};recognition.onresult=e=>{$('transcript').value=Array.from(e.results).map(r=>r[0].transcript).join('')};recognition.onerror=e=>{$('voice-state').textContent=e.error==='not-allowed'?'麦克风未获授权，可直接输入或使用示例。':'本次语音识别未完成，可重试或使用示例。'};recognition.onend=()=>{listening=false;$('start-voice').textContent='开始语音输入'};try{recognition.start()}catch(e){$('voice-state').textContent='语音无法启动，请使用文字或示例。'}};
$('submit-voice').onclick=()=>{const text=$('transcript').value.trim();if(!text){$('voice-state').textContent='请先录入或输入问题';return}stopVoice();cancelPending();$('question').value=text;$('voice-popover').hidden=true;submitQuery()};$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch(e){$('query-status').textContent='当前环境无法进入全屏，可使用浏览器全屏功能'}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){stopVoice();$('voice-popover').hidden=true}});render();

const originalDock=document.querySelector('.assistant-dock');
function openQuestion(){if(compactViewport.matches){$('guard-chat-hint').focus();return false}$('top-query-form-host').append($('query-form'));$('top-query').insertBefore(document.querySelector('.query-shortcuts'),$('top-query').querySelector(':scope > p'));$('top-query').append($('voice-popover'));$('top-query').hidden=false;document.body.classList.add('query-entry');$('open-assistant').setAttribute('aria-expanded','true');$('question').focus({preventScroll:true});return true}
function closeQuestion(focus=true){stopVoice();$('voice-popover').hidden=true;$('screen-assistant').append($('voice-popover'));$('top-query').hidden=true;document.body.classList.remove('query-entry');originalDock.insertBefore(document.querySelector('.query-shortcuts'),originalDock.firstChild);originalDock.insertBefore($('query-form'),$('executed-context'));$('open-assistant').setAttribute('aria-expanded','false');if(focus)$('open-assistant').focus({preventScroll:true})}
$('close-top-query').onclick=()=>closeQuestion();
function setCardsInert(value){document.querySelectorAll('.metrics,.left-rail,.right-rail,#people-scene,#people-rank,#people-trend').forEach(el=>el.inert=value)}
async function focusMap(request){
 if(document.body.classList.contains('map-focus'))return;
 const cards=[...document.querySelectorAll('.metrics,#topic-metrics,.left-rail,.right-rail,#people-scene,#people-rank,#people-trend')].filter(el=>el.getBoundingClientRect().height>0);
 await Promise.all(cards.map(el=>motion(el,[{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(-12px) scale(.97)'}],{duration:360,easing:'ease-in',fill:'none'},request)));
 if(pending!==request)return;
 document.body.classList.add('map-focus');
 await motion(document.querySelector('.map-stage'),[{opacity:.7,transform:'scale(.985)'},{opacity:1,transform:'scale(1)'}],{duration:220,easing:'ease-out'},request);
}
async function settleLayout(request){
 await request.layoutTask;
 await new Promise(resolve=>requestAnimationFrame(resolve));
 const animations=document.querySelector('.screen').getAnimations({subtree:true}).filter(a=>a.effect?.getComputedTiming().iterations!==Infinity&&a.playState==='running');
 await Promise.all(animations.map(a=>a.finished.catch(()=>{})));
 if(pending!==request)throw new DOMException('查询已取消','AbortError');
}
async function motion(element,frames,options,request){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const animation=element.animate(frames,options),abort=()=>animation.cancel();(request.animations??=[]).push(animation);request.controller.signal.addEventListener('abort',abort,{once:true});
 try{await animation.finished}catch{}finally{request.controller.signal.removeEventListener('abort',abort)}
 if(pending!==request)throw new DOMException('查询已取消','AbortError');
}
let mapMotionOwner=null;
async function mapTransition(request,commit){
 mapMotionOwner=request;
 const map=document.querySelector('.map-stage');document.body.classList.add('map-updating');
 try{
  await motion(map,[{opacity:1},{opacity:.45}],{duration:260,easing:'ease-in-out',fill:'forwards'},request);
  if(pending!==request)throw new DOMException('查询已取消','AbortError');
  commit();request.committed=true;lastSuccess={text:request.text,context:request.context};refreshButton.hidden=false;
  await motion(map,[{opacity:.45,transform:'scale(.985)'},{opacity:1,transform:'scale(1)'}],{duration:520,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'},request);
 }finally{(request.animations||[]).forEach(a=>a.cancel());if(mapMotionOwner===request){document.body.classList.remove('map-updating');mapMotionOwner=null}}
}
function openAssistant(deferFocus=false){if(compactViewport.matches){$('guard-chat-hint').focus();return false}closeQuestion(false);document.body.classList.add('chat-open');if(!deferFocus)document.body.classList.add('map-focus');$('screen-assistant').hidden=false;$('open-assistant').setAttribute('aria-expanded','false');setCardsInert(true);requestAnimationFrame(fitMap);return true}
function closeAssistant(){const committed=pending?.committed;if(cancelPending())feedback('ready',committed?'已停止':'已取消',committed?'已呈现内容保留':'收起助手时已取消本次查询');stopDrag();stopVoice();$('voice-popover').hidden=true;document.body.classList.remove('chat-open','map-focus');$('screen-assistant').hidden=true;$('open-assistant').setAttribute('aria-expanded','false');setCardsInert(false);if(!compactViewport.matches)$('open-assistant').focus({preventScroll:true});fitMap()}
function appendMessage(role,text,label){const welcome=document.querySelector('.chat-welcome');if(welcome)welcome.remove();const article=document.createElement('article');article.className='chat-message '+role;if(label){const meta=document.createElement('span');meta.className='message-label';meta.textContent=label;article.append(meta)}const paragraph=document.createElement('p');paragraph.textContent=text;article.append(paragraph);$('chat-messages').append(article);$('chat-messages').scrollTop=$('chat-messages').scrollHeight;return article}
function appendAnswer(key){const item=state.evidenceResult||views[key],article=appendMessage('assistant',item.title,'小岚 · 运行助手');article.firstElementChild.nextElementSibling.className='answer-title';const body=document.createElement('p');body.textContent=item.body;article.append(body);const linked=document.createElement('div');linked.className='linked-state';linked.textContent='✓ 已联动左侧大屏 · '+(topics[state.topic]?.name||state.layers.map(x=>({people:'人流',vehicles:'车流',parking:'车位',events:'事件',base:'基础'}[x])).join(' / '));article.append(linked);const detail=document.createElement('details');const summary=document.createElement('summary');summary.textContent='查看数据依据';detail.append(summary);const source=document.createElement('p');source.textContent=item.source+' · 九华山景区运营快照';detail.append(source);article.append(detail);$('chat-messages').scrollTop=$('chat-messages').scrollHeight}
$('open-assistant').onclick=openQuestion;$('close-assistant').onclick=closeAssistant;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('video-dialog').open){if(document.body.classList.contains('query-entry'))closeQuestion();else if(document.body.classList.contains('chat-open'))closeAssistant()}});

const cancelButton=document.createElement('button');cancelButton.textContent='取消查询';cancelButton.id='cancel-query';cancelButton.hidden=true;cancelButton.onclick=()=>{const committed=pending?.committed;if(cancelPending())feedback('cancelled',committed?'已停止':'已取消',committed?'已呈现内容保留，后续步骤未执行':'当前视图保持不变')};document.querySelector('.query-actions').append(cancelButton);
// Store only inert text and known presentation elements, never executable HTML.
const transcriptTags=new Set(['ARTICLE','SPAN','P','DIV','DETAILS','SUMMARY','OL','LI','A']);
function saveTranscript(node){
 if(node.nodeType===Node.TEXT_NODE)return {text:node.textContent};
 if(!transcriptTags.has(node.tagName))return null;
 return {tag:node.tagName,className:node.className,status:node.dataset.status,open:node.open,href:node.getAttribute('href'),children:[...node.childNodes].map(saveTranscript).filter(Boolean)};
}
function restoreTranscript(record){
 if(typeof record.text==='string')return document.createTextNode(record.text);
 if(!transcriptTags.has(record.tag))return document.createTextNode('');
 const node=document.createElement(record.tag);node.className=typeof record.className==='string'?record.className:'';
 if(['running','success','cancelled','error','done','skipped','unsupported','unavailable','clarify'].includes(record.status))node.dataset.status=record.status==='running'?'cancelled':record.status;
 if(record.tag==='DETAILS')node.open=!!record.open;
 if(record.tag==='A'&&record.href==='index.html?item=road&from=screen')node.setAttribute('href',record.href);
 for(const child of record.children||[])node.append(restoreTranscript(child));return node;
}
window.addEventListener('pagehide',()=>{
 cancelPending();
 const transcript=[...$('chat-messages').children].filter(node=>!node.classList.contains('chat-welcome')).map(saveTranscript).filter(Boolean);
 sessionStorage.setItem('product-screen',JSON.stringify({state,history,question:$('question').value,lastSuccess,chatOpen:document.body.classList.contains('chat-open'),chatWidth,transcript,queryEntry:document.body.classList.contains('query-entry')}));
});
try{const saved=JSON.parse(sessionStorage.getItem('product-screen')||'null');if(saved&&views[saved.state.view]){state=saved.state;history=saved.history;lastSuccess=saved.lastSuccess;$('question').value=saved.question;refreshButton.hidden=!lastSuccess;render();if(saved.transcript?.length)$('chat-messages').replaceChildren(...saved.transcript.map(restoreTranscript));if(saved.chatWidth)setChatWidth(saved.chatWidth);if(saved.chatOpen)openAssistant();else if(saved.queryEntry)openQuestion();$('chat-messages').scrollTop=$('chat-messages').scrollHeight}}catch{}
