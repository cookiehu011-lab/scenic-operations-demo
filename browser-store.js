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
 const aliases={road:['道路','交通','入口','入口上游','拥堵'],cable:['索道','花台','候乘'],rail:['护栏','百岁宫','步道'],clean:['垃圾','游客中心','清运','保洁']};
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
    item.owner=dispositionOwner(item);detail=text(p,'text');require(typeof (p.evidence??'')==='string','补充来源说明格式无效');evidence=(p.evidence||'').trim()||(item.owner?'关联责任班组：'+item.owner+'；登记角色：业务人员':'登记角色：业务人员；未附其他来源说明');require([undefined,null,'ongoing','improved','resolved'].includes(p.condition),'请选择有效的当前情况');
    item.feedback.push({text:detail,evidence,time:now(),source:'本地人工登记',condition:p.condition,owner:item.owner,attachments:p.attachments||[]});if(p.condition)detail='当前情况：'+({ongoing:'仍需处置',improved:'情况改善',resolved:'已恢复'})[p.condition]+'；'+detail;item.phase='review';title='登记处置反馈';
   }else if(op==='review'){
    require(typeof p.approve==='boolean','请选择复核结果');require(item.feedback.length,'缺少反馈不能复核',409);detail=text(p,'reason');item.phase=p.approve?'closed':'feedback';title=p.approve?'复核通过':'退回补充';item.resolution=p.approve?'正常完成':'';if(!p.approve)item.owner=dispositionOwner(item);
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
 function dispositionOwner(item){
  return item.assignment?.owner||item.feedback?.at(-1)?.owner||((item.businessType||item.id)==='clean'&&item.processRecords?.find(r=>/保洁班组/.test(r.actor||''))?.owner)||item.owner||'';
 }
 function currentEvidence(item){
  const verified=item.verificationFeedback?.filter(f=>item.verificationAssignment&&f.assignmentVersion===item.verificationAssignment.version).at(-1),feedback=item.feedback?.at(-1);
  const ended=item.records.filter(r=>['复核通过','误报终止','重复合并'].includes(r[1])).at(-1);
  const returned=item.records.filter(r=>r[1]==='退回补充').at(-1);
  if(item.phase==='closed')return (item.resolution||'已结束')+'；'+(ended?.[2]||'未单独登记结束依据')+(item.duplicateOf?'；关联主事项：'+item.duplicateOf+'，合并不代表现场问题已解决':'');
  if(item.phase==='review'||item.phase==='feedback')return (feedback?'最新处置反馈：'+feedback.text+(feedback.evidence&&!/^(示例人工反馈|未附其他来源说明)$/.test(feedback.evidence)?'；依据：'+feedback.evidence:'')+(feedback.attachments?.length?'；关联图片：'+feedback.attachments.map(f=>f.name).join('、'):''):'尚未收到处置反馈')+(item.phase==='review'?'；处置效果待独立复核':returned?'；退回要求：'+returned[2]:'；等待最终处置结果');
  if(item.phase==='verify_feedback')return verified?'本轮核查反馈：'+verified.text+'；依据：'+verified.evidence:'本轮核查安排：'+(item.verificationAssignment?.owner||'未指定')+'；等待现场反馈，尚无本轮核查结论';
  if(item.phase==='decision'||item.phase==='assign')return verified?'本轮核查反馈：'+verified.text+'；依据：'+verified.evidence:'当前记录未单独保存本轮结构化核查材料，请结合处理记录核对';
  return (item.originalSnapshot?.evidence||item.evidence||item.originalSnapshot?.summary||item.summary)+(item.decision?.approved===false?'；退回核查要求：'+item.decision.note:'')+'；现场事实待核查';
 }
 function nextAction(item){
  const focus={road:'入口及弯道通行情况、措施范围与仍有影响',cable:'上站队尾位置、入口及疏散通道',rail:'对应护栏处理部位、检修说明、残余风险与通行限制',clean:'桶体满溢、周边地面残留与桶点使用情况'}[item.businessType||item.id];
  if(item.phase==='closed')return '本事项已结束，无待办。'+currentEvidence(item)+'。如发现新的异常，应另行登记并核查。';
  const returned=item.records.filter(r=>r[1]==='退回补充').at(-1);
  const action={verify:'安排责任组到场核实'+focus+'，当前不能直接认定原因或完成处置。',verify_feedback:'跟进本轮核查人员提交现场事实、依据与结论；安排不代表已核实。',decision:'核对本轮核查材料，在景区职责内确认处置方案或退回核查。',assign:'登记处置责任组与具体要求，覆盖'+focus+'；登记不代表已通知或执行。',feedback:returned?'先按退回要求补充：'+returned[2]+'。提交新反馈后再次复核。':'跟进处置班组反馈'+focus+'，记录完成范围和仍有影响。',review:'独立核对'+focus+'，对照最新反馈及关联材料，再决定通过或退回；不能仅凭完成说明认定复核通过。'}[item.phase];
  return '当前阶段：'+PHASES[item.phase]+'。'+action+'\n已知依据：'+currentEvidence(item);
 }
 function timeline(item){
  const entries=item.records.map((r,index)=>({time:r[0],title:r[1],text:r[2],materials:item.recordMeta?.[index]?.materials||[],attachments:item.recordMeta?.[index]?.attachments||[]}));
  for(const entry of item.processRecords||[]){let index=entries.findIndex(row=>row.time==='当前'||row.time.includes('T')||row.time>entry.time);if(index<0)index=entries.length;entries.splice(index,0,entry)}
  return item.title+' · '+PHASES[item.phase]+'\n'+entries.map(r=>r.time+' '+r.title+'：'+r.text+((r.materials?.length||r.attachments?.length)?'\n关联材料：'+[...(r.materials||[]),...(r.attachments||[])].map(m=>m.name).join('、'):'')).join('\n');
 }
 function message(s,p){
  const session=find(s.sessions,p.id);version(session,p);const question=text(p,'text'),context=session.context;
  const named=s.items.filter(item=>question.includes(item.title)),explicit=areaIds(question),contextItem=context.itemId?s.items.find(x=>x.id===context.itemId):null;
  const words='生成 整理 报告 简报 今日 今天 九华山 全园 全部 本地 示例 当前 现在 事项 事件 状态 进度 进展 责任 负责 谁 人员 下一步 接下来 怎么处理 该做什么 依据 证据 来源 记录 建议 分析 原因 为何 为什么 统计 数量 多少 几项 几起 待处理 待核查 待安排核查 等待核查反馈 待人工决策 待安排处置 等待处置反馈 处理中 待复核 已结束 已归档 未结束 历史事件 历史事项 概况 清单 列表 分布 汇总 总结 查看 查询 告诉 给我 请 我 我们 这个 这些 这项 一下 什么 怎么 哪些 有 的 吗 呢 和 与 及 是 在 情况 处理 办理 现场 复核 核查 核实 反馈 材料 结果 要 看 重点 这起 到 哪一步 了'.split(' ').concat(Object.values(aliases).flat(),s.items.map(x=>x.title));
  let remainder=question;for(const word of words.sort((a,b)=>b.length-a.length))remainder=remainder.split(word).join('');remainder=remainder.replace(/[\s，。！？、：:,.!?；;（）()]+/g,'');
  const timeRequested=/昨天|昨日|明天|本周|上周|本月|去年|\d{2,4}[-年月日/:]/.test(question)||![undefined,null,'','today','今天','今日',now().slice(0,10)].includes(context.date);
  const conflict=!!(contextItem&&((named.length&&!named.some(x=>x.id===contextItem.id))||(!named.length&&explicit.length&&(explicit.length!==1||explicit[0]!==(contextItem.businessType||contextItem.id)))));
  const unknownArea=![undefined,null,'','九华山','全园','全部','全部可见'].includes(context.area)&&!areaIds(context.area).length;
  const unsupported=!!(remainder||timeRequested||conflict||unknownArea);
  const closed=/已结束|已归档|历史事件|历史事项/.test(question),filter=closed?x=>x.phase==='closed':/待复核/.test(question)?x=>x.phase==='review':/等待核查反馈/.test(question)?x=>x.phase==='verify_feedback':/待安排核查/.test(question)?x=>x.phase==='verify':/待核查/.test(question)?x=>x.stage===1:/待人工决策/.test(question)?x=>x.phase==='decision':/待安排处置/.test(question)?x=>x.phase==='assign':/等待处置反馈/.test(question)?x=>x.phase==='feedback':/处理中/.test(question)?x=>x.stage===2:/未结束|待处理/.test(question)?x=>x.phase!=='closed':null;
  let rows;
  if(contextItem)rows=[contextItem];else if(named.length)rows=named;else if(explicit.length)rows=s.items.filter(x=>explicit.includes(x.businessType||x.id)&&(closed||!x.sample));else if(filter||/全园|全部/.test(question))rows=s.items;else if(areaIds(context.area).length)rows=s.items.filter(x=>areaIds(context.area).includes(x.businessType||x.id)&&!x.sample);else if(Array.isArray(session.queryItemIds))rows=session.queryItemIds.map(key=>find(s.items,key));else rows=s.items;
  if(filter)rows=rows.filter(filter);
  const intent=/处理记录|办理记录/.test(question)?'records':/依据|证据|来源|材料/.test(question)?'evidence':/建议|分析|原因|为何|为什么|怎么处理|下一步|接下来|该做什么|复核.*(?:看|重点)/.test(question)?'advice':/清单|列表|哪些/.test(question)?'list':/统计|数量|多少|几项|几起|分布|概况|汇总|总结|报告|简报/.test(question)?'statistics':'progress';
  let sources=rows.map(x=>pick(x,['id','title','version','phase','location'])),answer;
  if(unsupported){answer=conflict?'当前会话绑定其他事项，请新建会话或移除当前事项范围后查询；本次未切换对象。':'当前未找到该问题对应的数据。可查询已有事项的进度、处理记录、复核依据、下一步或状态清单；例如“待复核事项有哪些”。本次未更新查询范围。';sources=[]}
  else if(!rows.length)answer='当前查询范围没有符合条件的事项，未扩大到其他事项。';
  else if(intent==='records')answer=rows.map(timeline).join('\n\n');
  else if(intent==='evidence')answer=rows.map(x=>x.title+'：'+currentEvidence(x)+'。'+x.scope).join('\n\n');
  else if(intent==='advice')answer=rows.map(x=>x.title+'\n'+nextAction(x)).join('\n\n');
  else if(intent==='statistics')answer=`当前查询范围共 ${rows.length} 项：待核查 ${rows.filter(x=>x.stage===1).length} 项、处理中 ${rows.filter(x=>x.stage===2).length} 项、待复核 ${rows.filter(x=>x.stage===3).length} 项、已结束 ${rows.filter(x=>x.stage===4).length} 项。仅反映体验台账。`;
  else answer=rows.map(x=>x.title+'：'+PHASES[x.phase]+(x.phase==='closed'?' · '+(x.resolution||'已结束'):'。责任：'+(x.owner||'尚未指定'))+'。'+(intent==='progress'?x.waitingFor:'')).join('\n');
  if(!unsupported)session.queryItemIds=rows.map(x=>x.id);session.lastQueryStatus=unsupported?'unsupported':'success';
  if(!unsupported&&/今日|今天/.test(question))answer+='\n今日仅指当前体验台账，不是景区真实当日运营统计。';
  const result={id:id(),question,answer,sources,unsupported,status:session.lastQueryStatus,kind:intent,time:now(),metrics:unsupported||intent!=='statistics'?[]:['待核查','处理中','待复核','已结束'].map((label,index)=>({label,value:rows.filter(x=>x.stage===index+1).length})),itemSnapshots:unsupported?[]:clone(rows),scopeLabel:/今日|今天/.test(question)?'今日的体验台账（非真实当日运营数据）':'体验事项台账'};
  session.messages.push({id:id(),role:'user',text:question,time:now()},{...result,role:'assistant',text:answer});session.version++;if(session.messages.length===2)session.title=question.slice(0,24);return {message:result,session,sessionId:session.id};
 }
 function report(s,p){
  let context={},session=null,source=null;require(!p.messageId||p.sessionId,'引用回答需要所属会话');
  if(p.sessionId){session=find(s.sessions,p.sessionId);context=session.context;if(p.messageId){source=find(session.messages,p.messageId);require(source.role==='assistant'&&!source.unsupported&&source.itemSnapshots?.length,'该回答没有可用的已保存查询快照，请重新查询',409)}else require(session.lastQueryStatus!=='unsupported','最近问题的范围或能力不受支持，请先明确范围并成功查询',409)}
  const dates=[undefined,null,'','today','今天','今日',now().slice(0,10)];require(dates.includes(p.date)&&dates.includes(context.date),'缺少该日期的可核验数据，不能生成报告',409);require(!p.area||['九华山','全园','全部'].includes(p.area),'报告范围未识别',409);
  const area=context.area||'';require(['','九华山','全园','全部','全部可见'].includes(area)||areaIds(area).length,'报告范围未识别',409);
  const itemId=p.itemId||context.itemId,selected=itemId?[itemId]:Array.isArray(session?.queryItemIds)?session.queryItemIds:areaIds(area).length?areaIds(area):s.items.map(x=>x.id),rows=source?source.itemSnapshots:selected.map(key=>find(s.items,key));
  require(rows.length,'当前查询范围没有事项，不能生成报告',409);
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
   const request=store.get('document');request.onsuccess=()=>{try{const doc=request.result||{state:clone(initial),requests:{}};doc.state.items.forEach(decorate);if(!request.result&&doc.state.meta?.refreshSeedAnswers){for(const session of doc.state.sessions){const question=session.messages.find(m=>m.role==='user')?.text;if(question){session.messages=[];session.version=1;message(doc.state,{id:session.id,version:1,text:question})}}}result=mutator(doc);store.put(doc,'document')}catch(e){error=e;tx.abort()}};
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
