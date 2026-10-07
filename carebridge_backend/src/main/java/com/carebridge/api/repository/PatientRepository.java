package com.carebridge.api.repository;
import com.carebridge.api.entity.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface PatientRepository extends JpaRepository<Patient, String> {
	List<Patient> findByNameContainingIgnoreCaseOrPhoneContaining(String name, String phone);
}
