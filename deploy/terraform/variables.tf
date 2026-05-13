variable "vps_ip" {
  description = "Public IP of the VPS (output from ~/infrastructure/VPS/Vultr-001)"
  type        = string
}

variable "ssh_private_key_path" {
  description = "Path to the SSH private key for the VPS"
  type        = string
  default     = "~/.ssh/id_ed25519"
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token. Leave empty if using Global API Key."
  type        = string
  sensitive   = true
  default     = ""
}

variable "cloudflare_api_key" {
  description = "Cloudflare Global API Key (fallback if API token lacks origin cert permissions)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "cloudflare_email" {
  description = "Cloudflare account email (required when using Global API Key)"
  type        = string
  default     = ""
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for onemorepeppy.com"
  type        = string
}

variable "subdomain" {
  description = "Subdomain to deploy to (results in subdomain.onemorepeppy.com)"
  type        = string
}

variable "app_name" {
  description = "Internal app identifier — used for VPS directory, Docker project name, etc. Must match APP_NAME in deploy.sh."
  type        = string
}

variable "app_display_name" {
  description = "Human-readable app name — used in login emails"
  type        = string
}

variable "admin_email" {
  description = "Admin user email address"
  type        = string
  default     = "miiiikeb@gmail.com"
}

variable "allowed_emails" {
  description = "Comma-separated list of emails permitted to log in"
  type        = string
}

variable "session_secret" {
  description = "Secret key for signing session cookies"
  type        = string
  sensitive   = true
}

variable "smtp_host" {
  description = "SMTP server hostname"
  type        = string
  default     = "smtp.migadu.com"
}

variable "smtp_port" {
  description = "SMTP server port"
  type        = number
  default     = 465
}

variable "smtp_user" {
  description = "SMTP username (email address)"
  type        = string
}

variable "smtp_password" {
  description = "SMTP password"
  type        = string
  sensitive   = true
}

variable "github_token" {
  description = "GitHub personal access token for Issues integration"
  type        = string
  sensitive   = true
  default     = ""
}

variable "gh_repo" {
  description = "GitHub repository for Issues integration (e.g. owner/repo)"
  type        = string
  default     = ""
}
