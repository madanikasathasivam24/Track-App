import { registerRootComponent } from 'expo';

import App from './App';
import { registerBackgroundHandler } from './src/services/notifications/push';
import { configureGoogleSignIn } from './src/services/firebase/auth';
import { initClarity } from './src/services/analytics/clarity';

// Must run before the app mounts — required by RNFirebase for Android to
// deliver FCM messages while the app is backgrounded/killed (a no-op on web,
// see push.web.ts).
registerBackgroundHandler();

// Must run once before the first GoogleSignin.signIn() call (a no-op on web,
// see auth.web.ts).
configureGoogleSignIn();

// Starts Clarity session recording — a no-op on web/Expo Go, see clarity.ts.
initClarity();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
