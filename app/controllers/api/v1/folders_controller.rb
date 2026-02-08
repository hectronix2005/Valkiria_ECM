# frozen_string_literal: true

module Api
  module V1
    class FoldersController < BaseController
      before_action :set_folder, only: [:show, :update, :destroy, :add_document, :remove_document]

      # GET /api/v1/folders
      def index
        folders = ::Documents::Folder
                  .for_organization(current_organization)
                  .ordered

        # Filter by parent
        if params[:parent_id].present?
          if params[:parent_id] == "root"
            folders = folders.root_folders
          else
            parent = ::Documents::Folder.find_by(uuid: params[:parent_id])
            folders = folders.where(parent_id: parent&.id)
          end
        else
          folders = folders.root_folders
        end

        render json: {
          data: folders.map { |f| folder_json(f) },
          meta: { total: folders.count }
        }
      end

      # GET /api/v1/folders/:id
      def show
        render json: {
          data: folder_json(@folder, detailed: true)
        }
      end

      # POST /api/v1/folders
      def create
        folder = ::Documents::Folder.new(folder_params)
        folder.organization = current_organization
        folder.created_by = current_user

        # Handle parent folder
        if params[:folder][:parent_id].present?
          parent = ::Documents::Folder.find_by(uuid: params[:folder][:parent_id])
          folder.parent = parent
        end

        if folder.save
          render json: {
            data: folder_json(folder),
            message: "Carpeta creada exitosamente"
          }, status: :created
        else
          render json: { error: folder.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/folders/:id
      def update
        if @folder.is_system
          return render json: { error: "No se puede modificar una carpeta del sistema" }, status: :forbidden
        end

        if @folder.update(folder_params)
          render json: {
            data: folder_json(@folder),
            message: "Carpeta actualizada exitosamente"
          }
        else
          render json: { error: @folder.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/folders/:id
      def destroy
        if @folder.is_system
          return render json: { error: "No se puede eliminar una carpeta del sistema" }, status: :forbidden
        end

        if @folder.subfolders.any?
          return render json: { error: "No se puede eliminar una carpeta que contiene subcarpetas" }, status: :conflict
        end

        @folder.destroy!
        render json: { message: "Carpeta eliminada exitosamente" }
      end

      # POST /api/v1/folders/:id/documents
      def add_document
        document = ::Templates::GeneratedDocument.where(uuid: params[:document_id]).first

        unless document
          return render json: { error: "Documento no encontrado" }, status: :not_found
        end

        folder_doc = @folder.folder_documents.new(
          document: document,
          added_by: current_user
        )

        if folder_doc.save
          render json: {
            data: folder_json(@folder),
            message: "Documento agregado a la carpeta"
          }
        else
          render json: { error: folder_doc.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/folders/:id/documents/:document_id
      def remove_document
        document = ::Templates::GeneratedDocument.where(uuid: params[:document_id]).first

        unless document
          return render json: { error: "Documento no encontrado" }, status: :not_found
        end

        folder_doc = @folder.folder_documents.find_by(document_id: document.id)

        unless folder_doc
          return render json: { error: "El documento no está en esta carpeta" }, status: :not_found
        end

        folder_doc.destroy!
        render json: {
          data: folder_json(@folder),
          message: "Documento removido de la carpeta"
        }
      end

      private

      def set_folder
        @folder = ::Documents::Folder.find_by(
          uuid: params[:id],
          organization_id: current_organization.id
        )

        unless @folder
          render json: { error: "Carpeta no encontrada" }, status: :not_found
        end
      end

      def folder_params
        params.require(:folder).permit(:name, :description, :color, :icon)
      end

      def folder_json(folder, detailed: false)
        json = {
          id: folder.uuid,
          name: folder.name,
          description: folder.description,
          color: folder.color,
          icon: folder.icon,
          is_system: folder.is_system,
          documents_count: folder.documents_count,
          subfolders_count: folder.subfolders.count,
          parent_id: folder.parent&.uuid,
          created_at: folder.created_at.iso8601
        }

        if detailed
          json[:full_path] = folder.full_path
          json[:ancestors] = folder.ancestors.map { |a| { id: a.uuid, name: a.name } }
          json[:subfolders] = folder.subfolders.ordered.map { |s| folder_json(s) }
          json[:documents] = folder.folder_documents.includes(:document).map do |fd|
            doc = fd.document
            next unless doc
            {
              id: doc.uuid,
              name: doc.name,
              status: doc.status,
              created_at: doc.created_at.iso8601,
              added_at: fd.created_at.iso8601
            }
          end.compact
        end

        json
      end
    end
  end
end
