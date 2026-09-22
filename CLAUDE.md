# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Track — a React Native + Expo (managed workflow, SDK 57) app for real-time group location sharing
and travel coordination. TypeScript throughout, strict mode on.

## Commands

- `npm install` — install dependencies
- `npm start` — `expo start`, scan the QR with Expo Go or press `a`/`i` for an emulator/simulator
- `npm run android` / `npm run ios` / `npm run web` — start targeting a specific platform
- No test suite or lint script is configured yet.

Setup: copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` (defaults to
`https://track-api-fjkl.onrender.com`, which is Track-api's Render free-tier deploy — it spins down
after ~15 min idle, so the first request after a gap can take 30-50s to cold-boot; this is the usual
cause of "app stuck loading" / "login is slow" reports, not a code bug).

**Local `.env` only covers local runs.** `EXPO_PUBLIC_*` vars (and the non-prefixed
`GOOGLE_MAPS_API_KEY_ANDROID`/`_IOS`, `GOOGLE_SERVICES_JSON`/`GOOGLE_SERVICE_INFO_PLIST`) are baked
into the JS bundle or native manifest at *build* time — `expo start`/`expo run:*` read `.env`
directly, but `eas build` runs on Expo's cloud servers, which never see it (`.env` is gitignored).
Every var in `.env.example` also has to be registered as an EAS environment variable (`eas env:create
--environment production --environment preview --environment development --name X --value Y`, or via
the expo.dev dashboard) or a cloud build silently ships with that value missing — this has caused
real, hard-to-diagnose bugs (API calls failing with no baseURL, maps not rendering) that only
reproduce in a built APK, never locally. Run `eas env:list --environment <env>` to check what's
currently registered before assuming a build-only bug is a code problem.

Because the app uses native modules (`react-native-maps`, `expo-secure-store`, gesture-handler,
reanimated), plain Expo Go won't include the native map module — use `npx expo run:android` /
`npx expo run:ios` (or an EAS dev client) instead.

**Map rendering, routing, traffic, and ETA/turn-by-turn now require a Google Maps Platform
account** (`app.config.js` reads `GOOGLE_MAPS_API_KEY_ANDROID`/`GOOGLE_MAPS_API_KEY_IOS` from
`.env` at build time; web reads `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_WEB` and `EXPO_PUBLIC_MAP_ID` at
runtime) — a deliberate, approved exception to this project's earlier free-forever posture, made
because Google offers traffic and turn-by-turn that the previous free stack couldn't. Map rendering
itself (Maps SDK Android/iOS via `react-native-maps`, Maps JavaScript API on web via
`@vis.gl/react-google-maps`) is genuinely free and uncapped; routing (Routes API, via Track-api's
`GoogleRoutingService`) is free for 10,000 calls/month then billed — a Google Cloud budget alert
should be configured as a safety net (see the migration plan for the exact throttle arithmetic).
Destination search/geocoding (`autocompletePlaces` in `src/services/api/routing.api.ts`) has also
moved to Google — Places Autocomplete (New) + Place Details (New), proxied through Track-api's
`places` module (`GET /places/autocomplete`, `GET /places/:placeId`) the same way `getRoute` is
proxied through `routing`/`google-routing`, reusing `GOOGLE_MAPS_ROUTES_API_KEY` (Places API (New)
needs to be enabled for that key in Cloud Console). It's a two-step flow — autocomplete returns a
`placeId` + description only, a second call resolves coordinates once a suggestion is actually
selected — since Google's Autocomplete (New) API doesn't return coordinates directly, unlike ORS's.
Switched from ORS because ORS's OpenStreetMap-backed geocoder has much thinner coverage of small
local businesses than Google's Places database; `EXPO_PUBLIC_ORS_API_KEY` is no longer used anywhere
in the app. Overpass is still used, unaffected, for Discover-tab POI search (`poi.api.ts`) — that
one didn't move to Google.

**If the map renders as a blank/solid-color area on Android with the Google logo watermark still
visible** (native map view mounted, custom style's base color applied, but no tile imagery ever
loads) — this is Maps SDK for Android rejecting the key's requests, not a missing/wrong key. If the
Android key is restricted to specific apps (Cloud Console → Credentials → the key → Android
restrictions), it's keyed on **package name + SHA-1 signing certificate fingerprint**, and an
EAS-built APK is signed with a *different* keystore than a local `expo run:android` debug build (EAS
manages its own keystore unless you've set up your own credentials). A key restricted to only the
local debug SHA-1 silently rejects every request from an EAS-signed build. Get the EAS keystore's
fingerprint via `eas credentials -p android` (interactive — select the build profile → Keystore →
"View keystore in the current app configuration"), then add it as a *second* fingerprint entry
alongside the existing debug one (same package name, `com.track.app`) — don't replace the debug one,
since local builds still need it. Cloud Console notes it can take up to 5 minutes to propagate after
saving. Also double check "Maps SDK for Android" is in that key's API restrictions list, and that
the Cloud Console project has an active billing account attached (Maps SDK requires one even within
the free tier) — both produce the same blank-tiles symptom if missing, though the SHA-1 mismatch is
the far more common cause after a build profile or keystore change.

Native map styling now uses the same cloud-based approach as web: `FreeMapView.tsx` passes a
platform-specific `googleMapId` (`EXPO_PUBLIC_GOOGLE_MAP_ID_ANDROID`/`_IOS`) instead of the old
client-side `customMapStyle`/`TRACK_MAP_STYLE_GOOGLE` JSON prop, which was measurably slower to
initialize (parsed and applied client-side after tiles render, vs. resolved server-side before
they're ever sent). Falls back to `customMapStyle` automatically when a platform's Map ID env var
is unset, so this doesn't regress for anyone who hasn't created the Map IDs yet — Map IDs are
per-platform (Cloud Console → Maps Management → Map IDs → Create, map type Android/iOS, project
track-df1e5), the existing web Map ID can't be reused for native. Paste `TRACK_MAP_STYLE_GOOGLE`
(`src/components/map/mapStyle.ts`) into each new Map ID's associated style in Cloud Console so all
three platforms keep rendering the same look. As with the other Google Maps keys, these two vars
also need registering as EAS environment variables (see the Commands section above) or a cloud
build will silently fall back to the slower client-side styling.

## Patched dependencies

Four `node_modules` patches apply automatically on `npm install` via `patch-package` (`postinstall`
script, `patches/*.patch`) — all fix real upstream bugs/gaps, not local hacks, so don't remove them
without re-verifying the underlying issue is actually fixed upstream first:

- `react-native-safe-area-context` — its web `NativeSafeAreaProvider` unconditionally called
  `document.body.removeChild(element)` on unmount with no check that the node was still attached,
  throwing `NotFoundError: Failed to execute 'removeChild'...` on Fast Refresh reloads.
- `react-native-web` — `render()` called `createRoot()` again on every invocation instead of reusing
  an existing root for the same container (two independent React roots ended up fighting over one
  DOM subtree whenever Fast Refresh re-ran `registerRootComponent`), and `Modal`'s `ModalPortal` had
  the same unguarded `document.body.removeChild` bug as the safe-area-context one above.
- `expo-location` — its web shim (`ExpoLocation.web.js`, used only when running via `npm run web`;
  native builds use real device GPS and are unaffected) had two accuracy/staleness gaps:
  `getCurrentPositionAsync` defaulted to `maximumAge: Infinity` (happily returns an arbitrarily old
  cached browser position) and only requested high accuracy if the caller explicitly passed
  `accuracy > Balanced`; `watchPositionAsync`'s web implementation forwarded Track's
  `accuracy`/`timeInterval`/`distanceInterval` options straight to
  `navigator.geolocation.watchPosition()` untranslated, which silently ignores those field names (the
  real browser `PositionOptions` only understands `enableHighAccuracy`/`timeout`/`maximumAge`), so
  continuous watch-based tracking never got high accuracy on web either. The patch forces
  `enableHighAccuracy: true, maximumAge: 0` as the defaults in both functions — this is what actually
  drives location accuracy for trip/friend live-sharing (`useLiveLocation.ts`,
  `useFriendLiveLocation.ts`, `useFirestoreLiveLocation.ts`) and the one-shot map-centering fixes
  (`DiscoverView.tsx`, `DirectionsView.tsx`, `GroupDetailsScreen.tsx`) when previewing on web.
- `react-dom` — both `removeChild(parentInstance, child)` and `removeChildFromContainer(container,
  child)` (in both `react-dom-client.development.js` and `react-dom-profiling.development.js`) called
  `.removeChild(child)` unconditionally on their resolved parent, with no check that `child` was
  still actually attached there. `@vis.gl/react-google-maps`'s `AdvancedMarker` (`FreeMapView.web.tsx`,
  used by `FriendsMapView`/`LiveMapScreen`/`DirectionsView` on web) portals marker content into a raw
  `div` that it hands off to the Google Maps JS SDK as `marker.content` — the SDK reparents/recycles
  that node between its own internal panes independently of React (e.g. on zoom/collision
  recalculation). If that happens to land between React's commit and either of these calls — most
  reliably triggered by a Fast Refresh full-tree remount — `child`'s actual parent is no longer what
  React expects and the unconditional call throws `NotFoundError: Failed to execute
  'removeChild'...`. Same root defect class as the two RNW-family bugs above (a library elsewhere
  mutates a DOM subtree React thinks it exclusively owns); this is the same fix pattern (check
  `child.parentNode === <resolved parent>` first) applied one layer down, in React itself, since
  neither `react-native-web` nor `@vis.gl/react-google-maps` is the actual site of the unguarded call
  this time.

If any of these packages is upgraded, regenerate the patch (`npx patch-package <pkg>`) rather than
assuming the new version already includes the fix.

## Implementation status

Auth (Signup, Login), the Groups list, and the Explore map are fully implemented, including real
live location sharing between friends — see `src/hooks/useFriendLiveLocation.ts`,
`src/hooks/useFriendPositions.ts`, and `src/services/socket/friendLocationEvents.ts`. The Explore
map originally had 3 tabs (Explore/Directions/Friends); the nearby-places Explore tab is hidden for
now (per-request) — `ExploreScreen.tsx` only shows Friends and Directions, though `DiscoverView.tsx`
and `src/services/api/poi.api.ts` are left in place to bring back later. Friend-to-friend live
sharing (mutual opt-in, per friend, via the Friends list's "Share location"/"Track" menu) is also
fully implemented end-to-end, including the backend — see `src/services/api/liveShare.api.ts` on the
frontend and the `live-share`/`locations` modules in Track-api (a real Socket.IO gateway with JWT
auth now backs `useFriendLiveLocation`/`useFriendPositions`, relaying `friend:location` only to
friends with an active mutual share).

Trips are also fully implemented end-to-end: creating a trip includes a map-based destination
picker (`src/components/group/DestinationPicker.tsx`, search + tap-to-pin), and once members join a
trip, `LiveMapScreen` shows every joined member's live position plus their own server-computed route
to the destination, rendered simultaneously via `FreeMapView`'s `routes` prop — see
`src/hooks/useLiveLocation.ts`/`useMemberPositions.ts` (trip-scoped, not group-room — despite the
generic names) and `src/services/socket/locationEvents.ts`. Routing is computed server-side via
Google's Routes API (`GoogleRoutingService`) and cached (`MemberLocation.routeGeometry` in
Track-api), not per-client — originally an ORS rate-limit courtesy, now a direct cost control since
Routes API is billed past a monthly free quota (see Commands section above). From a trip's live map,
tapping another member's
marker opens a private, trip-scoped peer-alert thread with them (`PeerAlertModal.tsx`, reply
supported, backed by `src/services/api/alerts.api.ts` and Track-api's `alerts` module) — an incoming
alert also surfaces as an app-wide toast (`src/components/alerts/PeerAlertToast.tsx`) regardless of
which screen is open. Self-alerts (SOS) are a separate, still-unbuilt feature — `SelfAlertModal.tsx`
remains a placeholder, see its "WHAT NOT TO BUILD YET" comment; don't build that out without
checking in first. Each group also has a group-wide chat (`GroupChatScreen.tsx`, opened from the
chat icon in `GroupDetailsScreen`'s header), backed by `src/services/api/chat.api.ts`,
`useGroupChat.ts`, and Track-api's `chat` module — a plain fan-out broadcast to all group members,
not a dedicated Socket.IO room (groups are capped at 50 members, so a per-recipient emit loop is
cheap enough).

Push notifications (FCM, via `@react-native-firebase/messaging`) are wired end-to-end — see
`src/services/notifications/push.ts` (native; `push.web.ts` is a no-op stub, since RNFirebase is
native-only) and `src/hooks/usePushNotifications.ts`, which requests permission, registers the
device's FCM token with the backend (`src/services/api/push.api.ts` → Track-api's `notifications`
module), and deep-links a notification tap straight into the right `GroupChat`/`PeerAlertModal`
screen. Track-api's `NotificationsService.sendToUser()` is called from six places: group chat
(`chat.service.ts`) and peer alerts (`alerts.service.ts`) — both gated on
`LocationsGateway.isUserConnected`, since a connected recipient already gets the same event live over
the socket; and a new friend request, a friend request being accepted (`friends.service.ts`), a
friend starting a live-share (`live-share.service.ts`), and a new member joining a group
(`groups.service.ts`) — these four push unconditionally, since none of them has a live in-app socket
event that would make the push redundant for an online recipient. Requires native module config
(`google-services.json`/`GoogleService-Info.plist` at the project root, a Firebase service account
key in Track-api's `.env` as `FIREBASE_SERVICE_ACCOUNT_BASE64`) and a dev client rebuild (`npx expo
prebuild` then `run:android`/`run:ios`) before it does anything — same category of constraint as
`react-native-maps`.

Google Sign-In is client-side complete but not wired up end-to-end — don't assume it works from the
frontend code alone. `src/services/firebase/auth.ts`'s `signInWithGoogle`, `authStore.loginWithGoogle`,
and `auth.api.ts`'s `loginWithGoogle`/`getFirebaseCustomToken` all exist and compile, but Track-api's
`auth.controller.ts` only registers `signup`/`login` — there is no `/auth/google` or
`/auth/firebase-token` route in the backend at all, so both calls 404. The backend half (Firebase
Admin token verification + find-or-create user for `/auth/google`, custom-token minting for
`/auth/firebase-token`) hasn't been built yet.

## Architecture

- **Navigation** (`src/navigation/`): `RootNavigator` switches between `AuthStack` and the logged-in
  stack based on `useAuthStore`'s `token`. The logged-in stack wraps `MainTabs` (bottom tabs: Groups,
  Friends, Profile) plus modal/detail screens (CreateGroup, LiveMap, GroupDetails, alerts,
  LiveShare, AddFriend). Route param types live in `src/navigation/types.ts` — extend
  `RootStackParamList`/`AuthStackParamList`/`MainTabsParamList` there when adding screens.
- **State** (`src/store/`): Zustand stores, one per domain (`authStore`, `tripLocationStore`,
  `alertStore`, `groupChatStore`). No persistence middleware — `authStore.hydrate()` restores the
  session by reading the JWT directly out of `expo-secure-store` on launch (the token is the source
  of truth, not a cached user object).
- **API layer** (`src/services/api/`): a shared `apiClient` (axios) auto-attaches the bearer token
  from SecureStore via a request interceptor. Each domain gets its own `*.api.ts` module
  (`auth.api.ts`, `groups.api.ts`, `trips.api.ts`, `alerts.api.ts`, `chat.api.ts`, `friends.api.ts`,
  `liveShare.api.ts`) exporting plain async functions that call `apiClient` and return typed payloads
  from `src/types/models.ts`.
- **Realtime** (`src/services/socket/`): `socket.ts` holds a lazily-created singleton `socket.io-client`
  instance, authenticated with the JWT. `locationEvents.ts` (trip-scoped events) and
  `friendLocationEvents.ts` (friend-graph events) both wrap the emit/listen calls for location
  updates — kept as separate event namespaces (`location:*` vs `friend:location:*`) since a trip
  broadcast and a friend-graph broadcast are different backend shapes. Friends live tracking is
  consumed via `useFriendLiveLocation`/`useFriendPositions`; trip live tracking (despite the generic
  names, from before this was scoped to trips rather than whole groups) via
  `useLiveLocation`/`useMemberPositions`. `alertEvents.ts` and `chatEvents.ts` follow the same
  wrapper pattern for peer alerts and group chat respectively.
- **Types** (`src/types/models.ts`): the shared domain model (`User`, `Group`, `Trip`,
  `TripMemberPosition`, `PeerAlert`, `ChatMessage`, `LiveShareSession`, etc.) used across stores, API
  modules, and screens.
- **Constants** (`src/utils/constants.ts`): `COLORS` is the single source of truth for the palette —
  the `status*` colors are reserved strictly for member/group status rings and must not be reused
  decoratively. Also holds animation durations, avatar image requires, and PIN length rules.
- **Avatars**: `src/assets/avatars/*.png` are solid-color placeholders generated by
  `scripts/gen-placeholder-avatars.js` so the app runs without missing-asset errors — replace with
  real artwork before shipping.

## Versioning

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) (`MAJOR.MINOR.PATCH`).
Releases are logged in `CHANGELOG.md` ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
format).

- **MAJOR** — breaking changes: a Track-api contract change that isn't backwards compatible, a data
  model migration older clients can't handle, or removing a shipped feature.
- **MINOR** — new backwards-compatible functionality: a new screen, a new API integration, a new
  feature.
- **PATCH** — backwards-compatible fixes: bug fixes, dependency bumps, copy/UI tweaks that don't add
  functionality.

Where the version number lives:

- `package.json`'s `"version"` is the canonical source.
- `app.config.js`'s `expo.version` must always match it exactly — there's no lint/test enforcing
  this yet, so check both by hand when bumping.
- `eas.json` has `appVersionSource: "remote"` with `autoIncrement: true` on the `production` build
  profile — this governs the platform build numbers (Android `versionCode` / iOS `buildNumber`),
  which EAS auto-increments on every production build **independently** of the semver version above.
  Bumping the semver version doesn't need to correspond 1:1 with a store build number.

Release process:

1. Decide the bump (major/minor/patch) using the rules above.
2. Update the version in both `package.json` and `app.config.js` to match.
3. Move the relevant `[Unreleased]` entries in `CHANGELOG.md` under a new `[X.Y.Z] - YYYY-MM-DD`
   heading.
4. Commit (e.g. `chore: release vX.Y.Z`).
5. Tag the release: `git tag -a vX.Y.Z -m "vX.Y.Z"`. Confirm with the user before pushing tags
   (`git push origin vX.Y.Z`) — pushing a tag is visible to anyone tracking the remote.

No releases have been tagged yet — `git tag` is currently empty; `v1.0.0` for the `CHANGELOG.md`
baseline hasn't been created in git yet either.
