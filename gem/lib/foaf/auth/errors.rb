# frozen_string_literal: true

module Foaf
  module Auth
    class Error < StandardError; end
    class VerificationError < Error; end
    class FetchError < Error; end
    class UnknownKidError < VerificationError; end
    class RevokedTokenError < VerificationError; end
  end
end

