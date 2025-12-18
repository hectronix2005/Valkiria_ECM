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
      end

      # Protected resources
      resources :users, only: [:index, :show]

      namespace :admin do
        resource :settings, only: [:show, :update]
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
        resources :employees, only: [:index, :show, :update] do
          member do
            get :subordinates
            get :vacation_balance
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
