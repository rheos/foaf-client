# frozen_string_literal: true

require "json"
require "jwt"
require "thread"

module Foaf
  module Auth
    class JwksCache
      def initialize(url:, http_get:, ttl:, last_good_max_age:, negative_ttl:,
                     clock:, logger: nil)
        @url = url
        @http_get = http_get
        @ttl = ttl
        @last_good_max_age = last_good_max_age
        @negative_ttl = negative_ttl
        @clock = clock
        @logger = logger
        @keys = {}
        @negative = {}
        @mutex = Mutex.new
      end

      def public_key_for(kid, request_id: nil)
        now = @clock.call
        normalized = kid.to_s
        raise UnknownKidError, "kid is required" if normalized.empty?
        if @negative[normalized] && @negative[normalized] > now
          raise UnknownKidError, "kid #{normalized.inspect} is negative-cached"
        end

        entry = @keys[normalized]
        return entry[:key] if entry && now - entry[:fetched_at] < @ttl

        begin
          refresh!(request_id: request_id)
        rescue FetchError
          entry = @keys[normalized]
          if entry && now - entry[:fetched_at] <= @last_good_max_age
            @logger&.warn("[foaf-client auth] using last-good JWKS for kid=#{normalized}")
            return entry[:key]
          end
          raise
        end

        entry = @keys[normalized]
        return entry[:key] if entry

        @negative[normalized] = now + @negative_ttl
        raise UnknownKidError, "kid #{normalized.inspect} is unknown"
      end

      def refresh!(request_id: nil)
        @mutex.synchronize do
          headers = { "Accept" => "application/json" }
          headers["X-Request-ID"] = request_id if request_id
          payload = JSON.parse(@http_get.call(@url, headers))
          jwks = payload.fetch("keys")
          raise FetchError, "JWKS keys must be an array" unless jwks.is_a?(Array)

          fetched_at = @clock.call
          @keys = jwks.each_with_object({}) do |jwk, out|
            kid = jwk["kid"].to_s
            next if kid.empty?

            out[kid] = {
              key: JWT::JWK.import(jwk).public_key,
              fetched_at: fetched_at
            }
          end
          @negative = {}
          @keys
        end
      rescue FetchError
        raise
      rescue StandardError => e
        raise FetchError, e.message
      end
    end
  end
end

