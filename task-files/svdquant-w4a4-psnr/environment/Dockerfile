# Base: gcr.io/kaggle-gpu-images/python (tag v170 at pin time), digest-pinned below.
# Substitution justified per Base Image and Dockerfile Structuring sub-check 1: this task runs
# CUDA-linked training/inference on an H100 and needs a CUDA 12.8 runtime, cuDNN 9.8 and the
# NVIDIA driver-compatibility libraries at grade time. None of the 10 approved bases is a GPU
# image — they are CPU language runtimes and ship no CUDA runtime at all. The task additionally
# runs under `network_mode = "no-network"`, so the entire ML stack has to be present in the
# image rather than installed at run time, and this base ships it preinstalled.
FROM --platform=linux/amd64 gcr.io/kaggle-gpu-images/python@sha256:37c64f7dd9c54116ecd1bcc88817c5469b88387388fade02bfa8bf3fc647d461
ENV PYTHONHASHSEED=0 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1 OMP_NUM_THREADS=1

ENTRYPOINT []

RUN useradd --create-home --uid 1001 agent
COPY ./requirements.txt /tmp/requirements.txt
RUN /usr/bin/python3 -m pip install --no-cache-dir -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt
RUN /usr/bin/python3 -c "from huggingface_hub import snapshot_download; snapshot_download('PixArt-alpha/PixArt-Sigma-XL-2-1024-MS', revision='e102b3591cc82e97071b8b4cb90d834d0c487207', local_dir='/opt/pixart-sigma', ignore_patterns=['asset/*', 'README.md', '.gitattributes'])" \
    && rm -rf /root/.cache/huggingface

WORKDIR /app
COPY ./app/data/calibration_prompts.jsonl /app/data/calibration_prompts.jsonl
COPY ./entrypoint.sh /usr/local/bin/task-entrypoint
RUN chown -R agent:agent /app \
    && chmod +x /usr/local/bin/task-entrypoint \
    && find /app -exec touch -d @1700000000 {} +
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1

# The autoresearch harness inits the agent workspace as a Git repository and its prompt tells
# the agent to keep, compare and revert experiments with Git -- but it runs exactly
# `git rev-parse --git-dir || git init` and never sets an identity, so without this the first
# commit dies with "unable to auto-detect email address". --system (/etc/gitconfig), not
# --global, so it applies whatever HOME the agent process gets. Must precede `USER agent`:
# --system writes /etc/gitconfig and needs root. Build-time only: image builds have network
# even when the task is no-network at runtime.
# git is not `=`-pinned deliberately: the Kaggle base pins no apt snapshot mirror, so a hard
# version pin would break the build the moment Debian's rolling mirror advances past a point
# release and garbage-collects the old .deb ("Version '...' not found"). Pinning the package
# without also pinning a snapshot source is less reproducible, not more. The base ships git
# 2.34.1, so the install branch is a guard against base drift only; git is used solely to set
# a static build-time gitconfig identity below, never touching the graded path, so its exact
# version is not a determinism input.
RUN command -v git >/dev/null 2>&1 \
    || (apt-get update \
        && apt-get install -y --no-install-recommends git \
        && rm -rf /var/lib/apt/lists/*)
RUN git config --system user.email "agent@localhost" \
    && git config --system user.name "agent"

# Terminus requires tmux. The digest-pinned Kaggle base uses a rolling apt mirror, so an exact
# package version can disappear from that mirror. The base digest and package name are fixed.
RUN command -v tmux >/dev/null 2>&1 \
    || (apt-get update \
        && apt-get install -y --no-install-recommends tmux \
        && rm -rf /var/lib/apt/lists/*)
USER agent
ENTRYPOINT ["/usr/local/bin/task-entrypoint"]
