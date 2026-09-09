const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({window:{},console});
for(const file of ['site-data.js','raw-score-maps.js','difficulty-reward-maps.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'results.js'),'utf8').split('if(document.body.dataset.page')[0],context);
const evaluate=code=>vm.runInContext(code,context);
const close=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

// Meta MLE's published accuracy example: baseline=.5, reference=.9, c=.1.
// Test with the same equations independently, then each real task's landmarks.
const squash=u=>u/(1+u);
close(.1+.9*squash(Math.log(.5/.1)/Math.log(.5/.1)),.55);
close(evaluate('DIFFICULTY_REWARD_MAPS["Budgeted Covtype dual market"].score(0.5567,"final")'),.5);
close(evaluate('DIFFICULTY_REWARD_MAPS["TIES CLIP model merging"].score(86,"final")'),.55);
close(evaluate('DIFFICULTY_REWARD_MAPS["TIES CLIP model merging"].score(100,"final")'),1);

// Validation and hidden test use one common final-panel normalization.
const commonMapCases=[
  ["CARPS star discrepancy subset selection",.3,.21641915488349533],
  ["SOPCC online chance constrained policy",5.2,.45327089158337075],
  ["TGAT MILP branching",300,.30615054518287543],
  ["FasterCache video DiT policy",27,.381894549396098],
  ["FasterGCG candidate token ranking",.2,.19067311693454814],
];
for(const [name,raw,expected] of commonMapCases){
  const point={bestValidation:.25,testAtBest:.75,rawValidation:raw,rawTestAtBest:raw};
  close(evaluate(`difficultyAdjustedPoint({name:${JSON.stringify(name)}},${JSON.stringify(point)},"bestValidation")`),expected);
  close(evaluate(`difficultyAdjustedPoint({name:${JSON.stringify(name)}},${JSON.stringify(point)},"testAtBest")`),expected);
}
const sopccWithoutRaw={bestValidation:.2241940383685004,testAtBest:.45327089158337075};
close(evaluate(`difficultyAdjustedPoint({name:"SOPCC online chance constrained policy"},${JSON.stringify(sopccWithoutRaw)},"bestValidation")`),.45327089158337075);
close(evaluate(`difficultyAdjustedPoint({name:"SOPCC online chance constrained policy"},${JSON.stringify(sopccWithoutRaw)},"testAtBest")`),.45327089158337075);

// Normalize every observation BEFORE integration, never the resulting AUARC.
evaluate('var syntheticTask={name:"Budgeted imputation MCAR 50"};var syntheticRun={hours:1,points:[{seconds:0,bestValidation:.5,testAtBest:.5},{seconds:1800,bestValidation:.75,testAtBest:.75}]};');
const converted=evaluate('difficultyAdjustedRunStats(syntheticTask,syntheticRun).test');
close(converted,evaluate('(difficultyAdjustedReward(syntheticTask,.5,"final")+difficultyAdjustedReward(syntheticTask,.75,"final"))/2'));
assert.ok(Math.abs(converted-evaluate('difficultyAdjustedReward(syntheticTask,.625,"final")'))>.001);

// Native metrics avoid loss from reconstructing a clipped reported reward.
close(evaluate('difficultyAdjustedPoint({name:"Budgeted Covtype dual market"},{testAtBest:1,rawTestAtBest:1},"testAtBest")'),1);
assert.equal(evaluate('difficultyAdjustedRunStats({name:"Budgeted Covtype dual market"},{hours:0,points:[]})'),null);

// Elo uses within-task pairs and ignores absent runs. Reversing wins reverses Elo.
const ratings=evaluate('adjustedElo([{[ORDER[0]]:{test:.8},[ORDER[1]]:{test:.2}},{[ORDER[0]]:{test:.7},[ORDER[1]]:{test:.3}}])');
const order=evaluate('ORDER');
assert.ok(ratings[order[0]]>ratings[order[1]]);
const reversed=evaluate('adjustedElo([{[ORDER[0]]:{test:.2},[ORDER[1]]:{test:.8}},{[ORDER[0]]:{test:.3},[ORDER[1]]:{test:.7}}])');
close(ratings[order[0]],reversed[order[1]]);
const result=evaluate('currentResults()'),effort=evaluate('effortModelRows()');
const currentSnapshot=context.window.ARB_DATA.snapshot.selectionPolicy==='current';
const completedReruns=evaluate('DATA.tasks.flatMap(t=>t.models).filter(r=>r.benchmarkWindow==="23h research + 1h infrastructure")');
assert.equal(completedReruns.length,21);
assert.ok(completedReruns.every(run=>run.hours===24&&run.displayHours===24&&run.extension&&!run.provisional));
const retainedRunning=evaluate('DATA.tasks.flatMap(t=>t.models).filter(r=>r.replacementStatus==="running")');
const retainedInvalid=evaluate('DATA.tasks.flatMap(t=>t.models).filter(r=>r.replacementStatus==="invalid")');
assert.equal(retainedRunning.length,16);
assert.equal(retainedInvalid.length,2);
assert.ok([...retainedRunning,...retainedInvalid].every(run=>run.points.length&&run.evaluationId!==run.replacementEvaluationId));
assert.equal(context.window.ARB_DATA.snapshot.runningRerunCount,16);
assert.equal(context.window.ARB_DATA.snapshot.invalidRerunCount,2);
evaluate('var completedRerunTask=DATA.tasks.find(t=>t.name==="Label efficient risk estimator");var completedRerun=completedRerunTask.models.find(r=>r.evaluationId==="942c3b95-5c23-4dae-b6ab-a8b0fa6a5ff1")');
assert.equal(evaluate('taskStats(completedRerunTask).find(r=>r.key===completedRerun.model).hours'),24);
close(evaluate('difficultyAdjustedRunStats(completedRerunTask,completedRerun).test'),evaluate('timeAuc(completedRerun.points.map(point=>({...point,test:difficultyAdjustedPoint(completedRerunTask,point,"testAtBest")})),"test",24*3600)'));
for(const row of effort){
  close(row.test,result.rows.find(r=>r.key===row.key).test);
  close(row.test,context.window.ARB_DATA.aggregates.find(r=>r.key===row.key).test);
  close(row.elo,context.window.ARB_DATA.aggregates.find(r=>r.key===row.key).elo);
  assert.ok(Number.isFinite(row.submissions)&&Number.isFinite(row.hours));
  assert.ok(row.activeTimePercent>=0&&row.activeTimePercent<=100);
  assert.ok(row.taskCount>0);
  assert.ok(row.elo_ci.every(Number.isFinite));
}
assert.equal(evaluate('DATA.tasks.length'),29);
assert.ok(effort.every(row=>row.taskCount===29));
assert.equal(evaluate('DATA.tasks.flatMap(t=>t.models).filter(r=>r.points.length).length'),context.window.ARB_DATA.snapshot.includedRuns);
assert.equal(evaluate('new Set(DATA.tasks.flatMap(t=>t.models.map(r=>r.evaluationId))).size'),261);
const allRuns=context.window.ARB_DATA.tasks.flatMap(task=>task.models);
assert.equal(allRuns.filter(run=>run.points.some(point=>Number.isFinite(point.testAtBest))).length,261);
assert.equal(allRuns.filter(run=>run.extension).length,52);
assert.ok(allRuns.filter(run=>run.extension).every(run=>run.hours===24));
assert.ok(allRuns.filter(run=>run.points.length).every(run=>run.hours===24));
const newlyFlattenedIds=new Set([
  '64f07bb3-0573-4287-abcd-bb615ef31cdd',
  'd52b8c71-bf11-4f24-97f0-3ea02cfd9585',
  '017f8831-67b5-4966-a18a-87b7feca9d2f',
  '2e7af4a3-bb00-47fe-a600-451dccc6cea9',
  '322e5f13-314f-436f-9705-cd1e07fa9f51',
  '6ddbc139-353f-46f8-9254-331649aa91ee',
  '651fe36c-e75f-4607-ac75-d9c9cb13b5b0',
]);
const newlyFlattened=allRuns.filter(run=>newlyFlattenedIds.has(run.evaluationId));
assert.equal(newlyFlattened.length,newlyFlattenedIds.size);
assert.ok(newlyFlattened.every(run=>run.hours===24&&run.extension));
assert.ok(evaluate('DATA.tasks.flatMap(t=>t.models).find(r=>r.evaluationId==="1a5ba0eb-d667-40f2-bfde-20cb1ce4b46d").points.length')>0);
assert.ok(evaluate('DATA.tasks.flatMap(t=>t.models).find(r=>r.evaluationId==="60a7e9e2-c234-4091-a258-242d0574dc30").points.length')>0);
evaluate('var faster=DATA.tasks.find(t=>t.name==="FasterGCG candidate token ranking");var fasterOpus=faster.models.find(r=>r.evaluationId==="9c006e63-3989-4de2-8867-b3c4016757ec");var fasterQwen=faster.models.find(r=>r.evaluationId==="1651b5ec-a39d-4c1c-aa20-f1e84c3b88eb")');
close(evaluate('fasterOpus.points.at(-1).bestValidation'),.653187441732);
close(evaluate('fasterOpus.points.at(-1).testAtBest'),.654427897902);
close(evaluate('fasterQwen.points.at(-1).bestValidation'),.620250324226);
close(evaluate('fasterQwen.points.at(-1).testAtBest'),.627876388498);
assert.ok(evaluate('fasterOpus.extension&&fasterQwen.extension&&fasterOpus.hours===24&&fasterQwen.hours===24'));
evaluate('var less=DATA.tasks.find(t=>t.name==="Less Is More token budget selection");var lessFinalStats=taskStats(less).map(stat=>({points:[{testAtBest:difficultyAdjustedPoint(less,stat.points.at(-1),"testAtBest")}]}));var lessFinalDomain=taskDomain(lessFinalStats,"testAtBest")');
assert.ok(evaluate('lessFinalDomain.ticks.at(-1)>=lessFinalDomain.hi-1e-12'));
assert.ok(evaluate('lessFinalDomain.ticks.length<=8'));
const overview=evaluate('overviewTrajectories()');
const fable=overview.series.find(r=>r.key==='vesper-pro');
assert.ok(fable.fit&&Number.isFinite(fable.fit.r2));
const actualFableAt12=evaluate('mean(DATA.tasks.flatMap(task=>{const run=task.models.find(candidate=>candidate.model==="vesper-pro");if(!run)return[];const points=run.points.map(point=>({...point,value:difficultyAdjustedPoint(task,point,"testAtBest")})).filter(point=>Number.isFinite(point.value)).sort((a,b)=>a.seconds-b.seconds);if(!points.length)return[];let value=0;for(const point of points){if(point.seconds>12*3600)break;value=point.value}return[value]}))');
close(fable.points.find(point=>point.hour===12).value,actualFableAt12);
assert.ok(overview.series.some(series=>series.points.slice(1).some((point,index)=>point.value<series.points[index].value-1e-12)));
const trajectoryHtml=evaluate('logTimeTestPlot(overviewTrajectories())');
assert.ok(trajectoryHtml.includes('Monotonic sigmoid fit to actual hourly means across 29 selected runs.'));
if(currentSnapshot){
  const active=evaluate('DATA.tasks.flatMap(t=>t.models).filter(r=>r.provisional&&r.points.length)');
  assert.equal(active.length,0);
  close(fable.points.at(-1).hour,24);
  for(const t of context.window.ARB_DATA.tasks)for(const r of t.models){
    if(r.points.length&&r.evaluationId!=='60a7e9e2-c234-4091-a258-242d0574dc30')assert.ok(r.extension||r.sourceStatus==='Accepted model failure'||r.replacementStatus||['running','completed'].includes(r.status));
  }
}else{
  assert.equal(evaluate('DATA.tasks.flatMap(t=>t.models).filter(r=>r.provisional).length'),0);
  close(fable.points.at(-1).hour,24);
}
const costHtml=evaluate('costPerformancePlot(currentResults().rows)');
assert.ok(!costHtml.includes('The line marks the Pareto frontier.'));
const missingCosts=[],missingOutputTokens=[];
for(const task of context.window.ARB_DATA.tasks)for(const run of task.models){
  if(!run.points.length)continue;
  if(!Number.isFinite(run.apiCost))missingCosts.push(run.evaluationId);
  if(!Number.isFinite(run.outputTokens))missingOutputTokens.push(run.evaluationId);
  if(run.provisional)assert.ok(Number.isFinite(run.apiCost));
  assert.ok(run.apiCostFetchedAt);
}
assert.deepEqual(missingCosts,currentSnapshot?['002958c6-cb2f-46e3-8536-ba8d421083af']:[]);
assert.deepEqual(missingOutputTokens,[]);
const estimatedSol=evaluate('DATA.tasks.flatMap(t=>t.models).find(r=>r.evaluationId==="002958c6-cb2f-46e3-8536-ba8d421083af")');
assert.equal(estimatedSol.apiCost,currentSnapshot?null:145);
assert.equal(estimatedSol.apiCostEstimated,!currentSnapshot);
const cpuCostHtml=evaluate('efficiencyPlot(DATA.tasks.find(task=>task.name==="CPU LLM decode throughput"),"Performance vs. API cost","apiCost","API cost (USD)",value=>`$${value.toFixed(value<10?2:0)}`)');
assert.equal(cpuCostHtml.includes('$145 (estimated)'),!currentSnapshot);
const costRows=evaluate('costPerformanceRows(currentResults().rows)');
assert.equal(costRows.find(r=>r.key==='vesper-pro').taskCount,effort.find(r=>r.key==='vesper-pro').taskCount);
for(const row of costRows){
  if(row.key!=='skylark')close(row.test,result.rows.find(r=>r.key===row.key).test);
  assert.ok(costHtml.includes('data-resource-value="$'+row.cost.toFixed(2)+'"'));
  assert.ok(costHtml.includes('data-score-value="'+evaluate('fmt('+row.test+')')+'"'));
}
assert.ok(!costHtml.includes('NaN'));

const tokenHtml=evaluate('efficiencyPlot(DATA.tasks.find(task=>task.name==="TIES CLIP model merging"),"Performance vs. output tokens","outputTokens","Output tokens",compactNumber)');
assert.ok(!tokenHtml.includes('Source data unavailable'));
assert.ok(!tokenHtml.includes('Output tokens unavailable from Horizon'));
assert.ok(!fs.readFileSync(path.join(root,'results.js'),'utf8').includes(['Final hidden-test','reward unavailable'].join(' ')));
for(let index=0;index<context.window.ARB_DATA.tasks.length;index++){
  const apiHtml=evaluate(`efficiencyPlot(DATA.tasks[${index}],"Performance vs. API cost","apiCost","API cost (USD)",value=>\`$\${value.toFixed(value<10?2:0)}\`)`);
  const outputHtml=evaluate(`efficiencyPlot(DATA.tasks[${index}],"Performance vs. output tokens","outputTokens","Output tokens",compactNumber)`);
  assert.ok(!apiHtml.includes('Selected score unavailable'));
  assert.ok(!outputHtml.includes('Selected score unavailable'));
}

// Native SVG rendering shares these exact values and retains the model branding.
evaluate('var rendered={};');context.document={getElementById:()=>({set innerHTML(value){context.renderedHtml=value;}})};
evaluate('renderModelEffort()');
assert.equal((context.renderedHtml.match(/class="model-dot efficiency-point"/g)||[]).length,9);
assert.ok(!context.renderedHtml.includes('NaN'));
assert.equal((context.renderedHtml.match(/class="efficiency-tooltip"/g)||[]).length,1);
assert.ok(context.renderedHtml.includes('data-score-value="'+effort.find(r=>r.key==='vesper-pro').test.toFixed(3)+'"'));
assert.ok(!context.renderedHtml.includes('data-score-value="59.3%"'));
const submissionsPanel=context.renderedHtml.split('<h4>Number of submissions vs. test AUARC</h4>')[1];
for(const label of ['0','15','30','45','60','75'])assert.ok(submissionsPanel.includes(`>${label}</text>`));
assert.ok(!submissionsPanel.includes('>16.5</text>'));
assert.ok(evaluate('renderTask.toString()').includes('output-token count alone does not determine cost'));
assert.ok(evaluate('renderTaskScoringExample.toString()').includes('CPU LLM decode throughput'));
assert.ok(evaluate('renderTaskScoringExample.toString()').includes('vesper-pro'));
const interactiveTaskChart=evaluate('taskChart({...DATA.tasks.find(task=>task.name==="DCTabEval pooled categorical statistics"),models:[DATA.tasks.find(task=>task.name==="DCTabEval pooled categorical statistics").models.find(run=>run.model==="vesper-pro")]},"Validation","bestValidation")');
assert.ok(interactiveTaskChart.includes('class="efficiency-point"'));
assert.ok(interactiveTaskChart.includes('class="efficiency-tooltip"'));
const hiddenAuarcChart=evaluate('taskChart({...DATA.tasks.find(task=>task.name==="DCTabEval pooled categorical statistics"),models:[DATA.tasks.find(task=>task.name==="DCTabEval pooled categorical statistics").models.find(run=>run.model==="vesper-pro")]},"Hidden test","testAtBest",null,{fillAuarc:true})');
assert.ok(hiddenAuarcChart.includes('class="auarc-area"'));
assert.ok(hiddenAuarcChart.includes('Hidden test AUARC ='));
assert.ok(!hiddenAuarcChart.includes('fill="#fff"'));
console.log('Scoring, Elo, cohort and effort-chart checks passed.');
console.log(JSON.stringify(effort.map(({name,taskCount,test,elo,submissions,hours})=>({name,taskCount,test,elo,submissions,hours})),null,2));

// Sub-dollar cost differences must not add a lower-scoring model to the frontier.
const bucketFrontier=evaluate('wholeDollarCostFrontier([{key:"sol",cost:134.10,test:.52},{key:"opus",cost:134.27,test:.58},{key:"astra",cost:195.47,test:.60}]).map(r=>r.key)');
assert.deepEqual(Array.from(bucketFrontier),['opus','astra']);
const actualFrontier=evaluate('wholeDollarCostFrontier(costPerformanceRows(currentResults().rows)).map(r=>r.key)');
assert.ok(actualFrontier.includes('lumen'));
assert.ok(!actualFrontier.includes('skylark'));
assert.ok(actualFrontier.includes('meridian'));
