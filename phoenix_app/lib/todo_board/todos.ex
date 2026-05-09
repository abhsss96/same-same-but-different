defmodule TodoBoard.Todos do
  import Ecto.Query, warn: false
  alias TodoBoard.Repo
  alias TodoBoard.Todos.Todo

  def list_todos(room_id) do
    Todo
    |> where([t], t.room_id == ^room_id)
    |> order_by([t], asc: t.inserted_at)
    |> Repo.all()
  end

  def get_todo!(id), do: Repo.get!(Todo, id)

  def create_todo(attrs \\ %{}) do
    %Todo{}
    |> Todo.changeset(attrs)
    |> Repo.insert()
  end

  def update_todo(%Todo{} = todo, attrs) do
    todo
    |> Todo.changeset(attrs)
    |> Repo.update()
  end

  def delete_todo(%Todo{} = todo), do: Repo.delete(todo)
end
