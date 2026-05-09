#!/usr/bin/env node
/**
 * summarize.js — reads k6 JSON results + ws_flood text files from
 * bench/results/ and writes a markdown summary to $GITHUB_STEP_SUMMARY.
 *
 * Usage (called automatically by the CI workflow):
 *   node bench/summarize.js
 */

import { readFileSync, readdirSync, appendFileSync, existsSync } from "fs"
import { join } from "path"

const RESULTS_DIR   = "bench/results"
const SUMMARY_FILE  = process.env.GITHUB_STEP_SUMMARY

if (!SUMMARY_FILE) {
  console.error("GITHUB_STEP_SUMMARY not set — only useful in GitHub Actions")
  process.exit(1)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function latestFile(prefix) {
  if (!existsSync(RESULTS_DIR)) return null
  const match = readdirSync(RESULTS_DIR)
    .filter(f => f.startsWith(prefix) && f.endsWith(".json"))
    .sort()
    .at(-1)
  if (!match) return null
  try { return JSON.parse(readFileSync(join(RESULTS_DIR, match), "utf8")) }
  catch { return null }
}

function readText(filename) {
  const p = join(RESULTS_DIR, filename)
  return existsSync(p) ? readFileSync(p, "utf8").trim() : null
}

// k6 Trend metric value: data.metrics[name].values[stat]
function val(data, metric, stat) {
  const v = data?.metrics?.[metric]?.values?.[stat]
  return v != null ? v : null
}

function ms(data, metric, stat) {
  const v = val(data, metric, stat)
  return v != null ? `${v.toFixed(1)} ms` : "—"
}

function pct(data, metric, stat) {
  const v = val(data, metric, stat)
  return v != null ? `${(v * 100).toFixed(2)}%` : "—"
}

function count(data, metric) {
  const v = data?.metrics?.[metric]?.values?.count
  return v != null ? v.toLocaleString() : "—"
}

// ── Load results ──────────────────────────────────────────────────────────────

const ph_http  = latestFile("http_phoenix")
const ra_http  = latestFile("http_rails")
const ph_ws    = latestFile("ws_phoenix")
const ra_ws    = latestFile("ws_rails")
const ph_flood = readText("flood_phoenix.txt")
const ra_flood = readText("flood_rails.txt")

// ── Build markdown ────────────────────────────────────────────────────────────

const now = new Date().toUTCString()

let md = `# Benchmark Results\n\n`
md += `> **Runner:** \`ubuntu-latest\` &nbsp;·&nbsp; **Commit:** \`${process.env.GITHUB_SHA?.slice(0, 7) ?? "local"}\` &nbsp;·&nbsp; ${now}\n\n`

// ── HTTP ──────────────────────────────────────────────────────────────────────

md += `## HTTP Throughput (k6)\n\n`
md += `Ramp: 10 → 50 → 100 VUs over 70 s. Each VU loads the room page then creates a todo.\n\n`
md += `| Metric | Phoenix LiveView | Rails Hotwire |\n`
md += `|:---|---:|---:|\n`
md += `| Request p50 (med) | ${ms(ph_http, "http_req_duration", "med")} | ${ms(ra_http, "http_req_duration", "med")} |\n`
md += `| Request p95 | ${ms(ph_http, "http_req_duration", "p(95)")} | ${ms(ra_http, "http_req_duration", "p(95)")} |\n`
md += `| Request p99 | ${ms(ph_http, "http_req_duration", "p(99)")} | ${ms(ra_http, "http_req_duration", "p(99)")} |\n`
md += `| Todo create p95 | ${ms(ph_http, "todo_create_latency", "p(95)")} | ${ms(ra_http, "todo_create_latency", "p(95)")} |\n`
md += `| Todos created | ${count(ph_http, "todos_created")} | ${count(ra_http, "todos_created")} |\n`
md += `| Error rate | ${pct(ph_http, "http_req_failed", "rate")} | ${pct(ra_http, "http_req_failed", "rate")} |\n\n`

// ── WebSocket ─────────────────────────────────────────────────────────────────

md += `## WebSocket Connection Scaling (k6)\n\n`
md += `Ramp: 50 → 200 → 500 VUs over 70 s. Each VU connects, subscribes to a room, and holds open for 2 s.\n\n`
md += `| Metric | Phoenix LiveView | Rails Hotwire |\n`
md += `|:---|---:|---:|\n`
md += `| Connect p50 | ${ms(ph_ws, "ws_connect_ms", "med")} | ${ms(ra_ws, "ws_connect_ms", "med")} |\n`
md += `| Connect p95 | ${ms(ph_ws, "ws_connect_ms", "p(95)")} | ${ms(ra_ws, "ws_connect_ms", "p(95)")} |\n`
md += `| Connect p99 | ${ms(ph_ws, "ws_connect_ms", "p(99)")} | ${ms(ra_ws, "ws_connect_ms", "p(99)")} |\n`
md += `| First message p95 | ${ms(ph_ws, "ws_first_msg_ms", "p(95)")} | ${ms(ra_ws, "ws_first_msg_ms", "p(95)")} |\n`
md += `| Messages received | ${count(ph_ws, "ws_messages_received")} | ${count(ra_ws, "ws_messages_received")} |\n`
md += `| Error rate | ${pct(ph_ws, "ws_errors", "rate")} | ${pct(ra_ws, "ws_errors", "rate")} |\n\n`

// ── WS flood ──────────────────────────────────────────────────────────────────

md += `## WebSocket Flood (500 persistent connections)\n\n`

for (const [label, text] of [["Phoenix LiveView", ph_flood], ["Rails Hotwire", ra_flood]]) {
  md += `<details><summary>${label}</summary>\n\n\`\`\`\n${text ?? "no output captured"}\n\`\`\`\n\n</details>\n\n`
}

// ── Write ─────────────────────────────────────────────────────────────────────

appendFileSync(SUMMARY_FILE, md)
console.log("Summary written to $GITHUB_STEP_SUMMARY")
