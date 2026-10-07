# Implementation Plan: Firebase Phone Authentication

## Overview

Replace the mock OTP flow in `auth_screen.dart` with real Firebase Phone Authentication, add HMS backend registration verification, and migrate `main.dart` from `setState`-based auth to a fully reactive Riverpod architecture. The implementation proceeds bottom-up: Android/pubspec setup first, then the data/service layer, then Riverpod providers and the state machine, then UI refactoring, and finally session restore and sign-out wiring.

---

## Tasks

- [ ] 1. Configure Android and pubspec for Firebase
  - [ ] 1.1 Add Firebase dependencies to `pubspec.yaml`
    - Add `firebase_core: ^3.6.0` and `firebase_auth: ^5.3.1` under `dependencies` in `pubspec.yaml`
    - Retain `flutter_riverpod: ^2.4.9`, `shared_preferences: ^2.2.2`, and `http: ^1.2.0` unchanged
    - Run `flutter pub get` to resolve the lock file
    - _Requirements: 1.1, 1.2_

  - [ ] 1.2 Update Android Gradle files for Firebase
    - In `android/app/build.gradle.kts`: add `id("com.google.gms.google-services")` to the `plugins` block and change `minSdk = flutter.minSdkVersion` to `minSdk = 21`
    - In `android/build.gradle.kts` (project-level): add `classpath("com.google.gms:google-services:4.4.2")` inside `buildscript.dependencies`
    - _Requirements: 1.3, 1.4_

- [ ] 2. Initialize Firebase in `main.dart` and add ProviderScope
  - [ ] 2.1 Migrate `main()` to async Firebase initialization
    - Replace the synchronous `main()` with an async version that calls `WidgetsFlutterBinding.ensureInitialized()` then `Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform)`
    - Wrap `CareBridgeApp` in `ProviderScope` and pass it to `runApp()`
    - On `initializeApp()` exception, call `runApp(FirebaseInitErrorApp(error: e.toString()))` instead
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 2.2 Create `FirebaseInitErrorApp` widget
    - Create `lib/features/auth/firebase_init_error_app.dart`
    - Implement a standalone `MaterialApp` (no `ProviderScope`) with a `Scaffold` that displays the error message string
    - _Requirements: 2.3_

- [ ] 3. Create the HMS API service layer
  - [ ] 3.1 Implement `HmsApiClient` with error types
    - Create `lib/core/services/hms_api_client.dart`
    - Implement `HmsApiClient` class with `checkRegistration({required String phoneNumber, required String admissionId})` that POSTs to `AppConstants.apiBaseUrl/auth/caregiver-verify`
    - Implement `HmsRegistrationResult` with `fromJson` factory that maps `"role"` string to `CaregiverRole`
    - Implement `HmsNotRegisteredError` (for HTTP 404) and `HmsHttpError({required int statusCode})` exception classes
    - For non-200 status codes outside 404, throw `HmsHttpError`; propagate network exceptions unchanged
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 3.2 Write property tests for `HmsApiClient`
    - **Property 11: HMS called with exact phone and admissionId after sign-in**
    - **Property 12: HMS role response stored in provider**
    - **Property 13: HMS HTTP errors trigger signOut and reset**
    - **Validates: Requirements 6.1, 6.2, 6.4**
    - Mock `http.Client` with `mocktail`; generate random `(phoneNumber, admissionId, CaregiverRole)` triples and HTTP status codes 400–599

- [ ] 4. Create Riverpod providers and `AuthFlowState` sealed classes
  - [ ] 4.1 Define `AuthFlowState` sealed class hierarchy
    - Create `lib/features/auth/auth_state_notifier.dart`
    - Define `sealed class AuthFlowState` with subclasses: `PhoneEntryState({String? errorMessage})`, `OtpEntryState({required String verificationId, required String phone, required String admissionId})`, `LoadingState()`
    - _Requirements: 3.1, 3.3, 3.4_

  - [ ] 4.2 Create `auth_providers.dart` with all Riverpod providers
    - Create `lib/core/providers/auth_providers.dart`
    - Define `authStateProvider` as `StreamProvider<User?>` wrapping `FirebaseAuth.instance.authStateChanges()`
    - Define `caregiverRoleProvider` as `StateProvider<CaregiverRole?>` initialized to `null`
    - Define `storedAdmissionIdProvider` as `StateProvider<String>` initialized to `''`
    - Declare `authNotifierProvider` as `AsyncNotifierProvider<AuthStateNotifier, AuthFlowState>` pointing to `AuthStateNotifier.new`
    - _Requirements: 3.1, 3.5_

  - [ ]* 4.3 Write property tests for auth providers
    - **Property 1: Auth state stream propagation**
    - **Property 4: CaregiverRole StateProvider round-trip**
    - **Validates: Requirements 3.1, 3.5**
    - Use `ProviderContainer` with mocked `FirebaseAuth` stream overrides; generate arbitrary `User?` sequences and `CaregiverRole` values

- [ ] 5. Implement `AuthStateNotifier` — OTP request flow
  - [ ] 5.1 Implement `requestOtp` method in `AuthStateNotifier`
    - In `lib/features/auth/auth_state_notifier.dart`, add `AuthStateNotifier extends AsyncNotifier<AuthFlowState>`
    - Implement `build()` returning `PhoneEntryState()`
    - Implement `requestOtp({required String phoneNumber, required String admissionId})`:
      - Validate non-empty inputs; if invalid, set `state = AsyncData(PhoneEntryState(errorMessage: 'Please enter Admission ID and Mobile Number'))` and return
      - Set `state = AsyncData(LoadingState())`
      - Call `FirebaseAuth.instance.verifyPhoneNumber()` with all four callbacks: `codeSent` → `OtpEntryState`, `verificationFailed` → `PhoneEntryState(errorMessage: e.message)`, `verificationCompleted` → call `signInWithAutoCredential()`, `codeAutoRetrievalTimeout` → no-op
    - Also implement `resetToPhoneEntry()` that sets `state = AsyncData(PhoneEntryState())`
    - Write `storedAdmissionIdProvider` with the entered `admissionId` when `codeSent` fires
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 9.1, 9.2, 9.3_

  - [ ]* 5.2 Write property tests for OTP request flow
    - **Property 5: Non-empty inputs trigger OTP request**
    - **Property 6: codeSent callback stores verificationId**
    - **Property 7: verificationFailed shows Firebase error message**
    - **Property 8: Empty inputs prevent OTP request**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.5**
    - Use mock `FirebaseAuth` with controllable callbacks; generate random `(admissionId, phoneNumber)` pairs including empty/non-empty combinations and arbitrary `verificationId` strings

- [ ] 6. Implement `AuthStateNotifier` — OTP verification and HMS flow
  - [ ] 6.1 Implement `verifyOtp` and `signInWithAutoCredential` methods
    - Implement `verifyOtp({required String otp, required String verificationId, required String admissionId})`:
      - If `otp.length < 6`, set `state = AsyncData(OtpEntryState(...))` with current values and return; display error via `PhoneEntryState` error path
      - Set `state = AsyncData(LoadingState())`
      - Construct `PhoneAuthProvider.credential(verificationId: verificationId, smsCode: otp)` and call `FirebaseAuth.instance.signInWithCredential()`
      - On `FirebaseAuthException(code: 'invalid-verification-code')` → stay on `OtpEntryState`, surface message "Invalid OTP. Please try again."
      - On `FirebaseAuthException(code: 'session-expired')` → call `resetToPhoneEntry()`, surface message "OTP expired. Please request a new one."
      - On other `FirebaseAuthException` → stay on `OtpEntryState`, surface `e.message`
      - On success → call `_completeHmsVerification(phone, admissionId)`
    - Implement `signInWithAutoCredential({required PhoneAuthCredential credential, required String admissionId})` that calls `signInWithCredential(credential)` then `_completeHmsVerification()`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ] 6.2 Implement `_completeHmsVerification` private method
    - Inject or instantiate `HmsApiClient` within `AuthStateNotifier`
    - Call `HmsApiClient.checkRegistration(phoneNumber, admissionId)`
    - On success: write `CaregiverRole` to `caregiverRoleProvider`; `authStateProvider` stream will fire automatically from Firebase
    - On `HmsNotRegisteredError`: call `FirebaseAuth.instance.signOut()`, set `caregiverRoleProvider` to null, set `state` to `PhoneEntryState(errorMessage: 'Phone number not registered for this Admission ID.')`
    - On `HmsHttpError`: call `signOut()`, set `state` to `PhoneEntryState(errorMessage: 'HMS verification failed. Please try again.')`
    - On network exception: call `signOut()`, set `state` to `PhoneEntryState(errorMessage: 'Network error during HMS verification. Please check your connection.')`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 6.3 Write property tests for OTP verification and HMS flow
    - **Property 9: 6-digit OTP triggers signInWithCredential**
    - **Property 10: Short OTP prevents sign-in call**
    - **Property 13: HMS HTTP errors trigger signOut and reset**
    - **Validates: Requirements 5.1, 5.2, 6.4**
    - Generate 6-char numeric OTP strings and sub-6-char strings; generate HTTP status codes 400–599; mock `FirebaseAuth.signInWithCredential` and `HmsApiClient`

- [ ] 7. Checkpoint — core auth logic complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement `AuthStateNotifier` — sign-out and session restore
  - [ ] 8.1 Implement `signOut` and `restoreSession` methods
    - Implement `signOut()`: call `FirebaseAuth.instance.signOut()`, then set `caregiverRoleProvider.notifier.state = null`, then call `resetToPhoneEntry()`
    - Implement `restoreSession({required String admissionId})`: call `_completeHmsVerification` with `FirebaseAuth.instance.currentUser!.phoneNumber!` and `admissionId`
    - _Requirements: 7.4, 8.1, 8.2, 8.3_

  - [ ]* 8.2 Write property tests for sign-out and session restore
    - **Property 14: Session Restoration Triggers HMS Role Re-derivation**
    - **Property 15: Sign-out triggers reactive navigation**
    - **Validates: Requirements 7.4, 8.1, 8.2**
    - Generate `(User, admissionId)` pairs for session restore; test authenticated state transitions through `signOut()` sequence using `ProviderContainer`

- [ ] 9. Migrate `CareBridgeApp` in `main.dart` to `ConsumerWidget`
  - [ ] 9.1 Convert `CareBridgeApp` from `StatefulWidget` to `ConsumerWidget`
    - Remove `_CareBridgeAppState`, `_isAuthenticated`, `_currentRole`, `_handleLoginSuccess`, `_handleRoleSwitch` from `main.dart`
    - Convert `CareBridgeApp` to `ConsumerWidget`; inside `build`, watch `authStateProvider`
    - Use `authState.when(data:, loading:, error:)` to render `MainAppScaffold` (when user is non-null), `SplashScreen`/loading indicator (loading), or `AuthScreen` (null / error)
    - Remove the `onLoginSuccess` callback passed to `AuthScreen`
    - _Requirements: 3.2, 3.3, 3.4_

  - [ ]* 9.2 Write property tests for `CareBridgeApp` routing
    - **Property 2: Authenticated user renders main scaffold**
    - **Property 3: Unauthenticated state renders AuthScreen**
    - **Validates: Requirements 3.3, 3.4**
    - Use `ProviderContainer` with mocked `authStateProvider` override; test widget tree for presence of `MainAppScaffold` vs `AuthScreen`

- [ ] 10. Refactor `AuthScreen` to `ConsumerStatefulWidget`
  - [ ] 10.1 Convert `AuthScreen` to `ConsumerStatefulWidget` and wire notifier
    - Change `AuthScreen` from `StatefulWidget` to `ConsumerStatefulWidget` (and state to `ConsumerState`)
    - Remove `onLoginSuccess` callback parameter; remove all mock OTP logic and demo account buttons
    - Add `_admissionIdController`, `_phoneController`, `_otpController` `TextEditingController` fields
    - In `build`, watch `authNotifierProvider`; use `ref.listen` to display `SnackBar` when `PhoneEntryState.errorMessage` is non-null
    - Implement `_buildPhoneStep()`, `_buildOtpStep(OtpEntryState)`, `_buildLoading()` private builders
    - Phone step: "Send Phone OTP" button calls `ref.read(authNotifierProvider.notifier).requestOtp()`; disable button and show spinner when `LoadingState`
    - OTP step: "Verify OTP & Enter App" calls `ref.read(authNotifierProvider.notifier).verifyOtp()`; disable during loading
    - "Change Phone or Admission ID" button calls `ref.read(authNotifierProvider.notifier).resetToPhoneEntry()`; preserve phone/admissionId controller text
    - Retain the OTP step patient preview card using `admissionId` and phone from `OtpEntryState`, reading `caregiverRoleProvider` for role badge
    - _Requirements: 4.1–4.6, 5.1–5.6, 9.1, 9.2_

  - [ ]* 10.2 Write property tests for `AuthScreen` UI behavior
    - **Property 16: OTP reset clears verificationId and OTP text**
    - **Property 17: OTP reset preserves phone and admissionId field values**
    - **Validates: Requirements 9.1, 9.2**
    - Use `WidgetTester`; generate arbitrary `OtpEntryState` values and OTP text; verify `_otpController` cleared and phone/admissionId controllers unchanged after `resetToPhoneEntry()`

- [ ] 11. Refactor `ProfileScreen` to `ConsumerWidget` and remove `onLogout` callback
  - [ ] 11.1 Convert `ProfileScreen` to `ConsumerWidget`
    - Remove `VoidCallback onLogout` constructor parameter
    - Change `ProfileScreen` to a `ConsumerWidget`
    - Replace `onPressed: onLogout` on the sign-out button with `onPressed: () => ref.read(authNotifierProvider.notifier).signOut()`
    - Fix the existing `CrossAlignment` typo → `CrossAxisAlignment` throughout the file
    - Remove `onLogout` argument from `main.dart` where `ProfileScreen` is instantiated
    - _Requirements: 8.1, 8.2, 8.3_

- [ ] 12. Create `MainAppScaffold` with session restoration logic
  - [ ] 12.1 Extract the main scaffold + bottom nav to `MainAppScaffold` widget
    - Create `lib/features/dashboard/main_app_scaffold.dart` (or keep inline in `main.dart`)
    - Move `IndexedStack` + `BottomNavigationBar` + `_currentIndex` state from `_CareBridgeAppState` into `MainAppScaffold` as a `ConsumerStatefulWidget`
    - In `initState`, add a `WidgetsBinding.instance.addPostFrameCallback` callback: if `caregiverRoleProvider` is null and `storedAdmissionIdProvider` is non-empty, call `authNotifierProvider.notifier.restoreSession(admissionId: storedAdmissionId)`
    - Read `caregiverRoleProvider` to pass `currentRole` down to child screens
    - _Requirements: 7.1, 7.2, 7.4_

- [ ] 13. Persist `admissionId` via `SharedPreferences`
  - [ ] 13.1 Load and save `admissionId` with `SharedPreferences`
    - In `main()` (after `Firebase.initializeApp()`), read `admissionId` from `SharedPreferences` and override `storedAdmissionIdProvider` initial value inside `ProviderScope` using `overrides`
    - In `AuthStateNotifier.requestOtp` (or `_completeHmsVerification` on success), write the `admissionId` to `SharedPreferences` so it survives app restarts
    - _Requirements: 7.3, 7.4_

- [ ] 14. Final checkpoint — full integration
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The `google-services.json` file must be placed at `android/app/google-services.json` manually by the developer — it is not committed to VCS (Requirement 1.5)
- Property tests use `mocktail` for mocking `FirebaseAuth` and `HmsApiClient`; add `mocktail` to `dev_dependencies` in task 1.1
- The `CrossAlignment` → `CrossAxisAlignment` fix in `profile_screen.dart` (task 11.1) corrects a pre-existing compile error unrelated to this feature

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3"] },
    { "id": 4, "tasks": ["5.1", "6.2"] },
    { "id": 5, "tasks": ["5.2", "6.1"] },
    { "id": 6, "tasks": ["6.3", "8.1"] },
    { "id": 7, "tasks": ["8.2", "9.1"] },
    { "id": 8, "tasks": ["9.2", "10.1", "11.1"] },
    { "id": 9, "tasks": ["10.2", "12.1"] },
    { "id": 10, "tasks": ["13.1"] }
  ]
}
```
