# frozen_string_literal: true

require "spec_helper"

RSpec.describe Foaf::LedgerSigner do
  it "emits an Ethereum personal-signature recoverable by the FOAF verifier" do
    key = Eth::Key.new
    payload = JSON.generate(
      network_address: "0xnetwork",
      from_address: key.address.to_s,
      to_address: Eth::Key.new.address.to_s,
      value: "4.25"
    )

    signature = described_class.sign!(key.private_hex, payload)
    recovered_public_key = Eth::Signature.personal_recover(payload, signature)
    recovered_address = Eth::Util.public_key_to_address(
      Eth::Util.hex_to_bin(recovered_public_key)
    ).to_s

    expect(recovered_address.downcase).to eq(key.address.to_s.downcase)
    expect(described_class.address(key.private_hex)).to eq(key.address.to_s.downcase)
  end
end
