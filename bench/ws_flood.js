#!/usr/bin/env node
/**
 * ws_flood.js — raw Node.js WebSocket connection flood.
 *
 * Opens N persistent connections and optionally sends M messages/sec each.
 * Reports connection setup p50/p95/p99 and steady-state memory metrics.
 *
 * Dependencies: ws (npm install ws)
 *
 * Usage:
 *   node bench/ws_flood.js --target phoenix --conns 500
 *   node bench/ws_flood.js --target rails   --conns 500 --rate 10 --duration 30
 *   node bench/ws_flood.js --target phoenix --conns 1000 --rate 0
 *
 * Options:
 *   --target   phoenix | rails          (default: phoenix)
 *   --conns    N connections            (default: 100)
 *   --rate     messages/sec per conn    (default: 0 = no messages)
 *   --duration seconds to hold open    (default: 20)
 *   --room     room id                  (default: "flood-room")
 */

import WebSocket from "ws"
import { parseArgs } from "util"

const { values: args } = parseArgs({
  options: {
    target:   { type: "string",  default: "phoenix" },
    conns:    { type: "string",  default: "100" },
    rate:     { type: "string",  default: "0" },
    duration: { type: "string",  default: "20" },
    room:     { type: "string",  default: "flood-room" },
  },
  strict: false,
})

const TARGET   = args.target
const N        = parseInt(args.conns)
const RATE     = parseFloat(args.rate)
const DURATION = parseInt(args.duration) * 1000
const ROOM     = args.room

const BASE = TARGET === "phoenix" ? "ws://localhost:4000" : "ws://localhost:3000"
const URL  = TARGET === "phoenix"
  ? `${BASE}/live/websocket?vsn=2.0.0`
  : `${BASE}/cable`

const PROTOCOL = TARGET === "phoenix" ? "phoenix" : "actioncable-v1-json"

console.log(`\n── ws_flood.js ─────────────────────────────────────`)
console.log(`  target   : ${TARGET} (${URL})`)
console.log(`  conns    : ${N}`)
console.log(`  msg/sec  : ${RATE} per connection`)
console.log(`  duration : ${DURATION / 1000}s`)
console.log(`────────────────────────────────────────────────────\n`)

const connectTimes  = []
const errors        = []
let   connected     = 0
let   msgRef        = 1

const sockets = []

function subscribe(socket) {
  if (TARGET === "phoenix") {
    socket.send(JSON.stringify(["1", "1", "phoenix", "heartbeat", {}]))
    socket.send(JSON.stringify([
      null, String(msgRef++), `lv:${ROOM}`, "phx_join",
      { url: `http://localhost:4000/room/${ROOM}`, params: {} }
    ]))
  } else {
    socket.send(JSON.stringify({
      command: "subscribe",
      identifier: JSON.stringify({ channel: "RoomChannel", room_id: ROOM }),
    }))
  }
}

function startRateLoop(socket) {
  if (RATE <= 0) return
  const interval = 1000 / RATE

  const timer = setInterval(() => {
    if (socket.readyState !== WebSocket.OPEN) { clearInterval(timer); return }

    if (TARGET === "phoenix") {
      socket.send(JSON.stringify(
        [null, String(msgRef++), `lv:${ROOM}`, "event",
         { type: "keyup", event: "typing", value: "hello" }]
      ))
    } else {
      socket.send(JSON.stringify({
        command: "message",
        identifier: JSON.stringify({ channel: "RoomChannel", room_id: ROOM }),
        data: JSON.stringify({ action: "typing", typing: true })
      }))
    }
  }, interval)

  sockets.push({ socket, timer })
}

let t0Global = Date.now()

for (let i = 0; i < N; i++) {
  const t0  = Date.now()
  let   opts = { headers: { "Cookie": "" } }
  if (TARGET === "phoenix") opts.protocol = "phoenix"

  const ws = new WebSocket(URL, opts)

  ws.on("open", () => {
    const dt = Date.now() - t0
    connectTimes.push(dt)
    connected++

    subscribe(ws)
    startRateLoop(ws)

    if (connected % 100 === 0 || connected === N) {
      const mem  = process.memoryUsage()
      console.log(`[${connected}/${N}] connected — rss ${(mem.rss / 1024 / 1024).toFixed(1)} MB`)
    }
  })

  ws.on("error", (e) => {
    errors.push(e.message)
    if (errors.length <= 5) console.error(`  WS error: ${e.message}`)
  })

  // Throttle connection ramp: ~50 new conns/sec
  if (i > 0 && i % 50 === 0) {
    await new Promise(r => setTimeout(r, 1000))
  }
}

// Hold connections open for DURATION
await new Promise(r => setTimeout(r, DURATION))

// Summary
function percentile(arr, p) {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length * p / 100)]
}

console.log("\n── Results ──────────────────────────────────────────")
console.log(`  connected     : ${connected} / ${N}`)
console.log(`  errors        : ${errors.length}`)
console.log(`  connect p50   : ${percentile(connectTimes, 50)} ms`)
console.log(`  connect p95   : ${percentile(connectTimes, 95)} ms`)
console.log(`  connect p99   : ${percentile(connectTimes, 99)} ms`)
console.log(`  connect max   : ${Math.max(...connectTimes, 0)} ms`)
console.log(`  rss (final)   : ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB`)
console.log("────────────────────────────────────────────────────\n")

// Cleanup
for (const { socket, timer } of sockets) {
  clearInterval(timer)
  socket.terminate()
}
process.exit(0)
