// src/constants/appVersionData.ts

export interface AppVersionConfig {
  latestVersion: string;
  minSupportedVersion: string;
  forceUpdate: boolean;
  updateUrlAndroid: string;
  updateUrlIos: string;
  title: string;
  message: string;
  releaseNotes: string[];
}

/** Compare dotted version strings: -1 if v1 < v2, 0 if equal, 1 if v1 > v2. */
export function compareVersions(v1: string, v2: string): number {
  const p1 = (v1 || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const p2 = (v2 || '0').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const a = p1[i] ?? 0;
    const b = p2[i] ?? 0;
    if (a !== b) return a > b ? 1 : -1;
  }
  return 0;
}

export const getAppVersionData = (): AppVersionConfig => {
  return {
    latestVersion: process.env.APP_LATEST_VERSION || '2.0.8',
    minSupportedVersion: process.env.APP_MIN_SUPPORTED_VERSION || '2.0.0',
    forceUpdate: process.env.APP_FORCE_UPDATE === 'true',
    updateUrlAndroid:
      process.env.APP_STORE_URL_ANDROID ||
      'https://play.google.com/store/apps/details?id=com.samajunnati.app',
    updateUrlIos:
      process.env.APP_STORE_URL_IOS ||
      'https://apps.apple.com/app/id/com.samajunnati.app',
    title: 'New Update Available',
    message: 'A new version of Samaj Unnati is available with latest features and performance enhancements.',
    releaseNotes: [
      'Bug fixes and enhanced application stability',
      'Improved relation suggestions and family tree performance',
      'Smoother experience and faster loading',
    ],
  };
};
