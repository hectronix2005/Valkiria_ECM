# frozen_string_literal: true

# VALKYRIA ECM - Seed Data for Development/Testing
# Creates demo users with different roles for testing the system
#
# Run with: bundle exec rails runner db/seeds.rb
#           or: bundle exec rails db:seed (requires rake task)

# In production, use SEED_ADMIN_PASSWORD env var. In development, use defaults.
SEED_PASSWORD = ENV.fetch("SEED_PASSWORD") { Rails.env.production? ? SecureRandom.hex(16) : "Admin123!" }

puts "🌱 Seeding VALKYRIA ECM database..."

# Clean existing data (development only)
if Rails.env.development?
  puts "  Cleaning existing data..."
  Hr::VacationRequest.destroy_all
  Hr::EmploymentCertificationRequest.destroy_all
  Hr::Employee.destroy_all
  Identity::User.destroy_all
  Identity::Role.destroy_all
  Identity::Permission.destroy_all
  Identity::Organization.destroy_all
end

# Create permissions first
puts "  Creating permissions..."
Identity::Permission.seed_defaults! if Identity::Permission.respond_to?(:seed_defaults!)

# Create roles
puts "  Creating roles..."
Identity::Role.seed_defaults!

# Create organization
puts "  Creating organization..."
organization = Identity::Organization.find_or_create_by!(name: "VALKYRIA Corp") do |org|
  org.slug = "valkyria-corp"
  org.active = true
end

# Helper method to create user with employee profile
def create_user_with_employee(attrs, organization, role_names, supervisor: nil)
  user = Identity::User.create!(
    email: attrs[:email],
    password: attrs[:password],
    first_name: attrs[:first_name],
    last_name: attrs[:last_name],
    department: attrs[:department],
    title: attrs[:title],
    organization: organization,
    active: true
  )

  # Clear auto-assigned roles and assign specified roles
  user.roles.clear
  role_names.each do |role_name|
    role = Identity::Role.find_by(name: role_name)
    user.roles << role if role
  end
  user.save!

  # Create employee profile
  employee = Hr::Employee.create!(
    user: user,
    organization: organization,
    employee_number: attrs[:employee_number],
    job_title: attrs[:title],
    department: attrs[:department],
    hire_date: attrs[:hire_date] || 2.years.ago.to_date,
    employment_status: Hr::Employee::STATUS_ACTIVE,
    employment_type: Hr::Employee::TYPE_FULL_TIME,
    vacation_balance_days: attrs[:vacation_days] || 15.0,
    vacation_accrued_ytd: 15.0,
    vacation_used_ytd: 0.0,
    sick_leave_balance_days: 10.0,
    supervisor: supervisor
  )

  puts "    ✓ Created: #{user.email} (#{role_names.join(', ')})"
  { user: user, employee: employee }
end

puts "  Creating users..."

# ============================================
# 1. ADMIN USER
# ============================================
admin = create_user_with_employee(
  {
    email: "admin@valkyria.com",
    password: SEED_PASSWORD,
    first_name: "Carlos",
    last_name: "Administrador",
    department: "IT",
    title: "System Administrator",
    employee_number: "EMP001",
    vacation_days: 20.0
  },
  organization,
  [Identity::Role::ADMIN]
)

# ============================================
# 2. HR MANAGER
# ============================================
hr_manager = create_user_with_employee(
  {
    email: "hr.manager@valkyria.com",
    password: SEED_PASSWORD,
    first_name: "María",
    last_name: "García",
    department: "Human Resources",
    title: "HR Manager",
    employee_number: "EMP002",
    vacation_days: 18.0
  },
  organization,
  [Identity::Role::HR]
)

# ============================================
# 3. HR STAFF
# ============================================
hr_staff = create_user_with_employee(
  {
    email: "hr.staff@valkyria.com",
    password: SEED_PASSWORD,
    first_name: "Ana",
    last_name: "López",
    department: "Human Resources",
    title: "HR Specialist",
    employee_number: "EMP003",
    vacation_days: 15.0
  },
  organization,
  [Identity::Role::HR],
  supervisor: hr_manager[:employee]
)

# ============================================
# 4. SUPERVISOR (with subordinates)
# ============================================
supervisor = create_user_with_employee(
  {
    email: "supervisor@valkyria.com",
    password: SEED_PASSWORD,
    first_name: "Roberto",
    last_name: "Martínez",
    department: "Engineering",
    title: "Engineering Manager",
    employee_number: "EMP004",
    vacation_days: 18.0
  },
  organization,
  [Identity::Role::EMPLOYEE]
)

# ============================================
# 5. REGULAR EMPLOYEES (under supervisor)
# ============================================
employee1 = create_user_with_employee(
  {
    email: "employee1@valkyria.com",
    password: SEED_PASSWORD,
    first_name: "Juan",
    last_name: "Pérez",
    department: "Engineering",
    title: "Software Developer",
    employee_number: "EMP005",
    vacation_days: 15.0
  },
  organization,
  [Identity::Role::EMPLOYEE],
  supervisor: supervisor[:employee]
)

employee2 = create_user_with_employee(
  {
    email: "employee2@valkyria.com",
    password: SEED_PASSWORD,
    first_name: "Laura",
    last_name: "Sánchez",
    department: "Engineering",
    title: "QA Engineer",
    employee_number: "EMP006",
    vacation_days: 12.0
  },
  organization,
  [Identity::Role::EMPLOYEE],
  supervisor: supervisor[:employee]
)

employee3 = create_user_with_employee(
  {
    email: "employee3@valkyria.com",
    password: SEED_PASSWORD,
    first_name: "Pedro",
    last_name: "Ramírez",
    department: "Engineering",
    title: "DevOps Engineer",
    employee_number: "EMP007",
    vacation_days: 10.0
  },
  organization,
  [Identity::Role::EMPLOYEE],
  supervisor: supervisor[:employee]
)

# ============================================
# 6. LEGAL USER
# ============================================
legal = create_user_with_employee(
  {
    email: "legal@valkyria.com",
    password: SEED_PASSWORD,
    first_name: "Fernando",
    last_name: "Abogado",
    department: "Legal",
    title: "Legal Counsel",
    employee_number: "EMP008",
    vacation_days: 20.0
  },
  organization,
  [Identity::Role::LEGAL]
)

# ============================================
# 7. VIEWER (read-only)
# ============================================
viewer = create_user_with_employee(
  {
    email: "viewer@valkyria.com",
    password: SEED_PASSWORD,
    first_name: "Visitante",
    last_name: "Externo",
    department: "External",
    title: "External Auditor",
    employee_number: "EMP009",
    vacation_days: 0.0
  },
  organization,
  [Identity::Role::VIEWER]
)

# ============================================
# Create sample vacation requests
# ============================================
puts "  Creating sample vacation requests..."

# Pending request from employee1 (waiting for supervisor approval)
Hr::VacationRequest.create!(
  employee: employee1[:employee],
  organization: organization,
  vacation_type: Hr::VacationRequest::TYPE_VACATION,
  start_date: 2.weeks.from_now.to_date,
  end_date: 2.weeks.from_now.to_date + 5.days,
  days_requested: 5,
  reason: "Vacaciones familiares planificadas",
  status: Hr::VacationRequest::STATUS_PENDING,
  submitted_at: 1.day.ago
)
puts "    ✓ Created pending vacation request for #{employee1[:user].email}"

# Pending request from employee2
Hr::VacationRequest.create!(
  employee: employee2[:employee],
  organization: organization,
  vacation_type: Hr::VacationRequest::TYPE_PERSONAL,
  start_date: 1.month.from_now.to_date,
  end_date: 1.month.from_now.to_date + 2.days,
  days_requested: 3,
  reason: "Asuntos personales",
  status: Hr::VacationRequest::STATUS_PENDING,
  submitted_at: 2.days.ago
)
puts "    ✓ Created pending vacation request for #{employee2[:user].email}"

# Approved request from employee3 (past dates allowed for approved)
Hr::VacationRequest.create!(
  employee: employee3[:employee],
  organization: organization,
  vacation_type: Hr::VacationRequest::TYPE_VACATION,
  start_date: 2.weeks.from_now.to_date,
  end_date: 2.weeks.from_now.to_date + 4.days,
  days_requested: 5,
  reason: "Descanso programado",
  status: Hr::VacationRequest::STATUS_APPROVED,
  decided_at: 1.week.ago,
  approved_by_name: supervisor[:user].full_name
)
puts "    ✓ Created approved vacation request for #{employee3[:user].email}"

# ============================================
# Create sample certification requests
# ============================================
puts "  Creating sample certification requests..."

# Pending certification request from employee1 - Basic employment for bank
Hr::EmploymentCertificationRequest.create!(
  employee: employee1[:employee],
  organization: organization,
  certification_type: Hr::EmploymentCertificationRequest::TYPE_EMPLOYMENT,
  purpose: Hr::EmploymentCertificationRequest::PURPOSE_BANK,
  purpose_details: "Solicitud de crédito de vivienda",
  addressee: "Banco Davivienda",
  language: "es",
  delivery_method: "digital",
  include_salary: false,
  include_position: true,
  include_start_date: true,
  include_department: false,
  status: Hr::EmploymentCertificationRequest::STATUS_PENDING,
  submitted_at: 2.days.ago
)
puts "    ✓ Created pending certification request for #{employee1[:user].email} (Banco)"

# Processing certification request from employee2 - Salary certificate for visa
cert_processing = Hr::EmploymentCertificationRequest.create!(
  employee: employee2[:employee],
  organization: organization,
  certification_type: Hr::EmploymentCertificationRequest::TYPE_SALARY,
  purpose: Hr::EmploymentCertificationRequest::PURPOSE_VISA,
  purpose_details: "Visa de turismo Estados Unidos",
  addressee: "Embajada de Estados Unidos",
  language: "en",
  delivery_method: "both",
  include_salary: true,
  include_position: true,
  include_start_date: true,
  include_department: true,
  status: Hr::EmploymentCertificationRequest::STATUS_PROCESSING,
  submitted_at: 5.days.ago,
  processed_at: 2.days.ago,
  processed_by: hr_staff[:employee]
)
puts "    ✓ Created processing certification request for #{employee2[:user].email} (Visa)"

# Completed certification from employee3 - Full certification for rental
Hr::EmploymentCertificationRequest.create!(
  employee: employee3[:employee],
  organization: organization,
  certification_type: Hr::EmploymentCertificationRequest::TYPE_FULL,
  purpose: Hr::EmploymentCertificationRequest::PURPOSE_RENTAL,
  purpose_details: "Arrendamiento apartamento en Bogotá",
  addressee: "Inmobiliaria Coninsa Ramón H.",
  language: "es",
  delivery_method: "digital",
  include_salary: true,
  include_position: true,
  include_start_date: true,
  include_department: true,
  status: Hr::EmploymentCertificationRequest::STATUS_COMPLETED,
  submitted_at: 2.weeks.ago,
  processed_at: 12.days.ago,
  completed_at: 10.days.ago,
  processed_by: hr_manager[:employee],
  document_uuid: SecureRandom.uuid
)
puts "    ✓ Created completed certification request for #{employee3[:user].email} (Arrendamiento)"

# Pending certification from supervisor - Position certificate for legal
Hr::EmploymentCertificationRequest.create!(
  employee: supervisor[:employee],
  organization: organization,
  certification_type: Hr::EmploymentCertificationRequest::TYPE_POSITION,
  purpose: Hr::EmploymentCertificationRequest::PURPOSE_LEGAL,
  purpose_details: "Proceso de sucesión",
  addressee: "Juzgado 12 Civil del Circuito",
  language: "es",
  delivery_method: "physical",
  include_salary: false,
  include_position: true,
  include_start_date: true,
  include_department: true,
  special_instructions: "Se requiere sello húmedo y firma autógrafa",
  status: Hr::EmploymentCertificationRequest::STATUS_PENDING,
  submitted_at: 1.day.ago
)
puts "    ✓ Created pending certification request for #{supervisor[:user].email} (Legal)"

# Rejected certification from employee1 - Custom certificate (incomplete info)
Hr::EmploymentCertificationRequest.create!(
  employee: employee1[:employee],
  organization: organization,
  certification_type: Hr::EmploymentCertificationRequest::TYPE_CUSTOM,
  purpose: Hr::EmploymentCertificationRequest::PURPOSE_GOVERNMENT,
  purpose_details: "Trámite en DIAN",
  addressee: "DIAN - Dirección de Impuestos",
  language: "es",
  delivery_method: "digital",
  include_salary: false,
  include_position: true,
  include_start_date: true,
  include_department: false,
  special_instructions: "Incluir información de retención en la fuente",
  status: Hr::EmploymentCertificationRequest::STATUS_REJECTED,
  submitted_at: 1.month.ago,
  processed_at: 3.weeks.ago,
  completed_at: 3.weeks.ago,
  processed_by: hr_staff[:employee],
  rejection_reason: "La información solicitada de retención en la fuente debe tramitarse a través del área de Contabilidad, no de Recursos Humanos."
)
puts "    ✓ Created rejected certification request for #{employee1[:user].email} (Gobierno)"

# Pending certification from legal user - Bank certificate
Hr::EmploymentCertificationRequest.create!(
  employee: legal[:employee],
  organization: organization,
  certification_type: Hr::EmploymentCertificationRequest::TYPE_SALARY,
  purpose: Hr::EmploymentCertificationRequest::PURPOSE_BANK,
  purpose_details: "Solicitud tarjeta de crédito",
  addressee: "Banco de Bogotá",
  language: "es",
  delivery_method: "digital",
  include_salary: true,
  include_position: true,
  include_start_date: true,
  include_department: false,
  status: Hr::EmploymentCertificationRequest::STATUS_PENDING,
  submitted_at: 3.hours.ago
)
puts "    ✓ Created pending certification request for #{legal[:user].email} (Banco)"

puts ""
puts "=" * 60
puts "✅ SEED DATA CREATED SUCCESSFULLY"
puts "=" * 60
puts ""
puts "📋 TEST USERS CREDENTIALS:"
puts "-" * 60
puts "   Password (all users): #{SEED_PASSWORD}"
puts ""
puts "🔑 ADMIN:       admin@valkyria.com"
puts "👔 HR MANAGER:  hr.manager@valkyria.com"
puts "👥 HR STAFF:    hr.staff@valkyria.com"
puts "🏢 SUPERVISOR:  supervisor@valkyria.com"
puts "👤 EMPLOYEE 1:  employee1@valkyria.com"
puts "👤 EMPLOYEE 2:  employee2@valkyria.com"
puts "👤 EMPLOYEE 3:  employee3@valkyria.com"
puts "⚖️  LEGAL:       legal@valkyria.com"
puts "👁️  VIEWER:      viewer@valkyria.com"
puts ""
puts "=" * 60
