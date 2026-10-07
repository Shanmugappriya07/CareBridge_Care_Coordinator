# CareBridge Mobile App (carebridge_app)

Caregiver-facing Flutter app for tracking an admitted patient's treatment
timeline, lab reports, prescriptions, billing, insurance, documents, and
extended family access. Admissions and treatment observations use the existing
backend APIs, and lab reports use Firestore. Modules without available
admission-specific backend data display an empty state.

## Running in Android Studio (Emulator)

1. **Open the project correctly.** In Android Studio, use
   `File > Open` and select this `carebridge_app` folder specifically
   (not the outer `CareBridge` folder that contains it). Android Studio
   only recognizes it as a Flutter project when opened at this level.

2. **Install the Flutter & Dart plugins** if you haven't already
   (`File > Settings > Plugins`, search "Flutter", install — this pulls
   in the Dart plugin too — then restart Android Studio).

3. **Point Android Studio at your local Flutter SDK**, if it doesn't
   detect it automatically: `File > Settings > Languages & Frameworks
   > Flutter` and set the Flutter SDK path to wherever you installed
   Flutter on your machine.
   - This project intentionally does **not** ship an
     `android/local.properties` file — that file contains machine-specific
     SDK paths (Windows `D:\`, someone else's `C:\Users\...`, etc.) and
     should never be shared between machines. Android Studio / the
     Flutter tool regenerates it automatically the first time you open
     or run the project, pointing at *your* SDK locations.

4. **Let it fetch packages.** Android Studio should prompt "Get
   dependencies" automatically — click it. If not, open a terminal in
   this folder and run:
   ```
   flutter pub get
   ```

5. **Create/start an emulator**: `Tools > Device Manager` in Android
   Studio, create a virtual device (any recent Android version), and
   start it.

6. **Run the app**: select the emulator in the device dropdown at the
   top of Android Studio and click the green ▶ Run button (or run
   `flutter run` from a terminal in this folder with the emulator
   running).

## Notes

- Admission selection and admission details use the configured API base URL;
   treatment observations use the selected admission ID, and lab reports use
   the selected patient's ID. Other modules do not display seeded patient data.
- The `carebridge_backend` folder (sibling to this one) is a separate
  Node/Express + MySQL service that the HMS staff web portal talks to;
  wiring this app up to it is a separate task from just getting it
  running in the emulator.
