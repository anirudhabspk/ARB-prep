# Base: gcr.io/kaggle-gpu-images/python (tag v170 at pin time), digest-pinned below.
# Substitution justified per Base Image and Dockerfile Structuring sub-check 1: this task runs
# CUDA-linked training/inference on an H100 and needs a CUDA 12.8 runtime, cuDNN 9.8 and the
# NVIDIA driver-compatibility libraries at grade time. None of the 10 approved bases is a GPU
# image — they are CPU language runtimes and ship no CUDA runtime at all. The task additionally
# runs under `network_mode = "no-network"`, so the entire ML stack has to be present in the
# image rather than installed at run time, and this base ships it preinstalled.
FROM --platform=linux/amd64 gcr.io/kaggle-gpu-images/python@sha256:37c64f7dd9c54116ecd1bcc88817c5469b88387388fade02bfa8bf3fc647d461 AS data

# The CIFAR-10 training split is ~150 MB materialized, far above the 45 MB per-file bake limit,
# so it is fetched and decoded here at build time and only the .npz crosses into the final
# stage. This stage NEVER touches the test split: the held-out images do not exist anywhere in
# this image's build, not even in a discarded layer.
ARG CIFAR_REVISION=0b2714987fa478483af9968de7c934580d0bb9a2
ENTRYPOINT []
WORKDIR /build
COPY ./materialize_cifar.py /build/materialize_cifar.py
RUN curl -fsSL --retry 8 --retry-all-errors --retry-delay 5 --max-time 3600 \
        -o /build/train.parquet \
        "https://huggingface.co/datasets/uoft-cs/cifar10/resolve/${CIFAR_REVISION}/plain_text/train-00000-of-00001.parquet" \
    && mkdir -p /data \
    && /usr/bin/python3 /build/materialize_cifar.py --split train \
        --parquet /build/train.parquet --out /data/cifar10_train.npz \
    && rm -f /build/train.parquet


# Base: gcr.io/kaggle-gpu-images/python (tag v170 at pin time), digest-pinned below.
# Substitution justified per Base Image and Dockerfile Structuring sub-check 1: this task runs
# CUDA-linked training/inference on an H100 and needs a CUDA 12.8 runtime, cuDNN 9.8 and the
# NVIDIA driver-compatibility libraries at grade time. None of the 10 approved bases is a GPU
# image — they are CPU language runtimes and ship no CUDA runtime at all. The task additionally
# runs under `network_mode = "no-network"`, so the entire ML stack has to be present in the
# image rather than installed at run time, and this base ships it preinstalled.
FROM --platform=linux/amd64 gcr.io/kaggle-gpu-images/python@sha256:37c64f7dd9c54116ecd1bcc88817c5469b88387388fade02bfa8bf3fc647d461

ENTRYPOINT []
ENV PYTHONHASHSEED=0 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    OMP_NUM_THREADS=4 \
    MKL_NUM_THREADS=4 \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1

RUN useradd --create-home --uid 1001 agent

# Terminus needs tmux. The base image is digest pinned, while its apt mirror rolls forward.
RUN command -v tmux >/dev/null 2>&1 \
    || (apt-get update \
        && apt-get install -y --no-install-recommends tmux \
        && rm -rf /var/lib/apt/lists/*)

WORKDIR /app
COPY ./app /app
COPY --from=data /data/cifar10_train.npz /app/data/cifar10_train.npz

RUN mkdir -p /app/output \
    && chown -R agent:agent /app \
    && find /app -exec touch -d @1700000000 {} +

# The autoresearch harness inits the agent workspace as a Git repository and its prompt tells
# the agent to keep, compare and revert experiments with Git -- but it runs exactly
# `git rev-parse --git-dir || git init` and never sets an identity, and the base image ships
# git 2.34.1 with no user.name or user.email at any scope, so without this the first commit
# dies with "unable to auto-detect email address". --system (/etc/gitconfig), not --global, so
# it applies whatever HOME the agent process gets. Build-time only: image builds have network
# even though the task is no-network at runtime, and this touches nothing on the graded path.
RUN git config --system user.email "agent@localhost" \
    && git config --system user.name "agent"

USER agent
