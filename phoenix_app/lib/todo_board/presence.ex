defmodule TodoBoardWeb.Presence do
  @moduledoc """
  Phoenix.Presence gives distributed, conflict-free presence tracking via CRDT
  with zero extra infrastructure. The equivalent in Rails requires a custom
  server-side store (see rails_app/lib/room_presence.rb) plus explicit
  subscribe/unsubscribe boilerplate in the Action Cable channel.
  """
  use Phoenix.Presence,
    otp_app: :todo_board,
    pubsub_server: TodoBoard.PubSub
end
