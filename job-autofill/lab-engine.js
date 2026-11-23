/* Scoring engine from Resume Optimiser: ESCO + local embeddings + rule checks. */
(function(){
var WTS={skills:.4,title:.25,hard:.2,narr:.15};
var st=null,embP=null,eCache={},escoCache=null,escoErrors=0,escoCalls=0;
var norm=function(s){return String(s==null?'':s).toLowerCase().replace(/[^a-z0-9+#./ ]+/g,' ').replace(/\s+/g,' ').trim()};
var rx=function(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')};
var uniq=function(a){var s={},o=[];(a||[]).forEach(function(x){var k=norm(x);if(k&&!s[k]){s[k]=1;o.push(String(x).trim())}});return o};
var clamp=function(v,a,b){return Math.max(a,Math.min(b,v))};
var dot=function(a,b){var s=0;for(var i=0;i<a.length;i++)s+=a[i]*b[i];return s};
var short=function(t,n){t=String(t||'');var w=t.split(/\s+/);return w.length>n?w.slice(0,n).join(' ')+'…':t};

/* ---------- embeddings (runs in the browser, no key, no limit) ---------- */
function loadEmb(progress){
 if(!embP){embP=(async function(){
  var T=await import(chrome.runtime.getURL('vendor/transformers.min.js'));
  T.env.allowLocalModels=false;T.env.useBrowserCache=true;T.env.backends.onnx.wasm.wasmPaths=chrome.runtime.getURL('vendor/');T.env.backends.onnx.wasm.numThreads=1;T.env.backends.onnx.wasm.proxy=false;
  if(progress)progress('Loading the embedding model (about 25 MB the first time, then cached)…');
  var pipe=await T.pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2',{quantized:true});
  return async function(texts){var out=[];for(var i=0;i<texts.length;i+=16){var o=await pipe(texts.slice(i,i+16),{pooling:'mean',normalize:true}),dim=o.dims[1],d=o.data;for(var j=0;j<o.dims[0];j++)out.push(Array.prototype.slice.call(d,j*dim,(j+1)*dim))}return out}})();
  embP.catch(function(){embP=null})}
 return embP}
async function emb(texts,progress){var f=await(window.__embedOverride?Promise.resolve(window.__embedOverride):loadEmb(progress)),need=[];
 texts.forEach(function(t){if(!(t in eCache)&&need.indexOf(t)<0)need.push(t)});
 if(need.length){var v=await f(need);need.forEach(function(t,i){eCache[t]=v[i]})}
 return texts.map(function(t){return eCache[t]})}

/* ---------- ESCO skill ontology (free EU API) ---------- */
function loadEsco(){if(escoCache)return;try{escoCache=JSON.parse(localStorage.getItem('ro_esco')||'{}')}catch(e){escoCache={}}}
function saveEsco(){try{localStorage.setItem('ro_esco',JSON.stringify(escoCache))}catch(e){}}
function sane(term,label){var a=norm(term).split(' ').filter(function(w){return w.length>1}),b=norm(label);return a.some(function(w){return b.indexOf(w)>=0})||b.indexOf(norm(term))>=0}
async function escoLookup(term){loadEsco();var k=norm(term);if(k in escoCache)return escoCache[k];escoCalls++;
 try{var ctl=new AbortController(),t=setTimeout(function(){ctl.abort()},7000),
  r=await fetch('https://ec.europa.eu/esco/api/search?language=en&type=skill&limit=1&text='+encodeURIComponent(k),{signal:ctl.signal,headers:{Accept:'application/json'}});clearTimeout(t);
  if(!r.ok)throw Error('esco '+r.status);var j=await r.json(),h=j&&j._embedded&&j._embedded.results&&j._embedded.results[0],v=(h&&h.uri&&sane(term,h.title||''))?{uri:h.uri,label:h.title}:null;escoCache[k]=v;return v}
 catch(e){escoErrors++;return undefined}}
async function pool(items,n,fn){var i=0,w=[];for(var k=0;k<n;k++)w.push((async function(){while(i<items.length){var x=items[i++];await fn(x)}})());await Promise.all(w)}
async function mapKeys(terms,P,progress){var all=uniq(terms),n=0;escoErrors=0;escoCalls=0;
 await pool(all,6,async function(t){var h=await escoLookup(t);P.keys[norm(t)]=h?h.uri:'raw:'+norm(t);if(h)P.labels[norm(t)]=h.label;n++;if(progress&&n%5===0)progress('Mapping skills to ESCO… '+n+'/'+all.length)});
 saveEsco();P.escoOk=escoCalls===0?P.escoOk:escoErrors<escoCalls*0.5}

/* ---------- implicit skill inference (rules) ---------- */
var RULES=[
 {g:[['tableau','power bi','looker','looker studio','qlik']],inf:['data visualization','business intelligence']},
 {g:[['python'],['pandas','numpy','scikit-learn','matplotlib','seaborn']],inf:['data analysis']},
 {g:[['random forest','scikit-learn','xgboost','machine learning']],inf:['machine learning']},
 {g:[['regression','hypothesis testing','statistical analysis','statistics']],inf:['statistical modeling']},
 {g:[['a/b testing','ab testing','a/b tests','experimentation']],inf:['experimentation','hypothesis testing']},
 {g:[['sql','bigquery','postgresql','mysql','snowflake','hive','impala']],inf:['data querying']},
 {g:[['terraform'],['kubernetes','docker']],inf:['devops','infrastructure as code']},
 {g:[['airflow','dbt','etl','data pipeline','pipelines']],inf:['data pipelines']}];
function inferSkills(lower,terms){var has=function(w){return new RegExp('(^|[^a-z0-9])'+rx(w)+'($|[^a-z0-9])').test(lower)},out=[],seen={};
 RULES.forEach(function(r){var from=[];var ok=r.g.every(function(grp){var h=grp.filter(has);if(h.length)from.push(h[0]);return h.length>0});
  if(ok)r.inf.forEach(function(l){if(!seen[l]){seen[l]=1;out.push({label:l,from:from.slice()})}})});return out}

/* ---------- scoring ---------- */
var LADDER=[[/\b(intern|trainee)\b/,0],[/\b(junior|jr|associate|entry)\b/,1],[/\b(senior|sr|lead)\b/,3],[/\b(staff|principal|architect)\b/,4],[/\b(manager|head)\b/,4],[/\b(director)\b/,5],[/\b(vp|vice president)\b/,6]];
var level=function(t){t=norm(t);for(var i=0;i<LADDER.length;i++)if(LADDER[i][0].test(t))return LADDER[i][1];return 2};
var strip=function(t){return norm(t).replace(/\b(senior|sr|junior|jr|lead|staff|principal|associate|intern|trainee|entry|head|manager|director|vp|vice president|ii|iii|iv)\b/g,' ').replace(/\s+/g,' ').trim()};
var DEG={none:0,associate:1,bachelor:2,master:3,phd:4};

function months(s){if(!s)return null;s=String(s).trim().toLowerCase();if(/present|current|now/.test(s)){var d=new Date();return d.getFullYear()*12+d.getMonth()}var m=/^(\d{4})(?:[-/](\d{1,2}))?/.exec(s);return m?(+m[1])*12+((+m[2]||1)-1):null}
function yearsOf(roles){var iv=[];(roles||[]).forEach(function(r){var a=months(r.start),b=months(r.end==null||r.end===''?'present':r.end);if(a!=null&&b!=null&&b>=a)iv.push([a,b+1])});
 iv.sort(function(x,y){return x[0]-y[0]});var tot=0,cur=null;iv.forEach(function(v){if(!cur)cur=v.slice();else if(v[0]<=cur[1])cur[1]=Math.max(cur[1],v[1]);else{tot+=cur[1]-cur[0];cur=v.slice()}});if(cur)tot+=cur[1]-cur[0];return Math.round(tot/12*10)/10}

async function score(cand,text,jd,P,progress){
 var lower=' '+String(text).toLowerCase()+' ',
  has=function(t){var n=norm(t);return!!n&&new RegExp('(^|[^a-z0-9])'+rx(n)+'($|[^a-z0-9])').test(lower)};
 var req=uniq(jd.required_skills),reqN=req.map(norm),pref=uniq(jd.preferred_skills).filter(function(x){return reqN.indexOf(norm(x))<0}),
  jdT=req.concat(pref).slice(0,30),w=jdT.map(function(_,i){return i<req.length?1:.5});
 var cT=uniq(cand.skills),inf=inferSkills(lower,cT);
 var V=await emb(jdT.concat(cT,inf.map(function(i){return i.label})),progress),jV=V.slice(0,jdT.length),cV=V.slice(jdT.length,jdT.length+cT.length),iV=V.slice(jdT.length+cT.length);
 var items=[],status={},vals=[];
 jdT.forEach(function(j,i){var kj=P.keys[norm(j)],it={label:j+(i>=req.length?' (preferred)':''),status:'missing',where:'',note:'Not found in your resume.'},c=0,hit=null;
  for(var a=0;a<cT.length&&!hit;a++)if(norm(cT[a])===norm(j)||(kj&&P.keys[norm(cT[a])]===kj))hit=cT[a];
  if(hit){it.status='match';c=1;it.where=hit;it.note=kj&&kj.indexOf('raw:')!==0&&norm(hit)!==norm(j)?'Same skill in ESCO: '+(P.labels[norm(j)]||'')+'.':'Listed in your resume.'}
  else if(has(j)){it.status='match';c=1;it.where=j;it.note='Mentioned in your resume text.'}
  else{var best=-1,bi=-1;cV.forEach(function(v,a){var s=dot(jV[i],v);if(s>best){best=s;bi=a}});
   var ii=-1,is=-1;iV.forEach(function(v,a){var s=dot(jV[i],v);if(s>is){is=s;ii=a}});
   if(best>=.8){it.status='match';c=1;it.where=cT[bi];it.note='Same or very close skill (similarity '+best.toFixed(2)+').'}
   else if(is>=.8){it.status='partial';c=.7;it.where=inf[ii].from.join(' + ');it.note='Inferred, not stated: '+inf[ii].label+' (from '+inf[ii].from.join(' + ')+').'}
   else if(best>=.6){it.status='partial';c=.5;it.where=cT[bi];it.note='Related skill, not the same (similarity '+best.toFixed(2)+').'}
   else if(bi>=0){it.note='Not found. Closest skill you list: '+cT[bi]+' (similarity '+best.toFixed(2)+').'}}
  status[norm(j)]=it.status;items.push(it);vals.push(c)});
 var sw=w.reduce(function(a,b){return a+b},0),sk=jdT.length?100*vals.reduce(function(a,c,i){return a+c*w[i]},0)/sw:50;
 var nm=items.filter(function(i){return i.status==='match'}).length,np=items.filter(function(i){return i.status==='partial'}).length;
 var F={skills:{score:Math.round(sk),items:items,
  reason:jdT.length?nm+' of '+jdT.length+' JD skills are matched and '+np+' partly (related or inferred). Weighted coverage is '+Math.round(sk)+'%, with required skills counting double.':'No concrete skills were found in the job description.'}};

 /* title and seniority */
 var tItems=[],titles=(cand.roles||[]).map(function(r){return r.title}).filter(Boolean).slice(0,3),famS=0,senS=0;
 if(!titles.length||!jd.title){F.title={score:50,items:[{label:'Title',status:'partial',where:'',note:'A job title could not be read from the resume or the job description.'}],reason:'Titles could not be compared.'}}
 else{var TV=await emb([strip(jd.title)||norm(jd.title)].concat(titles.map(function(t){return strip(t)||norm(t)})),progress),bt=0,bs=-1;
  for(var t=1;t<TV.length;t++){var s=dot(TV[0],TV[t]);if(s>bs){bs=s;bt=t-1}}
  famS=clamp((bs-.35)/.45,0,1);var jl=level(jd.title),cl=Math.max.apply(null,titles.map(level)),gap=jl-cl;senS=gap<=0?1:Math.max(0,1-.3*gap);
  tItems.push({label:'Role family',status:famS>=.75?'match':famS>=.4?'partial':'missing',where:titles[bt],note:'Your closest title to "'+jd.title+'" is "'+titles[bt]+'" (similarity '+bs.toFixed(2)+').'});
  tItems.push({label:'Seniority',status:gap<=0?'match':gap===1?'partial':'missing',where:'',note:gap<=0?'Your seniority is at or above what the title asks for.':'The job title sits '+gap+' level'+(gap>1?'s':'')+' above your most senior title.'});
  var ts=Math.round(100*(.6*famS+.4*senS));F.title={score:ts,items:tItems,reason:'Role family fit is '+Math.round(famS*100)+'% (60% of this score) and seniority fit is '+Math.round(senS*100)+'% (40%), comparing "'+titles[bt]+'" with "'+jd.title+'".'}}

 /* hard requirements: exact checks in code */
 var hItems=[],pts=[],yrs=yearsOf(cand.roles),minY=+jd.min_years||0;
 if(minY>0){var ok=yrs>=minY,part=!ok&&yrs>=minY*.7;hItems.push({label:'At least '+minY+' years of experience',status:ok?'match':part?'partial':'missing',where:'',note:'Your dated roles add up to about '+yrs+' years.'});pts.push(ok?1:part?.5:0)}
 var jdDeg=DEG[jd.degree]||0;if(jdDeg>0){var cd=DEG[cand.degree]||0,okd=cd>=jdDeg;hItems.push({label:jd.degree[0].toUpperCase()+jd.degree.slice(1)+' degree or higher',status:okd?'match':'missing',where:cand.degree&&cand.degree!=='none'?cand.degree+' degree':'',note:okd?'Your highest degree meets this.':'No matching degree was found on your resume.'});pts.push(okd?1:0)}
 uniq(jd.certifications).forEach(function(c){var okc=(cand.certifications||[]).some(function(x){return norm(x).indexOf(norm(c))>=0||norm(c).indexOf(norm(x))>=0})||has(c);hItems.push({label:'Certification: '+c,status:okc?'match':'missing',where:'',note:okc?'Found on your resume.':'Not found on your resume.'});pts.push(okc?1:0)});
 var hs=pts.length?Math.round(100*pts.reduce(function(a,b){return a+b},0)/pts.length):100;
 if(!hItems.length)hItems.push({label:'Mandatory requirements',status:'match',where:'',note:'The job description lists no hard requirements.'});
 F.hard={score:hs,items:hItems,reason:pts.length?pts.filter(function(p){return p===1}).length+' of '+pts.length+' mandatory requirements are fully met. These are checked exactly, not estimated.':'No mandatory requirements were found, so nothing can block this application.'};

 /* narrative: JD duties vs your bullets, embedding cosine similarity */
 var duties=uniq(jd.duties).slice(0,12),bl=(cand.bullets||[]).filter(function(b){return String(b).trim()}),nItems=[],ns=0,avg=0;
 if(!duties.length||!bl.length){F.narr={score:duties.length?0:50,items:[{label:'Duties',status:'partial',where:'',note:!bl.length?'No experience bullets were found.':'No duties were found in the job description.'}],reason:'Narrative fit could not be measured.'}}
 else{var NV=await emb(duties.concat(bl),progress),dV=NV.slice(0,duties.length),bV=NV.slice(duties.length),sc=[];
  duties.forEach(function(d,i){var b=-1,bi=0;bV.forEach(function(v,k){var s=dot(dV[i],v);if(s>b){b=s;bi=k}});sc.push(clamp((b-.25)/.4,0,1));avg+=b;
   nItems.push({label:short(d,12),status:b>=.5?'match':b>=.35?'partial':'missing',where:short(bl[bi],12),note:'Closest bullet, similarity '+b.toFixed(2)+(b<.35?' (little overlap).':'.')})});
  ns=Math.round(100*sc.reduce(function(a,b){return a+b},0)/sc.length);avg/=duties.length;
  F.narr={score:ns,items:nItems,reason:'Each JD duty is compared with your bullets using meaning-based similarity. The average best match is '+avg.toFixed(2)+' ('+nItems.filter(function(i){return i.status==='match'}).length+' of '+duties.length+' duties clearly covered).'}}
 return{F:F,status:status,jdT:jdT,req:req.length,years:yrs}}

/* ---------- public API ---------- */
var EXTRACT='Extract structured data. Return ONLY JSON, no markdown:\n{"resume":{"roles":[{"title":"","start":"YYYY-MM","end":"YYYY-MM or present"}],"skills":[""],"degree":"none|associate|bachelor|master|phd","certifications":[""],"bullets":[""]},"jd":{"title":"","required_skills":[""],"preferred_skills":[""],"min_years":0,"degree":"none|associate|bachelor|master|phd","certifications":[""],"duties":[""]}}\nRules: copy only what is written, no inference. resume.skills = every tool, language, platform and method named anywhere in the resume (skills section, bullets, projects). resume.bullets = every experience bullet, verbatim. resume.degree = the highest degree held. jd skills = concrete tools, technologies, methods and domain skills (no soft skills), split into required and preferred (nice to have, a plus), at most 30 in total. jd.certifications = mandatory ones only. jd.degree = the minimum degree the job requires. jd.duties = 5 to 12 short responsibilities. Use "" for unknown dates and 0 for unknown years.';

async function analyse(resumeText,jdText,ask,progress){
 progress=progress||function(){};progress('Reading your resume and the job description…');
 var X=await ask(EXTRACT+'\nRESUME:\n'+resumeText+'\nJOB DESCRIPTION:\n'+jdText,'Reading your resume and the job description');
 var cand=X.resume||{},jd=X.jd||{};cand.roles=cand.roles||[];cand.skills=cand.skills||[];cand.bullets=cand.bullets||[];
 if(!window.__embedOverride)await loadEmb(progress);
 var P={keys:{},labels:{},escoOk:true};
 progress('Mapping skills to ESCO…');await mapKeys(uniq(cand.skills).concat(uniq((jd.required_skills||[]).concat(jd.preferred_skills||[]))),P,progress);
 progress('Scoring…');var R=await score(cand,resumeText,jd,P,progress);
 st={cand:cand,jd:jd,P:P,before:R,resumeText:resumeText};
 var sc={};['skills','title','hard','narr'].forEach(function(k){sc[k]=R.F[k].score});
 var ov=Math.round(sc.skills*WTS.skills+sc.title*WTS.title+sc.hard*WTS.hard+sc.narr*WTS.narr),fails=R.F.hard.items.filter(function(i){return i.status==='missing'}).map(function(i){return i.label});
 var al=ov>=70?'strong':ov>=50?'moderate':'weak',note=al==='strong'?'Your resume covers most of what this job asks for.':al==='moderate'?'You cover part of what this job asks for. Review the missing items before applying.':'Many requirements are not covered by your resume. Apply only if your real experience closes these gaps.';
 var factors={};['skills','title','hard','narr'].forEach(function(k){factors[k]={score:R.F[k].score,reason:R.F[k].reason,items:R.F[k].items}});
 return{role:jd.title||'',aligned:al,alignment_note:note,blockers:fails,factors:factors,
  engine:'Scoring engine: skills mapped with ESCO ('+(P.escoOk?'online':'unreachable, so skills were matched by meaning only')+'), meaning-based similarity from a local embedding model (all-MiniLM-L6-v2), requirements checked exactly in code. The AI only reads the text.'}}

/* Re-scores the WHOLE updated resume (same inputs as the first score), so before and after are comparable. */
async function after(r,newText){
 if(!st)return;var tl=norm(newText),has=function(t){var n=norm(t);return!!n&&(' '+tl+' ').indexOf(' '+n+' ')>=0};
 var skills=[],tools=[];
 (r.skills||[]).forEach(function(s){var k=s.indexOf(':');(k>0?s.slice(k+1):s).split(/[,;]/).forEach(function(x){x=x.trim();if(x)skills.push(x)})});
 (r.projects||[]).forEach(function(p){String(p.tools||'').split(/[,;]/).forEach(function(x){x=x.trim();if(x)tools.push(x)})});
 var kept=(st.cand.skills||[]).filter(has),
  bl=(st.cand.bullets||[]).filter(function(b){var n=norm(b);return n&&tl.indexOf(n)>=0}),
  nb=[];(r.roles||[]).forEach(function(ro){nb=nb.concat(ro.bullets||[])});(r.projects||[]).forEach(function(p){nb=nb.concat(p.bullets||[])});
 var cand={roles:st.cand.roles,degree:st.cand.degree,certifications:st.cand.certifications,skills:uniq(kept.concat(skills,tools)),bullets:bl.concat(nb)};
 var P=st.P;await mapKeys(cand.skills,P,null);
 var R=await score(cand,newText,st.jd,P,null),sc={};['skills','title','hard','narr'].forEach(function(k){sc[k]=R.F[k].score});
 r.after_scores=sc;r.after_factors=R.F;
 r.keywords=st.before.jdT.slice(0,25).map(function(t){var k=norm(t);return{kw:t,in_before:st.before.status[k]==='match',in_after:R.status[k]==='match'}});
 r.lost_keywords=r.keywords.filter(function(x){return x.in_before&&!x.in_after}).map(function(x){return x.kw});
 r.remaining_gaps=R.jdT.filter(function(t){return R.status[norm(t)]==='missing'}).slice(0,12)}

window.ENGINE={analyse:analyse,after:after,reset:function(){st=null}};
})();
