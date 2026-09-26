# StockSense — Core Inventory Management System

Enterprise-grade inventory management system designed for seamless warehouse and supply chain operations.

## Key Features

- **Double-Entry Stock Ledger**: Immutable transaction history for every stock movement.
- **Unified Operation Workflow**: Receipts, Deliveries, Internal Transfers, and Physical Adjustments under one unified status engine (`DRAFT` → `WAITING` → `READY` → `DONE` / `CANCELED`).
- **Real-Time Stock Quantities**: Live tracking of "On Hand" and "Free to Use" (accounting for reservations).
- **Kanban & List Views**: Switch between tabular data and visual Kanban boards for all warehouse operations.
- **Stock Shortage Warnings**: Instant red highlight and warning badges when delivery quantities exceed available source stock.
- **Multi-Theme Support**: Instant theme switching (`Midnight`, `Mint`, `Sunset`, `Cloud`, `Noir`).

## Development

```bash
# Install dependencies
bun install
# or: npm install

# Start local development server
bun run dev
# or: npm run dev
```
