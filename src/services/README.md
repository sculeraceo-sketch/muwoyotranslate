# Device speech recognition

`offlineSpeechRecognition.ts` uses `expo-speech-recognition` with `requiresOnDeviceRecognition: true` and Android `EXTRA_PREFER_OFFLINE`. It never calls Supabase, OpenRouter, OpenAI, or another cloud provider.

The module is native and requires an Expo Development Build. Expo Go is not sufficient.

A device must have a compatible offline speech model installed. The hook checks `getSupportedLocales()` when the native runtime exposes it and returns a human-readable error when the selected language is unavailable. Android can download a model through the native recognizer settings/API; iOS availability depends on the installed offline Siri/Speech language resources.
