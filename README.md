# CareBridge & Hospital Management System (HMS) Platform

CareBridge is a dedicated mobile platform built for caregivers and authorized family members to coordinate patient care, track treatment timelines, view diagnostic reports, manage digital prescriptions, complete hospital bill payments, track insurance claims, view medical documents, and receive real-time HMS notifications.

It integrates directly with the **St. Jude Hospital Management System (HMS) Staff Portal**, sharing a unified **MySQL** database (`carebridge_db`) so that all clinical updates entered by hospital staff (receptionists, doctors, lab technicians, pharmacists, and billing officers) are immediately synchronized with the mobile application.

> **See [SETUP.md](./SETUP.md) for exact, tested steps to run this with a real MySQL database.** The instructions below are a quick summary.


---

## 🌟 Key Features

### 1. HMS Hospital Staff Web Portal (`hms_staff_portal`)
- **Reception & Admissions Desk**: Admit new patients, issue Admission IDs (`HMS-2026-XXXX`), bind Primary Caregivers to patient accounts.
- **Doctor Ward Rounds Console**: Log daily ward notes, record vital signs (BP, SpO2, HR, Temp), and issue drug prescriptions.
- **Laboratory & Diagnostic Center**: Upload diagnostic test results (CBC, Cardiac Troponin, CT Scans), tag test statuses (`Normal`, `Elevated`, `Critical`), and attach PDFs.
- **Pharmacy Dispensing Desk**: Monitor doctor orders, assign dispensing pickup counters (Ground Floor Counter 3), generate pickup tokens (`PH-XXXX`), and update collection status (`Ready for Collection` → `Collected by Caregiver`).
- **Billing & Cashless Insurance Desk**: Add itemized hospital charges, manage cashless mediclaim approvals, and view live caregiver payment reconciliations.
- **Live Database Inspector**: Real-time view of all 13 MySQL relational tables in `carebridge_db`.

### 2. CareBridge Caregiver Companion App (`carebridge_app` & `carebridge_web_preview`)
- **App Launch OTP Onboarding**: Phone OTP authentication on startup for first-time registration and session activation.
- **Patient Tracking Banner**: Explicitly displays the admitted patient's details (Name, Patient ID: `PAT-8842-EV`, Age: 58, Phone: `+91 98111 22334`, Admission ID: `HMS-2026-8842`).
- **Role-Based Access Control (RBAC)**:
  - **Primary Caregiver**: Full administrative control (payments, insurance, receipt downloads, inviting family members).
  - **Invited Family Member**: Automatic Read-Only access upon mobile OTP login.
- **Pharmacy Pickup Module**: Track dispensing pickup counter (Ground Floor Counter 3), token ID (`PH-4082`), and interactive pickup status (`Ready for Collection` / `Collected by Caregiver`).
- **Hospital Facility Wayfinding Map**: Interactive 5-level floor map locating ICU Room 304, Pharmacy Counter 3, Diagnostic Labs, Doctor Cabins, Reception, Canteen, and Visitor Parking.

---

## 📁 Repository Structure

```
scratch/
├── hms_staff_portal/             # HMS Hospital Staff Administrative Web Portal
│   ├── index.html                # Department Switcher Console (Reception, Doctor, Lab, Pharmacy, Billing)
│   ├── styles.css                # Clinical Material Design 3 Styling
│   └── hms_app.js                # HMS Shared Data Engine & Real-time CareBridge Sync
│
├── carebridge_app/               # Production Flutter Mobile App Codebase (Material Design 3)
│   ├── lib/
│   │   ├── core/                 # App Theme, Constants, Reusable Widgets
│   │   └── features/             # Feature Modules (Auth, Dashboard, Timeline, Reports, Pharmacy, Billing, Insurance, Map, Family)
│   └── pubspec.yaml
│
├── carebridge_backend/           # Spring Boot REST API Service
│   ├── src/main/java/com/carebridge/api/
│   │   ├── config/               # SecurityConfig, OpenApiConfig
│   │   ├── controller/           # PatientController, BillingController, HmsStaffController, etc.
│   │   └── CareBridgeApiApplication.java
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   ├── schema.sql            # DDL Script for 13 MySQL Tables with Foreign Keys & Indexes
│   │   └── data.sql              # Initial Seed Dataset for Eleanor Vance (Admission: HMS-2026-8842)
│   ├── openapi.yaml              # Complete OpenAPI 3.0 Specification
│   └── pom.xml
│
└── carebridge_web_preview/       # Zero-Dependency Runnable Web Preview
    ├── index.html
    ├── styles.css
    └── app.js
```

---

## 🚀 How to Run the Applications

**Full tested instructions: see [SETUP.md](./SETUP.md).** Quick summary:

```bash
# 1. Load the MySQL schema (once)
cd carebridge_backend
mysql -u root -p < mysql_schema.sql

# 2. Start the shared backend (Node/Express + MySQL, port 8080)
cp .env.example .env   # edit if your MySQL creds differ
npm install
npm start

# 3. Run the HMS Staff Web Portal (port 8086)
cd ../hms_staff_portal
python -m http.server 8086

# 4. Run the CareBridge web preview (port 8085)
cd ../carebridge_web_preview
python -m http.server 8085
```
- **HMS Staff Web Console**: `http://localhost:8086`
- **CareBridge Caregiver Web Demo**: `http://localhost:8085`
- **Backend health check**: `http://localhost:8080/api/health`

Opening the HMS portal or CareBridge from a phone or a different PC than
the backend? Edit the `HMS_API_BASE` constant near the top of `hms_app.js`
/ `app.js` to that PC's LAN IP instead of `localhost`.

The Flutter app (`carebridge_app`) is not yet wired to the live backend —
its screens still use mock data (see SETUP.md for what's left to connect).

