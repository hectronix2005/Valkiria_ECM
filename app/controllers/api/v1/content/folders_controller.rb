# frozen_string_literal: true

module Api
  module V1
    module Content
      class FoldersController < BaseController
        before_action :set_folder, only: [:show, :update, :destroy]

        def index
          authorize ::Content::Folder
          folders = policy_scope(::Content::Folder)

          if params[:parent_id]
            folders = folders.by_parent(params[:parent_id])
          elsif params[:root]
            folders = folders.root_folders
          end

          folders = folders.alphabetical

          render json: {
            data: folders.map { |f| folder_response(f) }
          }, status: :ok
        end

        def show
          authorize @folder

          render json: {
            data: folder_response(@folder, include_children: true)
          }, status: :ok
        end

        def create
          authorize ::Content::Folder
          folder = ::Content::Folder.new(folder_params)
          folder.created_by = current_user
          folder.organization = current_user.organization

          if folder.save
            render json: { data: folder_response(folder) }, status: :created
          else
            render_errors(folder.errors.full_messages)
          end
        end

        def update
          authorize @folder

          if @folder.update(folder_params)
            render json: { data: folder_response(@folder) }, status: :ok
          else
            render_errors(@folder.errors.full_messages)
          end
        end

        def destroy
          authorize @folder

          if @folder.children.any? || @folder.documents.any?
            render_error("Cannot delete folder with contents", status: :unprocessable_entity)
          else
            @folder.soft_delete!
            render json: { message: "Folder deleted successfully" }, status: :ok
          end
        end

        private

        def set_folder
          @folder = ::Content::Folder.find(params[:id])
        end

        def folder_params
          params.require(:folder).permit(:name, :description, :parent_id, metadata: {})
        end

        # rubocop:disable Metrics/AbcSize
        def folder_response(folder, include_children: false)
          response = {
            id: folder.id.to_s,
            uuid: folder.uuid,
            name: folder.name,
            description: folder.description,
            path: folder.path,
            depth: folder.depth,
            parent_id: folder.parent_id&.to_s,
            organization_id: folder.organization_id&.to_s,
            document_count: folder.document_count,
            metadata: folder.metadata,
            created_at: folder.created_at.iso8601,
            updated_at: folder.updated_at.iso8601
          }

          if include_children
            response[:children] = folder.children.alphabetical.map { |c| folder_response(c) }
            response[:ancestors] = folder.ancestors.map { |a| { id: a.id.to_s, name: a.name, path: a.path } }
          end

          response
        end
        # rubocop:enable Metrics/AbcSize
      end
    end
  end
end
