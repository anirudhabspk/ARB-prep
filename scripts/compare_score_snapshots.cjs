#!/usr/bin/env node
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const scoringFiles = ['raw-score-maps.js', 'difficulty-reward-maps.js', 'results.js'];
const usage = `Usage: node scripts/compare_score_snapshots.cjs --before FILE --after FILE --output FILE [--markdown FILE]

Compare two site-data.js snapshots using the repository's current scoring code.
The JSON output records changed cells, aggregate and task ranking changes, the
cost frontier, continual-improvement panels, and all 241 time-leaderboard
frames with changed ordering.`;

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return null;
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!['--before', '--after', '--output', '--markdown'].includes(flag) || !value) {
      throw new Error(`${usage}\n\nUnknown or incomplete argument: ${flag || '(missing)'}`);
    }
    if (options[flag]) throw new Error(`Duplicate argument: ${flag}`);
    options[flag] = value;
  }
  for (const flag of ['--before', '--after', '--output']) {
    if (!options[flag]) throw new Error(`${usage}\n\nMissing required argument: ${flag}`);
  }
  return {before: options['--before'], after: options['--after'], output: options['--output'], markdown: options['--markdown']};
}

function scoringSource(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  return file === 'results.js' ? source.split('if(document.body.dataset.page')[0] : source;
}

const snapshotExpression = `JSON.stringify((() => {
  const results = currentResults().rows;
  const costs = new Map(costPerformanceRows(results).map(row => [row.key, row]));
  const effort = new Map(effortModelRows().map(row => [row.key, row]));
  const tasks = DATA.tasks.map(task => ({
    task: task.name,
    models: task.models.map(run => {
      const stats = difficultyAdjustedRunStats(task, run);
      return {
        key: run.model,
        model: MODEL[run.model]?.name || run.model,
        evaluation_id: run.evaluationId || null,
        validation_auarc: stats?.validation ?? null,
        hidden_test_auarc: stats?.test ?? null,
        final_hidden: stats?.final ?? null,
        api_cost: Number.isFinite(run.apiCost) ? run.apiCost : null,
        submissions: Number.isFinite(run.submissions) ? run.submissions : null,
        output_tokens: Number.isFinite(run.outputTokens) ? run.outputTokens : null
      };
    })
  }));
  const aggregates = results.map(row => {
    const cost = costs.get(row.key), work = effort.get(row.key);
    const tokens = DATA.tasks.flatMap(task => task.models.flatMap(run =>
      run.model === row.key && difficultyAdjustedRunStats(task, run) && Number.isFinite(run.outputTokens)
        ? [run.outputTokens]
        : []
    ));
    return {
      key: row.key,
      model: row.name,
      hidden_test_auarc: row.test,
      validation_auarc: row.validation,
      final_hidden: row.final,
      relative_gap: row.gap,
      elo: row.elo,
      mean_api_cost: cost?.cost ?? null,
      submissions: work?.submissions ?? null,
      output_tokens: mean(tokens)
    };
  });
  const frontier = wholeDollarCostFrontier(costPerformanceRows(results)).map(row => ({
    key: row.key,
    model: row.name,
    mean_api_cost: row.cost,
    hidden_test_auarc: row.test
  }));
  const runs = leaderboardRuns(), steps = 240, minHour = .25, maxHour = 24;
  const time_frames = Array.from({length: steps + 1}, (_, frame) => {
    const hour = minHour * Math.pow(maxHour / minHour, frame / steps);
    return {frame, hour, rows: leaderboardAtTime(runs, hour).map(row => ({
      key: row.key,
      model: row.name,
      value: row.value
    }))};
  });
  const overview = overviewTrajectories();
  const continual_improvement = {
    hourly_means: overview.series.map(series => ({
      key: series.key,
      model: series.name,
      points: series.points
    })),
    fitted_fable_astra_crossing_hour: trajectoryCrossingHour(overview, 'meridian', 'vesper-pro'),
    later_improvement: lateImprovementSeries().map(series => ({
      key: series.key,
      model: series.name,
      points: series.points
    }))
  };
  return {snapshot: DATA.snapshot || null, models: ORDER, tasks, aggregates, frontier, time_frames, continual_improvement};
})())`;

function loadSnapshot(siteDataPath) {
  const context = vm.createContext({window: {}, console});
  const resolved = path.resolve(siteDataPath);
  vm.runInContext(fs.readFileSync(resolved, 'utf8'), context, {filename: resolved});
  for (const file of scoringFiles) {
    vm.runInContext(scoringSource(file), context, {filename: path.join(root, file)});
  }
  return JSON.parse(vm.runInContext(snapshotExpression, context));
}

const finite = value => typeof value === 'number' && Number.isFinite(value);
const delta = (before, after) => finite(before) && finite(after) ? after - before : null;
const orderKeys = rows => rows.map(row => row.key);
const sameOrder = (before, after) => JSON.stringify(orderKeys(before)) === JSON.stringify(orderKeys(after));

function cellMap(snapshot) {
  return new Map(snapshot.tasks.flatMap(task => task.models.map(model => [`${task.task}\u0000${model.key}`, {task: task.task, ...model}])));
}

function comparableCell(cell) {
  return {
    key: cell.key,
    model: cell.model,
    evaluation_id: cell.evaluation_id,
    validation_auarc: cell.validation_auarc,
    hidden_test_auarc: cell.hidden_test_auarc,
    final_hidden: cell.final_hidden,
    api_cost: cell.api_cost,
    submissions: cell.submissions,
    output_tokens: cell.output_tokens
  };
}

function assertExclusions(before, after) {
  const beforeTasks = new Map(before.tasks.map(task => [task.task, task]));
  const afterTasks = new Map(after.tasks.map(task => [task.task, task]));
  const excludedTask = 'FasterGCG candidate token ranking';
  assert(beforeTasks.has(excludedTask), `Missing excluded task: ${excludedTask}`);
  assert.deepStrictEqual(afterTasks.get(excludedTask), beforeTasks.get(excludedTask), `${excludedTask} changed`);

  const museName = 'Muse Spark 1.3';
  const muse = snapshot => snapshot.tasks.map(task => {
    const model = task.models.find(row => row.model === museName);
    assert(model, `Missing ${museName} for ${task.task}`);
    return {task: task.task, ...comparableCell(model)};
  });
  assert.deepStrictEqual(muse(after), muse(before), `${museName} values changed`);
}

function changedCells(before, after) {
  const a = cellMap(before), b = cellMap(after);
  assert.deepStrictEqual([...b.keys()].sort(), [...a.keys()].sort(), 'Task/model cells differ between snapshots');
  return [...a].flatMap(([key, oldCell]) => {
    const newCell = b.get(key);
    const beforeValues = comparableCell(oldCell), afterValues = comparableCell(newCell);
    const changedFields = Object.keys(beforeValues).filter(field =>
      !['key', 'model'].includes(field) && !Object.is(beforeValues[field], afterValues[field])
    );
    if (!changedFields.length) return [];
    return [{
      task: oldCell.task,
      key: oldCell.key,
      model: oldCell.model,
      changed_fields: changedFields,
      before: beforeValues,
      after: afterValues,
      delta: {
        validation_auarc: delta(beforeValues.validation_auarc, afterValues.validation_auarc),
        hidden_test_auarc: delta(beforeValues.hidden_test_auarc, afterValues.hidden_test_auarc),
        final_hidden: delta(beforeValues.final_hidden, afterValues.final_hidden),
        api_cost: delta(beforeValues.api_cost, afterValues.api_cost),
        submissions: delta(beforeValues.submissions, afterValues.submissions),
        output_tokens: delta(beforeValues.output_tokens, afterValues.output_tokens)
      }
    }];
  });
}

function ranked(rows, field, direction, modelOrder) {
  const index = new Map(modelOrder.map((key, position) => [key, position]));
  return rows.filter(row => finite(row[field])).map(row => ({key: row.key, model: row.model, value: row[field]})).sort((a, b) => {
    const difference = direction === 'ascending' ? a.value - b.value : b.value - a.value;
    return difference || index.get(a.key) - index.get(b.key);
  });
}

const aggregateMetrics = {
  hidden_test_auarc: 'descending',
  validation_auarc: 'descending',
  final_hidden: 'descending',
  relative_gap: 'ascending',
  elo: 'descending',
  mean_api_cost: 'ascending',
  submissions: 'ascending',
  output_tokens: 'ascending'
};

const taskMetrics = {
  validation_auarc: 'descending',
  hidden_test_auarc: 'descending',
  final_hidden: 'descending',
  api_cost: 'ascending',
  output_tokens: 'ascending'
};

function aggregateOrderings(before, after) {
  return Object.fromEntries(Object.entries(aggregateMetrics).map(([field, direction]) => {
    const a = ranked(before.aggregates, field, direction, before.models);
    const b = ranked(after.aggregates, field, direction, after.models);
    return [field, {direction, changed: !sameOrder(a, b), before: a, after: b}];
  }));
}

function taskOrderingChanges(before, after) {
  const afterTasks = new Map(after.tasks.map(task => [task.task, task]));
  return Object.fromEntries(Object.entries(taskMetrics).map(([field, direction]) => {
    const changes = [];
    for (const task of before.tasks) {
      const next = afterTasks.get(task.task);
      assert(next, `Missing task after refresh: ${task.task}`);
      const a = ranked(task.models, field, direction, before.models);
      const b = ranked(next.models, field, direction, after.models);
      if (!sameOrder(a, b)) changes.push({task: task.task, direction, before: a, after: b});
    }
    return [field, changes];
  }));
}

function costFrontier(before, after) {
  return {
    changed: !sameOrder(before.frontier, after.frontier),
    before: before.frontier,
    after: after.frontier
  };
}

function timeOrderingChanges(before, after) {
  assert.equal(before.time_frames.length, 241);
  assert.equal(after.time_frames.length, 241);
  const finalBefore = before.time_frames.at(-1), finalAfter = after.time_frames.at(-1);
  assert.equal(finalBefore.hour, 24);
  assert.equal(finalAfter.hour, 24);
  const ranges = [];
  let current = null;
  let changedFrames = 0;
  for (let frame = 0; frame < 241; frame++) {
    const a = before.time_frames[frame], b = after.time_frames[frame];
    assert.equal(a.frame, b.frame);
    const beforeOrder = orderKeys(a.rows), afterOrder = orderKeys(b.rows);
    if (JSON.stringify(beforeOrder) === JSON.stringify(afterOrder)) {
      current = null;
      continue;
    }
    changedFrames++;
    const signature = JSON.stringify([beforeOrder, afterOrder]);
    if (current && current.end_frame === frame - 1 && current.signature === signature) {
      current.end_frame = frame;
      current.end_hour = b.hour;
    } else {
      current = {
        start_frame: frame,
        end_frame: frame,
        start_hour: b.hour,
        end_hour: b.hour,
        before_order: beforeOrder,
        after_order: afterOrder,
        signature
      };
      ranges.push(current);
    }
  }
  for (const range of ranges) delete range.signature;
  return {
    frame_count: 241,
    changed_frame_count: changedFrames,
    final_24_hour_state: {
      hour: 24,
      changed: !sameOrder(finalBefore.rows, finalAfter.rows),
      before: finalBefore.rows,
      after: finalAfter.rows
    },
    ranges
  };
}

function seriesRowsAtHour(series, hour, modelOrder) {
  const rows = series.map(item => {
    const point = item.points.find(candidate => candidate.hour === hour);
    assert(point, `Missing hour ${hour} for ${item.model}`);
    return {key: item.key, model: item.model, value: point.value};
  });
  return ranked(rows, 'value', 'descending', modelOrder);
}

function tiedGroups(rows, tolerance = 1e-10) {
  const groups = [];
  for (const row of rows) {
    const group = groups.at(-1);
    if (!group || Math.abs(group[0].value - row.value) > tolerance) groups.push([row]);
    else group.push(row);
  }
  return groups;
}

function groupKeys(groups) {
  return groups.map(group => group.map(row => row.key));
}

function changedSeriesModels(before, after) {
  const prior = new Map(before.map(series => [series.key, series]));
  return after.filter(series => {
    const earlier = prior.get(series.key);
    assert(earlier, `Missing prior continual-improvement series: ${series.model}`);
    return JSON.stringify(earlier.points) !== JSON.stringify(series.points);
  }).map(series => ({key: series.key, model: series.model}));
}

function continualImprovementChanges(before, after) {
  const earlier = before.continual_improvement, current = after.continual_improvement;
  assert(earlier && current, 'Missing continual-improvement snapshot data');
  const hourlyChanges = [];
  const hourlyHours = earlier.hourly_means[0]?.points.map(point => point.hour) || [];
  assert.deepStrictEqual(hourlyHours, current.hourly_means[0]?.points.map(point => point.hour) || []);
  for (const hour of hourlyHours) {
    const priorRows = seriesRowsAtHour(earlier.hourly_means, hour, before.models);
    const currentRows = seriesRowsAtHour(current.hourly_means, hour, after.models);
    if (!sameOrder(priorRows, currentRows)) hourlyChanges.push({hour, before: priorRows, after: currentRows});
  }

  const laterChanges = [];
  const laterHours = earlier.later_improvement[0]?.points.map(point => point.hour) || [];
  assert.deepStrictEqual(laterHours, current.later_improvement[0]?.points.map(point => point.hour) || []);
  for (const hour of laterHours) {
    const priorGroups = tiedGroups(seriesRowsAtHour(earlier.later_improvement, hour, before.models));
    const currentGroups = tiedGroups(seriesRowsAtHour(current.later_improvement, hour, after.models));
    if (JSON.stringify(groupKeys(priorGroups)) !== JSON.stringify(groupKeys(currentGroups))) {
      laterChanges.push({hour, before: priorGroups, after: currentGroups});
    }
  }

  return {
    hourly_mean_changed_models: changedSeriesModels(earlier.hourly_means, current.hourly_means),
    hourly_mean_ordering_changes: hourlyChanges,
    fitted_fable_astra_crossing_hour: {
      before: earlier.fitted_fable_astra_crossing_hour,
      after: current.fitted_fable_astra_crossing_hour,
      delta: delta(earlier.fitted_fable_astra_crossing_hour, current.fitted_fable_astra_crossing_hour)
    },
    later_improvement_changed_models: changedSeriesModels(earlier.later_improvement, current.later_improvement),
    later_improvement_ordering_changes: laterChanges
  };
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
}

const metricLabels = {
  hidden_test_auarc: 'Hidden-test AUARC',
  validation_auarc: 'Validation AUARC',
  final_hidden: 'Final hidden-test score',
  relative_gap: 'Relative validation-to-test gap',
  elo: 'Task-relative Elo',
  mean_api_cost: 'Mean API cost',
  submissions: 'Mean submissions',
  output_tokens: 'Mean output tokens',
  api_cost: 'API cost'
};
const orderText = (rows, direction = 'descending') => rows.map(row => row.model).join(direction === 'ascending' ? ' < ' : ' > ');
const orderWithValues = rows => rows.map(row => `${row.model} (${row.value.toFixed(3)})`).join(' > ');
const tiedOrderWithValues = groups => groups.map(group => `${group.map(row => row.model).join(' = ')} (${group[0].value.toFixed(1)}%)`).join(' > ');
const hourText = value => value < 1 ? `${Math.round(value * 60)}m` : `${value.toFixed(2)}h`;

function renderMarkdown(report) {
  const changedAggregates = Object.entries(report.aggregate_orderings).filter(([, item]) => item.changed);
  const unchangedAggregates = Object.entries(report.aggregate_orderings).filter(([, item]) => !item.changed);
  const lines = [
    '# Plot ranking changes on 2026-09-09',
    '',
    'This report compares the prior blog data with the refreshed 24 hour results. FasterGCG and every Muse Spark 1.3 result are unchanged.',
    '',
    '## Overall plots',
    '',
    `The order changed in ${changedAggregates.length} aggregate comparisons. The order did not change for ${unchangedAggregates.map(([key]) => metricLabels[key]).join(', ')}.`,
    ''
  ];
  for (const [key, item] of changedAggregates) {
    lines.push(`- ${metricLabels[key]}. Before: ${orderText(item.before, item.direction)}. After: ${orderText(item.after, item.direction)}.`);
  }
  lines.push('', report.cost_frontier.changed
    ? `The cost frontier changed from ${orderText(report.cost_frontier.before, 'ascending')} to ${orderText(report.cost_frontier.after, 'ascending')}.`
    : `The cost frontier is unchanged: ${orderText(report.cost_frontier.after, 'ascending')}.`, '');
  lines.push('## Task plots', '');
  for (const [key, changes] of Object.entries(report.task_ordering_changes)) {
    lines.push(`### ${metricLabels[key]}`, '');
    if (!changes.length) {
      lines.push('No task order changed.', '');
      continue;
    }
    lines.push('| Task | Before | After |', '| --- | --- | --- |');
    for (const item of changes) {
      lines.push(`| ${item.task} | ${orderText(item.before, item.direction)} | ${orderText(item.after, item.direction)} |`);
    }
    lines.push('');
  }
  const time = report.time_leaderboard_ordering_changes;
  const final = time.final_24_hour_state;
  lines.push(
    '## Time AUARC plot',
    '',
    `At 24 hours, the model order ${final.changed ? 'changed' : 'is unchanged'}. Before: ${orderWithValues(final.before)}. After: ${orderWithValues(final.after)}.`,
    '',
    `${time.changed_frame_count} of ${time.frame_count} sampled time frames changed order. The changes fall into these ranges:`,
    '',
    '| Time range | Before | After |',
    '| --- | --- | --- |'
  );
  for (const range of time.ranges) {
    const label = range.start_frame === range.end_frame ? hourText(range.start_hour) : `${hourText(range.start_hour)} to ${hourText(range.end_hour)}`;
    lines.push(`| ${label} | ${orderText(range.before_order.map(key => ({model: report.model_names[key]})))} | ${orderText(range.after_order.map(key => ({model: report.model_names[key]})))} |`);
  }
  const continual = report.continual_improvement_ordering_changes;
  const modelList = items => items.length ? items.map(item => item.model).join(' and ') : 'no models';
  const changedHours = items => items.length ? items.map(item => `${item.hour}h`).join(', ') : 'no plotted hours';
  const hourlyModels = modelList(continual.hourly_mean_changed_models);
  const laterModels = modelList(continual.later_improvement_changed_models);
  const crossing = continual.fitted_fable_astra_crossing_hour;
  const crossingText = finite(crossing.before) && finite(crossing.after)
    ? `The fitted Fable–Astra crossing moved from ${crossing.before.toFixed(3)} hours to ${crossing.after.toFixed(3)} hours.`
    : 'A fitted Fable–Astra crossing is not available in both snapshots.';
  lines.push(
    '',
    '## Understanding continual model improvement',
    '',
    `The hourly mean and fitted trajectories changed for ${hourlyModels}. ${crossingText}`,
    '',
    '### Mean hidden-test reward over time',
    '',
    `Ordering changed at ${changedHours(continual.hourly_mean_ordering_changes)}.`,
    '',
    '| Hour | Before | After |',
    '| --- | --- | --- |'
  );
  for (const item of continual.hourly_mean_ordering_changes) {
    lines.push(`| ${item.hour}h | ${orderWithValues(item.before)} | ${orderWithValues(item.after)} |`);
  }
  lines.push(
    '',
    '### Runs that improve later',
    '',
    `The plotted series changed for ${laterModels}. Ordering or tie groups changed at ${changedHours(continual.later_improvement_ordering_changes)}.`,
    '',
    '| Hour | Before | After |',
    '| --- | --- | --- |'
  );
  for (const item of continual.later_improvement_ordering_changes) {
    lines.push(`| ${item.hour}h | ${tiedOrderWithValues(item.before)} | ${tiedOrderWithValues(item.after)} |`);
  }
  lines.push('');
  return `${lines.join('\n').trimEnd()}\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    console.log(usage);
    return;
  }
  const before = loadSnapshot(options.before), after = loadSnapshot(options.after);
  assertExclusions(before, after);
  const output = {
    schema_version: 2,
    before_snapshot: before.snapshot,
    after_snapshot: after.snapshot,
    model_names: Object.fromEntries(after.aggregates.map(row => [row.key, row.model])),
    scoring_inputs: Object.fromEntries(scoringFiles.map(file => [file, {sha256: sha256(file)}])),
    invariants: {fastergcg_unchanged: true, muse_spark_1_3_unchanged: true},
    changed_cells: changedCells(before, after),
    aggregate_orderings: aggregateOrderings(before, after),
    cost_frontier: costFrontier(before, after),
    task_ordering_changes: taskOrderingChanges(before, after),
    time_leaderboard_ordering_changes: timeOrderingChanges(before, after),
    continual_improvement_ordering_changes: continualImprovementChanges(before, after)
  };
  const target = path.resolve(options.output);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
  if (options.markdown) {
    const markdown = path.resolve(options.markdown);
    fs.mkdirSync(path.dirname(markdown), {recursive: true});
    fs.writeFileSync(markdown, renderMarkdown(output));
  }
  console.log(JSON.stringify({
    output: target,
    changed_cells: output.changed_cells.length,
    changed_aggregate_orders: Object.values(output.aggregate_orderings).filter(item => item.changed).length,
    changed_task_orders: Object.values(output.task_ordering_changes).reduce((count, items) => count + items.length, 0),
    changed_time_frames: output.time_leaderboard_ordering_changes.changed_frame_count
  }));
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
