import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './App';
import { initWidget } from './widget/widgetTaskHandler';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Registered here (not inside App.tsx) so the headless JS instance Android spins up
// to render/update the widget also has the handler available, without booting the full app.
initWidget();
