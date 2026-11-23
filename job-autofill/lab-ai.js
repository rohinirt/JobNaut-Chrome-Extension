/* AI provider shim from Resume Optimiser (Mistral, Cerebras, OpenRouter, Gemini). Keys live in this extension's localStorage. */
(function(){
 var GKEY='ro_gemini_key',GMODEL='ro_gemini_model',PROV='ro_provider',OKEY='ro_or_key',OMODEL='ro_or_model',CKEY='ro_cb_key',CMODEL='ro_cb_model';
 /* Set this to your Cloudflare Worker URL (no trailing slash) to keep the AI keys on a server instead of in each visitor's browser. */
 var PROXY='https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev';
 var DEFAULT_OR='openrouter/free',FALLBACK_OR=['thinkingmachines/inkling:free','nvidia/nemotron-3-super-120b-a12b:free','openrouter/free'];
 var CFG0=(typeof window!=='undefined'&&window.JN_CONFIG)||{},cfgKey=function(){var k=String(CFG0.geminiKey||'').trim();return k&&!/^PASTE/i.test(k)?k:''};
 var get=function(k){if(k==='ro_provider')return'gemini';if(k==='ro_gemini_key'&&cfgKey())return cfgKey();if(k==='ro_gemini_model'&&CFG0.geminiModel)return CFG0.geminiModel;try{return localStorage.getItem(k)||''}catch(e){return''}},set=function(k,v){try{localStorage.setItem(k,v)}catch(e){}};
 var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
 var useProxy=!!window.__proxyOverride||!/YOUR-WORKER/.test(PROXY);
 var prov=function(){var p=get(PROV);return p==='gemini'||p==='cerebras'||p==='openrouter'||p==='mistral'?p:'mistral'};
 function parse(t){t=String(t||'').replace(/^\s*```(?:json)?/i,'').replace(/```\s*$/,'').trim();try{return JSON.parse(t)}catch(e){var a=t.indexOf('{'),b=t.lastIndexOf('}');if(a>=0&&b>a)return JSON.parse(t.slice(a,b+1));throw Error('The AI reply was not valid JSON. Please try again.')}}
 /* ---------- Gemini ---------- */
 var GBASE=function(){return useProxy?(window.__proxyOverride||PROXY)+'/v1beta/':'https://generativelanguage.googleapis.com/v1beta/'};
 var gh=function(h){var k=get(GKEY);if(!useProxy&&k)h['x-goog-api-key']=k;return h};
 async function gdiscover(){var res;try{if(!useProxy&&!get(GKEY))throw Error('Add your Gemini API key in Jobnaut options (Prefill your Info > Resume & files > AI).');res=await fetch(GBASE()+'models?pageSize=200',{headers:gh({})})}catch(e){if(/Add your/.test(e.message))throw e;throw Error('Could not reach the server.')}if(!res.ok)throw Error('Could not list models ('+res.status+')'+(useProxy?'.':'. Check your API key.'));
  var d=await res.json(),ver=function(n){var m=/gemini-(\d+(?:\.\d+)?)/.exec(n);return m?parseFloat(m[1]):0};
  return(d.models||[]).filter(function(m){var n=m.name||'';return(m.supportedGenerationMethods||[]).indexOf('generateContent')>=0&&/flash/.test(n)&&!/image|tts|live|audio|embed|robotics|computer|native/.test(n)})
   .map(function(m){return{id:m.name.replace(/^models\//,''),label:m.name.replace(/^models\//,'')}})
   .sort(function(a,b){return ver(b.id)-ver(a.id)||(/lite/.test(a.id)?1:0)-(/lite/.test(b.id)?1:0)||(/preview/.test(a.id)?1:0)-(/preview/.test(b.id)?1:0)})}
 async function gjson(prompt,opts){
  if(!useProxy&&!get(GKEY))throw Error('Add your Gemini API key in Jobnaut options (Prefill your Info > Resume & files > AI).');
  var model=get(GMODEL)||'gemini-3.8-flash',url;
  var body=JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:0.2}});
  var last='',healed=false;
  for(var a=0;a<4;a++){
   url=GBASE()+'models/'+model+':generateContent';var res;try{res=await fetch(url,{method:'POST',headers:gh({'Content-Type':'application/json'}),body:body})}catch(e){throw Error('Could not reach the Gemini API. Check your internet connection.')}
   if(res.ok){var d=await res.json(),c=(d.candidates||[])[0],parts=(c&&c.content&&c.content.parts)||[],text=parts.map(function(p){return p.text||''}).join('');
    if(!text)throw Error('The AI returned an empty reply'+(c&&c.finishReason?' ('+c.finishReason+')':'')+'. Please try again.');
    if(opts&&opts.onText)opts.onText({text:text});return parse(text)}
   var msg='';try{msg=((await res.json()).error||{}).message||''}catch(e){}last=res.status+(msg?': '+msg:'');
   if(res.status===404&&!healed){healed=true;try{var L=await gdiscover();if(L.length&&L[0].id!==model){model=L[0].id;set(GMODEL,model);if(window.__ro.refresh)window.__ro.refresh();a--;continue}}catch(e){}}
   if(res.status===404)throw Error('This Gemini model is not available ('+last+'). Pick another model in Jobnaut options (Resume & files).');
   if(res.status===400||res.status===401||res.status===403)throw Error('Gemini rejected the request ('+last+').'+(useProxy?' The site owner needs to check the server setup.':' Check that your API key is correct.'));
   if(res.status===429||res.status>=500){await sleep(4000*(a+1));continue}
   throw Error('Gemini error '+last)}
  if(/^429/.test(last))throw Error('Free-tier limit reached. Wait a minute and try again, or switch the model or provider in Jobnaut options (Resume & files).');
  throw Error('Gemini is busy right now ('+last+'). Please try again.')}
 /* ---------- OpenRouter ---------- */
 var OBASE=function(){return useProxy?(window.__proxyOverride||PROXY)+'/openrouter/api/v1/':'https://openrouter.ai/api/v1/'};
 var oh=function(h){var k=get(OKEY);if(!useProxy){if(k)h['Authorization']='Bearer '+k;h['X-Title']='Resume Optimiser'}return h};
 var isFree=function(m){return /:free$/.test(m.id)||(m.pricing&&+m.pricing.prompt===0&&+m.pricing.completion===0)};
 var PREF=[/inkling(?!-small)/,/nemotron-3-ultra/,/nemotron-3-super/,/minimax/,/inkling-small/,/dots/,/nemotron-3\.5/],BAD=/code|rerank|audio|tts|image|embed|lfm|mercury|vision|omni|laguna|guard|moderation|whisper/i,PAID=['anthropic/claude-haiku-5.5','anthropic/claude-sonnet-5.5','anthropic/claude-haiku-4.5','google/gemini-3.8-flash','openai/gpt-5-mini'];
 async function odiscover(){if(!useProxy&&!get(OKEY)){}var res;try{res=await fetch(OBASE()+'models',{headers:oh({})})}catch(e){throw Error('Could not reach OpenRouter.')}if(!res.ok)throw Error('Could not list models ('+res.status+')'+(useProxy?'.':'. Check your API key.'));
  var d=(await res.json()).data||[],txt=function(m){var o=(m.architecture||{}).output_modalities;return!o||o.indexOf('text')>=0},ok=d.filter(function(m){return txt(m)&&(m.context_length||0)>=32000});
  var rank=function(id){for(var i=0;i<PREF.length;i++)if(PREF[i].test(id))return i;return 99};
  var free=ok.filter(function(m){return isFree(m)&&!BAD.test(m.id)}).sort(function(a,b){return rank(a.id)-rank(b.id)||(b.context_length||0)-(a.context_length||0)}).map(function(m){return{id:m.id,label:m.id.replace(/:free$/,'')+' (free, '+Math.round((m.context_length||0)/1000)+'K)',group:'Free models'}});
  var paid=PAID.filter(function(id){return ok.some(function(m){return m.id===id})}).map(function(id){return{id:id,label:id+' (paid, about a few cents per resume)',group:'Paid (recommended: fast, complete answers)'}});
  var list=free.concat(paid);window.__orList=list;return list}
 function otext(c){var t=c&&c.message&&c.message.content;if(Array.isArray(t))t=t.map(function(p){return p.text||''}).join('');return String(t||'')}
 async function ojson(prompt,opts){
  if(!useProxy&&!get(OKEY))throw Error('Add your Gemini API key in Jobnaut options (Prefill your Info > Resume & files > AI).');
  var chosen=get(OMODEL)||DEFAULT_OR,queue=[chosen];if(queue.indexOf('openrouter/free')<0)FALLBACK_OR=FALLBACK_OR;
  if(true){var pool=(window.__orList||[]).filter(function(m){return m.group==='Free models'}).map(function(m){return m.id});FALLBACK_OR.forEach(function(x){if(pool.indexOf(x)<0&&!(window.__orList||[]).length)pool.push(x)});pool.forEach(function(x){if(queue.indexOf(x)<0&&queue.length<4)queue.push(x)})}
  var why=[];
  for(var qi=0;qi<queue.length;qi++){var model=queue[qi],useRF=true;
   for(var a=0;a<2;a++){
    var body={model:model,messages:[{role:'user',content:prompt}],temperature:0.2,max_tokens:16000};if(useRF)body.response_format={type:'json_object'};
    var res;try{res=await fetch(OBASE()+'chat/completions',{method:'POST',headers:oh({'Content-Type':'application/json'}),body:JSON.stringify(body)})}catch(e){why.push(model+': network');break}
    var d=null;try{d=await res.json()}catch(e){}
    var emsg=d&&d.error?(d.error.message||JSON.stringify(d.error)):'';
    if(res.status===401)throw Error('OpenRouter says the key is not valid (401). '+(emsg?emsg+'. ':'')+(useProxy?'The site owner needs to check the server setup.':'Check that the key is copied in full, with no spaces.'));
    if(res.status===402||res.status===403){why.push(model+': '+res.status+' '+(emsg||'refused').slice(0,110));break}
    if(res.status===400&&useRF){useRF=false;a--;continue}
    if(res.ok&&!emsg){var c=(d.choices||[])[0],text=otext(c);
     if(c&&c.finish_reason==='length'){why.push(model+': reply cut off');break}
     if(!text.trim()){why.push(model+': empty reply');break}
     var out;try{out=parse(text)}catch(e){why.push(model+': not valid JSON');break}
     window.__ro.lastModel=model;if(opts&&opts.onText)opts.onText({text:text});return out}
    why.push(model+': '+(res.status||'')+(emsg?' '+emsg.slice(0,80):''));
    if(res.status===429||res.status>=500||res.status===408){if(a===0){await sleep(3000);continue}}
    break}}
  throw Error('OpenRouter could not return a complete answer ('+why.slice(0,4).join('; ')+'). '+(why.some(function(w){return/ 40[23] /.test(w)})?'If it mentions a data policy or privacy setting, open openrouter.ai/settings/privacy and allow free models, then try again. ':'')+'Try again or pick another model.')}
 /* ---------- OpenAI-compatible free providers: Mistral, Cerebras ---------- */
 var CFG={
  mistral:{name:'Mistral',url:'https://api.mistral.ai/v1/',path:'/mistral/v1/',key:'ro_mi_key',model:'ro_mi_model',def:'mistral-small-latest',max:'max_tokens',models:[{id:'mistral-small-latest',label:'mistral-small-latest (free, fast)'},{id:'mistral-medium-latest',label:'mistral-medium-latest (free, stronger)'},{id:'mistral-large-latest',label:'mistral-large-latest (free, strongest, slower)'}],wait:'Mistral free limits are 1 request a second.'},
  cerebras:{name:'Cerebras',url:'https://api.cerebras.ai/v1/',path:'/cerebras/v1/',key:'ro_cb_key',model:'ro_cb_model',def:'gpt-oss-120b',max:'max_completion_tokens',models:[{id:'gpt-oss-120b',label:'gpt-oss-120b (very fast)'},{id:'qwen-3.8-27b',label:'qwen-3.8-27b (very fast)'}],wait:'Cerebras limits are 5 requests a minute.'}};
 var cbase=function(c){return useProxy?(window.__proxyOverride||PROXY)+c.path:c.url};
 var chd=function(c,h){var k=get(c.key);if(!useProxy&&k)h['Authorization']='Bearer '+k;return h};
 async function cdiscover(){var c=CFG[prov()];if(!useProxy&&!get(c.key))return c.models;try{var res=await fetch(cbase(c)+'models',{headers:chd(c,{})});if(!res.ok)return c.models;var d=(await res.json()).data||[],ids=d.map(function(m){return m.id}),dflt=c.models.map(function(m){return m.id});
   var l=c.models.filter(function(m){return ids.indexOf(m.id)>=0});return l.length?l:c.models}catch(e){return c.models}}
 async function cjson(prompt,opts){var c=CFG[prov()];
  if(!useProxy&&!get(c.key))throw Error('Add your Gemini API key in Jobnaut options (Prefill your Info > Resume & files > AI).');
  var queue=[get(c.model)||c.def];c.models.forEach(function(m){if(queue.indexOf(m.id)<0)queue.push(m.id)});var why=[];
  for(var qi=0;qi<queue.length;qi++){var model=queue[qi],useRF=true;
   for(var a=0;a<5;a++){
    var body={model:model,messages:[{role:'user',content:prompt}],temperature:0.2};body[c.max]=16000;if(useRF)body.response_format={type:'json_object'};
    var res;try{res=await fetch(cbase(c)+'chat/completions',{method:'POST',headers:chd(c,{'Content-Type':'application/json'}),body:JSON.stringify(body)})}catch(e){throw Error('Could not reach '+c.name+' from the browser ('+(e.message||'network error')+'). If this keeps happening, the site owner can route it through the server (see README).')}
    var d=null;try{d=await res.json()}catch(e){}
    var emsg=d&&typeof d.message==='string'?d.message:(d&&d.error?(d.error.message||JSON.stringify(d.error)):'');
    if(res.status===401||res.status===403)throw Error(c.name+' rejected the key ('+res.status+'). '+(useProxy?'The site owner needs to check the server setup.':'Check that your API key is correct and that your account is activated.'));
    if(res.status===402)throw Error(c.name+' is asking for payment on this account. Pick another provider in Jobnaut options (Resume & files).');
    if(res.status===400&&useRF){useRF=false;continue}
    if(res.status===404){why.push(model+': not available');break}
    if(res.status===429){await sleep(4000+4000*a);continue}
    if(res.status>=500){await sleep(3000);continue}
    if(res.ok&&!emsg){var ch=(d.choices||[])[0],text=otext(ch);
     if(ch&&ch.finish_reason==='length'){why.push(model+': reply cut off');break}
     if(!text.trim()){why.push(model+': empty reply');break}
     var out;try{out=parse(text)}catch(e){why.push(model+': not valid JSON');break}
     window.__ro.lastModel=model;if(opts&&opts.onText)opts.onText({text:text});return out}
    why.push(model+': '+(res.status||'')+(emsg?' '+emsg.slice(0,80):''));break}}
  throw Error(c.name+' could not return a complete answer ('+why.slice(0,3).join('; ')+'). '+c.wait+' Wait a minute and try again.')}
 /* ---------- dispatch ---------- */
 async function json(prompt,opts){var p=prov();return p==='gemini'?gjson(prompt,opts):(p==='cerebras'||p==='mistral')?cjson(prompt,opts):ojson(prompt,opts)}
 async function discover(){var p=prov();return p==='gemini'?gdiscover():(p==='cerebras'||p==='mistral')?cdiscover():odiscover()}
 var dl={save:async function(o){var u=URL.createObjectURL(o.data),a=document.createElement('a');a.href=u;a.download=o.filename;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},4000)}};
 window.claude={use:async function(n){if(n==='sample')return{json:json};if(n==='downloads')return dl;throw Error('Unknown helper '+n)}};
 window.__ro={get:get,set:set,PROV:PROV,prov:prov,kn:function(){var p=prov();return CFG[p]?CFG[p].key:p==='gemini'?GKEY:OKEY},mn:function(){var p=prov();return CFG[p]?CFG[p].model:p==='gemini'?GMODEL:OMODEL},defModel:function(){var p=prov();return CFG[p]?CFG[p].def:p==='gemini'?'gemini-3.8-flash':DEFAULT_OR},discover:discover,useProxy:useProxy};
})();
