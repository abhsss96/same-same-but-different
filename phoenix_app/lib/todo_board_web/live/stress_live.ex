defmodule TodoBoardWeb.StressLive do
  @moduledoc """
  In-browser stress-test harness.
  Measures broadcast round-trip latency by sending N pings over PubSub and
  timing how long each takes to come back to this process.
  For multi-connection flood testing use the k6 scripts in /bench.
  """
  use TodoBoardWeb, :live_view

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket) do
      TodoBoardWeb.Endpoint.subscribe("stress:#{socket.id}")
    end

    {:ok,
     socket
     |> assign(:log, [])
     |> assign(:running, false)
     |> assign(:n, 200)
     |> assign(:received, 0)
     |> assign(:total_sent, 0)
     |> assign(:latencies, [])
     |> assign(:page_title, "Stress Test")}
  end

  @impl true
  def handle_event("run", %{"n" => n_str}, socket) do
    n = n_str |> String.to_integer() |> max(1) |> min(5_000)
    topic = "stress:#{socket.id}"

    socket =
      socket
      |> assign(:running, true)
      |> assign(:received, 0)
      |> assign(:total_sent, n)
      |> assign(:latencies, [])
      |> assign(:log, [])

    # Broadcast N pings; each one will arrive as a handle_info
    start = System.monotonic_time(:millisecond)

    for i <- 1..n do
      TodoBoardWeb.Endpoint.broadcast(topic, "ping", %{
        seq: i,
        sent_at: System.monotonic_time(:microsecond)
      })
    end

    elapsed = System.monotonic_time(:millisecond) - start

    {:noreply,
     update(socket, :log, &["#{n} pings dispatched in #{elapsed} ms (server-side)" | &1])}
  end

  @impl true
  def handle_info(
        %Phoenix.Socket.Broadcast{event: "ping", payload: %{seq: seq, sent_at: sent_us}},
        socket
      ) do
    rtt_us = System.monotonic_time(:microsecond) - sent_us
    latencies = [rtt_us | socket.assigns.latencies]
    received = socket.assigns.received + 1
    total = socket.assigns.total_sent

    socket =
      socket
      |> assign(:received, received)
      |> assign(:latencies, latencies)

    socket =
      if received == total do
        sorted = Enum.sort(latencies)
        count = length(sorted)

        p50 = Enum.at(sorted, div(count * 50, 100))
        p95 = Enum.at(sorted, div(count * 95, 100))
        p99 = Enum.at(sorted, div(count * 99, 100))
        avg = div(Enum.sum(sorted), count)

        log_entry =
          "#{count} pings — avg #{fmt(avg)} · p50 #{fmt(p50)} · p95 #{fmt(p95)} · p99 #{fmt(p99)}"

        socket
        |> assign(:running, false)
        |> update(:log, &[log_entry | &1])
      else
        socket
      end

    _ = seq
    {:noreply, socket}
  end

  defp fmt(us) when us < 1_000, do: "#{us} µs"
  defp fmt(us), do: "#{Float.round(us / 1_000, 2)} ms"
end
