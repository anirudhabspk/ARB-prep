(() => {
  const finite = value => Number.isFinite(value);
  const scoreUnits = reward => reward > 0 && reward < 1 ? reward / (1 - reward) : null;

  function rational({m0, mRef, direction = 1, c = 0, mFloor = null}) {
    const span = Math.abs(mRef - m0);
    return reward => {
      if (!finite(reward) || reward <= 0 || reward >= 1) return null;
      if (c > 0 && reward < c) {
        return finite(mFloor) ? mFloor + (m0 - mFloor) * reward / c : null;
      }
      const units = c > 0 ? (reward - c) / (1 - reward) : scoreUnits(reward);
      return finite(units) ? m0 + direction * span * units : null;
    };
  }

  function logRatioLower({m0, mRef}) {
    const base = m0 / mRef;
    return reward => {
      const units = scoreUnits(reward);
      return finite(units) ? m0 / base ** units : null;
    };
  }

  function logNodeCount({m0, mRef}) {
    const span = Math.log1p(m0) - Math.log1p(mRef);
    return reward => {
      const units = scoreUnits(reward);
      return finite(units) ? Math.expm1(Math.log1p(m0) - span * units) : null;
    };
  }

  const raw = (label, invert, precision = 3) => ({label, invert, precision});

  window.ARB_RAW_SCORE_MAPS = {
    "CPU LLM decode throughput": raw("Geometric-mean throughput speedup (×)", rational({m0: 1, mRef: 18}), 2),
    "Budgeted imputation MCAR 50": raw("Mean imputation R²", rational({m0: 0, mRef: 0.30}), 3),
    "Shortest valid CI L2 ECE": raw("Mean L2 expected calibration error", logRatioLower({m0: 0.0593, mRef: 0.0095}), 4),
    "HiCARD latent encoder": raw("Explained label variance (%)", rational({m0: 3, mRef: 27}), 1),
    "Sketched Newton covariance estimator": raw("Mean relative covariance error", logRatioLower({m0: 1, mRef: 0.013}), 4),
    "Label efficient risk estimator": raw("Median relative risk-estimation error", rational({m0: 1, mRef: 0.68, direction: -1}), 3),
    "ACT tensor sparse panel imputation": raw("Mean imputation R²", rational({m0: 0, mRef: 0.7047}), 3),
    "ActivePrune unlabeled pool pruning": raw("Final macro-F1 (%)", rational({m0: 77.9, mRef: 93.11}), 1),
    "Budgeted Covtype dual market": raw("Balanced accuracy", rational({m0: 1 / 7, mRef: 0.5567}), 3),
    "CARPS star discrepancy subset selection": raw("Mean exact L∞ star discrepancy", (reward, split) => {
      const m0 = split === "intermediate" ? 0.352382739515134 : 0.363298397903903;
      return finite(reward) && reward > 0 && reward < 1 ? m0 * (1 - reward) : null;
    }, 4),
    "CausalPFN CATE PEHE": raw("Mean PEHE", logRatioLower({m0: 5.40, mRef: 0.58}), 3),
    "CausalRivers held out station graph AUROC": raw("Mean AUROC", rational({m0: 0.740, mRef: 0.80}), 3),
    "Waterbirds group robust coreset selection": raw("Mean worst-slice accuracy (%)", rational({m0: 59.0, mRef: 68.5}), 1),
    "DCTabEval pooled categorical statistics": raw("Mean ROC-AUC", rational({m0: 0.5800, mRef: 0.9172}), 3),
    "COCO 16 bit hash head": raw("Mean mAP@5000", rational({m0: 0.435, mRef: 0.7903}), 3),
    "CPU decoder graph executor": raw("Geometric-mean throughput speedup (×)", rational({m0: 1, mRef: 1.304}), 3),
    "RePPO reliable on policy control": raw("Reliably performant-run fraction", rational({m0: 0, mRef: 0.8}), 3),
    "SOPCC online chance constrained policy": raw("Penalized journey value", (reward, split) => rational({m0: split === "intermediate" ? 4.90108511497506 : 4.212162974044415, mRef: split === "intermediate" ? 5.935456731233547 : 5.403678393388951})(reward), 3),
    "Sparse ELSA item embeddings": raw("Mean nDCG@100", rational({m0: 0.354019, mRef: 0.469}), 3),
    "TGAT MILP branching": raw("Geometric-mean branch-and-bound nodes", (reward, split) => logNodeCount({m0: split === "intermediate" ? 398.89 : 595.15, mRef: 126.0})(reward), 0),
    "VAS maskless deployment feasibility": raw("Mean episode return", rational({m0: 3.205078125, mRef: 28.6}), 1),
    "HalfCheetah advantage estimator": raw("Mean episode return", rational({m0: 589.8015290641684, mRef: 1334.5186897062024}), 0),
    "SVDQuant W4A4 reconstruction": raw("Mean PSNR (dB)", rational({m0: 9.1, mRef: 17.6}), 1),
    "FastAdv budgeted PGD50": raw("Robust accuracy (%)", rational({m0: 10, mRef: 46.06}), 1),
    "FasterCache video DiT policy": raw("Mean PSNR (dB)", (reward, split) => rational({m0: split === "intermediate" ? 26.2950 : 25.3818, mRef: 28.93, c: 0.10, mFloor: split === "intermediate" ? 13.3142 : 12.4367})(reward), 1),
    "FasterGCG candidate token ranking": raw("Pooled rank CCC", (reward, split) => rational(split === "intermediate" ? {m0: 0.13551682692307693, mRef: 0.5702, c: 0.10, mFloor: 0.12324805402930404} : {m0: 0.1397647664835165, mRef: 0.55, c: 0.10, mFloor: 0.06948660714285715})(reward), 3),
    "Less Is More token budget selection": raw("Hidden-perplexity reduction (%)", rational({m0: 0.25515, mRef: 4.4, c: 0.10, mFloor: -4.01125}), 2),
    "Sparse autoencoder dictionary learning": raw("Normalized reconstruction MSE", rational({m0: 0.540922, mRef: 0.19, direction: -1, c: 0.10, mFloor: 1.000370}), 4),
    "TIES CLIP model merging": raw("Mean top-1 accuracy (%)", rational({m0: 80.05, mRef: 86.00, c: 0.10, mFloor: 65.23}), 1)
  };

})();
