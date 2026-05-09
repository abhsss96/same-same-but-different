defmodule TodoBoard.Todos.Todo do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "todos" do
    field :room_id, :string
    field :content, :string
    field :completed, :boolean, default: false
    field :position, :integer, default: 0

    timestamps()
  end

  def changeset(todo, attrs) do
    todo
    |> cast(attrs, [:room_id, :content, :completed, :position])
    |> validate_required([:room_id, :content])
    |> validate_length(:content, min: 1, max: 500)
  end
end
