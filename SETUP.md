# Running CareBridge + HMS with a real shared MySQL database

The HMS Staff Portal (web) and the CareBridge Caregiver App (mobile/web
preview) now share ONE real MySQL database, through ONE backend
(`carebridge_backend`, Node/Express). Anything a staff member does in the
HMS shows up in CareBridge, and vice versa — because both are just reading
and writing the same MySQL tables via the same API.

```
                 ┌─────────────────────┐
   HMS Staff     │                     │
   Portal (web) ─┤                     │
                 │  carebridge_backend │──── MySQL: carebridge_db
   CareBridge    │  (Node/Express)     │     (view it in MySQL
   App (mobile/ ─┤   port 8080         │      Workbench / DBeaver /
   web preview)  │                     │      phpMyAdmin, etc.)
                 └─────────────────────┘
```

## 1. Install & start MySQL

Install MySQL 8+ (or MariaDB) if you don't already have it, then start it.

## 2. Load the schema

```bash
cd carebridge_backend
mysql -u root -p < mysql_schema.sql
```
This creates the `carebridge_db` database, its 7 tables, and seeds one
sample admitted patient (Eleanor Vance, `HMS-2026-8842`) so both apps have
something to show immediately.

## 3. Configure & run the backend

```bash
cd carebridge_backend
cp .env.example .env
# edit .env if your MySQL user/password/host differ from root/root/localhost
npm install
npm start
```
You should see:
```
CareBridge / HMS Shared MySQL REST API Server
Running at: http://localhost:8080
```
Check it's alive: open `http://localhost:8080/api/health` — should show
`{"status":"ok","database":"connected"}`.

**Running the mobile app on a phone or a different PC?** Replace
`localhost` with your backend PC's LAN IP address everywhere below (find
it with `ipconfig` on Windows / `ifconfig` or `ip addr` on Mac/Linux —
usually something like `192.168.1.5`). All 3 machines/devices need to be
on the same Wi-Fi network.

## 4. Run the HMS Staff Web Portal

```bash
cd hms_staff_portal
python -m http.server 8085
```
Open `http://localhost:8085`. If the backend isn't at `localhost:8080`,
edit the `HMS_API_BASE` constant near the top of `hms_app.js` first.

## 5. Run the CareBridge Mobile Application (`carebridge_app`)

The CareBridge mobile application is built with Flutter (Material Design 3).

```bash
cd carebridge_app
flutter pub get
flutter run
```
You can select an Android Emulator, iOS Simulator, or connected physical device.
If running on an Android emulator, `http://10.0.2.2:8080/api/v1` automatically routes to your host machine's backend on port 8080. If running on a physical phone, update `apiBaseUrl` in `lib/core/constants/app_constants.dart` with your PC's LAN IP address.

## Notes on the current state

- **Backend + HMS Portal**: Live and synced via REST endpoints at `http://localhost:8080` and `http://localhost:8085`.
- **Flutter Mobile App (`carebridge_app`)**: The mobile codebase is under `carebridge_app/lib/` with dedicated feature modules: `admissions`, `billing`, `treatment_timeline`, `lab_reports`, `prescriptions`, `hospital_navigation`, `insurance`, and `family_access`.
- The old Spring Boot backend attempt has been moved to
  `carebridge_backend/_unused_spring_boot_prototype/` — it was never more
  than 3 stub controllers returning hardcoded data, so it isn't part of
  the working system. The real backend is `carebridge_backend/server.js`.

## API reference (for wiring the Flutter app next)

| Method | Endpoint                                  | Purpose                                             |
|--------|--------------------------------------------|------------------------------------------------------|
| GET    | `/api/hms/data`                            | Full shared snapshot (patients, treatments, lab reports, prescriptions, billing, payments) |
| POST   | `/api/hms/sync`                            | Push a full snapshot back (replaces MySQL rows in a transaction) |
| PUT    | `/api/hms/prescriptions/:id/collect`       | Toggle a prescription's pickup status. Body: `{"isCollected": true}` |
| POST   | `/api/hms/payments`                        | Record a caregiver payment, clears remaining balance. Body: `{"admissionId": "...", "method": "UPI"}` |
| GET    | `/api/health`                              | Backend + DB connectivity check |

Every response that changes data also returns `{ success, snapshot }`
(or `{ success, txId, amount, snapshot }` for payments) so the caller can
refresh its UI from the same response without a second round trip.
