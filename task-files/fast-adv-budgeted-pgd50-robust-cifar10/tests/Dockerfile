# Base: gcr.io/kaggle-gpu-images/python (tag v170 at pin time), digest-pinned below.
# Substitution justified per Base Image and Dockerfile Structuring sub-check 1: this task runs
# CUDA-linked training/inference on an H100 and needs a CUDA 12.8 runtime, cuDNN 9.8 and the
# NVIDIA driver-compatibility libraries at grade time. None of the 10 approved bases is a GPU
# image — they are CPU language runtimes and ship no CUDA runtime at all. The task additionally
# runs under `network_mode = "no-network"`, so the entire ML stack has to be present in the
# image rather than installed at run time, and this base ships it preinstalled.
FROM --platform=linux/amd64 gcr.io/kaggle-gpu-images/python@sha256:37c64f7dd9c54116ecd1bcc88817c5469b88387388fade02bfa8bf3fc647d461 AS data

# Both CIFAR-10 splits are materialized here at build time (~150 MB + ~30 MB, far above the
# 45 MB per-file bake limit) from the same pinned revision and the same content-hash-checked
# script the agent image uses, so the training data the deliverable is handed at grade time is
# provably identical to the copy the agent developed against.
ARG CIFAR_REVISION=0b2714987fa478483af9968de7c934580d0bb9a2
ENTRYPOINT []
WORKDIR /build
COPY ./materialize_cifar.py /build/materialize_cifar.py
RUN for split in train test; do \
        curl -fsSL --retry 8 --retry-all-errors --retry-delay 5 --max-time 3600 \
            -o "/build/${split}.parquet" \
            "https://huggingface.co/datasets/uoft-cs/cifar10/resolve/${CIFAR_REVISION}/plain_text/${split}-00000-of-00001.parquet" \
        || exit 1; \
    done \
    && mkdir -p /data \
    && /usr/bin/python3 /build/materialize_cifar.py --split train \
        --parquet /build/train.parquet --out /data/cifar10_train.npz \
    && /usr/bin/python3 /build/materialize_cifar.py --split test \
        --parquet /build/test.parquet --out /data/cifar10_test.npz \
    && rm -f /build/train.parquet /build/test.parquet


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
ENV PYTHONHASHSEED=0 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    OMP_NUM_THREADS=4 \
    MKL_NUM_THREADS=4 \
    OPENBLAS_NUM_THREADS=4 \
    CUBLAS_WORKSPACE_CONFIG=:4096:8 \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1

# The same uid the agent image creates, because the verifier executes the submitted training
# program as this unprivileged user; 1001 is the Horizon host uid.
RUN useradd --create-home --uid 1001 agent

# Parents of every declared artifact path, plus the verifier's log directory.
RUN mkdir -p /app/output /app/data /logs/verifier

# The read-only side of the graded run: the architecture the deliverable trains and the training
# split it is handed. Root-owned and unwritable by uid 1001, so the graded subprocess can read
# them and cannot alter what the next submission sees.
COPY ./preact_resnet.py /app/preact_resnet.py
COPY --from=data /data/cifar10_train.npz /app/data/cifar10_train.npz

COPY . /tests
COPY --from=data /data/cifar10_test.npz /tests/hidden_data/cifar10_test.npz

RUN chown -R root:root /tests /app/preact_resnet.py /app/data \
    && chmod 700 /tests/hidden_data \
    && chmod +x /tests/test.sh /tests/intermediate.sh \
    && chmod 444 /app/preact_resnet.py /app/data/cifar10_train.npz \
    && find /tests -exec touch -d @1700000000 {} +

WORKDIR /tests
