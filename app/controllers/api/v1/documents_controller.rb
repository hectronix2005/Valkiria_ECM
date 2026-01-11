# frozen_string_literal: true

module Api
  module V1
    class DocumentsController < BaseController
      before_action :set_document, only: [:show, :download, :destroy, :sign]

      # GET /api/v1/documents
      def index
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 20).to_i
        skip_count = (page - 1) * per_page

        base_scope = policy_scope(::Templates::GeneratedDocument).order(created_at: :desc)

        # Apply filters
        base_scope = apply_document_filters(base_scope)

        total_count = base_scope.count
        documents = base_scope.skip(skip_count).limit(per_page).to_a

        total_pages = (total_count.to_f / per_page).ceil

        render json: {
          data: documents.map { |doc| document_json(doc) },
          meta: {
            current_page: page,
            total_pages: total_pages,
            total_count: total_count,
            per_page: per_page
          }
        }
      end

      # GET /api/v1/documents/:id
      def show
        authorize @document

        render json: {
          data: document_json(@document, detailed: true)
        }
      end

      # GET /api/v1/documents/:id/download
      def download
        authorize @document

        file_content = @document.file_content

        if file_content
          send_data file_content,
                    filename: @document.file_name || "#{@document.name}.pdf",
                    type: "application/pdf",
                    disposition: "attachment"
        else
          render json: { error: "El archivo no está disponible" }, status: :not_found
        end
      end

      # DELETE /api/v1/documents/:id
      def destroy
        authorize @document

        # Delete associated files from GridFS
        if @document.draft_file_id
          Mongoid::GridFs.delete(@document.draft_file_id) rescue nil
        end
        if @document.final_file_id
          Mongoid::GridFs.delete(@document.final_file_id) rescue nil
        end

        @document.destroy!

        render json: { message: "Documento eliminado exitosamente" }
      end

      # GET /api/v1/documents/pending_signatures
      # Returns documents pending signature by the current user
      def pending_signatures
        documents = ::Templates::GeneratedDocument
          .where(organization_id: current_organization.id)
          .pending_signature_by(current_user)
          .order(created_at: :desc)

        render json: {
          data: documents.map { |doc| document_json(doc, detailed: true) },
          meta: {
            total: documents.count
          }
        }
      end

      # POST /api/v1/documents/:id/sign
      # Signs the document with the current user's digital signature
      def sign
        authorize @document

        # Check if user can sign this document
        unless @document.can_be_signed_by?(current_user)
          return render json: { error: "No tienes firma pendiente en este documento" }, status: :forbidden
        end

        # Get user's default signature
        signature = current_user.signatures.active.default_signature.first || current_user.signatures.active.first
        unless signature
          return render json: { error: "No tienes una firma digital configurada. Configura tu firma en tu perfil." }, status: :unprocessable_entity
        end

        @document.sign!(user: current_user, signature: signature)

        render json: {
          data: document_json(@document, detailed: true),
          message: "Documento firmado exitosamente",
          all_signed: @document.all_required_signed?
        }
      rescue ::Templates::GeneratedDocument::SignatureError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      private

      def set_document
        @document = ::Templates::GeneratedDocument.find_by!(uuid: params[:id])
      rescue Mongoid::Errors::DocumentNotFound
        render json: { error: "Documento no encontrado" }, status: :not_found
      end

      def apply_document_filters(scope)
        # Filter by category (can be comma-separated for multiple categories)
        if params[:category].present?
          categories = params[:category].split(",").map(&:strip)
          template_ids = ::Templates::Template.where(:category.in => categories).pluck(:id)
          scope = scope.where(:template_id.in => template_ids)
        end

        # Filter by status
        if params[:status].present?
          scope = scope.where(status: params[:status])
        end

        # Filter by search query
        if params[:q].present?
          query = /#{Regexp.escape(params[:q])}/i
          scope = scope.or({ name: query })
        end

        # Filter by employee_id (accepts UUID or MongoDB ObjectId)
        if params[:employee_id].present?
          employee = ::Hr::Employee.find_by(uuid: params[:employee_id]) ||
                     ::Hr::Employee.where(id: params[:employee_id]).first
          scope = scope.where(employee_id: employee&.id) if employee
        end

        # Filter by module (hr or legal)
        if params[:module].present?
          case params[:module]
          when "hr"
            # HR documents: includes employee contracts (with employee_id) and other HR categories
            hr_categories = %w[vacation certification employee_contract employee contract]
            template_ids = ::Templates::Template.where(:category.in => hr_categories).pluck(:id)
            # Filter by template categories, but for 'contract' only include those with employee_id
            contract_template_ids = ::Templates::Template.where(category: "contract").pluck(:id)
            other_template_ids = template_ids - contract_template_ids
            scope = scope.where(
              "$or" => [
                { :template_id.in => other_template_ids },
                { :template_id.in => contract_template_ids, :employee_id.ne => nil }
              ]
            )
          when "legal"
            # Legal documents: contracts without employee_id (third party contracts)
            legal_categories = %w[contract legal]
            template_ids = ::Templates::Template.where(:category.in => legal_categories).pluck(:id)
            scope = scope.where(:template_id.in => template_ids, :employee_id => nil)
          end
        end

        scope
      end

      def document_json(document, detailed: false)
        employee = document.employee
        template = document.template

        json = {
          id: document.uuid,
          name: document.name,
          file_name: document.file_name,
          status: document.status,
          template_name: template&.name,
          template_category: template&.category,
          employee_name: employee&.full_name,
          employee_number: employee&.employee_number,
          created_at: document.created_at.iso8601,
          requested_by: document.requested_by&.full_name
        }

        if detailed
          json.merge!(
            variable_values: document.variable_values,
            signatures: document.signatures.map do |sig|
              {
                signatory_label: sig["signatory_label"],
                signatory_type_code: sig["signatory_type_code"],
                user_name: sig["user_name"],
                user_id: sig["user_id"],
                status: sig["status"],
                required: sig["required"],
                signed_at: sig["signed_at"],
                signed_by_name: sig["signed_by_name"]
              }
            end,
            pending_signatures_count: document.pending_signatures_count,
            completed_signatures_count: document.completed_signatures_count,
            total_required_signatures: document.total_required_signatures,
            all_signed: document.all_required_signed?,
            can_sign: document.can_be_signed_by?(current_user),
            completed_at: document.completed_at&.iso8601,
            can_download: document.draft_file_id.present?
          )
        end

        json
      end
    end
  end
end
