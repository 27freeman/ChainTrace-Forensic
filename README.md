# Kelp DAO Exploit: Funds Flow Analysis & Forensic Tool

![Project Preview](image/kelp%20dao%20flow.png)

An interactive, data-engineered forensic tool for visualizing and analyzing the flow of funds following the Kelp DAO exploit. This project demonstrates a complete data pipeline from raw Ethereum transaction data to a high-performance interactive visualization.

## 🚀 Project Overview

This project serves as a forensic analysis platform to track the movement of stolen assets. It combines robust **Data Engineering** (PySpark batch processing) with a **State-of-the-art Frontend** (React + HTML5 Canvas) to provide an Arkham-style exploratory experience.

### Key Features:
- **Dual Analysis Modes**: 
  - **Fund Flow**: A global static view of all identified laundering paths and node relationships.
  - **Simulate Flow**: A chronological, animated simulation of the fund transfers over time.
- **Interactive Time-Travel**: Scrub through the exploit timeline to see nodes "activate" as they receive funds.
- **Node Classification**: Automatically identifies and categorizes wallets into roles: `Attacker`, `Thorchain Exit`, `Hop/Laundering Address`.
- **Forensic Detail**: Deep-dive into specific transactions and wallet totals (ETH/USD) with built-in clipboard support for addresses.

---

## 🛠 Data Engineering Pipeline

The heart of the project is a multi-stage data pipeline designed for scalability and reproducibility.

### 1. Data Ingestion (Parquet)
Raw blockchain data is stored in the `data/` directory as optimized Parquet files:
- `attackers_transfers`: Native ETH transfer events.
- `attackers_transactions`: Full Ethereum transaction metadata.

### 2. Batch Processing (`map.py`)
Using **PySpark**, the system performs high-performance batch processing to:
- Filter thousands of transactions against a known list of attacker-controlled addresses.
- Detect **Thorchain Laundering**: Joins transfer events with transaction calls to multiple Thorchain vaults (e.g., `0x9Fc3...`, `0x4fEe...`) to identify exactly when and where funds exited the Ethereum network.
- Union various laundering methods into a single unified "Action" dataset.

### 3. Graph Transformation (`graph_builder.py`)
A specialized transformation script that:
- Aggregates wallet statistics (Total Sent, Total Received, Transaction Counts).
- Classifies wallet roles based on their interaction with the attacker and laundering contracts.
- Generates an optimized `graph.json` topology consumed by the frontend.

---

## 🐳 Seamless Reproducibility (Docker)

The entire project is containerized using a multi-stage Docker build to ensure it runs exactly the same on any machine. The build process automatically executes the Spark pipeline before serving the frontend.

### Prerequisites:
- Docker
- Docker Compose

### Get Started:
1. **Clone the repository**:
   ```bash
   git clone https://github.com/Freemandaily/ChainTrace-Forensic
   cd ChainTrace-Forensic
   ```
2. **Build and Run**:
   ```bash
   docker compose up --build
   ```
3. **Access the Tool**:
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---


## 📜 Technology Stack
- **Languages**: Python (PySpark, Pandas), JavaScript (React).
- **Processing**: Apache Spark (Batch Processing).
- **Frontend**: Vite, React, HTML5 Canvas API.
- **DevOps**: Docker, Nginx.

---

*This project is for forensic research and educational purposes.*
