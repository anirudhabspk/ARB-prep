#!/usr/bin/env node
/*
 * Creates the browser-ready hint experiment data asset from the rollout handoff.
 *
 * Example:
 *   node scripts/build_opsd_hint_data.cjs --input ~/Work/arb-hint-results/results.json
 */
const fs=require("fs");
const path=require("path");

const args=process.argv.slice(2);
const option=name=>{const index=args.indexOf(name);return index<0?null:args[index+1]||null};
const input=option("--input")||path.join(process.env.HOME||"","Work/arb-hint-results/results.json");
const output=option("--output")||path.resolve(__dirname,"..","opsd-hints-data.js");

if(!fs.existsSync(input)){
  console.error(`Hint experiment data not found: ${input}`);
  process.exit(1);
}

const source=JSON.parse(fs.readFileSync(input,"utf8"));
const task=([key,value])=>({
  key,
  gpu:Boolean(value.gpu),
  noneGranola:value.none_granola||null,
  fairGranola:value.fair_granola||[],
  valGranola:value.val_granola||[],
  fairLumen:value.fair_lumen||[],
  valLumen:value.val_lumen||[]
});
const data={
  generated:source.meta?.generated||null,
  benchmark:source.meta?.benchmark||null,
  agent:source.meta?.agent||null,
  arms:source.meta?.arms||{},
  models:source.meta?.models||{},
  costs:source.meta?.cost_usd||{},
  caveats:source.meta?.caveats||[],
  summary:source.summary||{},
  tasks:Object.entries(source.tasks||{}).map(task)
};

fs.writeFileSync(output,`window.OPSD_HINT_DATA = ${JSON.stringify(data,null,2)};\n`);
console.log(`Wrote ${output}`);
