#!/usr/bin/env python3
"""Build candidate general analysis charts from the site's selected runs.

The input is site-data.js, which is produced by the benchmark score refresh.
This keeps the charts on the same evaluation IDs as the benchmark pages.
"""

import argparse
import html
import json
import math
import re
import statistics
from pathlib import Path


COLORS = [
    "#6A3D9A", "#D95F02", "#1F78B4", "#E7298A", "#1B9E77",
    "#A6761D", "#00A6D6", "#4D4D4D", "#B2182B",
]
HOURS = [1, 2, 3, 4, 6, 8, 12, 16, 20, 24]
SVG_STYLE = """
<style>
text{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#181817}
.muted{fill:#6f716f}.grid{stroke:#ecece8;stroke-width:1}.axis{stroke:#babbb7;stroke-width:1}
.legend{font-size:10px}.label{font-size:11px}.tick{font-size:10px;fill:#6f716f}
</style>
""".strip()


def read_site_data(path):
    text = path.read_text()
    match = re.search(r"window\.ARB_DATA\s*=\s*(\{.*\})\s*;\s*$", text, re.S)
    if not match:
        raise ValueError(f"Could not read window.ARB_DATA from {path}")
    return json.loads(match.group(1))


def selected_rows(data):
    names = {model["codename"]: model["name"] for model in data["models"]}
    rows = []
    seen = set()
    for task in data["tasks"]:
        for run in task["models"]:
            key = (task["name"], run["model"])
            if key in seen:
                raise ValueError(f"More than one selected run for {key}")
            seen.add(key)
            if not run.get("evaluationId"):
                raise ValueError(f"Selected run has no evaluation ID for {key}")
            points = [point for point in run.get("points", []) if point.get("testAtBest") is not None]
            if not points:
                continue
            rows.append({
                "task": task["name"],
                "model": run["model"],
                "name": names[run["model"]],
                "evaluation_id": run["evaluationId"],
                "points": points,
                "submissions": run.get("submissions"),
                "work_hours": run.get("workHours"),
                "hours": run.get("displayHours") or run.get("hours") or 24,
                "final_validation": points[-1]["bestValidation"],
                "final_test": points[-1]["testAtBest"],
            })
    evaluation_ids = [row["evaluation_id"] for row in rows]
    if len(evaluation_ids) != len(set(evaluation_ids)):
        raise ValueError("Selected evaluation IDs are not unique")
    return rows, names


def quantile(values, probability):
    values = sorted(values)
    if not values:
        return None
    position = (len(values) - 1) * probability
    lower, upper = math.floor(position), math.ceil(position)
    return values[lower] + (values[upper] - values[lower]) * (position - lower)


def median(values):
    values = [value for value in values if value is not None]
    return statistics.median(values) if values else None


def at_hour(points, hour):
    value = None
    for point in points:
        if point["seconds"] <= hour * 3600:
            value = point["testAtBest"]
    return value if value is not None else points[0]["testAtBest"]


def last_improvement_hour(points):
    best = -math.inf
    last = 0.0
    for point in points:
        value = point["testAtBest"]
        if value > best + 1e-9:
            best = value
            last = point["seconds"] / 3600
    return last


def improvement_rate(row):
    best = -math.inf
    improvements = 0
    for point in row["points"]:
        value = point["bestValidation"]
        if value is not None and value > best + 1e-9:
            best = value
            improvements += 1
    denominator = row["submissions"] or len(row["points"])
    return improvements / denominator if denominator else None


def esc(value):
    return html.escape(str(value), quote=True)


def svg_open(width, height, title):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'role="img" aria-label="{esc(title)}">{SVG_STYLE}'
    )


def svg_text(x, y, text, css="label", anchor="start", rotate=None):
    transform = f' transform="rotate({rotate} {x} {y})"' if rotate is not None else ""
    return f'<text class="{css}" x="{x:.1f}" y="{y:.1f}" text-anchor="{anchor}"{transform}>{esc(text)}</text>'


def bar_pair_chart(order, names, colors, submissions, hit_rates):
    width, height = 900, 350
    left, top, bottom, panel = 145, 35, 65, 285
    gap, second = 95, left + panel + 95
    row_h = (height - top - bottom) / len(order)
    max_sub = max(submissions.values()) * 1.08
    out = [svg_open(width, height, "Submissions and validation improvement rate by model")]
    for x0, maximum, title in ((left, max_sub, "Median submissions per run"), (second, 1, "Submissions that improved validation")):
        out.append(svg_text(x0, 18, title, "label"))
        for tick in range(5):
            value = maximum * tick / 4
            x = x0 + panel * tick / 4
            out.append(f'<line class="grid" x1="{x}" x2="{x}" y1="{top}" y2="{height-bottom}"/>')
            label = f"{value:.0%}" if maximum == 1 else f"{value:.0f}"
            out.append(svg_text(x, height - 42, label, "tick", "middle"))
    for index, model in enumerate(order):
        y = top + row_h * (index + 0.5)
        out.append(svg_text(left - 10, y + 4, names[model], "tick", "end"))
        sub_width = panel * submissions[model] / max_sub
        hit_width = panel * hit_rates[model]
        out.append(f'<rect x="{left}" y="{y-row_h*.28:.1f}" width="{sub_width:.1f}" height="{row_h*.56:.1f}" fill="{colors[model]}"/>')
        out.append(f'<rect x="{second}" y="{y-row_h*.28:.1f}" width="{hit_width:.1f}" height="{row_h*.56:.1f}" fill="{colors[model]}"/>')
    out.append(svg_text(left, height - 14, "Counts exclude later empty response phases.", "tick"))
    out.append("</svg>")
    return "".join(out)


def line_chart(order, names, colors, series, title, y_label, y_min=0, y_max=100):
    width, height = 760, 430
    left, right, top, bottom = 72, 190, 28, 58
    plot_w, plot_h = width - left - right, height - top - bottom
    x = lambda hour: left + plot_w * hour / 24
    y = lambda value: top + plot_h * (y_max - value) / (y_max - y_min)
    out = [svg_open(width, height, title)]
    for value in [y_min + (y_max - y_min) * index / 4 for index in range(5)]:
        yy = y(value)
        out.append(f'<line class="grid" x1="{left}" x2="{left+plot_w}" y1="{yy:.1f}" y2="{yy:.1f}"/>')
        out.append(svg_text(left - 9, yy + 4, f"{value:.0f}", "tick", "end"))
    for hour in [0, 4, 8, 12, 16, 20, 24]:
        xx = x(hour)
        out.append(svg_text(xx, height - 34, hour, "tick", "middle"))
    out.append(svg_text(left + plot_w / 2, height - 8, "Hours into the run", "label", "middle"))
    out.append(svg_text(16, top + plot_h / 2, y_label, "label", "middle", -90))
    for index, model in enumerate(order):
        points = [(x(hour), y(value)) for hour, value in series[model]]
        path = "M" + "L".join(f"{xx:.1f},{yy:.1f}" for xx, yy in points)
        out.append(f'<path d="{path}" fill="none" stroke="{colors[model]}" stroke-width="2"/>')
        for xx, yy in points:
            out.append(f'<circle cx="{xx:.1f}" cy="{yy:.1f}" r="2.6" fill="{colors[model]}"/>')
        ly = top + 16 + index * 20
        out.append(f'<line x1="{left+plot_w+18}" x2="{left+plot_w+40}" y1="{ly}" y2="{ly}" stroke="{colors[model]}" stroke-width="3"/>')
        out.append(svg_text(left + plot_w + 47, ly + 4, names[model], "legend"))
    out.append("</svg>")
    return "".join(out)


def strip_chart(order, names, colors, values, title, y_label, y_min, y_max, percent=False):
    width, height = 820, 420
    left, right, top, bottom = 72, 24, 30, 90
    plot_w, plot_h = width - left - right, height - top - bottom
    y = lambda value: top + plot_h * (y_max - value) / (y_max - y_min)
    out = [svg_open(width, height, title)]
    for index in range(5):
        value = y_min + (y_max - y_min) * index / 4
        yy = y(value)
        out.append(f'<line class="grid" x1="{left}" x2="{left+plot_w}" y1="{yy:.1f}" y2="{yy:.1f}"/>')
        label = f"{value:.0f}%" if percent else f"{value:.0f}"
        out.append(svg_text(left - 8, yy + 4, label, "tick", "end"))
    for model_index, model in enumerate(order):
        center = left + plot_w * (model_index + 0.5) / len(order)
        for value_index, value in enumerate(values[model]):
            jitter = (((value_index * 37) % 17) - 8) * 1.2
            out.append(f'<circle cx="{center+jitter:.1f}" cy="{y(value):.1f}" r="3.6" fill="{colors[model]}" fill-opacity=".68" stroke="#fff"/>')
        med = median(values[model])
        out.append(f'<line x1="{center-28:.1f}" x2="{center+28:.1f}" y1="{y(med):.1f}" y2="{y(med):.1f}" stroke="{colors[model]}" stroke-width="3"/>')
        label = names[model].replace(" ", "\n", 1)
        lines = label.split("\n")
        out.append(svg_text(center, height - 57, lines[0], "tick", "middle"))
        if len(lines) > 1:
            out.append(svg_text(center, height - 43, lines[1], "tick", "middle"))
    out.append(svg_text(17, top + plot_h / 2, y_label, "label", "middle", -90))
    out.append("</svg>")
    return "".join(out)


def reliability_chart(order, names, colors, rows):
    by_task = {}
    for row in rows:
        by_task.setdefault(row["task"], {})[row["model"]] = row["final_test"]
    near, last = {}, {}
    for model in order:
        minimum_models = min(4, len(order))
        eligible = [scores for scores in by_task.values() if model in scores and len(scores) >= minimum_models]
        near[model] = 100 * sum(scores[model] >= max(scores.values()) - 0.05 for scores in eligible) / len(eligible)
        last[model] = 100 * sum(scores[model] == min(scores.values()) for scores in eligible) / len(eligible)
    width, height = 760, 380
    left, top, bottom, plot_w = 155, 38, 52, 550
    row_h = (height - top - bottom) / len(order)
    out = [svg_open(width, height, "Task reliability by model")]
    for tick in [0, 25, 50, 75, 100]:
        x = left + plot_w * tick / 100
        out.append(f'<line class="grid" x1="{x}" x2="{x}" y1="{top}" y2="{height-bottom}"/>')
        out.append(svg_text(x, height - 28, f"{tick}%", "tick", "middle"))
    for index, model in enumerate(order):
        y = top + row_h * (index + 0.5)
        out.append(svg_text(left - 9, y + 4, names[model], "tick", "end"))
        out.append(f'<rect x="{left}" y="{y-9:.1f}" width="{plot_w*near[model]/100:.1f}" height="8" fill="{colors[model]}"/>')
        out.append(f'<rect x="{left}" y="{y+2:.1f}" width="{plot_w*last[model]/100:.1f}" height="8" fill="#d6d6d3"/>')
    out.append(f'<rect x="{left}" y="10" width="12" height="7" fill="{colors[order[0]]}"/>')
    out.append(svg_text(left + 18, 17, "Within 0.05 of the task best", "legend"))
    out.append(f'<rect x="{left+210}" y="10" width="12" height="7" fill="#d6d6d3"/>')
    out.append(svg_text(left + 228, 17, "Lowest score on the task", "legend"))
    out.append("</svg>")
    return "".join(out), near, last


def scatter_chart(order, names, colors, rows):
    width, height = 760, 480
    left, right, top, bottom = 72, 190, 28, 58
    plot_w, plot_h = width - left - right, height - top - bottom
    x = lambda value: left + plot_w * value
    y = lambda value: top + plot_h * (1 - value)
    out = [svg_open(width, height, "Validation and hidden test score by selected run")]
    for tick in [0, .25, .5, .75, 1]:
        xx, yy = x(tick), y(tick)
        out.append(f'<line class="grid" x1="{xx:.1f}" x2="{xx:.1f}" y1="{top}" y2="{top+plot_h}"/>')
        out.append(f'<line class="grid" x1="{left}" x2="{left+plot_w}" y1="{yy:.1f}" y2="{yy:.1f}"/>')
        out.append(svg_text(xx, height - 34, f"{tick:.2f}", "tick", "middle"))
        out.append(svg_text(left - 8, yy + 4, f"{tick:.2f}", "tick", "end"))
    out.append(f'<line x1="{x(0)}" y1="{y(0)}" x2="{x(1)}" y2="{y(1)}" stroke="#babbb7"/>')
    for index, model in enumerate(order):
        for row in rows:
            if row["model"] == model:
                out.append(f'<circle cx="{x(row["final_validation"]):.1f}" cy="{y(row["final_test"]):.1f}" r="4" fill="{colors[model]}" fill-opacity=".72" stroke="#fff"/>')
        ly = top + 15 + index * 20
        out.append(f'<circle cx="{left+plot_w+28}" cy="{ly}" r="4" fill="{colors[model]}"/>')
        out.append(svg_text(left + plot_w + 40, ly + 4, names[model], "legend"))
    out.append(svg_text(left + plot_w / 2, height - 8, "Best validation reward", "label", "middle"))
    out.append(svg_text(16, top + plot_h / 2, "Hidden test reward of selected submission", "label", "middle", -90))
    out.append("</svg>")
    return "".join(out)


def build(input_path, output_dir, html_path):
    data = read_site_data(input_path)
    rows, names = selected_rows(data)
    order = [model["codename"] for model in data["models"] if any(row["model"] == model["codename"] for row in rows)]
    colors = {model: COLORS[index % len(COLORS)] for index, model in enumerate(order)}
    grouped = {model: [row for row in rows if row["model"] == model] for model in order}

    output_dir.mkdir(parents=True, exist_ok=True)
    submissions = {model: median([row["submissions"] for row in grouped[model]]) for model in order}
    hit_rates = {model: median([improvement_rate(row) for row in grouped[model]]) for model in order}
    ratio = lambda value, final: 100 * min(1.2, max(0, value / final))
    budget = {model: [(hour, median([ratio(at_hour(row["points"], hour), row["final_test"]) for row in grouped[model] if row["final_test"] > 0])) for hour in HOURS] for model in order}
    first_share = {model: [ratio(row["points"][0]["testAtBest"], row["final_test"]) for row in grouped[model] if row["final_test"] > 0] for model in order}
    last_hours = {model: [last_improvement_hour(row["points"]) for row in grouped[model]] for model in order}
    late = {model: [(hour, 100 * sum(last_improvement_hour(row["points"]) > hour for row in grouped[model]) / len(grouped[model])) for hour in range(0, 25, 2)] for model in order}

    charts = {
        "submissions": bar_pair_chart(order, names, colors, submissions, hit_rates),
        "budget": line_chart(order, names, colors, budget, "Share of final hidden test reward by hour", "Median share of final reward in percent", 0, 110),
        "first": strip_chart(order, names, colors, first_share, "First submission share of final hidden test reward", "Share of final reward", 0, 120, True),
        "last": strip_chart(order, names, colors, last_hours, "Hour of last hidden test improvement", "Hour of last improvement", 0, 24),
        "late": line_chart(order, names, colors, late, "Runs that still improved later", "Runs in percent", 0, 100),
        "scatter": scatter_chart(order, names, colors, rows),
    }
    charts["reliability"], near, last = reliability_chart(order, names, colors, rows)
    for name, content in charts.items():
        (output_dir / f"{name}.svg").write_text(content + "\n")

    top_sub = max(order, key=submissions.get)
    low_sub = min(order, key=submissions.get)
    top_hit = max(order, key=hit_rates.get)
    earliest = min(order, key=lambda model: median(last_hours[model]))
    strongest_first = max(order, key=lambda model: median(first_share[model]))
    most_reliable = max(order, key=near.get)
    latest = max(order, key=lambda model: late[model][6][1])
    snapshot = data.get("snapshot", {})
    all_ids = sorted(row["evaluation_id"] for row in rows)
    summary = {
        "snapshot": snapshot,
        "task_count": len({row["task"] for row in rows}),
        "model_count": len(order),
        "run_count": len(rows),
        "evaluation_ids": all_ids,
    }
    (output_dir / "source.json").write_text(json.dumps(summary, indent=2) + "\n")

    figures = [
        ("submissions", "Submission pace", f'{names[top_sub]} has the highest median submission count at {submissions[top_sub]:.0f}. {names[low_sub]} has the lowest at {submissions[low_sub]:.0f}. {names[top_hit]} has the highest median share of submissions that improve the best validation reward at {hit_rates[top_hit]:.0%}.', "Median model submissions per run and the median share that increased the best validation reward."),
        ("budget", "How early models reach their final result", f'At hour 8, the model medians range from {min(dict(budget[m])[8] for m in order):.0f} to {max(dict(budget[m])[8] for m in order):.0f} percent of the final hidden test reward. This plot shows whether long runs change the selected result.', "Hidden test reward of the validation selected submission at each hour, divided by the final selected reward. Each line is the median across graded runs."),
        ("first", "Strength of the first submission", f'{names[strongest_first]} has the strongest median first submission relative to its final selected result at {median(first_share[strongest_first]):.0f} percent.', "Each point is one graded run. The short line is the model median."),
        ("last", "When the selected result last improves", f'{names[earliest]} has the earliest median final improvement at hour {median(last_hours[earliest]):.1f}.', "Each point is one graded run. The short line is the model median."),
        ("late", "Which models keep improving", f'{names[latest]} has the largest share of runs with a later hidden test improvement after hour 12 at {dict(late[latest])[12]:.0f} percent.', "A run counts at an hour when its hidden test reward later rises above every earlier selected reward."),
        ("reliability", "Reliability across tasks", f'{names[most_reliable]} finishes within 0.05 of the task best on {near[most_reliable]:.0f} percent of comparable tasks. It finishes last on {last[most_reliable]:.0f} percent.', "The colored bar is the share of tasks within 0.05 of the best selected result. The gray bar is the share where the model is last."),
        ("scatter", "Validation and hidden test agreement", "Points below the diagonal have a lower hidden test reward than validation reward. Large gaps are candidates for discussion about generalization or task specific score noise.", "Each point is the final validation selected submission from one run. The same evaluation IDs feed the benchmark pages."),
    ]
    figure_html = "\n".join(
        f'<section class="candidate"><h2>{esc(title)}</h2><p>{esc(discussion)}</p><figure><img src="{esc(output_dir.name)}/{key}.svg" alt="{esc(title)}"><figcaption>{esc(caption)}</figcaption></figure></section>'
        for key, title, discussion, caption in figures
    )
    source_commit = snapshot.get("sourceCommit", "unknown")
    fetched = snapshot.get("fetchedAt", "unknown")
    document = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>General analysis plot review</title>
<style>
:root{{--paper:#fff;--ink:#181817;--muted:#6f716f;--line:#dedfdb;--soft:#f6f6f3;--accent:#bc5547;--serif:Georgia,"Times New Roman",serif;--sans:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 var(--sans)}}main{{width:min(1000px,calc(100% - 36px));margin:auto;padding:70px 0}}h1,h2{{font-family:var(--serif);font-weight:400;letter-spacing:-.03em}}h1{{font-size:clamp(44px,7vw,72px);line-height:1;margin:0 0 24px}}h2{{font-size:32px;margin:0 0 12px}}.intro{{max-width:790px;font-size:18px}}.source{{margin:30px 0;padding:18px 20px;background:var(--soft);border-left:3px solid var(--accent);font-size:14px}}.source p{{margin:0}}.source p+p{{margin-top:8px}}.candidate{{padding:52px 0;border-top:1px solid var(--line)}}.candidate>p{{max-width:790px;font-size:18px}}figure{{margin:26px 0 0}}img{{display:block;width:100%;height:auto}}figcaption{{margin-top:10px;color:var(--muted);font-size:13px;max-width:790px}}code{{font-size:.9em}}.blocked{{padding:24px;border:1px dashed var(--line);background:var(--soft)}}
</style>
</head>
<body><main>
<h1>General analysis plot review</h1>
<p class="intro">These are candidate plots for the benchmark blog. The build reads the selected runs from <code>site-data.js</code>. It therefore uses the same evaluation IDs as the benchmark pages.</p>
<aside class="source"><p>This build includes {len(rows)} runs across {len(order)} models and {len(set(row['task'] for row in rows))} tasks.</p><p>The score snapshot was fetched at {esc(fetched)}. Its evaluation index commit is <code>{esc(source_commit)}</code>. The exact evaluation IDs are in <code>{esc(output_dir.name)}/source.json</code>.</p></aside>
{figure_html}
<section class="candidate"><h2>Manual root cause plot</h2><div class="blocked"><p>I did not render the imported root cause plot as a current result. It depends on manual transcript labels for the older rollout set. The score snapshot does not contain those labels for replacement evaluations. A current plot would require labels for each newly selected run.</p></div></section>
</main></body></html>
"""
    html_path.write_text(document)
    return summary


def main():
    parser = argparse.ArgumentParser(__doc__)
    root = Path(__file__).resolve().parents[2]
    parser.add_argument("--site-data", type=Path, default=root / "site-data.js")
    parser.add_argument("--output-dir", type=Path, default=root / "general-analysis-review-assets")
    parser.add_argument("--html", type=Path, default=root / "general-analysis-review.html")
    args = parser.parse_args()
    summary = build(args.site_data, args.output_dir, args.html)
    print(json.dumps({key: value for key, value in summary.items() if key != "evaluation_ids"}))


if __name__ == "__main__":
    main()
