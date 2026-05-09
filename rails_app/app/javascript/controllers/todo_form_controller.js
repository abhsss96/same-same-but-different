// todo_form_controller.js
// Wraps the new-todo form: clears the input after submission.
//
// DIVERGENCE NOTE: Phoenix LiveView clears the input server-side by setting
// the `new_todo` assign to "" in handle_event. Rails/Turbo doesn't reset the
// form automatically after a fetch-based Turbo Stream response, so we do it here.

import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input"]

  submit(event) {
    event.preventDefault()
    const content = this.inputTarget.value.trim()
    if (!content) return

    fetch(this.element.action, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]').content,
        "Accept": "text/vnd.turbo-stream.html"
      },
      body: JSON.stringify({ todo: { content } })
    }).then(res => {
      if (res.ok) {
        res.text().then(html => {
          Turbo.renderStreamMessage(html)
          this.inputTarget.value = ""
          this.inputTarget.focus()
        })
      }
    })
  }
}
