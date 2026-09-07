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
    OPENBLAS_NUM_THREADS=1 \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1

# The predictor runs as this uid, so the verifier can drop privilege before it ever
# executes agent code. 1001 matches the host uid harbor uses for bind-mounted files.
RUN useradd --create-home --uid 1001 agent

# The SAME set the agent image installs — the verifier executes the agent's deliverable
# under this interpreter, so anything missing here is an ImportError the agent could not
# have foreseen.
COPY ./requirements.txt /tmp/requirements.txt
COPY ./requirements-verifier.txt /tmp/requirements-verifier.txt
RUN /usr/local/bin/python3 -m pip install --no-cache-dir \
        -r /tmp/requirements.txt -r /tmp/requirements-verifier.txt \
    && rm /tmp/requirements.txt /tmp/requirements-verifier.txt

RUN mkdir -p /app/output /logs/verifier

COPY . /tests

# Mirror the agent image's read-only /app tree so the submitted predictor resolves the
# same module paths and data files at grade time that it developed against. cp -a keeps
# the root ownership and world-readable modes COPY gave them: the predictor process runs
# as uid 1001, so it can read these and cannot modify them.
RUN cp -a /tests/agent_mirror/. /app/

RUN chown -R root:root /tests \
    && chmod 700 /tests/hidden_data /tests/hidden_data/intermediate /tests/hidden_data/final \
    && chmod +x /tests/test.sh /tests/intermediate.sh \
    && find /tests -exec touch -d @1700000000 {} +

WORKDIR /tests
