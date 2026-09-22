// Converted from app.json to app.config.js so the Google Maps API keys below
// can be read from .env like every other credential in this repo, instead of
// sitting as literal strings in committed JSON. These two are deliberately
// NOT EXPO_PUBLIC_-prefixed: they're read by Node at `expo prebuild`/`expo
// run:*` time to bake into AndroidManifest.xml/Info.plist, never shipped
// into the JS bundle — unlike EXPO_PUBLIC_ORS_API_KEY, which the running app
// itself reads at runtime.
module.exports = {
  expo: {
    name: 'Track-frontend',
    slug: 'Track-frontend',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.track.app',
      // GoogleService-Info.plist/google-services.json are gitignored (Firebase
      // project credentials) — EAS Build only uploads git-tracked files, so on
      // EAS these come from file-type environment variables instead (see
      // GOOGLE_SERVICE_INFO_PLIST/GOOGLE_SERVICES_JSON in the EAS dashboard);
      // locally (expo prebuild/run:*), process.env is unset and it falls back
      // to the real file already sitting at the project root.
      googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST ?? './GoogleService-Info.plist',
      entitlements: {
        'aps-environment': 'development',
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription: 'Track uses your location to share it with your group in real time.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Track uses your location to keep sharing it with your group while the app is in the background.',
        UIBackgroundModes: ['remote-notification'],
      },
    },
    android: {
      package: 'com.track.app',
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS'],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-secure-store',
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'Track uses your location to share it with your group in real time.',
        },
      ],
      'expo-font',
      [
        'react-native-maps',
        {
          androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
          iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS,
        },
      ],
      '@react-native-firebase/app',
      '@react-native-firebase/messaging',
      '@react-native-firebase/auth',
      '@react-native-google-signin/google-signin',
      '@react-native-community/datetimepicker',
      [
        'expo-build-properties',
        {
          ios: {
            useFrameworks: 'static',
            forceStaticLinking: ['RNFBApp', 'RNFBMessaging', 'RNFBAuth', 'RNFBFirestore'],
          },
        },
      ],
    ],
    extra: {
      eas: {
        projectId: 'a8bd753d-8cea-4df8-88b4-a98ee90162ac',
      },
    },
  },
};
