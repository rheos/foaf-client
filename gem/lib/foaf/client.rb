# frozen_string_literal: true

require "bigdecimal"
require "json"
require "uri"

module Foaf
  # Namespace-stable implementation: several Rails consumers already own
  # `Foaf::Client`, so the package never claims that application constant.
  class LedgerClient
    def initialize(base_url: nil, config: nil, signature_provider: nil,
                   http_adapter: nil, logger: nil, open_timeout: 2, read_timeout: 5)
      resolved = config || (base_url && ClientConfig.new(base_url: base_url))
      raise ArgumentError, "base_url or config is required" unless resolved

      @base_url = resolved.base_url
      @signature_provider = signature_provider
      @http = http_adapter || NetHttpAdapter.new(
        open_timeout: open_timeout,
        read_timeout: read_timeout
      )
      @logger = logger
    end

    def generate_keypair
      read_request(:post, "/api/v1/keypair", {})
    end

    def networks
      read_request(:get, "/api/v1/networks")
    end

    def network(network_address:)
      read_request(:get, "/api/v1/networks/#{segment(network_address)}")
    end

    def update_trustline(network_address:, creditor_address:, debtor_address:,
                         creditline_given:, creditline_received:)
      strict_request(
        :post,
        "/api/v1/networks/#{segment(network_address)}/trustlines/update",
        {
          creditor_address: creditor_address,
          debtor_address: debtor_address,
          creditline_given: creditline_given,
          creditline_received: creditline_received
        },
        signer_address: creditor_address
      )
    end

    def user_trustlines(network_address:, user_address:)
      read_request(
        :get,
        "/api/v1/networks/#{segment(network_address)}/users/#{segment(user_address)}/trustlines"
      )
    end

    def max_capacity_path_info(network_address:, from_address:, to_address:)
      read_request(
        :post,
        "/api/v1/networks/#{segment(network_address)}/max-capacity-path-info",
        {
          address: network_address,
          from: from_address,
          to: to_address
        }
      )
    end

    def create_pending_transfer(network_address:, from_address:, to_address:,
                                value:, extra_data: nil, max_fee: nil,
                                fee_payer: nil, path: nil, idempotency_key: nil)
      body = {
        network_address: network_address,
        from_address: from_address,
        to_address: to_address,
        value: value,
        extra_data: extra_data
      }
      body[:max_fee] = max_fee unless max_fee.nil?
      body[:fee_payer] = fee_payer unless fee_payer.nil?
      body[:path] = path unless path.nil?
      body[:idempotency_key] = idempotency_key unless idempotency_key.nil?

      strict_request(
        :post,
        "/api/v1/pending_transfers",
        body,
        signer_address: from_address
      )
    end

    def pending_transfer(pending_transfer_id:)
      strict_request(
        :get,
        "/api/v1/pending_transfers/#{segment(pending_transfer_id)}",
        nil
      )
    end

    def pending_transfer_by_idempotency_key(idempotency_key:)
      strict_request(
        :get,
        "/api/v1/pending_transfers/by_idempotency_key",
        nil,
        params: { idempotency_key: idempotency_key }
      )
    end

    def confirm_transfer(pending_transfer_id:, signer_address: nil)
      strict_request(
        :put,
        "/api/v1/pending_transfers/#{segment(pending_transfer_id)}/confirm",
        {},
        signer_address: signer_address
      )
    end

    def reject_transfer(pending_transfer_id:, signer_address: nil, reason: nil)
      strict_request(
        :put,
        "/api/v1/pending_transfers/#{segment(pending_transfer_id)}/reject",
        reason.nil? ? {} : { reason: reason },
        signer_address: signer_address
      )
    end

    def user_events(network_address:, user_address:, type: nil)
      params = {}
      params[:type] = type if type
      read_request(
        :get,
        "/api/v1/networks/#{segment(network_address)}/users/#{segment(user_address)}/events",
        nil,
        params: params
      )
    end

    def trustline_events(network_address:, user_address:, counter_party_address:, type: nil)
      params = {}
      params[:type] = type if type
      read_request(
        :get,
        "/api/v1/networks/#{segment(network_address)}/users/#{segment(user_address)}/trustlines/" \
          "#{segment(counter_party_address)}/events",
        nil,
        params: params
      )
    end

    def operations(network_address:, limit: 20, type: nil, since_id: nil,
                   before_id: nil, actor_address: nil)
      params = { limit: limit }
      params[:type] = type if type
      params[:since_id] = since_id if since_id
      params[:before_id] = before_id if before_id
      params[:actor_address] = actor_address if actor_address
      read_request(
        :get,
        "/api/v1/networks/#{segment(network_address)}/operations",
        nil,
        params: params
      )
    end

    def operation(operation_id:)
      read_request(:get, "/api/v1/operations/#{segment(operation_id)}")
    end

    private

    def read_request(method, path, body = nil, params: {}, signer_address: nil)
      response = perform(
        method,
        path,
        body,
        params: params,
        signer_address: signer_address
      )
      return nil unless success?(response.status)

      parse_body(response.body)
    rescue StandardError => e
      log("#{method.to_s.upcase} #{path}", e)
      nil
    end

    def strict_request(method, path, body, params: {}, signer_address: nil)
      response = perform(
        method,
        path,
        body,
        params: params,
        signer_address: signer_address
      )
      if success?(response.status)
        {
          "ok" => true,
          "status" => response.status,
          "body" => response.body,
          "data" => parse_body(response.body)
        }
      else
        {
          "ok" => false,
          "status" => response.status,
          "body" => response.body,
          "error" => response.body
        }
      end
    rescue StandardError => e
      log("#{method.to_s.upcase}(strict) #{path}", e)
      { "ok" => false, "status" => 0, "body" => nil, "error" => e.message }
    end

    def perform(method, path, body, params: {}, signer_address: nil)
      uri = URI.parse("#{@base_url}#{path}")
      uri.query = URI.encode_www_form(params) unless params.empty?

      payload = body.nil? ? nil : JSON.generate(normalize_json(body))
      headers = { "Accept" => "application/json" }
      if payload
        headers["Content-Type"] = "application/json"
        signature = signature_for(signer_address, payload)
        headers["X-Signature"] = signature if signature
      end

      @http.request(method: method, uri: uri, headers: headers, body: payload)
    end

    def signature_for(address, payload)
      return nil unless @signature_provider && address

      @signature_provider.call(address, payload)
    end

    def normalize_json(value)
      case value
      when BigDecimal
        value.to_s("F")
      when Hash
        value.each_with_object({}) { |(key, item), out| out[key] = normalize_json(item) }
      when Array
        value.map { |item| normalize_json(item) }
      else
        value
      end
    end

    def parse_body(body)
      JSON.parse(body)
    rescue JSON::ParserError
      body
    end

    def success?(status)
      status.to_i >= 200 && status.to_i < 300
    end

    def segment(value)
      URI.encode_www_form_component(value.to_s)
    end

    def log(operation, error)
      @logger&.warn("[foaf-client] #{operation} failed: #{error.message}")
    end
  end

end
