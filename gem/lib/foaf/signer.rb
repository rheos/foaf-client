# frozen_string_literal: true

require "eth"

module Foaf
  module LedgerSigner
    module_function

    # FOAF verifies writes with Eth::Signature.personal_recover, so the SDK
    # must emit an Ethereum personal_sign signature rather than ASN.1 ECDSA.
    def sign(private_key_hex, payload)
      return nil if private_key_hex.to_s.strip.empty?

      sign!(private_key_hex, payload)
    rescue StandardError
      nil
    end

    def sign!(private_key_hex, payload)
      Eth::Key.new(priv: normalize_private_key(private_key_hex)).personal_sign(payload.to_s)
    end

    def address(private_key_hex)
      Eth::Key.new(priv: normalize_private_key(private_key_hex)).address.to_s.downcase
    end

    def normalize_private_key(private_key_hex)
      private_key_hex.to_s.sub(/\A0x/i, "")
    end
    private_class_method :normalize_private_key
  end
end
