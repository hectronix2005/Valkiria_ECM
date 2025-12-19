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
            # Clear must_change_password flag if set
            current_user.password_changed! if current_user.must_change_password?
            render json: { message: "Contraseña actualizada exitosamente" }, status: :ok
          else
            render json: { error: current_user.errors.full_messages.join(", ") }, status: :unprocessable_content
          end
        end

        # POST /api/v1/auth/password/force_change
        # For users who must change password on first login
        def force_change
          unless current_user.must_change_password?
            return render json: { error: "No se requiere cambio de contraseña" }, status: :unprocessable_content
          end

          if force_change_params[:new_password] != force_change_params[:new_password_confirmation]
            return render json: { error: "Las contraseñas no coinciden" }, status: :unprocessable_content
          end

          if force_change_params[:new_password].length < 6
            return render json: { error: "La contraseña debe tener al menos 6 caracteres" }, status: :unprocessable_content
          end

          if current_user.update(password: force_change_params[:new_password])
            current_user.password_changed!

            # Generate new token after password change
            token = Warden::JWTAuth::UserEncoder.new.call(current_user, :identity_user, nil).first

            render json: {
              message: "Contraseña actualizada exitosamente",
              token: token,
              data: user_response(current_user)
            }, status: :ok
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

        def force_change_params
          params.permit(:new_password, :new_password_confirmation)
        end

        def user_response(user)
          employee = ::Hr::Employee.for_user(user)
          {
            id: user.id.to_s,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            full_name: user.full_name,
            roles: user.role_names,
            must_change_password: user.must_change_password || false
          }
        end
      end
    end
  end
end
