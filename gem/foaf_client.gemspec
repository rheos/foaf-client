# frozen_string_literal: true

require_relative "lib/foaf_client/version"

Gem::Specification.new do |spec|
  spec.name = "foaf_client"
  spec.version = FoafClient::VERSION
  spec.authors = ["FOAF Foundation"]
  spec.summary = "Shared auth and ledger client for FOAF applications"
  spec.homepage = "https://foaf.foundation"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 2.7"

  spec.files = Dir.chdir(__dir__) do
    Dir["lib/**/*", "README.md"]
  end
  spec.require_paths = ["lib"]

  spec.add_dependency "eth", "~> 0.5"
  spec.add_dependency "jwt", ">= 2.7", "< 3"

  spec.add_development_dependency "rake", "~> 13.0"
  spec.add_development_dependency "rspec", "~> 3.13"
end

