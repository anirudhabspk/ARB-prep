FROM --platform=linux/amd64 public.ecr.aws/docker/library/python:3.13-slim-bookworm@sha256:01f42367a0a94ad4bc17111776fd66e3500c1d87c15bbd6055b7371d39c124fb

ENTRYPOINT []
ENV PYTHONPATH=
ENV PYTHONSAFEPATH=1
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
# under this interpreter - plus the verifier-only scoring dependencies.
COPY ./requirements.txt /tmp/requirements.txt
COPY ./requirements-verifier.txt /tmp/requirements-verifier.txt
RUN /usr/local/bin/python3 -m pip install --no-cache-dir \
        -r /tmp/requirements.txt -r /tmp/requirements-verifier.txt \
    && rm /tmp/requirements.txt /tmp/requirements-verifier.txt

# /app/output is where task.toml's declared artifact lands.
RUN mkdir -p /app/output /logs/verifier

COPY . /tests

# /tests stays 0700 root. The sandbox runner is the one verifier file candidate code has
# to be able to execute, so it gets its own root-owned, non-agent-writable home.
RUN chown -R root:root /tests \
    && chmod 700 /tests \
    && chmod 700 /tests/hidden_data /tests/hidden_data/intermediate /tests/hidden_data/final \
    && chmod +x /tests/test.sh /tests/intermediate.sh \
    && mkdir -p /opt/verifier /opt/candidate \
    && cp /tests/runner.py /opt/verifier/runner.py \
    && chown root:root /opt/verifier /opt/verifier/runner.py \
    && chmod 755 /opt/verifier \
    && chmod 644 /opt/verifier/runner.py \
    && find /tests /opt/verifier -exec touch -d @1700000000 {} +

WORKDIR /tests

# Runtime-only seal: after every build-time RUN, one ENV per line.
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1
