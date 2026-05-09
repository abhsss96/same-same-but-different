// room_controller.js
// Manages the Action Cable subscription for presence + typing events.
//
// DIVERGENCE NOTE: In Phoenix LiveView, presence is tracked server-side and
// arrives as `presence_diff` events on the same WebSocket as todo updates.
// Here we need explicit DOM manipulation (updatePresence, updateTyping) because
// Turbo Streams only handle HTML diffs — JSON events need a Stimulus controller.
//
// This file has no equivalent in the Phoenix app; its logic lives in
// RoomLive.handle_info/2 and the HEEx template.

import { Controller } from "@hotwired/stimulus"
import consumer from "../channels/consumer"

export default class extends Controller {
  static targets = ["presenceList", "connectedCount", "typingIndicator", "statsBar"]
  static values  = { roomId: String, userId: String, userName: String, userColor: String }

  connect() {
    this.typingTimeout = null
    this.subscription  = consumer.subscriptions.create(
      { channel: "RoomChannel", room_id: this.roomIdValue },
      {
        connected:    ()     => {},
        disconnected: ()     => {},
        received:     (data) => this.handleMessage(data)
      }
    )
  }

  disconnect() {
    this.subscription?.unsubscribe()
  }

  // Called on every keypress in the new-todo input (data-action="input->room#typing")
  typing(event) {
    const isTyping = event.target.value.length > 0
    this.subscription.perform("typing", { typing: isTyping })

    clearTimeout(this.typingTimeout)
    if (isTyping) {
      this.typingTimeout = setTimeout(() => {
        this.subscription.perform("typing", { typing: false })
      }, 2000)
    }
  }

  handleMessage(data) {
    switch (data.type) {
      case "presence_update":
        this.updatePresence(data.users)
        break
    }
  }

  updatePresence(users) {
    if (this.hasConnectedCountTarget) {
      this.connectedCountTarget.textContent = users.length
    }

    if (!this.hasPresenceListTarget) return

    this.presenceListTarget.innerHTML = users.map(u => {
      const initials = u.name.split(" ").map(w => w[0]).join("").toUpperCase()
      const isTyping = u.typing ? ' title="' + this.escapeHtml(u.name) + ' (typing…)"' : ' title="' + this.escapeHtml(u.name) + '"'
      return `<div
        class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-white select-none relative"
        style="background-color: ${this.escapeHtml(u.color)}"
        ${isTyping}
      >${this.escapeHtml(initials)}${u.typing ? '<span class="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full ring-1 ring-white"></span>' : ''}</div>`
    }).join("")

    // Typing indicator text
    if (this.hasTypingIndicatorTarget) {
      const others = users.filter(u => u.typing && u.id !== this.userIdValue)
      if (others.length === 0) {
        this.typingIndicatorTarget.textContent = ""
      } else if (others.length === 1) {
        this.typingIndicatorTarget.textContent = `${others[0].name} is typing…`
      } else if (others.length === 2) {
        this.typingIndicatorTarget.textContent = `${others[0].name} and ${others[1].name} are typing…`
      } else {
        this.typingIndicatorTarget.textContent = `${others[0].name} and others are typing…`
      }
    }
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }
}
