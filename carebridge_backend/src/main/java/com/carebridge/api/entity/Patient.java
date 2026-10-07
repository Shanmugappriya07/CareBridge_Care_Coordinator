package com.carebridge.api.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;

@Entity
@Table(name = "patients")
public class Patient {
    @Id @NotBlank private String patientId;
    @NotBlank private String name;
    private Integer age;
    private String gender;
    private String phone;
    private String bloodGroup;
    private String emergencyContactName;
    private String emergencyContactPhone;
    private Instant createdAt = Instant.now();

    protected Patient() { }
    public Patient(String patientId, String name, Integer age, String gender, String phone, String bloodGroup) {
        this.patientId = patientId; this.name = name; this.age = age; this.gender = gender; this.phone = phone; this.bloodGroup = bloodGroup;
    }
    public String getPatientId() { return patientId; }
    public String getName() { return name; }
    public Integer getAge() { return age; }
    public String getGender() { return gender; }
    public String getPhone() { return phone; }
    public String getBloodGroup() { return bloodGroup; }
    public String getEmergencyContactName() { return emergencyContactName; }
    public String getEmergencyContactPhone() { return emergencyContactPhone; }
    public Instant getCreatedAt() { return createdAt; }
    public void setBloodGroup(String value) { bloodGroup = value; }
    public void setEmergencyContactName(String value) { emergencyContactName = value; }
    public void setEmergencyContactPhone(String value) { emergencyContactPhone = value; }
}
