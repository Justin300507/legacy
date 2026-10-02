import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.justin.family3d',
  appName: 'Legacy',
  webDir: 'dist',
  backgroundColor: '#000000',
  android: {
    backgroundColor: '#000000',
  },
  plugins: {
    // Draw edge-to-edge under black system bars with light icons; CSS gets --safe-area-inset-*.
    SystemBars: { style: 'DARK', insetsHandling: 'css' },
  },
};

export default config;
