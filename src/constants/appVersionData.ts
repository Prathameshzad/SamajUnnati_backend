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
