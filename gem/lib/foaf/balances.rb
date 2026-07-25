# frozen_string_literal: true

require "bigdecimal"

module Foaf
  module Balances
    module_function

    def from_trustline_row(row)
      balance = decimal(fetch(row, "balance"))
      {
        viewer_balance: -balance,
        my_credit_limit: decimal(fetch(row, "received")),
        their_credit_limit: decimal(fetch(row, "given"))
      }
    end

    def fetch(row, key)
      return row[key] if row.respond_to?(:key?) && row.key?(key)
      symbol = key.to_sym
      return row[symbol] if row.respond_to?(:key?) && row.key?(symbol)

      raise KeyError, "missing FOAF trustline field #{key}"
    end
    private_class_method :fetch

    def decimal(value)
      BigDecimal(value.to_s)
    end
    private_class_method :decimal
  end
end

