class ApplicationController < ActionController::Base
  # DIVERGENCE NOTE: Phoenix uses a Plug in the browser pipeline (user_session.ex).
  # Rails uses a before_action in ApplicationController.
  # Both achieve the same: a random identity persisted in the session/cookie.
  before_action :ensure_user_identity

  allow_browser versions: :modern

  private

  COLORS     = %w[#ef4444 #f97316 #eab308 #22c55e #06b6d4 #6366f1 #ec4899 #14b8a6].freeze
  ADJECTIVES = %w[Swift Bright Calm Bold Kind Keen Wise Fair Sharp Brave Lively Gentle].freeze
  NOUNS      = %w[Panda Falcon River Storm Pixel Nova Comet Ridge Spark Blaze Ember Creek].freeze

  def ensure_user_identity
    return if cookies.signed[:user_id].present?

    cookies.signed[:user_id]    = { value: SecureRandom.hex(6), expires: 1.year.from_now }
    cookies.signed[:user_name]  = { value: "#{ADJECTIVES.sample} #{NOUNS.sample}", expires: 1.year.from_now }
    cookies.signed[:user_color] = { value: COLORS.sample, expires: 1.year.from_now }
  end

  def current_user
    {
      id:    cookies.signed[:user_id],
      name:  cookies.signed[:user_name],
      color: cookies.signed[:user_color]
    }
  end
  helper_method :current_user
end
