#!/usr/bin/env python3

import argparse
import json
import math
import random
from datetime import datetime
from pathlib import Path


COLORS = [
    "#6A3D9A",
    "#D95F02",
    "#1F78B4",
    "#E7298A",
    "#1B9E77",
    "#A6761D",
    "#00A6D6",
    "#4D4D4D",
]

EXCLUDED_TASK_IDS = {
    "2c24a9c8-abba-433b-869e-879ea3a33af9",  # SCFA attention speedup
}


def parse_time(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None


def elapsed(item):
    return max(item.get("public_elapsed_seconds") or 0, item.get("private_elapsed_seconds") or 0)


def usable(run):
    return run.get("attempt_status") != "agent_error" and any(
        item.get("public_score") is not None and item.get("private_score") is not None
        for item in run["iterations"]
    )


def run_end(run, fetched_at, duration):
    last = max([0] + [elapsed(item) for item in run["iterations"]])
    start = parse_time(run.get("created_at"))
    finish = fetched_at if run.get("status", "").lower() == "running" else parse_time(run.get("completed_at"))
    wall = max(0, (finish - start).total_seconds()) if start and finish else 0
    return min(duration, max(last, wall))


def run_curve(run, fetched_at, duration):
    best = -math.inf
    selected = None
    points = []
    for item in run["iterations"]:
        if item.get("public_score") is not None and item["public_score"] > best:
            best = item["public_score"]
            selected = item
        points.append(
            {
                "iteration": item.get("iteration"),
                "seconds": elapsed(item),
                "bestValidation": selected.get("public_score") if selected else None,
                "testAtBest": selected.get("private_score") if selected else None,
            }
        )
    end = run_end(run, fetched_at, duration)
    return {"points": points, "end": end, "selected": selected}


def run_stats(run, fetched_at, duration):
    if not usable(run):
        return None
    curve = run_curve(run, fetched_at, duration)
    points = curve["points"]
    end = curve["end"]

    def auc(key):
        total = 0
        previous_time = 0
        previous_value = 0
        for point in points:
            time = min(end, max(previous_time, point["seconds"]))
            total += previous_value * (time - previous_time)
            if point[key] is not None:
                previous_value = point[key]
            previous_time = time
        total += previous_value * max(0, end - previous_time)
        return total / end if end else None

    return {
        "validation": auc("bestValidation"),
        "test": auc("testAtBest"),
        "final": curve["selected"].get("private_score") if curve["selected"] else None,
        "cost": run.get("cost_usd"),
    }


def mean(values):
    values = [value for value in values if value is not None]
    return sum(values) / len(values) if values else None


def quantile(values, probability):
    values = sorted(values)
    position = (len(values) - 1) * probability
    lower = math.floor(position)
    upper = math.ceil(position)
    return values[lower] + (values[upper] - values[lower]) * (position - lower)


def ranks(values):
    order = sorted(range(len(values)), key=lambda index: values[index])
    result = [0.0] * len(values)
    index = 0
    while index < len(order):
        end = index + 1
        while end < len(order) and values[order[end]] == values[order[index]]:
            end += 1
        rank = (index + end - 1) / 2 + 1
        for position in range(index, end):
            result[order[position]] = rank
        index = end
    return result


def spearman(left, right):
    left_ranks = ranks(left)
    right_ranks = ranks(right)
    left_mean = mean(left_ranks)
    right_mean = mean(right_ranks)
    numerator = sum((a - left_mean) * (b - right_mean) for a, b in zip(left_ranks, right_ranks))
    left_sum = sum((value - left_mean) ** 2 for value in left_ranks)
    right_sum = sum((value - right_mean) ** 2 for value in right_ranks)
    return numerator / math.sqrt(left_sum * right_sum) if left_sum and right_sum else 0


def elo(task_rows, model_keys, steps):
    ratings = {key: 0.0 for key in model_keys}
    for _ in range(steps):
        gradient = {key: 0.0 for key in model_keys}
        matches = 0
        for task in task_rows:
            for left_index, left_key in enumerate(model_keys):
                for right_key in model_keys[left_index + 1 :]:
                    left = task[left_key]["test"]
                    right = task[right_key]["test"]
                    outcome = 0.5 if left == right else (1 if left > right else 0)
                    prediction = 1 / (1 + math.exp(-(ratings[left_key] - ratings[right_key])))
                    gradient[left_key] += outcome - prediction
                    gradient[right_key] -= outcome - prediction
                    matches += 1
        rate = 0.08 / max(1, matches / len(model_keys))
        for key in model_keys:
            ratings[key] += rate * gradient[key]
    return {key: 1000 + ratings[key] * 400 / math.log(10) for key in model_keys}


def bootstrap_mean(values, seed, samples=1200):
    rng = random.Random(seed)
    estimates = [mean([rng.choice(values) for _ in values]) for _ in range(samples)]
    return [quantile(estimates, 0.025), quantile(estimates, 0.975)]


def aggregate_data(payload):
    model_keys = [model["codename"] for model in payload["models"]]
    fetched_at = parse_time(payload["fetched_at"])
    duration = payload["duration_seconds"]
    complete = []
    for task in payload["tasks"]:
        rows = {}
        for run in task["models"]:
            stats = run_stats(run, fetched_at, duration)
            if stats:
                rows[run["model"]] = stats
        if all(key in rows for key in model_keys):
            complete.append(rows)

    def model_values(tasks):
        return {
            key: {
                field: [task[key][field] for task in tasks if task[key][field] is not None]
                for field in ("validation", "test", "final", "cost")
            }
            for key in model_keys
        }

    values = model_values(complete)
    point_elo = elo(complete, model_keys, 700)
    center = quantile(list(point_elo.values()), 0.5)
    shift = 1000 - center
    point_elo = {key: value + shift for key, value in point_elo.items()}

    elo_samples = {key: [] for key in model_keys}
    rng = random.Random(7123)
    for _ in range(300):
        sample = [rng.choice(complete) for _ in complete]
        estimate = elo(sample, model_keys, 200)
        sample_shift = 1000 - quantile(list(estimate.values()), 0.5)
        for key in model_keys:
            elo_samples[key].append(estimate[key] + sample_shift)

    gap_samples = {key: [] for key in model_keys}
    rho_samples = []
    rng = random.Random(991)
    for _ in range(1200):
        sample = [rng.choice(complete) for _ in complete]
        sample_values = model_values(sample)
        validation_means = [mean(sample_values[key]["validation"]) for key in model_keys]
        test_means = [mean(sample_values[key]["test"]) for key in model_keys]
        rho_samples.append(spearman(validation_means, test_means))
        for key, validation_value, test_value in zip(model_keys, validation_means, test_means):
            gap_samples[key].append(
                (validation_value - test_value) / max(abs(validation_value), abs(test_value), 1e-12)
            )

    aggregates = []
    for index, model in enumerate(payload["models"]):
        key = model["codename"]
        validation = mean(values[key]["validation"])
        test = mean(values[key]["test"])
        final = mean(values[key]["final"])
        gap = (validation - test) / max(abs(validation), abs(test), 1e-12)
        aggregates.append(
            {
                "key": key,
                "name": model["name"],
                "color": COLORS[index % len(COLORS)],
                "validation": validation,
                "validation_ci": bootstrap_mean(values[key]["validation"], 100 + index),
                "test": test,
                "test_ci": bootstrap_mean(values[key]["test"], 200 + index),
                "final": final,
                "final_ci": bootstrap_mean(values[key]["final"], 300 + index),
                "gap": gap,
                "gap_ci": [quantile(gap_samples[key], 0.025), quantile(gap_samples[key], 0.975)],
                "cost": mean(values[key]["cost"]),
                "elo": point_elo[key],
                "elo_ci": [quantile(elo_samples[key], 0.025), quantile(elo_samples[key], 0.975)],
            }
        )

    validation_means = [row["validation"] for row in aggregates]
    test_means = [row["test"] for row in aggregates]
    payload["aggregates"] = aggregates
    payload["rank_rho"] = spearman(validation_means, test_means)
    payload["rank_rho_ci"] = [quantile(rho_samples, 0.025), quantile(rho_samples, 0.975)]
    payload["elo_reference"] = "rating midpoint"
    payload["complete_task_count"] = len(complete)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path, nargs="?", default=Path("site-data.js"))
    args = parser.parse_args()

    source = json.loads(args.input.read_text())
    payload = {
        "fetched_at": source["fetched_at"],
        "duration_seconds": source["duration_seconds"],
        "models": source["models"],
        "tasks": [],
    }
    for task in source["tasks"]:
        if task.get("task_id") in EXCLUDED_TASK_IDS:
            continue
        clean_task = {
            key: task.get(key)
            for key in ("name", "horizon_name", "task_id", "version", "compute")
        }
        clean_task["models"] = []
        for run in task["models"]:
            clean_run = {
                key: run.get(key)
                for key in (
                    "model",
                    "model_name",
                    "status",
                    "attempt_status",
                    "created_at",
                    "completed_at",
                    "cost_usd",
                )
            }
            clean_run["iterations"] = [
                {
                    key: item.get(key)
                    for key in (
                        "iteration",
                        "public_score",
                        "private_score",
                        "public_elapsed_seconds",
                        "private_elapsed_seconds",
                    )
                }
                for item in run["iterations"]
            ]
            clean_task["models"].append(clean_run)
        payload["tasks"].append(clean_task)

    aggregate_data(payload)

    display_payload = {
        "models": [
            {"name": model["name"], "codename": model["codename"]}
            for model in payload["models"]
        ],
        "tasks": [],
        "aggregates": payload["aggregates"],
        "rank_rho": payload["rank_rho"],
        "rank_rho_ci": payload["rank_rho_ci"],
        "elo_reference": payload["elo_reference"],
        "complete_task_count": payload["complete_task_count"],
    }
    fetched_at = parse_time(payload["fetched_at"])
    for task in payload["tasks"]:
        display_task = {
            "name": task["name"],
            "compute": task["compute"],
            "models": [],
        }
        for run in task["models"]:
            curve = run_curve(run, fetched_at, payload["duration_seconds"])
            display_task["models"].append(
                {
                    "model": run["model"],
                    "hours": curve["end"] / 3600,
                    "points": curve["points"],
                }
            )
        display_payload["tasks"].append(display_task)

    args.output.write_text(
        "window.ARB_DATA=" + json.dumps(display_payload, separators=(",", ":")) + ";\n"
    )


if __name__ == "__main__":
    main()
