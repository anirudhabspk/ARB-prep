(()=>{
  const target=document.getElementById("opsd-hint-experiment"),data=window.OPSD_HINT_DATA;
  if(!target||!data)return;

  const esc=value=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const median=values=>{
    if(!Array.isArray(values)||!values.length)return null;
    const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
    return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
  };
  const fmt=value=>Number.isFinite(value)?value.toFixed(3):"n/a";
  const baseSlug=key=>key.replace(/^p?\d{4}-\d{5}-/,"");
  const catalog=new Map((window.ARB_TASK_CATALOG||[]).map(task=>[task.slug,task]));
  const benchmarkTasks=new Map((window.ARB_DATA?.tasks||[]).map(task=>[task.name,task]));
  const displayName=task=>catalog.get(baseSlug(task.key))?.blogName||task.key.replace(/^p?\d{4}-\d{5}-/,"").replace(/-/g," ");
  const runScore=(name,model,which)=>{
    const points=benchmarkTasks.get(name)?.models?.find(run=>run.model===model)?.points;
    return which==="initial"?points?.find(point=>point.iteration===1)?.testAtBest:points?.at(-1)?.testAtBest;
  };
  const tasks=data.tasks.map(task=>{
    const name=displayName(task),opusInitial=runScore(name,"lumen","initial"),opusFinal=runScore(name,"lumen","final"),museInitial=runScore(name,"granola-plus","initial"),museFinal=runScore(name,"granola-plus","final"),opusHint=median(task.valLumen),museHint=median(task.valGranola);
    return{...task,name,opusInitial,opusFinal,opusHint,museInitial,museFinal,museHint};
  }).filter(task=>[task.opusInitial,task.opusFinal,task.opusHint,task.museInitial,task.museFinal,task.museHint].every(Number.isFinite)).sort((a,b)=>a.name.localeCompare(b.name));

  function chart(){
    const W=940,L=218,R=28,T=38,B=60,rowHeight=48,H=T+B+rowHeight*tasks.length,plotW=W-L-R;
    const x=value=>L+value*plotW,ticks=[0,.2,.4,.6,.8,1];
    const lanes=[
      {key:"opus",label:"Opus 5",color:"#c83220",offset:16},
      {key:"muse",label:"MuseSpark 1.3",color:"#21636a",offset:34}
    ];
    let body=`<title>Validation hint score within each AutoResearch trajectory</title><desc>Each task has two lanes. The hollow circle is the initial no-hint AutoResearch hidden-test score, the diamond is the validation-hinted Terminus score, and the square is the final no-hint AutoResearch hidden-test score.</desc><rect class="opsd-plot-frame" x="${L}" y="${T}" width="${plotW}" height="${H-T-B}"/>`;
    for(const tick of ticks){
      const xx=x(tick);
      body+=`<line class="opsd-grid" x1="${xx}" x2="${xx}" y1="${T}" y2="${H-B}"/><text class="opsd-tick" x="${xx}" y="${H-B+21}" text-anchor="middle">${tick.toFixed(1)}</text>`;
    }
    for(const [index,task] of tasks.entries()){
      const rowTop=T+index*rowHeight,rowMid=rowTop+25,rowBottom=rowTop+rowHeight;
      body+=`<line class="opsd-task-divider" x1="${L}" x2="${W-R}" y1="${rowBottom}" y2="${rowBottom}"/><text class="opsd-task-label" x="${L-12}" y="${rowMid+3.5}" text-anchor="end">${esc(task.name)}</text>`;
      for(const lane of lanes){
        const initial=task[`${lane.key}Initial`],hint=task[`${lane.key}Hint`],final=task[`${lane.key}Final`],y=rowTop+lane.offset,initialX=x(initial),hintX=x(hint),finalX=x(final),tipX=100*hintX/W,tipY=100*y/H;
        const aria=`${task.name}, ${lane.label}. Initial AutoResearch test score ${fmt(initial)}; validation-hinted Terminus score ${fmt(hint)}; final AutoResearch test score ${fmt(final)}.`;
        const diamond=`${hintX},${y-5.5} ${hintX+5.5},${y} ${hintX},${y+5.5} ${hintX-5.5},${y}`;
        body+=`<g class="opsd-interval-lane" data-opsd-lane tabindex="0" role="img" aria-label="${esc(aria)}" data-name="${esc(task.name)}" data-model="${lane.label}" data-initial="${fmt(initial)}" data-hint="${fmt(hint)}" data-final="${fmt(final)}" data-tip-x="${tipX}" data-tip-y="${tipY}"><line class="opsd-interval-line" x1="${initialX}" x2="${finalX}" y1="${y}" y2="${y}" stroke="${lane.color}"/><circle class="opsd-hit" cx="${hintX}" cy="${y}" r="13"/><circle class="opsd-interval-initial" cx="${initialX}" cy="${y}" r="4.6" fill="#fff" stroke="${lane.color}"/><polygon class="opsd-interval-hint" points="${diamond}" fill="#b57c14"/><rect class="opsd-interval-final" x="${finalX-4.6}" y="${y-4.6}" width="9.2" height="9.2" fill="${lane.color}"/><title>${esc(aria)}</title></g>`;
      }
    }
    body+=`<text class="opsd-axis-title" x="${(L+W-R)/2}" y="${H-14}" text-anchor="middle">Hidden-test reward</text>`;
    return`<div class="opsd-chart-wrap opsd-interval-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Per-task validation hint scores within AutoResearch trajectories">${body}</svg><div class="opsd-tooltip" role="tooltip" hidden></div></div>`;
  }

  target.innerHTML=`
    <div class="opsd-intro prose">
      <p>We use a validation hint to ask whether these tasks reward the ability to <em>execute</em> a useful research idea, rather than merely discover one. The plot places the hinted result within each model's ordinary AutoResearch trajectory on the same task.</p>
    </div>
    <section class="opsd-interaction opsd-interaction--solo" aria-labelledby="opsd-interaction-title">
      <figure class="opsd-figure">
        <div class="opsd-figure-head"><div><p class="opsd-kicker">22 CPU tasks · hidden-test reward</p><h3 id="opsd-interaction-title">Validation hints within AutoResearch trajectories</h3></div><p>Hover or focus a lane for its three scores.</p></div>
        <div class="opsd-interval-legend" aria-label="Score marker legend"><span><i class="opsd-legend-initial"></i>Initial AR test score</span><span><i class="opsd-legend-hint"></i>Validation-hinted Terminus score</span><span><i class="opsd-legend-final"></i>Final AR test score</span><span><b class="opsd-legend-opus"></b>Opus 5</span><span><b class="opsd-legend-muse"></b>MuseSpark 1.3</span></div>
        ${chart()}
        <figcaption>Each task has one Opus 5 lane and one MuseSpark 1.3 lane. The hollow circle and square mark the beginning and end of the ordinary AutoResearch interval; the diamond marks the validation-hinted 200-turn Terminus run.</figcaption>
      </figure>
    </section>
    <details class="opsd-method" open>
      <summary>Study design and caveats</summary>
      <div class="opsd-method-body">
        <p>All 22 CPU tasks use Terminus 2 with 200 maximum turns, backend batch, and 32,000 maximum tokens for the hinted runs. The validation hint is the unrestricted best hint, including grader nuances and exploits where useful.</p>
        <ul>
          <li><strong>The initial and hinted markers use equal turn budgets.</strong> Both are 200-turn Terminus runs. The final AutoResearch marker is a long-horizon reference point, rather than an equal-budget comparison.</li>
          <li><strong>Samples are limited.</strong> MuseSpark has two validation-hint rollouts per task; Opus 5 has one. Each hinted marker is the median available rollout score.</li>
          <li><strong>Do not overread small differences.</strong> MuseSpark's within-task validation-hint rollout spread is 0.037, so differences below about 0.04 are inside its observed rollout noise.</li>
          <li><strong>Budgeted Covtype is likely a protocol failure, not a hint effect.</strong> Opus 5 remains near zero in the validation-hint run (0.015), likely because of the stdout protocol trap.</li>
        </ul>
      </div>
    </details>`;

  const tooltip=target.querySelector(".opsd-tooltip");
  const showTooltip=lane=>{
    const dataset=lane.dataset;
    tooltip.innerHTML=`<strong>${dataset.name} · ${dataset.model}</strong><span>Initial AR test: ${dataset.initial}</span><span>Validation hint: ${dataset.hint}</span><span>Final AR test: ${dataset.final}</span>`;
    tooltip.style.left=`${dataset.tipX}%`;
    tooltip.style.top=`${dataset.tipY}%`;
    tooltip.classList.toggle("is-left",Number(dataset.tipX)>.68);
    tooltip.classList.toggle("is-below",Number(dataset.tipY)<.12);
    tooltip.hidden=false;
  };
  const hideTooltip=()=>{tooltip.hidden=true};
  target.querySelectorAll("[data-opsd-lane]").forEach(lane=>{
    lane.addEventListener("pointerenter",()=>showTooltip(lane));
    lane.addEventListener("pointerleave",hideTooltip);
    lane.addEventListener("focus",()=>showTooltip(lane));
    lane.addEventListener("blur",hideTooltip);
  });
})();
