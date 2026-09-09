const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'scripts', 'compare_score_snapshots.cjs');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'score-compare-'));
const beforePath = path.join(temporary, 'before.js');
const afterPath = path.join(temporary, 'after.js');
const outputPath = path.join(temporary, 'changes.json');
const markdownPath = path.join(temporary, 'changes.md');
const rejectedAfterPath = path.join(temporary, 'rejected-after.js');
const scopeBeforePath = path.join(temporary, 'scope-before.js');
const scopeAfterPath = path.join(temporary, 'scope-after.js');
const scopeOutputPath = path.join(temporary, 'scope-changes.json');
const scopeMarkdownPath = path.join(temporary, 'scope-changes.md');
const {assertRefreshScope, loadSnapshot, main} = require(script);

function run(model, evaluationId, score, apiCost, outputTokens) {
  return {
    model,
    evaluationId,
    hours: 24,
    apiCost,
    submissions: 2,
    outputTokens,
    points: [{seconds: 3600, bestValidation: score, testAtBest: score}]
  };
}

function fixture(changed) {
  const models = [
    {name: 'Claude Fable 5.1', codename: 'vesper-pro'},
    {name: 'GPT-5.6 Sol', codename: 'skylark'},
    {name: 'Muse Spark 1.3', codename: 'granola-plus'}
  ];
  return {
    models,
    aggregates: models.map(model => ({key: model.codename, name: model.name})),
    tasks: [
      {
        name: 'FasterGCG candidate token ranking',
        models: [
          run('vesper-pro', 'faster-fable', .3, 12, 120),
          run('skylark', changed ? 'faster-sol-new' : 'faster-sol-old', .35, 14, 140),
          run('granola-plus', changed ? 'faster-muse-new' : 'faster-muse-old', .4, 10, 100)
        ]
      },
      {
        name: 'CPU LLM decode throughput',
        models: [
          run('vesper-pro', changed ? 'cpu-new' : 'cpu-old', changed ? .8 : .2, changed ? 5 : 20, changed ? 50 : 200),
          run('skylark', 'cpu-sol', .35, 14, 140),
          run('granola-plus', 'cpu-muse', .5, 10, 100)
        ]
      },
      {
        name: 'SVDQuant W4A4 reconstruction',
        models: [
          {...run('vesper-pro', 'svd-fable', changed ? .45 : .2, changed ? 19 : 20, changed ? 190 : 200), submissions: changed ? 3 : 2},
          run('skylark', 'svd-sol', .35, 14, 140),
          run('granola-plus', 'svd-muse', .5, 10, 100)
        ]
      }
    ]
  };
}

function scopeOnlyFixture(changed) {
  const data = fixture(false);
  if (changed) {
    data.tasks[0].models[1].evaluationId = 'faster-sol-new';
    data.tasks[0].models[2].evaluationId = 'faster-muse-new';
  }
  return data;
}

function runMain(args) {
  const originalArgv = process.argv;
  process.argv = [process.execPath, script, ...args];
  try {
    main();
  } finally {
    process.argv = originalArgv;
  }
}

fs.writeFileSync(beforePath, `window.ARB_DATA = ${JSON.stringify(fixture(false))};\n`);
fs.writeFileSync(afterPath, `window.ARB_DATA = ${JSON.stringify(fixture(true))};\n`);
runMain(['--before', beforePath, '--after', afterPath, '--output', outputPath, '--markdown', markdownPath]);
const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
assert.equal(report.schema_version, 2);
assert.equal(report.changed_cells.length, 4);
const fasterSol = report.changed_cells.find(cell => cell.task === 'FasterGCG candidate token ranking' && cell.model === 'GPT-5.6 Sol');
assert.equal(fasterSol.before.evaluation_id, 'faster-sol-old');
assert.equal(fasterSol.after.evaluation_id, 'faster-sol-new');
const fasterMuse = report.changed_cells.find(cell => cell.task === 'FasterGCG candidate token ranking' && cell.model === 'Muse Spark 1.3');
assert.equal(fasterMuse.before.evaluation_id, 'faster-muse-old');
assert.equal(fasterMuse.after.evaluation_id, 'faster-muse-new');
const replaced = report.changed_cells.find(cell => cell.task === 'CPU LLM decode throughput');
assert.equal(replaced.before.evaluation_id, 'cpu-old');
assert.equal(replaced.after.evaluation_id, 'cpu-new');
const sameId = report.changed_cells.find(cell => cell.task === 'SVDQuant W4A4 reconstruction');
assert.equal(sameId.before.evaluation_id, 'svd-fable');
assert.equal(sameId.after.evaluation_id, 'svd-fable');
assert.ok(sameId.changed_fields.includes('hidden_test_auarc'));
assert.ok(sameId.changed_fields.includes('api_cost'));
assert.equal(sameId.delta.submissions, 1);
assert.deepEqual(Object.keys(report.aggregate_orderings), [
  'hidden_test_auarc', 'validation_auarc', 'final_hidden', 'relative_gap',
  'elo', 'mean_api_cost', 'submissions', 'output_tokens'
]);
for (const field of ['validation_auarc', 'hidden_test_auarc', 'final_hidden']) {
  assert.equal(report.task_ordering_changes[field].length, 2, field);
}
for (const field of ['api_cost', 'output_tokens']) {
  assert.equal(report.task_ordering_changes[field].length, 1, field);
}
assert.equal(report.time_leaderboard_ordering_changes.frame_count, 241);
assert.ok(report.time_leaderboard_ordering_changes.changed_frame_count > 0);
assert.equal(report.time_leaderboard_ordering_changes.final_24_hour_state.hour, 24);
assert.ok(report.continual_improvement_ordering_changes);
assert.ok(report.continual_improvement_ordering_changes.hourly_mean_ordering_changes.length > 0);
assert.deepEqual(report.invariants, {
  fastergcg_other_models_unchanged: true,
  muse_other_tasks_unchanged: true,
  fastergcg_sol_changed: true,
  fastergcg_muse_changed: true
});
const markdown = fs.readFileSync(markdownPath, 'utf8');
assert.ok(markdown.startsWith('# Plot changes on 2026-09-09\n\nThis report compares the prior blog data with the refreshed 24 hour results.\n'));
assert.ok(markdown.includes('## Time AUARC plot'));
assert.ok(markdown.includes('## Understanding continual model improvement'));
assert.ok(markdown.includes('### Mean hidden-test reward over time'));
assert.ok(markdown.includes('### Runs that improve later'));
assert.ok(markdown.includes('| CPU LLM decode throughput | Muse Spark 1.3 < GPT-5.6 Sol < Claude Fable 5.1 | Claude Fable 5.1 < Muse Spark 1.3 < GPT-5.6 Sol |'));

function assertRejected(mutator, message) {
  const rejected = fixture(true);
  mutator(rejected);
  fs.writeFileSync(rejectedAfterPath, `window.ARB_DATA = ${JSON.stringify(rejected)};\n`);
  assert.throws(() => assertRefreshScope(loadSnapshot(beforePath), loadSnapshot(rejectedAfterPath)), message);
}

assertRejected(after => {
  after.tasks[0].models[2] = fixture(false).tasks[0].models[2];
}, /Muse Spark 1\.3 for FasterGCG candidate token ranking must change/);
assertRejected(after => {
  after.tasks[0].models[1] = fixture(false).tasks[0].models[1];
}, /GPT-5\.6 Sol for FasterGCG candidate token ranking must change/);
assertRejected(after => {
  after.tasks[0].models[0].apiCost = 99;
}, /FasterGCG other model changed/);
assertRejected(after => {
  after.tasks[1].models[2].outputTokens = 99;
}, /Muse outside FasterGCG changed/);

fs.writeFileSync(scopeBeforePath, `window.ARB_DATA = ${JSON.stringify(scopeOnlyFixture(false))};\n`);
fs.writeFileSync(scopeAfterPath, `window.ARB_DATA = ${JSON.stringify(scopeOnlyFixture(true))};\n`);
const scopeResult = spawnSync(process.execPath, [script, '--before', scopeBeforePath, '--after', scopeAfterPath, '--output', scopeOutputPath, '--markdown', scopeMarkdownPath], {encoding: 'utf8'});
assert.equal(scopeResult.status, 0, scopeResult.stderr || scopeResult.error?.message);
const scopeReport = JSON.parse(fs.readFileSync(scopeOutputPath, 'utf8'));
assert.equal(scopeReport.changed_cells.length, 2);
assert.deepEqual(scopeReport.changed_cells.map(cell => cell.model).sort(), ['GPT-5.6 Sol', 'Muse Spark 1.3']);
const finalState = scopeReport.time_leaderboard_ordering_changes.final_24_hour_state;
assert.equal(scopeReport.time_leaderboard_ordering_changes.changed_frame_count, 0);
assert.equal(finalState.changed, false);
assert.deepEqual(finalState.after, finalState.before);
const finalValues = finalState.before.map(row => `${row.model} (${row.value.toFixed(3)})`).join(' > ');
const scopeMarkdown = fs.readFileSync(scopeMarkdownPath, 'utf8');
assert.ok(scopeMarkdown.includes(`At 24 hours, the model order is unchanged. Before: ${finalValues}. After: ${finalValues}.`));
console.log('Score snapshot comparison checks passed.');
