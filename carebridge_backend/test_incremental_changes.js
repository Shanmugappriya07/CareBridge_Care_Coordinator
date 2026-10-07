const assert = require('assert');

const API_BASE = 'http://localhost:8080';

async function runTests() {
  console.log('========================================================');
  console.log('STARTING INCREMENTAL REQUIREMENTS VERIFICATION TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err);
    }
  }

  // -------------------------------------------------------------------
  // 1. PAGE 1: PATIENT REGISTRATION / ADMISSION & IDS
  // -------------------------------------------------------------------
  let newPatientId = null;
  let newAdmissionId = null;
  const testPhone = '+91 99' + Math.floor(10000000 + Math.random() * 90000000);
  const testRoom = 'PVT-301';

  await test('1.8 Sequential IDs: Atomic counter generates next in sequence', async () => {
    const res = await fetch(`${API_BASE}/api/hms/next-ids?dept=Cardiology`);
    const data = await res.json();
    assert(res.ok, 'Failed to fetch next-ids');
    assert(data.patientId && data.admissionId, 'Next IDs must include patientId and admissionId');
    console.log(`      Generated next preview IDs: Patient=${data.patientId}, Admission=${data.admissionId}`);
    assert(/^26PAT\d{4}$/.test(data.patientId), `Patient ID ${data.patientId} must match format 26PAT0000`);
    assert(/^26CAR\d{3}$/.test(data.admissionId), `Admission ID ${data.admissionId} must match format 26CAR000`);
  });

  await test('1.1 & 1.4: Patient Registration with DOB and Gender=Transgender', async () => {
    // 25 year old DOB
    const dob = '2001-05-15';
    const payload = {
      patientMode: 'new',
      fullName: 'Suriya Sivakumar',
      age: 25,
      dob: dob,
      gender: 'Transgender',
      bloodGroup: 'B+',
      patientPhone: testPhone,
      city: 'Chennai',
      admissionReason: 'Routine health checkup and monitoring',
      admittingDept: 'Cardiology',
      roomNumber: testRoom,
      attendingDoctor: 'Dr. Aris Thorne (Cardiology)',
      caregiverName: 'Jyothika Suriya',
      caregiverPhone: '+91 98402 34567',
      caregiverRelation: 'Spouse',
      caregiverEmail: 'jyothika@example.com'
    };

    const res = await fetch(`${API_BASE}/api/hms/admissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    assert(res.ok && result.success, `Admit patient failed: ${result.error || res.status}`);
    assert(result.patientId, 'Must return assigned patientId');
    assert(result.admissionId, 'Must return assigned admissionId');
    newPatientId = result.patientId;
    newAdmissionId = result.admissionId;
    console.log(`      Admitted patient: ${result.fullName} (ID: ${result.patientId}, Admission: ${result.admissionId})`);
  });

  await test('1.7 Room Transfer: Check occupied rooms are blocked', async () => {
    const res = await fetch(`${API_BASE}/api/hms/rooms/occupancy`);
    const occupied = await res.json();
    assert(Array.isArray(occupied), 'Occupancy should be an array');
    const match = occupied.find(r => r.roomNumber === testRoom);
    assert(match, `${testRoom} must be occupied because we just admitted Suriya there`);
    assert.strictEqual(match.admissionId, newAdmissionId, 'Room must be assigned to our new admission');
    console.log(`      Verified: ${testRoom} is correctly marked occupied by admission ${match.admissionId}`);
  });

  // -------------------------------------------------------------------
  // 2. PAGE 2: VISITS (renamed from Appointments)
  // -------------------------------------------------------------------
  let scheduledVisitId = null;

  await test('2.1 & 2.2: Schedule Doctor Visit for admission', async () => {
    const payload = {
      doctor: 'Dr. Aris Thorne (Cardiology)',
      eventDate: new Date().toISOString().slice(0, 10),
      appointmentTime: '10:30 AM',
      appointmentType: 'Physician Ward Visit'
    };

    const res = await fetch(`${API_BASE}/api/v1/admissions/${encodeURIComponent(newAdmissionId)}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Staff-Request': 'true' },
      body: JSON.stringify({ resourceType: 'schedule', payload: JSON.stringify(payload) })
    });
    const result = await res.json();
    assert(res.ok, `Failed to schedule visit: ${res.status}`);
    scheduledVisitId = result.id;
    console.log(`      Created scheduled visit with ID: ${scheduledVisitId}`);
  });

  // -------------------------------------------------------------------
  // 3. PAGE 3: PRESCRIPTIONS / WARD ROUND
  // -------------------------------------------------------------------
  let issuedPrescriptionGroupId = null;

  await test('3.1 & 3.2: Multi-medicine Prescription Batch Confirmation', async () => {
    const payload = {
      admissionId: newAdmissionId,
      patientId: newPatientId,
      doctor: 'Dr. Aris Thorne (Cardiology)',
      prescriptionDate: new Date().toISOString().slice(0, 10),
      medicines: [
        {
          name: 'Amoxicillin 500mg',
          medicineName: 'Amoxicillin 500mg',
          dosageAmount: '500',
          dosageUnit: 'mg',
          frequency: 'Three times daily',
          duration: '7 Days',
          route: 'Oral',
          instructions: 'Take after meals'
        },
        {
          name: 'Paracetamol 650mg',
          medicineName: 'Paracetamol 650mg',
          dosageAmount: '650',
          dosageUnit: 'mg',
          frequency: 'Twice daily',
          duration: '5 Days',
          route: 'Oral',
          instructions: 'For fever or mild pain'
        },
        {
          name: 'Pantoprazole 40mg',
          medicineName: 'Pantoprazole 40mg',
          dosageAmount: '40',
          dosageUnit: 'mg',
          frequency: 'Once daily before breakfast',
          duration: '10 Days',
          route: 'Oral',
          instructions: 'Take 30 mins before morning food'
        }
      ]
    };

    const res = await fetch(`${API_BASE}/api/v1/admissions/${encodeURIComponent(newAdmissionId)}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Staff-Request': 'true' },
      body: JSON.stringify({ resourceType: 'prescriptions', payload: JSON.stringify(payload) })
    });
    const result = await res.json();
    assert(res.ok, `Confirm prescription batch failed: ${res.status}`);
    const parsed = JSON.parse(result.payload);
    issuedPrescriptionGroupId = parsed.groupId || parsed.prescriptionId;
    assert(issuedPrescriptionGroupId, 'Must return a grouped prescription ID');
    console.log(`      Issued multi-medicine prescription order: ${issuedPrescriptionGroupId} with 3 medicines`);
  });

  // -------------------------------------------------------------------
  // 4. PAGE 4: LAB / DIAGNOSTICS
  // -------------------------------------------------------------------
  let uploadedLabId = null;

  await test('4.2 & 4.4: Upload Diagnostic Lab Test Report with File Attachment', async () => {
    // 1. Upload mock PDF base64
    const uploadRes = await fetch(`${API_BASE}/api/hms/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'CBC_Report_Suriya.pdf',
        fileData: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iag=='
      })
    });
    const uploadData = await uploadRes.json();
    assert(uploadRes.ok && uploadData.success, 'File upload failed');
    console.log(`      Uploaded test PDF: ${uploadData.fileUrl}`);

    // 2. Add lab report linking file
    const labPayload = {
      admissionId: newAdmissionId,
      patientId: newPatientId,
      title: 'Complete Blood Count (CBC)',
      department: 'Pathology',
      status: 'Completed',
      notes: 'Diagnostic Lab Report: Complete Blood Count (CBC)',
      fileUrl: uploadData.fileUrl,
      fileName: uploadData.fileName
    };

    const labRes = await fetch(`${API_BASE}/api/v1/admissions/${encodeURIComponent(newAdmissionId)}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Staff-Request': 'true' },
      body: JSON.stringify({ resourceType: 'tests', payload: JSON.stringify(labPayload) })
    });
    const labResult = await labRes.json();
    assert(labRes.ok, `Lab report save failed: ${labRes.status}`);
    const labParsed = JSON.parse(labResult.payload);
    uploadedLabId = labParsed.reportId || labResult.id;
    console.log(`      Published Lab Report ID: ${uploadedLabId} with PDF URL: ${labParsed.fileUrl}`);
  });

  // -------------------------------------------------------------------
  // 5. PAGE 5: PHARMACY GROUPING & PAYMENT STATUS TOGGLE
  // -------------------------------------------------------------------
  await test('5.1 & 5.2: Toggle Prescription Payment Status (Paid / Not Paid)', async () => {
    // Toggle to PAID
    const payRes1 = await fetch(`${API_BASE}/api/hms/prescriptions/${encodeURIComponent(issuedPrescriptionGroupId)}/payment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: 'PAID' })
    });
    const payData1 = await payRes1.json();
    assert(payRes1.ok && payData1.success, 'Toggle to PAID failed');
    assert.strictEqual(payData1.paymentStatus, 'PAID');
    console.log(`      Updated prescription payment status to: ${payData1.paymentStatus}`);

    // Toggle back to UNPAID
    const payRes2 = await fetch(`${API_BASE}/api/hms/prescriptions/${encodeURIComponent(issuedPrescriptionGroupId)}/payment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: 'UNPAID' })
    });
    const payData2 = await payRes2.json();
    assert(payRes2.ok && payData2.success, 'Toggle to UNPAID failed');
    assert.strictEqual(payData2.paymentStatus, 'UNPAID');
    console.log(`      Toggled prescription payment status back to: ${payData2.paymentStatus}`);
  });

  // -------------------------------------------------------------------
  // 6. CAREBRIDGE APP: FRESH DATA FETCHING VERIFICATION
  // -------------------------------------------------------------------
  await test('6.1: Fresh data fetch from CareBridge endpoint', async () => {
    const res = await fetch(`${API_BASE}/api/hms/data`);
    const data = await res.json();
    assert(res.ok, 'Failed to fetch fresh CareBridge data');
    assert(data.patients && data.prescriptions && data.labReports, 'Response must contain full snapshot');

    // Verify Suriya is in the fresh snapshot
    const p = data.patients.find(pt => pt.admissionId === newAdmissionId);
    assert(p, 'New patient must be present in fresh snapshot');
    assert.strictEqual(p.gender, 'Transgender', 'Patient gender must be Transgender');

    // Verify multi-med prescription order is in the fresh snapshot
    const rxs = data.prescriptions.filter(rx => rx.admissionId === newAdmissionId);
    assert(rxs.length >= 3, `Expected at least 3 prescribed medicines, found ${rxs.length}`);

    // Verify uploaded lab report is in the fresh snapshot with PDF fileUrl
    const lr = data.labReports.find(r => r.admissionId === newAdmissionId);
    assert(lr && lr.fileUrl, 'Uploaded lab report with fileUrl must be present in snapshot');
    console.log(`      CareBridge fresh snapshot verified: Patient=${p.fullName}, Prescriptions=${rxs.length}, LabReports=1`);
  });

  // -------------------------------------------------------------------
  // 7. PAGE 1.2: DISCHARGE WITH FILE ATTACHMENT
  // -------------------------------------------------------------------
  await test('1.2: Discharge Patient with Summary File Attachment', async () => {
    const dischargeRes = await fetch(`${API_BASE}/api/hms/admissions/${encodeURIComponent(newAdmissionId)}/discharge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: '/uploads/Discharge_Summary_Suriya.pdf',
        fileUrl: '/uploads/Discharge_Summary_Suriya.pdf'
      })
    });
    const dischargeData = await dischargeRes.json();
    assert(dischargeRes.ok && dischargeData.success, 'Discharge failed');
    assert.strictEqual(dischargeData.status, 'DISCHARGED');
    console.log(`      Discharged admission ${newAdmissionId}. Bed/room released.`);

    // Room should now be available again
    const roomsRes = await fetch(`${API_BASE}/api/hms/rooms/occupancy`);
    const occupied = await roomsRes.json();
    const match = occupied.find(r => r.roomNumber === testRoom);
    assert(!match, `${testRoom} must be available again after discharge`);
    console.log(`      Verified: ${testRoom} is now released and no longer in occupied rooms`);
  });

  console.log('\n========================================================');
  console.log(`TEST SUITE FINISHED: ${passed}/${total} TESTS PASSED`);
  console.log('========================================================\n');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
