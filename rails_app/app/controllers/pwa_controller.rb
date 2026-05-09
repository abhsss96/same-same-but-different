class PwaController < ApplicationController
  protect_from_forgery except: :service_worker

  def service_worker
    render "pwa/service-worker", layout: false, content_type: "text/javascript"
  end

  def manifest
    render "pwa/manifest", layout: false, content_type: "application/json"
  end
end
