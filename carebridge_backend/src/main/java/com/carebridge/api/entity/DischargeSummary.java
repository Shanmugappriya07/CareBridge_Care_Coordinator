package com.carebridge.api.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "discharge_summaries")
public class DischargeSummary {
    @Id @Column(name = "admission_id") private String admissionId;
    @OneToOne(fetch = FetchType.LAZY) @MapsId @JoinColumn(name = "admission_id") private Admission admission;
    @Lob private String summary;
    private Instant createdAt = Instant.now();
    protected DischargeSummary() { }
    public DischargeSummary(Admission admission, String summary) { this.admission = admission; this.admissionId = admission.getAdmissionId(); this.summary = summary; }
    public String getAdmissionId() { return admissionId; }
    public String getSummary() { return summary; }
    public Instant getCreatedAt() { return createdAt; }
    public void updateSummary(String summary) { this.summary = summary; }
}
