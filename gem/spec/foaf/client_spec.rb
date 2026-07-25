# frozen_string_literal: true

require "spec_helper"

RSpec.describe Foaf::LedgerClient do
  class RecordingAdapter
    attr_reader :requests

    def initialize(*responses)
      @responses = responses
      @requests = []
    end

    def request(**request)
      @requests << request
      @responses.shift || Foaf::HttpResponse.new(status: 200, body: "{}")
    end
  end

  let(:base_url) { "https://api.foaf.test" }

  it "sends the upstream address workaround for max capacity" do
    adapter = RecordingAdapter.new(
      Foaf::HttpResponse.new(status: 200, body: '{"capacity":"12","path":[]}')
    )
    client = described_class.new(base_url: base_url, http_adapter: adapter)

    result = client.max_capacity_path_info(
      network_address: "0x0000000000000000000000000000000000000001",
      from_address: "0x0000000000000000000000000000000000000002",
      to_address: "0x0000000000000000000000000000000000000003"
    )
    expected = JSON.parse(
      File.read(File.expand_path("../../../contracts/max-capacity-path-info.request.json", __dir__))
    )

    expect(result["capacity"]).to eq("12")
    expect(JSON.parse(adapter.requests.first.fetch(:body))).to eq(expected)
  end

  it "signs the exact serialized body sent on the wire" do
    adapter = RecordingAdapter.new(
      Foaf::HttpResponse.new(status: 201, body: '{"id":"pending-1"}')
    )
    signed = nil
    client = described_class.new(
      base_url: base_url,
      http_adapter: adapter,
      signature_provider: lambda do |address, payload|
        signed = [address, payload]
        "0xsignature"
      end
    )

    result = client.create_pending_transfer(
      network_address: "0xnetwork",
      from_address: "0xsender",
      to_address: "0xreceiver",
      value: BigDecimal("6.80"),
      extra_data: { loan_id: "7" }
    )
    request = adapter.requests.first

    expect(result).to eq(
      "ok" => true,
      "status" => 201,
      "body" => '{"id":"pending-1"}',
      "data" => { "id" => "pending-1" }
    )
    expect(signed).to eq(["0xsender", request.fetch(:body)])
    expect(request.dig(:headers, "X-Signature")).to eq("0xsignature")
    expect(JSON.parse(request.fetch(:body)).fetch("value")).to eq("6.8")
  end

  it "preserves status and raw body for transfer failures" do
    adapter = RecordingAdapter.new(
      Foaf::HttpResponse.new(status: 422, body: '{"error":"InsufficientCapacity"}')
    )
    client = described_class.new(base_url: base_url, http_adapter: adapter)

    result = client.confirm_transfer(pending_transfer_id: "pending-1")

    expect(result).to eq(
      "ok" => false,
      "status" => 422,
      "body" => '{"error":"InsufficientCapacity"}',
      "error" => '{"error":"InsufficientCapacity"}'
    )
  end

  it "preserves status and raw body for trustline-update failures" do
    adapter = RecordingAdapter.new(
      Foaf::HttpResponse.new(status: 401, body: '{"error":"Invalid signature"}')
    )
    client = described_class.new(base_url: base_url, http_adapter: adapter)

    result = client.update_trustline(
      network_address: "0xnetwork",
      creditor_address: "0xcreditor",
      debtor_address: "0xdebtor",
      creditline_given: "10",
      creditline_received: "20"
    )

    expect(result).to eq(
      "ok" => false,
      "status" => 401,
      "body" => '{"error":"Invalid signature"}',
      "error" => '{"error":"Invalid signature"}'
    )
  end

  it "sends the create idempotency key in the signed wire body" do
    adapter = RecordingAdapter.new(
      Foaf::HttpResponse.new(status: 201, body: '{"id":"pending-1"}')
    )
    signed_payload = nil
    client = described_class.new(
      base_url: base_url,
      http_adapter: adapter,
      signature_provider: lambda do |_address, payload|
        signed_payload = payload
        "0xsignature"
      end
    )

    client.create_pending_transfer(
      network_address: "0xnetwork",
      from_address: "0xsender",
      to_address: "0xreceiver",
      value: "5",
      idempotency_key: "consumer:transfer:42"
    )

    expect(JSON.parse(signed_payload).fetch("idempotency_key")).to eq("consumer:transfer:42")
    expect(signed_payload).to eq(adapter.requests.first.fetch(:body))
  end

  it "preserves status and body on reconciliation reads" do
    adapter = RecordingAdapter.new(
      Foaf::HttpResponse.new(status: 404, body: '{"error":"not found"}'),
      Foaf::HttpResponse.new(status: 200, body: '{"id":9,"status":"confirmed"}')
    )
    client = described_class.new(base_url: base_url, http_adapter: adapter)

    missing = client.pending_transfer_by_idempotency_key(idempotency_key: "missing")
    found = client.pending_transfer(pending_transfer_id: 9)

    expect(missing).to include(
      "ok" => false,
      "status" => 404,
      "body" => '{"error":"not found"}'
    )
    expect(found).to include(
      "ok" => true,
      "status" => 200,
      "data" => include("id" => 9, "status" => "confirmed")
    )
    expect(adapter.requests.first.fetch(:body)).to be_nil
    expect(adapter.requests.first.fetch(:uri).query).to eq("idempotency_key=missing")
  end

  it "keeps reads nil-on-failure" do
    adapter = RecordingAdapter.new(
      Foaf::HttpResponse.new(status: 503, body: "down")
    )
    client = described_class.new(base_url: base_url, http_adapter: adapter)

    expect(client.networks).to be_nil
  end

  it "harvests the indexer read surface" do
    adapter = RecordingAdapter.new(
      Foaf::HttpResponse.new(status: 200, body: "[]"),
      Foaf::HttpResponse.new(status: 200, body: "[]"),
      Foaf::HttpResponse.new(status: 200, body: "[]"),
      Foaf::HttpResponse.new(status: 200, body: "{}")
    )
    client = described_class.new(base_url: base_url, http_adapter: adapter)

    expect(client.user_events(network_address: "net", user_address: "user")).to eq([])
    expect(
      client.trustline_events(
        network_address: "net",
        user_address: "user",
        counter_party_address: "other"
      )
    ).to eq([])
    expect(client.operations(network_address: "net")).to eq([])
    expect(client.operation(operation_id: "op")).to eq({})
  end
  it "does not claim an application's Foaf::Client constant" do
    expect(Foaf.const_defined?(:Client, false)).to be(false)
  end
end
