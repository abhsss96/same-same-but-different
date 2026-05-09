defmodule TodoBoard.Repo.Migrations.CreateTodos do
  use Ecto.Migration

  def change do
    create table(:todos, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :room_id, :string, null: false
      add :content, :string, null: false
      add :completed, :boolean, default: false, null: false
      add :position, :integer, default: 0, null: false

      timestamps()
    end

    create index(:todos, [:room_id])
    create index(:todos, [:room_id, :inserted_at])
  end
end
