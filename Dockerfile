# ─── Stage 1: Python — convert parquet to graph.json ─────────────────────────
FROM python:3.11-slim AS converter

WORKDIR /data

# install java
RUN apt-get update && \
    apt-get install -y default-jdk && \
    apt-get clean

ENV JAVA_HOME=/usr/lib/jvm/default-java

COPY map.py .
COPY graph_builder.py .
COPY data/attackers_transactions/ ./attackers_transactions/
COPY data/attackers_transfers/ ./attackers_transfers/

RUN pip install --no-cache-dir pandas pyarrow pyspark

RUN python map.py

# COPY data/attackers_action/ ./attackers_action/
RUN python graph_builder.py


# ─── Stage 2: Node — build the React app ─────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

COPY frontend/ .

COPY --from=converter /data/graph.json ./public/graph.json

RUN npm run build


# ─── Stage 3: Nginx — serve the static build ─────────────────────────────────
FROM nginx:alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]