# Design Document

## Overview

This design replaces the mock OTP authentication in CareBridge's `auth_screen.dart` with real Firebase Phone Authentication, integrates HMS backend registration verification, and migrates `main.dart` from `setState`-based auth to a fully reactive Riverpod architecture. The feature spans three concerns: Firebase initialization, Riverpod-managed auth state, and a two-stage login flow (Firebase OTP → HMS registration check).

---

## Components and Interfaces

See detailed component descriptions below.

---

## Architecture

### Layer Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer                             │
│  main.dart (ConsumerWidget)  ←  AuthScreen (Consumer)  │
│  ProfileScreen (sign-out trigger)                       │
└────────────────────┬────────────────────────────────────┘
                     │ reads/watches
┌────────────────────▼────────────────────────────────────┐
│               Riverpod Providers Layer                  │
│  authStateProvider (StreamProvider<User?>)              │
│  caregiverRoleProvider (StateProvider<CaregiverRole?>)  │
│  storedAdmissionIdProvider (StateProvider<String>)      │
│  authNotifierProvider (AsyncNotifierProvider)           │
└────────────────────┬────────────────────────────────────┘
                     │ calls
┌────────────────────▼────────────────────────────────────┐
│              Service / Data Layer                       │
│  FirebaseAuth (firebase_auth package)                   │
│  HmsApiClient (lib/core/services/hms_api_client.dart)   │
└─────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **`authStateProvider` as a `StreamProvider`** — wraps `FirebaseAuth.instance.authStateChanges()` directly. This means sign-in and sign-out are automatically reflected in the UI without any manual state mutation.

2. **`AuthStateNotifier` as an `AsyncNotifier`** — handles the two-step login sequence (verifyPhoneNumber → signInWithCredential → HMS check) as a state machine. The notifier encapsulates all side effects and error handling so the `AuthScreen` widget stays pure UI.

3. **`caregiverRoleProvider` as a `StateProvider<CaregiverRole?>`** — role is stored independently from the Firebase auth state because it requires an HMS round-trip. All screens reading the role rebuild reactively when it changes.

4. **`storedAdmissionIdProvider` as a `StateProvider<String>`** — persists the last-entered Admission ID so it is available for session restoration and OTP resend flows.

5. **`ProviderScope` at the root** — wraps `CareBridgeApp` after Firebase initialization to ensure all providers can access Firebase services.

---

## Components

### 1. `main.dart` (migrated)

**File:** `lib/main.dart`

Migrated from `StatefulWidget` + `setState` to async `main()` with Firebase init and `ConsumerWidget`.

```dart
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    runApp(const ProviderScope(child: CareBridgeApp()));
  } catch (e) {
    runApp(FirebaseInitErrorApp(error: e.toString()));
  }
}

class CareBridgeApp extends ConsumerWidget {
  const CareBridgeApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    return MaterialApp(
      home: authState.when(
        data: (user) => user != null ? const MainAppScaffold() : const AuthScreen(),
        loading: () => const SplashScreen(),
        error: (_, __) => const AuthScreen(),
      ),
    );
  }
}
```

**`FirebaseInitErrorApp`** — a standalone `MaterialApp` with no providers that renders a `Scaffold` displaying the initialization error. It is intentionally kept outside `ProviderScope` because Firebase failed to start.

---

### 2. Riverpod Providers

**File:** `lib/core/providers/auth_providers.dart`

```dart
// Reactive stream from Firebase
final authStateProvider = StreamProvider<User?>((ref) {
  return FirebaseAuth.instance.authStateChanges();
});

// Role resolved after HMS verification; null until verified
final caregiverRoleProvider = StateProvider<CaregiverRole?>((ref) => null);

// Last Admission ID entered — persisted for session restore & OTP resend
final storedAdmissionIdProvider = StateProvider<String>((ref) => '');

// The auth state machine notifier
final authNotifierProvider =
    AsyncNotifierProvider<AuthStateNotifier, AuthFlowState>(
      AuthStateNotifier.new,
    );
```

**`AuthFlowState`** — a sealed class (or enum-backed union) representing the current step of the login flow:

```dart
sealed class AuthFlowState {
  const AuthFlowState();
}

class PhoneEntryState extends AuthFlowState {
  final String? errorMessage;
  const PhoneEntryState({this.errorMessage});
}

class OtpEntryState extends AuthFlowState {
  final String verificationId;
  final String phone;
  final String admissionId;
  const OtpEntryState({
    required this.verificationId,
    required this.phone,
    required this.admissionId,
  });
}

class LoadingState extends AuthFlowState {
  const LoadingState();
}
```

---

### 3. `AuthStateNotifier`

**File:** `lib/features/auth/auth_state_notifier.dart`

The central state machine for the two-step authentication flow. All Firebase and HMS calls flow through here.

```dart
class AuthStateNotifier extends AsyncNotifier<AuthFlowState> {
  @override
  Future<AuthFlowState> build() async {
    return const PhoneEntryState();
  }

  /// Step 1: Send OTP via Firebase Phone Auth
  Future<void> requestOtp({
    required String phoneNumber,
    required String admissionId,
  }) async { ... }

  /// Step 2a: User-entered OTP verification
  Future<void> verifyOtp({
    required String otp,
    required String verificationId,
    required String admissionId,
  }) async { ... }

  /// Step 2b: Auto-retrieved credential (Android)
  Future<void> signInWithAutoCredential({
    required PhoneAuthCredential credential,
    required String admissionId,
  }) async { ... }

  /// Shared HMS check + role derivation after successful Firebase sign-in
  Future<void> _completeHmsVerification({
    required String phoneNumber,
    required String admissionId,
  }) async { ... }

  /// Session restore on app launch when currentUser is non-null
  Future<void> restoreSession({
    required String admissionId,
  }) async { ... }

  /// Sign out: Firebase + role cleanup
  Future<void> signOut() async {
    await FirebaseAuth.instance.signOut();
    ref.read(caregiverRoleProvider.notifier).state = null;
  }

  /// Reset to phone entry (OTP resend / change number)
  void resetToPhoneEntry() {
    state = const AsyncData(PhoneEntryState());
  }
}
```

#### OTP Request Flow (`requestOtp`)

```
User taps "Send Phone OTP"
        │
        ▼
Validate: admissionId non-empty AND phone non-empty
        │ fail → SnackBar "Please enter Admission ID and Mobile Number"
        │ pass ↓
state = LoadingState
        │
        ▼
FirebaseAuth.verifyPhoneNumber(
  phoneNumber: phone,
  verificationCompleted: (credential) → signInWithAutoCredential(),
  verificationFailed: (e) → state = PhoneEntryState(error: e.message),
  codeSent: (verificationId, resendToken) → state = OtpEntryState(verificationId, phone, admissionId),
  codeAutoRetrievalTimeout: (_) → {},
)
```

#### OTP Verification Flow (`verifyOtp`)

```
User taps "Verify OTP & Enter App"
        │
        ▼
Validate: otp.length == 6
        │ fail → SnackBar "Please enter valid 6-digit OTP"
        │ pass ↓
state = LoadingState
        │
        ▼
credential = PhoneAuthProvider.credential(verificationId, otp)
        │
        ▼
FirebaseAuth.signInWithCredential(credential)
        │ FirebaseAuthException(invalid-verification-code) → SnackBar + stay OtpEntryState
        │ FirebaseAuthException(session-expired) → SnackBar + resetToPhoneEntry()
        │ other FirebaseAuthException → SnackBar(e.message) + stay OtpEntryState
        │ success ↓
_completeHmsVerification(phone, admissionId)
```

#### HMS Verification Flow (`_completeHmsVerification`)

```
HmsApiClient.checkRegistration(phone, admissionId)
        │ success → caregiverRoleProvider.state = derivedRole
        │           authStateProvider stream fires (Firebase user is set)
        │           → CareBridgeApp renders MainAppScaffold
        │
        │ HmsNotRegisteredError → FirebaseAuth.signOut()
        │   SnackBar "Phone number not registered for this Admission ID."
        │   resetToPhoneEntry()
        │
        │ HmsHttpError (4xx/5xx) → FirebaseAuth.signOut()
        │   SnackBar "HMS verification failed. Please try again."
        │   resetToPhoneEntry()
        │
        │ NetworkException → FirebaseAuth.signOut()
        │   SnackBar "Network error during HMS verification. Please check your connection."
        │   resetToPhoneEntry()
```

---

### 4. `HmsApiClient`

**File:** `lib/core/services/hms_api_client.dart`

A thin HTTP service wrapping the HMS registration check endpoint. Uses `dart:io` `HttpClient` or the existing `http` package already in `pubspec.yaml`.

```dart
class HmsApiClient {
  final String baseUrl;

  const HmsApiClient({this.baseUrl = AppConstants.apiBaseUrl});

  /// Calls POST /auth/caregiver-verify
  /// Returns [HmsRegistrationResult] with the resolved [CaregiverRole].
  /// Throws [HmsNotRegisteredError], [HmsHttpError], or propagates network exceptions.
  Future<HmsRegistrationResult> checkRegistration({
    required String phoneNumber,
    required String admissionId,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/caregiver-verify'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'phoneNumber': phoneNumber,
        'admissionId': admissionId,
      }),
    );

    if (response.statusCode == 200) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      return HmsRegistrationResult.fromJson(body);
    } else if (response.statusCode == 404) {
      throw HmsNotRegisteredError();
    } else {
      throw HmsHttpError(statusCode: response.statusCode);
    }
  }
}

class HmsRegistrationResult {
  final CaregiverRole role;
  final String caregiverId;

  const HmsRegistrationResult({required this.role, required this.caregiverId});

  factory HmsRegistrationResult.fromJson(Map<String, dynamic> json) {
    final roleStr = json['role'] as String;
    return HmsRegistrationResult(
      role: roleStr == 'primary' ? CaregiverRole.primary : CaregiverRole.family,
      caregiverId: json['caregiverId'] as String,
    );
  }
}

class HmsNotRegisteredError implements Exception {}

class HmsHttpError implements Exception {
  final int statusCode;
  const HmsHttpError({required this.statusCode});
}
```

---

### 5. `AuthScreen` (refactored)

**File:** `lib/features/auth/auth_screen.dart`

Converted to a `ConsumerStatefulWidget`. Removes the `onLoginSuccess` callback. All logic delegates to `authNotifierProvider`; the widget only handles text controllers, SnackBar display from notifier errors, and rendering based on `AuthFlowState`.

```dart
class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _phoneController = TextEditingController();
  final _admissionIdController = TextEditingController();
  final _otpController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final authFlowState = ref.watch(authNotifierProvider);

    // Show SnackBar on errors from PhoneEntryState
    ref.listen(authNotifierProvider, (previous, next) {
      if (next is AsyncData<AuthFlowState>) {
        final flowState = next.value;
        if (flowState is PhoneEntryState && flowState.errorMessage != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(flowState.errorMessage!)),
          );
        }
      }
    });

    return authFlowState.when(
      data: (flowState) => switch (flowState) {
        LoadingState() => _buildLoading(),
        OtpEntryState() => _buildOtpStep(flowState),
        PhoneEntryState() => _buildPhoneStep(),
      },
      loading: () => _buildLoading(),
      error: (e, _) => _buildPhoneStep(),
    );
  }
  // ... _buildPhoneStep(), _buildOtpStep(), _buildLoading() widgets
}
```

**Key change:** The "Change Phone or Admission ID" button calls `ref.read(authNotifierProvider.notifier).resetToPhoneEntry()`, which restores the `PhoneEntryState` while the phone/admissionId controllers retain their values.

---

### 6. `ProfileScreen` (updated sign-out)

The `onLogout` `VoidCallback` parameter is removed. The screen reads `authNotifierProvider` and calls `signOut()` directly:

```dart
class ProfileScreen extends ConsumerWidget {
  final CaregiverRole currentRole;
  const ProfileScreen({super.key, required this.currentRole});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // ...
    OutlinedButton.icon(
      onPressed: () => ref.read(authNotifierProvider.notifier).signOut(),
      icon: const Icon(Icons.logout),
      label: const Text('Sign Out Caregiver Account'),
    );
  }
}
```

---

### 7. Session Restoration

**File:** `lib/features/auth/auth_screen.dart` or `lib/core/providers/auth_providers.dart`

When `CareBridgeApp` detects a non-null `authState` user on startup via `authStateProvider`, it routes to `MainAppScaffold`. However, `caregiverRoleProvider` will be null at this point because the HMS check has not run for the restored session.

`MainAppScaffold` watches `caregiverRoleProvider` on initialization and triggers `authNotifierProvider.notifier.restoreSession()` if the role is null and a Firebase user is present:

```dart
class MainAppScaffold extends ConsumerStatefulWidget {
  @override
  ConsumerState<MainAppScaffold> createState() => _MainAppScaffoldState();
}

class _MainAppScaffoldState extends ConsumerState<MainAppScaffold> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final role = ref.read(caregiverRoleProvider);
      final admissionId = ref.read(storedAdmissionIdProvider);
      if (role == null && admissionId.isNotEmpty) {
        ref.read(authNotifierProvider.notifier).restoreSession(admissionId: admissionId);
      }
    });
  }
}
```

> **Note on `storedAdmissionIdProvider`:** The Admission ID must survive app restarts to enable session restoration. It is written to `SharedPreferences` (already in `pubspec.yaml`) when the user first successfully logs in, and loaded into `storedAdmissionIdProvider` during Firebase initialization.

---

## Data Models

### `AuthFlowState` (sealed class hierarchy)

| State | Fields | When active |
|---|---|---|
| `PhoneEntryState` | `errorMessage: String?` | Initial state; after errors; after sign-out |
| `OtpEntryState` | `verificationId`, `phone`, `admissionId` | After `codeSent` from Firebase |
| `LoadingState` | — | During any async operation |

### `HmsRegistrationResult`

| Field | Type | Description |
|---|---|---|
| `role` | `CaregiverRole` | `primary` or `family` from HMS response |
| `caregiverId` | `String` | HMS caregiver identifier |

### `HmsRegistrationResult.fromJson` mapping

| JSON key | Dart value |
|---|---|
| `"role": "primary"` | `CaregiverRole.primary` |
| `"role": "family"` | `CaregiverRole.family` |
| `"caregiverId"` | `String` |

---

## Error Handling

| Scenario | Recovery Action | SnackBar Message |
|---|---|---|
| Firebase `verificationFailed` | Stay on `PhoneEntryState` | Firebase error message |
| Firebase `invalid-verification-code` | Stay on `OtpEntryState` | "Invalid OTP. Please try again." |
| Firebase `session-expired` | Reset to `PhoneEntryState` | "OTP expired. Please request a new one." |
| Other `FirebaseAuthException` | Stay on `OtpEntryState` | `e.message` |
| HMS 404 (not registered) | `signOut()` + `PhoneEntryState` | "Phone number not registered for this Admission ID." |
| HMS 4xx/5xx | `signOut()` + `PhoneEntryState` | "HMS verification failed. Please try again." |
| Network exception during HMS | `signOut()` + `PhoneEntryState` | "Network error during HMS verification. Please check your connection." |
| Firebase init failure | Show `FirebaseInitErrorApp` | Error message displayed inline |
| Empty Admission ID / phone | Stay on `PhoneEntryState` | "Please enter Admission ID and Mobile Number" |
| OTP < 6 digits | Stay on `OtpEntryState` | "Please enter valid 6-digit OTP" |

---

## File Structure

```
lib/
├── main.dart                          # Migrated: async init + ProviderScope + ConsumerWidget
├── core/
│   ├── constants/
│   │   └── app_constants.dart         # Unchanged (CaregiverRole enum lives here)
│   ├── providers/
│   │   └── auth_providers.dart        # NEW: authStateProvider, caregiverRoleProvider,
│   │                                  #      storedAdmissionIdProvider, authNotifierProvider
│   ├── services/
│   │   └── hms_api_client.dart        # NEW: HmsApiClient, HmsRegistrationResult, error types
│   └── theme/
│       └── app_theme.dart             # Unchanged
├── features/
│   ├── auth/
│   │   ├── auth_screen.dart           # MODIFIED: ConsumerStatefulWidget, no onLoginSuccess
│   │   ├── auth_state_notifier.dart   # NEW: AuthStateNotifier + AuthFlowState sealed classes
│   │   └── firebase_init_error_app.dart # NEW: Standalone error widget for init failures
│   ├── profile/
│   │   └── profile_screen.dart        # MODIFIED: ConsumerWidget, no onLogout callback
│   └── dashboard/
│       └── dashboard_screen.dart      # Unchanged
android/
├── app/
│   ├── build.gradle.kts               # MODIFIED: minSdk=21, google-services plugin
│   ├── google-services.json           # NEW: Added by developer (not committed to VCS)
│   └── src/...
├── build.gradle.kts                   # MODIFIED: google-services classpath dependency
pubspec.yaml                           # MODIFIED: firebase_core, firebase_auth added
```

---

## Android Configuration Changes

### `android/app/build.gradle.kts`

```kotlin
plugins {
    id("com.android.application")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")  // ADD: Firebase google-services
}

android {
    defaultConfig {
        minSdk = 21  // CHANGE: from flutter.minSdkVersion
        // ...
    }
}
```

### `android/build.gradle.kts` (project-level)

```kotlin
buildscript {
    dependencies {
        classpath("com.google.gms:google-services:4.4.2")
    }
}
```

### `pubspec.yaml` additions

```yaml
dependencies:
  firebase_core: ^3.6.0
  firebase_auth: ^5.3.1
  flutter_riverpod: ^2.4.9   # unchanged
  shared_preferences: ^2.2.2  # unchanged, used for admissionId persistence
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Redundancy Analysis

Before listing properties, redundancy review:

- **3.3 and 3.4** (auth state → scaffold routing) are complementary, not redundant. Keep both.
- **4.1 and 9.3** (submitting non-empty phone/admissionId calls verifyPhoneNumber) — 9.3 is a repeat of 4.1 in a different scenario. One property covers both: "for any non-empty admissionId and phone, verifyPhoneNumber is called."
- **4.2 and 4.3** address different callbacks; both are kept.
- **5.1 and 5.2** test two sides of OTP submission (valid vs. short input); both kept.
- **6.1 and 6.2** are sequential steps in the HMS flow; both kept as they test different invariants.
- **9.1 and 9.2** are complementary reset properties; keep both.

After reflection: 13 distinct properties covering all testable acceptance criteria.

---

### Property 1: Auth state stream propagation

*For any* sequence of `User?` values emitted by the underlying `FirebaseAuth.authStateChanges()` stream, the `authStateProvider` SHALL emit those same values in the same order to all consumers.

**Validates: Requirements 3.1**

---

### Property 2: Authenticated user renders main scaffold

*For any* non-null `User` emitted by `authStateProvider`, `CareBridgeApp` SHALL render the `MainAppScaffold` and SHALL NOT render the `AuthScreen`.

**Validates: Requirements 3.3**

---

### Property 3: Unauthenticated state renders AuthScreen

*For any* null emission from `authStateProvider`, `CareBridgeApp` SHALL render the `AuthScreen` and SHALL NOT render the `MainAppScaffold`.

**Validates: Requirements 3.4**

---

### Property 4: CaregiverRole StateProvider round-trip

*For any* `CaregiverRole` value written to `caregiverRoleProvider`, reading `caregiverRoleProvider` immediately afterward SHALL return that same value, and all widgets watching it SHALL rebuild to reflect the new role.

**Validates: Requirements 3.5**

---

### Property 5: Non-empty inputs trigger OTP request

*For any* non-empty `admissionId` string and non-empty `phoneNumber` string, when the user submits the phone entry form, `FirebaseAuth.instance.verifyPhoneNumber()` SHALL be called exactly once with that `phoneNumber`.

**Validates: Requirements 4.1, 9.3**

---

### Property 6: codeSent callback stores verificationId

*For any* `verificationId` string delivered by the Firebase `codeSent` callback, `AuthStateNotifier` SHALL transition to `OtpEntryState` with `state.verificationId == verificationId`.

**Validates: Requirements 4.2**

---

### Property 7: verificationFailed shows Firebase error message

*For any* `FirebaseAuthException` delivered by the `verificationFailed` callback, the `AuthScreen` SHALL display a `SnackBar` whose text equals `exception.message`, and the state SHALL remain at `PhoneEntryState`.

**Validates: Requirements 4.3**

---

### Property 8: Empty inputs prevent OTP request

*For any* `(admissionId, phoneNumber)` pair where at least one is empty or blank, tapping "Send Phone OTP" SHALL NOT call `FirebaseAuth.instance.verifyPhoneNumber()` and SHALL display a `SnackBar` with text "Please enter Admission ID and Mobile Number".

**Validates: Requirements 4.5**

---

### Property 9: 6-digit OTP triggers signInWithCredential

*For any* 6-character numeric OTP string and any non-empty `verificationId`, tapping "Verify OTP & Enter App" SHALL call `FirebaseAuth.instance.signInWithCredential()` with a `PhoneAuthCredential` constructed from that `verificationId` and OTP.

**Validates: Requirements 5.1**

---

### Property 10: Short OTP prevents sign-in call

*For any* OTP string with fewer than 6 characters, tapping "Verify OTP & Enter App" SHALL NOT call `FirebaseAuth.instance.signInWithCredential()` and SHALL display a `SnackBar` with text "Please enter valid 6-digit OTP".

**Validates: Requirements 5.2**

---

### Property 11: HMS called with exact phone and admissionId after sign-in

*For any* `(phoneNumber, admissionId)` pair, after a successful `signInWithCredential()`, `HmsApiClient.checkRegistration()` SHALL be called with `phoneNumber` equal to the verified Firebase user's phone number and `admissionId` equal to the value entered by the user.

**Validates: Requirements 6.1**

---

### Property 12: HMS role response stored in provider

*For any* `CaregiverRole` value returned in the HMS registration success response, `caregiverRoleProvider` SHALL be set to that exact role value.

**Validates: Requirements 6.2**

---

### Property 13: HMS HTTP errors trigger signOut and reset

*For any* HTTP status code in the range 400–599 returned by the HMS registration endpoint, `FirebaseAuth.instance.signOut()` SHALL be called, `caregiverRoleProvider` SHALL be set to null, and the `AuthScreen` SHALL display the appropriate error `SnackBar` and reset to `PhoneEntryState`.

**Validates: Requirements 6.4**

---

### Property 14: Session Restoration Triggers HMS Role Re-derivation

*For any* non-null restored `User` with a stored `admissionId`, on app launch `HmsApiClient.checkRegistration()` SHALL be called with the user's phone number and the stored `admissionId`, and `caregiverRoleProvider` SHALL be updated from the response before `MainAppScaffold` renders.

**Validates: Requirements 7.4**

---

### Property 15: Sign-out triggers reactive navigation

*For any* authenticated state, calling `AuthStateNotifier.signOut()` SHALL cause `FirebaseAuth.instance.signOut()` to be called, `authStateProvider` SHALL emit null, and `CareBridgeApp` SHALL render `AuthScreen` without any explicit navigation call.

**Validates: Requirements 8.1, 8.2**

---

### Property 16: OTP reset clears verificationId and OTP text

*For any* `OtpEntryState` with any `verificationId` string and any non-empty OTP text field value, calling `resetToPhoneEntry()` SHALL transition the state to `PhoneEntryState`, and the `_otpController` text SHALL be cleared.

**Validates: Requirements 9.1**

---

### Property 17: OTP reset preserves phone and admissionId field values

*For any* previously entered `(admissionId, phoneNumber)` pair, after `resetToPhoneEntry()` is called, the Admission ID and phone number text field controllers SHALL retain those values unchanged.

**Validates: Requirements 9.2**


---

## Testing Strategy

### Unit and Property Tests

Property-based tests are the primary tool for validating correctness properties 1–17 listed above. Each test uses a mock `FirebaseAuth` and mock `HmsApiClient` so tests run in-memory with no real network or Firebase calls.

- **Properties 1, 4**: Use generated streams / state sequences to verify reactive propagation
- **Properties 2, 3**: Use `ProviderContainer` with mock `authStateProvider` override, assert widget tree
- **Properties 5, 8**: Generate random `(admissionId, phoneNumber)` pairs (empty/non-empty), assert `verifyPhoneNumber` call count
- **Properties 6, 7**: Inject mock Firebase callbacks, assert `AuthFlowState` transitions
- **Properties 9, 10**: Generate 6-char and sub-6-char OTP strings, assert `signInWithCredential` call
- **Properties 11, 12**: Generate `(phoneNumber, admissionId, CaregiverRole)` triples, assert HMS call params and role provider value
- **Property 13**: Generate HTTP status codes 400–599, assert `signOut` called and `PhoneEntryState` reached
- **Property 14**: Generate `(User, admissionId)` pairs, assert HMS called on session restore
- **Property 15**: Any authenticated state → `signOut()` → provider emits null → `AuthScreen` rendered
- **Properties 16, 17**: Any `OtpEntryState` with arbitrary verificationId/OTP → reset → cleared state + preserved fields

### Example-Based Tests

Specific error code paths that don't vary meaningfully with input use example-based tests:

- `FirebaseAuthException(code: 'invalid-verification-code')` → correct SnackBar + stay on OTP step
- `FirebaseAuthException(code: 'session-expired')` → correct SnackBar + reset to phone step
- HMS 404 (not registered) → `signOut()` + SnackBar + `PhoneEntryState`
- Network exception during HMS → `signOut()` + SnackBar + `PhoneEntryState`
- `Firebase.initializeApp()` throws → `FirebaseInitErrorApp` renders with error message

### Integration Tests

End-to-end flows that require real Firebase or HMS connections are validated via integration tests (not repeated property runs):

- Full OTP flow on a physical Android device with Firebase Test Lab phone number
- HMS registration check against a staging HMS instance
- Session persistence across app restarts

### Tooling

- **Flutter test** + **flutter_riverpod** `ProviderContainer` for unit/property tests
- **mocktail** for mocking `FirebaseAuth`, `HmsApiClient`, and `http.Client`
- **flutter_test** `pumpWidget` + `WidgetTester` for UI widget tests
- Property generators: `dart_test` or a lightweight custom generator for random strings/roles/status codes
