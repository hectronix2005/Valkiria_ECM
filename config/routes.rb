# frozen_string_literal: true

Rails.application.routes.draw do
  mount Rswag::Ui::Engine => '/api-docs'
  mount Rswag::Api::Engine => '/api-docs'
  # Devise for Identity::User - skip all default routes, we use custom API routes
  devise_for :identity_users,
             class_name: "Identity::User",
             skip: [:sessions, :registrations, :passwords, :confirmations, :unlocks]

  # Health check endpoints
  get "up" => "rails/health#show", as: :rails_health_check

  # API routes
  namespace :api do
    namespace :v1 do
      get "health", to: "health#show"

      # Authentication
      namespace :auth do
        post "login", to: "sessions#create"
        delete "logout", to: "sessions#destroy"
        get "me", to: "sessions#show"
        patch "profile", to: "profiles#update"
        patch "password", to: "passwords#update"
        post "password/force_change", to: "passwords#force_change"

        # Digital signatures
        resources :signatures, except: [:edit, :new] do
          member do
            post :set_default
          end
          collection do
            get :fonts
          end
        end
      end

      # Documents (generated from templates)
      resources :documents, only: [:index, :show, :destroy] do
        member do
          get :download
        end
      end

      # Folders
      resources :folders do
        member do
          post :add_document, path: "documents"
          delete "documents/:document_id", action: :remove_document, as: :remove_document
        end
      end

      # Protected resources
      resources :users, only: [:index, :show]

      namespace :admin do
        resource :settings, only: [:show, :update]

        # Variable mappings management
        resources :variable_mappings do
          member do
            post :toggle_active
            delete :remove_alias
          end
          collection do
            get :grouped
            get :pending_variables
            get :aliases
            post :seed_system
            post :reorder
            post :merge
            post :create_alias
            post :auto_assign
            post :create_and_assign
          end
        end

        # Signatory types management
        resources :signatory_types do
          member do
            post :toggle_active
          end
          collection do
            post :seed_system
            post :reorder
          end
        end

        # Template management
        resources :templates do
          member do
            post :activate
            post :archive
            post :duplicate
            post :upload
            post :reassign_mappings
            get :download
            get :preview
          end
          collection do
            get :categories
            get :variable_mappings
          end
          resources :signatories, controller: "template_signatories" do
            collection do
              post :reorder
            end
          end
        end
      end

      # Search
      get "search", to: "search#index"

      # HR Module
      namespace :hr do
        # Employee's own requests
        resources :vacations, except: [:destroy] do
          member do
            post :submit
            post :cancel
          end
        end

        resources :certifications, except: [:destroy] do
          member do
            post :cancel
            post :generate_document
            get :download_document
          end
        end

        # For supervisors/HR - pending approvals
        resources :approvals, only: [:index, :show] do
          member do
            post :approve
            post :reject
          end
        end

        # Employee info (read-only for most, editable by HR/Admin)
        resources :employees, only: [:index, :show, :create, :update] do
          member do
            get :subordinates
            get :vacation_balance
            post :create_account
            post :generate_document
          end
        end

        # HR Dashboard stats
        get "dashboard", to: "dashboard#show"
      end

      # DMS Content
      namespace :content do
        resources :folders do
          collection do
            get :root, action: :index, defaults: { root: true }
          end
        end

        resources :documents do
          member do
            post :lock
            post :unlock
          end

          resources :versions, only: [:index, :show, :create] do
            collection do
              get :current
            end
          end
        end
      end
    end
  end
end
