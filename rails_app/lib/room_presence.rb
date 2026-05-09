# RoomPresence — in-process presence store.
#
# DIVERGENCE NOTE: Phoenix ships Phoenix.Presence (CRDT-based, distributed,
# zero-config). Rails has no equivalent in core. This naive Mutex+Hash store
# works for a single Puma process (development). In production with multiple
# workers you need a shared store (Redis, Postgres LISTEN/NOTIFY, etc.).
#
# The boilerplate here (subscribe/unsubscribe/broadcast in RoomChannel) is
# entirely absent from the Phoenix side — Presence.track/4 + presence_diff
# events handle it automatically.
module RoomPresence
  @mutex = Mutex.new
  @rooms = {}

  class << self
    def add(room_id, user)
      @mutex.synchronize do
        @rooms[room_id] ||= {}
        @rooms[room_id][user[:id]] = user.merge(joined_at: Time.now.to_i, typing: false)
      end
    end

    def remove(room_id, user_id)
      @mutex.synchronize do
        @rooms[room_id]&.delete(user_id)
        @rooms.delete(room_id) if @rooms[room_id]&.empty?
      end
    end

    def list(room_id)
      @mutex.synchronize { (@rooms[room_id] || {}).values.dup }
    end

    def update_typing(room_id, user_id, typing)
      @mutex.synchronize do
        @rooms[room_id]&.[](user_id)&.merge!(typing: typing)
      end
    end

    def connection_count
      @mutex.synchronize { @rooms.values.sum(&:size) }
    end
  end
end
