# frozen_string_literal: true

require "spec_helper"

RSpec.describe Foaf::Balances do
  it "converts a raw FOAF row into viewer perspective without losing precision" do
    fixture = JSON.parse(
      File.read(File.expand_path("../../../contracts/viewer-balance.json", __dir__))
    )

    result = described_class.from_trustline_row(fixture.fetch("foaf"))

    expect(result[:viewer_balance]).to eq(
      BigDecimal(fixture.dig("viewer", "viewer_balance"))
    )
    expect(result[:my_credit_limit]).to eq(
      BigDecimal(fixture.dig("viewer", "my_credit_limit"))
    )
    expect(result[:their_credit_limit]).to eq(
      BigDecimal(fixture.dig("viewer", "their_credit_limit"))
    )
  end
end
