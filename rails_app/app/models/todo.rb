class Todo < ApplicationRecord
  validates :room_id, presence: true
  validates :content, presence: true, length: { minimum: 1, maximum: 500 }

  scope :for_room, ->(room_id) { where(room_id: room_id).order(created_at: :asc) }
end
