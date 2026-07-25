# frozen_string_literal: true

require "spec_helper"

RSpec.describe Foaf::ClientConfig do
  it "normalizes the base URL without choosing an app-specific ENV key" do
    config = described_class.new(
      base_url: "https://api.foaf.io/",
      network_address: "0xnetwork"
    )

    expect(config.base_url).to eq("https://api.foaf.io")
    expect(config.network_address).to eq("0xnetwork")
  end

  it "lets the consumer name its own ENV keys" do
    ENV["TEST_FOAF_URL"] = "http://foaf:3002"
    ENV["TEST_FOAF_NETWORK"] = "0xnetwork"

    config = described_class.from_env(
      api_url_key: "TEST_FOAF_URL",
      network_address_key: "TEST_FOAF_NETWORK"
    )

    expect(config.base_url).to eq("http://foaf:3002")
    expect(config.network_address).to eq("0xnetwork")
  ensure
    ENV.delete("TEST_FOAF_URL")
    ENV.delete("TEST_FOAF_NETWORK")
  end
end
