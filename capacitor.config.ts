import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.masterbarang.app',
  appName: 'Master Barang',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#ffffff',
      launchAutoHide: true,
      androidScaleType: 'CENTER_INSIDE',
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: '#ffffff',
      overlaysWebView: false,
      style: 'LIGHT',
    },
  },
};

export default config;
