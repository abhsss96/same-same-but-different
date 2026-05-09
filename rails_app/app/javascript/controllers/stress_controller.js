// stress_controller.js
// Opens N WebSocket connections to Action Cable and measures time-to-first-message.
//
// DIVERGENCE NOTE: Phoenix LiveView's stress test runs in-process (Elixir PIDs
// messaging each other via PubSub). Here we open real browser WebSocket connections
// which tests the full network path but is limited by browser connection limits.

import { Controller } from "@hotwired/stimulus"
import ActionCable from "@rails/actioncable"

export default class extends Controller {
  static targets = ["connCount", "runBtn", "status", "log"]
  static values  = { wsUrl: String }

  run() {
    const n       = parseInt(this.connCountTarget.value) || 50
    const wsUrl   = this.wsUrlValue || "ws://localhost:3000/cable"
    const results = []

    this.logTarget.classList.remove("hidden")
    this.logTarget.innerHTML = ""
    this.runBtnTarget.disabled = true
    this.statusTarget.textContent = `Connecting ${n} clients…`

    let completed = 0

    for (let i = 0; i < n; i++) {
      const t0 = performance.now()
      const cable = ActionCable.createConsumer(wsUrl)

      cable.subscriptions.create(
        { channel: "RoomChannel", room_id: "stress-test" },
        {
          connected: () => {
            const rtt = (performance.now() - t0).toFixed(2)
            results.push(parseFloat(rtt))
            completed++

            if (completed === n) {
              this.showResults(results)
              cable.disconnect()
            }
          }
        }
      )
    }

    // Timeout safety
    setTimeout(() => {
      if (completed < n) {
        this.appendLog(`Timed out: only ${completed}/${n} connected`)
        this.finish()
      }
    }, 10000)
  }

  showResults(latencies) {
    const sorted = [...latencies].sort((a, b) => a - b)
    const n      = sorted.length
    const avg    = (sorted.reduce((s, v) => s + v, 0) / n).toFixed(2)
    const p50    = sorted[Math.floor(n * 0.50)].toFixed(2)
    const p95    = sorted[Math.floor(n * 0.95)].toFixed(2)
    const p99    = sorted[Math.floor(n * 0.99)].toFixed(2)

    this.appendLog(`${n} connections — avg ${avg} ms · p50 ${p50} ms · p95 ${p95} ms · p99 ${p99} ms`)
    this.finish()
  }

  appendLog(line) {
    const div = document.createElement("div")
    div.className = "leading-5"
    div.textContent = line
    this.logTarget.prepend(div)
  }

  finish() {
    this.runBtnTarget.disabled = false
    this.statusTarget.textContent = ""
  }
}
