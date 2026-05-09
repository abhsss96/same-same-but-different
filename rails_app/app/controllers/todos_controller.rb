# TodosController — handles CRUD over HTTP (POST/PATCH/DELETE).
#
# DIVERGENCE NOTE (HTTP vs WebSocket for CRUD):
#   Rails Hotwire sends todo mutations over HTTP (standard form POST).
#   The controller broadcasts a Turbo Stream to all other clients via
#   Turbo::StreamsChannel after each successful write.
#
#   Phoenix LiveView sends all events — including CRUD — over the existing
#   WebSocket via phx-submit / phx-click. No separate HTTP endpoints needed.
class TodosController < ApplicationController
  before_action :set_room_id
  before_action :set_todo, only: [:update, :destroy]

  def create
    @todo = Todo.new(todo_params.merge(room_id: @room_id))

    if @todo.save
      # Broadcast to all OTHER clients subscribed to this room's Turbo stream.
      Turbo::StreamsChannel.broadcast_append_to(
        "room_todos:#{@room_id}",
        target: "todo-list",
        partial: "todos/todo",
        locals: { todo: @todo, current_user: current_user }
      )
      render turbo_stream: turbo_stream.prepend(
        "todo-list",
        partial: "todos/todo",
        locals: { todo: @todo, current_user: current_user }
      )
    else
      head :unprocessable_entity
    end
  end

  def update
    if @todo.update(todo_params)
      Turbo::StreamsChannel.broadcast_replace_to(
        "room_todos:#{@room_id}",
        target: "todo-#{@todo.id}",
        partial: "todos/todo",
        locals: { todo: @todo, current_user: current_user }
      )
      render turbo_stream: turbo_stream.replace(
        "todo-#{@todo.id}",
        partial: "todos/todo",
        locals: { todo: @todo, current_user: current_user }
      )
    else
      head :unprocessable_entity
    end
  end

  def destroy
    @todo.destroy
    Turbo::StreamsChannel.broadcast_remove_to(
      "room_todos:#{@room_id}",
      target: "todo-#{@todo.id}"
    )
    render turbo_stream: turbo_stream.remove("todo-#{@todo.id}")
  end

  private

  def set_room_id
    @room_id = params[:room_id]
  end

  def set_todo
    @todo = Todo.find(params[:id])
  end

  def todo_params
    params.require(:todo).permit(:content, :completed)
  end
end
