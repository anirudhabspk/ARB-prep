FROM --platform=linux/amd64 public.ecr.aws/docker/library/python:3.13-slim-bookworm@sha256:01f42367a0a94ad4bc17111776fd66e3500c1d87c15bbd6055b7371d39c124fb

ENTRYPOINT []
ENV PYTHONPATH=
ENV PYTHONSAFEPATH=1
# Mirrored in panel.py:_Session's env dict for the deliverable subprocess (which replaces
# rather than inherits this image's environment) and in child_main.py's explicit
# torch.set_num_threads(1) call, which env vars alone cannot guarantee for torch. Keep all
# three in sync.
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONHASHSEED=0 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1

# The root verifier drops privileges to this user before it executes candidate code.
RUN useradd --create-home --uid 1001 agent

# The SAME set the agent image installs - the verifier executes the agent's deliverable
# under this interpreter, so anything missing here is an ImportError the agent could not
# have foreseen.
COPY ./requirements.txt /tmp/requirements.txt
COPY ./requirements-verifier.txt /tmp/requirements-verifier.txt
RUN /usr/local/bin/python3 -m pip install --no-cache-dir \
        -r /tmp/requirements.txt -r /tmp/requirements-verifier.txt \
    && rm /tmp/requirements.txt /tmp/requirements-verifier.txt

# The declared artifact path must exist even when nothing is copied into it.
RUN mkdir -p /app/solution /logs/verifier

COPY . /tests

RUN chown -R root:root /tests \
    && chmod 700 /tests/hidden_data /tests/hidden_data/intermediate /tests/hidden_data/final \
    && chmod +x /tests/test.sh /tests/intermediate.sh \
    && find /tests -exec touch -d @1700000000 {} +

WORKDIR /tests

# Runtime-only seal: AFTER every build-time RUN, one ENV per line, no continuation.
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1
