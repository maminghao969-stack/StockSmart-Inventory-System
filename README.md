# StockSmart - AI-Powered Inventory Automation System



A full-stack inventory management and automation system designed to streamline business operations. StockSmart integrates real-time dashboard analytics with automated n8n workflows and AI-driven data validation to eliminate manual tracking bottlenecks.



## My Role \& Contributions

As a core developer of this collaborative project, my primary focus was on \*\*Data Automation \& Backend Integration\*\*:

\- \*\*Workflow Automation:\*\* Architected and deployed the end-to-end automated pipelines using \*\*n8n\*\*.

\- \*\*API \& Alert System:\*\* Integrated the Telegram API to trigger real-time low-stock alerts and business reports.

\- \*\*Data Transformation:\*\* Utilized custom \*\*JavaScript (Node.js)\*\* code nodes to parse complex JSON payloads and ensure seamless data flow between the web app, AI validation engine, and the MySQL database.



## Key Features

\- \*\*Real-Time Dashboard:\*\* Tracks total products, stock valuation, projected profit, and low-stock metrics.

\- \*\*AI Inventory Cleaning:\*\* An intelligent data validation engine that checks for duplicate products, missing suppliers, pricing errors (selling below cost), and stock anomalies.

\- \*\*Smart Recommendations:\*\* Generates actionable business insights and promotion suggestions based on monthly sales data.

\- \*\*Automated Alerts:\*\* Low-stock alerts routed directly to business owners via n8n and Telegram.



## Tech Stack

\- \*\*Frontend/Backend:\*\* TypeScript, Node.js, Vite

\- \*\*Database:\*\* MySQL

\- \*\*Automation \& Integration:\*\* n8n, Telegram API, RESTful APIs



\---


## How to Run Locally


1. Web Application

```bash

npm install

npm run dev

Open http://localhost:3000 in your browser. By default, the app runs in demo mode.



2. MySQL Database Setup

To use a live MySQL database, rename .env.example to .env and configure your credentials:

USE\_MYSQL=true

DB\_HOST=localhost

DB\_USER=root

DB\_PASSWORD=your\_password

DB\_NAME=stocksmart\_ai

Ensure you have executed the stocksmart\_ai\_clean.sql script in your MySQL instance.



3. n8n \& Telegram Automation setup

The system includes a website-to-n8n bridge for automated alerts.



1. Import the credential-free workflow templates located in the n8n-workflows/ directory into your local or cloud n8n instance.

2. Configure your Telegram Bot Token and Chat ID within the n8n Telegram node.

3. Activate the workflow and update the N8N\_WEBHOOK\_URL in your .env file to point to your active n8n webhook endpoint.

