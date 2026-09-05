const DATA=window.ARB_DATA;
const COLORS=["#6A3D9A","#D95F02","#1F78B4","#E7298A","#1B9E77","#A6761D","#00A6D6","#4D4D4D"];
const MODEL=Object.fromEntries(DATA.models.map((model,index)=>[model.codename,{...model,key:model.codename,color:COLORS[index%COLORS.length]}]));
const ORDER=DATA.models.map(model=>model.codename);
// Sync with the "Task areas" block, excluding SCFA while its task error is unresolved.
const CATEGORIES=[
  {name:"Model training",count:8,color:"#d8e5e4",description:"Train models and representations under a fixed performance measure.",specimens:["HiCARD latent encoder","CausalPFN CATE PEHE","CausalRivers held out station graph AUROC","COCO 16 bit hash head","Sparse ELSA item embeddings","FasterCache video DiT policy","Less Is More token budget selection","TIES CLIP model merging"]},
  {name:"Algorithms and optimization",count:6,color:"#efc8bc",description:"Make sequential decisions or improve an optimization procedure under constraints.",specimens:["Sketched Newton covariance estimator","CARPS star discrepancy subset selection","RePPO reliable on policy control","SOPCC online chance constrained policy","TGAT MILP branching","HalfCheetah advantage estimator"]},
  {name:"Data engineering and curation",count:6,color:"#e8ddbd",description:"Select, transform, or recover data so later learning works better.",specimens:["Budgeted imputation MCAR 50","ACT tensor sparse panel imputation","ActivePrune unlabeled pool pruning","Budgeted Covtype dual market","Waterbirds group robust coreset selection","DCTabEval pooled categorical statistics"]},
  {name:"Systems and efficiency",count:4,color:"#cbd9ec",description:"Reduce computation, memory use, or latency while preserving correct results.",specimens:["CPU LLM decode throughput","CPU decoder graph executor","VAS maskless deployment feasibility","SVDQuant W4A4 reconstruction"]},
  {name:"Evaluation, calibration, and robustness",count:3,color:"#e9d4dd",description:"Measure uncertainty, improve reliability, and evaluate models under difficult conditions.",specimens:["Shortest valid CI L2 ECE","Label efficient risk estimator","FastAdv budgeted PGD50"]},
  {name:"AI safety and alignment",count:1,color:"#d6e0c8",description:"Assess or alter model safety behavior and how reliably it can be controlled.",specimens:["FasterGCG candidate token ranking"]},
  {name:"Interpretability",count:1,color:"#dfd7ec",description:"Study internal model representations and identify the features they contain.",specimens:["Sparse autoencoder dictionary learning"]}
];
const esc=value=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const fmt=value=>value==null||!Number.isFinite(value)?"n/a":value.toFixed(3);
const pct=value=>value==null||!Number.isFinite(value)?"n/a":`${(100*value).toFixed(1)}%`;
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const quantile=(values,p)=>{const a=[...values].sort((x,y)=>x-y);if(!a.length)return null;const i=(a.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return a[lo]+(a[hi]-a[lo])*(i-lo)};
const niceStep=raw=>{const power=10**Math.floor(Math.log10(Math.max(raw,1e-8))),fraction=raw/power;return (fraction<=1?1:fraction<=2?2:fraction<=5?5:10)*power};
const ticks=(lo,hi,step)=>{const out=[];for(let value=lo,count=0;value<=hi+step*.01&&count<20;value+=step,count++)out.push(Math.abs(value)<1e-12?0:value);return out};
const elapsed=row=>Math.max(row.public_elapsed_seconds||0,row.private_elapsed_seconds||0);
const usableRun=run=>run.attempt_status!=="agent_error"&&run.iterations.some(row=>row.public_score!=null&&row.private_score!=null);
function runEnd(run){const last=Math.max(0,...run.iterations.map(elapsed)),status=(run.status||"").toLowerCase(),start=new Date(run.created_at).getTime(),finish=status==="running"?new Date(DATA.fetched_at).getTime():new Date(run.completed_at).getTime(),wall=Number.isFinite(start)&&Number.isFinite(finish)?Math.max(0,(finish-start)/1000):0;return Math.min(DATA.duration_seconds,Math.max(last,wall))}
function derive(run){let best=-Infinity,pick=null;const points=[];for(const row of run.iterations){if(row.public_score!=null&&row.public_score>best){best=row.public_score;pick=row}points.push({iteration:row.iteration,seconds:elapsed(row),bestValidation:pick?.public_score??null,testAtBest:pick?.private_score??null})}return{points,endSeconds:runEnd(run),selected:pick?{iteration:pick.iteration,validation:pick.public_score,test:pick.private_score}:null}}
function timeAuc(points,key,endSeconds){if(!points.length||!endSeconds)return null;let total=0,previousTime=0,previousValue=0;for(const point of points){const time=Math.min(endSeconds,Math.max(previousTime,point.seconds||0));total+=previousValue*(time-previousTime);if(point[key]!=null)previousValue=point[key];previousTime=time}total+=previousValue*Math.max(0,endSeconds-previousTime);return total/endSeconds}
function runStats(run){return{key:run.model,hours:run.hours,points:run.points}}
const taskStats=task=>task.models.map(runStats);

function difficultyAdjustedValidation(task,point){
  const raw=RAW_SCORE_MAPS[task.name]?.invert(point.bestValidation,"intermediate")??null;
  if(raw==null)return point.bestValidation===0?0:null;
  return DIFFICULTY_REWARD_MAPS[task.name]?.score(raw,"intermediate")??null;
}

const sigmoid=value=>value>=0?1/(1+Math.exp(-value)):Math.exp(value)/(1+Math.exp(value));
const logit=value=>Math.log(value/(1-value));

function fitLogSigmoid(points){
  const observations=points.filter(point=>point.hour>0&&Number.isFinite(point.value));
  const maxObserved=Math.max(...observations.map(point=>point.value)),meanObserved=mean(observations.map(point=>point.value)),minimumCeiling=Math.min(.9995,Math.max(maxObserved+.001,.05));
  const linearFit=ceiling=>{
    const xs=observations.map(point=>Math.log(point.hour)),ys=observations.map(point=>logit(Math.min(.999,Math.max(.001,point.value/ceiling)))),mx=mean(xs),my=mean(ys),denominator=xs.reduce((sum,value)=>sum+(value-mx)**2,0),beta=denominator?xs.reduce((sum,value,index)=>sum+(value-mx)*(ys[index]-my),0)/denominator:0,intercept=my-beta*mx;
    return{ceiling,beta:Math.max(.01,beta),logMid:-intercept/Math.max(.01,beta)};
  };
  const normalize=params=>({ceiling:Math.min(1,Math.max(minimumCeiling,params.ceiling)),beta:Math.min(30,Math.max(.01,params.beta)),logMid:Math.min(Math.log(1e5),Math.max(Math.log(.01),params.logMid))});
  const error=params=>observations.reduce((sum,point)=>{const estimate=params.ceiling*sigmoid(params.beta*(Math.log(point.hour)-params.logMid));return sum+(point.value-estimate)**2},0);
  let best=null;
  for(let index=0;index<=240;index++){
    const params=normalize(linearFit(minimumCeiling+(1-minimumCeiling)*index/240)),sse=error(params);
    if(!best||sse<best.sse)best={...params,sse};
  }
  let steps={ceiling:.06,logMid:.8,logBeta:.55};
  let current={ceiling:best.ceiling,logMid:best.logMid,logBeta:Math.log(best.beta),sse:best.sse};
  for(let pass=0;pass<28;pass++){
    let improved=false;
    for(const key of ["ceiling","logMid","logBeta"]){
      let candidate=current;
      for(const direction of [-1,1]){
        const proposal={...current,[key]:current[key]+direction*steps[key]},params=normalize({ceiling:proposal.ceiling,beta:Math.exp(proposal.logBeta),logMid:proposal.logMid}),sse=error(params);
        if(sse<candidate.sse-1e-12)candidate={ceiling:params.ceiling,logMid:params.logMid,logBeta:Math.log(params.beta),sse};
      }
      if(candidate!==current){current=candidate;improved=true;}
    }
    if(!improved)steps={ceiling:steps.ceiling*.6,logMid:steps.logMid*.6,logBeta:steps.logBeta*.6};
  }
  const params=normalize({ceiling:current.ceiling,beta:Math.exp(current.logBeta),logMid:current.logMid}),variance=observations.reduce((sum,point)=>sum+(point.value-meanObserved)**2,0),r2=variance>1e-12?1-error(params)/variance:null;
  return{...params,tmid:Math.exp(params.logMid),r2,predict:hour=>hour<=0?0:params.ceiling*sigmoid(params.beta*(Math.log(hour)-params.logMid))};
}

function overviewTrajectories(){
  const maxHours=Math.ceil(Math.max(1,...DATA.tasks.flatMap(task=>task.models.map(run=>run.hours).filter(Number.isFinite))));
  const hours=Array.from({length:maxHours+1},(_,hour)=>hour);
  const series=ORDER.map(key=>{
    const runs=DATA.tasks.map(task=>{
      const run=task.models.find(candidate=>candidate.model===key),points=run?.points.map(point=>({...point,value:difficultyAdjustedValidation(task,point)})).filter(point=>Number.isFinite(point.value))||[];
      return points.length?{points}:null;
    }).filter(Boolean);
    const valueAt=(run,seconds)=>{let value=0;for(const point of run.points){if(point.seconds>seconds)break;value=point.value}return value};
    const points=hours.map(hour=>({hour,value:mean(runs.map(run=>valueAt(run,hour*3600)))}));
    return{key,name:MODEL[key].name,color:MODEL[key].color,count:runs.length,points,fit:fitLogSigmoid(points)};
  });
  return{maxHours,series};
}

function solveProfiles(){
  const workloads=DATA.tasks.map(task=>{
    const runs=task.models.map(run=>({key:run.model,points:run.points.map(point=>({...point,value:difficultyAdjustedValidation(task,point)})).filter(point=>Number.isFinite(point.value))})).filter(run=>run.points.length);
    if(runs.length<3)return null;
    const peaks=runs.map(run=>Math.max(...run.points.map(point=>point.value))).sort((a,b)=>b-a);
    const target=(peaks[3]+peaks[4])/2;
    const hitTimes=Object.fromEntries(runs.map(run=>[run.key,run.points.find(point=>point.value>=target)?.seconds??Infinity]));
    const fastest=Math.min(...Object.values(hitTimes));
    return{target,ratios:Object.fromEntries(ORDER.map(key=>{const hit=hitTimes[key];return[key,Number.isFinite(hit)?Math.max(hit,1)/Math.max(fastest,1):Infinity]}))};
  }).filter(Boolean);
  const allRatios=workloads.flatMap(workload=>Object.values(workload.ratios).filter(Number.isFinite));
  const maxRatio=Math.max(2,...allRatios),maxFactor=2**Math.ceil(Math.log2(maxRatio));
  return{count:workloads.length,maxFactor,series:ORDER.map(key=>({key,name:MODEL[key].name,color:MODEL[key].color,ratios:workloads.map(workload=>workload.ratios[key])}))};
}

function overviewLegend(series){
  return`<div class="overview-legend" aria-label="Model legend">${series.map(item=>`<span><i style="background:${item.color}"></i>${esc(item.name)}</span>`).join("")}</div>`;
}

function overviewLine(series,path,detail){
  const label=`${series.name}. ${detail}`;
  return`<g class="overview-line-group" data-overview-line data-model="${esc(series.name)}" data-detail="${esc(detail)}" data-color="${series.color}" tabindex="0" role="img" aria-label="${esc(label)}"><path class="curve" stroke="${series.color}" d="${path}"/><path class="overview-hit" d="${path}"/><title>${esc(label)}</title></g>`;
}

function meanTrajectoryPlot(overview){
  const W=470,H=342,L=56,R=16,T=18,B=48,plotB=H-B,values=overview.series.flatMap(series=>series.points.map(point=>point.value)).filter(Number.isFinite),hi=Math.max(.1,...values),step=niceStep(hi/5),yMax=Math.ceil(hi/step)*step,x=hour=>L+hour/overview.maxHours*(W-L-R),y=value=>plotB-value/yMax*(plotB-T),hourTicks=ticks(0,overview.maxHours,overview.maxHours<=12?2:4),scoreTicks=ticks(0,yMax,step);
  let body=`<rect class="plot-frame" x="${L}" y="${T}" width="${W-L-R}" height="${plotB-T}"/>`;
  for(const value of scoreTicks){const yy=y(value);body+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="plot-tick" x="${L-8}" y="${yy+3}" text-anchor="end">${value.toFixed(2)}</text>`}
  for(const hour of hourTicks){const xx=x(hour);body+=`<line class="grid" x1="${xx}" x2="${xx}" y1="${T}" y2="${plotB}"/><text class="plot-tick" x="${xx}" y="${plotB+20}" text-anchor="middle">${hour}</text>`}
  body+=`<text class="overview-axis-title" x="${(L+W-R)/2}" y="${H-8}" text-anchor="middle">Elapsed evaluation time (hours)</text><text class="overview-axis-title" x="14" y="${(T+plotB)/2}" text-anchor="middle" transform="rotate(-90 14 ${(T+plotB)/2})">Mean difficulty-adjusted reward</text>`;
  for(const series of overview.series){for(const point of series.points.slice(1))body+=`<circle class="fit-observation" fill="${series.color}" cx="${x(point.hour)}" cy="${y(point.value)}" r="2.4"/>`;const d=series.points.map((point,index)=>`${index?"L":"M"}${x(point.hour)} ${y(series.fit.predict(point.hour))}`).join(" ");body+=overviewLine(series,d,`Log-sigmoid fit: R² ${series.fit.r2?.toFixed(3)??"n/a"}, ceiling ${series.fit.ceiling.toFixed(3)}, midpoint ${series.fit.tmid.toFixed(1)} h.`)}
  return`<article class="metric-plot"><h3>Fitted mean validation trajectory</h3><p>Dots are hourly task means; solid curves are fitted log-sigmoids.</p><div class="overview-chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fitted mean difficulty-adjusted validation trajectory by model">${body}</svg><div class="overview-tooltip" role="tooltip" hidden><i></i><strong></strong><span></span></div></div></article>`;
}

function linearizedOddsPlot(overview){
  const W=940,H=360,L=72,R=22,T=16,B=48,plotB=H-B,logHour=hour=>Math.log(hour),logOdds=(score,ceiling)=>{const clipped=Math.min(ceiling*.998,Math.max(ceiling*.002,score));return Math.log(ceiling*clipped/(ceiling-clipped))},lineValue=(series,x)=>Math.log(series.fit.ceiling)+series.fit.beta*(x-series.fit.logMid),hours=overview.series.flatMap(series=>series.points.filter(point=>point.hour>0).map(point=>point.hour)),xMin=Math.min(...hours.map(logHour)),xMax=Math.max(...hours.map(logHour)),lineXs=[xMin,xMax],observations=overview.series.flatMap(series=>series.points.filter(point=>point.hour>0).map(point=>({hour:point.hour,value:logOdds(point.value,series.fit.ceiling)}))),values=[...observations.map(point=>point.value),...overview.series.flatMap(series=>lineXs.map(value=>lineValue(series,value)))],rawYMin=Math.min(...values),rawYMax=Math.max(...values),yStep=niceStep(Math.max(.1,rawYMax-rawYMin)/5),yMin=Math.floor(rawYMin/yStep)*yStep,yMax=Math.ceil(rawYMax/yStep)*yStep,x=value=>L+(value-xMin)/Math.max(.001,xMax-xMin)*(W-L-R),y=value=>plotB-(value-yMin)/Math.max(.001,yMax-yMin)*(plotB-T),hourTicks=[1,2,4,8,16,overview.maxHours].filter((hour,index,array)=>hour<=overview.maxHours&&array.indexOf(hour)===index);
  let body=`<rect class="plot-frame" x="${L}" y="${T}" width="${W-L-R}" height="${plotB-T}"/>`;
  for(const hour of hourTicks){const xx=x(logHour(hour));body+=`<line class="grid" x1="${xx}" x2="${xx}" y1="${T}" y2="${plotB}"/><text class="plot-tick" x="${xx}" y="${plotB+20}" text-anchor="middle">${hour}</text>`}
  for(const value of ticks(yMin,yMax,yStep)){const yy=y(value);body+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="plot-tick" x="${L-8}" y="${yy+3}" text-anchor="end">${value.toFixed(1)}</text>`}
  body+=`<text class="overview-axis-title" x="${(L+W-R)/2}" y="${H-8}" text-anchor="middle">Elapsed evaluation time (hours, log scale)</text><text class="overview-axis-title" x="15" y="${(T+plotB)/2}" text-anchor="middle" transform="rotate(-90 15 ${(T+plotB)/2})">log(S × S_max / (S_max - S))</text>`;
  for(const series of overview.series){for(const point of series.points.filter(point=>point.hour>0))body+=`<circle class="fit-observation" fill="${series.color}" cx="${x(logHour(point.hour))}" cy="${y(logOdds(point.value,series.fit.ceiling))}" r="2.4"/>`;const path=`M${x(xMin)} ${y(lineValue(series,xMin))}L${x(xMax)} ${y(lineValue(series,xMax))}`,intercept=Math.log(series.fit.ceiling)-series.fit.beta*series.fit.logMid;body+=overviewLine(series,path,`Linearized log-sigmoid: slope β ${series.fit.beta.toFixed(2)}, intercept ${intercept.toFixed(2)}, ceiling ${series.fit.ceiling.toFixed(3)}, R² ${series.fit.r2?.toFixed(3)??"n/a"}.`)}
  return`<article class="metric-plot metric-plot-wide"><h3>Linearized fitted trajectories</h3><p>Ceiling-preserving raw-score log-odds, log(S × S_max / (S_max - S)), versus log time. This turns each fitted log-sigmoid into a straight line while retaining its S_max as a vertical offset.</p><div class="overview-chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Linearized fitted difficulty-adjusted trajectories by model">${body}</svg><div class="overview-tooltip" role="tooltip" hidden><i></i><strong></strong><span></span></div></div></article>`;
}

function performanceProfilePlot(profile){
  const W=470,H=342,L=56,R=16,T=18,B=48,plotB=H-B,x=factor=>L+Math.log2(factor)/Math.log2(profile.maxFactor)*(W-L-R),y=fraction=>plotB-fraction*(plotB-T),factors=[];
  for(let factor=1;factor<=profile.maxFactor;factor*=2)factors.push(factor);
  let body=`<rect class="plot-frame" x="${L}" y="${T}" width="${W-L-R}" height="${plotB-T}"/>`;
  for(const fraction of [0,.25,.5,.75,1]){const yy=y(fraction);body+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="plot-tick" x="${L-8}" y="${yy+3}" text-anchor="end">${Math.round(fraction*100)}%</text>`}
  for(const factor of factors){const xx=x(factor);body+=`<line class="grid" x1="${xx}" x2="${xx}" y1="${T}" y2="${plotB}"/><text class="plot-tick" x="${xx}" y="${plotB+20}" text-anchor="middle">${factor}×</text>`}
  body+=`<text class="overview-axis-title" x="${(L+W-R)/2}" y="${H-8}" text-anchor="middle">Time relative to fastest solver</text><text class="overview-axis-title" x="14" y="${(T+plotB)/2}" text-anchor="middle" transform="rotate(-90 14 ${(T+plotB)/2})">Workloads solved</text>`;
  for(const series of profile.series){
    const ratios=series.ratios.filter(Number.isFinite).sort((a,b)=>a-b);let solved=0,path=`M${x(1)} ${y(0)}`;
    for(let index=0;index<ratios.length;){const ratio=ratios[index];while(index<ratios.length&&Math.abs(ratios[index]-ratio)<1e-10)index++;const xx=x(Math.min(profile.maxFactor,ratio));path+=`L${xx} ${y(solved/profile.count)}L${xx} ${y(index/profile.count)}`;solved=index;}
    path+=`L${x(profile.maxFactor)} ${y(solved/profile.count)}`;
    body+=overviewLine(series,path,`Solves ${solved} of ${profile.count} workloads within ${profile.maxFactor}× the fastest solve time.`);
  }
  return`<article class="metric-plot"><h3>Dolan–Moré performance profile</h3><p>A workload is solved at the midpoint between its fourth- and fifth-highest model peak difficulty-adjusted validation scores. Higher is better; a curve farther left reaches that target faster.</p><div class="overview-chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Dolan-More performance profile by model">${body}</svg><div class="overview-tooltip" role="tooltip" hidden><i></i><strong></strong><span></span></div></div></article>`;
}

function bindOverviewTooltips(target){
  const show=(line,event)=>{
    const wrap=line.closest(".overview-chart-wrap"),tooltip=wrap?.querySelector(".overview-tooltip");
    if(!wrap||!tooltip)return;
    tooltip.querySelector("i").style.background=line.dataset.color;
    tooltip.querySelector("strong").textContent=line.dataset.model;
    tooltip.querySelector("span").textContent=line.dataset.detail;
    const rect=wrap.getBoundingClientRect(),clientX=event?.clientX,clientY=event?.clientY;
    const left=Number.isFinite(clientX)?Math.min(Math.max(10,clientX-rect.left+12),Math.max(10,rect.width-196)):12;
    const top=Number.isFinite(clientY)?Math.min(Math.max(10,clientY-rect.top+12),Math.max(10,rect.height-72)):12;
    tooltip.style.left=`${left}px`;tooltip.style.top=`${top}px`;tooltip.hidden=false;
  };
  target.querySelectorAll("[data-overview-line]").forEach(line=>{
    line.addEventListener("mouseenter",event=>show(line,event));
    line.addEventListener("mousemove",event=>show(line,event));
    line.addEventListener("focus",event=>show(line,event));
    line.addEventListener("mouseleave",()=>{const tooltip=line.closest(".overview-chart-wrap")?.querySelector(".overview-tooltip");if(tooltip)tooltip.hidden=true});
    line.addEventListener("blur",()=>{const tooltip=line.closest(".overview-chart-wrap")?.querySelector(".overview-tooltip");if(tooltip)tooltip.hidden=true});
  });
}

function renderTrajectoryOverview(){
  const target=document.getElementById("trajectory-overview");
  if(!target)return;
  const overview=overviewTrajectories(),profile=solveProfiles();
  target.innerHTML=`<section class="trajectory-summary" aria-labelledby="trajectory-overview-title"><h3 id="trajectory-overview-title">Aggregate research trajectories</h3><p>These views summarize all ${profile.count} workloads using difficulty-adjusted validation reward. Each task’s last submitted score is carried forward through the shared 24-hour window. The fitted mean curves use the same log-sigmoid form as <a href="https://edge-bench.org/" target="_blank" rel="noreferrer">EdgeBench</a>; hover or focus a line to identify its model.</p>${overviewLegend(overview.series)}<div class="trajectory-overview-grid">${meanTrajectoryPlot(overview)}${performanceProfilePlot(profile)}${linearizedOddsPlot(overview)}</div><p class="trajectory-footnote">For the performance profile, each workload’s solve threshold is the midpoint between the fourth- and fifth-highest peak difficulty-adjusted validation scores across models. The linearized chart uses log(S × S_max / (S_max - S)) against log time. Its ceiling offset keeps S_max differences visible without recentering either axis for individual models.</p></section>`;
  bindOverviewTooltips(target);
}

function ranks(values){const order=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value),out=Array(values.length);for(let i=0;i<order.length;){let j=i+1;while(j<order.length&&order[j].value===order[i].value)j++;const rank=(i+j-1)/2+1;for(let k=i;k<j;k++)out[order[k].index]=rank;i=j}return out}
function spearman(xs,ys){if(xs.length<2||xs.length!==ys.length)return null;const a=ranks(xs),b=ranks(ys),ma=mean(a),mb=mean(b);let numerator=0,da=0,db=0;for(let i=0;i<a.length;i++){numerator+=(a[i]-ma)*(b[i]-mb);da+=(a[i]-ma)**2;db+=(b[i]-mb)**2}return da&&db?numerator/Math.sqrt(da*db):null}
function bootstrap(values,seed){if(!values.length)return[null,null];let state=seed>>>0;const samples=[];for(let b=0;b<1200;b++){let total=0;for(let i=0;i<values.length;i++){state=(1664525*state+1013904223)>>>0;total+=values[Math.floor(state/4294967296*values.length)]}samples.push(total/values.length)}return[quantile(samples,.025),quantile(samples,.975)]}
const relativeGap=(validation,test)=>validation==null||test==null?null:(validation-test)/Math.max(Math.abs(validation),Math.abs(test),1e-12);
const median=values=>{const a=[...values].sort((x,y)=>x-y),n=a.length;return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2};
function eloFromTasks(tasks,steps=700){const ratings=Object.fromEntries(ORDER.map(key=>[key,0]));for(let step=0;step<steps;step++){const gradient=Object.fromEntries(ORDER.map(key=>[key,0]));let matches=0;for(const task of tasks){const byKey=Object.fromEntries(taskStats(task).filter(item=>item.usable).map(item=>[item.key,item]));for(let i=0;i<ORDER.length;i++)for(let j=i+1;j<ORDER.length;j++){const a=byKey[ORDER[i]],b=byKey[ORDER[j]];if(a?.testAuc==null||b?.testAuc==null)continue;const outcome=a.testAuc===b.testAuc?.5:a.testAuc>b.testAuc?1:0,prediction=1/(1+Math.exp(-(ratings[a.key]-ratings[b.key])));gradient[a.key]+=outcome-prediction;gradient[b.key]-=outcome-prediction;matches++}}const rate=.08/Math.max(1,matches/ORDER.length);ORDER.forEach(key=>ratings[key]+=rate*gradient[key])}return Object.fromEntries(ORDER.map(key=>[key,1000+ratings[key]*400/Math.log(10)]))}
function modelMeans(tasks){const byModel=Object.fromEntries(ORDER.map(key=>[key,{validation:[],test:[],final:[],cost:[]} ]));for(const task of tasks)for(const stat of taskStats(task).filter(item=>item.usable)){byModel[stat.key].validation.push(stat.valAuc);byModel[stat.key].test.push(stat.testAuc);if(stat.selected?.test!=null)byModel[stat.key].final.push(stat.selected.test);if(stat.cost!=null)byModel[stat.key].cost.push(stat.cost)}return byModel}
function rhoForTasks(tasks){const byModel=modelMeans(tasks),validation=ORDER.map(key=>mean(byModel[key].validation)),test=ORDER.map(key=>mean(byModel[key].test));return spearman(validation,test)}
function bootstrapRho(tasks,seed){let state=seed>>>0;const samples=[];for(let b=0;b<1200;b++){const sample=[];for(let i=0;i<tasks.length;i++){state=(1664525*state+1013904223)>>>0;sample.push(tasks[Math.floor(state/4294967296*tasks.length)])}samples.push(rhoForTasks(sample))}return[quantile(samples,.025),quantile(samples,.975)]}
function bootstrapGaps(tasks,seed){let state=seed>>>0;const values=Object.fromEntries(ORDER.map(key=>[key,[]]));for(let b=0;b<1200;b++){const sample=[];for(let i=0;i<tasks.length;i++){state=(1664525*state+1013904223)>>>0;sample.push(tasks[Math.floor(state/4294967296*tasks.length)])}const byModel=modelMeans(sample);ORDER.forEach(key=>values[key].push(relativeGap(mean(byModel[key].validation),mean(byModel[key].test))))}return Object.fromEntries(ORDER.map(key=>[key,[quantile(values[key],.025),quantile(values[key],.975)]]))}
function bootstrapElo(tasks,referenceKey,seed){let state=seed>>>0;const values=Object.fromEntries(ORDER.map(key=>[key,[]]));for(let b=0;b<300;b++){const sample=[];for(let i=0;i<tasks.length;i++){state=(1664525*state+1013904223)>>>0;sample.push(tasks[Math.floor(state/4294967296*tasks.length)])}const elo=eloFromTasks(sample,200),shift=1000-elo[referenceKey];ORDER.forEach(key=>values[key].push(elo[key]+shift))}return Object.fromEntries(ORDER.map(key=>[key,[quantile(values[key],.025),quantile(values[key],.975)]]))}
function currentResults(){return{rows:DATA.aggregates,rho:DATA.rank_rho,rho_ci:DATA.rank_rho_ci,referenceName:DATA.elo_reference}}
function plotDomain(rows,ciKey,includeZero=false){let values=rows.flatMap(row=>row[ciKey]||[]).filter(Number.isFinite);if(!values.length)values=[0,1];let lo=Math.min(...values),hi=Math.max(...values);if(includeZero){lo=Math.min(lo,0);hi=Math.max(hi,0)}const step=niceStep(Math.max(hi-lo,.01)/5);lo=Math.floor(lo/step)*step;hi=Math.ceil(hi/step)*step;if(lo===hi)hi+=step;return{lo,hi,ticks:ticks(lo,hi,step)}}
function aggregatePlot(title,subtitle,rows,valueKey,ciKey,format="score",wide=false){const percent=format==="percent",integer=format==="integer",W=wide?940:470,H=358,L=wide?175:145,R=wide?70:60,T=8,B=32,plotB=H-B,rowH=(plotB-T)/rows.length,domain=plotDomain(rows,ciKey,percent),x=value=>L+(value-domain.lo)/(domain.hi-domain.lo)*(W-L-R),label=value=>percent?pct(value):integer?Math.round(value).toString():fmt(value),tickLabel=value=>percent?Math.round(100*value)+"%":integer?Math.round(value).toString():value.toFixed(2);let body=`<rect class="plot-frame" x="${L}" y="${T}" width="${W-L-R}" height="${plotB-T}"/>`;for(const tick of domain.ticks){const xx=x(tick);body+=`<line class="grid" x1="${xx}" x2="${xx}" y1="${T}" y2="${plotB}"/><text class="plot-tick" x="${xx}" y="${H-9}" text-anchor="middle">${tickLabel(tick)}</text>`}rows.forEach((row,index)=>{const y=T+(index+.5)*rowH,ci=row[ciKey],value=row[valueKey];body+=`<circle cx="8" cy="${y}" r="3.5" fill="${row.color}"/><text class="plot-label" x="17" y="${y+4}">${esc(row.name)}</text><line class="whisker" x1="${x(ci[0])}" x2="${x(ci[1])}" y1="${y}" y2="${y}"/><line class="whisker" x1="${x(ci[0])}" x2="${x(ci[0])}" y1="${y-4}" y2="${y+4}"/><line class="whisker" x1="${x(ci[1])}" x2="${x(ci[1])}" y1="${y-4}" y2="${y+4}"/><circle class="estimate" cx="${x(value)}" cy="${y}" r="5" fill="${row.color}"><title>${esc(row.name)}: ${label(value)}</title></circle><text class="plot-value" x="${W-3}" y="${y+4}" text-anchor="end">${label(value)}</text>`});return`<article class="metric-plot${wide?" metric-plot-wide":""}"><h3>${esc(title)}</h3><p>${esc(subtitle)}</p><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${body}</svg></article>`}
function costPerformancePlot(rows){const W=940,H=430,L=72,R=24,T=20,B=54,plotB=H-B,xMax=Math.ceil(Math.max(...rows.map(row=>row.cost))/10)*10,domain=plotDomain(rows,"test_ci"),x=value=>L+value/xMax*(W-L-R),y=value=>T+(domain.hi-value)/(domain.hi-domain.lo)*(plotB-T),xTicks=ticks(0,xMax,niceStep(xMax/8)),yTicks=domain.ticks;let best=-Infinity;const frontier=[...rows].sort((a,b)=>a.cost-b.cost).filter(row=>{if(row.test<=best)return false;best=row.test;return true}),frontierKeys=new Set(frontier.map(row=>row.key));let body=`<rect class="plot-frame" x="${L}" y="${T}" width="${W-L-R}" height="${plotB-T}"/>`;for(const tick of xTicks){const xx=x(tick);body+=`<line class="grid" x1="${xx}" x2="${xx}" y1="${T}" y2="${plotB}"/><text class="plot-tick" x="${xx}" y="${plotB+20}" text-anchor="middle">$${Math.round(tick)}</text>`}for(const tick of yTicks){const yy=y(tick);body+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="plot-tick" x="${L-9}" y="${yy+4}" text-anchor="end">${tick.toFixed(2)}</text>`}body+=`<text class="cost-axis-title" x="${(L+W-R)/2}" y="${H-8}" text-anchor="middle">Mean model cost per task (USD)</text><text class="cost-axis-title" x="15" y="${(T+plotB)/2}" text-anchor="middle" transform="rotate(-90 15 ${(T+plotB)/2})">Hidden test AUARC</text><path class="cost-frontier" d="${frontier.map((row,index)=>`${index?"L":"M"}${x(row.cost)},${y(row.test)}`).join(" ")}"/>`;for(const row of rows)body+=`<g class="${frontierKeys.has(row.key)?"":"cost-dominated"}"><circle class="cost-point" cx="${x(row.cost)}" cy="${y(row.test)}" r="7" fill="${row.color}"><title>${esc(row.name)}: hidden test AUARC ${fmt(row.test)}, $${row.cost.toFixed(2)} per task</title></circle></g>`;const legend=rows.map(row=>`<span><i style="background:${row.color}"></i>${esc(row.name)}</span>`).join("");return`<article class="metric-plot metric-plot-wide"><h3>Hidden test AUARC versus model cost</h3><p>The line marks the Pareto frontier. Faded models cost more without scoring higher. Costs exclude compute and grading.</p><div class="cost-legend">${legend}</div><div class="cost-scroll"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Hidden test AUARC versus model cost">${body}</svg></div></article>`}
function renderAggregates(){const result=currentResults(),elo=[...result.rows].sort((a,b)=>b.elo-a.elo),test=[...result.rows].sort((a,b)=>b.test-a.test),final=[...result.rows].sort((a,b)=>b.final-a.final),validation=[...result.rows].sort((a,b)=>b.validation-a.validation),gap=[...result.rows].sort((a,b)=>a.gap-b.gap);document.getElementById("aggregate-plots").innerHTML=aggregatePlot("Task-relative Elo","The midpoint of the model ratings is 1000.",elo,"elo","elo_ci","integer",true)+costPerformancePlot(result.rows)+aggregatePlot("Hidden test AUARC","Raw mean across tasks",test,"test","test_ci")+aggregatePlot("Final hidden test","Checkpoint chosen by validation",final,"final","final_ci")+aggregatePlot("Validation AUARC","Raw mean across tasks",validation,"validation","validation_ci")+aggregatePlot("Relative validation to test gap","Lower is better",gap,"gap","gap_ci","percent");const leader=elo[0],runnerUp=elo[1],largestGap=gap[gap.length-1];document.getElementById("leader-score").textContent=Math.round(leader.elo);document.getElementById("leader-name").textContent=leader.name;document.getElementById("rho-score").textContent=`ρ = ${result.rho.toFixed(2)}`;document.getElementById("rho-range").textContent=`Validation AUARC and hidden test AUARC model ranks. The 95% interval is ${result.rho_ci[0].toFixed(2)} to ${result.rho_ci[1].toFixed(2)}.`;document.getElementById("result-notes").innerHTML=`<li>${esc(leader.name)} leads task-relative Elo at ${Math.round(leader.elo)}. ${esc(runnerUp.name)} follows at ${Math.round(runnerUp.elo)}. The rating midpoint is 1000.</li><li>Validation and hidden test ranks broadly agree at ρ = ${result.rho.toFixed(2)}, but ${esc(largestGap.name)} has the largest relative validation to test gap at ${pct(largestGap.gap)}.</li>`}
function renderCategories(){const svg=document.getElementById("taxonomy-wheel-svg"),title=document.getElementById("taxonomy-detail-title"),description=document.getElementById("taxonomy-detail-description"),count=document.getElementById("taxonomy-detail-count"),specimens=document.getElementById("taxonomy-detail-specimens");if(!svg||!title||!description||!count||!specimens)return;const ns="http://www.w3.org/2000/svg",cx=210,cy=210,inner=85,outer=164,point=(angle,radius)=>[cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius],arc=(start,end)=>{const[x1,y1]=point(start,outer),[x2,y2]=point(end,outer),[x3,y3]=point(end,inner),[x4,y4]=point(start,inner),large=end-start>Math.PI?1:0;return`M ${x1} ${y1} A ${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`},labelLines=name=>{if(name==="Algorithms and optimization")return["Algorithms","& optimization"];if(name==="Data engineering and curation")return["Data engineering","& curation"];if(name==="Evaluation, calibration, and robustness")return["Evaluation &","robustness"];if(name==="AI safety and alignment")return["AI safety &","alignment"];if(name==="Systems and efficiency")return["Systems &","efficiency"];return name.split(" ").length>1?[name.split(" ")[0],name.split(" ").slice(1).join(" ")]:[name]},groups=[];function addText(className,x,y,value){const text=document.createElementNS(ns,"text");text.setAttribute("class",className);text.setAttribute("x",x);text.setAttribute("y",y);text.textContent=value;svg.appendChild(text)}function pick(index){const item=CATEGORIES[index];groups.forEach((group,i)=>{group.classList.toggle("is-active",i===index);group.classList.toggle("is-muted",i!==index);group.setAttribute("aria-pressed",String(i===index))});title.textContent=item.name;description.textContent=item.description;count.textContent=`${item.count} ${item.count===1?"task":"tasks"}`;specimens.replaceChildren(...item.specimens.map(specimen=>{const entry=document.createElement("li");entry.textContent=specimen;return entry}))}CATEGORIES.forEach((item,index)=>{const start=-Math.PI/2+index*(Math.PI*2/CATEGORIES.length)+.018,end=-Math.PI/2+(index+1)*(Math.PI*2/CATEGORIES.length)-.018,mid=(start+end)/2,group=document.createElementNS(ns,"g"),path=document.createElementNS(ns,"path"),label=document.createElementNS(ns,"text"),[tx,ty]=point(mid,124),lines=labelLines(item.name);group.classList.add("wheel-segment");group.setAttribute("role","button");group.setAttribute("tabindex","0");group.setAttribute("aria-label",`${item.name}, ${item.count} ${item.count===1?"task":"tasks"}`);group.setAttribute("aria-pressed","false");path.setAttribute("d",arc(start,end));path.setAttribute("fill",item.color);label.setAttribute("class","wheel-label");label.setAttribute("x",tx);label.setAttribute("y",ty-(lines.length-1)*6);lines.forEach((line,lineIndex)=>{const span=document.createElementNS(ns,"tspan");span.setAttribute("x",tx);span.setAttribute("dy",lineIndex===0?0:12);span.textContent=line;label.appendChild(span)});group.append(path,label);group.addEventListener("mouseenter",()=>pick(index));group.addEventListener("focus",()=>pick(index));group.addEventListener("click",()=>pick(index));group.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();pick(index)}});svg.appendChild(group);groups.push(group)});const center=document.createElementNS(ns,"circle");center.setAttribute("class","wheel-center");center.setAttribute("cx",cx);center.setAttribute("cy",cy);center.setAttribute("r",inner-7);svg.appendChild(center);addText("wheel-center-kicker",cx,cy-18,"AUTORESEARCHBENCH");addText("wheel-center-title",cx,cy+10,"Task taxonomy");addText("wheel-center-note",cx,cy+31,"29 preview tasks");pick(0);svg.addEventListener("mouseleave",()=>pick(0))}
let hiddenModels=new Set(),activeTask=0;
function taskDomain(stats,key){const values=stats.flatMap(stat=>stat.points.map(point=>point[key]).filter(Number.isFinite)),positive=values.filter(value=>value>0);if(!positive.length)return{lo:0,hi:1,ticks:[0,.2,.4,.6,.8,1],broken:false};const max=Math.max(...positive),endpoints=stats.map(stat=>stat.points.map(point=>point[key]).filter(Number.isFinite).at(-1)).filter(value=>value>0).sort((a,b)=>a-b);let anchor=endpoints[0]||Math.min(...positive);if(endpoints.length>2){const firstGap=endpoints[1]-endpoints[0],other=endpoints.slice(2).map((value,index)=>value-endpoints[index+1]),typical=quantile(other,.5);if(firstGap>Math.max(typical*2,.02))anchor=endpoints[1]}const step=niceStep(Math.max(max-anchor,.01)/5),floorValue=Math.min(anchor,quantile(positive,.025));let lo=Math.floor(floorValue/step)*step-step;if(lo<=0)lo=step;let hi=Math.min(1,Math.ceil(max/step)*step);if(hi-lo<step*3)hi=Math.min(1,hi+step);return{lo,hi:hi===lo?Math.min(1,lo+step):hi,ticks:ticks(lo,hi,step),broken:lo>0}}
function taskChart(task,title,key){const stats=taskStats(task).filter(stat=>stat.points.length&&!hiddenModels.has(stat.key)),domain=taskDomain(stats,key),W=620,H=338,L=62,R=12,T=12,plotB=267,railTop=229,kinkTop=241,maxHours=Math.max(1,...stats.map(stat=>stat.hours)),x=value=>L+value/maxHours*(W-L-R),y=value=>domain.broken?(value<domain.lo?plotB-(Math.max(0,value)/domain.lo)*(plotB-railTop):T+(domain.hi-value)/(domain.hi-domain.lo)*(railTop-T)):T+(domain.hi-value)/(domain.hi-domain.lo)*(plotB-T);let body=`<text class="tick" x="${(L+W-R)/2}" y="330" text-anchor="middle">Hours</text><text class="tick" x="13" y="${(T+plotB)/2}" text-anchor="middle" transform="rotate(-90 13 ${(T+plotB)/2})">Score</text><line class="axis" x1="${L}" x2="${L}" y1="${T}" y2="${plotB}"/>`;for(const value of domain.ticks){const yy=y(value);body+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="tick" x="${L-7}" y="${yy+3}" text-anchor="end">${value.toFixed(2)}</text>`}if(domain.broken)body+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${plotB}" y2="${plotB}"/><text class="tick" x="${L-7}" y="${plotB+3}" text-anchor="end">0</text><rect x="${L-7}" y="${kinkTop-2}" width="14" height="18" fill="#fff"/><path class="axis-break" d="M${L-6} ${kinkTop-1}L${L+6} ${kinkTop+4}L${L-6} ${kinkTop+9}L${L+6} ${kinkTop+14}"/>`;const hourStep=maxHours<=6?1:maxHours<=12?2:4;for(const value of ticks(0,maxHours,hourStep))body+=`<text class="tick" x="${x(value)}" y="303" text-anchor="middle">${Math.round(value)}</text>`;body+=`<line class="axis" x1="${L}" x2="${W-R}" y1="${plotB}" y2="${plotB}"/>`;for(const stat of stats){const points=stat.points.filter(point=>point[key]!=null),color=MODEL[stat.key].color;if(!points.length)continue;let path=`M${x(points[0].seconds/3600)} ${y(points[0][key])}`;for(let i=1;i<points.length;i++)path+=`L${x(points[i].seconds/3600)} ${y(points[i-1][key])}L${x(points[i].seconds/3600)} ${y(points[i][key])}`;path+=`L${x(stat.hours)} ${y(points.at(-1)[key])}`;body+=`<path class="curve" stroke="${color}" d="${path}"/>`;for(const point of points)body+=`<circle class="point" fill="${color}" cx="${x(point.seconds/3600)}" cy="${y(point[key])}" r="2.5"><title>${esc(MODEL[stat.key].name)}, ${(point.seconds/3600).toFixed(1)} hours: ${fmt(point[key])}</title></circle>`}return`<div class="chart-card"><h4>${esc(title)}</h4><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${body}</svg></div>`}
function renderTask(index){activeTask=index;const select=document.querySelector("#task-tabs select");if(select)select.value=String(index);const task=DATA.tasks[index],legend=ORDER.map(key=>`<button class="${hiddenModels.has(key)?"off":""}" data-model="${key}"><span class="swatch" style="background:${MODEL[key].color}"></span>${esc(MODEL[key].name)}</button>`).join("");document.getElementById("task-view").innerHTML=`<article class="task-view"><span class="task-kicker">${esc(task.compute)}</span><h3>${esc(task.name)}</h3><div class="legend">${legend}</div><section class="scale-block"><div class="charts">${taskChart(task,"Best validation score so far","bestValidation")}${taskChart(task,"Hidden test score at that checkpoint","testAtBest")}</div></section></article>`;document.querySelectorAll(".legend button").forEach(button=>button.addEventListener("click",()=>{const key=button.dataset.model;hiddenModels.has(key)?hiddenModels.delete(key):hiddenModels.add(key);renderTask(activeTask)}))}
function renderTasks(){const tabs=document.getElementById("task-tabs");tabs.innerHTML=`<select aria-label="Task">${DATA.tasks.map((task,index)=>`<option value="${index}">${esc(task.name)}</option>`).join("")}</select>`;tabs.querySelector("select").addEventListener("change",event=>{hiddenModels.clear();renderTask(Number(event.target.value))});renderTask(0)}
function renderCategories(){
  const svg=document.getElementById("taxonomy-wheel-svg"),title=document.getElementById("taxonomy-detail-title"),description=document.getElementById("taxonomy-detail-description"),count=document.getElementById("taxonomy-detail-count"),specimens=document.getElementById("taxonomy-detail-specimens");
  if(!svg||!title||!description||!count||!specimens)return;
  const ns="http://www.w3.org/2000/svg",cx=210,cy=210,inner=85,outer=164,point=(angle,radius)=>[cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius],arc=(start,end)=>{const startOuter=point(start,outer),endOuter=point(end,outer),endInner=point(end,inner),startInner=point(start,inner),large=end-start>Math.PI?1:0;return "M "+startOuter[0]+" "+startOuter[1]+" A "+outer+" "+outer+" 0 "+large+" 1 "+endOuter[0]+" "+endOuter[1]+" L "+endInner[0]+" "+endInner[1]+" A "+inner+" "+inner+" 0 "+large+" 0 "+startInner[0]+" "+startInner[1]+" Z"},labelLines=name=>{if(name==="Algorithms and optimization")return["Algorithms","& optimization"];if(name==="Data engineering and curation")return["Data engineering","& curation"];if(name==="Evaluation, calibration, and robustness")return["Evaluation &","robustness"];if(name==="AI safety and alignment")return["AI safety &","alignment"];if(name==="Systems and efficiency")return["Systems &","efficiency"];return name.split(" ").length>1?[name.split(" ")[0],name.split(" ").slice(1).join(" ")]:[name]},groups=[],taskLabel=item=>item.count+" "+(item.count===1?"task":"tasks");
  function addText(className,x,y,value){const text=document.createElementNS(ns,"text");text.setAttribute("class",className);text.setAttribute("x",x);text.setAttribute("y",y);text.textContent=value;svg.appendChild(text)}
  function openTaskBrowser(categoryIndex,taskName){document.dispatchEvent(new CustomEvent(taskName?"taxonomy-task-selected":"taxonomy-category-selected",{detail:taskName?{categoryIndex,taskName}:{categoryIndex}}));document.getElementById("examples")?.scrollIntoView({behavior:"smooth",block:"start"})}
  function pick(index){
    const item=CATEGORIES[index];
    groups.forEach((group,groupIndex)=>{group.classList.toggle("is-active",groupIndex===index);group.classList.toggle("is-muted",groupIndex!==index);group.setAttribute("aria-pressed",String(groupIndex===index))});
    title.textContent=item.name;
    description.textContent=item.description;
    count.textContent=taskLabel(item);
    specimens.replaceChildren(...item.specimens.map(taskName=>{const entry=document.createElement("li"),button=document.createElement("button");button.type="button";button.textContent=taskName;button.addEventListener("click",()=>openTaskBrowser(index,taskName));entry.appendChild(button);return entry}));
  }
  CATEGORIES.forEach((item,index)=>{
    const start=-Math.PI/2+index*(Math.PI*2/CATEGORIES.length)+.018,end=-Math.PI/2+(index+1)*(Math.PI*2/CATEGORIES.length)-.018,mid=(start+end)/2,group=document.createElementNS(ns,"g"),path=document.createElementNS(ns,"path"),label=document.createElementNS(ns,"text"),labelPoint=point(mid,124),lines=labelLines(item.name);
    group.classList.add("wheel-segment");group.setAttribute("role","button");group.setAttribute("tabindex","0");group.setAttribute("aria-label",item.name+", "+taskLabel(item));group.setAttribute("aria-pressed","false");
    path.setAttribute("d",arc(start,end));path.setAttribute("fill",item.color);
    label.setAttribute("class","wheel-label");label.setAttribute("x",labelPoint[0]);label.setAttribute("y",labelPoint[1]-(lines.length-1)*6);
    lines.forEach((line,lineIndex)=>{const span=document.createElementNS(ns,"tspan");span.setAttribute("x",labelPoint[0]);span.setAttribute("dy",lineIndex===0?0:12);span.textContent=line;label.appendChild(span)});
    group.append(path,label);group.addEventListener("mouseenter",()=>pick(index));group.addEventListener("focus",()=>pick(index));group.addEventListener("click",()=>{pick(index);openTaskBrowser(index)});group.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();pick(index);openTaskBrowser(index)}});
    svg.appendChild(group);groups.push(group);
  });
  const center=document.createElementNS(ns,"circle");center.setAttribute("class","wheel-center");center.setAttribute("cx",cx);center.setAttribute("cy",cy);center.setAttribute("r",inner-7);svg.appendChild(center);
  addText("wheel-center-kicker",cx,cy-18,"AUTORESEARCHBENCH");addText("wheel-center-title",cx,cy+10,"Task taxonomy");addText("wheel-center-note",cx,cy+31,"29 preview tasks");
  pick(0);
}

let activeCategory=0;
function renderTasks(){
  const categoryTabs=document.getElementById("task-category-tabs"),taskOptions=document.getElementById("task-options");
  if(!categoryTabs||!taskOptions)return;
  const taskIndexForName=name=>DATA.tasks.findIndex(task=>task.name===name);
  function selectCategory(categoryIndex,taskName){
    activeCategory=categoryIndex;
    const category=CATEGORIES[activeCategory],currentName=DATA.tasks[activeTask]?.name,selectedName=taskName&&category.specimens.includes(taskName)?taskName:category.specimens.includes(currentName)?currentName:category.specimens[0],selectedIndex=taskIndexForName(selectedName);
    if(selectedIndex<0)return;
    activeTask=selectedIndex;
    categoryTabs.replaceChildren(...CATEGORIES.map((item,index)=>{const button=document.createElement("button");button.type="button";button.setAttribute("role","tab");button.setAttribute("aria-selected",String(index===activeCategory));button.style.setProperty("--category-color",item.color);button.textContent=item.name;button.addEventListener("click",()=>{hiddenModels.clear();selectCategory(index)});return button}));
    taskOptions.replaceChildren(...category.specimens.map((name,index)=>{const taskIndex=taskIndexForName(name),button=document.createElement("button");button.type="button";button.setAttribute("role","option");button.setAttribute("aria-selected",String(taskIndex===activeTask));button.setAttribute("data-task-number",String(index+1).padStart(2,"0"));button.style.setProperty("--category-color",category.color);button.textContent=name;button.addEventListener("click",()=>{hiddenModels.clear();selectCategory(activeCategory,name)});return button}));
    renderTask(activeTask);
  }
  document.addEventListener("taxonomy-category-selected",event=>{const categoryIndex=Number(event.detail?.categoryIndex);if(Number.isInteger(categoryIndex)&&CATEGORIES[categoryIndex]){hiddenModels.clear();selectCategory(categoryIndex)}});
  document.addEventListener("taxonomy-task-selected",event=>{const categoryIndex=Number(event.detail?.categoryIndex),taskName=event.detail?.taskName;if(Number.isInteger(categoryIndex)&&CATEGORIES[categoryIndex]&&typeof taskName==="string"){hiddenModels.clear();selectCategory(categoryIndex,taskName)}});
  selectCategory(0);
}

const ROLLOUT_INSIGHTS=window.ARB_ROLLOUT_INSIGHTS||{};
const ROLLOUT_INSIGHT_SOURCE=window.ARB_ROLLOUT_INSIGHT_SOURCE||"";
const ROLLOUT_MOMENTS=window.ARB_ROLLOUT_MOMENTS||{};
const RAW_SCORE_MAPS=window.ARB_RAW_SCORE_MAPS||{};
const DIFFICULTY_REWARD_MAPS=window.ARB_DIFFICULTY_REWARD_MAPS||{};
let chartMode="reported";

function rolloutMoment(task,model,iteration){
  const moment=ROLLOUT_MOMENTS[task.name];
  return moment&&moment.model===model&&moment.iteration===iteration?moment:null;
}

function chartSplit(key){return key==="bestValidation"?"intermediate":"final"}
function rawScoreMap(task){return RAW_SCORE_MAPS[task.name]||null}
function difficultyRewardMap(task){return DIFFICULTY_REWARD_MAPS[task.name]||null}
function plotValue(task,key,point){
  if(chartMode==="reported")return point[key];
  const rawMap=rawScoreMap(task),raw=rawMap?.invert(point[key],chartSplit(key))??null;
  if(chartMode==="raw")return raw;
  if(raw==null)return point[key]===0?0:null;
  return difficultyRewardMap(task)?.score(raw,chartSplit(key))??null;
}
function rawScoreFormat(value,map){
  if(value==null||!Number.isFinite(value))return"n/a";
  const precision=map?.precision??3;
  const adjustedPrecision=Math.abs(value)>0&&Math.abs(value)<.01?Math.max(precision,4):precision;
  return value.toFixed(adjustedPrecision);
}
function rawScoreDomain(stats,task,key){
  const values=stats.flatMap(stat=>stat.points.map(point=>plotValue(task,key,point)).filter(Number.isFinite));
  if(!values.length)return{lo:0,hi:1,ticks:[0,.2,.4,.6,.8,1],broken:false};
  const min=Math.min(...values),max=Math.max(...values),spread=Math.max(max-min,Math.abs(max)*.04,.01),step=niceStep(spread/5);
  let lo=Math.floor((min-spread*.08)/step)*step,hi=Math.ceil((max+spread*.08)/step)*step;
  if(lo===hi){lo-=step;hi+=step}
  return{lo,hi,ticks:ticks(lo,hi,step),broken:false};
}
function difficultyRewardDomain(stats,task,key){
  return taskDomain(stats.map(stat=>({points:stat.points.map(point=>({[key]:plotValue(task,key,point)}))})),key);
}

function taskChart(task,title,key){
  const stats=taskStats(task).filter(stat=>stat.points.length&&!hiddenModels.has(stat.key));
  if(!stats.length)return`<div class="chart-card"><h4>${esc(title)}</h4><p class="plot-note">Choose at least one model to show this chart.</p></div>`;
  const map=rawScoreMap(task),difficultyMap=difficultyRewardMap(task),domain=chartMode==="raw"?rawScoreDomain(stats,task,key):chartMode==="difficulty"?difficultyRewardDomain(stats,task,key):taskDomain(stats,key),W=620,H=338,L=62,R=12,T=12,plotB=267,railTop=229,kinkTop=241,maxHours=Math.max(1,...stats.map(stat=>stat.hours)),x=value=>L+value/maxHours*(W-L-R),y=value=>domain.broken?(value<domain.lo?plotB-(Math.max(0,value)/domain.lo)*(plotB-railTop):T+(domain.hi-value)/(domain.hi-domain.lo)*(railTop-T)):T+(domain.hi-value)/(domain.hi-domain.lo)*(plotB-T),axisLabel=chartMode==="raw"?map?.label||"Raw metric":chartMode==="difficulty"?"Difficulty-adjusted reward":"Reported reward",formatValue=value=>chartMode==="raw"?rawScoreFormat(value,map):fmt(value);
  let body=`<text class="tick" x="${(L+W-R)/2}" y="330" text-anchor="middle">Hours</text><text class="tick" x="13" y="${(T+plotB)/2}" text-anchor="middle" transform="rotate(-90 13 ${(T+plotB)/2})">${esc(axisLabel)}</text><line class="axis" x1="${L}" x2="${L}" y1="${T}" y2="${plotB}"/>`;
  for(const value of domain.ticks){const yy=y(value);body+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="tick" x="${L-7}" y="${yy+3}" text-anchor="end">${formatValue(value)}</text>`}
  if(domain.broken)body+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${plotB}" y2="${plotB}"/><text class="tick" x="${L-7}" y="${plotB+3}" text-anchor="end">0</text><rect x="${L-7}" y="${kinkTop-2}" width="14" height="18" fill="#fff"/><path class="axis-break" d="M${L-6} ${kinkTop-1}L${L+6} ${kinkTop+4}L${L-6} ${kinkTop+9}L${L+6} ${kinkTop+14}"/>`;
  const hourStep=maxHours<=6?1:maxHours<=12?2:4;
  for(const value of ticks(0,maxHours,hourStep))body+=`<text class="tick" x="${x(value)}" y="303" text-anchor="middle">${Math.round(value)}</text>`;
  body+=`<line class="axis" x1="${L}" x2="${W-R}" y1="${plotB}" y2="${plotB}"/>`;
  for(const stat of stats){
    const points=stat.points.map(point=>({...point,plot:plotValue(task,key,point)})).filter(point=>point.plot!=null),color=MODEL[stat.key].color;
    if(!points.length)continue;
    let path=`M${x(points[0].seconds/3600)} ${y(points[0].plot)}`;
    for(let index=1;index<points.length;index++)path+=`L${x(points[index].seconds/3600)} ${y(points[index-1].plot)}L${x(points[index].seconds/3600)} ${y(points[index].plot)}`;
    path+=`L${x(stat.hours)} ${y(points.at(-1).plot)}`;
    body+=`<path class="curve" stroke="${color}" d="${path}"/>`;
    for(const point of points){
      const hours=point.seconds/3600,moment=rolloutMoment(task,stat.key,point.iteration),markerLabel=`${MODEL[stat.key].name}, iteration ${point.iteration}, ${hours.toFixed(1)} hours`;
      body+=`<circle class="point" fill="${color}" cx="${x(hours)}" cy="${y(point.plot)}" r="2.5"><title>${esc(MODEL[stat.key].name)}, ${hours.toFixed(1)} hours: ${esc(axisLabel)} ${formatValue(point.plot)}</title></circle>`;
      if(moment)body+=`<g class="insight-marker" role="button" tabindex="0" data-model="${esc(stat.key)}" data-iteration="${point.iteration}" data-hours="${hours.toFixed(1)}" data-score="${formatValue(point.plot)}" data-chart-title="${esc(title)}" data-note="${esc(moment.note)}" data-metric="${esc(moment.metric||"")}" data-source="${esc(moment.source)}" aria-label="Show verified rollout moment for ${esc(markerLabel)}"><circle class="insight-halo" cx="${x(hours)}" cy="${y(point.plot)}" r="6.5"/><circle class="insight-center" fill="${color}" cx="${x(hours)}" cy="${y(point.plot)}" r="3.1"/><title>Verified rollout moment: ${esc(markerLabel)}</title></g>`;
    }
  }
  return`<div class="chart-card"><h4>${esc(title)}</h4><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${body}</svg></div>`;
}

function updateRolloutInsight(marker,task){
  const panel=document.getElementById("rollout-insight");
  if(!panel)return;
  const model=MODEL[marker.dataset.model]?.name||marker.dataset.model;
  panel.querySelector(".rollout-insight-run").textContent=`${model}, iteration ${marker.dataset.iteration}, ${marker.dataset.hours} hours. ${marker.dataset.chartTitle}: ${marker.dataset.score}.`;
  panel.querySelector(".rollout-insight-note").textContent=marker.dataset.note;
  const metric=panel.querySelector(".rollout-insight-metric");
  metric.hidden=!marker.dataset.metric;
  metric.textContent=marker.dataset.metric;
  const source=panel.querySelector(".rollout-insight-source a");
  source.href=marker.dataset.source;
}

function renderTask(index){
  activeTask=index;
  const task=DATA.tasks[index],map=rawScoreMap(task),difficultyMap=difficultyRewardMap(task),insight=ROLLOUT_INSIGHTS[task.name],moment=ROLLOUT_MOMENTS[task.name],legend=ORDER.map(key=>`<button class="${hiddenModels.has(key)?"off":""}" data-model="${key}"><span class="swatch" style="background:${MODEL[key].color}"></span>${esc(MODEL[key].name)}</button>`).join(""),patternSource=ROLLOUT_INSIGHT_SOURCE?`<p class="rollout-pattern-source"><a href="${esc(ROLLOUT_INSIGHT_SOURCE)}" target="_blank" rel="noreferrer">Read the rollout index.</a></p>`:"",visibleTitle=chartMode==="raw"?"Best visible raw metric so far":chartMode==="difficulty"?"Best visible difficulty-adjusted reward so far":"Best visible reported reward so far",hiddenTitle=chartMode==="raw"?"Hidden-test raw metric at that checkpoint":chartMode==="difficulty"?"Hidden-test difficulty-adjusted reward at that checkpoint":"Hidden-test reported reward at that checkpoint",plotNote=chartMode==="raw"?`The curves reconstruct the raw ${esc(map?.label||"task metric")} by inverting the published reward map. Zero reward is not uniquely invertible: it can mean an invalid result or one at or below the baseline, so those points are omitted.`:chartMode==="difficulty"?`Counterfactual comparison only. ${esc(difficultyMap?.kind||"Task-specific")} map: ${esc(difficultyMap?.summary||"The reported reward is unchanged.")} The plotted reward is recomputed from the recovered raw metric; Horizon's reported reward is not changed.`:"The curves show Horizon's reported scaled rewards. Use the other views to compare the underlying raw metric and a difficulty-aware counterfactual rescaling.";
  const momentBlock=moment?`<aside class="rollout-insight" id="rollout-insight" aria-live="polite"><span class="rollout-insight-kicker">One verified rollout</span><h4>What this experiment tried</h4><p class="rollout-insight-run">The highlighted rings are the same ${esc(MODEL[moment.model].name)} experiment in the two score panels. Hover or focus either ring for its record.</p><p class="rollout-insight-note">${esc(moment.note)}</p><p class="rollout-insight-metric"${moment.metric?"":" hidden"}>${esc(moment.metric||"")}</p><p class="rollout-insight-source"><a href="${esc(moment.source)}" target="_blank" rel="noreferrer">Open the source rollout.</a></p></aside>`:"";
  const patternBlock=insight?`<aside class="rollout-pattern"><span class="rollout-insight-kicker">Pattern across rollouts</span><p>${esc(insight)}</p><p class="rollout-pattern-note">This is a task-level synthesis, not a claim about any one model or iteration.</p>${patternSource}</aside>`:"";
  document.getElementById("task-view").innerHTML=`<article class="task-view"><span class="task-kicker">${esc(task.compute)}</span><h3>${esc(task.name)}</h3><div class="legend">${legend}</div>${momentBlock}${patternBlock}<section class="scale-block"><div class="chart-mode" role="group" aria-label="Chart value"><span>Chart value:</span><button type="button" data-chart-mode="reported" aria-pressed="${chartMode==="reported"}">Reported reward</button><button type="button" data-chart-mode="difficulty" aria-pressed="${chartMode==="difficulty"}"${difficultyMap?"":" disabled"}>Difficulty-adjusted</button><button type="button" data-chart-mode="raw" aria-pressed="${chartMode==="raw"}"${map?"":" disabled"}>Raw metric</button></div><p class="plot-note">${plotNote}</p><div class="charts">${taskChart(task,visibleTitle,"bestValidation")}${taskChart(task,hiddenTitle,"testAtBest")}</div></section></article>`;
  document.querySelectorAll(".legend button").forEach(button=>button.addEventListener("click",()=>{const key=button.dataset.model;hiddenModels.has(key)?hiddenModels.delete(key):hiddenModels.add(key);renderTask(activeTask)}));
  document.querySelectorAll("[data-chart-mode]").forEach(button=>button.addEventListener("click",()=>{chartMode=button.dataset.chartMode;renderTask(activeTask)}));
  document.querySelectorAll(".insight-marker").forEach(marker=>{
    const show=()=>updateRolloutInsight(marker,task);
    marker.addEventListener("mouseenter",show);marker.addEventListener("focus",show);marker.addEventListener("click",show);
    marker.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();show()}});
  });
}

renderTrajectoryOverview();renderAggregates();renderCategories();renderTasks();
