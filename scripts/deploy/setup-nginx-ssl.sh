#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:?Usage: $0 DOMAIN EMAIL [PORT]}"
EMAIL="${2:?Usage: $0 DOMAIN EMAIL [PORT]}"
PORT="${3:-3000}"

echo "==> Setting up Nginx reverse proxy + SSL for ${DOMAIN} -> localhost:${PORT}"

apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx

cat > /etc/nginx/sites-available/"${DOMAIN}" <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/"${DOMAIN}" /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl restart nginx

echo "==> Requesting SSL certificate from Let's Encrypt"
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}" --redirect

echo "==> Enabling automatic certificate renewal"
systemctl enable --now certbot.timer 2>/dev/null || certbot renew --dry-run

echo "==> Configuring UFW firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> Done! Site is live at https://${DOMAIN}"
