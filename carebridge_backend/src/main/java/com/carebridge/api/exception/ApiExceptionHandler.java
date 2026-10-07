package com.carebridge.api.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.time.Instant;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ResourceNotFoundException.class) ResponseEntity<?> notFound(ResourceNotFoundException e) { return body(HttpStatus.NOT_FOUND, "NOT_FOUND", e.getMessage()); }
    @ExceptionHandler(UnauthorizedException.class) ResponseEntity<?> unauthorized(UnauthorizedException e) { return body(HttpStatus.FORBIDDEN, "CAREGIVER_NOT_AUTHORIZED", e.getMessage()); }
    @ExceptionHandler(ConflictException.class) ResponseEntity<?> conflict(ConflictException e) { return body(HttpStatus.CONFLICT, "CONFLICT", e.getMessage()); }
    @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<?> invalid(MethodArgumentNotValidException e) { return body(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", e.getBindingResult().getFieldErrors().stream().findFirst().map(x -> x.getField()+" "+x.getDefaultMessage()).orElse("Invalid request")); }
    @ExceptionHandler(HttpMessageNotReadableException.class) ResponseEntity<?> malformed(HttpMessageNotReadableException e) { return body(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Malformed request body"); }
    @ExceptionHandler(Exception.class) ResponseEntity<?> general(Exception e) { e.printStackTrace(); return body(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "The request could not be completed."); }
    private ResponseEntity<?> body(HttpStatus status, String code, String message) { return ResponseEntity.status(status).body(Map.of("timestamp", Instant.now(), "status", status.value(), "code", code, "message", message)); }
}
