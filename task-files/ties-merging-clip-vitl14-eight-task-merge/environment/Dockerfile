# Base: gcr.io/kaggle-gpu-images/python (tag v170 at pin time), digest-pinned below.
# Substitution justified per Base Image and Dockerfile Structuring sub-check 1: this task runs
# CUDA-linked training/inference on an H100 and needs a CUDA 12.8 runtime, cuDNN 9.8 and the
# NVIDIA driver-compatibility libraries at grade time. None of the 10 approved bases is a GPU
# image — they are CPU language runtimes and ship no CUDA runtime at all. The task additionally
# runs under `network_mode = "no-network"`, so the entire ML stack has to be present in the
# image rather than installed at run time, and this base ships it preinstalled.
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
ENV TQDM_DISABLE=1
ENV TOKENIZERS_PARALLELISM=false
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
# datasets 5.0.0, safetensors, numpy and pillow, which is the whole dependency set here.

# Least-volatile layer: ~11 GB of pinned checkpoints, the frozen heads, and the labelled dev
# half decoded to uint8. Every handle is an immutable 40-hex commit sha (see build_assets.py).
# The parquet cache is deleted inside the same RUN.
# The offline seal is declared at the FROM boundary above, so it is lifted for this one
# command -- and only this one -- while the pinned checkpoints are fetched.
COPY ./build_assets.py /opt/build_assets.py
RUN HF_HUB_OFFLINE=0 TRANSFORMERS_OFFLINE=0 \
        /usr/bin/python3 /opt/build_assets.py --role agent --assets /opt/assets --out /app \
        --dataset-cache /tmp/ds_cache --stride 1 \
    && rm -rf /tmp/ds_cache /opt/assets/pretrained/.cache /opt/assets/sun397/.cache \
    && rm -rf /opt/assets/cars/.cache /opt/assets/resisc45/.cache /opt/assets/eurosat/.cache \
    && rm -rf /opt/assets/svhn/.cache /opt/assets/gtsrb/.cache /opt/assets/mnist/.cache \
    && rm -rf /opt/assets/dtd/.cache

WORKDIR /app
COPY ./app /app

RUN mkdir -p /app/output \
    && chown agent:agent /app /app/output /app/eval_dev.py \
    && touch -d @1700000000 /app /app/output /app/eval_dev.py

# The autoresearch harness inits the agent workspace as a Git repository and its prompt tells
# the agent to keep, compare and revert experiments with Git -- but it runs exactly
# `git rev-parse --git-dir || git init` and never sets an identity, so without this the first
# commit dies with "unable to auto-detect email address". --system (/etc/gitconfig), not
# --global, so it applies whatever HOME the agent process gets. Build-time only: image builds
# have network even when the task is no-network at runtime.
RUN git config --system user.email "agent@localhost" \
    && git config --system user.name "agent"

USER agent
