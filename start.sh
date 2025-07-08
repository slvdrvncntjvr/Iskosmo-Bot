#!/bin/bash
echo "Starting Iskosmo-Bot with memory optimizations for Termux..."

# Set memory limit without expose-gc flag
export NODE_OPTIONS="--max-old-space-size=512"

# Run with node directly using expose-gc flag
nice -n 10 node --expose-gc index.js
