// todo_controller.js
// Handles per-item interactions: toggle completion, inline edit, delete.
// Uses fetch() to call the Rails REST endpoints; responses are Turbo Streams
// that replace this element in the DOM.
//
// DIVERGENCE NOTE: In Phoenix, all of this is server-side in RoomLive.handle_event/3
// (toggle_todo, start_edit, save_edit, delete_todo). There is no client JS needed.
// Here we need a Stimulus controller per todo item to wire up each action.

import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["label", "editForm", "editInput", "actions"]
  static values  = { todoId: String, roomId: String }

  toggle() {
    const completed = !this.element.classList.contains("opacity-60")
    this.patch({ todo: { completed } })
  }

  startEdit() {
    this.labelTarget.classList.add("hidden")
    this.actionsTarget?.classList.add("hidden")
    this.editFormTarget.classList.remove("hidden")
    this.editInputTarget.focus()
    this.editInputTarget.select()
  }

  cancelEdit() {
    this.editFormTarget.classList.add("hidden")
    this.labelTarget.classList.remove("hidden")
    this.actionsTarget?.classList.remove("hidden")
  }

  cancelEditOnEscape(event) {
    if (event.key === "Escape") this.cancelEdit()
  }

  saveEdit(event) {
    event.preventDefault()
    const content = this.editInputTarget.value.trim()
    if (!content) { this.cancelEdit(); return }
    this.patch({ todo: { content } })
    this.cancelEdit()
  }

  destroy() {
    if (!confirm("Delete this todo?")) return
    this.delete()
  }

  // ── Private ──────────────────────────────────────────────────────────────

  patch(body) {
    fetch(`/room/${this.roomIdValue}/todos/${this.todoIdValue}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify(body)
    })
  }

  delete() {
    fetch(`/room/${this.roomIdValue}/todos/${this.todoIdValue}`, {
      method: "DELETE",
      headers: this.headers()
    })
  }

  headers() {
    return {
      "Content-Type": "application/json",
      "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]').content,
      "Accept": "text/vnd.turbo-stream.html"
    }
  }
}
