class CreateTodos < ActiveRecord::Migration[8.0]
  def change
    create_table :todos, id: :uuid do |t|
      t.string :room_id, null: false
      t.string :content, null: false
      t.boolean :completed, default: false, null: false
      t.integer :position, default: 0, null: false

      t.timestamps
    end

    add_index :todos, :room_id
    add_index :todos, [:room_id, :created_at]
  end
end
