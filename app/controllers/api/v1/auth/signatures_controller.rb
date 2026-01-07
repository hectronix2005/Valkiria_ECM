# frozen_string_literal: true

module Api
  module V1
    module Auth
      class SignaturesController < BaseController
        before_action :set_signature, only: [:show, :update, :destroy, :set_default, :toggle_active]

        # GET /api/v1/auth/signatures
        def index
          @signatures = current_user.signatures.order(created_at: :desc)

          render json: {
            data: @signatures.map { |s| signature_json(s) },
            meta: {
              total: @signatures.count,
              has_default: current_user.signatures.default_signature.exists?
            }
          }
        end

        # GET /api/v1/auth/signatures/:id
        def show
          render json: { data: signature_json(@signature, include_image: true) }
        end

        # POST /api/v1/auth/signatures
        def create
          @signature = current_user.signatures.build(signature_params)

          # Set as default if it's the first signature
          @signature.is_default = true if current_user.signatures.empty?

          if @signature.save
            render json: {
              data: signature_json(@signature, include_image: true),
              message: "Firma creada exitosamente"
            }, status: :created
          else
            render json: {
              error: "Error al crear la firma",
              errors: @signature.errors.full_messages
            }, status: :unprocessable_content
          end
        end

        # PATCH /api/v1/auth/signatures/:id
        def update
          if @signature.update(signature_params)
            render json: {
              data: signature_json(@signature, include_image: true),
              message: "Firma actualizada exitosamente"
            }
          else
            render json: {
              error: "Error al actualizar la firma",
              errors: @signature.errors.full_messages
            }, status: :unprocessable_content
          end
        end

        # DELETE /api/v1/auth/signatures/:id
        def destroy
          if @signature.in_use?
            return render json: {
              error: "Esta firma está siendo utilizada en documentos",
              in_use: true,
              documents_count: @signature.documents_using_count,
              message: "No se puede eliminar. Use la opción de desactivar en su lugar."
            }, status: :unprocessable_content
          end

          @signature.destroy

          render json: {
            message: "Firma eliminada exitosamente"
          }
        end

        # POST /api/v1/auth/signatures/:id/toggle_active
        def toggle_active
          if @signature.active?
            @signature.disable!
            message = "Firma desactivada exitosamente"
          else
            @signature.enable!
            message = "Firma activada exitosamente"
          end

          render json: {
            data: signature_json(@signature, include_image: true),
            message: message
          }
        end

        # POST /api/v1/auth/signatures/:id/set_default
        def set_default
          @signature.set_as_default!

          render json: {
            data: signature_json(@signature),
            message: "Firma establecida como predeterminada"
          }
        end

        # GET /api/v1/auth/signatures/fonts
        def fonts
          render json: {
            data: Identity::UserSignature::SIGNATURE_FONTS.map do |font|
              {
                name: font,
                css_family: font.gsub(" ", "+"),
                google_font_url: "https://fonts.googleapis.com/css2?family=#{font.gsub(' ', '+')}&display=swap"
              }
            end
          }
        end

        private

        def set_signature
          @signature = current_user.signatures.find_by(uuid: params[:id])

          return if @signature

          render json: { error: "Firma no encontrada" }, status: :not_found
        end

        def signature_params
          params.require(:signature).permit(
            :name,
            :signature_type,
            :image_data,
            :styled_text,
            :font_family,
            :font_color,
            :font_size,
            :is_default
          )
        end

        def signature_json(signature, include_image: false)
          json = {
            id: signature.uuid,
            name: signature.name,
            signature_type: signature.signature_type,
            is_default: signature.is_default,
            active: signature.active?,
            in_use: signature.in_use?,
            documents_count: signature.documents_using_count,
            created_at: signature.created_at.iso8601
          }

          if signature.styled?
            json[:styled_text] = signature.styled_text
            json[:font_family] = signature.font_family
            json[:font_color] = signature.font_color
            json[:font_size] = signature.font_size
          end

          if include_image
            json[:image_data] = signature.to_image_data
          end

          json
        end
      end
    end
  end
end
