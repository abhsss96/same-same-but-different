class RoomsController < ApplicationController
  def show
    @room_id = params[:room_id]
    @todos   = Todo.for_room(@room_id)
  end

  def stress
    @room_id = "stress"
  end
end
