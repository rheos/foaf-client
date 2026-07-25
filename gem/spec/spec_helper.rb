# frozen_string_literal: true

require "base64"
require "json"
require "openssl"
require "securerandom"
require "time"
require "foaf_client"

RSpec.configure do |config|
  config.disable_monkey_patching!
  config.order = :random
end

