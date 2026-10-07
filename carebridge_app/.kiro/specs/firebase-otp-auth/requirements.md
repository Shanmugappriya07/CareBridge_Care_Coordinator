# Requirements Document

## Introduction

This feature replaces the mock OTP authentication in the CareBridge Flutter mobile app with real Firebase Phone Authentication. The app currently uses a simulated OTP flow in `lib/features/auth/auth_screen.dart` with hardcoded credentials and no real verification. The new implementation integrates Firebase Auth for OTP delivery and verification, then calls the HMS (Hospital Management System) backend API to validate that the phone number is registered as a caregiver for the given Admission ID, and derives the caregiver's role (`CaregiverRole.primary` or `CaregiverRole.family`) from the HMS API response. Auth state is managed via a Riverpod `StreamProvider` watching `FirebaseAuth.authStateChanges()`, and `main.dart` is migrated from `setState`-based auth to `ProviderScope` + Riverpod.

## Glossary

- **AuthScreen**: The Flutter widget in `lib/features/auth/auth_screen.dart` that presents the OTP login UI.
- **AuthStateNotifier**: The Riverpod `AsyncNotifier` or `StateNotifier` responsible for driving the authentication state machine.
- **AuthStateProvider**: The Riverpod `StreamProvider` (or `StateNotifierProvider`) that exposes the current authentication state to the widget tree.
- **CaregiverRole**: The Dart enum defined in `app_constants.dart` with values `primary` and `family`, representing the level of access granted to the authenticated user.
- **FirebaseAuth**: The `firebase_auth` Flutter package used for phone number verification and OTP sign-in.
- **HmsApiClient**: The service class responsible for calling the HMS backend REST API to validate caregiver registration.
- **HmsRegistrationCheck**: The HMS backend API call that verifies whether a given phone number is registered as a caregiver for a given Admission ID, and returns the associated `CaregiverRole`.
- **OTP**: A one-time password sent via SMS through Firebase to the user's registered phone number.
- **ProviderScope**: The Riverpod widget that must wrap the `MaterialApp` in `main.dart` to provide the Riverpod container to the entire widget tree.
- **Session**: The Firebase Auth persistent session, automatically restored on app launch via `FirebaseAuth.instance.currentUser` and `FirebaseAuth.instance.authStateChanges()`.
- **VerificationId**: The string token returned by Firebase during phone number verification, required to construct the `PhoneAuthCredential` for sign-in.

---

## Requirements

### Requirement 1: Firebase and Riverpod Project Setup

**User Story:** As a developer, I want the project dependencies and Android configuration to be correctly set up for Firebase Phone Auth, so that the app can compile and connect to Firebase services.

#### Acceptance Criteria

1. THE CareBridge app's `pubspec.yaml` SHALL declare `firebase_core` and `firebase_auth` as dependencies with explicit pinned version constraints.
2. THE CareBridge app's `pubspec.yaml` SHALL retain the existing `flutter_riverpod: ^2.4.9` dependency without modification.
3. THE Android build configuration SHALL set `minSdk` to `21` explicitly, overriding `flutter.minSdkVersion`.
4. THE Android build configuration SHALL apply the `google-services` Gradle plugin so that Firebase services are initialized from `google-services.json`.
5. WHEN `google-services.json` is absent from `android/app/`, THE app build process SHALL fail with a clear Gradle error rather than silently misconfiguring Firebase.

---

### Requirement 2: Firebase Initialization

**User Story:** As a developer, I want Firebase to be initialized before the app UI renders, so that FirebaseAuth is available for all subsequent auth operations.

#### Acceptance Criteria

1. WHEN the app starts, THE `main()` function SHALL call `WidgetsFlutterBinding.ensureInitialized()` before calling `Firebase.initializeApp()`.
2. WHEN `Firebase.initializeApp()` completes, THE `main()` function SHALL wrap `CareBridgeApp` in a `ProviderScope` widget before calling `runApp()`.
3. IF `Firebase.initializeApp()` throws an exception, THEN THE app SHALL display a fatal error screen with the error message and SHALL NOT proceed to the auth or main app flow.

---

### Requirement 3: Riverpod Auth State Management

**User Story:** As a developer, I want auth state managed by Riverpod, so that the widget tree reactively rebuilds when the authentication state changes without using `setState` in `main.dart`.

#### Acceptance Criteria

1. THE `AuthStateProvider` SHALL expose a stream derived from `FirebaseAuth.instance.authStateChanges()` so that all consumers receive updates when the Firebase user signs in or signs out.
2. THE `CareBridgeApp` widget SHALL be converted from a `StatefulWidget` using `setState` to a `ConsumerWidget` (or `ConsumerStatefulWidget`) that reads `AuthStateProvider`.
3. WHEN `AuthStateProvider` emits a non-null `User`, THE `CareBridgeApp` SHALL render the authenticated main app scaffold.
4. WHEN `AuthStateProvider` emits a null `User`, THE `CareBridgeApp` SHALL render the `AuthScreen` widget.
5. THE `CaregiverRole` resolved after HMS verification SHALL be stored in a separate Riverpod `StateProvider` so that all screens reading the role rebuild reactively on role changes.

---

### Requirement 4: OTP Request — Phone Number Submission

**User Story:** As a caregiver, I want to enter my Admission ID and phone number to request an OTP, so that Firebase sends an SMS to my registered phone.

#### Acceptance Criteria

1. WHEN the user taps "Send Phone OTP" with a non-empty Admission ID and a non-empty phone number, THE AuthScreen SHALL invoke `FirebaseAuth.instance.verifyPhoneNumber()` with the entered phone number.
2. WHEN `FirebaseAuth.instance.verifyPhoneNumber()` invokes the `codeSent` callback, THE AuthScreen SHALL transition to the OTP entry step and store the `VerificationId` in widget state.
3. WHEN `FirebaseAuth.instance.verifyPhoneNumber()` invokes the `verificationFailed` callback, THE AuthScreen SHALL display the Firebase error message in a `SnackBar` and SHALL remain on the phone entry step.
4. WHEN `FirebaseAuth.instance.verifyPhoneNumber()` invokes the `verificationCompleted` callback (auto-retrieval on Android), THE AuthScreen SHALL automatically proceed to HMS registration verification using the auto-resolved `PhoneAuthCredential`.
5. WHEN the user taps "Send Phone OTP" with an empty Admission ID or an empty phone number, THE AuthScreen SHALL display a `SnackBar` with the message "Please enter Admission ID and Mobile Number" and SHALL NOT call `FirebaseAuth.instance.verifyPhoneNumber()`.
6. WHILE OTP request is in progress, THE AuthScreen SHALL display a loading indicator and SHALL disable the "Send Phone OTP" button to prevent duplicate submissions.

---

### Requirement 5: OTP Verification — Firebase Sign-In

**User Story:** As a caregiver, I want to enter the 6-digit OTP I received via SMS and have it verified by Firebase, so that my identity is confirmed before the app checks HMS registration.

#### Acceptance Criteria

1. WHEN the user taps "Verify OTP & Enter App" with a 6-digit OTP entered, THE AuthScreen SHALL construct a `PhoneAuthCredential` using the stored `VerificationId` and the entered OTP, then call `FirebaseAuth.instance.signInWithCredential()`.
2. WHEN the user taps "Verify OTP & Enter App" with fewer than 6 digits entered, THE AuthScreen SHALL display a `SnackBar` with the message "Please enter valid 6-digit OTP" and SHALL NOT call `FirebaseAuth.instance.signInWithCredential()`.
3. IF `FirebaseAuth.instance.signInWithCredential()` throws a `FirebaseAuthException` with code `invalid-verification-code`, THEN THE AuthScreen SHALL display a `SnackBar` with the message "Invalid OTP. Please try again." and SHALL remain on the OTP entry step.
4. IF `FirebaseAuth.instance.signInWithCredential()` throws a `FirebaseAuthException` with code `session-expired`, THEN THE AuthScreen SHALL display a `SnackBar` with the message "OTP expired. Please request a new one." and SHALL reset to the phone entry step.
5. IF `FirebaseAuth.instance.signInWithCredential()` throws any other `FirebaseAuthException`, THEN THE AuthScreen SHALL display a `SnackBar` with the Firebase error message and SHALL remain on the OTP entry step.
6. WHILE OTP verification is in progress, THE AuthScreen SHALL display a loading indicator and SHALL disable the "Verify OTP & Enter App" button.

---

### Requirement 6: HMS Registration Verification

**User Story:** As a caregiver, I want the app to confirm with the hospital system that my phone number is registered for the given Admission ID, so that only authorized caregivers can access patient data.

#### Acceptance Criteria

1. WHEN `FirebaseAuth.instance.signInWithCredential()` succeeds, THE `HmsApiClient` SHALL call the HMS backend registration check endpoint with the verified phone number and the Admission ID entered by the user.
2. WHEN the HMS registration check returns a successful response, THE AuthScreen SHALL extract the `CaregiverRole` from the response and store it in the `CaregiverRole` `StateProvider`.
3. IF the HMS registration check returns a response indicating the phone number is not registered for the given Admission ID, THEN THE `AuthStateNotifier` SHALL call `FirebaseAuth.instance.signOut()` and THE AuthScreen SHALL display a `SnackBar` with the message "Phone number not registered for this Admission ID." and SHALL reset to the phone entry step.
4. IF the HMS registration check returns an HTTP error status (4xx or 5xx), THEN THE `AuthStateNotifier` SHALL call `FirebaseAuth.instance.signOut()` and THE AuthScreen SHALL display a `SnackBar` with the message "HMS verification failed. Please try again." and SHALL reset to the phone entry step.
5. IF the HMS registration check call throws a network exception (e.g., no internet connectivity), THEN THE `AuthStateNotifier` SHALL call `FirebaseAuth.instance.signOut()` and THE AuthScreen SHALL display a `SnackBar` with the message "Network error during HMS verification. Please check your connection." and SHALL reset to the phone entry step.
6. WHILE HMS registration verification is in progress after a successful Firebase sign-in, THE AuthScreen SHALL display a loading indicator and SHALL prevent user interaction with the OTP entry fields.

---

### Requirement 7: Session Persistence and Restoration

**User Story:** As a caregiver, I want my login session to persist across app restarts, so that I do not need to re-enter my OTP every time I open the app.

#### Acceptance Criteria

1. WHEN the app launches and `FirebaseAuth.instance.currentUser` is non-null, THE `AuthStateProvider` SHALL emit the authenticated user immediately, bypassing the `AuthScreen`.
2. WHEN the app launches and `FirebaseAuth.instance.currentUser` is null, THE `AuthStateProvider` SHALL emit null and THE app SHALL render the `AuthScreen`.
3. THE CareBridge app SHALL NOT use `flutter_secure_storage` or a custom JWT for session management; THE `AuthStateProvider` SHALL rely exclusively on Firebase Auth's native session persistence.
4. WHEN a previously authenticated session is restored on app launch, THE app SHALL re-derive `CaregiverRole` by calling the HMS registration check with the restored Firebase user's phone number and the stored Admission ID, before rendering the main app scaffold.

---

### Requirement 8: Sign-Out

**User Story:** As a caregiver, I want to be able to sign out of the app, so that my session is terminated and the app returns to the login screen.

#### Acceptance Criteria

1. WHEN the user triggers sign-out from the `ProfileScreen`, THE app SHALL call `FirebaseAuth.instance.signOut()`.
2. WHEN `FirebaseAuth.instance.signOut()` completes, THE `AuthStateProvider` SHALL emit null and THE `CareBridgeApp` SHALL render the `AuthScreen` reactively without requiring explicit navigation.
3. THE `ProfileScreen` `onLogout` callback SHALL be replaced with a call to the `AuthStateNotifier`'s sign-out method rather than using `setState(() => _isAuthenticated = false)` in `main.dart`.

---

### Requirement 9: OTP Resend

**User Story:** As a caregiver, I want to be able to request a new OTP if the original one expires or is not received, so that I can complete login without restarting the app.

#### Acceptance Criteria

1. WHEN the user taps "Change Phone or Admission ID" on the OTP entry step, THE AuthScreen SHALL reset to the phone entry step, clearing the stored `VerificationId` and the OTP text field.
2. WHEN the AuthScreen resets to the phone entry step after an OTP expiry, THE Admission ID and phone number fields SHALL retain the previously entered values so the user can re-submit without retyping.
3. WHEN the user re-submits the phone number after resetting, THE AuthScreen SHALL invoke `FirebaseAuth.instance.verifyPhoneNumber()` again as a new OTP request following the same flow as Requirement 4.
