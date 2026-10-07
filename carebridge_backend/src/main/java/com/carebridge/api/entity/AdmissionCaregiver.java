package com.carebridge.api.entity;

import jakarta.persistence.*;
import com.carebridge.api.util.MobileNumberNormalizer;
import java.time.Instant;

@Entity
@Table(name = "admission_caregivers", uniqueConstraints = @UniqueConstraint(columnNames = {"admission_id", "caregiver_mobile"}))
public class AdmissionCaregiver {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "admission_id", nullable = false) private Admission admission;
    private String caregiverName;
    @Column(nullable = false) private String caregiverMobile;
    private String relationship;
    @Enumerated(EnumType.STRING) private AccessStatus accessStatus = AccessStatus.ACTIVE;
    private Instant createdAt = Instant.now();
    private Instant disabledAt;

    protected AdmissionCaregiver() { }
    public AdmissionCaregiver(Admission admission, String name, String mobile, String relationship) {
        this.admission = admission; caregiverName = name; caregiverMobile = MobileNumberNormalizer.toStorageFormat(mobile); this.relationship = relationship;
    }
    public Long getId() { return id; }
    public Admission getAdmission() { return admission; }
    public String getCaregiverName() { return caregiverName; }
    public String getCaregiverMobile() { return caregiverMobile; }
    public String getRelationship() { return relationship; }
    public AccessStatus getAccessStatus() { return accessStatus; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getDisabledAt() { return disabledAt; }
    public void disable() { accessStatus = AccessStatus.DISABLED; disabledAt = Instant.now(); }
}
