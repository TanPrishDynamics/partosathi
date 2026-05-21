"""
gunicorn.conf.py — Production Gunicorn configuration for e-Partogram.

Workers:  2×CPU+1  (standard formula for CPU-bound / mixed workloads)
Timeout:  30s      (matches Nginx proxy_read_timeout)
Requests: 1000 per worker before graceful restart (guards memory leaks)

Security (L-9):
  - Tightened limit_request_line and limit_request_fields per the audit:
    a JSON API does not need 4 KB URLs or 100 headers. Smaller caps reduce
    slow-loris + Range-header smuggling surface.
"""
import multiprocessing

bind             = "0.0.0.0:5001"
workers          = multiprocessing.cpu_count() * 2 + 1
worker_class     = "sync"          # switch to "gevent" if you add async routes
timeout          = 30
keepalive        = 5
max_requests     = 1000
max_requests_jitter = 100          # randomise restarts to avoid thundering herd
graceful_timeout = 10

# Logging — write to stdout/stderr so Docker/k8s captures them
accesslog  = "-"
errorlog   = "-"
loglevel   = "info"
# Mask query strings from access logs by default to avoid leaking sensitive
# values that might appear in URLs. (Auth tokens are in cookies, so this is
# defence-in-depth.) Body bytes are NOT logged — only response size.
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)sµs'

# ── L-9: Tightened slow-loris / header-smuggling caps ─────────────────────────
# 2 KB request line is more than enough for any /api/... path we ship.
limit_request_line   = 2048
# 50 headers is generous; legitimate clients send 10–20. Lower than 100 cap.
limit_request_fields = 50
# Cap each header to 4 KB — the largest legitimate header here is the
# CSRF-double-submit cookie + JWT cookies, well under 4 KB total.
limit_request_field_size = 4096

# Forwarded-Allow IPs: trust only the Docker bridge gateway when behind Nginx.
# Combined with the Flask-side ProxyFix (x_for=1), this prevents header
# forgery via direct connections that bypass Nginx.
forwarded_allow_ips = "127.0.0.1"
