# Base: gcr.io/kaggle-gpu-images/python (tag v170 at pin time), digest-pinned below.
# Substitution justified per Base Image and Dockerfile Structuring sub-check 1: this task runs
# CUDA-linked training/inference on an H100 and needs a CUDA 12.8 runtime, cuDNN 9.8 and the
# NVIDIA driver-compatibility libraries at grade time. None of the 10 approved bases is a GPU
# image — they are CPU language runtimes and ship no CUDA runtime at all. The task additionally
# runs under `network_mode = "no-network"`, so the entire ML stack has to be present in the
# image rather than installed at run time, and this base ships it preinstalled.
FROM --platform=linux/amd64 gcr.io/kaggle-gpu-images/python@sha256:37c64f7dd9c54116ecd1bcc88817c5469b88387388fade02bfa8bf3fc647d461

# Every ARG/ENV/LABEL sits immediately after the final FROM, one instruction per physical line.
ENV PYTHONHASHSEED=0
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV NUMEXPR_NUM_THREADS=1
ENV CUBLAS_WORKSPACE_CONFIG=:4096:8
ENV HF_HUB_DISABLE_PROGRESS_BARS=1
# Runtime seal. The one build-time RUN that must reach the Hub overrides it for that command
# only, so nothing after the build can resolve a repository id over the network.
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1

ENTRYPOINT []

RUN useradd --create-home --uid 1001 agent

# Terminus needs tmux. The base image is digest pinned, while its apt mirror rolls forward.
RUN command -v tmux >/dev/null 2>&1 \
    || (apt-get update \
        && apt-get install -y --no-install-recommends tmux \
        && rm -rf /var/lib/apt/lists/*)

# Reference checkpoints, pinned to 40-hex commit shas. Loaded by PATH at run time, never by
# repository id: local_dir= writes a plain directory and never populates the Hub cache.
RUN HF_HUB_OFFLINE=0 TRANSFORMERS_OFFLINE=0 /usr/bin/python3 -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='openai-community/gpt2', revision='607a30d783dfa663caf39e06633721c8d4cfcd7e', local_dir='/opt/assets/gpt2', allow_patterns=['config.json','generation_config.json','merges.txt','vocab.json','tokenizer.json','model.safetensors']); snapshot_download(repo_id='EleutherAI/pythia-160m', revision='50f5173d932e8e61f858120bcb800b97af589f46', local_dir='/opt/assets/pythia-160m', allow_patterns=['config.json','generation_config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','model.safetensors'])" && rm -rf /opt/assets/gpt2/.cache /opt/assets/pythia-160m/.cache

# Development pool and development evaluation shard, materialised from the corpus at build
# time. Corpus files are pinned to the dataset repository's 40-hex commit sha; the shards used
# here are DISJOINT from the ones the verifier image uses, and the evaluation shard is a
# different corpus file from the pool, so the split is decided before a single row is derived.
COPY ./build_data.py /tmp/build_data.py
RUN set -eux; \
    REV=1588ec454efa1a09f29cd18ddd04fe05fc8653a2; \
    B="https://huggingface.co/datasets/allenai/c4/resolve/$REV"; \
    mkdir -p /tmp/corpus /app/data; \
    curl -sSL -o /tmp/corpus/val0.json.gz  "$B/en/c4-validation.00000-of-00008.json.gz"; \
    curl -sSL -o /tmp/corpus/tr0.json.gz   "$B/en/c4-train.00512-of-01024.json.gz"; \
    curl -sSL -o /tmp/corpus/tr1.json.gz   "$B/en/c4-train.00513-of-01024.json.gz"; \
    curl -sSL -o /tmp/corpus/nc0.json.gz   "$B/en.noclean/c4-train.00512-of-07168.json.gz"; \
    TOKENIZERS_PARALLELISM=true /usr/bin/python3 /tmp/build_data.py eval \
      --shards /tmp/corpus/val0.json.gz --out /app/data/dev_eval \
      --tokenizer /opt/assets/gpt2/tokenizer.json --target-tokens 2000000; \
    TOKENIZERS_PARALLELISM=true /usr/bin/python3 /tmp/build_data.py pool \
      --shards /tmp/corpus/tr0.json.gz /tmp/corpus/tr1.json.gz \
      --shards-b /tmp/corpus/nc0.json.gz \
      --target-tokens 250000000 --target-tokens-b 62500000 \
      --out /app/data/dev_pool --tokenizer /opt/assets/gpt2/tokenizer.json \
      --guard /app/data/dev_eval/guard.json; \
    rm -rf /tmp/corpus /tmp/build_data.py /app/data/dev_pool/guard.json /app/data/dev_eval/guard.json

WORKDIR /app
COPY ./app /app

RUN mkdir -p /app/output /app/scratch \
    && chown -R agent:agent /app \
    && find /app -exec touch -d @1700000000 {} +

# The autoresearch harness inits the agent workspace as a Git repository and its prompt tells
# the agent to keep, compare and revert experiments with Git -- but it runs exactly
# `git rev-parse --git-dir || git init` and never sets an identity, so without this the first
# commit dies with "unable to auto-detect email address". --system (/etc/gitconfig), not
# --global, so it applies whatever HOME the agent process gets. Build-time only: image builds
# have network even when the task is no-network at runtime.
RUN git config --system user.email "agent@localhost" \
    && git config --system user.name "agent"

USER agent
