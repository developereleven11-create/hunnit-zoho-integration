
# Shopify CSV Generator

Generates a CSV with the exact headers you provided for the **latest 50** uploaded Shopify products (one row per variant) and returns it as a downloadable file.

## Quick setup

1. Create a new GitHub repository and push the contents of this project.
2. On Vercel, import the GitHub repo and set these Environment Variables:
   - `SHOP_DOMAIN` — yourshop.myshopify.com
   - `SHOP_TOKEN` — Admin API access token with `read_products` scope

3. Deploy on Vercel. After deployment visit:
   `https://<your-vercel-app>/api/generate`

It will return a CSV file as an attachment (Content-Disposition).

## Notes & Mapping

- This function fetches the latest 50 products sorted by `createdAt` (newest first).
- For `shopify_product_id` and `shopify_variant_id` the script extracts the numeric Shopify IDs from the GraphQL global IDs.
- Many import/accounting-specific columns (eg. `Purchase Rate`, `hsn`, tax names/types, accounts) are left blank — you can fill defaults in `api/generate.js` if you want automatic values.
- Column header names are preserved exactly as you provided.

## Local test

Install dependencies:

```bash
npm install
node api/generate.js
```

This will run a simple fetch and print CSV to stdout if you set `SHOP_DOMAIN` and `SHOP_TOKEN` in your environment.

## File list

- `api/generate.js` — Vercel serverless function that generates the CSV
- `utils/shopify.js` — helper to call Shopify GraphQL
- `package.json`, `vercel.json`, `.gitignore`, `README.md`



## Static defaults applied
The CSV generator now applies the exact static values you provided for all non-dynamic columns. Dynamic columns fetched from Shopify API: `shopify_product_id`, `FULL NAME`, `product_base_name`, `shopify_variant_id`, `product_variant_name`.
