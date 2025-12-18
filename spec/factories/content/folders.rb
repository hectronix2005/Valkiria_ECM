# frozen_string_literal: true

FactoryBot.define do
  factory :content_folder, class: "Content::Folder" do
    sequence(:name) { |n| "Folder #{n}" }
    description { Faker::Lorem.sentence }

    trait :with_organization do
      organization { association :organization }
    end

    trait :with_creator do
      created_by { association :user }
    end

    trait :with_parent do
      parent { association :content_folder }
    end

    trait :nested do
      transient do
        depth { 3 }
      end

      after(:create) do |folder, evaluator|
        current = folder
        (evaluator.depth - 1).times do |i|
          current = create(:content_folder, parent: current, name: "Child #{i + 1}")
        end
      end
    end
  end
end
