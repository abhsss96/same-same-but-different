defmodule TodoBoardWeb.RoomLive do
  use TodoBoardWeb, :live_view

  alias TodoBoard.Todos
  alias TodoBoardWeb.Presence

  # ---------------------------------------------------------------------------
  # Lifecycle
  # ---------------------------------------------------------------------------

  @impl true
  def mount(%{"room_id" => room_id}, session, socket) do
    user = %{
      id: session["user_id"],
      name: session["user_name"],
      color: session["user_color"]
    }

    if connected?(socket) do
      # Single subscription covers both Presence diffs and todo broadcasts.
      # LiveView gets for free: one socket, one PubSub topic, no extra boilerplate.
      # Rails equivalent requires a separate Action Cable channel subscription.
      TodoBoardWeb.Endpoint.subscribe(room_topic(room_id))

      {:ok, _} =
        Presence.track(self(), room_topic(room_id), user.id, %{
          name: user.name,
          color: user.color,
          typing: false,
          joined_at: System.system_time(:second)
        })
    end

    {:ok,
     socket
     |> assign(:room_id, room_id)
     |> assign(:user, user)
     |> assign(:todos, Todos.list_todos(room_id))
     |> assign(:presences, list_presences(room_id))
     |> assign(:new_todo, "")
     |> assign(:editing_id, nil)
     |> assign(:typing_timer, nil)
     |> assign(:page_title, "Room · #{room_id}")}
  end

  # ---------------------------------------------------------------------------
  # Presence diffs — same topic carries both presence and todo events.
  # Phoenix.Presence uses CRDT so concurrent updates are conflict-free.
  # ---------------------------------------------------------------------------

  @impl true
  def handle_info(%Phoenix.Socket.Broadcast{event: "presence_diff"}, socket) do
    {:noreply, assign(socket, :presences, list_presences(socket.assigns.room_id))}
  end

  # ---------------------------------------------------------------------------
  # Todo broadcasts from other clients
  # ---------------------------------------------------------------------------

  def handle_info(
        %Phoenix.Socket.Broadcast{event: "todo_created", payload: %{todo: todo, from_socket: from}},
        socket
      ) do
    # Skip our own broadcast — we already added it optimistically in handle_event.
    if from == socket.id do
      {:noreply, socket}
    else
      {:noreply, update(socket, :todos, &(&1 ++ [todo]))}
    end
  end

  def handle_info(
        %Phoenix.Socket.Broadcast{event: "todo_updated", payload: %{todo: updated}},
        socket
      ) do
    {:noreply, replace_todo(socket, updated)}
  end

  def handle_info(
        %Phoenix.Socket.Broadcast{event: "todo_deleted", payload: %{id: id}},
        socket
      ) do
    {:noreply, update(socket, :todos, &Enum.reject(&1, fn t -> t.id == id end))}
  end

  # Auto-clear typing indicator after 2 s of inactivity
  def handle_info(:clear_typing, socket) do
    Presence.update(self(), room_topic(socket.assigns.room_id), socket.assigns.user.id, fn m ->
      %{m | typing: false}
    end)

    {:noreply, assign(socket, :typing_timer, nil)}
  end

  # ---------------------------------------------------------------------------
  # User events
  # ---------------------------------------------------------------------------

  @impl true
  def handle_event("add_todo", %{"content" => content}, socket)
      when byte_size(content) > 0 do
    %{room_id: room_id} = socket.assigns

    case Todos.create_todo(%{room_id: room_id, content: content, completed: false}) do
      {:ok, todo} ->
        clear_typing(socket)

        TodoBoardWeb.Endpoint.broadcast(room_topic(room_id), "todo_created", %{
          todo: todo,
          from_socket: socket.id
        })

        {:noreply,
         socket
         |> update(:todos, &(&1 ++ [todo]))
         |> assign(:new_todo, "")}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, "Could not save todo")}
    end
  end

  def handle_event("add_todo", _, socket), do: {:noreply, socket}

  def handle_event("toggle_todo", %{"id" => id}, socket) do
    todo = Todos.get_todo!(id)

    case Todos.update_todo(todo, %{completed: !todo.completed}) do
      {:ok, updated} ->
        TodoBoardWeb.Endpoint.broadcast(
          room_topic(socket.assigns.room_id),
          "todo_updated",
          %{todo: updated}
        )

        {:noreply, replace_todo(socket, updated)}

      {:error, _} ->
        {:noreply, socket}
    end
  end

  def handle_event("delete_todo", %{"id" => id}, socket) do
    todo = Todos.get_todo!(id)

    case Todos.delete_todo(todo) do
      {:ok, _} ->
        TodoBoardWeb.Endpoint.broadcast(room_topic(socket.assigns.room_id), "todo_deleted", %{
          id: id
        })

        {:noreply, update(socket, :todos, &Enum.reject(&1, fn t -> t.id == id end))}

      {:error, _} ->
        {:noreply, socket}
    end
  end

  def handle_event("start_edit", %{"id" => id}, socket) do
    {:noreply, assign(socket, :editing_id, id)}
  end

  def handle_event("cancel_edit", _, socket) do
    {:noreply, assign(socket, :editing_id, nil)}
  end

  def handle_event("save_edit", %{"todo_id" => id, "content" => content}, socket)
      when byte_size(content) > 0 do
    todo = Todos.get_todo!(id)

    case Todos.update_todo(todo, %{content: content}) do
      {:ok, updated} ->
        TodoBoardWeb.Endpoint.broadcast(room_topic(socket.assigns.room_id), "todo_updated", %{
          todo: updated
        })

        {:noreply,
         socket
         |> replace_todo(updated)
         |> assign(:editing_id, nil)}

      {:error, _} ->
        {:noreply, socket}
    end
  end

  def handle_event("save_edit", _, socket), do: {:noreply, assign(socket, :editing_id, nil)}

  # Typing: update Presence metadata so all clients see the indicator.
  # In Rails, this requires an explicit Action Cable channel message +
  # manual state tracking — see rails_app/app/channels/room_channel.rb.
  def handle_event("typing", %{"value" => value}, socket) do
    %{room_id: room_id, user: user, typing_timer: old_timer} = socket.assigns
    typing = String.length(value) > 0

    if old_timer, do: Process.cancel_timer(old_timer)

    Presence.update(self(), room_topic(room_id), user.id, fn m -> %{m | typing: typing} end)

    new_timer = if typing, do: Process.send_after(self(), :clear_typing, 2_000)

    {:noreply, assign(socket, new_todo: value, typing_timer: new_timer)}
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp room_topic(room_id), do: "room:#{room_id}"

  defp replace_todo(socket, updated) do
    update(socket, :todos, fn todos ->
      Enum.map(todos, fn t -> if t.id == updated.id, do: updated, else: t end)
    end)
  end

  defp list_presences(room_id) do
    Presence.list(room_topic(room_id))
    |> Enum.map(fn {uid, %{metas: [meta | _]}} -> Map.put(meta, :id, uid) end)
  end

  defp clear_typing(socket) do
    %{room_id: room_id, user: user, typing_timer: timer} = socket.assigns
    if timer, do: Process.cancel_timer(timer)

    Presence.update(self(), room_topic(room_id), user.id, fn m -> %{m | typing: false} end)
  end

  # Template helpers
  defp initials(name) do
    name
    |> String.split(" ")
    |> Enum.map(&String.first/1)
    |> Enum.join()
    |> String.upcase()
  end

  defp typing_users(presences, current_user_id) do
    presences
    |> Enum.filter(&(&1.typing && &1.id != current_user_id))
    |> Enum.map(& &1.name)
  end

  defp typing_text([]), do: ""
  defp typing_text([name]), do: "#{name} is typing…"
  defp typing_text([a, b]), do: "#{a} and #{b} are typing…"
  defp typing_text([a | _]), do: "#{a} and others are typing…"
end
