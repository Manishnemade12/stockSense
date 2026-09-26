# StockSense: Problem Statement

## Overview

Build a modular Inventory Management System (IMS) that digitizes and streamlines
stock-related operations within a business. The goal is to replace manual
registers, spreadsheets, and scattered tracking methods with a centralized,
real-time, easy-to-use application.

## Target Users

- **Inventory managers:** Manage incoming and outgoing stock.
- **Warehouse staff:** Perform transfers, picking, shelving, and counting.

## Authentication

- Users can sign up and log in.
- Users can reset passwords using a one-time password (OTP).
- After logging in, users are redirected to the inventory dashboard.

## Dashboard

The landing page provides a snapshot of inventory operations.

### Key Performance Indicators

- Total products in stock
- Low-stock and out-of-stock items
- Pending receipts
- Pending deliveries
- Scheduled internal transfers

### Dynamic Filters

- Document type: receipts, deliveries, internal transfers, or adjustments
- Status: draft, waiting, ready, done, or canceled
- Warehouse or location
- Product category

## Navigation

- **Products**
  - Create and update products
  - View stock availability by location
  - Manage product categories and reordering rules
- **Operations**
  - Receipts (incoming stock)
  - Delivery orders (outgoing stock)
  - Inventory adjustments
- **Move History**
- **Dashboard**
- **Settings**
  - Warehouse configuration
- **Profile menu**
  - My profile
  - Log out

## Core Features

### 1. Product Management

Create products with the following information:

- Name
- SKU or code
- Category
- Unit of measure
- Initial stock (optional)

### 2. Receipts (Incoming Goods)

Receipts are used when items arrive from vendors.

1. Create a receipt.
2. Add the supplier and products.
3. Enter the quantities received.
4. Validate the receipt; stock increases automatically.

**Example:** Receiving 50 units of Steel Rods increases stock by 50 units.

### 3. Delivery Orders (Outgoing Goods)

Delivery orders are used when stock leaves the warehouse for customer shipment.

1. Pick the items.
2. Pack the items.
3. Validate the delivery; stock decreases automatically.

**Example:** A sales order for 10 chairs results in a delivery order that reduces
chair stock by 10 units.

### 4. Internal Transfers

Move stock within the company. Examples include:

- Main warehouse → production floor
- Rack A → Rack B
- Warehouse 1 → Warehouse 2

Each movement is logged in the stock ledger.

### 5. Stock Adjustments

Stock adjustments correct mismatches between recorded stock and the physical
count.

1. Select a product and location.
2. Enter the counted quantity.
3. The system updates stock and logs the adjustment.

## Additional Features

- Low-stock alerts
- Multi-warehouse support
- SKU search and smart filters

## Example Inventory Flow

1. **Receive goods from a vendor:** Receive 100 kg of steel; stock increases by
   100 kg.
2. **Move goods to a production rack:** Transfer steel from the main store to the
   production rack. Total stock remains unchanged, but the location is updated.
3. **Deliver finished goods:** Deliver 20 units of steel for frames; the relevant
   stock decreases by 20 units.
4. **Adjust damaged items:** Record 3 kg of damaged steel; stock decreases by
   3 kg.

All inventory movements are recorded in the stock ledger.

## Mockup

[View the StockSense mockup](https://link.excalidraw.com/l/65VNwvy7c4X/3ENvQFu9o8R)
