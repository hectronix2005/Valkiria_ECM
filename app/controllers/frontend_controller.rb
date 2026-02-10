# frozen_string_literal: true

class FrontendController < ActionController::Base
  def index
    # Prevent browsers from caching HTML so they always get the latest asset references
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    render file: Rails.public_path.join("index.html"), layout: false
  end
end
