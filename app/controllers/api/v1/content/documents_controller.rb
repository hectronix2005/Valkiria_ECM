# frozen_string_literal: true

module Api
  module V1
    module Content
      class DocumentsController < BaseController
        before_action :set_document, only: [:show, :update, :destroy, :lock, :unlock]

        rescue_from ::Content::Document::ConcurrencyError, with: :handle_concurrency_error
        rescue_from ::Content::Document::DocumentLockedError, with: :handle_locked_error

        def index
          authorize ::Content::Document
          documents = policy_scope(::Content::Document)

          documents = apply_filters(documents)

          render json: {
            data: documents.map { |d| document_response(d) }
          }, status: :ok
        end

        def show
          authorize @document

          render json: {
            data: document_response(@document, include_version: true)
          }, status: :ok
        end

        def create
          authorize ::Content::Document

          document = ::Content::Document.new(document_params)
          document.created_by = current_user
          document.organization = current_user.organization

          if document.save
            # Create initial version if content provided
            if version_params[:content].present? || version_params[:file_name].present?
              document.create_version!(version_params)
            end

            render json: { data: document_response(document, include_version: true) }, status: :created
          else
            render_errors(document.errors.full_messages)
          end
        end

        def update
          authorize @document

          @document.update_with_lock!(document_params.to_h)

          render json: { data: document_response(@document) }, status: :ok
        end

        def destroy
          authorize @document

          @document.soft_delete!

          render json: { message: "Document deleted successfully" }, status: :ok
        end

        def lock
          authorize @document, :update?

          if @document.lock!(current_user)
            render json: { data: document_response(@document), message: "Document locked" }, status: :ok
          else
            render_error("Unable to lock document", status: :conflict)
          end
        end

        def unlock
          authorize @document, :update?

          if @document.unlock!(current_user)
            render json: { data: document_response(@document), message: "Document unlocked" }, status: :ok
          else
            render_error("Unable to unlock document", status: :conflict)
          end
        end

        private

        def set_document
          @document = ::Content::Document.find(params[:id])
        end

        def document_params
          params.require(:document).permit(
            :title, :description, :status, :document_type, :folder_id,
            tags: [], metadata: {}
          )
        end

        def version_params
          params.fetch(:version, {}).permit(
            :file_name, :content, :content_type, :change_summary,
            metadata: {}
          )
        end

        def apply_filters(documents)
          documents = documents.by_folder(params[:folder_id]) if params[:folder_id].present?
          documents = documents.where(status: params[:status]) if params[:status].present?
          documents = documents.by_type(params[:document_type]) if params[:document_type].present?
          documents = documents.tagged_with(params[:tag]) if params[:tag].present?
          documents
        end

        # rubocop:disable Metrics/AbcSize, Metrics/MethodLength
        def document_response(document, include_version: false)
          response = {
            id: document.id.to_s,
            uuid: document.uuid,
            title: document.title,
            description: document.description,
            status: document.status,
            document_type: document.document_type,
            tags: document.tags,
            folder_id: document.folder_id&.to_s,
            organization_id: document.organization_id&.to_s,
            current_version_number: document.current_version_number,
            version_count: document.version_count,
            locked: document.locked?,
            locked_by_id: document.locked_by_id&.to_s,
            locked_at: document.locked_at&.iso8601,
            created_by_id: document.created_by_id&.to_s,
            metadata: document.metadata,
            created_at: document.created_at.iso8601,
            updated_at: document.updated_at.iso8601
          }

          if include_version && document.current_version
            response[:current_version] = version_response(document.current_version)
          end

          response
        end
        # rubocop:enable Metrics/AbcSize, Metrics/MethodLength

        def version_response(version)
          {
            id: version.id.to_s,
            uuid: version.uuid,
            version_number: version.version_number,
            file_name: version.file_name,
            file_size: version.file_size,
            content_type: version.content_type,
            checksum: version.checksum,
            change_summary: version.change_summary,
            created_by_id: version.created_by_id&.to_s,
            created_at: version.created_at.iso8601
          }
        end

        def handle_concurrency_error(exception)
          render_error(exception.message, status: :conflict)
        end

        def handle_locked_error(exception)
          render_error(exception.message, status: :locked)
        end
      end
    end
  end
end
