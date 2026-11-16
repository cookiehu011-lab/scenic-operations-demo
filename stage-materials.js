/* Read-only stage materials. Preview records never enter the product store. */
(function(){
 'use strict';
 const map={verify:'待安排核查',verify_feedback:'等待核查反馈',decision:'待人工决策',assign:'待安排处置',feedback:'等待处置反馈',review:'待复核',closed:'已结束'},phases=Object.keys(map);
 const titles={verify:'预警与待核查要点',verify_feedback:'核查任务与现场反馈',decision:'已核实情况与处置方案',assign:'处置任务与要求',feedback:'处置进展与待反馈',review:'处置结果与复核依据',closed:'结束结论与依据'};
 const business={
  road:{focus:['入口相关路段的通行情况','措施是否符合确认方案及景区职责','未覆盖路段与仍有影响'],report:'入口上游监测点有排队情况，原因和影响范围需现场核实。',verify:'现场人员说明：排队延伸至入口弯道；仅核查该监测点附近，具体成因尚未查明。',task:'在景区职责内安排入口引导，记录弯道及入口通行情况；不涉及公共道路管制。',feedback:'现场人员说明：已实施入口引导，入口仍有间歇排队；未获得其他路段情况。',check:'核对记录说明：本次入口引导任务已检查，结束范围限该点位；不代表全园交通正常。'},
  cable:{focus:['上站候乘区最新队尾位置','入口及疏散通道通行情况','仍需引导的范围'],report:'花台索道上站候乘区队尾接近入口，需核实通道是否受影响。',verify:'上站人员说明：队尾接近候乘区入口，需保持入口和疏散通道；未核查下站。',task:'安排上站班组分段放行并引导队列，反馈队尾位置和通道情况。',feedback:'上站班组说明：已开展分段放行，队尾位置有所回退；仍需独立核对入口及疏散通道。',check:'现场核对记录说明：已核对上站候乘区队尾和通道，本事项结束；不涉及下站或索道设备运行。'},
  rail:{focus:['处理部位是否对应异常护栏','检修记录与残余风险','通行限制是否明确'],report:'百岁宫步道转弯段护栏有松动迹象，位置和通行影响待核查。',verify:'巡查人员说明：转弯段单段护栏有松动，现场已提示绕行；损坏程度仍需设施人员判断。',task:'安排设施人员检查并处理对应护栏，记录处理部位、残余风险及通行限制。',feedback:'设施人员说明：已处理上报的松动部位，提交文字检修说明；通行条件待有权人员核对。',check:'核对记录说明：本次处理范围与检修说明已核对，使用限制按现场记录保留；工单结束不等于结构安全验收或自动开放。'},
  clean:{focus:['桶体满溢是否消除','周边地面是否仍有残留','桶点是否可正常使用'],report:'游客中心东侧休息区垃圾桶满溢，桶体和周边散落范围待核实。',verify:'巡查人员说明：该桶点已满溢，桶旁有散落垃圾；核查仅覆盖东侧休息区该点位。',task:'安排处理该桶点桶内垃圾及周边散落，反馈清运内容、残留和使用情况。',feedback:'保洁人员说明：已清运桶内垃圾并清扫周边，提交文字完成说明；尚待独立核对桶体、地面和使用情况。',check:'复核记录说明：已核对该桶点桶体、周边地面和使用情况，本次清运事项结束；结论限该点位。'}
 };
 const initialRecordMaterials={
  road:{phase:'verify',names:['入口上游点位范围说明','排队车辆观测表','现场核查范围与待查问题']},
  rail:{phase:'verify',names:['异常部位位置说明','护栏核查材料清单','连接部位与通行检查要点']},
  cable:{phase:'feedback',names:['候乘入口处置范围','分段放行前后人数记录','待反馈的现场范围']},
  clean:{phase:'review',names:['保洁完成反馈摘要','桶点复核检查表']}
 };
 const material=(name,text,source,time,kind)=>({name,text:String(text||'未登记具体内容'),source:source||'本地记录',time:time||'未单独记录时间',kind});
 function applicable(item){return phases.filter(p=>p!=='decision'||(item.businessType||item.id)==='road')}
 function get(item,{preview=false,phase=item.phase}={}){
  if(!applicable(item).includes(phase))throw new Error('该事项没有此办理阶段');
  const b=business[item.businessType||item.id];if(!b)throw new Error('未配置该业务的阶段材料');
  const materials=[],history=[],records=item.records||[],snapshot=item.originalSnapshot||{};
  const add=(...args)=>{const entry=material(...args);if(entry.kind==='feedback'&&!preview&&feedback){entry.attachments=feedback.attachments||[];if(feedback.condition)entry.text='当前情况：'+({ongoing:'仍需处置',improved:'情况改善',resolved:'已恢复'}[feedback.condition]||feedback.condition)+'；'+entry.text}materials.push(entry)};
  const arrangement=item.verificationAssignment;
  const verified=(item.verificationFeedback||[]).filter(f=>arrangement&&f.assignmentVersion===arrangement.version);
  const latestVerified=verified.at(-1),feedback=(item.feedback||[]).at(-1);
  const record=(title)=>records.filter(r=>r[1]===title).at(-1);
  const rejected=record('退回补充'),decision=item.decision;
  let summary='';
  if(preview){
   const source='现场人员 · 示例上传',time='体验材料';
   if(phase==='verify'){summary='已收到异常上报，等待安排现场核查。';add('异常上报说明.txt',b.report,'上报人员 · 示例上传',time,'report')}
   if(phase==='verify_feedback'){summary='已收到核查进展，最终核查结论待登记。';add('核查任务说明.txt','请到场核实：'+b.report,'值班人员 · 示例上传',time,'verification-assignment');add('现场核查进展.txt',b.verify+' 最终核查结论待登记。','巡查人员 · 示例上传',time,'verification')}
   if(['decision','assign'].includes(phase)){summary=phase==='decision'?'核查材料已提交，等待确认处置方案。':'问题已核实，等待安排处置责任。';add('现场核查说明.txt',b.verify,'巡查人员 · 示例上传',time,'verification');if((item.businessType||item.id)==='road')add(phase==='decision'?'处置方案草稿.txt':'已确认处置方案.txt',b.task,'值班人员 · 示例上传',time,'decision')}
   if(phase==='feedback'){summary='已收到处置进展，最终结果待登记。';add('处置任务说明.txt',b.task,'值班人员 · 示例上传',time,'assignment');add('现场处置进展.txt','现场已按任务开展处理，正在核对完成范围。'+b.task+' 最终结果待登记。',source,time,'feedback')}
   if(phase==='review'){summary='已收到完成说明，处置效果待复核。';add('处置任务说明.txt',b.task,'值班人员 · 示例上传',time,'assignment');add('处置完成说明.txt',b.feedback,source,time,'feedback')}
   if(phase==='closed'){summary='本事项已复核结束，结论限已记录范围。';add('处置完成说明.txt',b.feedback,source,time,'feedback');add('结果复核说明.txt',b.check,'复核人员 · 示例上传',time,'review')}
  }else{
   if(phase==='verify'){
    summary=decision?.approved===false?'方案已退回，需按退回说明重新安排核查。':snapshot.summary||item.summary||b.report;
    add('原始上报与范围',snapshot.summary||item.summary,item.source,item.time?'原始记录时间：'+item.time:null,'report');
    if(decision?.approved===false)add('本次退回核查说明',decision.note,'人工决定',decision.time?'登记时间：'+decision.time:null,'return');
   }
   if(phase==='verify_feedback'){
    summary=latestVerified?'当前核查轮次已有材料，请核对登记状态。':arrangement?'核查安排已登记，等待本轮现场反馈。':'当前为等待核查反馈，原记录未单独登记核查安排。';
    if(arrangement)add('核查安排',arrangement.owner+'；'+(arrangement.note||'未附核查说明')+'；仅本地登记，未发送外部通知','核查安排',arrangement.time?'登记时间：'+arrangement.time:null,'verification-assignment');
   }
   if(['verify_feedback','decision','assign'].includes(phase)&&latestVerified)add('本轮核查反馈',latestVerified.text+'；依据：'+latestVerified.evidence+'；结论：'+({valid:'有效',false:'误报',duplicate:'重复'}[latestVerified.outcome]||latestVerified.outcome),latestVerified.source,latestVerified.time?'登记时间：'+latestVerified.time:null,'verification');
   if(phase==='decision')summary='等待人工确认处置方案，核查材料不等于处置授权。';
   if(phase==='assign'){summary='等待登记处置安排；当前尚不能认定任务已送达或执行。';if(decision?.approved)add('已确认方案',decision.note,'人工决定',decision.time?'登记时间：'+decision.time:null,'decision')}
   if(['feedback','review'].includes(phase)){
    summary=phase==='review'?(feedback?'已有处置反馈，效果尚待复核。':'当前为待复核，但未找到结构化处置反馈。'):(rejected?'复核已退回，等待补充处置反馈。':'等待处置反馈；安排不代表现场已完成。');
    if(item.assignment)add('本地处置安排',item.assignment.owner+'；'+(item.assignment.note||'未附处置说明')+'；未发送外部通知','处置安排',item.assignment.time?'登记时间：'+item.assignment.time:null,'assignment');
    if(feedback)add(phase==='review'?'最新处置反馈（尚待复核）':'已有处置反馈（不能视为本轮补充）',feedback.text+'；依据：'+feedback.evidence,feedback.source||'示例人工反馈',feedback.source&&feedback.time?'登记时间：'+feedback.time:'原记录未明确现场反馈时间','feedback');
    if(rejected)add('已有退回补充记录',rejected[2],'本地处理记录',rejected[0],'return');
   }
   if(phase==='closed'){
    const resolution=item.resolution||'未单独登记结束原因';summary='结束原因：'+resolution+'。'+(item.duplicateOf?'关联主事项：'+item.duplicateOf+'；合并不代表问题已解决。':'');
    const ended=record(resolution==='正常完成'?'复核通过':resolution);
    if(ended){const documents=item.recordMeta?.[records.indexOf(ended)]?.materials;if(documents?.length){for(const document of documents)add(document.name,document.text,document.source,ended[0],'closure')}else add('结束记录',ended[2],'本地处理记录',ended[0],'closure')}
    if(resolution==='正常完成'&&feedback)add('结束前处置反馈',feedback.text+'；依据：'+feedback.evidence,feedback.source||'原有反馈记录',feedback.source&&feedback.time?'登记时间：'+feedback.time:null,'feedback');
    if(resolution!=='正常完成'&&latestVerified)add('结束依据：核查反馈',latestVerified.text+'；依据：'+latestVerified.evidence,latestVerified.source,latestVerified.time?'登记时间：'+latestVerified.time:null,'verification');
   }
  }
  const initialMaterials=initialRecordMaterials[item.id];
  if(!preview&&item.version===1&&initialMaterials?.phase===phase){
   for(const row of item.processRecords||[])for(const document of row.materials||[]){
    if(initialMaterials.names.includes(document.name))add(document.name,document.text,document.source,row.time,'stage-record');
   }
  }
  if(preview){
   const index=applicable(item).indexOf(phase);
   history.push({title:'原始上报说明',text:b.report});
   if(index>applicable(item).indexOf('verify_feedback'))history.push({title:'现场核查说明',text:b.verify});
   if(index>applicable(item).indexOf('assign'))history.push({title:'处置任务说明',text:b.task});
   if(phase==='closed')history.push({title:'处置完成说明',text:b.feedback});
  }else{
  history.push({title:'原始情况（历史背景）',text:snapshot.summary||item.summary||'未登记原始说明'});
  if(snapshot.advice||item.advice)history.push({title:'初始建议（历史，非当前分析）',text:snapshot.advice||item.advice});
  for(const row of records)history.push({title:row[0]+' · '+row[1],text:row[2]});
  for(const f of item.verificationFeedback||[])if(!verified.includes(f))history.push({title:'历史核查反馈（非本轮）',text:f.text+'；依据：'+f.evidence});
  }
  const focus=phase==='verify'||phase==='verify_feedback'?['核实具体点位及覆盖范围',b.focus[0],'记录已知事实与仍未查明内容']:phase==='assign'?['明确处置内容及适用范围','登记责任组，不冒充已通知或接单',b.focus[0]]:b.focus;
  return {phase,preview,title:titles[phase],summary,focus:[...focus],materials,history,applicablePhases:applicable(item),backgroundOnly:true,notice:preview?'只读演示：示例用户说明与文本材料，不是实际上传或现场事实。':'仅展示已有本地材料；原场景图为历史示意，不作为结果依据。',resolution:preview&&phase==='closed'?'正常完成':item.resolution||'',duplicateOf:preview?null:item.duplicateOf||null};
 }
 function previewItem(item,phase){
  if(!applicable(item).includes(phase))throw new Error('该事项没有此办理阶段');
  const b=business[item.businessType||item.id],projection=JSON.parse(JSON.stringify(item)),index=applicable(item).indexOf(phase);
  for(const key of ['assignment','verificationAssignment','decision','duplicateOf','recordMeta','processRecords'])delete projection[key];
  projection.verificationFeedback=[];projection.feedback=[];projection.records=[['体验材料','收到异常上报',b.report]];
  projection.originalSnapshot={summary:b.report,advice:'按当前阶段核对已上传材料',records:[...projection.records]};
  projection.progress=['已上报'];projection.owner='';projection.resolution='';
  if(index>=1){projection.verificationAssignment={owner:'现场核查组',note:b.report,version:1,externalSent:false};projection.records.push(['体验材料','登记核查安排',b.report]);projection.progress.push('已安排核查')}
  if(index>1){projection.verificationFeedback=[{text:b.verify,evidence:'现场核查说明.txt',outcome:'valid',assignmentVersion:1,source:'巡查人员 · 示例上传'}];projection.records.push(['体验材料','人工核查有效',b.verify]);projection.progress.push('已核查')}
  if((item.businessType||item.id)==='road'&&index>applicable(item).indexOf('decision')){projection.decision={approved:true,note:b.task};projection.records.push(['体验材料','人工确认方案',b.task])}
  if(index>applicable(item).indexOf('assign')){projection.assignment={owner:'现场处置组',note:b.task,externalSent:false};projection.owner='现场处置组';projection.records.push(['体验材料','登记本地安排',b.task]);projection.progress.push('已安排处置')}
  if(['review','closed'].includes(phase)){projection.feedback=[{text:b.feedback,evidence:'处置完成说明.txt',source:'现场人员 · 示例上传'}];projection.records.push(['体验材料','登记处置反馈',b.feedback]);projection.progress.push('已收到反馈')}
  if(phase==='closed'){projection.resolution='正常完成';projection.records.push(['体验材料','复核通过',b.check]);projection.progress.push('已结束')}
  if(phase==='verify_feedback')projection.owner='现场核查组';
  projection.waitingFor={verify:'安排现场核查',verify_feedback:'登记最终核查结论',decision:'确认处置方案',assign:'安排处置责任',feedback:'登记最终处置结果',review:'核对处置效果',closed:'无待办'}[phase];
  const view=get(item,{preview:true,phase});projection.summary=view.summary;projection.evidence=view.materials.map(m=>m.text).join('；');projection.advice='按当前阶段核对已上传材料';projection.reason='阶段办理提示';projection.adviceHistorical=phase!=='verify';projection.gaps=[...view.focus];projection.action=titles[phase];projection.flag=map[phase];projection.task=projection.waitingFor;projection.next=projection.waitingFor;
  return {...projection,phase,status:map[phase],stage:{verify:1,verify_feedback:1,decision:2,assign:2,feedback:2,review:3,closed:4}[phase],completed:phase==='closed',archived:phase==='closed',preview:true,readOnly:true};
 }

 window.StageMaterials={get,phases,map,previewItem};
})();
