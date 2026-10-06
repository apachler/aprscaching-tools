# Changelog

Each release of the registry is a tag `vX.Y.Z` on `main`; an aprscaching release bundles one. Tool API and registry
format versions are named where they change.

## [Unreleased]

## [1.1.0] - 2026-10-06

The app's first-party tools move here: aprscaching ships no tools of its own, and players install them from this
registry.

- **New tools**, built from `tools/<name>/src` with the aprscaching MIT libraries at the `lib.lock` commit: Packet
  decoder (decoder and field panel), PSK31 + CW decoders, 7PLUS reassembler, MHeard, Watch & alert, Monitor
  colouriser, Station DB, CTEXT macro pack, Grid & bearing, Unit converter, CW encoder, Map waypoints, Block art,
  APRS SSID guide, Auto-responder, Away note, Connect bell, Info / menu responder, Link ping, Scheduled query,
  Auto-status and Beacon scheduler.
- **Tool API 1.0.** Every manifest names `"api": "1.0"`, the tool API version it needs.
- **Registry format 1.** `registry.json` names `"format": 1`, which the authority signs with the entries.
- **Build.** `scripts/fetch-libs.mjs` and `scripts/build.mjs` make each `tool.js` reproducibly; CI checks the
  committed scripts against a fresh build. `scripts/sign-all.mjs` signs a release in one step.
- **Verify.** `verify.mjs` lists unsigned tools on `dev` and fails on them with `--strict`, which `main` and
  release tags run. It checks each manifest's `api` and the registry format.
- Station log 1.0.1: comment only.

## [1.0.0] - 2026-10-06

The first registry for aprscaching 1.x.

- Hello tool and Station log, signed by OE8APR's author key.
- `registry.json` signed by the project authority key in `authority.pub`; entries relative to the registry.
- `scripts/genkey.mjs`, `scripts/sign.mjs` and `scripts/verify.mjs`.
