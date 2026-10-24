# Expo Android Development Build Guide

This guide explains how to create, install, and use a development build for an Expo Android app. It covers both local builds and cloud builds through Expo Application Services (EAS), using Windows PowerShell and npm.

The workflow is: install Expo's development client, build and install the Android app, start Metro, then open the QR code. Building the Android app is usually a one-time setup until native dependencies or configuration change. Starting Metro is what you repeat during daily development.

## Step 1 Open or create an Expo project

For an existing project, open PowerShell and run:

```powershell
Set-Location C:\Projects\my-app
npm install
```

To create a new project instead, run these commands from an existing parent folder:

```powershell
Set-Location C:\Projects
npx create-expo-app@latest my-app
Set-Location C:\Projects\my-app
```

Replace the example folder with your own project location. Run the remaining Expo commands from the folder containing the app's package.json. In a monorepo, install dependencies according to the repository's workspace setup, then enter the Expo app folder.

## Step 2 Install the development client

```powershell
npx expo install expo-dev-client
```

Using expo install selects a version compatible with your Expo SDK. This library adds the launcher and development tools to your Android build. See [Expo development build setup](https://docs.expo.dev/develop/development-builds/introduction/).

## Step 3 Set the app identity

In app.json, merge these fields into the existing expo configuration:

```json
{
  "expo": {
    "name": "My App",
    "slug": "my-app",
    "scheme": "myapp",
    "android": {
      "package": "com.yourname.myapp"
    }
  }
}
```

| Field | Purpose |
| --- | --- |
| name | Label beneath the installed app icon |
| slug | Expo project name |
| scheme | Custom links such as myapp:// |
| android.package | Unique Android application ID |

Replace the example values with your own. Preserve existing configuration, including plugins and assets. If the project uses app.config.js or app.config.ts, update the effective configuration there. For an established app, keep its existing identity unless you intend to create another app variant.

## Step 4 Choose how to build

| Build method | Requirements |
| --- | --- |
| Local build | Android Studio and an Android SDK and JDK compatible with the project's Expo SDK |
| EAS cloud build | An Expo account and internet access; Android Studio is unnecessary for building an APK for a phone |

Choose Step 5A or Step 5B, then continue to Step 6.

## Step 5A Build and install locally

Install Android Studio and complete the Android environment setup appropriate for your Expo SDK. Follow the setup links in [Expo local build instructions](https://docs.expo.dev/guides/local-app-development/).

Choose a target device:

- Emulator: create and start an Android emulator through Android Studio's Device Manager.
- Phone: enable Developer options and USB debugging, connect it by USB, and accept the debugging authorization prompt.

From the Expo app folder, run:

```powershell
npx expo run:android --device
```

Select the connected phone or running emulator when prompted. Expo generates the Android project if necessary, compiles the development build, installs it, and starts Metro. You may already be able to use the app at this point.

For a project that manages native settings through Expo configuration and plugins, regenerate native files when needed before rebuilding. If the project contains manually maintained Android code, preserve those changes when updating native configuration.

## Step 5B Build and install through EAS

### Log in and configure the project

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

Follow the prompts to create or link the correct Expo project.

### Configure a development profile

In the generated eas.json, ensure the build section contains this profile. Preserve any existing profiles and other settings:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### Build the APK

```powershell
npx eas-cli@latest build --platform android --profile development
```

Follow the signing prompts. If your app needs environment variables during the cloud build, configure those for the selected EAS build environment; a local ignored .env file is not automatically uploaded.

### Install the finished APK

On a phone, open the installation link from the completed build, download the APK, and install it. Android may ask you to allow installation from that browser.

For an Android Studio emulator, download the APK and drag it onto the running emulator window.

See [EAS build configuration](https://docs.expo.dev/build/eas-json/).

## Step 6 Start Metro in development client mode

If Metro is already running from the local build, use that terminal. Otherwise, run:

```powershell
npx expo start --dev-client --lan
```

The terminal should display:

```text
Using development build
```

Expo also displays a QR code and a connection URL. A typical URL looks like:

```text
exp+my-app://expo-development-client/?url=http%3A%2F%2F192.168.1.10%3A8081
```

Expo generates this URL automatically. Use the URL printed by your current terminal because the scheme, IP address, or port may differ. The link opens the installed development app and connects it to Metro on your computer. See [Expo CLI reference](https://docs.expo.dev/more/expo-cli/).

## Step 7 Open the project on Android

On a phone:

1. Connect the phone and computer to the same Wi-Fi network.
2. Scan the terminal QR code using the phone camera or a QR reader.
3. Open the link with your installed development app.

On an emulator:

1. Keep the emulator running.
2. Press a in the Expo terminal.

Leave Metro running while developing. See [Using a development build](https://docs.expo.dev/develop/development-builds/use-development-builds/).

## Step 8 Repeat the daily startup process

```powershell
Set-Location C:\Projects\my-app
npx expo start --dev-client
```

Open the installed app and connect to the server. JavaScript and screen changes normally update through Fast Refresh.

Rebuild and reinstall after adding native libraries or changing native settings such as the package ID, app scheme, or native plugins. Updating JavaScript alone usually does not require another APK.

## Step 9 Troubleshoot connection problems

| Problem | Action |
| --- | --- |
| QR code cannot open the app | Confirm that this project's development APK is installed. |
| Phone cannot reach Metro | Check Wi-Fi connectivity and allow Node.js through Windows Firewall on your private network. |
| Local network blocks the connection | Try npx expo start --dev-client --tunnel. Follow any prompt to install the tunnel dependency. |
| Changes appear stale | Restart with npx expo start --dev-client --clear. |
| Native module is missing | Build and install a new development APK that includes the native library. |

Tunnel mode and cache reset options are documented in the [Expo CLI reference](https://docs.expo.dev/more/expo-cli/).

## Official references

- [Expo development build setup](https://docs.expo.dev/develop/development-builds/introduction/)
- [Local Android build instructions](https://docs.expo.dev/guides/local-app-development/)
- [EAS build configuration](https://docs.expo.dev/build/eas-json/)
- [Using a development build](https://docs.expo.dev/develop/development-builds/use-development-builds/)
- [Expo CLI reference](https://docs.expo.dev/more/expo-cli/)
