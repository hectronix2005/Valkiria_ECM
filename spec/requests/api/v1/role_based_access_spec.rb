# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Role-Based Access Control" do
  # Setup roles
  let!(:admin_role) { create(:role, :admin) }
  let!(:legal_role) { create(:role, :legal) }
  let!(:hr_role) { create(:role, :hr) }
  let!(:employee_role) { create(:role, :employee) }
  let!(:viewer_role) { create(:role, :viewer) }

  # Setup permissions
  let!(:users_read) { create(:permission, :users_read) }
  let!(:users_manage) { create(:permission, :users_manage) }
  let!(:documents_read) { create(:permission, :documents_read) }
  let!(:documents_create) { create(:permission, :documents_create) }
  let!(:documents_update) { create(:permission, :documents_update) }
  let!(:settings_read) { create(:permission, :settings_read) }
  let!(:settings_manage) { create(:permission, :settings_manage) }

  before do
    # Assign permissions to roles
    legal_role.permissions << [documents_read, documents_create, documents_update]
    hr_role.permissions << [documents_read, documents_create, documents_update, users_read]
    employee_role.permissions << [documents_read, documents_create, documents_update]
    viewer_role.permissions << [documents_read]
  end

  describe "GET /api/v1/users (admin only)" do
    let(:admin_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << admin_role
      end
    end
    let(:hr_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << hr_role
      end
    end
    let(:legal_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << legal_role
      end
    end
    let(:employee_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << employee_role
      end
    end
    let(:viewer_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << viewer_role
      end
    end

    it "allows admin to list users" do
      get "/api/v1/users", headers: auth_headers(admin_user)

      expect(response).to have_http_status(:ok)
      expect(json_response[:data]).to be_an(Array)
    end

    it "allows HR (with users.read permission) to list users" do
      get "/api/v1/users", headers: auth_headers(hr_user)

      expect(response).to have_http_status(:ok)
    end

    it "denies legal (without users.read permission) access to users" do
      get "/api/v1/users", headers: auth_headers(legal_user)

      expect(response).to have_http_status(:forbidden)
    end

    it "denies employee access to users" do
      get "/api/v1/users", headers: auth_headers(employee_user)

      expect(response).to have_http_status(:forbidden)
    end

    it "denies viewer access to users" do
      get "/api/v1/users", headers: auth_headers(viewer_user)

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET /api/v1/content/documents (employee+)" do
    let(:admin_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << admin_role
      end
    end
    let(:legal_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << legal_role
      end
    end
    let(:hr_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << hr_role
      end
    end
    let(:employee_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << employee_role
      end
    end
    let(:viewer_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << viewer_role
      end
    end

    it "allows admin to list documents" do
      get "/api/v1/content/documents", headers: auth_headers(admin_user)

      expect(response).to have_http_status(:ok)
    end

    it "allows legal to list documents" do
      get "/api/v1/content/documents", headers: auth_headers(legal_user)

      expect(response).to have_http_status(:ok)
    end

    it "allows HR to list documents" do
      get "/api/v1/content/documents", headers: auth_headers(hr_user)

      expect(response).to have_http_status(:ok)
    end

    it "allows employee to list documents" do
      get "/api/v1/content/documents", headers: auth_headers(employee_user)

      expect(response).to have_http_status(:ok)
    end

    it "allows viewer to list documents (read-only role)" do
      get "/api/v1/content/documents", headers: auth_headers(viewer_user)

      expect(response).to have_http_status(:ok)
    end
  end

  describe "POST /api/v1/content/documents (employee+, excludes viewer)" do
    let(:admin_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << admin_role
      end
    end
    let(:employee_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << employee_role
      end
    end
    let(:viewer_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << viewer_role
      end
    end

    let(:document_params) { { document: { title: "New Document" } }.to_json }

    it "allows admin to create documents" do
      post "/api/v1/content/documents", params: document_params, headers: auth_headers(admin_user)

      expect(response).to have_http_status(:created)
    end

    it "allows employee to create documents" do
      post "/api/v1/content/documents", params: document_params, headers: auth_headers(employee_user)

      expect(response).to have_http_status(:created)
    end

    it "denies viewer from creating documents" do
      post "/api/v1/content/documents", params: document_params, headers: auth_headers(viewer_user)

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET /api/v1/admin/settings (admin only)" do
    let(:admin_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << admin_role
      end
    end
    let(:legal_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << legal_role
      end
    end
    let(:hr_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << hr_role
      end
    end
    let(:employee_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << employee_role
      end
    end
    let(:viewer_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << viewer_role
      end
    end

    it "allows admin to view settings" do
      get "/api/v1/admin/settings", headers: auth_headers(admin_user)

      expect(response).to have_http_status(:ok)
      expect(json_response[:data]).to include(:app_name, :environment, :version)
    end

    it "denies legal access to admin settings" do
      get "/api/v1/admin/settings", headers: auth_headers(legal_user)

      expect(response).to have_http_status(:forbidden)
    end

    it "denies HR access to admin settings" do
      get "/api/v1/admin/settings", headers: auth_headers(hr_user)

      expect(response).to have_http_status(:forbidden)
    end

    it "denies employee access to admin settings" do
      get "/api/v1/admin/settings", headers: auth_headers(employee_user)

      expect(response).to have_http_status(:forbidden)
    end

    it "denies viewer access to admin settings" do
      get "/api/v1/admin/settings", headers: auth_headers(viewer_user)

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "role hierarchy verification" do
    let(:admin_user) do
      create(:user).tap do |u|
        u.roles.clear
        u.roles << admin_role
      end
    end

    it "admin has implicit access to all resources" do
      expect(admin_user.admin?).to be true
      expect(admin_user.permission_names).to eq(["*"])
    end

    it "admin can access users endpoint" do
      get "/api/v1/users", headers: auth_headers(admin_user)
      expect(response).to have_http_status(:ok)
    end

    it "admin can access documents endpoint" do
      get "/api/v1/content/documents", headers: auth_headers(admin_user)
      expect(response).to have_http_status(:ok)
    end

    it "admin can access admin settings" do
      get "/api/v1/admin/settings", headers: auth_headers(admin_user)
      expect(response).to have_http_status(:ok)
    end
  end

  describe "multiple roles" do
    let!(:multi_role_user) do
      user = create(:user)
      user.roles << employee_role
      user.roles << hr_role
      user
    end

    it "grants combined permissions from all roles" do
      # Employee has documents.* but not users.read
      # HR has users.read
      # Combined should have both

      get "/api/v1/content/documents", headers: auth_headers(multi_role_user)
      expect(response).to have_http_status(:ok)

      get "/api/v1/users", headers: auth_headers(multi_role_user)
      expect(response).to have_http_status(:ok)
    end
  end
end
