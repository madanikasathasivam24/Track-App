# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). See the "Versioning" section
in `CLAUDE.md` for this repo's bump rules and release process.

## [Unreleased]

## [1.0.0] - 2026-07-23

No earlier tagged release exists, so this entry retroactively documents the functionality already
on `main` at the point this changelog was introduced, rather than a diff against a prior tag.

### Added

- Auth: signup and login.
- Groups list and Explore map, including real-time live location sharing between friends.
- Friend-to-friend live location sharing, mutual opt-in per friend (share/track from the Friends list).
- Trips: map-based destination picker; live map showing every joined member's position plus each
  member's own server-computed route (Google Routes API) to the destination.
- Peer alerts: trip-scoped alert threads opened from a member's marker on the live map, plus an
  app-wide toast for incoming alerts regardless of the open screen.
- Group chat: group-wide broadcast chat per group.
- Push notifications (FCM) for chat, peer alerts, friend requests, live-share invites, and group
  joins, with deep-linking into the relevant screen on tap.
- Google Maps-based map rendering, routing/ETA/turn-by-turn, and Places-based destination
  search/autocomplete (migrated from OpenRouteService/MapLibre).

### Known incomplete

- Google Sign-In: frontend (`signInWithGoogle`, `authStore.loginWithGoogle`) is implemented, but
  Track-api has no `/auth/google` or `/auth/firebase-token` route yet — both calls currently 404.
- Self-alerts (SOS): `SelfAlertModal.tsx` is a placeholder only; not implemented.
