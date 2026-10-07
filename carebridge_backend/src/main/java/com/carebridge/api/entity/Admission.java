package com.carebridge.api.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "admissions")
public class Admission {
    @Id private String admissionId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;
    private LocalDate admissionDate;
    private LocalDate dischargeDate;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private AdmissionStatus status = AdmissionStatus.ACTIVE;
    private String doctor;
    private String department;
    private String roomWard;
    private String reason;
    private String hospitalName;
    private Instant createdAt = Instant.now();

    protected Admission() { }
    public Admission(String admissionId, Patient patient, LocalDate admissionDate, String doctor, String department, String roomWard, String reason, String hospitalName) {
        this.admissionId = admissionId; this.patient = patient; this.admissionDate = admissionDate;
        this.doctor = doctor; this.department = department; this.roomWard = roomWard; this.reason = reason; this.hospitalName = hospitalName;
    }
    public String getAdmissionId() { return admissionId; }
    public Patient getPatient() { return patient; }
    public LocalDate getAdmissionDate() { return admissionDate; }
    public LocalDate getDischargeDate() { return dischargeDate; }
    public AdmissionStatus getStatus() { return status; }
    public String getDoctor() { return doctor; }
    public String getDepartment() { return department; }
    public String getRoomWard() { return roomWard; }
    public String getReason() { return reason; }
    public String getHospitalName() { return hospitalName; }
    public Instant getCreatedAt() { return createdAt; }
    public void discharge(LocalDate date) { status = AdmissionStatus.DISCHARGED; dischargeDate = date; }
}
