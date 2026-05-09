defmodule TodoBoard.Repo do
  use Ecto.Repo,
    otp_app: :todo_board,
    adapter: Ecto.Adapters.Postgres
end
