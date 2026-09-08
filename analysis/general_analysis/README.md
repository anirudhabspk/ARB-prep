# General analysis plots

This code adapts the candidate analysis plots from `bespokelabsai/ARBench-analysis` at commit `59c19d5886834c0635e03a64a13e2bf677c5e077`.

Run:

```sh
python3 analysis/general_analysis/build.py
```

The build reads `site-data.js`. The existing score refresh chooses the newest eligible evaluation for each model and task. It keeps the prior published run while a replacement is running or invalid. The analysis plots therefore use the exact evaluation IDs selected for the benchmark pages.

The build writes `general-analysis-review.html`, SVG files under `general-analysis-review-assets`, and `source.json`. The source file records the score snapshot metadata and every evaluation ID used by the plots.

The imported manual root cause plot is not regenerated. It depends on transcript labels that are not present for every replacement evaluation. The review page states this limit rather than showing an older label set as current.
