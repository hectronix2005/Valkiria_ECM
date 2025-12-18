# frozen_string_literal: true

module Api
  module V1
    module Content
      class VersionsController < BaseController
        before_action :set_document
        before_action :set_version, only: [:show]

        rescue_from ::Content::Document::ConcurrencyError, with: :handle_concurrency_error
        rescue_from ::Content::Document::DocumentLockedError, with: :handle_locked_error

        def index
          authorize @document, :show?

          versions = @document.version_history

          render json: {
            data: versions.map { |v| version_response(v) }
          }, status: :ok
        end

        def show
          authorize @document, :show?

          render json: {
            data: version_response(@version, include_content: params[:include_content] == "true")
          }, status: :ok
        end

        def create
          authorize @document, :update?

          version = @document.create_version!(version_params)

          render json: {
            data: version_response(version),
            message: "Version #{version.version_number} created successfully"
          }, status: :created
        end

        def current
          authorize @document, :show?

          version = @document.current_version

          if version
            render json: { data: version_response(version, include_content: true) }, status: :ok
          else
            render_error("No versions found", status: :not_found)
          end
        end

        private

        def set_document
          @document = ::Content::Document.find(params[:document_id])
        end

        def set_version
          @version = if params[:id] == "current"
                       @document.current_version
                     else
                       @document.versions.find(params[:id])
                     end

          raise Mongoid::Errors::DocumentNotFound.new(::Content::DocumentVersion, params[:id]) unless @version
        end

        def version_params
          permitted = params.require(:version).permit(
            :file_name, :content, :content_type, :file_size, :change_summary,
            metadata: {}
          )
          permitted[:created_by] = current_user
          permitted
        end

        def version_response(version, include_content: false)
          response = {
            id: version.id.to_s,
            uuid: version.uuid,
            document_id: version.document_id.to_s,
            version_number: version.version_number,
            file_name: version.file_name,
            file_size: version.file_size,
            content_type: version.content_type,
            checksum: version.checksum,
            change_summary: version.change_summary,
            is_latest: version.latest?,
            created_by_id: version.created_by_id&.to_s,
            metadata: version.metadata,
            created_at: version.created_at.iso8601
          }

          response[:content] = version.content if include_content

          response
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
