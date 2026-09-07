# Base: gcr.io/kaggle-gpu-images/python (tag v170 at pin time), digest-pinned below.
# Substitution justified per Base Image and Dockerfile Structuring sub-check 1: this task runs
# CUDA-linked training/inference on an H100 and needs a CUDA 12.8 runtime, cuDNN 9.8 and the
# NVIDIA driver-compatibility libraries at grade time. None of the 10 approved bases is a GPU
# image — they are CPU language runtimes and ship no CUDA runtime at all. The task additionally
# runs under `network_mode = "no-network"`, so the entire ML stack has to be present in the
# image rather than installed at run time, and this base ships it preinstalled.
FROM --platform=linux/amd64 gcr.io/kaggle-gpu-images/python@sha256:37c64f7dd9c54116ecd1bcc88817c5469b88387388fade02bfa8bf3fc647d461

# One ENV per physical line, no continuations: harbor splices its agent tooling in
# right after the final FROM and would otherwise cut a continued instruction in half.
ENV PYTHONHASHSEED=0
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV CUBLAS_WORKSPACE_CONFIG=:4096:8
ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV NUMEXPR_NUM_THREADS=1

ENTRYPOINT []

RUN useradd --create-home --uid 1001 agent

# No requirements.txt: torch 2.10.0+cu128, transformers 5.0.0, numpy, scipy and
# scikit-learn are already in this base at the versions the task was built against.

# Task assets, baked at build time because the runtime is sealed. The model is
# pinned to a 40-hex commit revision and loaded BY PATH (local_dir= does not
# populate the Hub cache), and the extracted embedding matrix is checked against
# the SHA-256 measured during the build, which is also what makes the agent's
# copy and the verifier's copy provably the same bytes.
RUN /usr/bin/python3 -c "import hashlib, os, shutil, numpy as np, torch; from huggingface_hub import snapshot_download; p = snapshot_download(repo_id='lmsys/vicuna-7b-v1.5', revision='3321f76e3f527bd14065daf69dad9344000a201d', local_dir='/opt/assets/vicuna-7b-v1.5'); sd = torch.load(os.path.join(p, 'pytorch_model-00001-of-00002.bin'), map_location='cpu', weights_only=True); w = sd['model.embed_tokens.weight'].to(torch.float32).numpy(); assert w.shape == (32000, 4096), w.shape; assert hashlib.sha256(w.tobytes()).hexdigest() == '6fae809e95ad8d517dea0a9b3e4389764411168cc6186708af8549e7fa401d03'; np.save('/opt/assets/embedding_matrix.npy', w); os.makedirs('/opt/assets/vicuna-tokenizer', exist_ok=True); [shutil.copy(os.path.join(p, f), '/opt/assets/vicuna-tokenizer/') for f in ('tokenizer.model', 'tokenizer_config.json', 'special_tokens_map.json')]; shutil.rmtree(os.path.join(p, '.cache'), ignore_errors=True)"

WORKDIR /app
COPY ./app /app

RUN mkdir -p /app/output /app/work \
    && chown -R agent:agent /app \
    && find /app -exec touch -d @1700000000 {} +

# Runtime-only seal: after every build-time RUN, one ENV per line, no continuation.
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1

# The autoresearch harness inits the agent workspace as a Git repository and its prompt tells
# the agent to keep, compare and revert experiments with Git -- but it runs exactly
# `git rev-parse --git-dir || git init` and never sets an identity, so without this the first
# commit dies with "unable to auto-detect email address". --system (/etc/gitconfig), not
# --global, so it applies whatever HOME the agent process gets. The base already ships git
# 2.34.1, so there is nothing to install; this only writes a static gitconfig, touches no
# sealed asset and is never on the graded path, so it is not a determinism input.
RUN git config --system user.email "agent@localhost" && git config --system user.name "agent"

# Terminus requires tmux. The digest-pinned Kaggle base uses a rolling apt mirror, so an exact
# package version can disappear from that mirror. The base digest and package name are fixed.
RUN command -v tmux >/dev/null 2>&1 \
    || (apt-get update \
        && apt-get install -y --no-install-recommends tmux \
        && rm -rf /var/lib/apt/lists/*)

USER agent
