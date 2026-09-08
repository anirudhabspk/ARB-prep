window.OPSD_HINT_DATA = {
  "generated": "2026-09-08",
  "benchmark": "AutoResearchBench-Preview-Tasks (30 tasks, 22 CPU / 8 GPU)",
  "agent": "typhoon (Terminus-2)",
  "arms": {
    "none": "original un-hinted benchmark task",
    "fair": "hint-brief/ = v4, only insight deducible from the problem statement itself",
    "val": "val-hints-brief/ = unrestricted best hint; grader nuances and exploits permitted"
  },
  "models": {
    "granola-plus": "MuseSpark 1.3",
    "lumen": "Claude Opus 5"
  },
  "costs": {
    "granola-plus 78 rollouts": 257.7,
    "lumen 39 rollouts": 378.31
  },
  "caveats": [
    "granola-plus n=2 per cell; lumen n=1 except 5 tasks carried at n=2 (vas, causalrivers, grpo, sparse-elsa, cpu-llm-decode-throughput).",
    "Un-hinted baseline exists for only 6 CPU tasks and ONLY for granola-plus; 5 of those 6 ran at max_tokens 8000 while every hinted arm ran at 32000. Not cap-matched.",
    "No un-hinted lumen arm exists for these tasks.",
    "lumen fair arm missing 2 tasks (cpu-decoder-graph-executor, mlh-coco) - rollouts returned no score.",
    "grpo lumen-fair median 0.325 is the midpoint of [0.651, 0.000]; the zero inflates the val-vs-fair gap. Prefer the drop-zero figure.",
    "Within-task rollout spread: granola-plus fair 0.013, val 0.037. Deltas below ~0.04 are inside noise."
  ],
  "summary": {
    "granola-plus": {
      "n_tasks": 22,
      "fair_mean_of_task_medians": 0.4336,
      "val_mean_of_task_medians": 0.4465,
      "mean_delta": 0.0129
    },
    "lumen": {
      "n_tasks": 20,
      "fair_mean_of_task_medians": 0.4804,
      "val_mean_of_task_medians": 0.5333,
      "mean_delta": 0.0529
    },
    "unhinted_overlap_granola": {
      "n_tasks": 6,
      "tasks": [
        "2406-07553-cpu-llm-decode-throughput",
        "2408-08998-shortest-valid-ci-l2-ece",
        "causalrivers-heldout-station-graph-auroc",
        "grpo-rl-halfcheetah-advantage-estimator",
        "sparse-elsa-item-embeddings-8nnz",
        "vas-maskless-deployment-feasibility"
      ],
      "none": 0.4565,
      "fair": 0.4833,
      "val": 0.4641
    }
  },
  "tasks": [
    {
      "key": "2406-07553-cpu-llm-decode-throughput",
      "gpu": false,
      "noneGranola": {
        "scores": [
          0.369791512204,
          0.314123409371
        ],
        "max_tokens": 8000
      },
      "fairGranola": [
        0.327068472762,
        0.320478383218
      ],
      "valGranola": [
        0.365723709248,
        0.322698369695
      ],
      "fairLumen": [
        0.402092675635,
        0.394319428808
      ],
      "valLumen": [
        0.372017081135
      ]
    },
    {
      "key": "2407-19804-budgeted-imputation-mcar50",
      "gpu": false,
      "noneGranola": null,
      "fairGranola": [
        0.580058310088,
        0.580408213288
      ],
      "valGranola": [
        0.557247959554,
        0.571816503204
      ],
      "fairLumen": [
        0.5826777838
      ],
      "valLumen": [
        0.580642308258
      ]
    },
    {
      "key": "2408-08998-shortest-valid-ci-l2-ece",
      "gpu": false,
      "noneGranola": {
        "scores": [
          0.49033493961,
          0.48356777851
        ],
        "max_tokens": 32000
      },
      "fairGranola": [
        0.477594350941,
        0.475693084751
      ],
      "valGranola": [
        0.521124456736,
        0.5072465453
      ],
      "fairLumen": [
        0.450083234718
      ],
      "valLumen": [
        0.457370083545
      ]
    },
    {
      "key": "2501-05646-hicard-latent-encoder",
      "gpu": false,
      "noneGranola": null,
      "fairGranola": [
        0.494715853941,
        0.493232195732
      ],
      "valGranola": [
        0.520458966342,
        0.568818525083
      ],
      "fairLumen": [
        0.538253888583
      ],
      "valLumen": [
        0.596593044519
      ]
    },
    {
      "key": "2502-07114-sketched-newton-cov-estimator",
      "gpu": false,
      "noneGranola": null,
      "fairGranola": [
        0.241239110109,
        0.592194526184
      ],
      "valGranola": [
        0.634202308463,
        0.609183791205
      ],
      "fairLumen": [
        0.615119283854
      ],
      "valLumen": [
        0.627291108565
      ]
    },
    {
      "key": "2508-09093-label-efficient-risk-estimator",
      "gpu": false,
      "noneGranola": null,
      "fairGranola": [
        0.28175913394,
        0.281014716041
      ],
      "valGranola": [
        0.452233587735,
        0.375262280282
      ],
      "fairLumen": [
        0.465271729349
      ],
      "valLumen": [
        0.724589186794
      ]
    },
    {
      "key": "act-tensor-sparse-panel-imputation-r2",
      "gpu": false,
      "noneGranola": null,
      "fairGranola": [
        0.398622019511,
        0.411717320407
      ],
      "valGranola": [
        0.472365717821,
        0.457751182958
      ],
      "fairLumen": [
        0.445426505908
      ],
      "valLumen": [
        0.496100778057
      ]
    },
    {
      "key": "activeprune-al-unlabeled-pool-pruning",
      "gpu": false,
      "noneGranola": null,
      "fairGranola": [
        0.272974662904,
        0.284010655181
      ],
      "valGranola": [
        0.260828228247,
        0.268146198848
      ],
      "fairLumen": [
        0.274599640807
      ],
      "valLumen": [
        0.275639099933
      ]
    },
    {
      "key": "budgeted-covtype-dual-market-open",
      "gpu": false,
      "noneGranola": null,
      "fairGranola": [
        0.306538906725,
        0.403050566314
      ],
      "valGranola": [
        0.461413060724,
        0
      ],
      "fairLumen": [
        0.00700163941454
      ],
      "valLumen": [
        0.0153088203084
      ]
    },
    {
      "key": "carps-star-discrepancy-subset-select",
      "gpu": false,
      "noneGranola": null,
      "fairGranola": [
        0.649677037896,
        0.667663241176
      ],
      "valGranola": [
        0.72265754808,
        0.630405028453
      ],
      "fairLumen": [
        0.736258243366
      ],
      "valLumen": [
        0.737497496367
      ]
    },
    {
      "key": "causalpfn-cate-pehe-ihdp-surfaceb",
      "gpu": false,
      "noneGranola": null,
      "fairGranola": [
        0.53535827753,
        0.39653205216
      ],
      "valGranola": [
        0.517983310772,
        0
      ],
      "fairLumen": [
        0.696075933713
      ],
      "valLumen": [
        0.718125353579
      ]
    },
    {
      "key": "causalrivers-heldout-station-graph-auroc",
      "gpu": false,
      "noneGranola": {
        "scores": [
          0.452963845143,
          0.520011428299
        ],
        "max_tokens": 8000
      },
      "fairGranola": [
        0.536529562793,
        0.430078618619
      ],
      "valGranola": [
        0.561921218833,
        0.496884979321
      ],
      "fairLumen": [
        0.642147625465,
        0.655739997633
      ],
      "valLumen": [
        0.671271474974
      ]
    },
    {
      "key": "coreset-selection-group-robust-waterbirds",
      "gpu": false,
      "noneGranola": null,
      "fairGranola": [
        0.287321830458,
        0
      ],
      "valGranola": [
        0,
        0.428399518652
      ],
      "fairLumen": [
        0.21357615894
      ],
      "valLumen": [
        0.431137724551
      ]
    },
    {
      "key": "dctabeval-aeac-pooled-cat-statistics",
      "gpu": false,
      "noneGranola": null,
      "fairGranola": [
        0.418119068162,
        0.418420144878
      ],
      "valGranola": [
        0.409663865546,
        0.408005617978
      ],
      "fairLumen": [
        0.422701592193
      ],
      "valLumen": [
        0.423688258417
      ]
    },
    {
      "key": "grpo-rl-halfcheetah-advantage-estimator",
      "gpu": false,
      "noneGranola": {
        "scores": [
          0.586418830116,
          0.444560405599
        ],
        "max_tokens": 8000
      },
      "fairGranola": [
        0.627323722087,
        0.580434127628
      ],
      "valGranola": [
        0.251041726251,
        0.378638110257
      ],
      "fairLumen": [
        0.650576231578,
        0
      ],
      "valLumen": [
        0.626211413706
      ]
    },
    {
      "key": "mlh-coco-16bit-hash-head-map5000",
      "gpu": false,
      "noneGranola": null,
      "fairGranola": [
        0.391793340314,
        0.404038057983
      ],
      "valGranola": [
        0.494039597788,
        0.476658379474
      ],
      "fairLumen": [],
      "valLumen": [
        0.482189410863
      ]
    },
    {
      "key": "p2505-06461-cpu-decoder-graph-executor",
      "gpu": false,
      "noneGranola": null,
      "fairGranola": [
        0.62263136589,
        0.611020227403
      ],
      "valGranola": [
        0.617835896156,
        0.624555323987
      ],
      "fairLumen": [],
      "valLumen": [
        0.881019668387
      ]
    },
    {
      "key": "reppo-reliable-onpolicy-control-trainer",
      "gpu": false,
      "noneGranola": null,
      "fairGranola": [
        0,
        0.334872979215
      ],
      "valGranola": [
        0.449330783939,
        0.501730103806
      ],
      "fairLumen": [
        0.53772070626
      ],
      "valLumen": [
        0.555555555556
      ]
    },
    {
      "key": "sopcc-online-chance-constrained-policy",
      "gpu": false,
      "noneGranola": null,
      "fairGranola": [
        0.475490141482,
        0.607767135899
      ],
      "valGranola": [
        0.555298399169,
        0.525007849901
      ],
      "fairLumen": [
        0.655547856898
      ],
      "valLumen": [
        0.617655736641
      ]
    },
    {
      "key": "sparse-elsa-item-embeddings-8nnz",
      "gpu": false,
      "noneGranola": {
        "scores": [
          0.446874592235,
          0.498795550551
        ],
        "max_tokens": 8000
      },
      "fairGranola": [
        0.451515993906,
        0.445313478036
      ],
      "valGranola": [
        0.516872365615,
        0.510864591236
      ],
      "fairLumen": [
        0.543108724403,
        0.530459929488
      ],
      "valLumen": [
        0.544280325851
      ]
    },
    {
      "key": "tgat-milp-branching-node-count",
      "gpu": false,
      "noneGranola": null,
      "fairGranola": [
        0.446690055708,
        0.39021557822
      ],
      "valGranola": [
        0.345714852516,
        0.16047596821
      ],
      "fairLumen": [
        0.491876277373
      ],
      "valLumen": [
        0.482691109315
      ]
    },
    {
      "key": "vas-maskless-deployment-feasibility",
      "gpu": false,
      "noneGranola": {
        "scores": [
          0.405075222373,
          0.4653524787
        ],
        "max_tokens": 8000
      },
      "fairGranola": [
        0.560813640847,
        0.566350489608
      ],
      "valGranola": [
        0.570334289453,
        0.566205810524
      ],
      "fairLumen": [
        0.566061034869,
        0.567331753807
      ],
      "valLumen": [
        0.711838337633
      ]
    }
  ]
};
