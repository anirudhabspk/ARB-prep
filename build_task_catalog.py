#!/usr/bin/env python3

import argparse
import json
import re
from pathlib import Path


DEFAULT_TASKS_REPO = Path(__file__).resolve().parent.parent / "AutoResearchBench-Preview-Tasks"
README_PATH = Path("task-readmes.md")
CATALOG_PATH = Path("task-catalog.js")
SITE_DATA_PATH = Path("site-data.js")
GITHUB_ROOT = "https://github.com/bespokelabsai/AutoResearchBench-Preview-Tasks/tree/f0cfffb69c854c4b2b05f97a2b22dd38525fb55e"

CATEGORY_ORDER = [
    "Model training",
    "Algorithms and optimization",
    "Data engineering and curation",
    "Systems and efficiency",
    "Evaluation, calibration, and robustness",
    "AI safety and alignment",
    "Interpretability",
]

TASKS = [
    ("cpu-llm-decode-throughput", "CPU LLM decode throughput", "Faster CPU generation", "Speed up batched text generation on an eight core CPU."),
    ("budgeted-imputation-mcar50", "Budgeted imputation MCAR 50", "Fill missing values", "Fill in missing table values quickly and accurately."),
    ("shortest-valid-ci-l2-ece", "Shortest valid CI L2 ECE", "Calibration error ranges", "Give tight yet valid ranges for classifier calibration error."),
    ("hicard-latent-encoder", "HiCARD latent encoder", "Encode rare categories", "Encode rare categories into eight numbers without using labels."),
    ("sketched-newton-cov-estimator", "Sketched Newton covariance estimator", "Estimate parameter uncertainty", "Predict how much final model parameters vary across reruns."),
    ("label-efficient-risk-estimator", "Label efficient risk estimator", "Measure loss cheaply", "Estimate a classifier's average loss using few true labels."),
    ("act-tensor-sparse-panel-imputation-r2", "ACT tensor sparse panel imputation", "Restore sparse tables", "Reconstruct missing company financial values from mostly empty tables."),
    ("activeprune-al-unlabeled-pool-pruning", "ActivePrune unlabeled pool pruning", "Select useful documents", "Shrink the unlabeled document pool before each labeling round."),
    ("budgeted-covtype-dual-market-open", "Budgeted Covtype dual market", "Budget labels and features", "Classify forest cover while buying labels and features cheaply."),
    ("carps-star-discrepancy-subset-select", "CARPS star discrepancy subset selection", "Select evenly spread points", "Pick a few points that spread evenly through a cube."),
    ("causalpfn-cate-pehe-ihdp-surfaceb", "CausalPFN CATE PEHE", "Estimate treatment effects", "Predict how much a treatment helps each new person."),
    ("causalrivers-heldout-station-graph-auroc", "CausalRivers held out station graph AUROC", "Map river connections", "Work out which river stations flow into which others."),
    ("coreset-selection-group-robust-waterbirds", "Waterbirds group robust coreset selection", "Choose balanced images", "Choose training bird images that cover hidden background groups."),
    ("dctabeval-aeac-pooled-cat-statistics", "DCTabEval pooled categorical statistics", "Rank access requests", "Rank employee access requests by how likely they are approved."),
    ("mlh-coco-16bit-hash-head-map5000", "COCO 16 bit hash head", "Learn image codes", "Learn 16 bit image codes for fast semantic search."),
    ("cpu-decoder-graph-executor", "CPU decoder graph executor", "Faster CPU decoding", "Run transformer decoder graphs faster on CPUs without losing accuracy."),
    ("reppo-reliable-onpolicy-control-trainer", "RePPO reliable on policy control", "Train reliable controllers", "Train reliable robot controllers from scratch under tight budgets."),
    ("sopcc-online-chance-constrained-policy", "SOPCC online chance constrained policy", "Plan safe routes", "Plan reward collecting routes when travel costs are random."),
    ("sparse-elsa-item-embeddings-8nnz", "Sparse ELSA item embeddings", "Learn sparse recommendations", "Build sparse item embeddings that rank users' hidden items well."),
    ("tgat-milp-branching-node-count", "TGAT MILP branching", "Reduce solver searches", "Choose branching variables so an integer solver explores fewer nodes."),
    ("vas-maskless-deployment-feasibility", "VAS maskless deployment feasibility", "Predict valid actions", "Predict valid game actions so a frozen policy scores higher."),
    ("grpo-rl-halfcheetah-advantage-estimator", "HalfCheetah advantage estimator", "Estimate action value", "Estimate how much each action helped a simulated running robot."),
    ("svdquant-w4a4-psnr", "SVDQuant W4A4 reconstruction", "Compress image generation", "Shrink an image generator to four bits without ruining images."),
    ("fast-adv-budgeted-pgd50-robust-cifar10", "FastAdv budgeted PGD50", "Resist image attacks", "Train an attack resistant image classifier in three minutes."),
    ("fastercache-budgeted-video-dit-cache-policy", "FasterCache video DiT policy", "Speed video generation", "Reuse earlier predictions to speed up video generation faithfully."),
    ("fastergcg-candidate-token-rank-ccc", "FasterGCG candidate token ranking", "Rank prompt changes", "Rank candidate prompt token swaps without running the language model."),
    ("less-is-more-pretrain-token-budget-selector", "Less Is More token budget selection", "Choose training documents", "Pick web documents that best pretrain a small language model."),
    ("sae-sparse-dict-nmse-frontier", "Sparse autoencoder dictionary learning", "Rebuild model activations", "Rebuild language model activations from a few dictionary vectors."),
    ("ties-merging-clip-vitl14-eight-task-merge", "TIES CLIP model merging", "Merge vision models", "Merge eight fine tuned vision encoders into one accurate classifier."),
]

CATEGORY_RE = re.compile(r"\*Category: (.+?)\.(?: Subcategory: (.+?)\.)?\*")
TASK_RE = re.compile(
    r"^### (?P<title>[^\n]+)\n"
    r"<!-- slug: (?P<slug>[^ ]+) -->\n"
    r"(?P<body>.*?)(?=^### |\Z)",
    re.MULTILINE | re.DOTALL,
)
GROUP_RE = re.compile(r"^## (?P<category>[^\n]+)\n(?P<body>.*?)(?=^## |\Z)", re.MULTILINE | re.DOTALL)


def read_source_readme(slug, tasks_repo):
    path = tasks_repo / slug / "README.md"
    text = path.read_text()
    first, separator, remainder = text.partition("\n")
    assert separator and first.startswith("# "), f"Unexpected README heading in {path}"
    return first[2:], remainder


def read_category(text, label):
    match = CATEGORY_RE.search(text)
    assert match, f"Missing category line in {label}"
    return match.group(1), match.group(2)


def assemble_readmes(tasks_repo):
    grouped = {category: [] for category in CATEGORY_ORDER}
    for slug, _, _, _ in TASKS:
        title, remainder = read_source_readme(slug, tasks_repo)
        category, _ = read_category(remainder, slug)
        assert category in grouped, f"Unknown category {category!r} in {slug}"
        grouped[category].append(f"### {title}\n<!-- slug: {slug} -->\n{remainder.rstrip()}\n")

    sections = [
        "# AutoResearchBench tasks\n",
        "29 tasks, grouped by research area. Each block is the task's README copied from the tasks repo.\n",
    ]
    for category in CATEGORY_ORDER:
        sections.append(f"## {category}\n\n" + "\n".join(grouped[category]))
    README_PATH.write_text("\n".join(sections).rstrip() + "\n")


def parse_readmes():
    text = README_PATH.read_text()
    entries = {}
    groups = list(GROUP_RE.finditer(text))
    assert [group.group("category") for group in groups] == CATEGORY_ORDER, "Research areas are missing or out of order"

    for group in groups:
        area = group.group("category")
        tasks = list(TASK_RE.finditer(group.group("body")))
        assert tasks, f"No tasks found under {area}"
        for task in tasks:
            slug = task.group("slug")
            body = task.group("body")
            category, subcategory = read_category(body, slug)
            assert category == area, f"Area heading {area!r} does not match {category!r} for {slug}"
            assert slug not in entries, f"Duplicate slug: {slug}"
            category_line = CATEGORY_RE.search(body)
            paragraph_text = body[category_line.end() :].strip("\n")
            paragraphs = [line for line in paragraph_text.splitlines() if line.strip()]
            entries[slug] = {
                "slug": slug,
                "title": task.group("title"),
                "category": category,
                "subcategory": subcategory,
                "paragraphs": paragraphs,
                "paragraph_text": paragraph_text,
            }
    return entries


def verify_source_paragraphs(entries, tasks_repo):
    if not tasks_repo.is_dir():
        return
    for slug, entry in entries.items():
        title, remainder = read_source_readme(slug, tasks_repo)
        category_line = CATEGORY_RE.search(remainder)
        source_paragraph_text = remainder[category_line.end() :].strip("\n")
        assert entry["title"] == title, f"Title differs from source README for {slug}"
        assert entry["paragraph_text"] == source_paragraph_text, f"README paragraphs differ from source for {slug}"


def load_site_data():
    text = SITE_DATA_PATH.read_text().strip()
    prefix = "window.ARB_DATA="
    assert text.startswith(prefix) and text.endswith(";"), "Unexpected site-data.js format"
    return json.loads(text[len(prefix) : -1])


def expert_hours(slug, tasks_repo):
    path = tasks_repo / slug / "task.toml"
    if not path.is_file():
        return None
    match = re.search(r"^expert_time_estimate_hours\s*=\s*([0-9.]+)\s*$", path.read_text(), re.MULTILINE)
    return float(match.group(1)) if match else None


def existing_expert_hours():
    if not CATALOG_PATH.is_file():
        return {}
    text = CATALOG_PATH.read_text().strip()
    prefix = "window.ARB_TASK_CATALOG="
    if not text.startswith(prefix) or not text.endswith(";"):
        return {}
    entries = json.loads(text[len(prefix) : -1])
    return {entry["slug"]: entry["expertHours"] for entry in entries if "expertHours" in entry}


def build_catalog(tasks_repo):
    assert len(TASKS) == 29, "TASKS must contain 29 rows"
    slugs = [slug for slug, _, _, _ in TASKS]
    assert len(slugs) == len(set(slugs)), "TASKS contains duplicate slugs"

    readmes = parse_readmes()
    assert set(readmes) == set(slugs), "task-readmes.md and TASKS contain different slugs"
    verify_source_paragraphs(readmes, tasks_repo)

    site_data = load_site_data()
    site_tasks = {task["name"] for task in site_data["tasks"]}
    stored_hours = existing_expert_hours()
    catalog = []
    for slug, blog_name, subtitle, summary in TASKS:
        assert blog_name in site_tasks, f"No site-data.js task named {blog_name!r}"
        assert 2 <= len(subtitle.split()) <= 4, f"Subtitle must contain two to four words for {slug}"
        assert len(summary.split()) <= 10, f"Summary is over 10 words for {slug}"
        entry = readmes[slug]
        assert entry["category"] in CATEGORY_ORDER, f"Unknown category for {slug}"
        result = {
            "slug": slug,
            "blogName": blog_name,
            "title": entry["title"],
            "subtitle": subtitle,
            "summary": summary,
            "category": entry["category"],
            "subcategory": entry["subcategory"],
            "paragraphs": entry["paragraphs"],
            "github": f"{GITHUB_ROOT}/{slug}",
        }
        hours = expert_hours(slug, tasks_repo)
        if hours is None:
            hours = stored_hours.get(slug)
        if hours is not None:
            result["expertHours"] = hours
        catalog.append(result)

    CATALOG_PATH.write_text(
        "window.ARB_TASK_CATALOG=" + json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + ";\n"
    )


def main():
    parser = argparse.ArgumentParser(description="Build the AutoResearchBench task catalog")
    parser.add_argument("--assemble", action="store_true", help="copy task READMEs into task-readmes.md first")
    parser.add_argument(
        "--tasks-repo",
        type=Path,
        default=DEFAULT_TASKS_REPO,
        help="path to the AutoResearchBench tasks checkout",
    )
    args = parser.parse_args()
    if args.assemble:
        if not args.tasks_repo.is_dir():
            parser.error(f"task repository not found: {args.tasks_repo}")
        assemble_readmes(args.tasks_repo)
    build_catalog(args.tasks_repo)


if __name__ == "__main__":
    main()
