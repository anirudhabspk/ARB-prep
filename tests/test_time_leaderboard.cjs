const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),c=vm.createContext({window:{},console});
for(const file of ['site-data.js','raw-score-maps.js','difficulty-reward-maps.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
vm.runInContext(fs.readFileSync(path.join(root,'results.js'),'utf8').split('if(document.body.dataset.page')[0],c);
const read=s=>vm.runInContext(s,c);
read('var overview=overviewTrajectories()');
// Every leaderboard entry must match the existing trajectory fit, including between hourly dots.
for(const hour of [1,1.5,2,4,8,16,24]){
  const rows=read(`leaderboardAtTime(overview,${hour})`);
  const expected=read(`overview.series.map(s=>({key:s.key,value:s.fit.predict(${hour})}))`);
  for(const row of rows)assert.ok(Math.abs(row.value-expected.find(r=>r.key===row.key).value)<1e-12);
  for(let i=1;i<rows.length;i++)assert.ok(rows[i-1].value>=rows[i].value);
}
assert.notEqual(read('leaderboardAtTime(overview,1).map(r=>r.key).join()'),read('leaderboardAtTime(overview,24).map(r=>r.key).join()'));
// No predictions beyond a model's available trajectory.
assert.equal(read('leaderboardAtTime({series:[{key:ORDER[0],points:[{hour:2}],fit:{predict:()=>.5}}]},3)[0].value'),null);
console.log('Trajectory leaderboard matches all 9 existing fits; ranks change; no extrapolation past observed horizons.');
