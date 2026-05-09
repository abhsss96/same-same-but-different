defmodule TodoBoard.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      TodoBoardWeb.Telemetry,
      TodoBoard.Repo,
      {DNSCluster, query: Application.get_env(:todo_board, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: TodoBoard.PubSub},
      # Phoenix.Presence: distributed presence tracking via CRDT.
      # No Redis or external store needed. Rails equivalent requires a custom
      # in-memory/Redis store (see rails_app/lib/room_presence.rb).
      TodoBoardWeb.Presence,
      TodoBoardWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: TodoBoard.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    TodoBoardWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
