FROM --platform=linux/amd64 public.ecr.aws/docker/library/python:3.13-slim-bookworm@sha256:01f42367a0a94ad4bc17111776fd66e3500c1d87c15bbd6055b7371d39c124fb

# Install tmux=3.3a-3 asciinema (required by harbor terminus-2 agent)
# Pinned AND pulled from a frozen archive snapshot (20260801T000000Z) so the pin
# cannot rot -- the rolling pocket can drop this exact version, the
# snapshot cannot. Sources are scoped to this install and removed after.
RUN set -eu; \
    if [ ! -s /etc/ssl/certs/ca-certificates.crt ]; then \
      apt-get update && apt-get install -y --no-install-recommends ca-certificates=20230311+deb12u1; \
    fi; \
    rm -f /tmp/hz-prereq.list; \
    echo 'deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://snapshot.debian.org/archive/debian/20260801T000000Z bookworm main' >> /tmp/hz-prereq.list; \
    echo 'deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://snapshot.debian.org/archive/debian-security/20260801T000000Z bookworm-security main' >> /tmp/hz-prereq.list; \
    apt-get -o Dir::Etc::sourcelist=/tmp/hz-prereq.list -o Dir::Etc::sourceparts=/dev/null -o Acquire::Check-Valid-Until=false update; \
    apt-get -o Dir::Etc::sourcelist=/tmp/hz-prereq.list -o Dir::Etc::sourceparts=/dev/null -o Acquire::Check-Valid-Until=false install -y --no-install-recommends tmux=3.3a-3 asciinema=2.2.0-1; \
    rm -f /tmp/hz-prereq.list; rm -rf /var/lib/apt/lists/*


ENTRYPOINT []
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONHASHSEED=0 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    OMP_NUM_THREADS=1 \
    MUJOCO_GL=disable

RUN useradd --create-home --uid 1001 agent

# An iterated research loop initialises a Git repository in this workspace and tells the agent it
# has one; the slim base image ships no git. Idempotent, and run as root before the USER switch.
RUN command -v git >/dev/null 2>&1 || (apt-get update && apt-get install -y --no-install-recommends git=1:2.39.5-0+deb12u3 && rm -rf /var/lib/apt/lists/*)
# The loop runs `git init` but never sets an identity, and git refuses to commit without one.
RUN git config --system user.email "agent@localhost" && git config --system user.name "autoresearch agent"

# Least-volatile first: the requirement set changes far less often than the app tree, so the
# expensive install layer survives every edit to /app.
COPY ./requirements.txt /tmp/requirements.txt
RUN /usr/local/bin/python3 -m pip install --no-cache-dir -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt

WORKDIR /app
COPY ./app /app

# /app and /app/output belong to the agent; /app/harness stays root-owned, so the harness is
# readable and runnable but cannot be edited.
RUN mkdir -p /app/output \
    && chown agent:agent /app /app/output \
    && find /app -exec touch -d @1700000000 {} +

USER agent
