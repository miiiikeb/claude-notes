locals {
  app_source = "${path.module}/../../"
  remote_app = "/opt/${var.app_name}"
  ssh_opts   = "-o StrictHostKeyChecking=no -o ConnectTimeout=30"

  # Cloudflare published IP ranges — https://www.cloudflare.com/ips/
  cloudflare_ipv4 = [
    "173.245.48.0/20",
    "103.21.244.0/22",
    "103.22.200.0/22",
    "103.31.4.0/22",
    "141.101.64.0/18",
    "108.162.192.0/18",
    "190.93.240.0/20",
    "188.114.96.0/20",
    "197.234.240.0/22",
    "198.41.128.0/17",
    "162.158.0.0/15",
    "104.16.0.0/13",
    "104.24.0.0/14",
    "172.64.0.0/13",
    "131.0.72.0/22",
  ]
  cloudflare_ipv6 = [
    "2400:cb00::/32",
    "2606:4700::/32",
    "2803:f800::/32",
    "2405:b500::/32",
    "2405:8100::/32",
    "2a06:98c0::/29",
    "2c0f:f248::/32",
  ]
}

resource "null_resource" "firewall" {
  triggers = {
    vps_ip = var.vps_ip
  }

  connection {
    type        = "ssh"
    user        = "root"
    host        = var.vps_ip
    private_key = file(pathexpand(var.ssh_private_key_path))
  }

  provisioner "remote-exec" {
    inline = concat(
      [
        "ufw delete allow 80/tcp 2>/dev/null || true",
        "ufw delete allow 443/tcp 2>/dev/null || true",
      ],
      [for ip in local.cloudflare_ipv4 : "ufw allow from ${ip} to any port 80 proto tcp"],
      [for ip in local.cloudflare_ipv4 : "ufw allow from ${ip} to any port 443 proto tcp"],
      [for ip in local.cloudflare_ipv6 : "ufw allow from ${ip} to any port 80 proto tcp"],
      [for ip in local.cloudflare_ipv6 : "ufw allow from ${ip} to any port 443 proto tcp"],
      ["ufw --force enable", "ufw status numbered"],
    )
  }
}

resource "null_resource" "deploy" {
  triggers = {
    vps_ip  = var.vps_ip
    cert_id = cloudflare_origin_ca_certificate.main.id
  }

  # 1. Wait for cloud-init to finish
  provisioner "remote-exec" {
    connection {
      type        = "ssh"
      user        = "root"
      host        = var.vps_ip
      private_key = file(pathexpand(var.ssh_private_key_path))
      timeout     = "5m"
    }
    inline = ["timeout 300 cloud-init status --wait || true"]
  }

  # 2. Rsync app files
  provisioner "local-exec" {
    command = <<-EOT
      rsync -az --delete \
        --exclude='node_modules' \
        --exclude='data' \
        --exclude='.env' \
        --exclude='.git' \
        --exclude='deploy/terraform/.terraform' \
        --exclude='deploy/terraform/terraform.tfstate*' \
        -e "ssh ${local.ssh_opts} -i ${pathexpand(var.ssh_private_key_path)}" \
        ${local.app_source} \
        root@${var.vps_ip}:${local.remote_app}/
    EOT
  }

  # 3. Write certs via scp, then configure and start
  provisioner "local-exec" {
    command = <<-EOT
      set -e

      echo '${cloudflare_origin_ca_certificate.main.certificate}' > /tmp/origin.pem
      echo '${tls_private_key.origin.private_key_pem}' > /tmp/origin.key

      ssh ${local.ssh_opts} -i ${pathexpand(var.ssh_private_key_path)} root@${var.vps_ip} "mkdir -p /etc/ssl/cloudflare"
      scp -o StrictHostKeyChecking=no -i ${pathexpand(var.ssh_private_key_path)} \
        /tmp/origin.pem root@${var.vps_ip}:/etc/ssl/cloudflare/origin.pem
      scp -o StrictHostKeyChecking=no -i ${pathexpand(var.ssh_private_key_path)} \
        /tmp/origin.key root@${var.vps_ip}:/etc/ssl/cloudflare/origin.key

      rm -f /tmp/origin.pem /tmp/origin.key
    EOT
  }

  # 4. Substitute subdomain in nginx config, write .env, start app
  provisioner "remote-exec" {
    connection {
      type        = "ssh"
      user        = "root"
      host        = var.vps_ip
      private_key = file(pathexpand(var.ssh_private_key_path))
    }
    inline = [
      "chmod 600 /etc/ssl/cloudflare/origin.key",
      "chmod 644 /etc/ssl/cloudflare/origin.pem",
      # Substitute APP_SUBDOMAIN placeholder in nginx config
      "sed -i 's/APP_SUBDOMAIN/${var.subdomain}/g' ${local.remote_app}/deploy/nginx.conf",
      # Write .env (never overwrite if already exists — use -n to avoid clobbering)
      "printf 'COMPOSE_PROJECT_NAME=${var.app_name}\\nPORT=3000\\nAPP_NAME=${var.app_display_name}\\nADMIN_EMAIL=${var.admin_email}\\nSESSION_SECRET=${var.session_secret}\\nSMTP_HOST=${var.smtp_host}\\nSMTP_PORT=${var.smtp_port}\\nSMTP_USER=${var.smtp_user}\\nSMTP_PASSWORD=${var.smtp_password}\\nALLOWED_EMAILS=${var.allowed_emails}\\nGITHUB_TOKEN=${var.github_token}\\nGH_REPO=${var.gh_repo}\\n' > ${local.remote_app}/.env",
      "cp ${local.remote_app}/deploy/nginx.conf /etc/nginx/sites-available/${var.subdomain}.onemorepeppy.com",
      "ln -sf /etc/nginx/sites-available/${var.subdomain}.onemorepeppy.com /etc/nginx/sites-enabled/",
      "rm -f /etc/nginx/sites-enabled/default",
      "nginx -t && systemctl reload nginx",
      "cd ${local.remote_app} && docker compose up -d --build",
    ]
  }
}
