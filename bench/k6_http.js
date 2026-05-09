/**
 * k6 HTTP benchmark — measures todo CRUD throughput over HTTP.
 *
 * Usage:
 *   # Phoenix
 *   k6 run bench/k6_http.js --env TARGET=phoenix
 *   # Rails
 *   k6 run bench/k6_http.js --env TARGET=rails
 *
 * Saves summary to bench/results/http_<target>_<timestamp>.json
 */
import http from "k6/http"
import { check, sleep } from "k6"
import { Trend, Counter } from "k6/metrics"

// ── Config ────────────────────────────────────────────────────────────────────
const TARGET  = __ENV.TARGET || "phoenix"
const BASE    = TARGET === "phoenix" ? "http://localhost:4000" : "http://localhost:3000"
const ROOM_ID = "bench-room"

// ── Custom metrics ────────────────────────────────────────────────────────────
const createLatency  = new Trend("todo_create_latency", true)
const toggleLatency  = new Trend("todo_toggle_latency", true)
const deleteLatency  = new Trend("todo_delete_latency", true)
const totalCreated   = new Counter("todos_created")
const totalErrors    = new Counter("errors")

// ── k6 options ────────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: "15s", target: 10 },   // ramp up
    { duration: "30s", target: 50 },   // sustained load
    { duration: "15s", target: 100 },  // peak
    { duration: "10s", target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_failed:         ["rate<0.01"],
    todo_create_latency:     ["p(95)<500"],
    todo_toggle_latency:     ["p(95)<500"],
  },
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function csrf(res) {
  const m = res.body.match(/name="csrf-token" content="([^"]+)"/) ||
            res.body.match(/content="([^"]+)" name="csrf-token"/)
  return m ? m[1] : ""
}

function csrfHeaders(token) {
  const h = { "Content-Type": "application/json" }
  if (TARGET === "rails") h["X-CSRF-Token"] = token
  return h
}

// ── Virtual user scenario ─────────────────────────────────────────────────────
export default function () {
  // 1. Load the room page (also sets cookies / session)
  const roomRes = http.get(`${BASE}/room/${ROOM_ID}`)
  check(roomRes, { "room page 200": (r) => r.status === 200 })

  const token = csrf(roomRes)
  const jar   = http.cookieJar()

  // 2. Create a todo
  const createStart = Date.now()
  let createRes

  if (TARGET === "phoenix") {
    // Phoenix: LiveView handles CRUD over WebSocket in normal use.
    // This HTTP endpoint exists for benchmarking — uses the :api pipeline (no CSRF).
    createRes = http.post(
      `${BASE}/room/${ROOM_ID}/todos`,
      JSON.stringify({ content: `k6 todo ${Date.now()}` }),
      { headers: { "Content-Type": "application/json" }, jar }
    )
  } else {
    createRes = http.post(
      `${BASE}/room/${ROOM_ID}/todos`,
      JSON.stringify({ todo: { content: `k6 todo ${Date.now()}` } }),
      { headers: { ...csrfHeaders(token), Accept: "text/vnd.turbo-stream.html" }, jar }
    )
  }

  createLatency.add(Date.now() - createStart)
  const ok = check(createRes, { "create 2xx": (r) => r.status >= 200 && r.status < 300 })
  if (ok) totalCreated.add(1)
  else    totalErrors.add(1)

  sleep(0.2)
}

export function handleSummary(data) {
  const ts     = new Date().toISOString().replace(/[:.]/g, "-")
  const fname  = `bench/results/http_${TARGET}_${ts}.json`
  return { [fname]: JSON.stringify(data, null, 2), stdout: JSON.stringify(data, null, 2) }
}
