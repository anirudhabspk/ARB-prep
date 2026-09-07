# The SAME digest-pinned slim CPU base as environment/Dockerfile, so the two images in
# separate-verifier mode share one pull and one layer cache on the same boot disk.
FROM --platform=linux/amd64 public.ecr.aws/docker/library/python:3.13-slim-bookworm@sha256:01f42367a0a94ad4bc17111776fd66e3500c1d87c15bbd6055b7371d39c124fb

ENTRYPOINT []

# libgomp1: the verifier EXECUTES the agent's deliverable, so it needs the same OpenMP
#           runtime the agent's image has.  Version pinned with `=` (bookworm, queried
#           2026-08-17).
# The trailing asserts fail the build if `setsid` / `runuser` are absent: the grader
# drops privilege with them, and a missing binary would otherwise surface only at
# grade time as every seed scoring 0.5.  Both come from util-linux, which is Essential
# in the base image, so they are asserted rather than reinstalled at a pinned version
# that could conflict with the base's own.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libgomp1=12.2.0-14+deb12u1 \
 && rm -rf /var/lib/apt/lists/* \
 && command -v setsid \
 && command -v runuser

# uid 1001 must match harbor's host uid: the grader runs the submitted module as this
# user, and it is the uid that owns the bind-mounted files under /logs.
RUN useradd --create-home --uid 1001 agent

COPY requirements.txt /tmp/requirements.txt
COPY requirements-verifier.txt /tmp/requirements-verifier.txt
RUN python3 -m pip install --no-cache-dir \
      -r /tmp/requirements.txt \
      -r /tmp/requirements-verifier.txt \
 && rm -f /tmp/requirements.txt /tmp/requirements-verifier.txt

COPY . /tests/
# /app/output is the declared artifact path; harbor re-materialises the agent's
# deliverable there, so its parent must exist in this image.  /tests and the sealed
# held-out halves are root-owned and unreadable to uid 1001.
RUN mkdir -p /app/output /logs/verifier /grade_stage /grade_work \
 && chmod +x /tests/test.sh /tests/intermediate.sh \
 && chown -R root:root /tests \
 && chmod -R go-rwx /tests \
 && chmod 700 /tests/hidden_data /tests/hidden_data/intermediate /tests/hidden_data/final /tests/hidden_data/shared

# The verifier image runs the grader from its own tree; test.sh/intermediate.sh cd here.
WORKDIR /tests

# sys.path[0] must not be a directory the graded run can write; PYTHONPATH is cleared
# so nothing inherited from the compose environment reaches the scorer's import path.
ENV PYTHONPATH=
ENV PYTHONSAFEPATH=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1

# Determinism: the trusted parent process (this image) builds panel inputs and scores
# ROC-AUC with numpy/sklearn, so it is pinned to the SAME values test_state.py's env
# dict sets for the privilege-dropped deliverable subprocess -- pinning one and not the
# other lets the two processes disagree on thread count or hash seed while looking
# identical on paper. No torch dependency exists on this image (see requirements.txt),
# so there is no torch.set_num_threads call to pin.
ENV PYTHONHASHSEED=0
ENV OMP_NUM_THREADS=8
ENV MKL_NUM_THREADS=8
ENV OPENBLAS_NUM_THREADS=8
