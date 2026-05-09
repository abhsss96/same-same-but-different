// If you want to use Phoenix channels, run `mix help phx.gen.channel`
// to get started and then uncomment the line below.
// import "./user_socket.js"

// You can include dependencies in two ways.
//
// The simplest option is to put them in assets/vendor and
// import them using relative paths:
//
//     import "../vendor/some-package.js"
//
// Alternatively, you can `npm install some-package --prefix assets` and import
// them using a path starting with the package name:
//
//     import "some-package"
//

// Include phoenix_html to handle method=PUT/DELETE in forms and buttons.
import "phoenix_html"
// Establish Phoenix Socket and LiveView configuration.
import {Socket} from "phoenix"
import {LiveSocket} from "phoenix_live_view"
import topbar from "../vendor/topbar"

let csrfToken = document.querySelector("meta[name='csrf-token']").getAttribute("content")

// JS Hooks — used by StressLive for client-side round-trip timing.
// Phoenix LiveView handles all real-time state server-side; hooks are only
// needed when we want raw DOM access or timing measurements.
let Hooks = {}

// Hook: measures time from a JS event to the next phx:update on the element.
// Used by the stress test page to capture browser-side latency.
Hooks.LatencyProbe = {
  mounted() {
    this.pending = {}
    this.el.addEventListener("stress:send", (e) => {
      this.pending[e.detail.seq] = performance.now()
    })
    this.el.addEventListener("stress:recv", (e) => {
      const sent = this.pending[e.detail.seq]
      if (sent) {
        const rtt = (performance.now() - sent).toFixed(2)
        delete this.pending[e.detail.seq]
        this.pushEvent("js_rtt", { seq: e.detail.seq, rtt_ms: parseFloat(rtt) })
      }
    })
  }
}

let liveSocket = new LiveSocket("/live", Socket, {
  longPollFallbackMs: 2500,
  params: {_csrf_token: csrfToken},
  hooks: Hooks
})

// Show progress bar on live navigation and form submits
topbar.config({barColors: {0: "#29d"}, shadowColor: "rgba(0, 0, 0, .3)"})
window.addEventListener("phx:page-loading-start", _info => topbar.show(300))
window.addEventListener("phx:page-loading-stop", _info => topbar.hide())

// connect if there are any LiveViews on the page
liveSocket.connect()

// expose liveSocket on window for web console debug logs and latency simulation:
// >> liveSocket.enableDebug()
// >> liveSocket.enableLatencySim(1000)  // enabled for duration of browser session
// >> liveSocket.disableLatencySim()
window.liveSocket = liveSocket

