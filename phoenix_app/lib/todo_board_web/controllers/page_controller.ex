defmodule TodoBoardWeb.PageController do
  use TodoBoardWeb, :controller

  def home(conn, _params) do
    redirect(conn, to: "/room/lobby")
  end
end
