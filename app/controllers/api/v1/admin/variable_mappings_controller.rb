# frozen_string_literal: true

module Api
  module V1
    module Admin
      class VariableMappingsController < BaseController
        before_action :ensure_admin_or_hr
        before_action :set_mapping, only: [:show, :update, :destroy, :toggle_active]

        # GET /api/v1/admin/variable_mappings
        def index
          @mappings = ::Templates::VariableMapping
                      .for_organization(current_organization)
                      .ordered

          # Filter by category
          @mappings = @mappings.by_category(params[:category]) if params[:category].present?

          # Filter by active status
          if params[:active].present?
            @mappings = params[:active] == "true" ? @mappings.active : @mappings.inactive
          end

          # Filter system vs custom
          if params[:type].present?
            @mappings = params[:type] == "system" ? @mappings.system_mappings : @mappings.custom_mappings
          end

          render json: {
            data: @mappings.map { |m| mapping_json(m) },
            meta: {
              total: @mappings.count,
              categories: ::Templates::VariableMapping::CATEGORIES,
              data_types: ::Templates::VariableMapping::DATA_TYPES
            }
          }
        end

        # GET /api/v1/admin/variable_mappings/grouped
        def grouped
          grouped = ::Templates::VariableMapping.grouped_for(current_organization)

          render json: {
            data: grouped.transform_values { |mappings| mappings.map { |m| mapping_json(m) } }
          }
        end

        # GET /api/v1/admin/variable_mappings/:id
        def show
          render json: { data: mapping_json(@mapping) }
        end

        # POST /api/v1/admin/variable_mappings
        def create
          @mapping = ::Templates::VariableMapping.new(mapping_params)
          @mapping.organization = current_organization
          @mapping.created_by = current_user
          @mapping.is_system = false

          if @mapping.save
            render json: {
              data: mapping_json(@mapping),
              message: "Mapeo creado exitosamente"
            }, status: :created
          else
            render json: {
              error: "Error al crear mapeo",
              errors: @mapping.errors.full_messages
            }, status: :unprocessable_content
          end
        end

        # PATCH /api/v1/admin/variable_mappings/:id
        def update
          if @mapping.update(mapping_params)
            render json: {
              data: mapping_json(@mapping),
              message: "Mapeo actualizado exitosamente"
            }
          else
            render json: {
              error: "Error al actualizar mapeo",
              errors: @mapping.errors.full_messages
            }, status: :unprocessable_content
          end
        end

        # DELETE /api/v1/admin/variable_mappings/:id
        def destroy
          # Only admins can delete system mappings
          if @mapping.system? && !current_user.admin?
            return render json: {
              error: "Solo administradores pueden eliminar mapeos del sistema"
            }, status: :forbidden
          end

          @mapping.destroy
          render json: { message: "Mapeo eliminado exitosamente" }
        end

        # POST /api/v1/admin/variable_mappings/:id/toggle_active
        def toggle_active
          @mapping.toggle_active!

          render json: {
            data: mapping_json(@mapping),
            message: @mapping.active? ? "Mapeo activado" : "Mapeo desactivado"
          }
        end

        # POST /api/v1/admin/variable_mappings/seed_system
        def seed_system
          ::Templates::VariableMapping.seed_system_mappings!

          render json: {
            message: "Mapeos del sistema creados exitosamente",
            count: ::Templates::VariableMapping.system_mappings.count
          }
        end

        # POST /api/v1/admin/variable_mappings/reorder
        def reorder
          return render json: { error: "Se requiere lista de IDs" }, status: :bad_request unless params[:ids].present?

          params[:ids].each_with_index do |uuid, index|
            mapping = ::Templates::VariableMapping.find_by(uuid: uuid)
            mapping&.update!(position: index)
          end

          render json: { message: "Orden actualizado" }
        end

        # GET /api/v1/admin/variable_mappings/pending_variables
        def pending_variables
          templates = ::Templates::Template.for_organization(current_organization)
          available_mappings = ::Templates::VariableMapping.available_for(current_organization)

          pending_data = []

          templates.each do |template|
            next if template.variables.blank?

            template.variables.each do |variable|
              # Check if this variable has a mapping assigned
              has_mapping = template.variable_mappings[variable].present?
              next if has_mapping

              # Find suggestions based on similarity
              suggestions = find_suggestions(variable, available_mappings)

              pending_data << {
                template_id: template.uuid,
                template_name: template.name,
                template_category: template.category_label,
                template_status: template.status,
                variable: variable,
                suggestions: suggestions
              }
            end
          end

          # Group by variable name
          grouped = pending_data.group_by { |p| p[:variable] }

          render json: {
            data: {
              pending_variables: pending_data,
              grouped_by_variable: grouped.transform_values do |items|
                {
                  count: items.size,
                  templates: items.map { |i| { id: i[:template_id], name: i[:template_name] } },
                  suggestions: items.first[:suggestions]
                }
              end,
              summary: {
                total_pending: pending_data.size,
                unique_variables: grouped.keys.size,
                templates_with_pending: pending_data.map { |p| p[:template_id] }.uniq.size
              }
            }
          }
        end

        # POST /api/v1/admin/variable_mappings/auto_assign
        def auto_assign
          variable_name = params[:variable]
          mapping_key = params[:mapping_key]
          template_ids = params[:template_ids] || []

          return render json: { error: "Se requiere variable y mapping_key" }, status: :bad_request if variable_name.blank? || mapping_key.blank?

          # Normalize the variable name to match stored format
          normalized_variable = ::Templates::VariableNormalizer.normalize(variable_name)

          updated_count = 0

          templates = if template_ids.present?
                        ::Templates::Template.where(:uuid.in => template_ids)
                      else
                        ::Templates::Template.for_organization(current_organization)
                      end

          templates.each do |template|
            next unless template.variables&.include?(normalized_variable)
            next if template.variable_mappings[normalized_variable].present?

            template.variable_mappings[normalized_variable] = mapping_key
            template.save!
            updated_count += 1
          end

          render json: {
            message: "Mapeo asignado exitosamente",
            updated_templates: updated_count
          }
        end

        # POST /api/v1/admin/variable_mappings/merge
        # Merge variables: keep primary, convert others to aliases (same key, different names)
        def merge
          primary_id = params[:primary_id]
          alias_ids = params[:alias_ids] || []

          return render json: { error: "Se requiere primary_id" }, status: :bad_request if primary_id.blank?
          return render json: { error: "Se requiere al menos un alias_id" }, status: :bad_request if alias_ids.empty?

          primary = ::Templates::VariableMapping.find_by(uuid: primary_id)
          return render json: { error: "Variable principal no encontrada" }, status: :not_found unless primary

          merged_names = [primary.name]
          merged_count = 0

          alias_ids.each do |alias_id|
            alias_mapping = ::Templates::VariableMapping.find_by(uuid: alias_id)
            next unless alias_mapping
            next if alias_mapping.uuid == primary.uuid
            next if alias_mapping.key == primary.key # Already linked

            old_key = alias_mapping.key

            # Update the alias mapping to use the primary's key
            alias_mapping.update!(
              key: primary.key,
              description: "Alias de #{primary.name}"
            )

            # Update any templates using the old key for this variable name
            update_templates_with_mapping(alias_mapping.name, primary.key)

            merged_names << alias_mapping.name
            merged_count += 1
          end

          render json: {
            message: "Variables fusionadas exitosamente",
            primary: mapping_json(primary),
            merged_count: merged_count,
            aliases: merged_names
          }
        end

        # GET /api/v1/admin/variable_mappings/aliases
        # Get all variables grouped by their key (shows aliases)
        def aliases
          mappings = ::Templates::VariableMapping.available_for(current_organization)

          # Group by key
          grouped = mappings.group_by(&:key)

          # Only return groups with more than one name (actual aliases)
          alias_groups = grouped.select { |_key, vars| vars.size > 1 }

          render json: {
            data: alias_groups.map do |key, vars|
              {
                key: key,
                count: vars.size,
                variables: vars.map { |v| mapping_json(v) }
              }
            end,
            meta: {
              total_groups: alias_groups.size,
              total_aliases: alias_groups.values.flatten.size
            }
          }
        end

        # POST /api/v1/admin/variable_mappings/create_alias
        # Create an alias for an existing variable
        def create_alias
          source_id = params[:source_id]
          alias_name = params[:alias_name]

          return render json: { error: "Se requiere source_id y alias_name" }, status: :bad_request if source_id.blank? || alias_name.blank?

          source = ::Templates::VariableMapping.find_by(uuid: source_id)
          return render json: { error: "Variable fuente no encontrada" }, status: :not_found unless source

          # Normalize the alias name
          normalized_name = ::Templates::VariableNormalizer.normalize(alias_name)

          # Check if alias already exists
          existing = ::Templates::VariableMapping.where(name: normalized_name).first
          if existing
            return render json: { error: "Ya existe una variable con ese nombre" }, status: :unprocessable_content
          end

          # Create the alias
          alias_mapping = ::Templates::VariableMapping.create!(
            name: normalized_name,
            key: source.key,
            category: source.category,
            description: "Alias de #{source.name}",
            data_type: source.data_type,
            is_system: false,
            active: true,
            organization: current_organization,
            created_by: current_user
          )

          render json: {
            data: mapping_json(alias_mapping),
            message: "Alias creado exitosamente",
            source: mapping_json(source)
          }, status: :created
        end

        # DELETE /api/v1/admin/variable_mappings/:id/remove_alias
        # Remove an alias (but keep the primary)
        def remove_alias
          alias_mapping = ::Templates::VariableMapping.find_by(uuid: params[:id])
          return render json: { error: "Alias no encontrado" }, status: :not_found unless alias_mapping

          # Find other variables with the same key
          same_key_count = ::Templates::VariableMapping.where(key: alias_mapping.key).count

          if same_key_count <= 1
            return render json: { error: "No se puede eliminar la ultima variable con esta clave" }, status: :unprocessable_content
          end

          alias_mapping.destroy

          render json: { message: "Alias eliminado exitosamente" }
        end

        # POST /api/v1/admin/variable_mappings/create_and_assign
        def create_and_assign
          variable_name = params[:variable]
          mapping_data = params[:mapping]&.permit(:name, :key, :category, :description, :data_type) || {}
          template_ids = params[:template_ids] || []

          return render json: { error: "Se requiere variable" }, status: :bad_request if variable_name.blank?

          # Normalize the variable name
          normalized_variable = ::Templates::VariableNormalizer.normalize(variable_name)

          # Generate key from normalized variable name if not provided
          generated_key = "custom.#{::Templates::VariableNormalizer.to_key(variable_name)}"

          # Create the new mapping (name will be normalized by model callback)
          @mapping = ::Templates::VariableMapping.new(
            name: mapping_data[:name].presence || normalized_variable,
            key: mapping_data[:key].presence || generated_key,
            category: mapping_data[:category].presence || "custom",
            description: mapping_data[:description].presence || "Variable personalizada: #{normalized_variable}",
            data_type: mapping_data[:data_type].presence || "string",
            organization: current_organization,
            created_by: current_user,
            is_system: false
          )

          unless @mapping.save
            return render json: {
              error: "Error al crear mapeo",
              errors: @mapping.errors.full_messages
            }, status: :unprocessable_content
          end

          # Assign to templates using normalized variable name
          updated_count = 0
          templates = if template_ids.present?
                        ::Templates::Template.where(:uuid.in => template_ids)
                      else
                        ::Templates::Template.for_organization(current_organization)
                      end

          templates.each do |template|
            next unless template.variables&.include?(normalized_variable)
            next if template.variable_mappings[normalized_variable].present?

            template.variable_mappings[normalized_variable] = @mapping.key
            template.save!
            updated_count += 1
          end

          render json: {
            data: mapping_json(@mapping),
            message: "Mapeo creado y asignado exitosamente",
            updated_templates: updated_count
          }, status: :created
        end

        private

        def find_suggestions(variable, available_mappings)
          normalized_var = normalize_string(variable)

          suggestions = available_mappings.map do |mapping|
            score = calculate_similarity(normalized_var, normalize_string(mapping.name))
            { mapping: mapping_json(mapping), score: score }
          end

          # Return top 3 suggestions with score > 0.3
          suggestions
            .select { |s| s[:score] > 0.3 }
            .sort_by { |s| -s[:score] }
            .first(3)
            .map { |s| s[:mapping].merge(match_score: (s[:score] * 100).round) }
        end

        def normalize_string(str)
          str.to_s.downcase
             .gsub(/[áàäâ]/, "a")
             .gsub(/[éèëê]/, "e")
             .gsub(/[íìïî]/, "i")
             .gsub(/[óòöô]/, "o")
             .gsub(/[úùüû]/, "u")
             .gsub(/[ñ]/, "n")
             .gsub(/[^a-z0-9]/, "")
        end

        def update_templates_with_mapping(variable_name, new_key)
          normalized_name = ::Templates::VariableNormalizer.normalize(variable_name)

          ::Templates::Template.for_organization(current_organization).each do |template|
            next unless template.variables&.include?(normalized_name)

            template.variable_mappings[normalized_name] = new_key
            template.save!
          end
        end

        def calculate_similarity(str1, str2)
          return 1.0 if str1 == str2
          return 0.0 if str1.empty? || str2.empty?

          # Check for substring match
          if str1.include?(str2) || str2.include?(str1)
            return 0.8
          end

          # Simple word overlap similarity
          words1 = str1.scan(/[a-z]+/)
          words2 = str2.scan(/[a-z]+/)

          return 0.0 if words1.empty? || words2.empty?

          common = (words1 & words2).size
          total = [words1.size, words2.size].max

          common.to_f / total
        end

        def ensure_admin_or_hr
          return if current_user.admin? || current_user.has_role?("hr")

          render json: {
            error: "Acceso denegado. Se requieren privilegios de administrador o HR."
          }, status: :forbidden
        end

        def set_mapping
          @mapping = ::Templates::VariableMapping.find_by(uuid: params[:id])

          return if @mapping

          render json: { error: "Mapeo no encontrado" }, status: :not_found
        end

        def mapping_params
          params.require(:mapping).permit(
            :name,
            :key,
            :category,
            :description,
            :data_type,
            :format_pattern,
            :source_model,
            :source_field,
            :active,
            :position
          )
        end

        def mapping_json(mapping)
          {
            id: mapping.uuid,
            name: mapping.name,
            key: mapping.key,
            category: mapping.category,
            category_label: mapping.category_label,
            description: mapping.description,
            data_type: mapping.data_type,
            format_pattern: mapping.format_pattern,
            source_model: mapping.source_model,
            source_field: mapping.source_field,
            is_system: mapping.is_system,
            active: mapping.active,
            position: mapping.position,
            created_at: mapping.created_at.iso8601
          }
        end
      end
    end
  end
end
