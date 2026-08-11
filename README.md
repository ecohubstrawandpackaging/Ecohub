# EcoHub Business System

This repository is connected to the EcoHub Business System workflow in ChatGPT.

## Current source

The reviewed source is the standalone EcoHub HTML application `EcoHub_Business_System_18_GROUPED_SALES_AZ.html` (359,396 bytes; SHA-256 `8a55f526dd7a2b55040e0f05e2098011d5e539e1003644d8af31801bca8ccb08`).

The application includes sales quotations, client CRM, sales records, pending orders, product costing, inventory, expenses, supplier payables, cup-stock inventory, direct supplier purchases, finance dashboard, settings, backup/import, and optional Supabase-backed authentication/storage.

## Data/storage architecture

GitHub is the source-code/version-control layer. Business data is not meant to be stored in GitHub. The app's storage layer supports Supabase when configured, otherwise platform/browser storage fallbacks.

## Deployment target

The intended web entry file is `index.html`, containing the current EcoHub application source. Supabase Project URL / anon public key should be configured separately and secrets must not be committed to the repository.

---

Repository connection initialized from ChatGPT on 2026-08-11.
