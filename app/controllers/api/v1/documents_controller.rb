# frozen_string_literal: true

module Api
  module V1
    class DocumentsController < BaseController
      before_action :set_document, only: [:show, :download, :destroy]

      # GET /api/v1/documents
      def index
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 20).to_i
        skip_count = (page - 1) * per_page

        base_scope = policy_scope(::Templates::GeneratedDocument).order(created_at: :desc)
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

      private

      def set_document
        @document = ::Templates::GeneratedDocument.find_by!(uuid: params[:id])
      rescue Mongoid::Errors::DocumentNotFound
        render json: { error: "Documento no encontrado" }, status: :not_found
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
            signatures: document.signatures,
            pending_signatures_count: document.pending_signatures_count,
            completed_signatures_count: document.completed_signatures_count,
            total_required_signatures: document.total_required_signatures,
            completed_at: document.completed_at&.iso8601,
            can_download: document.draft_file_id.present?
          )
        end

        json
      end
    end
  end
end
