#!/bin/sh
# Builds and tests the linux musl binding inside an Alpine container, so the
# binary links against musl and the tests run on a real musl system.
#
# Run from the root of a fresh clone, on a host of the target architecture.
# The container installs Linux dependencies into node_modules and core/target.
#
#   docker run --rm -v "$PWD:/work" -w /work node:24-alpine \
#     sh scripts/build-musl.sh linux-x64-musl
#
# The artifact lands in core/artifacts/<platform_arch_abi>/.
set -eu

platform_arch_abi="${1:?usage: build-musl.sh <linux-x64-musl|linux-arm64-musl>}"

case "$platform_arch_abi" in
  linux-x64-musl) target=x86_64-unknown-linux-musl ;;
  linux-arm64-musl) target=aarch64-unknown-linux-musl ;;
  *)
    echo "unsupported target: $platform_arch_abi" >&2
    exit 1
    ;;
esac

bun_version="$(sed -n 's/.*"packageManager": "bun@\([^"]*\)".*/\1/p' package.json)"

apk add --no-cache bash build-base curl git libgcc libstdc++
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs |
  sh -s -- -y --profile minimal --default-toolchain stable --no-modify-path
export PATH="$HOME/.cargo/bin:$PATH"
npm install --global "bun@$bun_version"

cargo fetch --locked --manifest-path core/Cargo.toml
bun install --frozen-lockfile --filter pdf-raster
bun run --filter pdf-raster build:types

# The container's host target is already $target, so build natively. napi
# links musl dynamically on its own (-crt-static), but it assumes a cross
# linker for aarch64 musl, so point cargo at the container's own cc.
host="$(rustc -vV | sed -n 's/^host: //p')"
if [ "$host" != "$target" ]; then
  echo "expected a $target host, got $host" >&2
  exit 1
fi
export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_MUSL_LINKER=cc
bunx --bun @napi-rs/cli build \
  --cwd core \
  --platform \
  --release \
  --output-dir "artifacts/$platform_arch_abi"

PDFIUM_TARGET="$target" bun scripts/stage-pdfium-artifact.ts \
  "core/artifacts/$platform_arch_abi"

export NAPI_RS_NATIVE_LIBRARY_PATH="$PWD/core/artifacts/$platform_arch_abi/pdf-raster.$platform_arch_abi.node"
test -f "$NAPI_RS_NATIVE_LIBRARY_PATH"
ls -la "$(dirname "$NAPI_RS_NATIVE_LIBRARY_PATH")"

cd core
bun test ./test
node ./test/node-smoke.ts
node ./test/concurrent-init.ts
