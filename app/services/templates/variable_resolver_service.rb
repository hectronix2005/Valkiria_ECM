# frozen_string_literal: true

module Templates
  class VariableResolverService
    def initialize(context)
      @employee = context[:employee]
      @organization = context[:organization]
      @request = context[:request]
      @third_party = context[:third_party]
      @contract = context[:contract]
      @custom_values = context[:custom_values] || {}
    end

    # Resolve a single variable path to its value
    def resolve(variable_path)
      return @custom_values[variable_path] if @custom_values.key?(variable_path)

      parts = variable_path.split(".")
      source = parts.first
      field = parts[1..].join(".")

      case source
      when "employee"
        resolve_employee_field(field)
      when "organization"
        resolve_organization_field(field)
      when "request"
        resolve_request_field(field)
      when "third_party"
        resolve_third_party_field(field)
      when "contract"
        resolve_contract_field(field)
      when "system"
        resolve_system_field(field)
      when "custom"
        resolve_custom_field(field)
      else
        nil
      end
    end

    # Resolve all variables in a mapping hash
    def resolve_all(variable_mappings)
      result = {}

      variable_mappings.each do |variable_name, variable_path|
        result[variable_name] = resolve(variable_path)
      end

      result
    end

    # Get all resolved values ready for template substitution
    def resolve_for_template(template)
      result = {}

      template.variables.each do |variable_name|
        path = template.variable_mappings[variable_name]
        result[variable_name] = path ? resolve(path) : nil
      end

      result
    end

    private

    def resolve_employee_field(field)
      return nil unless @employee

      case field
      when "full_name"
        @employee.full_name
      when "first_name"
        @employee.user&.first_name
      when "last_name"
        @employee.user&.last_name
      when "employee_number"
        @employee.employee_number
      when "job_title"
        @employee.job_title
      when "department"
        @employee.department
      when "hire_date"
        format_date(@employee.hire_date)
      when "hire_date_text"
        format_date_text(@employee.hire_date)
      when "identification_number"
        @employee.identification_number
      when "identification_type"
        @employee.identification_type
      when "email"
        @employee.user&.email
      when "years_of_service"
        calculate_years_of_service
      when "years_of_service_text"
        format_years_of_service
      # Compensation fields
      when "salary"
        format_currency(@employee.salary)
      when "salary_text"
        number_to_words(@employee.salary)
      when "food_allowance"
        format_currency(@employee.food_allowance)
      when "food_allowance_text"
        number_to_words(@employee.food_allowance)
      when "transport_allowance"
        format_currency(@employee.transport_allowance)
      when "transport_allowance_text"
        number_to_words(@employee.transport_allowance)
      when "total_compensation"
        total = (@employee.salary || 0) + (@employee.food_allowance || 0) + (@employee.transport_allowance || 0)
        format_currency(total)
      when "total_compensation_text"
        total = (@employee.salary || 0) + (@employee.food_allowance || 0) + (@employee.transport_allowance || 0)
        number_to_words(total)
      # Contract fields
      when "contract_type"
        format_contract_type(@employee.contract_type)
      when "contract_start_date"
        format_date(@employee.contract_start_date || @employee.hire_date)
      when "contract_end_date"
        format_date(@employee.contract_end_date)
      when "contract_duration"
        format_contract_duration
      when "trial_period_days"
        @employee.trial_period_days.to_s
      # Personal data
      when "address"
        @employee.address
      when "phone"
        @employee.phone
      when "place_of_birth"
        @employee.place_of_birth
      when "nationality"
        @employee.nationality
      when "date_of_birth"
        format_date(@employee.date_of_birth)
      else
        @employee.try(field)
      end
    end

    def resolve_organization_field(field)
      return nil unless @organization

      case field
      when "name"
        @organization.name
      when "tax_id", "nit"
        @organization.settings&.dig("tax_id") || @organization.try(:tax_id)
      when "address"
        @organization.settings&.dig("address") || @organization.try(:address)
      when "city"
        @organization.settings&.dig("city") || @organization.try(:city)
      when "phone"
        @organization.settings&.dig("phone") || @organization.try(:phone)
      else
        @organization.settings&.dig(field) || @organization.try(field)
      end
    end

    def resolve_third_party_field(field)
      return nil unless @third_party

      case field
      when "display_name", "name"
        @third_party.display_name
      when "business_name"
        @third_party.business_name
      when "trade_name"
        @third_party.trade_name
      when "code"
        @third_party.code
      when "identification_number"
        @third_party.identification_number
      when "identification_type"
        @third_party.identification_type
      when "full_identification"
        "#{@third_party.identification_type} #{@third_party.identification_number}"
      when "third_party_type", "type"
        @third_party.type_label
      when "person_type"
        @third_party.person_type == "natural" ? "Persona Natural" : "Persona Jurídica"
      when "email"
        @third_party.email
      when "phone"
        @third_party.phone
      when "address"
        @third_party.address
      when "city"
        @third_party.city
      when "country"
        @third_party.country
      when "legal_rep_name"
        @third_party.legal_rep_name
      when "legal_rep_id"
        @third_party.legal_rep_id_number
      when "legal_rep_email"
        @third_party.legal_rep_email
      when "bank_name"
        @third_party.bank_name
      when "bank_account_type"
        @third_party.bank_account_type == "savings" ? "Ahorros" : "Corriente"
      when "bank_account_number"
        @third_party.bank_account_number
      when "industry"
        @third_party.industry
      else
        @third_party.try(field)
      end
    end

    def resolve_contract_field(field)
      return nil unless @contract

      case field
      when "contract_number", "number"
        @contract.contract_number
      when "title"
        @contract.title
      when "description"
        @contract.description
      when "contract_type", "type"
        @contract.type_label
      when "status"
        @contract.status_label
      when "amount"
        format_currency(@contract.amount)
      when "amount_text"
        number_to_words(@contract.amount)
      when "currency"
        @contract.currency
      when "start_date"
        format_date(@contract.start_date)
      when "start_date_text"
        format_date_text(@contract.start_date)
      when "end_date"
        format_date(@contract.end_date)
      when "end_date_text"
        format_date_text(@contract.end_date)
      when "duration_days"
        @contract.duration_days.to_s
      when "duration_text"
        format_contract_duration_from_days(@contract.duration_days)
      when "payment_terms"
        @contract.payment_terms
      when "payment_frequency"
        format_payment_frequency(@contract.payment_frequency)
      when "approval_level"
        @contract.approval_level_label
      when "approved_at"
        format_date(@contract.approved_at)
      when "approved_at_text"
        format_date_text(@contract.approved_at)
      else
        @contract.try(field)
      end
    end

    def resolve_request_field(field)
      return nil unless @request

      case field
      when "request_number"
        @request.request_number
      when "certification_type"
        format_certification_type
      when "purpose"
        format_purpose
      when "start_date"
        format_date(@request.try(:start_date))
      when "end_date"
        format_date(@request.try(:end_date))
      when "days_requested"
        @request.try(:days_requested)
      when "vacation_type"
        format_vacation_type
      when "status"
        format_status
      when "submitted_at"
        format_date(@request.try(:submitted_at))
      else
        @request.try(field)
      end
    end

    def resolve_system_field(field)
      case field
      when "current_date"
        format_date(Date.current)
      when "current_date_text"
        format_date_text(Date.current)
      when "current_year"
        Date.current.year.to_s
      when "current_month"
        I18n.l(Date.current, format: "%B")
      when "current_month_year"
        I18n.l(Date.current, format: "%B de %Y")
      else
        nil
      end
    end

    # Custom variables that map to employee/organization data with transformations
    def resolve_custom_field(field)
      return nil unless @employee

      case field
      # Auxilio de alimentación en letras (toma de employee.food_allowance)
      when "auxilio_alimentacion_en_letras_y_pesos", "auxilio_de_alimentacion_en_letras"
        number_to_words(@employee.food_allowance)
      # Salario en letras (toma de employee.salary)
      when "salario_letras_y_pesos", "salario_en_letras"
        number_to_words(@employee.salary)
      # Auxilio de transporte en letras
      when "auxilio_transporte_en_letras_y_pesos", "auxilio_de_transporte_en_letras"
        number_to_words(@employee.transport_allowance)
      # Compensación total en letras
      when "compensacion_total_en_letras"
        total = (@employee.salary || 0) + (@employee.food_allowance || 0) + (@employee.transport_allowance || 0)
        number_to_words(total)
      else
        nil
      end
    end

    def format_date(date)
      return nil unless date

      date.strftime("%d/%m/%Y")
    end

    def format_date_text(date)
      return nil unless date

      I18n.l(date, format: :long, locale: :es)
    rescue StandardError
      date.strftime("%d de %B de %Y")
    end

    def calculate_years_of_service
      return nil unless @employee&.hire_date

      ((Date.current - @employee.hire_date) / 365.25).round(2)
    end

    def format_years_of_service
      years = calculate_years_of_service
      return nil unless years

      complete_years = years.floor
      months = ((years - complete_years) * 12).round

      if complete_years.zero? && months.zero?
        "menos de un mes"
      elsif complete_years.zero?
        "#{months} #{months == 1 ? 'mes' : 'meses'}"
      elsif months.zero?
        "#{complete_years} #{complete_years == 1 ? 'año' : 'años'}"
      else
        "#{complete_years} #{complete_years == 1 ? 'año' : 'años'} y #{months} #{months == 1 ? 'mes' : 'meses'}"
      end
    end

    def format_certification_type
      return nil unless @request.respond_to?(:certification_type)

      types = {
        "employment" => "Certificación Laboral",
        "salary" => "Certificación de Salario",
        "position" => "Certificación de Cargo",
        "full" => "Certificación Completa",
        "custom" => "Certificación Personalizada"
      }

      types[@request.certification_type] || @request.certification_type
    end

    def format_purpose
      return nil unless @request.respond_to?(:purpose)

      purposes = {
        "bank" => "Trámite Bancario",
        "visa" => "Solicitud de Visa",
        "rental" => "Arrendamiento",
        "government" => "Trámite Gubernamental",
        "legal" => "Proceso Legal",
        "other" => "Otro"
      }

      purposes[@request.purpose] || @request.purpose
    end

    def format_vacation_type
      return nil unless @request.respond_to?(:vacation_type)

      types = {
        "regular" => "Vacaciones Regulares",
        "accumulated" => "Vacaciones Acumuladas",
        "advance" => "Vacaciones Anticipadas",
        "partial" => "Vacaciones Parciales"
      }

      types[@request.vacation_type] || @request.vacation_type
    end

    def format_status
      return nil unless @request.respond_to?(:status)

      statuses = {
        "pending" => "Pendiente",
        "approved" => "Aprobado",
        "rejected" => "Rechazado",
        "processing" => "En Proceso",
        "completed" => "Completado",
        "cancelled" => "Cancelado"
      }

      statuses[@request.status] || @request.status
    end

    def format_currency(amount)
      return nil unless amount

      # Format as Colombian pesos
      formatted = amount.to_i.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\\1.').reverse
      "$#{formatted}"
    end

    def number_to_words(amount)
      return nil unless amount

      # Basic Spanish number to words conversion
      units = %w[cero uno dos tres cuatro cinco seis siete ocho nueve]
      teens = %w[diez once doce trece catorce quince dieciseis diecisiete dieciocho diecinueve]
      tens = %w[veinte treinta cuarenta cincuenta sesenta setenta ochenta noventa]
      hundreds = ["", "ciento", "doscientos", "trescientos", "cuatrocientos",
                  "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"]

      n = amount.to_i

      return "cero pesos" if n.zero?

      parts = []

      # Millions
      if n >= 1_000_000
        millions = n / 1_000_000
        parts << (millions == 1 ? "un millón" : "#{number_to_words_helper(millions, units, teens, tens, hundreds)} millones")
        n %= 1_000_000
      end

      # Thousands
      if n >= 1000
        thousands = n / 1000
        parts << (thousands == 1 ? "mil" : "#{number_to_words_helper(thousands, units, teens, tens, hundreds)} mil")
        n %= 1000
      end

      # Hundreds and below
      parts << number_to_words_helper(n, units, teens, tens, hundreds) if n.positive?

      "#{parts.join(' ')} pesos"
    end

    def number_to_words_helper(n, units, teens, tens, hundreds)
      return "" if n.zero?
      return units[n] if n < 10
      return teens[n - 10] if n < 20
      return "veinti#{units[n - 20]}" if n < 30
      return tens[(n / 10) - 2] + (n % 10 > 0 ? " y #{units[n % 10]}" : "") if n < 100
      return "cien" if n == 100
      return hundreds[n / 100] + (n % 100 > 0 ? " #{number_to_words_helper(n % 100, units, teens, tens, hundreds)}" : "") if n < 1000

      n.to_s
    end

    def format_contract_type(contract_type)
      return nil unless contract_type

      types = {
        "indefinite" => "Término Indefinido",
        "fixed_term" => "Término Fijo",
        "work_or_labor" => "Obra o Labor",
        "apprentice" => "Aprendizaje"
      }

      types[contract_type] || contract_type
    end

    def format_contract_duration
      return nil unless @employee&.contract_duration_value

      value = @employee.contract_duration_value
      unit = @employee.contract_duration_unit || "months"

      case unit
      when "days"
        "#{value} #{value == 1 ? 'día' : 'días'}"
      when "weeks"
        "#{value} #{value == 1 ? 'semana' : 'semanas'}"
      when "months"
        format_duration_months(value)
      when "years"
        format_duration_years(value)
      else
        "#{value} #{unit}"
      end
    end

    def format_duration_months(months)
      if months >= 12
        years = months / 12
        remaining_months = months % 12
        if remaining_months.zero?
          "#{years} #{years == 1 ? 'año' : 'años'}"
        else
          "#{years} #{years == 1 ? 'año' : 'años'} y #{remaining_months} #{remaining_months == 1 ? 'mes' : 'meses'}"
        end
      else
        "#{months} #{months == 1 ? 'mes' : 'meses'}"
      end
    end

    def format_duration_years(years)
      "#{years} #{years == 1 ? 'año' : 'años'}"
    end

    def format_contract_duration_from_days(days)
      return nil unless days

      if days >= 365
        years = days / 365
        remaining_days = days % 365
        months = remaining_days / 30
        if months.positive?
          "#{years} #{years == 1 ? 'año' : 'años'} y #{months} #{months == 1 ? 'mes' : 'meses'}"
        else
          "#{years} #{years == 1 ? 'año' : 'años'}"
        end
      elsif days >= 30
        months = days / 30
        "#{months} #{months == 1 ? 'mes' : 'meses'}"
      else
        "#{days} #{days == 1 ? 'día' : 'días'}"
      end
    end

    def format_payment_frequency(frequency)
      return nil unless frequency

      frequencies = {
        "monthly" => "Mensual",
        "biweekly" => "Quincenal",
        "weekly" => "Semanal",
        "one_time" => "Pago Único",
        "milestone" => "Por Hitos",
        "upon_delivery" => "Contra Entrega"
      }

      frequencies[frequency] || frequency
    end
  end
end
