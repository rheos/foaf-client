# frozen_string_literal: true

require "net/http"
require "uri"

module Foaf
  HttpResponse = Struct.new(:status, :body, keyword_init: true)

  class NetHttpAdapter
    def initialize(open_timeout: 2, read_timeout: 5)
      @open_timeout = open_timeout
      @read_timeout = read_timeout
    end

    def request(method:, uri:, headers:, body: nil)
      request_class = {
        get: Net::HTTP::Get,
        post: Net::HTTP::Post,
        put: Net::HTTP::Put,
        delete: Net::HTTP::Delete
      }.fetch(method)

      request = request_class.new(uri.request_uri, headers)
      request.body = body if body

      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = uri.scheme == "https"
      http.open_timeout = @open_timeout
      http.read_timeout = @read_timeout
      response = http.request(request)

      HttpResponse.new(status: response.code.to_i, body: response.body.to_s)
    end
  end
end

