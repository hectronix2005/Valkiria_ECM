# frozen_string_literal: true

class FrontendController < ActionController::Base
  def index
    render file: Rails.public_path.join("index.html"), layout: false
  end
end
