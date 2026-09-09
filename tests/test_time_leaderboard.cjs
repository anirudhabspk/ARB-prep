const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),c=vm.createContext({window:{},console});
for(const file of ['site-data.js','raw-score-maps.js','difficulty-reward-maps.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
vm.runInContext(fs.readFileSync(path.join(root,'results.js'),'utf8').split('if(document.body.dataset.page')[0],c);
const read=s=>vm.runInContext(s,c);
// Final frame must agree with every headline mean, including the existing duration policy.
const final=read('leaderboardAtTime(leaderboardRuns(),24)'),headline=read('currentResults().rows');
for(const row of final){assert.ok(Math.abs(row.value-headline.find(r=>r.key===row.key).test)<1e-12);assert.equal(row.count,29);}
// An independent integration verifies partial windows without future checkpoint leakage.
read('var reviewRuns=leaderboardRuns()');
for(const hour of [.25,1,4,16,24]){
  const actual=read(`leaderboardAtTime(reviewRuns,${hour})`),runs=read('reviewRuns');
  for(const row of actual){const values=runs.filter(r=>r.key===row.key).map(run=>{const end=Math.min(hour*3600,run.end);let area=0,t=0,v=0;for(const p of run.points){if(p.seconds>end)break;area+=v*(p.seconds-t);t=p.seconds;if(p.value!=null)v=p.value;}return(area+v*(end-t))/end;});const expected=values.reduce((a,b)=>a+b,0)/values.length;assert.ok(Math.abs(row.value-expected)<1e-10);}
}
const early=read('leaderboardAtTime(reviewRuns,.25).map(r=>r.key).join()'),late=final.map(r=>r.key).join();assert.notEqual(early,late);
console.log('Leaderboard checks passed: all 9 endpoints, 29 tasks each, partial-window integration, changing ranks.');
const html=read('mainAuarcLeaderboard(currentResults().rows)');
assert.equal((html.match(/class="auarc-interval"/g)||[]).length,9);
for(const row of headline)assert.ok(html.includes(`>${row.test.toFixed(3)}</strong>`));
assert.ok(html.indexOf('Measures Area Under the AutoResearch Curve')>html.indexOf('class="auarc-axis"'));
assert.ok(html.includes('<a href="#hidden-test-auarc">Main evaluation metric: hidden-test AUARC</a>'));
assert.ok(!html.includes('<h1>Overview</h1>'));
const blog=fs.readFileSync(path.join(root,'blog.html'),'utf8');
const css=fs.readFileSync(path.join(root,'site.css'),'utf8');
assert.ok(blog.includes('<h3 id="hidden-test-auarc">Main evaluation metric: hidden-test AUARC</h3>'));
assert.ok(blog.includes('<a href="#leaderboard">Leaderboard</a>\n    <a href="#benchmark">Overview and Motivation</a>'));
assert.ok(blog.includes('<section class="section" id="leaderboard">\n      <h2>Leaderboard</h2>\n      <div id="main-leaderboard" class="main-leaderboard"></div>\n    </section>'));
assert.ok(blog.includes('<section class="section" id="benchmark">\n      <h2>Overview and Motivation</h2>'));
assert.match(css,/\.blog-page p\.plot-takeaway\{[^}]*max-width:var\(--content-measure\)[^}]*color:var\(--ink\)[^}]*font-size:var\(--article-copy-size\)/);
assert.ok(css.includes('.time-leaderboard{max-width:var(--content-measure)'));
assert.ok(css.includes('.main-leaderboard{max-width:var(--content-measure)'));
assert.ok(css.includes('.blog-page main #results{max-width:var(--content-measure);font-size:var(--article-copy-size)'));
assert.ok(css.includes('.hint-lanes{max-width:var(--content-measure)'));
assert.ok(!css.includes('#benchmark{padding-bottom:0}'));
