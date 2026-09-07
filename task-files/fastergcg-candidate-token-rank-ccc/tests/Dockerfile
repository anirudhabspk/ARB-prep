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
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    CUBLAS_WORKSPACE_CONFIG=:4096:8 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1

# The root verifier drops privileges to this user before it executes the submission.
RUN useradd --create-home --uid 1001 agent

# Verifier-only packages. The shared stack needs no requirements file: the base
# already carries torch, transformers, numpy, scipy and scikit-learn, so the agent
# image and this one run the identical library versions by construction.
COPY ./requirements-verifier.txt /tmp/requirements-verifier.txt
RUN /usr/bin/python3 -m pip install --no-cache-dir -r /tmp/requirements-verifier.txt \
    && rm /tmp/requirements-verifier.txt

# The same two runtime assets the agent developed against, at the same paths and
# — because the SHA-256 of the extracted matrix is asserted in both images — the
# same bytes. Only the shard that holds the embedding table is fetched, and it is
# deleted in the same layer; the 13 GB of transformer weights are not needed here,
# because the submitted ranker is graded without an accelerator.
RUN /usr/bin/python3 -c "import hashlib, os, shutil, numpy as np, torch; from huggingface_hub import snapshot_download; p = snapshot_download(repo_id='lmsys/vicuna-7b-v1.5', revision='3321f76e3f527bd14065daf69dad9344000a201d', local_dir='/opt/assets/vicuna-src', allow_patterns=['pytorch_model-00001-of-00002.bin', 'pytorch_model.bin.index.json', 'config.json', 'tokenizer.model', 'tokenizer_config.json', 'special_tokens_map.json']); sd = torch.load(os.path.join(p, 'pytorch_model-00001-of-00002.bin'), map_location='cpu', weights_only=True); w = sd['model.embed_tokens.weight'].to(torch.float32).numpy(); assert w.shape == (32000, 4096), w.shape; assert hashlib.sha256(w.tobytes()).hexdigest() == '6fae809e95ad8d517dea0a9b3e4389764411168cc6186708af8549e7fa401d03'; np.save('/opt/assets/embedding_matrix.npy', w); os.makedirs('/opt/assets/vicuna-tokenizer', exist_ok=True); [shutil.copy(os.path.join(p, f), '/opt/assets/vicuna-tokenizer/') for f in ('tokenizer.model', 'tokenizer_config.json', 'special_tokens_map.json')]; del sd, w; shutil.rmtree(p, ignore_errors=True)"

# /app/output is where harbor re-materialises the declared artifact; /logs/verifier
# is where the reward is written.
RUN mkdir -p /app/output /logs/verifier

COPY . /tests

RUN chown -R root:root /tests \
    && chmod 700 /tests/hidden_data \
    && chmod +x /tests/test.sh /tests/intermediate.sh \
    && find /tests -exec touch -d @1700000000 {} +

WORKDIR /tests

# Runtime-only seal: after every build-time RUN, one ENV per line, no continuation.
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1
