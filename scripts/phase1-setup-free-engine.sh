#!/bin/sh
# Local Phase 1 tooling: free Docker Engine, independent of Docker Desktop.
set -eu
test "$(id -u)" = 0
test "${WSL_DISTRO_NAME:-}" = barangayan-phase1
test "$(. /etc/os-release; printf '%s' "$VERSION_CODENAME")" = noble
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<'SOURCES'
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: amd64
Signed-By: /etc/apt/keyrings/docker.asc
SOURCES
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl start docker
/usr/bin/docker version
/usr/bin/docker run --rm hello-world
install -m 0755 -d /opt/barangayan-tools
curl -fL https://github.com/supabase/cli/releases/download/v2.118.0/supabase_2.118.0_linux_amd64.tar.gz -o /opt/barangayan-tools/supabase.tar.gz
# Verified against the official GitHub release asset metadata.
printf '%s\n' 'f6089a86fb9d9221c958193a277338daddd6822f706929943812fa32e106c86d  /opt/barangayan-tools/supabase.tar.gz' > /opt/barangayan-tools/supabase.sha256
sha256sum -c /opt/barangayan-tools/supabase.sha256
tar -xzf /opt/barangayan-tools/supabase.tar.gz -C /opt/barangayan-tools supabase
/opt/barangayan-tools/supabase --version
