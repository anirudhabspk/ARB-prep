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
    apt-get -o Dir::Etc::sourcelist=/tmp/hz-prereq.list -o Dir::Etc::sourceparts=/dev/null -o Acquire::Check-Valid-Until=false install -y --no-install-recommends tmux=3.3a-3 asciinema=2.2.0-1 git=1:2.39.5-0+deb12u3; \
    rm -f /tmp/hz-prereq.list; rm -rf /var/lib/apt/lists/*


ENTRYPOINT []
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONHASHSEED=0 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1

# git: the agent harness initialises the workspace as a repository and tells the agent to
# keep or revert experiments with it; the slim base ships none. Pinned to the version
# bookworm currently serves; a Debian security bump would require re-pinning here.
RUN useradd --create-home --uid 1001 agent

# Least-volatile first: the requirement set changes far less often than the app tree.
COPY ./requirements.txt /tmp/requirements.txt
RUN /usr/local/bin/python3 -m pip install --no-cache-dir -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt

WORKDIR /app
COPY ./app /app

RUN chown -R agent:agent /app \
    && find /app -exec touch -d @1700000000 {} +

# Runtime-only seal: AFTER every build-time RUN, one ENV per line, no continuation.
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1

# The autoresearch harness inits the agent workspace as a Git repository and its prompt tells
# the agent to keep, compare and revert experiments with Git -- but it runs exactly
# `git rev-parse --git-dir || git init` and never sets an identity, so without this the first
# commit dies with "unable to auto-detect email address". --system (/etc/gitconfig), not
# --global, so it applies whatever HOME the agent process gets. git itself is installed above.
RUN git config --system user.email "agent@localhost" \
    && git config --system user.name "autoresearch agent"
USER agent
