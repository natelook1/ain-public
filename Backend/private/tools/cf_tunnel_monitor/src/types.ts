export interface QuicConnection {
  conn_index: number | string
  edge_location: string | null
  latest_rtt: number | null
  min_rtt: number | null
  smoothed_rtt: number | null
  congestion_state: number | null
  congestion_window: number | null
  sent_bytes: number | null
  receive_bytes: number | null
  lost_packets: { reason?: string; count: number }[]
}

export interface RpcOperation {
  method: string
  count: number
  failures: number
  latency_avg: number | null
}

export interface NodeData {
  node_ip: string
  status: 'online' | 'offline'
  protocol: string
  version?: string
  goversion?: string
  connection_ids: string[]
  load_pct?: number
  total_requests: number
  active_streams: number
  ha_connections: number | null
  concurrent_requests: number | null
  request_errors: number
  tcp_total_sessions: number
  config_pushes: number
  config_push_errors: number
  register_success: number
  response_codes: Record<string, number>
  success_rate: number | null
  quic_connections: QuicConnection[]
  quic_total_connections: number | null
  quic_closed_connections: number | null
  server_locations: { id: string; loc: string }[]
  rpc_operations: RpcOperation[]
  goroutines: number | null
  threads: number | null
  gc_count: number | null
  gc_pause_ms: number | null
  heap_alloc_bytes: number | null
  heap_inuse_bytes: number | null
  heap_sys_bytes: number | null
  resident_memory_bytes: number | null
  virtual_memory_bytes: number | null
  cpu_seconds_total: number | null
  open_fds: number | null
  max_fds: number | null
  network_rx_bytes: number | null
  network_tx_bytes: number | null
  process_start_time: number | null
  gomaxprocs: number | null
  raw_metric_count: number
  cloudflared_version?: { version: string; goversion?: string }
}

export interface ConnectorMetrics {
  node_ip: string
  total_requests: number
  active_streams: number
  load_pct: number | null
  success_rate: number | null
  response_codes: Record<string, number>
}

export interface Connector {
  id: string
  client_id?: string
  client_version?: string
  colo_name?: string
  opened_at: string
  is_pending_reconnect: boolean
  arch?: string
  os?: string
  metrics: ConnectorMetrics | null
}

export interface Tunnel {
  tunnel_id: string
  tunnel_name: string
  status: 'healthy' | 'degraded' | 'inactive'
  connector_count: number
  connectors: Connector[]
  conns_active_at: string | null
  created_at: string | null
  conns_inactive_at: string | null
}

export interface LoadBalance {
  node1_ip: string
  node1_pct: number
  node2_ip: string
  node2_pct: number
  node3_ip?: string
  node3_pct?: number
  is_balanced: boolean
}

export interface HistoryPoint {
  time: string
  requests: number
  streams: number
  errors: number
  rx: number
  tx: number
  response_codes: Record<string, number>
  err503?: number
  err504?: number
  authentik_errors?: number
}

export interface ErrorAnalyticsEntry {
  count: number
  dimensions: {
    clientIP: string
    edgeResponseStatus: number
    clientRequestHTTPHost: string
    clientRequestPath: string
    datetimeFiveMinutes: string
    clientRequestHTTPMethodName?: string
    userAgent?: string
    clientCountryName?: string
  }
}

export interface ThreatLogEntry {
  ip: string
  country: string
  host: string
  path: string
  method: string
  ua: string
  status: number
  count: number
  bucket: string | null
  threat_class: 'scanner' | 'brute-force' | 'probe' | 'crawler-probe' | 'crawler' | 'anomaly'
  severity: 'high' | 'medium' | 'low'
}

export interface ThreatSummary {
  total: number
  unique_ips: number
  scanners: number
  probes: number
  crawlers: number
  brute_force: number
  anomalies: number
  high_severity: number
  top_countries?: { country: string; hits: number }[]
}

export interface WafCandidate {
  ip: string
  country: string
  total_hits: number
  threat_classes: string[]
  severity: 'high' | 'medium' | 'low'
  sample_paths: string[]
  sample_uas: string[]
  waf_rule: string
  waf_action: 'block' | 'challenge'
}

export interface ThreatHistoryPoint {
  time: string
  summary: {
    total: number
    unique_ips: number
    scanners: number
    probes: number
    crawlers: number
    brute_force: number
    anomalies: number
    high_severity: number
  }
  top_offenders: {
    ip: string
    country: string
    total_hits: number
    severity: 'high' | 'medium' | 'low'
    threat_classes: string[]
    sample_paths: string[]
  }[]
}

export interface ThreatLibraryEntry {
  ip: string
  first_seen: string
  last_seen: string
  total_hits_alltime: number
  countries: string[]
  threat_classes: string[]
  severity_peak: 'high' | 'medium' | 'low'
  sample_paths: string[]
  sample_uas: string[]
  dormant?: boolean
}

export interface TunnelData {
  summary: {
    total_tunnels: number
    healthy: number
    degraded: number
    down: number
    total_connectors: number
    total_requests: number
    total_active_streams: number
    total_rx_bytes: number
    total_tx_bytes: number
    total_proxy_errors: number
  }
  tunnels: Tunnel[]
  nodes: NodeData[]
  load_balance: LoadBalance | null
  history: HistoryPoint[]
  error_analytics: ErrorAnalyticsEntry[]
  threat_log: ThreatLogEntry[]
  threat_summary: ThreatSummary | null
  waf_candidates: WafCandidate[]
  threat_history: ThreatHistoryPoint[]
  threat_library: ThreatLibraryEntry[]
  library_meta?: { total: number; offset: number; limit: number; has_more: boolean }
  fetched_at: string
}

export type AppMode = 'overview' | 'live' | 'threat'
