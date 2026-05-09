defmodule TodoBoardWeb.Router do
  use TodoBoardWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {TodoBoardWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
    # Assigns a random user identity on first visit so LiveView mount/3 can
    # read it from the session. Rails equivalent: before_action in ApplicationController.
    plug TodoBoardWeb.Plugs.UserSession
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", TodoBoardWeb do
    pipe_through :browser

    get "/", PageController, :home
    live "/room/:room_id", RoomLive, :show
    live "/stress", StressLive, :show
  end

  scope "/", TodoBoardWeb do
    pipe_through :api
    post "/room/:room_id/todos", TodosController, :create
  end

  # Enable LiveDashboard in development
  if Application.compile_env(:todo_board, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: TodoBoardWeb.Telemetry
    end
  end
end
