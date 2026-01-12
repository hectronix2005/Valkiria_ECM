# frozen_string_literal: true

# Disable ZIP64 support to ensure compatibility with pandoc and other tools
# ZIP64 is only needed for archives larger than 4GB
require "zip"
Zip.write_zip64_support = false
