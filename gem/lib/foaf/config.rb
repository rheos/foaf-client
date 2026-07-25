# frozen_string_literal: true

module Foaf
  class ClientConfig
    attr_reader :base_url, :network_address

    def initialize(base_url:, network_address: nil)
      value = base_url.to_s.strip
      raise ArgumentError, "base_url is required" if value.empty?

      @base_url = value.sub(%r{/+\z}, "")
      @network_address = network_address
    end

    def self.from_env(api_url_key:, network_address_key: nil, default_base_url: nil)
      base_url = if default_base_url
        ENV.fetch(api_url_key, default_base_url)
      else
        ENV.fetch(api_url_key)
      end
      network_address = network_address_key ? ENV.fetch(network_address_key) : nil
      new(base_url: base_url, network_address: network_address)
    end
  end
end
