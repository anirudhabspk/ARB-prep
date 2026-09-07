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
    NUMEXPR_NUM_THREADS=1

# The root verifier drops privileges to this user before it executes candidate code.
RUN useradd --create-home --uid 1001 agent

# The SAME set the agent image installs: the verifier executes the candidate's module under
# this interpreter, so anything missing here is an ImportError it could not have foreseen.
COPY ./requirements.txt /tmp/requirements.txt
COPY ./requirements-verifier.txt /tmp/requirements-verifier.txt
RUN /usr/local/bin/python3 -m pip install --no-cache-dir \
        -r /tmp/requirements.txt -r /tmp/requirements-verifier.txt \
    && rm /tmp/requirements.txt /tmp/requirements-verifier.txt

# /app/output is where the declared artifact is re-materialised inside this image.
RUN mkdir -p /app/output /logs/verifier

COPY . /tests

# Sealed series matrix, checked against its manifest sha256; the untrusted-side batch runner
# goes to /opt/grade because it has to be readable by uid 1001 while /tests stays 0700 root.
# One layer, so the 245 MB matrix is not copied again by a later chown or touch. The runuser
# check fails the build here rather than at grade time: test_state.py drops privilege with it.
RUN /usr/local/bin/python3 /tests/materialize_data.py /tests/shards /tests/hidden_data \
    && rm -rf /tests/shards \
    && mkdir -p /opt/grade \
    && cp /tests/run_batch.py /opt/grade/run_batch.py \
    && chmod 0755 /opt/grade /opt/grade/run_batch.py \
    && test -x /usr/sbin/runuser \
    && chown -R root:root /tests \
    && chmod 700 /tests \
    && chmod 700 /tests/hidden_data /tests/hidden_data/intermediate /tests/hidden_data/final \
    && chmod +x /tests/test.sh /tests/intermediate.sh \
    && find /tests -exec touch -d @1700000000 {} +

WORKDIR /tests

# Runtime-only seal: after every build-time RUN, one ENV per line, no continuation.
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1
