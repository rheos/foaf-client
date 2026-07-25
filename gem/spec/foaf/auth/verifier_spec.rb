# frozen_string_literal: true

require "spec_helper"

RSpec.describe Foaf::Auth::Verifier do
  let(:issuer) { "auth.foaf.io" }
  let(:audience) { "test-app" }
  let(:kid) { "test-kid" }
  let(:rsa) { OpenSSL::PKey::RSA.generate(2048) }
  let(:now) { Time.now.utc }
  let(:headers_seen) { [] }
  let(:snapshot_overrides) { {} }
  let(:jwk_keys) { [jwk] }
  let(:http_get) do
    lambda do |url, headers|
      headers_seen << [url, headers]
      if url.include?("jwks")
        JSON.generate(keys: jwk_keys)
      else
        JSON.generate(snapshot_payload.merge(snapshot_overrides))
      end
    end
  end

  def base64url_uint(integer)
    Base64.urlsafe_encode64(integer.to_s(2), padding: false)
  end

  def jwk
    {
      "kty" => "RSA",
      "use" => "sig",
      "alg" => "RS256",
      "kid" => kid,
      "n" => base64url_uint(rsa.public_key.n),
      "e" => base64url_uint(rsa.public_key.e)
    }
  end

  def snapshot_payload
    {
      "generated_at" => now.iso8601,
      "audience" => audience,
      "revoked_jtis" => [],
      "tokens_invalid_before" => {},
      "revoked_kids" => []
    }
  end

  def token(overrides = {}, signing_key: rsa, signing_kid: kid)
    claims = {
      iss: issuer,
      aud: audience,
      sub: "foaf-id-1",
      iat: now.to_i,
      exp: (Time.now.utc + 3600).to_i,
      jti: "jti-1"
    }.merge(overrides)
    JWT.encode(claims, signing_key, "RS256", kid: signing_kid)
  end

  def verifier
    described_class.new(
      jwks_url: "https://auth.test/.well-known/jwks.json",
      issuer: issuer,
      audience: audience,
      revocations_url: "https://auth.test/v1/revocations/snapshot",
      service_token: "service-secret",
      http_get: http_get,
      clock: -> { now }
    )
  end

  it "verifies issuer, audience, signature, and sends the service Bearer" do
    claims = verifier.verify("Bearer #{token}", request_id: "request-1")

    expect(claims["sub"]).to eq("foaf-id-1")
    snapshot_request = headers_seen.find { |url, _| url.include?("revocations") }
    expect(snapshot_request.first).to include("audience=test-app")
    expect(snapshot_request.last["Authorization"]).to eq("Bearer service-secret")
    expect(headers_seen.all? { |_, headers| headers["X-Request-ID"] == "request-1" }).to be(true)
  end

  it "rejects non-RS256 tokens" do
    stale = JWT.encode(
      { sub: "foaf-id-1", exp: (Time.now.utc + 3600).to_i },
      "secret",
      "HS256"
    )

    expect { verifier.verify(stale) }
      .to raise_error(Foaf::Auth::VerificationError, /only RS256/)
  end

  it "rejects revoked signing keys" do
    snapshot_overrides["revoked_kids"] = [{ "kid" => kid, "retired_at" => now.iso8601 }]

    expect { verifier.verify(token) }
      .to raise_error(Foaf::Auth::RevokedTokenError, /signing key/)
  end

  it "rejects identity cutoffs and revoked JTIs" do
    snapshot_overrides["tokens_invalid_before"] = {
      "foaf-id-1" => (now + 10).iso8601
    }
    expect { verifier.verify(token) }
      .to raise_error(Foaf::Auth::RevokedTokenError, /identity cutoff/)

    snapshot_overrides.delete("tokens_invalid_before")
    snapshot_overrides["revoked_jtis"] = [
      { "jti" => "jti-1", "exp" => (now + 3600).iso8601 }
    ]
    expect { verifier.verify(token) }
      .to raise_error(Foaf::Auth::RevokedTokenError, /has been revoked/)
  end

  it "fails closed for an unknown kid" do
    jwk_keys.clear

    expect { verifier.verify(token) }
      .to raise_error(Foaf::Auth::UnknownKidError, /unknown/)
  end
end

