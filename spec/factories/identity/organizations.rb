# frozen_string_literal: true

FactoryBot.define do
  factory :organization, class: "Identity::Organization" do
    name { Faker::Company.name }
    slug { name.parameterize }
    active { true }
    settings { {} }

    trait :inactive do
      active { false }
    end
  end
end
