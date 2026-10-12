# Android MobileCLI patches

These downstream patches target **mobilecli 1.0.9**, commit `583fdc752a3c410f1b63ecc7cfbe93135c45ee9a`.

## App launch arguments

`quote-launch-component.patch` quotes the resolved activity component before passing it through `adb shell`. Android activity names can contain `$` (Java inner classes); without shell quoting, that suffix is expanded as an environment variable and `am start` receives the wrong component. The fix uses MobileCLI's existing shell-escaping dependency and applies to both discovered launchers and explicit activity names.

Validation on Android 15 / API 35: the patched MobileCLI successfully launched Settings and YouTube (`Shell$HomeActivity`). YouTube reached its first-run Android permission prompt; this verifies app launching, not completion of its onboarding. The existing launcher-resolution and component-validation Go tests also passed.

## Accessibility cache refresh

Temporary downstream patch for [mobilecli #415](https://github.com/mobile-next/mobilecli/issues/415). Apply it to **mobilecli 1.0.9**, commit `583fdc752a3c410f1b63ecc7cfbe93135c45ee9a`.

The persistent Android reader can return a populated but obsolete Chrome accessibility tree after DOM changes. Before fetching windows or roots, this patch clears the connection's accessibility cache. It retains the existing connection and screenshot behavior.

- API 34+: `UiAutomation.clearCache()`.
- Older APIs (or a false return): reapply the existing accessibility service info. AOSP's `UiAutomation.setServiceInfo()` clears the connection cache without changing service flags. This compatibility path requires separate device validation; the local regression device is API 35.

Build the patched dependency using upstream's Android/iOS agent build prerequisites and Go toolchain:

```sh
git clone --branch 1.0.9 --depth 1 https://github.com/mobile-next/mobilecli.git
cd mobilecli
git apply /path/to/mobile-mcp-jev/patches/mobilecli/clear-accessibility-cache.patch
git apply /path/to/mobile-mcp-jev/patches/mobilecli/quote-launch-component.patch
make build
```

Point `MOBILECLI_PATH` in the fork's ignored `.env` to the resulting executable, then restart the inspector/MCP process. These patches are **not** included in the normal npm dependency. Removing the override restores the bundled upstream binary.

With an awake, unlocked, idle Android test device running Chrome, set `ANDROID_SERIAL` and `MOBILE_DEVICE`, build this fork, and run:

```sh
node scripts/check-android-ui-freshness.mjs
```

The test serves a local fixture through a temporary ADB reverse mapping, dismisses a section, and requires the new form to replace the old controls in the accessibility tree within three seconds, across three rounds. It exits nonzero on stale reads and saves only numeric/status results to ignored `benchmark-results/`. It makes no model calls and does not reset Chrome data. The test opens local diagnostic tabs.

Validation on an Android 15 / API 35 emulator: upstream 1.0.9 still returned the old dialog after eight reads over 3.12 seconds. The patched build passed all three rounds on the first read, taking 138–171 ms per read after the tap. These are fixture observation timings, not end-to-end agent benchmarks.

The cache patch alone does not fix empty Chrome web-content trees. This fork also provides a local ADB/DevTools fallback for that case, with a bounded wait while new pages load. On Android 15/API 35, a subsequent Jev + DeepSeek smoke check reached real Skyscanner results for Shanghai (Any)–Tokyo (Any), October 20–25, 2026, one adult in economy. That single run used both fixes and software rendering; it is not evidence that the cache patch alone fixes every browser page or third-party WebView.

Upstream source is Apache-2.0; the patch is distributed under this repository's Apache-2.0 license.
