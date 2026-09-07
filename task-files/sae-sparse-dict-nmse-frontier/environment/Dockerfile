# Base: gcr.io/kaggle-gpu-images/python (tag v170 at pin time), digest-pinned below.
# Substitution justified per Base Image and Dockerfile Structuring sub-check 1: this task runs
# CUDA-linked training/inference on an H100 and needs a CUDA 12.8 runtime, cuDNN 9.8 and the
# NVIDIA driver-compatibility libraries at grade time. None of the 10 approved bases is a GPU
# image — they are CPU language runtimes and ship no CUDA runtime at all. The task additionally
# runs under `network_mode = "no-network"`, so the entire ML stack has to be present in the
# image rather than installed at run time, and this base ships it preinstalled.
#
# Every ARG/ENV/LABEL sits immediately below the final FROM, one instruction per physical line
# with no continuations: Harbor inserts its agent tools at that boundary and splits continued
# instructions. The offline seal is part of that block, so the two build-time Hub fetches below
# override it per-command (`HF_HUB_OFFLINE=0 TRANSFORMERS_OFFLINE=0 ...`) instead of relying on
# a late ENV; the image the agent runs in is sealed offline exactly as before.
FROM --platform=linux/amd64 gcr.io/kaggle-gpu-images/python@sha256:37c64f7dd9c54116ecd1bcc88817c5469b88387388fade02bfa8bf3fc647d461
ENV PYTHONHASHSEED=0
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV NUMEXPR_NUM_THREADS=1
ENV CUBLAS_WORKSPACE_CONFIG=:4096:8
ENV TOKENIZERS_PARALLELISM=false
ENV HF_HUB_DISABLE_PROGRESS_BARS=1
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1

ENTRYPOINT []

RUN useradd --create-home --uid 1001 agent

# Terminus needs tmux. The base image is digest pinned, while its apt mirror rolls forward.
RUN command -v tmux >/dev/null 2>&1 \
    || (apt-get update \
        && apt-get install -y --no-install-recommends tmux \
        && rm -rf /var/lib/apt/lists/*)

# No requirements file: the base already ships torch 2.10.0+cu128, transformers 5.0.0,
# huggingface_hub, pyarrow, numpy and scipy at the versions this task uses. Nothing is added,
# so there is no pinned set that can skew against the verifier image.

# Build-time asset fetch, with the offline seal lifted for this one command. Both handles are
# immutable 40-hex Hub commit shas, not branch names.
RUN HF_HUB_OFFLINE=0 TRANSFORMERS_OFFLINE=0 /usr/bin/python3 -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='openai-community/gpt2', revision='607a30d783dfa663caf39e06633721c8d4cfcd7e', local_dir='/opt/assets/gpt2', allow_patterns=['config.json','generation_config.json','model.safetensors','tokenizer.json','tokenizer_config.json','vocab.json','merges.txt'])" \
    && rm -rf /opt/assets/gpt2/.cache

RUN mkdir -p /app/data/openwebtext \
    && HF_HUB_OFFLINE=0 TRANSFORMERS_OFFLINE=0 /usr/bin/python3 -c "from huggingface_hub import hf_hub_download; [hf_hub_download(repo_id='Skylion007/openwebtext', repo_type='dataset', revision='79d93d786212f7344586290adb811d4ae6a1762c', filename=f, local_dir='/app/data/openwebtext') for f in ['plain_text/train-00000-of-00080.parquet', 'plain_text/train-00001-of-00080.parquet']]" \
    && rm -rf /app/data/openwebtext/.cache \
    && chown -R agent:agent /app/data

WORKDIR /app
COPY ./app /app

RUN mkdir -p /app/output /app/work \
    && chown agent:agent /app \
    && chown -R agent:agent /app/output /app/work /app/extract_acts.py \
    && chmod 0755 /app/extract_acts.py \
    && find /app/output /app/work /app/extract_acts.py -exec touch -d @1700000000 {} +

# The autoresearch harness inits the agent workspace as a Git repository and its prompt tells
# the agent to keep, compare and revert experiments with Git -- but it runs exactly
# `git rev-parse --git-dir || git init` and never sets an identity, so without this the first
# commit dies with "unable to auto-detect email address". --system (/etc/gitconfig), not
# --global, so it applies whatever HOME the agent process gets. Build-time only: image builds
# have network even when the task is no-network at runtime.
RUN git config --system user.email "agent@localhost" \
    && git config --system user.name "agent"

USER agent
