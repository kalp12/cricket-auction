# Stage 1: Build React
FROM node:20-slim AS frontend
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Python + FastAPI + built React
FROM python:3.11-slim
WORKDIR /app

# Install Python dependencies
COPY server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy server code
COPY server/ ./

# Copy built React from stage 1
COPY --from=frontend /app/client/build ./client/build

# Uploads directory
RUN mkdir -p uploads

ENV STATIC_DIR=/app/client/build
ENV PORT=8000

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
