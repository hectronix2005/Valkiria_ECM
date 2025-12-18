# frozen_string_literal: true

FactoryBot.define do
  factory :document_version, class: "Content::DocumentVersion" do
    association :document, factory: :content_document
    file_name { Faker::File.file_name(dir: nil, ext: "pdf").to_s }
    content_type { "application/pdf" }
    file_size { rand(1000..1_000_000) }
    content { Faker::Lorem.paragraphs(number: 5).join("\n\n") }
    change_summary { Faker::Lorem.sentence }

    trait :with_creator do
      created_by { association :user }
    end

    trait :text do
      file_name { "document.txt" }
      content_type { "text/plain" }
    end

    trait :pdf do
      file_name { "document.pdf" }
      content_type { "application/pdf" }
    end

    trait :word do
      file_name { "document.docx" }
      content_type { "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
    end

    trait :empty do
      content { "" }
      file_size { 0 }
    end
  end
end
