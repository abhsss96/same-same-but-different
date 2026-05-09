defmodule TodoBoardWeb.TodosController do
  use TodoBoardWeb, :controller

  alias TodoBoard.Todos

  # HTTP endpoint used by the k6 benchmark.
  # In normal use, todo creation goes over the LiveView WebSocket (handle_event "add_todo").
  def create(conn, %{"room_id" => room_id, "content" => content})
      when byte_size(content) > 0 do
    case Todos.create_todo(%{room_id: room_id, content: content, completed: false}) do
      {:ok, todo} ->
        TodoBoardWeb.Endpoint.broadcast("room:#{room_id}", "todo_created", %{
          todo: todo,
          from_socket: nil
        })

        send_resp(conn, 201, "")

      {:error, _changeset} ->
        send_resp(conn, 422, "")
    end
  end

  def create(conn, _params), do: send_resp(conn, 422, "")
end
