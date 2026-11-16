// Local product service. External dispatch, identity and model integrations remain unconnected.
window.Product={
 role:localStorage.getItem('product-role')||'operator',
 async read(){if(window.BrowserStore)return BrowserStore.read();let r;try{r=await fetch('/api/product/state',{headers:{'X-Role':this.role}})}catch{throw Error('无法连接本地服务，请检查服务后重试')}const b=await r.json();if(!r.ok)throw Error(b.error||'读取失败');return b.state||b},
 async requestStore(mode,id,payload){
  return new Promise((resolve,reject)=>{
   const open=indexedDB.open('scenic-pending-materials',1);
   open.onupgradeneeded=()=>open.result.createObjectStore('requests');open.onerror=()=>reject(Error('无法保存本次图片请求，请检查浏览器存储空间'));
   open.onsuccess=()=>{const db=open.result,tx=db.transaction('requests',mode==='get'?'readonly':'readwrite'),store=tx.objectStore('requests');let value;
    const request=mode==='get'?store.get(id):mode==='put'?store.put(payload,id):store.delete(id);request.onsuccess=()=>{value=request.result};
    tx.oncomplete=()=>{db.close();resolve(value)};tx.onerror=()=>{db.close();reject(Error('图片请求缓存读写失败，请重试'))};
   };
  });
 },
 async requestPayload(pending){const payload=pending.attachmentsStored?await this.requestStore('get',pending.requestId):pending.payload;if(!payload)throw Error('待核查请求的图片缓存缺失，请保留当前记录并重新核对');return payload},
 async act(payload){
 const existing=JSON.parse(sessionStorage.getItem('product-pending-request')||'null');
 if(existing&&JSON.stringify(await this.requestPayload(existing))!==JSON.stringify(payload)){this.pendingNotice();throw Error('上次提交结果待核实，请先核查，避免重复操作')}
 const pending=existing||{payload,role:this.role,requestId:crypto.randomUUID()};
 if(!existing&&payload.attachments?.length){await this.requestStore('put',pending.requestId,payload);pending.attachmentsStored=true;pending.payload={...payload,attachments:payload.attachments.map(({name,type})=>({name,type}))}}
 sessionStorage.setItem('product-pending-request',JSON.stringify(pending));
 try{let r={ok:true},b;if(window.BrowserStore){try{b=await BrowserStore.act({...payload,requestId:pending.requestId},pending.role)}catch(error){r={ok:false,status:error.status||400};b={error:error.message}}}else{r=await fetch('/api/product/action',{method:'POST',headers:{'Content-Type':'application/json','X-Role':pending.role},body:JSON.stringify({...payload,requestId:pending.requestId}),signal:AbortSignal.timeout(12000)});b=await r.json();}sessionStorage.removeItem('product-pending-request');if(pending.attachmentsStored)await this.requestStore('delete',pending.requestId).catch(()=>{});if(!r.ok){const error=Error(b.error||'保存失败');error.status=r.status;throw error;}return b}
 catch(e){if(sessionStorage.getItem('product-pending-request')){e.uncertain=true;this.pendingNotice()}throw e}
 },
 pendingNotice(){this.notify('上次提交结果待核实。请核查原请求，勿重复创建。',true);const b=document.createElement('button');b.textContent='核查上次提交';b.style.marginLeft='12px';b.onclick=async()=>{b.disabled=true;try{const pending=JSON.parse(sessionStorage.getItem('product-pending-request'));if(pending){const r=await this.act(await this.requestPayload(pending));if(pending.payload.type==='session.create'){const id=r.result.sessionId,itemId=pending.payload.context?.itemId;if(itemId){const key='product-draft-'+itemId,draft=JSON.parse(localStorage.getItem(key)||'{}');draft.sessionId=id;localStorage.setItem(key,JSON.stringify(draft))}sessionStorage.setItem('product-session',id)}if(pending.payload.type==='report.generate')location.href='assistant.html?report='+r.result.reportId;else location.reload()}}catch(e){this.notify(e.message,true);if(e.uncertain)this.pendingNotice()}};document.getElementById('product-notice').append(b)},
 init(){const host=document.querySelector('.header-tools');if(!host)return;const env=host.querySelector('.environment');if(env){env.textContent='独立体验版';env.title='样例台账 · 仅保存在当前浏览器，清除网站数据后会丢失 · 规则助手 · 身份、模型与外部系统未接入'}const label=document.createElement('label');label.className='product-role';label.textContent='验证角色 ';const select=document.createElement('select');select.setAttribute('aria-label','本地验证角色');for(const [v,t]of [['operator','业务人员'],['reviewer','复核人员'],['viewer','只读人员']])select.add(new Option(t,v));select.value=this.role;select.onchange=()=>{localStorage.setItem('product-role',select.value);location.reload()};label.append(select);host.append(label)},
 notify(message,error=false){let box=document.getElementById('product-notice');if(!box){box=document.createElement('div');box.id='product-notice';box.setAttribute('role','status');document.body.append(box)}box.textContent=message;box.dataset.error=String(error);box.hidden=false;clearTimeout(this.noticeTimer);if(!error)this.noticeTimer=setTimeout(()=>box.hidden=true,5000)}
};
Product.init();if(sessionStorage.getItem('product-pending-request'))Product.pendingNotice();
