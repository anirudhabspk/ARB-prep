(() => {
  const finite = value => Number.isFinite(value);
  const squash = units => units === Infinity ? 1 : units / (1 + units);

  function applyProgress({m0, direction = 1, c = 0, mFloor = null}, metric, units) {
    if (!finite(metric) || !finite(m0)) return null;
    const improvement = direction * (metric - m0);
    if (c > 0 && improvement < 0) {
      const width = direction * (m0 - mFloor);
      return width > 0 ? c * Math.max(0, direction * (metric - mFloor)) / width : 0;
    }
    const reward = squash(Math.max(0, units));
    return c > 0 ? c + (1 - c) * reward : reward;
  }

  function rational(config) {
    const span = Math.abs(config.mRef - config.m0);
    return metric => applyProgress(config, metric, Math.max(0, config.direction * (metric - config.m0)) / span);
  }

  function gapRatio(config, bound) {
    const d0 = Math.abs(config.m0 - bound);
    const dRef = Math.abs(config.mRef - bound);
    const scale = Math.log(d0 / dRef);
    return metric => {
      if (!finite(metric)) return null;
      if (config.direction * (metric - bound) >= 0) return 1;
      const gap = Math.abs(metric - bound);
      const units = gap === 0 ? Infinity : Math.max(0, Math.log(d0 / gap) / scale);
      return applyProgress(config, metric, units);
    };
  }

  function gapHalvings(config, bound) {
    const d0 = Math.abs(config.m0 - bound);
    return metric => {
      if (!finite(metric)) return null;
      if (config.direction * (metric - bound) >= 0) return 1;
      const gap = Math.abs(metric - bound);
      const units = gap === 0 ? Infinity : Math.max(0, Math.log2(d0 / gap));
      return applyProgress(config, metric, units);
    };
  }

  const map = (kind, summary, score) => ({kind, summary, score});
  const gap = (config, bound, boundLabel) => map(
    "Gap ratio",
    `Rewards reductions in the remaining gap to the theoretical bound (${boundLabel}).`,
    gapRatio(config, bound)
  );
  const rationalMap = config => map(
    "Rational squash",
    "No single task-wide ceiling is appropriate, so it preserves the reported reward shape.",
    rational(config)
  );

  window.ARB_DIFFICULTY_REWARD_MAPS = {
    "CPU LLM decode throughput": rationalMap({m0: 1, mRef: 18, direction: 1}),
    "Budgeted imputation MCAR 50": gap({m0: 0, mRef: 0.30, direction: 1}, 1, "R² = 1"),
    "Shortest valid CI L2 ECE": gap({m0: 0.0593, mRef: 0.0095, direction: -1}, 0, "ECE = 0"),
    "HiCARD latent encoder": gap({m0: 3, mRef: 27, direction: 1}, 100, "100% explained variance"),
    "Sketched Newton covariance estimator": gap({m0: 1, mRef: 0.013, direction: -1}, 0, "error = 0"),
    "Label efficient risk estimator": gap({m0: 1, mRef: 0.68, direction: -1}, 0, "error = 0"),
    "ACT tensor sparse panel imputation": gap({m0: 0, mRef: 0.7047, direction: 1}, 1, "R² = 1"),
    "ActivePrune unlabeled pool pruning": gap({m0: 77.9, mRef: 93.11, direction: 1}, 100, "F1 = 100%"),
    "Budgeted Covtype dual market": gap({m0: 1 / 7, mRef: 0.5567, direction: 1}, 1, "accuracy = 1"),
    "CARPS star discrepancy subset selection": map(
      "Gap halvings",
      "No paper reference anchor is available, so it rewards each halving of the remaining discrepancy.",
      (metric, split) => gapHalvings({m0: split === "intermediate" ? 0.352382739515134 : 0.363298397903903, direction: -1}, 0)(metric)
    ),
    "CausalPFN CATE PEHE": gap({m0: 5.40, mRef: 0.58, direction: -1}, 0, "PEHE = 0"),
    "CausalRivers held out station graph AUROC": gap({m0: 0.740, mRef: 0.80, direction: 1}, 1, "AUROC = 1"),
    "Waterbirds group robust coreset selection": gap({m0: 59.0, mRef: 68.5, direction: 1}, 100, "accuracy = 100%"),
    "DCTabEval pooled categorical statistics": gap({m0: 0.5800, mRef: 0.9172, direction: 1}, 1, "ROC-AUC = 1"),
    "COCO 16 bit hash head": gap({m0: 0.435, mRef: 0.7903, direction: 1}, 1, "mAP = 1"),
    "CPU decoder graph executor": rationalMap({m0: 1, mRef: 1.304, direction: 1}),
    "RePPO reliable on policy control": gap({m0: 0, mRef: 0.8, direction: 1}, 1, "reliable-run fraction = 1"),
    "SOPCC online chance constrained policy": map(
      "Rational squash",
      "The penalized journey value varies across sealed maps, so it preserves the reported reward shape.",
      (metric, split) => rational({m0: split === "intermediate" ? 4.90108511497506 : 4.212162974044415, mRef: split === "intermediate" ? 5.935456731233547 : 5.403678393388951, direction: 1})(metric)
    ),
    "Sparse ELSA item embeddings": gap({m0: 0.354019, mRef: 0.469, direction: 1}, 1, "nDCG = 1"),
    "TGAT MILP branching": map(
      "Gap ratio",
      "Rewards reductions in the remaining gap to the zero-node lower bound.",
      (metric, split) => gapRatio({m0: split === "intermediate" ? 398.89 : 595.15, mRef: 126.0, direction: -1}, 0)(metric)
    ),
    "VAS maskless deployment feasibility": gap({m0: 3.205078125, mRef: 28.6, direction: 1}, 98, "episode return = 98"),
    "HalfCheetah advantage estimator": rationalMap({m0: 589.8015290641684, mRef: 1334.5186897062024, direction: 1}),
    "SVDQuant W4A4 reconstruction": rationalMap({m0: 9.1, mRef: 17.6, direction: 1}),
    "FastAdv budgeted PGD50": gap({m0: 10, mRef: 46.06, direction: 1}, 100, "robust accuracy = 100%"),
    "FasterCache video DiT policy": map(
      "Rational squash",
      "PSNR has no finite ceiling, so it preserves the reported reward shape.",
      (metric, split) => rational({m0: split === "intermediate" ? 26.2950 : 25.3818, mRef: 28.93, direction: 1, c: 0.10, mFloor: split === "intermediate" ? 13.3142 : 12.4367})(metric)
    ),
    "FasterGCG candidate token ranking": map(
      "Gap ratio",
      "Rewards reductions in the remaining gap to perfect rank concordance (CCC = 1).",
      (metric, split) => gapRatio(split === "intermediate" ? {m0: 0.13551682692307693, mRef: 0.5702, direction: 1, c: 0.10, mFloor: 0.12324805402930404} : {m0: 0.1397647664835165, mRef: 0.55, direction: 1, c: 0.10, mFloor: 0.06948660714285715}, 1)(metric)
    ),
    "Less Is More token budget selection": gap({m0: 0.25515, mRef: 4.4, direction: 1, c: 0.10, mFloor: -4.01125}, 100, "perplexity reduction = 100%"),
    "Sparse autoencoder dictionary learning": gap({m0: 0.540922, mRef: 0.19, direction: -1, c: 0.10, mFloor: 1.000370}, 0, "NMSE = 0"),
    "TIES CLIP model merging": gap({m0: 80.05, mRef: 86.00, direction: 1, c: 0.10, mFloor: 65.23}, 100, "accuracy = 100%")
  };
})();
