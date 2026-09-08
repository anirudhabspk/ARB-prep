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
assert.equal(effort.find(row=>row.key==='vesper-pro').taskCount,25);
assert.equal(evaluate('DATA.tasks.flatMap(t=>t.models).filter(r=>r.points.length).length'),232);
assert.equal(evaluate('new Set(DATA.tasks.flatMap(t=>t.models.map(r=>r.evaluationId))).size'),261);
assert.equal(evaluate('DATA.tasks.flatMap(t=>t.models).find(r=>r.evaluationId==="1a5ba0eb-d667-40f2-bfde-20cb1ce4b46d").points.length'),0);
assert.ok(evaluate('DATA.tasks.flatMap(t=>t.models).find(r=>r.evaluationId==="60a7e9e2-c234-4091-a258-242d0574dc30").points.length')>0);
const overview=evaluate('overviewTrajectories()');
const fable=overview.series.find(r=>r.key==='vesper-pro');
const observedEnd=evaluate('Math.min(...DATA.tasks.flatMap(t=>t.models.filter(r=>r.model==="vesper-pro"&&r.provisional).map(r=>r.hours)))');
close(fable.points.at(-1).hour,observedEnd);
assert.ok(observedEnd<24);
const costHtml=evaluate('costPerformancePlot(currentResults().rows)');
assert.ok(costHtml.includes('completed runs with API ledger records'));
assert.ok(!costHtml.includes('NaN'));

// Native SVG rendering shares these exact values and retains the model branding.
evaluate('var rendered={};');context.document={getElementById:()=>({set innerHTML(value){context.renderedHtml=value;}})};
evaluate('renderModelEffort()');
assert.equal((context.renderedHtml.match(/class="model-dot efficiency-point"/g)||[]).length,18);
assert.ok(!context.renderedHtml.includes('NaN'));
assert.equal((context.renderedHtml.match(/class="efficiency-tooltip"/g)||[]).length,2);
assert.ok(context.renderedHtml.includes('data-score-value="59.3"'));
assert.ok(context.renderedHtml.includes('data-resource-value="84.3%"'));
assert.ok(!context.renderedHtml.includes('data-score-value="59.3%"'));
console.log('Scoring, Elo, cohort and effort-chart checks passed.');
console.log(JSON.stringify(effort.map(({name,taskCount,test,elo,submissions,hours})=>({name,taskCount,test,elo,submissions,hours})),null,2));
