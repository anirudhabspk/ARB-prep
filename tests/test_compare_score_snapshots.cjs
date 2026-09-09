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
const unchangedOutputPath = path.join(temporary, 'unchanged.json');
const unchangedMarkdownPath = path.join(temporary, 'unchanged.md');

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
          run('granola-plus', 'faster-muse', .4, 10, 100)
        ]
      },
      {
        name: 'CPU LLM decode throughput',
        models: [
          run('vesper-pro', changed ? 'cpu-new' : 'cpu-old', changed ? .8 : .2, changed ? 5 : 20, changed ? 50 : 200),
          run('granola-plus', 'cpu-muse', .5, 10, 100)
        ]
      },
      {
        name: 'SVDQuant W4A4 reconstruction',
        models: [
          {...run('vesper-pro', 'svd-fable', changed ? .45 : .2, changed ? 19 : 20, changed ? 190 : 200), submissions: changed ? 3 : 2},
          run('granola-plus', 'svd-muse', .5, 10, 100)
        ]
      }
    ]
  };
}

fs.writeFileSync(beforePath, `window.ARB_DATA = ${JSON.stringify(fixture(false))};\n`);
fs.writeFileSync(afterPath, `window.ARB_DATA = ${JSON.stringify(fixture(true))};\n`);
const result = spawnSync(process.execPath, [script, '--before', beforePath, '--after', afterPath, '--output', outputPath, '--markdown', markdownPath], {encoding: 'utf8'});
assert.equal(result.status, 0, result.stderr);
const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
assert.equal(report.schema_version, 2);
assert.equal(report.changed_cells.length, 2);
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
for (const field of ['validation_auarc', 'hidden_test_auarc', 'final_hidden', 'api_cost', 'output_tokens']) {
  assert.equal(report.task_ordering_changes[field].length, 1, field);
}
assert.equal(report.time_leaderboard_ordering_changes.frame_count, 241);
assert.ok(report.time_leaderboard_ordering_changes.changed_frame_count > 0);
assert.equal(report.time_leaderboard_ordering_changes.final_24_hour_state.hour, 24);
assert.ok(report.continual_improvement_ordering_changes);
assert.ok(report.continual_improvement_ordering_changes.hourly_mean_ordering_changes.length > 0);
assert.equal(report.invariants.fastergcg_unchanged, true);
assert.equal(report.invariants.muse_spark_1_3_unchanged, true);
const markdown = fs.readFileSync(markdownPath, 'utf8');
assert.ok(markdown.includes('# Plot ranking changes'));
assert.ok(markdown.includes('## Time AUARC plot'));
assert.ok(markdown.includes('## Understanding continual model improvement'));
assert.ok(markdown.includes('### Mean hidden-test reward over time'));
assert.ok(markdown.includes('### Runs that improve later'));
assert.ok(markdown.includes('| CPU LLM decode throughput | Muse Spark 1.3 < Claude Fable 5.1 | Claude Fable 5.1 < Muse Spark 1.3 |'));
const unchangedResult = spawnSync(process.execPath, [script, '--before', afterPath, '--after', afterPath, '--output', unchangedOutputPath, '--markdown', unchangedMarkdownPath], {encoding: 'utf8'});
assert.equal(unchangedResult.status, 0, unchangedResult.stderr);
const unchangedReport = JSON.parse(fs.readFileSync(unchangedOutputPath, 'utf8'));
assert.equal(unchangedReport.time_leaderboard_ordering_changes.changed_frame_count, 0);
assert.equal(unchangedReport.time_leaderboard_ordering_changes.final_24_hour_state.changed, false);
assert.equal(unchangedReport.continual_improvement_ordering_changes.hourly_mean_ordering_changes.length, 0);
assert.equal(unchangedReport.continual_improvement_ordering_changes.later_improvement_ordering_changes.length, 0);
const unchangedMarkdown = fs.readFileSync(unchangedMarkdownPath, 'utf8');
assert.ok(unchangedMarkdown.includes('At 24 hours, the model order is unchanged.'));
assert.match(unchangedMarkdown, /Claude Fable 5\.1 \([0-9]+\.[0-9]{3}\)/);
console.log('Score snapshot comparison checks passed.');
