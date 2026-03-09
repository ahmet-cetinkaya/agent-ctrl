# agent-ctrl Makefile
# Single-step build automation

# Default target: build the project
.PHONY: all
all: build

# Build the CLI (single command - Bun auto-installs dependencies)
.PHONY: build
build:
	@echo "Building agent-ctrl CLI..."
	bun run build

# Build and verify type correctness
.PHONY: build:check
build:check:
	@echo "Building and type-checking agent-ctrl CLI..."
	bun run build
	bun run lint

# Remove build artifacts
.PHONY: clean
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist/
