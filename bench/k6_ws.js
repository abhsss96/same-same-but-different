/**
 * k6 WebSocket benchmark — measures connection setup time, message latency,
 * and sustained throughput for both Phoenix LiveView and Rails Action Cable.
 *
 * Usage:
 *   k6 run bench/k6_ws.js --env TARGET=phoenix
 *   k6 run bench/k6_ws.js --env TARGET=rails
 *
 * PROTOCOL NOTES:
 *   Phoenix LiveView:   WebSocket to /live, uses phoenix wire protocol (JSON frames)
 *   Rails Action Cable: WebSocket to /cable, uses Action Cable JSON protocol
 *
 * The benchmark connects, subscribes to a room, sends a ping, waits for a reply,
 * and records latency. This exercises the full message round-trip path.
 */
import ws       from "k6/ws"
import { check, sleep } from "k6"
import { Trend, Counter, Rate } from "k6/metrics"

const TARGET = __ENV.TARGET || "phoenix"
const BASE   = TARGET === "phoenix" ? "ws://localhost:4000" : "ws://localhost:3000"
const ROOM   = "bench-room"

const connectTime  = new Trend("ws_connect_ms",  true)
const firstMsgTime = new Trend("ws_first_msg_ms", true)
const msgCount     = new Counter("ws_messages_received")
const errorRate    = new Rate("ws_errors")

export const options = {
  stages: [
    { duration: "10s", target: 50  },
    { duration: "30s", target: 200 },
    { duration: "20s", target: 500 },
    { duration: "10s", target: 0   },
  ],
  thresholds: {
    ws_connect_ms:    ["p(95)<2000"],
    ws_first_msg_ms:  ["p(95)<1000"],
    ws_errors:        ["rate<0.05"],
  },
}

let msgRef = 1

export default function () {
  const url     = TARGET === "phoenix"
    ? `${BASE}/live/websocket?vsn=2.0.0`
    : `${BASE}/cable`

  const t0      = Date.now()
  let connected = false
  let firstMsg  = false

  const res = ws.connect(url, {}, function (socket) {
    socket.on("open", () => {
      connectTime.add(Date.now() - t0)
      connected = true

      if (TARGET === "phoenix") {
        // Phoenix LiveView heartbeat + join
        socket.send(JSON.stringify(["1", "1", "phoenix", "heartbeat", {}]))
        socket.send(JSON.stringify([
          null, String(msgRef++), `lv:phx-${ROOM}`, "phx_join",
          { url: `http://localhost:4000/room/${ROOM}`, params: { _csrf_token: "" } }
        ]))
      } else {
        // Action Cable subscribe
        socket.send(JSON.stringify({
          command: "subscribe",
          identifier: JSON.stringify({ channel: "RoomChannel", room_id: ROOM })
        }))
      }
    })

    socket.on("message", (raw) => {
      msgCount.add(1)

      if (!firstMsg) {
        firstMsgTime.add(Date.now() - t0)
        firstMsg = true
      }

      try {
        const msg = JSON.parse(raw)

        if (TARGET === "rails") {
          // Action Cable confirm subscription → ping the room
          if (Array.isArray(msg) ? false : msg.type === "confirm_subscription") {
            socket.send(JSON.stringify({
              command: "message",
              identifier: JSON.stringify({ channel: "RoomChannel", room_id: ROOM }),
              data: JSON.stringify({ action: "typing", typing: false })
            }))
          }
        }
      } catch (_) {}
    })

    socket.on("error", (e) => { errorRate.add(true) })
    socket.on("close", ()  => {})

    sleep(2)
    socket.close()
  })

  check(res, { "ws status 101": (r) => r && r.status === 101 })
  if (!connected) errorRate.add(true)
}

export function handleSummary(data) {
  const ts    = new Date().toISOString().replace(/[:.]/g, "-")
  const fname = `bench/results/ws_${TARGET}_${ts}.json`
  return { [fname]: JSON.stringify(data, null, 2), stdout: JSON.stringify(data, null, 2) }
}
