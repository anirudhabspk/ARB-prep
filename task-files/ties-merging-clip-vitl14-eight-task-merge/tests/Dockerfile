# Base: gcr.io/kaggle-gpu-images/python (tag v170 at pin time), digest-pinned below.
# Substitution justified per Base Image and Dockerfile Structuring sub-check 1: this task runs
# CUDA-linked training/inference on an H100 and needs a CUDA 12.8 runtime, cuDNN 9.8 and the
# NVIDIA driver-compatibility libraries at grade time. None of the 10 approved bases is a GPU
# image — they are CPU language runtimes and ship no CUDA runtime at all. The task additionally
# runs under `network_mode = "no-network"`, so the entire ML stack has to be present in the
# image rather than installed at run time, and this base ships it preinstalled.
FROM --platform=linux/amd64 gcr.io/kaggle-gpu-images/python@sha256:37c64f7dd9c54116ecd1bcc88817c5469b88387388fade02bfa8bf3fc647d461

ENTRYPOINT []
ENV PYTHONPATH=
ENV PYTHONSAFEPATH=1
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

# The root verifier drops privileges to this user before it executes candidate code.
RUN useradd --create-home --uid 1001 agent

# Verifier-only packages. The shared dependency set is the base's own (torch 2.10.0+cu128,
# transformers 5.0.0, datasets 5.0.0, safetensors, numpy, pillow), so there is no
# requirements.txt to keep byte-identical with the agent image.
COPY ./requirements-verifier.txt /tmp/requirements-verifier.txt
RUN /usr/bin/python3 -m pip install --no-cache-dir -r /tmp/requirements-verifier.txt \
    && rm /tmp/requirements-verifier.txt

RUN mkdir -p /app/output /logs/verifier

# Same ~11 GB of pinned checkpoints and the same frozen heads the agent image holds, plus the
# two sealed panels: their IMAGES under /opt/eval (world readable, no labels, and this is what
# merge() is handed) and their LABELS under /tests/hidden_data, which a later layer seals.
# This is the least-volatile layer, so it sits above `COPY . /tests`.
COPY ./build_assets.py /opt/build_assets.py
RUN /usr/bin/python3 /opt/build_assets.py --role verifier --assets /opt/assets \
        --eval-out /opt/eval --label-out /tests/hidden_data --dataset-cache /tmp/ds_cache \
        --panel-seed 20240817 --stride 1 \
    && rm -rf /tmp/ds_cache /opt/assets/pretrained/.cache /opt/assets/sun397/.cache \
    && rm -rf /opt/assets/cars/.cache /opt/assets/resisc45/.cache /opt/assets/eurosat/.cache \
    && rm -rf /opt/assets/svhn/.cache /opt/assets/gtsrb/.cache /opt/assets/mnist/.cache \
    && rm -rf /opt/assets/dtd/.cache

COPY . /tests

RUN chown -R root:root /tests \
    && chmod 700 /tests/hidden_data \
    && chmod +x /tests/test.sh /tests/intermediate.sh \
    && find /tests -exec touch -d @1700000000 {} +

WORKDIR /tests

# Runtime-only seal: AFTER every build-time RUN, one ENV per line, no continuation.
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1
