package com.carebridge.api.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "admission_records")
public class AdmissionRecord {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "admission_id", nullable = false) private Admission admission;
    @Column(nullable = false) private String resourceType;
    @Lob @Column(nullable = false, columnDefinition = "TEXT") private String payload;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    protected AdmissionRecord() { }
    public AdmissionRecord(Admission admission, String resourceType, String payload) { this.admission = admission; this.resourceType = resourceType; this.payload = payload; }
    public Long getId() { return id; }
    public Admission getAdmission() { return admission; }
    public String getResourceType() { return resourceType; }
    public String getPayload() { return payload; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void updatePayload(String payload) { this.payload = payload; updatedAt = Instant.now(); }
}
