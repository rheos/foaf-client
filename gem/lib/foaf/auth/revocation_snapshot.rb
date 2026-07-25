# frozen_string_literal: true

require "json"
require "set"
require "time"
require "uri"

module Foaf
  module Auth
    class RevocationSnapshot
      attr_reader :audience, :fetched_at, :generated_at

      def initialize(payload, fetched_at:)
        @audience = payload.fetch("audience").to_s
        @generated_at = Time.iso8601(payload.fetch("generated_at").to_s)
        @fetched_at = fetched_at
        @revoked_kids = Set.new(
          Array(payload["revoked_kids"]).filter_map do |row|
            value = row["kid"].to_s
            value unless value.empty?
          end
        )
        @tokens_invalid_before = (payload["tokens_invalid_before"] || {}).each_with_object({}) do |(id, value), out|
          out[id.to_s] = Time.iso8601(value.to_s)
        end
        @revoked_jtis = Array(payload["revoked_jtis"]).each_with_object({}) do |row, out|
          out[row["jti"].to_s] = Time.iso8601(row["exp"].to_s)
        end
      end

      def revoked_kid?(kid)
        @revoked_kids.include?(kid.to_s)
      end

      def cutoff_for(foaf_id)
        @tokens_invalid_before[foaf_id.to_s]
      end

      def revoked_jti?(jti, now:)
        expires_at = @revoked_jtis[jti.to_s]
        expires_at && expires_at > now
      end
    end

    class RevocationCache
      def initialize(url:, audience:, service_token:, http_get:, ttl:,
                     stale_alert_after:, clock:, logger: nil)
        @url = url
        @audience = audience
        @service_token = service_token.to_s
        @http_get = http_get
        @ttl = ttl
        @stale_alert_after = stale_alert_after
        @clock = clock
        @logger = logger
        @snapshot = nil
        @mutex = Mutex.new
      end

      def current(request_id: nil)
        now = @clock.call
        if @snapshot && @snapshot.audience == @audience &&
           now - @snapshot.fetched_at < @ttl
          return @snapshot
        end

        refresh!(request_id: request_id)
      rescue FetchError => e
        if @snapshot && @snapshot.audience == @audience
          if now - @snapshot.generated_at > @stale_alert_after
            @logger&.error("[foaf-client auth] revocation snapshot stale: #{e.message}")
          end
          return @snapshot
        end

        @logger&.warn("[foaf-client auth] no revocation snapshot available: #{e.message}")
        nil
      end

      def refresh!(request_id: nil)
        @mutex.synchronize do
          headers = { "Accept" => "application/json" }
          headers["Authorization"] = "Bearer #{@service_token}" unless @service_token.empty?
          headers["X-Request-ID"] = request_id if request_id
          payload = JSON.parse(@http_get.call(snapshot_url, headers))
          snapshot = RevocationSnapshot.new(payload, fetched_at: @clock.call)
          unless snapshot.audience == @audience
            raise FetchError, "revocation snapshot audience mismatch"
          end
          @snapshot = snapshot
        end
      rescue FetchError
        raise
      rescue StandardError => e
        raise FetchError, e.message
      end

      private

      def snapshot_url
        uri = URI.parse(@url)
        params = URI.decode_www_form(uri.query.to_s)
        params.reject! { |key, _| key == "audience" }
        params << ["audience", @audience]
        uri.query = URI.encode_www_form(params)
        uri.to_s
      end
    end
  end
end

