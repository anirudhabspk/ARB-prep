# Plot ranking changes on 2026-09-09

This report compares the prior blog data with the refreshed 24 hour results. FasterGCG and every Muse Spark 1.3 result are unchanged.

## Overall plots

The order changed in 2 aggregate comparisons. The order did not change for Hidden-test AUARC, Validation AUARC, Final hidden-test score, Relative validation-to-test gap, Task-relative Elo, Mean API cost.

- Mean submissions. Before: Claude Fable 5.1 < Claude Opus 5 < Muse Spark 1.3 < GPT-6 Astra < Qwen3.8 Max < Gemini 3.8 Flash < Kimi K3 < Grok 4.6 < GPT-5.6 Sol. After: Claude Opus 5 < Claude Fable 5.1 < Muse Spark 1.3 < GPT-6 Astra < Qwen3.8 Max < Gemini 3.8 Flash < Kimi K3 < Grok 4.6 < GPT-5.6 Sol.
- Mean output tokens. Before: Kimi K3 < Qwen3.8 Max < GPT-6 Astra < GPT-5.6 Sol < Gemini 3.8 Flash < Grok 4.6 < Claude Fable 5.1 < Claude Opus 5 < Muse Spark 1.3. After: Kimi K3 < Qwen3.8 Max < GPT-6 Astra < GPT-5.6 Sol < Gemini 3.8 Flash < Grok 4.6 < Claude Opus 5 < Claude Fable 5.1 < Muse Spark 1.3.

The cost frontier is unchanged: Qwen3.8 Max < Gemini 3.8 Flash < Grok 4.6 < Claude Opus 5 < GPT-6 Astra < Claude Fable 5.1.

## Task plots

### Validation AUARC

| Task | Before | After |
| --- | --- | --- |
| Waterbirds group robust coreset selection | Kimi K3 > Grok 4.6 > GPT-5.6 Sol > GPT-6 Astra > Claude Fable 5.1 > Claude Opus 5 > Gemini 3.8 Flash > Qwen3.8 Max > Muse Spark 1.3 | Claude Fable 5.1 > Kimi K3 > Grok 4.6 > GPT-5.6 Sol > GPT-6 Astra > Claude Opus 5 > Gemini 3.8 Flash > Qwen3.8 Max > Muse Spark 1.3 |
| COCO 16 bit hash head | Claude Fable 5.1 > GPT-6 Astra > Claude Opus 5 > Gemini 3.8 Flash > GPT-5.6 Sol > Kimi K3 > Grok 4.6 > Qwen3.8 Max > Muse Spark 1.3 | GPT-6 Astra > Claude Fable 5.1 > Claude Opus 5 > Gemini 3.8 Flash > GPT-5.6 Sol > Kimi K3 > Grok 4.6 > Qwen3.8 Max > Muse Spark 1.3 |
| CPU decoder graph executor | GPT-6 Astra > Claude Opus 5 > Claude Fable 5.1 > Gemini 3.8 Flash > GPT-5.6 Sol > Kimi K3 > Grok 4.6 > Qwen3.8 Max > Muse Spark 1.3 | GPT-6 Astra > Claude Fable 5.1 > Claude Opus 5 > Gemini 3.8 Flash > GPT-5.6 Sol > Kimi K3 > Grok 4.6 > Qwen3.8 Max > Muse Spark 1.3 |
| TGAT MILP branching | Claude Opus 5 > GPT-6 Astra > Claude Fable 5.1 > Grok 4.6 > GPT-5.6 Sol > Gemini 3.8 Flash > Muse Spark 1.3 > Qwen3.8 Max > Kimi K3 | Claude Fable 5.1 > Claude Opus 5 > GPT-6 Astra > Grok 4.6 > GPT-5.6 Sol > Gemini 3.8 Flash > Muse Spark 1.3 > Qwen3.8 Max > Kimi K3 |
| SVDQuant W4A4 reconstruction | GPT-6 Astra > Claude Fable 5.1 > Gemini 3.8 Flash > Grok 4.6 > Claude Opus 5 > Qwen3.8 Max > GPT-5.6 Sol > Kimi K3 > Muse Spark 1.3 | GPT-6 Astra > Gemini 3.8 Flash > Grok 4.6 > Claude Opus 5 > Qwen3.8 Max > GPT-5.6 Sol > Claude Fable 5.1 > Kimi K3 > Muse Spark 1.3 |
| Sparse autoencoder dictionary learning | GPT-6 Astra > Claude Opus 5 > Claude Fable 5.1 > GPT-5.6 Sol > Grok 4.6 > Qwen3.8 Max > Gemini 3.8 Flash > Muse Spark 1.3 > Kimi K3 | GPT-6 Astra > Claude Opus 5 > GPT-5.6 Sol > Kimi K3 > Claude Fable 5.1 > Grok 4.6 > Qwen3.8 Max > Gemini 3.8 Flash > Muse Spark 1.3 |

### Hidden-test AUARC

| Task | Before | After |
| --- | --- | --- |
| Waterbirds group robust coreset selection | Kimi K3 > Grok 4.6 > Claude Fable 5.1 > GPT-6 Astra > GPT-5.6 Sol > Claude Opus 5 > Gemini 3.8 Flash > Qwen3.8 Max > Muse Spark 1.3 | Claude Fable 5.1 > Kimi K3 > Grok 4.6 > GPT-6 Astra > GPT-5.6 Sol > Claude Opus 5 > Gemini 3.8 Flash > Qwen3.8 Max > Muse Spark 1.3 |
| COCO 16 bit hash head | Claude Fable 5.1 > GPT-6 Astra > Claude Opus 5 > Gemini 3.8 Flash > GPT-5.6 Sol > Kimi K3 > Grok 4.6 > Qwen3.8 Max > Muse Spark 1.3 | GPT-6 Astra > Claude Fable 5.1 > Claude Opus 5 > Gemini 3.8 Flash > GPT-5.6 Sol > Kimi K3 > Grok 4.6 > Qwen3.8 Max > Muse Spark 1.3 |
| CPU decoder graph executor | GPT-6 Astra > Claude Opus 5 > Claude Fable 5.1 > Gemini 3.8 Flash > GPT-5.6 Sol > Kimi K3 > Grok 4.6 > Qwen3.8 Max > Muse Spark 1.3 | GPT-6 Astra > Claude Fable 5.1 > Claude Opus 5 > Gemini 3.8 Flash > GPT-5.6 Sol > Kimi K3 > Grok 4.6 > Qwen3.8 Max > Muse Spark 1.3 |
| SOPCC online chance constrained policy | GPT-6 Astra > Claude Fable 5.1 > Kimi K3 > Claude Opus 5 > Muse Spark 1.3 > GPT-5.6 Sol > Gemini 3.8 Flash > Grok 4.6 > Qwen3.8 Max | GPT-6 Astra > Kimi K3 > Claude Opus 5 > Muse Spark 1.3 > GPT-5.6 Sol > Gemini 3.8 Flash > Claude Fable 5.1 > Grok 4.6 > Qwen3.8 Max |
| TGAT MILP branching | Claude Opus 5 > GPT-6 Astra > Claude Fable 5.1 > Grok 4.6 > Gemini 3.8 Flash > GPT-5.6 Sol > Qwen3.8 Max > Muse Spark 1.3 > Kimi K3 | Claude Fable 5.1 > Claude Opus 5 > GPT-6 Astra > Grok 4.6 > Gemini 3.8 Flash > GPT-5.6 Sol > Qwen3.8 Max > Muse Spark 1.3 > Kimi K3 |
| SVDQuant W4A4 reconstruction | GPT-6 Astra > Claude Fable 5.1 > Claude Opus 5 > Gemini 3.8 Flash > Grok 4.6 > Qwen3.8 Max > GPT-5.6 Sol > Kimi K3 > Muse Spark 1.3 | GPT-6 Astra > Claude Opus 5 > Gemini 3.8 Flash > Grok 4.6 > Qwen3.8 Max > GPT-5.6 Sol > Claude Fable 5.1 > Kimi K3 > Muse Spark 1.3 |
| Sparse autoencoder dictionary learning | GPT-6 Astra > Claude Opus 5 > Claude Fable 5.1 > Grok 4.6 > Qwen3.8 Max > Gemini 3.8 Flash > Muse Spark 1.3 > GPT-5.6 Sol > Kimi K3 | GPT-6 Astra > Claude Opus 5 > Claude Fable 5.1 > Kimi K3 > Grok 4.6 > Qwen3.8 Max > Gemini 3.8 Flash > Muse Spark 1.3 > GPT-5.6 Sol |

### Final hidden-test score

| Task | Before | After |
| --- | --- | --- |
| Waterbirds group robust coreset selection | Kimi K3 > GPT-6 Astra > Grok 4.6 > GPT-5.6 Sol > Claude Opus 5 > Claude Fable 5.1 > Gemini 3.8 Flash > Qwen3.8 Max > Muse Spark 1.3 | Claude Fable 5.1 > Kimi K3 > GPT-6 Astra > Grok 4.6 > GPT-5.6 Sol > Claude Opus 5 > Gemini 3.8 Flash > Qwen3.8 Max > Muse Spark 1.3 |
| DCTabEval pooled categorical statistics | GPT-6 Astra > Claude Fable 5.1 > Grok 4.6 > GPT-5.6 Sol > Claude Opus 5 > Gemini 3.8 Flash > Qwen3.8 Max > Kimi K3 > Muse Spark 1.3 | Claude Fable 5.1 > GPT-6 Astra > Grok 4.6 > GPT-5.6 Sol > Claude Opus 5 > Gemini 3.8 Flash > Qwen3.8 Max > Kimi K3 > Muse Spark 1.3 |
| SOPCC online chance constrained policy | GPT-6 Astra > Claude Fable 5.1 > Claude Opus 5 > Kimi K3 > Muse Spark 1.3 > GPT-5.6 Sol > Gemini 3.8 Flash > Grok 4.6 > Qwen3.8 Max | GPT-6 Astra > Claude Opus 5 > Kimi K3 > Muse Spark 1.3 > GPT-5.6 Sol > Claude Fable 5.1 > Gemini 3.8 Flash > Grok 4.6 > Qwen3.8 Max |
| SVDQuant W4A4 reconstruction | Claude Fable 5.1 > GPT-6 Astra > Grok 4.6 > GPT-5.6 Sol > Qwen3.8 Max > Claude Opus 5 > Gemini 3.8 Flash > Kimi K3 > Muse Spark 1.3 | GPT-6 Astra > Grok 4.6 > GPT-5.6 Sol > Qwen3.8 Max > Claude Opus 5 > Claude Fable 5.1 > Gemini 3.8 Flash > Kimi K3 > Muse Spark 1.3 |
| Sparse autoencoder dictionary learning | Claude Opus 5 > Claude Fable 5.1 > GPT-6 Astra > Qwen3.8 Max > GPT-5.6 Sol > Grok 4.6 > Kimi K3 > Gemini 3.8 Flash > Muse Spark 1.3 | Claude Opus 5 > Claude Fable 5.1 > GPT-6 Astra > Kimi K3 > Qwen3.8 Max > GPT-5.6 Sol > Grok 4.6 > Gemini 3.8 Flash > Muse Spark 1.3 |

### API cost

| Task | Before | After |
| --- | --- | --- |
| CausalRivers held out station graph AUROC | Qwen3.8 Max < Kimi K3 < Gemini 3.8 Flash < Muse Spark 1.3 < Grok 4.6 < Claude Opus 5 < GPT-5.6 Sol < Claude Fable 5.1 < GPT-6 Astra | Qwen3.8 Max < Kimi K3 < Gemini 3.8 Flash < Muse Spark 1.3 < Grok 4.6 < Claude Opus 5 < GPT-5.6 Sol < GPT-6 Astra < Claude Fable 5.1 |
| Waterbirds group robust coreset selection | Qwen3.8 Max < Muse Spark 1.3 < Gemini 3.8 Flash < Grok 4.6 < Kimi K3 < Claude Opus 5 < GPT-5.6 Sol < Claude Fable 5.1 < GPT-6 Astra | Qwen3.8 Max < Muse Spark 1.3 < Gemini 3.8 Flash < Grok 4.6 < Kimi K3 < Claude Opus 5 < GPT-5.6 Sol < GPT-6 Astra < Claude Fable 5.1 |
| DCTabEval pooled categorical statistics | Qwen3.8 Max < Grok 4.6 < Gemini 3.8 Flash < Kimi K3 < Muse Spark 1.3 < Claude Opus 5 < GPT-5.6 Sol < Claude Fable 5.1 < GPT-6 Astra | Qwen3.8 Max < Grok 4.6 < Gemini 3.8 Flash < Kimi K3 < Muse Spark 1.3 < Claude Opus 5 < GPT-5.6 Sol < GPT-6 Astra < Claude Fable 5.1 |
| COCO 16 bit hash head | Qwen3.8 Max < Muse Spark 1.3 < Kimi K3 < Gemini 3.8 Flash < Grok 4.6 < Claude Opus 5 < GPT-5.6 Sol < Claude Fable 5.1 < GPT-6 Astra | Qwen3.8 Max < Muse Spark 1.3 < Kimi K3 < Gemini 3.8 Flash < Grok 4.6 < Claude Opus 5 < GPT-5.6 Sol < GPT-6 Astra < Claude Fable 5.1 |
| CPU decoder graph executor | Qwen3.8 Max < Grok 4.6 < Muse Spark 1.3 < Gemini 3.8 Flash < Claude Fable 5.1 < Claude Opus 5 < Kimi K3 < GPT-5.6 Sol < GPT-6 Astra | Qwen3.8 Max < Grok 4.6 < Muse Spark 1.3 < Gemini 3.8 Flash < Claude Opus 5 < Kimi K3 < GPT-5.6 Sol < GPT-6 Astra < Claude Fable 5.1 |
| RePPO reliable on policy control | Qwen3.8 Max < Gemini 3.8 Flash < Muse Spark 1.3 < Grok 4.6 < GPT-5.6 Sol < Claude Opus 5 < Claude Fable 5.1 < GPT-6 Astra < Kimi K3 | Qwen3.8 Max < Gemini 3.8 Flash < Muse Spark 1.3 < Grok 4.6 < GPT-5.6 Sol < Claude Opus 5 < GPT-6 Astra < Claude Fable 5.1 < Kimi K3 |
| SOPCC online chance constrained policy | Qwen3.8 Max < Muse Spark 1.3 < Kimi K3 < Gemini 3.8 Flash < Claude Opus 5 < Grok 4.6 < GPT-5.6 Sol < Claude Fable 5.1 < GPT-6 Astra | Qwen3.8 Max < Muse Spark 1.3 < Kimi K3 < Gemini 3.8 Flash < Claude Opus 5 < Grok 4.6 < GPT-5.6 Sol < GPT-6 Astra < Claude Fable 5.1 |
| VAS maskless deployment feasibility | Qwen3.8 Max < Muse Spark 1.3 < Gemini 3.8 Flash < Grok 4.6 < Kimi K3 < GPT-5.6 Sol < Claude Opus 5 < Claude Fable 5.1 < GPT-6 Astra | Qwen3.8 Max < Muse Spark 1.3 < Gemini 3.8 Flash < Grok 4.6 < Kimi K3 < GPT-5.6 Sol < Claude Opus 5 < GPT-6 Astra < Claude Fable 5.1 |
| FastAdv budgeted PGD50 | Muse Spark 1.3 < Qwen3.8 Max < Gemini 3.8 Flash < Grok 4.6 < Kimi K3 < GPT-5.6 Sol < Claude Opus 5 < Claude Fable 5.1 < GPT-6 Astra | Muse Spark 1.3 < Qwen3.8 Max < Gemini 3.8 Flash < Grok 4.6 < Kimi K3 < GPT-5.6 Sol < Claude Opus 5 < GPT-6 Astra < Claude Fable 5.1 |

### Mean output tokens

| Task | Before | After |
| --- | --- | --- |
| CausalRivers held out station graph AUROC | Kimi K3 < Qwen3.8 Max < GPT-6 Astra < Claude Fable 5.1 < GPT-5.6 Sol < Grok 4.6 < Claude Opus 5 < Gemini 3.8 Flash < Muse Spark 1.3 | Kimi K3 < Qwen3.8 Max < GPT-6 Astra < GPT-5.6 Sol < Grok 4.6 < Claude Opus 5 < Claude Fable 5.1 < Gemini 3.8 Flash < Muse Spark 1.3 |
| Waterbirds group robust coreset selection | Qwen3.8 Max < GPT-6 Astra < Claude Fable 5.1 < Kimi K3 < GPT-5.6 Sol < Gemini 3.8 Flash < Grok 4.6 < Muse Spark 1.3 < Claude Opus 5 | Qwen3.8 Max < GPT-6 Astra < Kimi K3 < GPT-5.6 Sol < Gemini 3.8 Flash < Claude Fable 5.1 < Grok 4.6 < Muse Spark 1.3 < Claude Opus 5 |
| DCTabEval pooled categorical statistics | Kimi K3 < GPT-5.6 Sol < Qwen3.8 Max < GPT-6 Astra < Claude Opus 5 < Claude Fable 5.1 < Grok 4.6 < Gemini 3.8 Flash < Muse Spark 1.3 | Kimi K3 < GPT-5.6 Sol < Qwen3.8 Max < GPT-6 Astra < Claude Opus 5 < Grok 4.6 < Gemini 3.8 Flash < Claude Fable 5.1 < Muse Spark 1.3 |
| COCO 16 bit hash head | Qwen3.8 Max < Kimi K3 < GPT-6 Astra < GPT-5.6 Sol < Claude Fable 5.1 < Claude Opus 5 < Gemini 3.8 Flash < Grok 4.6 < Muse Spark 1.3 | Qwen3.8 Max < Kimi K3 < GPT-6 Astra < GPT-5.6 Sol < Claude Opus 5 < Gemini 3.8 Flash < Grok 4.6 < Claude Fable 5.1 < Muse Spark 1.3 |
| CPU decoder graph executor | Kimi K3 < Claude Fable 5.1 < Qwen3.8 Max < GPT-6 Astra < GPT-5.6 Sol < Claude Opus 5 < Grok 4.6 < Muse Spark 1.3 < Gemini 3.8 Flash | Kimi K3 < Qwen3.8 Max < GPT-6 Astra < GPT-5.6 Sol < Claude Opus 5 < Grok 4.6 < Muse Spark 1.3 < Gemini 3.8 Flash < Claude Fable 5.1 |
| RePPO reliable on policy control | Kimi K3 < GPT-6 Astra < GPT-5.6 Sol < Qwen3.8 Max < Gemini 3.8 Flash < Claude Fable 5.1 < Grok 4.6 < Claude Opus 5 < Muse Spark 1.3 | Kimi K3 < GPT-6 Astra < GPT-5.6 Sol < Qwen3.8 Max < Gemini 3.8 Flash < Grok 4.6 < Claude Opus 5 < Claude Fable 5.1 < Muse Spark 1.3 |
| SOPCC online chance constrained policy | Kimi K3 < Qwen3.8 Max < GPT-5.6 Sol < GPT-6 Astra < Grok 4.6 < Claude Fable 5.1 < Claude Opus 5 < Muse Spark 1.3 < Gemini 3.8 Flash | Kimi K3 < Qwen3.8 Max < GPT-5.6 Sol < GPT-6 Astra < Grok 4.6 < Claude Opus 5 < Muse Spark 1.3 < Gemini 3.8 Flash < Claude Fable 5.1 |
| Sparse ELSA item embeddings | Qwen3.8 Max < GPT-6 Astra < Kimi K3 < GPT-5.6 Sol < Gemini 3.8 Flash < Claude Fable 5.1 < Grok 4.6 < Muse Spark 1.3 < Claude Opus 5 | Qwen3.8 Max < GPT-6 Astra < Kimi K3 < GPT-5.6 Sol < Gemini 3.8 Flash < Grok 4.6 < Muse Spark 1.3 < Claude Opus 5 < Claude Fable 5.1 |
| TGAT MILP branching | Kimi K3 < Qwen3.8 Max < GPT-6 Astra < GPT-5.6 Sol < Claude Opus 5 < Grok 4.6 < Gemini 3.8 Flash < Claude Fable 5.1 < Muse Spark 1.3 | Kimi K3 < Qwen3.8 Max < GPT-6 Astra < GPT-5.6 Sol < Claude Opus 5 < Grok 4.6 < Gemini 3.8 Flash < Muse Spark 1.3 < Claude Fable 5.1 |
| VAS maskless deployment feasibility | Kimi K3 < Qwen3.8 Max < GPT-6 Astra < GPT-5.6 Sol < Claude Fable 5.1 < Grok 4.6 < Gemini 3.8 Flash < Muse Spark 1.3 < Claude Opus 5 | Kimi K3 < Qwen3.8 Max < GPT-6 Astra < GPT-5.6 Sol < Grok 4.6 < Gemini 3.8 Flash < Claude Fable 5.1 < Muse Spark 1.3 < Claude Opus 5 |
| SVDQuant W4A4 reconstruction | Grok 4.6 < Kimi K3 < GPT-6 Astra < Qwen3.8 Max < GPT-5.6 Sol < Gemini 3.8 Flash < Claude Fable 5.1 < Claude Opus 5 < Muse Spark 1.3 | Grok 4.6 < Kimi K3 < GPT-6 Astra < Qwen3.8 Max < GPT-5.6 Sol < Gemini 3.8 Flash < Claude Opus 5 < Muse Spark 1.3 < Claude Fable 5.1 |
| FastAdv budgeted PGD50 | Qwen3.8 Max < Kimi K3 < GPT-5.6 Sol < Gemini 3.8 Flash < Muse Spark 1.3 < GPT-6 Astra < Grok 4.6 < Claude Fable 5.1 < Claude Opus 5 | Qwen3.8 Max < Kimi K3 < GPT-5.6 Sol < Gemini 3.8 Flash < Muse Spark 1.3 < GPT-6 Astra < Grok 4.6 < Claude Opus 5 < Claude Fable 5.1 |
| Sparse autoencoder dictionary learning | Kimi K3 < Qwen3.8 Max < GPT-5.6 Sol < GPT-6 Astra < Gemini 3.8 Flash < Grok 4.6 < Muse Spark 1.3 < Claude Fable 5.1 < Claude Opus 5 | Kimi K3 < Qwen3.8 Max < GPT-5.6 Sol < GPT-6 Astra < Gemini 3.8 Flash < Grok 4.6 < Muse Spark 1.3 < Claude Opus 5 < Claude Fable 5.1 |

## Time AUARC plot

90 of 241 sampled time frames changed order. The changes fall into these ranges:

| Time range | Before | After |
| --- | --- | --- |
| 16m to 20m | GPT-6 Astra > GPT-5.6 Sol > Gemini 3.8 Flash > Grok 4.6 > Claude Fable 5.1 > Kimi K3 > Claude Opus 5 > Qwen3.8 Max > Muse Spark 1.3 | GPT-6 Astra > GPT-5.6 Sol > Gemini 3.8 Flash > Grok 4.6 > Kimi K3 > Claude Fable 5.1 > Claude Opus 5 > Qwen3.8 Max > Muse Spark 1.3 |
| 31m to 44m | GPT-6 Astra > GPT-5.6 Sol > Grok 4.6 > Gemini 3.8 Flash > Kimi K3 > Claude Fable 5.1 > Claude Opus 5 > Muse Spark 1.3 > Qwen3.8 Max | GPT-6 Astra > GPT-5.6 Sol > Grok 4.6 > Gemini 3.8 Flash > Kimi K3 > Claude Opus 5 > Claude Fable 5.1 > Muse Spark 1.3 > Qwen3.8 Max |
| 44m | GPT-6 Astra > GPT-5.6 Sol > Grok 4.6 > Gemini 3.8 Flash > Claude Fable 5.1 > Claude Opus 5 > Kimi K3 > Muse Spark 1.3 > Qwen3.8 Max | GPT-6 Astra > GPT-5.6 Sol > Grok 4.6 > Gemini 3.8 Flash > Kimi K3 > Claude Opus 5 > Claude Fable 5.1 > Muse Spark 1.3 > Qwen3.8 Max |
| 45m to 48m | GPT-6 Astra > GPT-5.6 Sol > Grok 4.6 > Gemini 3.8 Flash > Claude Opus 5 > Claude Fable 5.1 > Kimi K3 > Muse Spark 1.3 > Qwen3.8 Max | GPT-6 Astra > GPT-5.6 Sol > Grok 4.6 > Gemini 3.8 Flash > Kimi K3 > Claude Opus 5 > Claude Fable 5.1 > Muse Spark 1.3 > Qwen3.8 Max |
| 49m to 52m | GPT-6 Astra > GPT-5.6 Sol > Grok 4.6 > Gemini 3.8 Flash > Claude Opus 5 > Claude Fable 5.1 > Kimi K3 > Muse Spark 1.3 > Qwen3.8 Max | GPT-6 Astra > GPT-5.6 Sol > Grok 4.6 > Gemini 3.8 Flash > Claude Opus 5 > Kimi K3 > Claude Fable 5.1 > Muse Spark 1.3 > Qwen3.8 Max |
| 53m to 1.17h | GPT-6 Astra > GPT-5.6 Sol > Grok 4.6 > Gemini 3.8 Flash > Claude Fable 5.1 > Claude Opus 5 > Kimi K3 > Qwen3.8 Max > Muse Spark 1.3 | GPT-6 Astra > GPT-5.6 Sol > Grok 4.6 > Gemini 3.8 Flash > Claude Opus 5 > Kimi K3 > Claude Fable 5.1 > Qwen3.8 Max > Muse Spark 1.3 |
| 1.19h to 1.77h | GPT-6 Astra > GPT-5.6 Sol > Grok 4.6 > Gemini 3.8 Flash > Claude Fable 5.1 > Claude Opus 5 > Kimi K3 > Qwen3.8 Max > Muse Spark 1.3 | GPT-6 Astra > GPT-5.6 Sol > Grok 4.6 > Gemini 3.8 Flash > Claude Opus 5 > Claude Fable 5.1 > Kimi K3 > Qwen3.8 Max > Muse Spark 1.3 |
| 3.52h to 3.65h | GPT-6 Astra > GPT-5.6 Sol > Grok 4.6 > Claude Fable 5.1 > Gemini 3.8 Flash > Claude Opus 5 > Kimi K3 > Qwen3.8 Max > Muse Spark 1.3 | GPT-6 Astra > GPT-5.6 Sol > Grok 4.6 > Gemini 3.8 Flash > Claude Fable 5.1 > Claude Opus 5 > Kimi K3 > Qwen3.8 Max > Muse Spark 1.3 |
| 3.72h to 3.79h | GPT-6 Astra > GPT-5.6 Sol > Claude Fable 5.1 > Grok 4.6 > Gemini 3.8 Flash > Claude Opus 5 > Kimi K3 > Qwen3.8 Max > Muse Spark 1.3 | GPT-6 Astra > GPT-5.6 Sol > Grok 4.6 > Claude Fable 5.1 > Gemini 3.8 Flash > Claude Opus 5 > Kimi K3 > Qwen3.8 Max > Muse Spark 1.3 |
| 4.95h | GPT-6 Astra > Claude Fable 5.1 > GPT-5.6 Sol > Claude Opus 5 > Grok 4.6 > Gemini 3.8 Flash > Kimi K3 > Qwen3.8 Max > Muse Spark 1.3 | GPT-6 Astra > GPT-5.6 Sol > Claude Fable 5.1 > Claude Opus 5 > Grok 4.6 > Gemini 3.8 Flash > Kimi K3 > Qwen3.8 Max > Muse Spark 1.3 |
| 19.10h to 21.41h | Claude Fable 5.1 > GPT-6 Astra > Claude Opus 5 > GPT-5.6 Sol > Grok 4.6 > Gemini 3.8 Flash > Kimi K3 > Qwen3.8 Max > Muse Spark 1.3 | GPT-6 Astra > Claude Fable 5.1 > Claude Opus 5 > GPT-5.6 Sol > Grok 4.6 > Gemini 3.8 Flash > Kimi K3 > Qwen3.8 Max > Muse Spark 1.3 |
