/* Independent visitor workspace: no server writes or external dispatch. */
(function(){
 'use strict';
 const PHASES={verify:'待安排核查',verify_feedback:'等待核查反馈',decision:'待人工决策',assign:'待安排',feedback:'等待处置反馈',review:'待复核',closed:'已结束'};
 const clone=value=>structuredClone(value),id=()=>crypto.randomUUID(),now=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,19)+'+08:00';
 const require=(ok,message,status=400)=>{if(!ok)throw Object.assign(Error(message),{status})};
 const text=(p,key)=>{require(typeof p[key]==='string'&&p[key].trim(),'请填写 '+key);return p[key].trim()};
 const find=(rows,key)=>{const row=rows.find(x=>x.id===key);require(row,'记录不存在',404);return row};
 const version=(row,p)=>require(Number.isInteger(p.version)&&row.version===p.version,'记录已更新，请刷新后重试',409);
 const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const pick=(row,keys)=>Object.fromEntries(keys.map(key=>[key,row[key]]));
 const stage={verify:1,verify_feedback:1,decision:2,assign:2,feedback:2,review:3,closed:4};
 const aliases={road:['道路','交通','入口','拥堵'],cable:['索道','花台','候乘'],rail:['护栏','百岁宫','步道'],clean:['垃圾','游客中心','清运','保洁']};
 const areaIds=area=>Object.entries(aliases).filter(([,words])=>words.some(w=>(area||'').includes(w))).map(([key])=>key);
 function decorate(item){
  item.originalSnapshot??=clone(pick(item,['summary','evidence','advice','reason','action','flag','task','next','progress','records']));
  item.verificationAssignment??=null;item.verificationFeedback??=[];item.feedback??=[];
  Object.assign(item,{status:PHASES[item.phase],completed:item.phase==='closed',archived:item.phase==='closed',adviceHistorical:item.phase!=='verify'});
  item.waitingFor={verify:'值班人员安排核查',verify_feedback:(item.verificationAssignment?.owner||'原核查负责人')+'提交核查反馈',decision:'有权人员确认方案',assign:'值班人员安排处置',feedback:(item.owner||'处置责任组')+'提交处置反馈',review:'复核人员核对结果',closed:'无待办，事项已结束'}[item.phase];
  if(item.phase==='verify')Object.assign(item,{action:'安排现场核查',flag:'待安排核查',task:'指定责任组并登记核查安排，随后等待实际核查材料。',next:'核查人员提交事实与依据后，再判断有效、误报或重复。'});
  if(item.version>1){
   const actions={verify:'安排现场核查',verify_feedback:'登记核查反馈',decision:'确认处置方案',assign:'登记人员安排',feedback:'登记处置反馈',review:'复核处理结果',closed:'查看结束记录'};
   const tasks={verify:'指定责任组并登记核查安排，随后等待实际核查材料。',verify_feedback:'登记核查人员反馈的现场事实、依据及核查结论。',decision:'核对影响范围并作出景区职责内的人工决定。',assign:'选择责任组并确认本地安排；不会发送外部通知。',feedback:'登记现场反馈与依据；仅记录已经获得的材料。',review:'核对反馈与依据后通过或退回。',closed:'原始事实、人工决定与执行记录均保留供查阅。'};
   Object.assign(item,{summary:item.title+'：'+PHASES[item.phase]+'。'+(item.owner||'尚未指定责任组')+'。',action:actions[item.phase],flag:PHASES[item.phase],task:tasks[item.phase],next:tasks[item.phase]});
   const latest=item.records.at(-1);item.evidence='最新本地记录：'+latest[1]+' · '+latest[2];
   if(item.verificationFeedback.length){const f=item.verificationFeedback.at(-1);item.evidence+='；核查反馈：'+f.text+'；核查依据：'+f.evidence}
   if(item.feedback.length){const f=item.feedback.at(-1);item.evidence+='；反馈：'+f.text+'；依据：'+f.evidence}
   item.advice=(item.adviceHistorical?'历史建议：':'')+(item.originalSnapshot.advice||'');
   item.reason=(item.adviceHistorical?'此建议来自初始示例快照，不代表当前阶段的新分析。':'')+(item.originalSnapshot.reason||'');
  }
  return item;
 }
 function materials(files){
  require(Array.isArray(files)&&files.length<=3,'最多选择3张图片');
  return files.map(file=>{
   require(object(file),'图片格式无效');const {name,type,data}=file;
   require(typeof name==='string'&&name.length>0&&name.length<=180,'图片名称无效');
   require(['image/jpeg','image/png','image/webp'].includes(type),'仅支持JPG、PNG或WebP图片');
   require(typeof data==='string'&&data.length<=2796204,'每张图片不超过2MB');
   require(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data),'图片数据无效');
   const raw=atob(data);require(raw.length>0&&raw.length<=2*1024*1024,'每张图片不超过2MB');
   require((type==='image/png'&&raw.startsWith('\x89PNG\r\n\x1a\n'))||(type==='image/jpeg'&&raw.startsWith('\xff\xd8\xff'))||(type==='image/webp'&&raw.slice(0,4)==='RIFF'&&raw.slice(8,12)==='WEBP'),'图片内容与文件类型不符');
   return {id:id(),name,type,size:raw.length,url:'data:'+type+';base64,'+data};
  });
 }
 function apply(s,p,kind,role){
  if(kind.startsWith('item.')){
   const item=find(s.items,p.id);version(item,p);const op=kind.slice(5),allowed={verify_assign:'verify',verify_feedback:'verify_feedback',decide:'decision',assign:'assign',feedback:'feedback',review:'review'};
   require(allowed[op]&&item.phase===allowed[op],'当前阶段不能执行此操作',409);
   let detail='',title='',evidence='',recordOwner=item.owner||'';
   if(op==='verify_assign'){
    const owner=text(p,'owner'),note=p.note??'';require(item.people.includes(owner),'请选择当前事项的核查责任组');require(typeof note==='string','核查说明格式无效');
    item.verificationAssignment={owner,note:note.trim(),time:now(),version:item.version+1,externalSent:false};Object.assign(item,{owner,phase:'verify_feedback'});title='登记核查安排';detail=owner+' · '+note.trim()+'；等待核查反馈，未发送外部通知';
   }else if(op==='verify_feedback'){
    require(item.verificationAssignment,'请先登记核查安排',409);require(['valid','false','duplicate'].includes(p.outcome),'请选择核查结论');detail=text(p,'text');evidence=text(p,'evidence');
    item.verificationFeedback.push({text:detail,evidence,outcome:p.outcome,targetId:p.outcome==='duplicate'?p.targetId:null,owner:item.verificationAssignment.owner,assignmentVersion:item.verificationAssignment.version,time:now(),source:'本地人工登记'});detail+='；依据：'+evidence;item.owner='';
    if(p.outcome==='valid'){item.phase=(item.businessType||item.id)==='road'?'decision':'assign';title='人工核查有效'}else{
     Object.assign(item,{phase:'closed',resolution:p.outcome==='false'?'误报终止':'重复合并'});title=item.resolution;
     if(p.outcome==='duplicate'){const target=find(s.items,text(p,'targetId'));require(target.id!==item.id,'不能关联自身');require(target.phase!=='closed'&&!target.duplicateOf,'关联目标须为未结束的主事项');item.duplicateOf=target.id}
    }
   }else if(op==='decide'){
    require(typeof p.approve==='boolean','请选择方案决定');detail=text(p,'note');item.phase=p.approve?'assign':'verify';item.decision={approved:p.approve,note:detail,version:item.version,time:now()};title=p.approve?'人工确认方案':'退回核查';if(!p.approve)item.owner='';
   }else if(op==='assign'){
    const owner=text(p,'owner');require(item.people.includes(owner),'请选择当前事项的责任组');detail=String(p.note??'').trim();Object.assign(item,{owner,phase:'feedback',assignment:{owner,note:detail,time:now(),externalSent:false}});title='登记本地安排';
   }else if(op==='feedback'){
    detail=text(p,'text');require(typeof (p.evidence??'')==='string','补充来源说明格式无效');evidence=(p.evidence||'').trim()||(item.owner?'关联责任班组：'+item.owner+'；登记角色：业务人员':'登记角色：业务人员；未附其他来源说明');require([undefined,null,'ongoing','improved','resolved'].includes(p.condition),'请选择有效的当前情况');
    item.feedback.push({text:detail,evidence,time:now(),source:'本地人工登记',condition:p.condition,owner:item.owner,attachments:p.attachments||[]});if(p.condition)detail='当前情况：'+({ongoing:'仍需处置',improved:'情况改善',resolved:'已恢复'})[p.condition]+'；'+detail;item.phase='review';title='登记处置反馈';
   }else if(op==='review'){
    require(typeof p.approve==='boolean','请选择复核结果');require(item.feedback.length,'缺少反馈不能复核',409);detail=text(p,'reason');item.phase=p.approve?'closed':'feedback';title=p.approve?'复核通过':'退回补充';item.resolution=p.approve?'正常完成':'';
   }
   Object.assign(item,{version:item.version+1,updatedAt:now(),stage:stage[item.phase]});item.recordMeta??={};item.recordMeta[item.records.length]={actor:role==='reviewer'?'复核人员（本地角色）':'业务人员（本地角色）',owner:item.owner||recordOwner,evidence:op==='feedback'?evidence:p.evidence||'',attachments:p.attachments||[]};item.records.push([now(),title,detail+' · 本地人工记录']);return {item,itemId:item.id};
  }
  if(kind==='draft.save'){find(s.items,p.id);require(object(p.draft),'草稿格式无效');s.drafts[p.id]=p.draft;return {id:p.id,draft:p.draft}}
  if(kind==='session.create'){
   const context=p.context??{};require(object(context),'上下文格式无效');if(context.itemId)find(s.items,context.itemId);const session={id:id(),title:'新会话',context,messages:[],version:1,createdAt:now()};s.sessions.unshift(session);return {session,sessionId:session.id};
  }
  if(kind==='session.message')return message(s,p);
  if(kind==='report.generate')return report(s,p);
  if(kind==='report.edit'){
   const row=find(s.reports,p.id);version(row,p);const content=text(p,'content');row.history.push(clone(pick(row,['version','content','updatedAt','sources'])));Object.assign(row,{content,version:row.version+1,updatedAt:now()});return {report:row,reportId:row.id};
  }
  require(false,'未知操作');
 }
 function message(s,p){
  const session=find(s.sessions,p.id);version(session,p);const question=text(p,'text'),context=session.context,explicit=areaIds(question);
  const words='生成 整理 报告 简报 今日 今天 九华山 全园 全部 本地 示例 当前 现在 事项 事件 状态 进度 进展 责任 负责 谁 人员 下一步 接下来 怎么处理 该做什么 依据 证据 来源 记录 建议 分析 原因 为何 为什么 统计 数量 多少 几项 几起 待处理 待核查 处理中 待复核 已结束 概况 清单 列表 分布 汇总 总结 查看 查询 告诉 给我 请 我 我们 这个 这些 这项 一下 什么 怎么 有 的 吗 呢 和 与 及 是 在 情况'.split(' ').concat(Object.values(aliases).flat());
  let remainder=question;for(const word of words.sort((a,b)=>b.length-a.length))remainder=remainder.split(word).join('');remainder=remainder.replace(/[\s，。！？、：:,.!?；;（）()]+/g,'');
  const timeRequested=/昨天|昨日|明天|本周|上周|本月|去年|\d{2,4}[-年月日/:]/.test(question)||![undefined,null,'','today','今天','今日',now().slice(0,10)].includes(context.date);
  const conflict=!!(context.itemId&&explicit.length&&(explicit.length!==1||explicit[0]!==context.itemId));
  const unknownArea=![undefined,null,'','九华山','全园','全部','全部可见'].includes(context.area)&&!areaIds(context.area).length;
  const unsupported=!!(remainder||timeRequested||conflict||unknownArea);
  const selected=context.itemId?[context.itemId]:explicit.length?explicit:/全园|全部/.test(question)?s.items.map(x=>x.id):areaIds(context.area).length?areaIds(context.area):session.queryItemIds?.length?session.queryItemIds:s.items.map(x=>x.id);
  const rows=selected.map(key=>find(s.items,key)),intent=/依据|证据|来源|记录/.test(question)?'evidence':/建议|分析|原因|为何|为什么|怎么处理|下一步|该做什么/.test(question)?'advice':/统计|数量|多少|几项|几起|分布|概况|汇总|总结|清单|列表|报告|简报/.test(question)?'statistics':'progress';
  let sources=rows.map(x=>pick(x,['id','title','version','phase','location'])),answer;
  if(unsupported){answer=conflict?'当前会话绑定其他事项，请新建会话或移除当前事项范围后查询；本次未切换对象。':'当前仅支持九华山本地示例事项的进度、依据、建议和统计。该地点、日期或需求没有对应数据，本次未更新查询范围。';sources=[]}
  else if(intent==='evidence')answer=rows.map(x=>x.title+'：'+x.evidence+' '+x.scope).join('\n');
  else if(intent==='advice')answer=rows.map(x=>x.title+'：'+x.advice+'。依据：'+x.reason+' 此为建议，未执行操作。').join('\n');
  else if(intent==='statistics')answer=`当前范围的本地台账共 ${rows.length} 项，待核查 ${rows.filter(x=>x.stage===1).length} 项，处理中 ${rows.filter(x=>x.stage===2).length} 项，待复核 ${rows.filter(x=>x.stage===3).length} 项，已结束 ${rows.filter(x=>x.stage===4).length} 项。仅反映示例事项台账，不代表全园实时运行。`;
  else answer=rows.map(x=>x.title+'：'+PHASES[x.phase]+'。责任：'+(x.owner||'尚未指定')+'。'+x.scope).join('\n');
  if(!unsupported)session.queryItemIds=rows.map(x=>x.id);session.lastQueryStatus=unsupported?'unsupported':'success';
  if(!unsupported&&/今日|今天/.test(question))answer+=' 今日仅指当前本地示例台账，不是景区真实当日运营统计。';
  const result={id:id(),question,answer,sources,unsupported,status:session.lastQueryStatus,kind:intent,time:now(),metrics:unsupported?[]:['待核查','处理中','待复核','已结束'].map((label,index)=>({label,value:rows.filter(x=>x.stage===index+1).length})),itemSnapshots:unsupported?[]:clone(rows),scopeLabel:/今日|今天/.test(question)?'今日的本地示例台账（非真实当日运营数据）':'本地示例事项台账'};
  session.messages.push({id:id(),role:'user',text:question,time:now()},{...result,role:'assistant',text:answer});session.version++;if(session.messages.length===2)session.title=question.slice(0,24);return {message:result,session,sessionId:session.id};
 }
 function report(s,p){
  let context={},session=null,source=null;require(!p.messageId||p.sessionId,'引用回答需要所属会话');
  if(p.sessionId){session=find(s.sessions,p.sessionId);context=session.context;if(p.messageId){source=find(session.messages,p.messageId);require(source.role==='assistant'&&!source.unsupported&&source.itemSnapshots?.length,'该回答没有可用的已保存查询快照，请重新查询',409)}else require(session.lastQueryStatus!=='unsupported','最近问题的范围或能力不受支持，请先明确范围并成功查询',409)}
  const dates=[undefined,null,'','today','今天','今日',now().slice(0,10)];require(dates.includes(p.date)&&dates.includes(context.date),'缺少该日期的可核验数据，不能生成报告',409);require(!p.area||['九华山','全园','全部'].includes(p.area),'报告范围未识别',409);
  const area=context.area||'';require(['','九华山','全园','全部','全部可见'].includes(area)||areaIds(area).length,'报告范围未识别',409);
  const itemId=p.itemId||context.itemId,selected=itemId?[itemId]:session?.queryItemIds?.length?session.queryItemIds:areaIds(area).length?areaIds(area):s.items.map(x=>x.id),rows=source?source.itemSnapshots:selected.map(key=>find(s.items,key));
  const cell=value=>String(value).replaceAll('&','&amp;').replaceAll('|','&#124;').replaceAll('\r','&#13;').replaceAll('\n','&#10;');
  const table='| 事项 | 状态 | 责任 |\n| --- | --- | --- |\n'+rows.map(x=>'| '+[x.title,PHASES[x.phase],x.owner||'未指定责任'].map(cell).join(' | ')+' |').join('\n');
  let content='一、范围与来源\n本地示例事项台账，生成于 '+now()+'。非实时全园统计。\n\n二、事项进展\n'+table+'\n\n三、建议与缺口\n建议按当前事项阶段核查、跟进及复核。未接入真实业务、现场视频与模型；不推断拥堵原因或经营情况。';
  if(source)content+='\n\n四、引用快照\n回答快照时间：'+source.time+'。采用该回答保存的事项版本，后续业务变化不改写本报告。';
  const result={id:id(),title:p.title||'景区事项进展报告',content,status:'草稿',version:1,history:[],sources:rows.map(x=>pick(x,['id','title','version'])),sessionId:p.sessionId,messageId:p.messageId,snapshotAt:source?source.time:now(),createdAt:now(),updatedAt:now()};s.reports.unshift(result);return {report:result,reportId:result.id};
 }
 let opening,seedPromise;
 const seed=()=>seedPromise??=(async()=>{const response=await fetch(new URL('browser-seed.json',document.baseURI));require(response.ok,'体验初始数据读取失败，请刷新重试',503);const value=await response.json();return value.state||value})().catch(error=>{seedPromise=null;throw error});
 function open(){return opening??=new Promise((resolve,reject)=>{const request=indexedDB.open('scenic-visitor-v1:'+new URL('.',document.baseURI).pathname,1);request.onupgradeneeded=()=>request.result.createObjectStore('workspace');request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();opening=null};resolve(request.result)};request.onerror=()=>{opening=null;reject(Error('无法打开浏览器存储，请允许本站保存数据'))}})}
 async function transact(mutator){
  const [db,initial]=await Promise.all([open(),seed()]);
  return new Promise((resolve,reject)=>{
   const tx=db.transaction('workspace','readwrite'),store=tx.objectStore('workspace');let result,error;
   const request=store.get('document');request.onsuccess=()=>{try{const doc=request.result||{state:clone(initial),requests:{}};doc.state.items.forEach(decorate);result=mutator(doc);store.put(doc,'document')}catch(e){error=e;tx.abort()}};
   tx.oncomplete=()=>resolve(clone(result));tx.onabort=()=>reject(error||Object.assign(Error('浏览器保存失败，请检查存储空间后重试'),{status:503}));tx.onerror=()=>{};
  });
 }
 const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
 window.BrowserStore={
  async read(){return transact(doc=>doc.state)},
  async act(payload,role='operator'){
   require(object(payload),'请求必须为对象');const p=clone(payload),kind=text(p,'type'),request=text(p,'requestId');
   require(['operator','reviewer','viewer'].includes(role),'未知本地角色',403);require(role!=='viewer','只读角色不能修改记录',403);require((kind==='item.review'&&role==='reviewer')||(kind!=='item.review'&&role==='operator'),'当前角色无权执行此操作',403);
   const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical([role,p])))),fingerprint=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
   if(kind==='item.feedback')p.attachments=materials(p.attachments||[]);
   return transact(doc=>{const previous=doc.requests[request];if(previous){require(previous.fingerprint===fingerprint,'请求标识已用于不同操作',409);return {state:doc.state,result:previous.result}}const result=apply(doc.state,p,kind,role);doc.state.items.forEach(decorate);doc.requests[request]={fingerprint,result:clone(result)};return {state:doc.state,result}});
  }
 };
})();
