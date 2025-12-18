# frozen_string_literal: true

RSpec.shared_examples "an auditable model" do
  it { is_expected.to have_field(:created_by_id).of_type(BSON::ObjectId) }
  it { is_expected.to have_field(:updated_by_id).of_type(BSON::ObjectId) }

  describe "audit tracking" do
    it "tracks creation user" do
      expect(subject).to respond_to(:created_by)
      expect(subject).to respond_to(:created_by=)
    end

    it "tracks update user" do
      expect(subject).to respond_to(:updated_by)
      expect(subject).to respond_to(:updated_by=)
    end
  end
end

RSpec.shared_examples "a soft deletable model" do
  it { is_expected.to have_field(:deleted_at).of_type(Time) }
  it { is_expected.to have_field(:deleted_by_id).of_type(BSON::ObjectId) }

  describe "soft delete behavior" do
    it "responds to soft_delete" do
      expect(subject).to respond_to(:soft_delete)
    end

    it "responds to restore" do
      expect(subject).to respond_to(:restore)
    end

    it "responds to deleted?" do
      expect(subject).to respond_to(:deleted?)
    end
  end
end

RSpec.shared_examples "a timestamped model" do
  it { is_expected.to have_field(:created_at).of_type(Time) }
  it { is_expected.to have_field(:updated_at).of_type(Time) }
end

RSpec.shared_examples "a successful JSON response" do
  it "returns success status" do
    expect(response).to have_http_status(:ok)
  end

  it "returns JSON content type" do
    expect(response.content_type).to include("application/json")
  end
end

RSpec.shared_examples "an unauthorized request" do
  it "returns unauthorized status" do
    expect(response).to have_http_status(:unauthorized)
  end
end

RSpec.shared_examples "a forbidden request" do
  it "returns forbidden status" do
    expect(response).to have_http_status(:forbidden)
  end
end

RSpec.shared_examples "a not found request" do
  it "returns not found status" do
    expect(response).to have_http_status(:not_found)
  end
end
