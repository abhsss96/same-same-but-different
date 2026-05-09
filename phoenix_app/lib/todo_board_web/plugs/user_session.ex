defmodule TodoBoardWeb.Plugs.UserSession do
  @moduledoc """
  Assigns a random identity (id, name, color) to the session on first visit.
  LiveView reads these via the session map in mount/3.
  Rails equivalent: ApplicationController before_action in
  rails_app/app/controllers/application_controller.rb.
  """
  import Plug.Conn

  @colors ~w(#ef4444 #f97316 #eab308 #22c55e #06b6d4 #6366f1 #ec4899 #14b8a6)
  @adjectives ~w(Swift Bright Calm Bold Kind Keen Wise Fair Sharp Brave Lively Gentle)
  @nouns ~w(Panda Falcon River Storm Pixel Nova Comet Ridge Spark Blaze Ember Creek)

  def init(opts), do: opts

  def call(conn, _opts) do
    if get_session(conn, "user_id") do
      conn
    else
      conn
      |> put_session("user_id", :crypto.strong_rand_bytes(6) |> Base.encode16(case: :lower))
      |> put_session("user_name", "#{Enum.random(@adjectives)} #{Enum.random(@nouns)}")
      |> put_session("user_color", Enum.random(@colors))
    end
  end
end
