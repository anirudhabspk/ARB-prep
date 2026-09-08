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
  const firstIterationScore=(name,model)=>benchmarkTasks.get(name)?.models?.find(run=>run.model===model)?.points?.find(point=>point.iteration===1)?.testAtBest;
  const shortName=task=>{
    if(task.key.includes("grpo"))return"GRPO";
    if(task.key.includes("causalpfn"))return"CausalPFN";
    if(task.key.includes("causalrivers"))return"CausalRivers";
    if(task.key.includes("coreset"))return"Coreset";
    return displayName(task);
  };
  const tasks=data.tasks.map(task=>{
    const name=displayName(task),museNoHint=firstIterationScore(name,"granola-plus"),opusNoHint=firstIterationScore(name,"lumen"),museVal=median(task.valGranola),opusVal=median(task.valLumen);
    return{...task,name,short:shortName(task),museNoHint,opusNoHint,museVal,opusVal,muse:delta(museNoHint,museVal),opus:delta(opusNoHint,opusVal)};
  }).filter(task=>Number.isFinite(task.muse)&&Number.isFinite(task.opus));

  function chart(){
    const W=940,H=520,L=96,R=28,T=30,B=76,domain=.6,plotW=W-L-R,plotH=H-T-B;
    const x=value=>L+(value+domain)/(2*domain)*plotW;
    const y=value=>T+(domain-value)/(2*domain)*plotH;
    const ticks=[-.6,-.4,-.2,0,.2,.4,.6];
    const labels={
      "coreset-selection-group-robust-waterbirds":{text:"Coreset",dx:10,dy:-9},
      "causalrivers-heldout-station-graph-auroc":{text:"CausalRivers",dx:-10,dy:-8,anchor:"end"},
      "causalpfn-cate-pehe-ihdp-surfaceb":{text:"CausalPFN",dx:10,dy:-8},
      "grpo-rl-halfcheetah-advantage-estimator":{text:"GRPO",dx:10,dy:15}
    };
    let body=`<title>Validation-hint improvement over the first no-hint AutoResearch iteration</title><desc>Each point is one task. The horizontal position is MuseSpark 1.3's validation-hint score minus its no-hint first-iteration score. The vertical position is the corresponding change for Claude Opus 5.</desc><rect class="opsd-plot-frame" x="${L}" y="${T}" width="${plotW}" height="${plotH}"/>`;
    for(const tick of ticks){
      const xx=x(tick),yy=y(tick),zero=tick===0;
      body+=`<line class="${zero?"opsd-zero-line":"opsd-grid"}" x1="${xx}" x2="${xx}" y1="${T}" y2="${H-B}"/><line class="${zero?"opsd-zero-line":"opsd-grid"}" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="opsd-tick" x="${xx}" y="${H-B+21}" text-anchor="middle">${axisFmt(tick)}</text><text class="opsd-tick" x="${L-10}" y="${yy+3.5}" text-anchor="end">${axisFmt(tick)}</text>`;
    }
    body+=`<text class="opsd-zone-label" x="${x(-.55)}" y="${y(.55)}">Opus improves · MuseSpark worsens</text><text class="opsd-zone-label" x="${x(.55)}" y="${y(.55)}" text-anchor="end">Both improve</text><text class="opsd-zone-label" x="${x(-.55)}" y="${y(-.55)}">Both worsen</text><text class="opsd-zone-label" x="${x(.55)}" y="${y(-.55)}" text-anchor="end">MuseSpark improves · Opus worsens</text><text class="opsd-axis-title" x="${(L+W-R)/2}" y="${H-15}" text-anchor="middle">MuseSpark 1.3: validation hint − no-hint first iteration</text><text class="opsd-axis-title" x="18" y="${(T+H-B)/2}" text-anchor="middle" transform="rotate(-90 18 ${(T+H-B)/2})">Claude Opus 5: validation hint − no-hint first iteration</text>`;
    for(const task of tasks){
      const label=labels[task.key],bothImprove=task.muse>0&&task.opus>0,bothWorsen=task.muse<0&&task.opus<0,fill=bothImprove?"#21636a":bothWorsen?"#999b96":"#c83220",cx=x(task.muse),cy=y(task.opus),tipX=100*cx/W,tipY=100*cy/H;
      const aria=`${task.name}. MuseSpark change ${deltaFmt(task.muse)}; Claude Opus 5 change ${deltaFmt(task.opus)}.`;
      body+=`<g class="opsd-point${bothImprove?" is-both-improve":""}" data-opsd-point tabindex="0" role="img" aria-label="${esc(aria)}" data-name="${esc(task.name)}" data-muse-no-hint="${fmt(task.museNoHint)}" data-muse-val="${fmt(task.museVal)}" data-muse-delta="${deltaFmt(task.muse)}" data-muse-n="${task.valGranola.length}" data-opus-no-hint="${fmt(task.opusNoHint)}" data-opus-val="${fmt(task.opusVal)}" data-opus-delta="${deltaFmt(task.opus)}" data-opus-n="${task.valLumen.length}" data-tip-x="${tipX}" data-tip-y="${tipY}"><circle class="opsd-hit" cx="${cx}" cy="${cy}" r="13"/><circle class="opsd-dot" cx="${cx}" cy="${cy}" r="5" fill="${fill}"/><title>${esc(aria)}</title></g>`;
      if(label)body+=`<text class="opsd-point-label" x="${cx+label.dx}" y="${cy+label.dy}" text-anchor="${label.anchor||"start"}">${label.text}</text>`;
    }
    return`<div class="opsd-chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Task-level validation-hint improvement for MuseSpark and Opus">${body}</svg><div class="opsd-tooltip" role="tooltip" hidden></div></div>`;
  }

  target.innerHTML=`
    <div class="opsd-intro prose">
      <p>We use a validation hint to ask whether these tasks reward the ability to <em>execute</em> a useful research idea, rather than merely discover one. The hint is a short unrestricted block appended to the task instruction: it may name grader nuances or an exploit. Each point compares that hinted run with the first no-hint AutoResearch iteration for the same model and task.</p>
    </div>
    <section class="opsd-interaction opsd-interaction--solo" aria-labelledby="opsd-interaction-title">
      <figure class="opsd-figure">
        <div class="opsd-figure-head"><div><p class="opsd-kicker">22 CPU tasks · matched 200-turn runs</p><h3 id="opsd-interaction-title">Validation-hint improvement by model</h3></div><p>Hover or focus a dot for its two task-level comparisons.</p></div>
        ${chart()}
        <figcaption>Each axis is a validation-hint score minus the hidden-test score after the first no-hint 200-turn iteration. Green points improved for both models; red points moved in opposite directions; grey points worsened for both.</figcaption>
      </figure>
    </section>
    <details class="opsd-method" open>
      <summary>Study design and caveats</summary>
      <div class="opsd-method-body">
        <p>All 22 CPU tasks use Terminus 2 with 200 maximum turns, backend batch, and 32,000 maximum tokens for the hinted runs. The validation hint is the unrestricted best hint, including grader nuances and exploits where useful.</p>
        <ul>
          <li><strong>The no-hint baseline is the first standard AutoResearch iteration.</strong> It has the same 200-turn Terminus budget as a hinted run, so this plot compares equal effort. It is not a separately randomized no-hint arm: the first-iteration and hinted runs are distinct evaluations.</li>
          <li><strong>Samples are limited.</strong> MuseSpark has two validation-hint rollouts per task; Opus 5 has one. Each plotted hinted score is the median available rollout score.</li>
          <li><strong>Do not overread small deltas.</strong> MuseSpark's within-task validation-hint rollout spread is 0.037, so differences below about 0.04 are inside its observed rollout noise.</li>
          <li><strong>Budgeted Covtype is likely a protocol failure, not a hint effect.</strong> Opus 5 remains near zero in the validation-hint run (0.015), likely because of the stdout protocol trap.</li>
        </ul>
      </div>
    </details>`;

  const tooltip=target.querySelector(".opsd-tooltip");
  const showTooltip=point=>{
    const dataset=point.dataset;
    tooltip.innerHTML=`<strong>${dataset.name}</strong><span>MuseSpark: ${dataset.museNoHint} → ${dataset.museVal} <b>${dataset.museDelta}</b> (n=${dataset.museN})</span><span>Opus 5: ${dataset.opusNoHint} → ${dataset.opusVal} <b>${dataset.opusDelta}</b> (n=${dataset.opusN})</span>`;
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
})();
