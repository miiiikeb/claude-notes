# --- Origin Certificate (TLS between Cloudflare and VPS) ---

resource "tls_private_key" "origin" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_cert_request" "origin" {
  private_key_pem = tls_private_key.origin.private_key_pem
  subject {
    common_name = "${var.subdomain}.onemorepeppy.com"
  }
  dns_names = [
    "${var.subdomain}.onemorepeppy.com",
    "*.onemorepeppy.com",
  ]
}

resource "cloudflare_origin_ca_certificate" "main" {
  csr                = tls_cert_request.origin.cert_request_pem
  hostnames          = ["${var.subdomain}.onemorepeppy.com", "*.onemorepeppy.com"]
  request_type       = "origin-rsa"
  requested_validity = 5475 # 15 years in days
}

# --- DNS ---

resource "cloudflare_record" "main" {
  zone_id = var.cloudflare_zone_id
  name    = var.subdomain
  content = var.vps_ip
  type    = "A"
  ttl     = 1      # 1 = Auto (managed by Cloudflare proxy)
  proxied = true   # Orange cloud ON — traffic routes through Cloudflare
}

# SSL mode is set manually in Cloudflare dashboard:
# SSL/TLS → Overview → Full (strict)
