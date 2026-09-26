# StockSense 📦⚡
> **Next-Generation Double-Entry Warehouse & Inventory Operating System**  
> *Built for speed, zero-discrepancy stock management, and strict role-based operations.*

---

## 🎙️ Official Hackathon Pitch Script (English)
*Use this exact script to pitch and introduce the project to judges and evaluators **before** logging into the system.*

### ⏱️ Delivery Time: ~60 to 90 Seconds

#### **1. Greeting & Team Introduction (15 Seconds)**
> *"Good morning / afternoon everyone!*  
> *My name is **Manish Nemade**, and with me is my team partner **Abhay**.*  
>  
> *Today, we are thrilled to present **StockSense** — an intelligent, high-performance inventory management system engineered to bring speed, reliability, and precision to modern warehouse and supply chain operations."*

#### **2. The Real-World Problem / The Hook (25 Seconds)**
> *"In any growing supply chain or warehouse, the single biggest operational nightmare is **Phantom Inventory** and **Human Error** during order execution.*  
>  
> *Most traditional ERP systems suffer from three critical bottlenecks:*  
> 1. **Cluttered, Generic Interfaces:** Ground-level warehouse workers are forced to navigate the same bloated screens meant for executive managers, causing costly mis-picks and slow dispatch times.  
> 2. **Overselling & Silent Stockouts:** Systems allow orders to be confirmed without real-time reservation checks. Workers walk to a shelf only to find it empty.  
> 3. **Lack of a True Audit Ledger:** When stock vanishes or numbers mismatch, managers have no reliable way to trace where, when, and by whom a discrepancy occurred."*

#### **3. Introducing StockSense: The Core Innovation (25 Seconds)**
> *"To solve this, we engineered **StockSense** around two foundational principles:*  
>  
> - **1. Double-Entry Inventory Ledger:** Just like financial accounting requires every debit to have a matching credit, StockSense treats physical items the same way. Every stock movement has a discrete Source and Destination. Inventory never magically appears or disappears — every single unit has 100% mathematical traceability.  
> - **2. Persona-First Architecture & Active Safeguards:** We designed distinct user experiences for each role. A **Warehouse Staff** worker gets a fast, distraction-free execution terminal with built-in **Short-Stock Guards** that prevent picking what isn't there. Meanwhile, an **Inventory Manager** has access to multi-warehouse controls, automated reorder thresholds, and live ledger analytics."*

#### **4. Launching into the Live Demo (10 Seconds)**
> *"Instead of just talking about it, let's see StockSense in action!*  
>  
> *We will demonstrate the system through two distinct lenses: first, as a **Warehouse Staff** member performing fast receipts and deliveries at their assigned warehouse, and then as an **Inventory Manager** exercising full operational control.*  
>  
> *Let's log in!"*  
> *(👉 Enter demo credentials on screen and proceed with the live walkthrough)*

---

## 👥 Demo Personas & Credentials

| Role | Email / Login | Password | Assigned Scope & Access |
|---|---|---|---|
| **Inventory Manager** *(Admin)* | `admin@stocksense.local` | `Admin@1234` | Full access across all warehouses (WH1, WH2, WH3), Master Data, Product CRUD, Location hierarchy, Settings, and manual stock adjustments. |
| **Warehouse Staff** *(User)* | `staff@stocksense.local` | `User@1234` | Fast operational terminal locked to **Central Warehouse (WH1)**. Clean, distraction-free interface (Admin settings and cross-warehouse modifications hidden). |

---

## 🚀 Live Demo Walkthrough Guide

### Step 1: Warehouse Staff Experience (Execution Speed & Safety)
1. **Login as Staff (`staff@stocksense.local` / `User@1234`)**:
   - Point out the **distraction-free navbar**: Manager-only items (Settings, Master Data configs) are completely hidden.
   - Point out the **Locked Station Badge**: The user is safely pinned to their assigned warehouse station (`WH1`), preventing cross-facility errors.
2. **Execute Operations**:
   - Open **Receipts** or **Deliveries** (`/operations/receipts`).
   - Demonstrate the **Dual-View Toggle** (Data-rich Table vs. Visual Kanban Board).
   - Open an operation detail page (`/operations/deliveries/{id}`).
   - Highlight the **Short-Stock Guard**: If requested quantity exceeds on-hand stock at the source location, the system flags the line item in red and prevents invalid validation.

### Step 2: Inventory Manager Experience (Command & Control)
1. **Switch to Admin (`admin@stocksense.local` / `Admin@1234`)**:
   - The UI reveals full multi-warehouse dropdowns, product addition modals, and warehouse configuration menus.
2. **Product Catalog & Live Stock**:
   - Navigate to **Products** (`/products`).
   - View location-level breakdown (`On Hand`, `Reserved`, `Free to Use`).
   - Demonstrate inline stock updates via secure RPC functions.
3. **Traceability Ledger**:
   - Navigate to **Move History** (`/move-history`).
   - Showcase the immutable audit trail displaying Source Location ➔ Destination Location, quantity delta, timestamps, and user references.

---

## 🛠️ Architecture & Tech Stack

- **Frontend:** React 19, Vite, TanStack Router & TanStack Query, Tailwind CSS, Lucide Icons.
- **Backend & Database:** Supabase (PostgreSQL 15), Row-Level Security (RLS) policies, Custom RPC Stored Procedures (`validate_operation`, `set_stock`).
- **Core Design Pattern:** Double-Entry Inventory Accounting (Stock Moves with `source_location_id` and `dest_location_id`).

---

## 👥 Team
- **Manish Nemade** — Full-Stack Architecture, Database Design & Frontend Engineering
- **Abhay** — Backend Integration & Core Workflow Implementation
