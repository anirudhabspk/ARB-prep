(()=>{
  const target=document.getElementById("opsd-hint-experiment"),data=window.OPSD_HINT_DATA;
  if(!target||!data)return;

  const esc=value=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const median=values=>{
    if(!Array.isArray(values)||!values.length)return null;
    const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
    return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
  };
  const delta=(from,to)=>Number.isFinite(from)&&Number.isFinite(to)?to-from:null;
  const fmt=value=>Number.isFinite(value)?value.toFixed(3):"n/a";
  const deltaFmt=value=>!Number.isFinite(value)?"n/a":`${value>=0?"+":"−"}${Math.abs(value).toFixed(3)}`;
  const axisFmt=value=>Math.abs(value)<1e-9?"0":`${value<0?"−":""}${Math.abs(value).toFixed(1)}`;
  const baseSlug=key=>key.replace(/^p?\d{4}-\d{5}-/,"");
  const catalog=new Map((window.ARB_TASK_CATALOG||[]).map(task=>[task.slug,task]));
  const benchmarkTasks=new Map((window.ARB_DATA?.tasks||[]).map(task=>[task.name,task]));
  const displayName=task=>catalog.get(baseSlug(task.key))?.blogName||task.key.replace(/^p?\d{4}-\d{5}-/,"").replace(/-/g," ");
  const shortName=task=>{
    const key=task.key;
    if(key.includes("grpo"))return"GRPO";
    if(key.includes("causalpfn"))return"CausalPFN";
    if(key.includes("coreset"))return"Coreset";
    if(key.includes("label-efficient"))return"Label-efficient";
    return displayName(task);
  };
  const stats=data.tasks.map(task=>{
    const museFair=median(task.fairGranola),museVal=median(task.valGranola),opusFair=median(task.fairLumen),opusVal=median(task.valLumen);
    const museNone=task.noneGranola?.scores||[];
    const name=displayName(task),baselineRun=benchmarkTasks.get(name)?.models?.find(run=>run.model==="lumen"),opusNoHint=baselineRun?.points?.at(-1)?.testAtBest,museNoHint=median(museNone);
    return{...task,name,short:shortName(task),museNone,museFair,museVal,opusFair,opusVal,opusNoHint,museNoHint,muse:delta(museFair,museVal),opus:delta(opusFair,opusVal)};
  });
  const paired=stats.filter(task=>Number.isFinite(task.muse)&&Number.isFinite(task.opus));
  const scatterConfigs=[
    {id:"opus-fair",model:"Claude Opus 5",hint:"Fair hint",color:"#21636a",shape:"square",rows:stats.filter(task=>Number.isFinite(task.opusNoHint)&&Number.isFinite(task.opusFair)),baseline:task=>task.opusNoHint,hinted:task=>task.opusFair,count:task=>task.fairLumen.length,baselineLabel:"Standard 24-hour unhinted Terminus"},
    {id:"opus-val",model:"Claude Opus 5",hint:"Validation hint",color:"#c83220",shape:"circle",rows:stats.filter(task=>Number.isFinite(task.opusNoHint)&&Number.isFinite(task.opusVal)),baseline:task=>task.opusNoHint,hinted:task=>task.opusVal,count:task=>task.valLumen.length,baselineLabel:"Standard 24-hour unhinted Terminus"},
    {id:"muse-fair",model:"MuseSpark 1.3",hint:"Fair hint",color:"#21636a",shape:"square",rows:stats.filter(task=>Number.isFinite(task.museNoHint)&&Number.isFinite(task.museFair)),baseline:task=>task.museNoHint,hinted:task=>task.museFair,count:task=>task.fairGranola.length,baselineLabel:"Unhinted Terminus"},
    {id:"muse-val",model:"MuseSpark 1.3",hint:"Validation hint",color:"#c83220",shape:"circle",rows:stats.filter(task=>Number.isFinite(task.museNoHint)&&Number.isFinite(task.museVal)),baseline:task=>task.museNoHint,hinted:task=>task.museVal,count:task=>task.valGranola.length,baselineLabel:"Unhinted Terminus"}
  ];

  function chart(){
    const W=680,H=448,L=76,R=22,T=24,B=64,domain=.35,plotW=W-L-R,plotH=H-T-B;
    const x=value=>L+(value+domain)/(2*domain)*plotW;
    const y=value=>T+(domain-value)/(2*domain)*plotH;
    const ticks=[-.3,-.2,-.1,0,.1,.2,.3],noise=.04;
    const labels={
      "grpo-rl-halfcheetah-advantage-estimator":{text:"GRPO",dx:11,dy:-8},
      "causalpfn-cate-pehe-ihdp-surfaceb":{text:"CausalPFN",dx:10,dy:-8},
      "coreset-selection-group-robust-waterbirds":{text:"Coreset",dx:10,dy:-8},
      "2508-09093-label-efficient-risk-estimator":{text:"Label-efficient",dx:10,dy:15}
    };
    let body=`<title>Change in score from a fair hint to an unrestricted hint, by task and model</title><desc>Each task is a point. Horizontal position is MuseSpark 1.3's change and vertical position is Claude Opus 5's change. The grey square indicates changes within 0.04 of zero on both axes.</desc><rect class="opsd-plot-frame" x="${L}" y="${T}" width="${plotW}" height="${plotH}"/><rect class="opsd-noise-band" x="${x(-noise)}" y="${y(noise)}" width="${x(noise)-x(-noise)}" height="${y(-noise)-y(noise)}"/>`;
    for(const tick of ticks){
      const xx=x(tick),yy=y(tick),zero=tick===0;
      body+=`<line class="${zero?"opsd-zero-line":"opsd-grid"}" x1="${xx}" x2="${xx}" y1="${T}" y2="${H-B}"/><line class="${zero?"opsd-zero-line":"opsd-grid"}" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="opsd-tick" x="${xx}" y="${H-B+20}" text-anchor="middle">${axisFmt(tick)}</text><text class="opsd-tick" x="${L-9}" y="${yy+3.5}" text-anchor="end">${axisFmt(tick)}</text>`;
    }
    body+=`<text class="opsd-zone-label" x="${x(-.32)}" y="${y(.31)}">Opus gains · MuseSpark loses</text><text class="opsd-zone-label" x="${x(.32)}" y="${y(.31)}" text-anchor="end">Val hint helps both</text><text class="opsd-noise-label" x="${x(noise)+6}" y="${y(noise)-7}">±0.04 noise band</text><text class="opsd-axis-title" x="${(L+W-R)/2}" y="${H-12}" text-anchor="middle">MuseSpark 1.3: val hint − fair hint</text><text class="opsd-axis-title" x="16" y="${(T+H-B)/2}" text-anchor="middle" transform="rotate(-90 16 ${(T+H-B)/2})">Claude Opus 5: val hint − fair hint</text>`;
    for(const task of paired){
      const key=task.key,label=labels[key],interaction=task.muse*task.opus<0&&Math.max(Math.abs(task.muse),Math.abs(task.opus))>=noise,insideNoise=Math.abs(task.muse)<noise&&Math.abs(task.opus)<noise,fill=interaction?"#c83220":insideNoise?"#999b96":"#21636a",cx=x(task.muse),cy=y(task.opus),tipX=100*cx/W,tipY=100*cy/H;
      const aria=`${task.name}. MuseSpark change ${deltaFmt(task.muse)}; Claude Opus 5 change ${deltaFmt(task.opus)}.`;
      body+=`<g class="opsd-point${interaction?" is-interaction":""}${insideNoise?" is-noise":""}" data-opsd-point tabindex="0" role="img" aria-label="${esc(aria)}" data-name="${esc(task.name)}" data-muse-fair="${fmt(task.museFair)}" data-muse-val="${fmt(task.museVal)}" data-muse-delta="${deltaFmt(task.muse)}" data-muse-n="${task.fairGranola.length}/${task.valGranola.length}" data-opus-fair="${fmt(task.opusFair)}" data-opus-val="${fmt(task.opusVal)}" data-opus-delta="${deltaFmt(task.opus)}" data-opus-n="${task.fairLumen.length}/${task.valLumen.length}" data-tip-x="${tipX}" data-tip-y="${tipY}"><circle class="opsd-hit" cx="${cx}" cy="${cy}" r="12"/><circle class="opsd-dot" cx="${cx}" cy="${cy}" r="4.8" fill="${fill}"/><title>${esc(aria)}</title></g>`;
      if(label)body+=`<text class="opsd-point-label" x="${cx+label.dx}" y="${cy+label.dy}">${label.text}</text>`;
    }
    return`<div class="opsd-chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Task-level interaction between model and hint type">${body}</svg><div class="opsd-tooltip" role="tooltip" hidden></div></div>`;
  }

  function hintScatter(config){
    const W=680,H=430,L=68,R=20,T=20,B=60,plotW=W-L-R,plotH=H-T-B;
    const x=value=>L+value*plotW;
    const y=value=>H-B-value*plotH;
    const ticks=[0,.2,.4,.6,.8,1];
    let body=`<title>${esc(config.model)} ${esc(config.hint)} score compared with unhinted Terminus score</title><desc>Each marker represents one task. The horizontal position is the unhinted Terminus score. The vertical position is the score with a ${config.hint.toLowerCase()}.</desc><rect class="opsd-plot-frame" x="${L}" y="${T}" width="${plotW}" height="${plotH}"/>`;
    for(const tick of ticks){
      const xx=x(tick),yy=y(tick);
      body+=`<line class="opsd-grid" x1="${xx}" x2="${xx}" y1="${T}" y2="${H-B}"/><line class="opsd-grid" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="opsd-tick" x="${xx}" y="${H-B+20}" text-anchor="middle">${axisFmt(tick)}</text><text class="opsd-tick" x="${L-9}" y="${yy+3.5}" text-anchor="end">${axisFmt(tick)}</text>`;
    }
    body+=`<line class="opsd-diagonal" x1="${x(0)}" y1="${y(0)}" x2="${x(1)}" y2="${y(1)}"/><text class="opsd-diagonal-label" x="${x(.73)}" y="${y(.77)}">same score</text><text class="opsd-axis-title" x="${(L+W-R)/2}" y="${H-12}" text-anchor="middle">Unhinted Terminus score</text><text class="opsd-axis-title" x="16" y="${(T+H-B)/2}" text-anchor="middle" transform="rotate(-90 16 ${(T+H-B)/2})">Hinted Terminus score</text>`;
    for(const task of config.rows){
      const baseline=config.baseline(task),hinted=config.hinted(task),cx=x(baseline),cy=y(hinted),tipX=100*cx/W,tipY=100*cy/H;
      const aria=`${task.name}, ${config.model}, ${config.hint}. Unhinted Terminus score ${fmt(baseline)}; hinted Terminus score ${fmt(hinted)}.`;
      const marker=config.shape==="square"?`<rect class="opsd-scatter-dot" x="${cx-4.25}" y="${cy-4.25}" width="8.5" height="8.5" fill="#fff" stroke="${config.color}" stroke-width="2"/>`:`<circle class="opsd-scatter-dot" cx="${cx}" cy="${cy}" r="4.7" fill="${config.color}" stroke="#fff" stroke-width="1.4"/>`;
      body+=`<g class="opsd-scatter-point" data-hint-scatter-point tabindex="0" role="img" aria-label="${esc(aria)}" data-scatter-id="${config.id}" data-name="${esc(task.name)}" data-model="${config.model}" data-arm="${config.hint}" data-baseline-label="${config.baselineLabel}" data-unhinted="${fmt(baseline)}" data-hinted="${fmt(hinted)}" data-n="${config.count(task)}" data-tip-x="${tipX}" data-tip-y="${tipY}"><circle class="opsd-hit" cx="${cx}" cy="${cy}" r="12"/>${marker}<title>${esc(aria)}</title></g>`;
    }
    return`<div class="opsd-chart-wrap opsd-hint-scatter-chart" data-hint-scatter-tooltip="${config.id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(config.model)} ${esc(config.hint)} versus unhinted Terminus task scores">${body}</svg><div class="opsd-tooltip" role="tooltip" hidden></div></div>`;
  }

  function scatterPanel(config){
    return`<figure class="opsd-scatter-panel"><figcaption><strong>${esc(config.model)}</strong><span>${esc(config.hint)} · ${config.rows.length} tasks</span></figcaption>${hintScatter(config)}</figure>`;
  }

  function modelCard({name,fair,val,count,color,note}){
    const change=val-fair;
    return`<article class="opsd-model-card" style="--opsd-model-color:${color}"><p class="opsd-model-name">${esc(name)}</p><div class="opsd-score-flow"><span><small>Fair hint</small><strong>${fmt(fair)}</strong></span><b aria-hidden="true">→</b><span><small>Val hint</small><strong>${fmt(val)}</strong></span></div><p class="opsd-delta">${deltaFmt(change)} <span>mean task-median score · ${count} tasks</span></p><p class="opsd-card-note">${esc(note)}</p></article>`;
  }

  const granola=data.summary["granola-plus"],lumen=data.summary.lumen,overlap=data.summary.unhinted_overlap_granola;
  target.innerHTML=`
    <div class="opsd-intro prose">
      <p>We use hints to ask whether these tasks reward the ability to <em>execute</em> a useful research idea, rather than merely discovering the right words. A <a href="https://github.com/bespokelabsai/AutoResearchBench-Preview-Tasks/commit/e0e520e">fair hint</a> gives only an insight that can be inferred from the task statement. A <a href="https://github.com/bespokelabsai/AutoResearchBench-Preview-Tasks/commit/d0d1eea">validation hint</a> can additionally name grader nuances or an exploit. Both are short blocks appended to the end of the task instruction.</p>
    </div>
    <div class="opsd-arm-key" aria-label="Hint arms"><span><i class="opsd-arm-fair"></i>Fair hint <small>deducible from the task</small></span><span><i class="opsd-arm-val"></i>Validation hint <small>unrestricted best hint</small></span></div>
    <section class="opsd-headline" aria-labelledby="opsd-headline-title">
      <div class="opsd-headline-copy"><p class="opsd-kicker">The headline is the interaction</p><h3 id="opsd-headline-title">A stronger hint helps only when the model can use it.</h3><p>The validation hint changes the two models differently. It is not evidence for a generic prompt boost: on several tasks, an approach that helps Opus 5 actively hurts MuseSpark.</p></div>
      <div class="opsd-model-cards">
        ${modelCard({name:"MuseSpark 1.3",fair:granola.fair_mean_of_task_medians,val:granola.val_mean_of_task_medians,count:granola.n_tasks,color:"#21636a",note:"The average change is within the observed task-level noise band."})}
        ${modelCard({name:"Claude Opus 5",fair:lumen.fair_mean_of_task_medians,val:lumen.val_mean_of_task_medians,count:lumen.n_tasks,color:"#c83220",note:"The headline +0.053 includes an unstable GRPO fair result; see caveats."})}
      </div>
    </section>
    <section class="opsd-interaction" aria-labelledby="opsd-interaction-title">
      <figure class="opsd-figure">
        <div class="opsd-figure-head"><div><p class="opsd-kicker">20 tasks with both model arms</p><h3 id="opsd-interaction-title">Per-task response to a stronger hint</h3></div><p>Hover or focus a dot for its two task-median comparisons.</p></div>
        ${chart()}
        <figcaption>Red points are the clearest sign flips: the same validation hint moves the two models in opposite directions. The grey square marks changes below 0.04 on both axes, which are inside MuseSpark's observed rollout noise.</figcaption>
      </figure>
      <aside class="opsd-readout" aria-label="Interpretation">
        <p class="opsd-kicker">What this says about OPSD</p>
        <h3>The tasks do not collapse into advice-following.</h3>
        <p>GRPO is the sharpest example: the validation hint changes MuseSpark by −0.289 but Opus 5 by +0.301. Coreset selection and label-efficient risk estimation instead show much larger gains for Opus 5 than MuseSpark, without the GRPO failure mode.</p>
        <dl><div><dt>MuseSpark</dt><dd>11 val better · 4 fair better · 7 ties</dd></div><div><dt>Opus 5</dt><dd>8 val better · 2 fair better · 10 ties</dd></div><div><dt>Sign tests</dt><dd>p=0.059 for MuseSpark and p=0.17 for Opus 5, with ties dropped. Neither is decisive.</dd></div><div><dt>Interpretation</dt><dd>Hints expose task-specific opportunities; exploiting them is still a capability test.</dd></div></dl>
      </aside>
    </section>
    <section class="opsd-hint-scatters" aria-labelledby="opsd-hint-scatters-title">
      <div class="opsd-figure-head"><div><p class="opsd-kicker">Hinted versus unhinted</p><h3 id="opsd-hint-scatters-title">Task-level hint comparisons</h3></div><p>Hover or focus a marker for its task-level scores.</p></div>
      <div class="opsd-scatter-grid">${scatterConfigs.map(scatterPanel).join("")}</div>
      <p class="opsd-scatter-note">The diagonal is unchanged performance. Opus uses the existing 24-hour benchmark result as its no-hint coordinate, not a concurrent no-hint arm. MuseSpark has only six unhinted tasks; five used 8,000 maximum tokens, versus 32,000 for every hinted run.</p>
    </section>
    <details class="opsd-method" open>
      <summary>Study design and caveats</summary>
      <div class="opsd-method-body">
        <p>22 CPU tasks were run with Terminus 2, 200 maximum turns, backend batch, and 32,000 maximum tokens for every hinted arm. MuseSpark has 78 rollouts ($257.70); Opus 5 has 39 ($378.31). The cards compare the mean of per-task rollout medians, not a pooled rollout average.</p>
        <ul>
          <li><strong>The un-hinted arm is not a real fifth column.</strong> It exists for only 6 of 22 tasks, for MuseSpark only, and 5 of those 6 used 8,000 rather than 32,000 maximum tokens. On that non-cap-matched overlap: no hint ${fmt(overlap.none)}, fair ${fmt(overlap.fair)}, val ${fmt(overlap.val)}.</li>
          <li><strong>Sample counts are small and uneven.</strong> MuseSpark has n=2 in every cell. Opus 5 is n=1 except five tasks carried at n=2; the hint experiment has no concurrent un-hinted Opus 5 arm.</li>
          <li><strong>GRPO makes the Opus headline fragile.</strong> Its fair median of 0.325 is the midpoint of [0.651, 0.000]. That zero inflates the +0.053 average: dropping it gives +0.037; using best-of gives +0.036; excluding GRPO gives +0.040.</li>
          <li><strong>Two Opus fair tasks are missing.</strong> CPU decoder graph executor and MLH COCO returned no score, leaving 20 comparable Opus tasks.</li>
          <li><strong>Do not overread small deltas.</strong> MuseSpark's within-task rollout spread is 0.013 for fair hints and 0.037 for validation hints. Deltas below about 0.04 are inside noise.</li>
          <li><strong>Budgeted Covtype is likely a protocol failure, not a hint effect.</strong> Opus 5 is near zero in both arms (0.007 fair, 0.015 val), likely because of the stdout protocol trap.</li>
        </ul>
      </div>
    </details>`;

  const tooltip=target.querySelector(".opsd-tooltip");
  const showTooltip=point=>{
    const dataset=point.dataset;
    tooltip.innerHTML=`<strong>${dataset.name}</strong><span>MuseSpark: ${dataset.museFair} → ${dataset.museVal} <b>${dataset.museDelta}</b> (n=${dataset.museN})</span><span>Opus 5: ${dataset.opusFair} → ${dataset.opusVal} <b>${dataset.opusDelta}</b> (n=${dataset.opusN})</span>`;
    tooltip.style.left=`${dataset.tipX}%`;
    tooltip.style.top=`${dataset.tipY}%`;
    tooltip.classList.toggle("is-left",Number(dataset.tipX)>.68);
    tooltip.classList.toggle("is-below",Number(dataset.tipY)<.25);
    tooltip.hidden=false;
  };
  const hideTooltip=()=>{tooltip.hidden=true};
  target.querySelectorAll("[data-opsd-point]").forEach(point=>{
    point.addEventListener("pointerenter",()=>showTooltip(point));
    point.addEventListener("pointerleave",hideTooltip);
    point.addEventListener("focus",()=>showTooltip(point));
    point.addEventListener("blur",hideTooltip);
  });

  const showHintScatterTooltip=point=>{
    const dataset=point.dataset;
    const scatterTooltip=target.querySelector(`[data-hint-scatter-tooltip="${dataset.scatterId}"] .opsd-tooltip`);
    scatterTooltip.innerHTML=`<strong>${dataset.name}</strong><span>${dataset.model} · ${dataset.arm}: ${dataset.hinted} (n=${dataset.n})</span><span>${dataset.baselineLabel}: ${dataset.unhinted}</span>`;
    scatterTooltip.style.left=`${dataset.tipX}%`;
    scatterTooltip.style.top=`${dataset.tipY}%`;
    scatterTooltip.classList.toggle("is-left",Number(dataset.tipX)>.68);
    scatterTooltip.classList.toggle("is-below",Number(dataset.tipY)<.25);
    scatterTooltip.hidden=false;
    return scatterTooltip;
  };
  target.querySelectorAll("[data-hint-scatter-point]").forEach(point=>{
    let scatterTooltip;
    point.addEventListener("pointerenter",()=>{scatterTooltip=showHintScatterTooltip(point)});
    point.addEventListener("pointerleave",()=>{if(scatterTooltip)scatterTooltip.hidden=true});
    point.addEventListener("focus",()=>{scatterTooltip=showHintScatterTooltip(point)});
    point.addEventListener("blur",()=>{if(scatterTooltip)scatterTooltip.hidden=true});
  });
})();
