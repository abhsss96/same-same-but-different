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
      user_id    = cookies.signed[:user_id]
      user_name  = cookies.signed[:user_name]
      user_color = cookies.signed[:user_color]

      return reject_unauthorized_connection unless user_id

      { id: user_id, name: user_name, color: user_color }
    end
  end
end
