# CareBridge Spring Boot API

This Maven application is the requested Spring Boot middle layer. The existing `server.js` Node service is preserved and is not modified; run this application separately while migrating the two frontends.

## Setup

Install Java 17+ and Maven, then create the database:

```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS carebridge_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p carebridge_db < spring_schema.sql
```

Configure environment variables instead of committing credentials:

```powershell
$env:DB_URL = 'jdbc:mysql://localhost:3306/carebridge_db?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true'
$env:DB_USERNAME = 'root'
$env:DB_PASSWORD = 'your-local-password'
$env:CORS_ALLOWED_ORIGINS = 'http://localhost:8086,http://127.0.0.1:8086'
```

From `carebridge_backend`:

```powershell
mvn spring-boot:run
```

The API listens on `http://localhost:8080/api/v1`. For the Android emulator, use `http://10.0.2.2:8080/api/v1` in the Flutter client.

## API surface

- `POST /patients`, `GET /patients/{patientId}`
- `POST /admissions` creates an admission for an existing patient and assigns its caregiver
- `POST /admissions/{admissionId}/caregivers` assigns another caregiver to an active admission
- `GET /patients/{patientId}/admissions` lists the patient's history
- `GET /admissions/{admissionId}` reads an admission; caregiver calls must send `X-Caregiver-Mobile`
- `GET /caregivers/{mobile}/admissions` returns only authorized admissions
- `GET /caregivers/previous?patientId=...` gets the latest caregiver association
- `PUT /admissions/{admissionId}/discharge` with optional `{ "summary": "..." }`
- `GET /admissions/{admissionId}/discharge-summary`
- `GET/POST /admissions/{admissionId}/observations` reads or creates admission-scoped doctor observations and vitals
- `GET/POST /admissions/{admissionId}/records/{resourceType}` for `schedule`, `pharmacy`, `tests`, `scans`, `billing`, `insurance`, and `documents`
- `POST /auth/send-otp`, `POST /auth/verify-otp` use a development-only generated OTP. Set `DEV_OTP` only in a local environment if a repeatable test value is needed; production should be replaced with Firebase/SMS verification.

HMS staff write/detail requests currently use the explicit development header `X-Staff-Request: true`. Replace that header with real staff authentication before deployment. Caregiver endpoints always check an active admission-caregiver association. Discharged admissions remain readable but record writes are rejected.

## Frontend migration later

The HMS doctor ward-round form writes observations through `POST /admissions/{admissionId}/observations`; CareBridge reads them through the matching admission-scoped GET. Other HMS and CareBridge modules still require migration from legacy snapshot, Firestore, or local demo data to admission-specific Spring Boot APIs.
