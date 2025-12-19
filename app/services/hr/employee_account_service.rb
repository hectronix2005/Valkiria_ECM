# frozen_string_literal: true

module Hr
  # Service to create user accounts for employees when contracts are generated
  # Uses personal_email as username and identification_number as initial password
  #
  class EmployeeAccountService
    class AccountCreationError < StandardError; end

    attr_reader :employee, :errors

    def initialize(employee)
      @employee = employee
      @errors = []
    end

    # Create a user account for the employee
    # Returns the created user or nil if failed
    def create_account!
      validate_employee_data!
      return nil if errors.any?

      # Check if user already exists with this email
      existing_user = Identity::User.find_by(email: employee.personal_email)
      if existing_user
        @errors << "Ya existe un usuario con el correo #{employee.personal_email}"
        return nil
      end

      user = build_user

      if user.save
        assign_employee_role(user)
        link_employee_to_user(user)
        user
      else
        @errors.concat(user.errors.full_messages)
        nil
      end
    rescue StandardError => e
      @errors << "Error al crear cuenta: #{e.message}"
      Rails.logger.error "EmployeeAccountService error: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
      nil
    end

    # Check if employee can have an account created
    def can_create_account?
      validate_employee_data!
      errors.empty?
    end

    # Check if employee already has a user account
    def has_account?
      employee.user_id.present? ||
        (employee.personal_email.present? && Identity::User.exists?(email: employee.personal_email))
    end

    private

    def validate_employee_data!
      @errors = []

      if employee.personal_email.blank?
        @errors << "El empleado debe tener un correo personal"
      end

      if employee.identification_number.blank?
        @errors << "El empleado debe tener número de identificación"
      end

      if employee.identification_number.present? && employee.identification_number.length < 6
        @errors << "El número de identificación debe tener al menos 6 caracteres"
      end

      if employee.first_name.blank? || employee.last_name.blank?
        @errors << "El empleado debe tener nombre y apellido"
      end
    end

    def build_user
      Identity::User.new(
        email: employee.personal_email,
        password: employee.identification_number,
        password_confirmation: employee.identification_number,
        first_name: extract_first_name,
        last_name: extract_last_name,
        organization: employee.organization,
        must_change_password: true,
        active: true
      )
    end

    def extract_first_name
      employee.display_first_name.presence || employee.personal_email.split('@').first.titleize
    end

    def extract_last_name
      employee.display_last_name.presence || "Usuario"
    end

    def assign_employee_role(user)
      employee_role = Identity::Role.find_by(name: Identity::Role::EMPLOYEE)
      user.roles << employee_role if employee_role && !user.roles.include?(employee_role)
    end

    def link_employee_to_user(user)
      # Update employee to point to the new user
      employee.update!(user_id: user.id)
    end
  end
end
