// SPDX-License-Identifier: MIT
// The script tests run sign, verify, release and git as child processes, and run in parallel: well within a minute
// each, but not always within vitest's default 5 s on a loaded runner.
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { testTimeout: 60_000 } });
