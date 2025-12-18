# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Access Denied" do
  describe "unauthenticated access" do
    it "returns 401 for /api/v1/users" do
      get "/api/v1/users", headers: json_headers

      expect(response).to have_http_status(:unauthorized)
      expect(json_response[:error]).to eq("Unauthorized")
    end

    it "returns 401 for /api/v1/content/documents" do
      get "/api/v1/content/documents", headers: json_headers

      expect(response).to have_http_status(:unauthorized)
      expect(json_response[:error]).to eq("Unauthorized")
    end

    it "returns 401 for /api/v1/admin/settings" do
      get "/api/v1/admin/settings", headers: json_headers

      expect(response).to have_http_status(:unauthorized)
      expect(json_response[:error]).to eq("Unauthorized")
    end
  end

  describe "unauthorized access (wrong role)" do
    let!(:viewer_role) { create(:role, :viewer) }
    let!(:viewer_user) { create(:user).tap { |u| u.roles << viewer_role } }

    before do
      # Give viewer only documents.read permission
      permission = create(:permission, :documents_read)
      viewer_role.permissions << permission
    end

    it "returns 403 for /api/v1/users (requires users.read permission)" do
      get "/api/v1/users", headers: auth_headers(viewer_user)

      expect(response).to have_http_status(:forbidden)
      expect(json_response[:error]).to eq("You are not authorized to perform this action")
    end

    it "returns 403 for /api/v1/admin/settings (requires admin)" do
      get "/api/v1/admin/settings", headers: auth_headers(viewer_user)

      expect(response).to have_http_status(:forbidden)
      expect(json_response[:error]).to eq("You are not authorized to perform this action")
    end

    it "allows access to /api/v1/content/documents (viewer has documents.read)" do
      get "/api/v1/content/documents", headers: auth_headers(viewer_user)

      expect(response).to have_http_status(:ok)
    end
  end

  describe "employee access restrictions" do
    let!(:employee_role) { create(:role, :employee) }
    let!(:employee_user) { create(:user).tap { |u| u.roles << employee_role } }

    before do
      # Give employee documents.read and documents.create permissions
      [:documents_read, :documents_create, :documents_update].each do |perm|
        permission = create(:permission, perm)
        employee_role.permissions << permission
      end
    end

    it "allows employee to read documents" do
      get "/api/v1/content/documents", headers: auth_headers(employee_user)

      expect(response).to have_http_status(:ok)
    end

    it "allows employee to create documents" do
      post "/api/v1/content/documents",
           params: { document: { title: "Test Document" } }.to_json,
           headers: auth_headers(employee_user)

      expect(response).to have_http_status(:created)
    end

    it "denies employee access to users list" do
      get "/api/v1/users", headers: auth_headers(employee_user)

      expect(response).to have_http_status(:forbidden)
    end

    it "denies employee access to admin settings" do
      get "/api/v1/admin/settings", headers: auth_headers(employee_user)

      expect(response).to have_http_status(:forbidden)
    end
  end
end
