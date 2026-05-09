# RoomChannel — handles presence and typing events for a single room.
#
# DIVERGENCE NOTE (two channels vs one):
#   Rails Hotwire uses TWO separate mechanisms for real-time:
#     1. Turbo::StreamsChannel — subscribed via `turbo_stream_from` in the view,
#        broadcasts HTML diffs (Turbo Streams) for todo CRUD.
#     2. RoomChannel (this file) — a hand-written Action Cable channel for
#        presence tracking and the typing indicator.
#
#   Phoenix LiveView uses ONE mechanism:
#     - A single LiveView WebSocket + PubSub topic carries presence diffs,
#       todo broadcasts, and typing state. No separate channel boilerplate.
class RoomChannel < ApplicationCable::Channel
  def subscribed
    @room_id = params[:room_id]
    stream_from "room_presence:#{@room_id}"

    RoomPresence.add(@room_id, current_user)
    broadcast_presence
  end

  def unsubscribed
    return unless @room_id

    RoomPresence.remove(@room_id, current_user[:id])
    broadcast_presence
  end

  # Client sends { action: "typing", typing: true|false }
  def typing(data)
    RoomPresence.update_typing(@room_id, current_user[:id], data["typing"])
    broadcast_presence
  end

  private

  def broadcast_presence
    ActionCable.server.broadcast(
      "room_presence:#{@room_id}",
      { type: "presence_update", users: RoomPresence.list(@room_id) }
    )
  end
end
