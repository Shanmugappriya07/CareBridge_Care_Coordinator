# CareBridge backend + HMS staff portal (one container, ports 8080 and 8085)
FROM node:20-alpine
WORKDIR /app
COPY carebridge_backend/package*.json ./carebridge_backend/
RUN cd carebridge_backend && npm ci --omit=dev
COPY carebridge_backend ./carebridge_backend
COPY hms_staff_portal ./hms_staff_portal
WORKDIR /app/carebridge_backend
EXPOSE 8080 8085
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "server.js"]
