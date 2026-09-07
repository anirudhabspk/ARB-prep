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

# The root verifier drops to this user before it runs any submission code.
RUN useradd --create-home --uid 1001 agent

# The SAME set the agent image installs: the verifier executes the submission's
# policy under this interpreter, so anything missing here is an ImportError the
# agent could not have foreseen.
COPY ./requirements.txt /tmp/requirements.txt
COPY ./requirements-verifier.txt /tmp/requirements-verifier.txt
RUN /usr/local/bin/python3 -m pip install --no-cache-dir \
        -r /tmp/requirements.txt -r /tmp/requirements-verifier.txt \
    && rm /tmp/requirements.txt /tmp/requirements-verifier.txt

# /app/submission is where harbor re-materialises the declared artifact.
RUN mkdir -p /app/submission /logs/verifier

# The policy process runs as uid 1001 and cannot read /tests, so the modules it
# needs are also installed outside it, root-owned and read-only.
COPY ./bnbenv /opt/bnbenv

COPY . /tests

# The last chmod closes the solver to uid 1001: the trusted solver process runs
# as root and keeps full access, while the policy process cannot reach a MILP
# solver even through a subprocess. The task instructions state this rule.
RUN chown -R root:root /tests \
    && chmod 700 /tests/hidden_data /tests/hidden_data/intermediate /tests/hidden_data/final \
    && chmod +x /tests/test.sh /tests/intermediate.sh \
    && find /tests -exec touch -d @1700000000 {} + \
    && chmod 0700 /usr/local/lib/python3.13/site-packages/pyscipopt

WORKDIR /tests

# Runtime-only seal: AFTER every build-time RUN, one ENV per line.
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1
