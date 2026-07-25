# frozen_string_literal: true

require "spec_helper"

RSpec.describe "FOAF Ruby wire-signature contract" do
  before do
    skip "set INTEGRATION=1 to run against a live FOAF service" unless ENV["INTEGRATION"] == "1"
    unless ENV["FOAF_SIGNATURE_ENFORCEMENT"] == "true"
      skip "set FOAF signature_enforcement=true and FOAF_SIGNATURE_ENFORCEMENT=true"
    end
  end

  it "settles a signed transfer while signature enforcement is enabled" do
    base_url = ENV.fetch("FOAF_API_URL", "http://host.docker.internal:3002")
    network_address = ENV.fetch("FOAF_NETWORK_ADDRESS")
    private_keys = {}
    client = Foaf::LedgerClient.new(
      base_url: base_url,
      signature_provider: lambda do |address, payload|
        Foaf::LedgerSigner.sign!(private_keys.fetch(address.downcase), payload)
      end
    )

    lender = client.generate_keypair
    borrower = client.generate_keypair
    private_keys[lender.fetch("address").downcase] = lender.fetch("privateKey")
    private_keys[borrower.fetch("address").downcase] = borrower.fetch("privateKey")

    expect(
      client.update_trustline(
        network_address: network_address,
        creditor_address: lender.fetch("address"),
        debtor_address: borrower.fetch("address"),
        creditline_given: "100",
        creditline_received: "0"
      )
    ).to include("ok" => true)
    expect(
      client.update_trustline(
        network_address: network_address,
        creditor_address: borrower.fetch("address"),
        debtor_address: lender.fetch("address"),
        creditline_given: "0",
        creditline_received: "100"
      )
    ).to include("ok" => true)

    pending = client.create_pending_transfer(
      network_address: network_address,
      from_address: borrower.fetch("address"),
      to_address: lender.fetch("address"),
      value: "1.25",
      extra_data: { contract: "foaf-client-ruby" }
    )
    expect(pending["ok"]).to be(true)

    confirmed = client.confirm_transfer(
      pending_transfer_id: pending.dig("data", "id"),
      signer_address: lender.fetch("address")
    )
    expect(confirmed).to include("ok" => true)
    expect(confirmed.dig("data", "operation")).not_to be_nil
  end
end
