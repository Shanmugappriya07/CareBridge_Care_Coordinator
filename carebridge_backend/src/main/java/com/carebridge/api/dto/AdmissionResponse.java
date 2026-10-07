package com.carebridge.api.dto;
import com.carebridge.api.entity.Admission;
import java.time.LocalDate;
public record AdmissionResponse(String admissionId, String patientId, String patientName, Integer patientAge, String gender, String phone, LocalDate admissionDate, LocalDate dischargeDate, String status, String doctor, String department, String room, String reason, String hospitalName, CaregiverResponse caregiver) {
    public static AdmissionResponse from(Admission a, CaregiverResponse caregiver) { var p=a.getPatient(); return new AdmissionResponse(a.getAdmissionId(), p.getPatientId(), p.getName(), p.getAge(), p.getGender(), p.getPhone(), a.getAdmissionDate(), a.getDischargeDate(), a.getStatus().name(), a.getDoctor(), a.getDepartment(), a.getRoomWard(), a.getReason(), a.getHospitalName(), caregiver); }
}
