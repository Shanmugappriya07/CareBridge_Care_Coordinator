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
python -m http.server 8086
```
Open `http://localhost:8086`. If the backend isn't at `localhost:8080`,
edit the `HMS_API_BASE` constant near the top of `hms_app.js` first.

## 5. Run the CareBridge web preview (quick zero-Flutter demo)

```bash
cd carebridge_web_preview
python -m http.server 8085
```
Open `http://localhost:8085`. Same note: edit `HMS_API_BASE` at the top
of `app.js` if your backend isn't on `localhost`.

## 6. Try the live sync

1. In the HMS portal, log in as "Doctor", add a ward-round note.
2. Open the CareBridge web preview (or refresh it) — within ~4 seconds
   the new note appears in its Timeline tab, pulled straight from MySQL.
3. In CareBridge, mark a prescription as collected or pay the bill.
4. Watch the HMS Pharmacy/Billing tabs update the same way.
5. Open MySQL Workbench/phpMyAdmin/DBeaver, connect to `carebridge_db`,
   and browse the tables directly — the "Database Inspector" tab in the
   HMS portal shows the same live data in-app.

## Notes on the current state

- **Web ↔ Web sync is fully wired and tested end-to-end** against a real
  MySQL database (`hms_staff_portal` and `carebridge_web_preview`), with a
  4-second poll so each side picks up the other's changes automatically.
- **The Flutter mobile app (`carebridge_app`) is not yet wired to this
  backend** — its screens still show mock/hardcoded data. It has the
  `http` package ready in `pubspec.yaml`, but no API service layer yet.
  That's the next piece to build: an `ApiService` hitting the same
  `GET /api/hms/data` / `POST /api/hms/sync` / `PUT /api/hms/prescriptions/:id/collect`
  / `POST /api/hms/payments` endpoints documented below, wired into the
  Dashboard, Timeline, Lab Reports, Prescriptions, and Billing screens.
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
