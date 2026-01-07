# frozen_string_literal: true

module Api
  module V1
    module Legal
      class DashboardController < BaseController
        # GET /api/v1/legal/dashboard
        def show
          render json: {
            data: {
              third_parties: third_party_stats,
              contracts: contract_stats,
              approvals: approval_stats,
              expiring_soon: expiring_contracts
            }
          }
        end

        private

        def third_party_stats
          base = ::Legal::ThirdParty.where(organization_id: current_organization.id)

          {
            total: base.count,
            active: base.active.count,
            inactive: base.inactive.count,
            blocked: base.blocked.count,
            by_type: {
              providers: base.providers.count,
              clients: base.clients.count,
              contractors: base.contractors.count,
              partners: base.partners.count,
              other: base.where(third_party_type: "other").count
            }
          }
        end

        def contract_stats
          base = ::Legal::Contract.where(organization_id: current_organization.id)
          current_year = Time.current.year

          {
            total: base.count,
            draft: base.draft.count,
            pending_approval: base.pending_approval.count,
            approved: base.approved.count,
            active: base.active.count,
            expired: base.expired.count,
            rejected: base.rejected.count,
            by_type: ::Legal::Contract::TYPES.each_with_object({}) { |t, h|
              h[t] = base.by_type(t).count
            },
            created_this_year: base.where(:created_at.gte => Date.new(current_year, 1, 1)).count,
            total_value: {
              active: base.active.sum(:amount).to_f,
              pending: base.pending_approval.sum(:amount).to_f
            }
          }
        end

        def approval_stats
          base = ::Legal::Contract.where(organization_id: current_organization.id)

          pending = base.pending_approval.select { |c| c.can_approve?(current_user) }

          {
            pending_my_approval: pending.count,
            pending_total: base.pending_approval.count,
            by_level: {
              level_1: base.where(approval_level: "level_1", status: "pending_approval").count,
              level_2: base.where(approval_level: "level_2", status: "pending_approval").count,
              level_3: base.where(approval_level: "level_3", status: "pending_approval").count,
              level_4: base.where(approval_level: "level_4", status: "pending_approval").count
            }
          }
        end

        def expiring_contracts
          ::Legal::Contract
            .where(organization_id: current_organization.id)
            .active
            .where(:end_date.lte => Date.current + 30)
            .where(:end_date.gte => Date.current)
            .order(end_date: :asc)
            .limit(10)
            .map do |c|
              {
                id: c.uuid,
                contract_number: c.contract_number,
                title: c.title,
                third_party: c.third_party&.display_name,
                end_date: c.end_date,
                days_until_expiry: c.days_until_expiry,
                amount: c.amount.to_f
              }
            end
        end
      end
    end
  end
end
