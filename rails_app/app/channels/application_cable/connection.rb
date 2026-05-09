module ApplicationCable
  # DIVERGENCE NOTE: Phoenix LiveView identifies the user through the session,
  # which is forwarded automatically during the WebSocket upgrade.
  # Rails Action Cable requires an explicit `identified_by` + `connect` method.
  # The user data lives in signed cookies set by ApplicationController.
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_user_from_cookies
    end

    private

    def find_user_from_cookies
      user_id = cookies.signed[:user_id]

      # Allow anonymous WebSocket connections (e.g. benchmarks, health checks).
      # A real app would reject here; for this comparison project we just assign
      # a temporary identity so the connection is established.
      unless user_id
        return { id: SecureRandom.uuid, name: "Anonymous", color: "#999999" }
      end

      {
        id:    user_id,
        name:  cookies.signed[:user_name],
        color: cookies.signed[:user_color]
      }
    end
  end
end
