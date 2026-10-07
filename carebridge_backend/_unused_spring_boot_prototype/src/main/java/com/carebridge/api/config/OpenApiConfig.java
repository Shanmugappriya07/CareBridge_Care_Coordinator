package com.carebridge.api.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.Contact;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("CareBridge REST API")
                        .version("1.0.0")
                        .description("Caregiver-Centric Healthcare Platform REST API for HMS Integration")
                        .contact(new Contact()
                                .name("CareBridge Support")
                                .email("support@carebridge.health")));
    }
}
