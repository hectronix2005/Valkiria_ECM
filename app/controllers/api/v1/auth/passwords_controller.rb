# frozen_string_literal: true

module Api
  module V1
    module Auth
      class PasswordsController < ApplicationController
        before_action :authenticate_user!

        # PATCH /api/v1/auth/password
        def update
          unless current_user.valid_password?(password_params[:current_password])
            return render json: { error: "La contraseña actual es incorrecta" }, status: :unprocessable_content
          end

          if password_params[:password] != password_params[:password_confirmation]
            return render json: { error: "Las contraseñas no coinciden" }, status: :unprocessable_content
          end

          if current_user.update(password: password_params[:password])
            render json: { message: "Contraseña actualizada exitosamente" }, status: :ok
          else
            render json: { error: current_user.errors.full_messages.join(", ") }, status: :unprocessable_content
          end
        end

        private

        def authenticate_user!
          return if current_user

          render json: {
            error: "Unauthorized",
            message: "You need to sign in or sign up before continuing."
          }, status: :unauthorized
        end

        def current_user
          @current_user ||= warden.authenticate(scope: :identity_user)
        end

        def password_params
          params.permit(:current_password, :password, :password_confirmation)
        end
      end
    end
  end
end
