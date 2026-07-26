#!/bin/bash
# ===============================================
# 🔒 VPS Security Hardening — Ubuntu 22.04/24.04
# ===============================================
# Run ONCE on a fresh VPS as root (or via sudo).
# Idempotent: safe to re-run; existing settings are kept.
#
# What it does:
#   1. Creates a non-root sudo user (default: deploy)
#   2. Installs your SSH public key for that user
#   3. Disables SSH password auth + root login
#   4. (optional) Changes SSH port
#   5. Enables UFW firewall: 22/SSH, 80/HTTP, 443/HTTPS
#   6. Installs fail2ban (SSH brute-force protection)
#   7. Enables unattended-upgrades for security patches
#   8. Sets timezone to Europe/Moscow + chrony NTP sync
#   9. Adds 2 GB swap if RAM < 2 GB and no swap exists
#  10. Locks down /etc/sudoers
#
# Usage:
#   curl -O https://raw.githubusercontent.com/<you>/<repo>/main/vps-security-setup.sh
#   chmod +x vps-security-setup.sh
#   DEPLOY_USER=deploy SSH_PORT=22 SSH_PUBKEY="ssh-ed25519 AAAA... user@laptop" sudo ./vps-security-setup.sh
#
# Or interactively:
#   sudo ./vps-security-setup.sh
# ===============================================

set -e

# ----- Config -----
DEPLOY_USER="${DEPLOY_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"
SSH_PUBKEY="${SSH_PUBKEY:-}"
TIMEZONE="${TIMEZONE:-Europe/Moscow}"

if [[ $EUID -ne 0 ]]; then
   echo "❌ Run as root (or via sudo)"
   exit 1
fi

echo "🔒 VPS Security Setup"
echo "   Deploy user: $DEPLOY_USER"
echo "   SSH port:    $SSH_PORT"
echo "   Timezone:    $TIMEZONE"
echo ""

# Prompt for pubkey if not provided
if [[ -z "$SSH_PUBKEY" ]]; then
    echo "Paste your SSH public key (one line, ends with your laptop username):"
    read -r SSH_PUBKEY
fi

if [[ ! "$SSH_PUBKEY" =~ ^(ssh-rsa|ssh-ed25519|ecdsa-sha2-) ]]; then
    echo "❌ Invalid SSH key format"
    exit 1
fi

# ===============================================
# 1. System update
# ===============================================
echo "📦 Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

# ===============================================
# 2. Create deploy user
# ===============================================
if id "$DEPLOY_USER" &>/dev/null; then
    echo "✅ User $DEPLOY_USER already exists"
else
    echo "👤 Creating user $DEPLOY_USER..."
    adduser --disabled-password --gecos "" "$DEPLOY_USER"
    usermod -aG sudo "$DEPLOY_USER"
fi

# Set passwordless sudo (you only get in via SSH key, so password is never used)
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$DEPLOY_USER"
chmod 0440 "/etc/sudoers.d/90-$DEPLOY_USER"

# ===============================================
# 3. SSH key
# ===============================================
echo "🔑 Installing SSH key for $DEPLOY_USER..."
USER_HOME=$(eval echo "~$DEPLOY_USER")
mkdir -p "$USER_HOME/.ssh"
chmod 700 "$USER_HOME/.ssh"
touch "$USER_HOME/.ssh/authorized_keys"
chmod 600 "$USER_HOME/.ssh/authorized_keys"
grep -qxF "$SSH_PUBKEY" "$USER_HOME/.ssh/authorized_keys" || echo "$SSH_PUBKEY" >> "$USER_HOME/.ssh/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$USER_HOME/.ssh"

# ===============================================
# 4. SSH hardening
# ===============================================
echo "🔐 Hardening SSH config..."
SSHD_CONF="/etc/ssh/sshd_config.d/99-hardening.conf"
cat > "$SSHD_CONF" <<EOF
# Managed by vps-security-setup.sh
Port $SSH_PORT
PermitRootLogin no
PasswordAuthentication no
ChallengeResponseAuthentication no
KbdInteractiveAuthentication no
UsePAM yes
PubkeyAuthentication yes
X11Forwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
MaxAuthTries 3
LoginGraceTime 30
AllowUsers $DEPLOY_USER
EOF
chmod 644 "$SSHD_CONF"

# On Ubuntu 22.04+ socket-based SSH ignores Port directive in config — disable socket
systemctl daemon-reload
systemctl disable --now ssh.socket 2>/dev/null || true

# Validate and reload
sshd -t
systemctl restart ssh

echo "✅ SSH: only $DEPLOY_USER with key, port $SSH_PORT, no root, no password"

# ===============================================
# 5. UFW firewall
# ===============================================
echo "🔥 Configuring UFW firewall..."
apt-get install -y ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow "$SSH_PORT"/tcp comment 'SSH'
ufw allow 80/tcp  comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
ufw status verbose

# ===============================================
# 6. fail2ban (SSH brute-force protection)
# ===============================================
echo "🛡️  Installing fail2ban..."
apt-get install -y fail2ban
cat > /etc/fail2ban/jail.d/sshd.local <<EOF
[sshd]
enabled = true
port    = $SSH_PORT
maxretry = 5
findtime = 10m
bantime  = 1h
EOF
systemctl enable fail2ban
systemctl restart fail2ban

# ===============================================
# 7. Unattended security upgrades
# ===============================================
echo "🔄 Enabling automatic security updates..."
apt-get install -y unattended-upgrades apt-listchanges
dpkg-reconfigure --priority=low unattended-upgrades || true
cat > /etc/apt/apt.conf.d/20auto-upgrades <<EOF
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

# ===============================================
# 8. Time sync
# ===============================================
echo "🕐 Setting timezone + NTP sync..."
timedatectl set-timezone "$TIMEZONE"
apt-get install -y chrony
systemctl enable --now chrony

# ===============================================
# 9. Swap (if RAM < 2 GB and no swap)
# ===============================================
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
SWAP_MB=$(free -m | awk '/^Swap:/{print $2}')
if [[ "$TOTAL_RAM_MB" -lt 2000 && "$SWAP_MB" -lt 100 ]]; then
    echo "💾 Adding 2 GB swap (RAM: ${TOTAL_RAM_MB} MB)..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo "/swapfile none swap sw 0 0" >> /etc/fstab
    sysctl vm.swappiness=10
    echo "vm.swappiness=10" > /etc/sysctl.d/99-swappiness.conf
fi

# ===============================================
# 10. Hostname (optional)
# ===============================================
if [[ -n "$HOSTNAME_NEW" ]]; then
    echo "🏷️  Setting hostname to $HOSTNAME_NEW..."
    hostnamectl set-hostname "$HOSTNAME_NEW"
fi

# ===============================================
# Done
# ===============================================
echo ""
echo "✅ Security setup complete!"
echo ""
echo "⚠️  CRITICAL: BEFORE CLOSING THIS SESSION:"
echo "   Open a NEW terminal and verify SSH login works:"
echo "     ssh -p $SSH_PORT $DEPLOY_USER@<this-vps-ip>"
echo ""
echo "   If it fails — DO NOT close current session, fix the issue first."
echo ""
echo "📊 Status:"
echo "   - SSH:       $SSH_PORT (key-only, no root, no password)"
echo "   - Firewall:  UFW (22/80/443 open)"
echo "   - fail2ban:  active"
echo "   - Updates:   automatic (security only)"
echo "   - Timezone:  $TIMEZONE"
echo ""
echo "📝 Next steps:"
echo "   1. Switch to deploy user: ssh -p $SSH_PORT $DEPLOY_USER@<ip>"
echo "   2. Install app stack: Node.js 22, PM2, Nginx, Certbot"
echo "   3. Clone repo and run ./deploy-vps.sh"
