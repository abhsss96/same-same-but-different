Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  get "sw.js"         => "pwa#service_worker", as: :pwa_service_worker
  get "manifest.json" => "pwa#manifest",       as: :pwa_manifest

  root to: redirect("/room/lobby")

  # Room show + nested todos
  get  "room/:room_id",          to: "rooms#show",         as: :room
  post "room/:room_id/todos",    to: "todos#create",       as: :room_todos
  patch  "room/:room_id/todos/:id", to: "todos#update",    as: :room_todo
  delete "room/:room_id/todos/:id", to: "todos#destroy"

  get "stress", to: "rooms#stress", as: :stress
end
