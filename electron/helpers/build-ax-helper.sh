#!/bin/bash
cd "$(dirname "$0")"
swiftc -O ax-selection-helper.swift -o ax-selection-helper
echo "Built ax-selection-helper"
