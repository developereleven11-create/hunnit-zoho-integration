# Shopify Full Product Export (Vercel API)

This small Vercel serverless function exports **full product details** from a Shopify store into a downloadable CSV.

## Files
- `api/generate.js` — main API endpoint. Exports product-level info including options, images, metafields, and variants (variants and metafields are JSON strings in CSV).
- `utils/shopify.js` — helper to call Shopify GraphQL.
- `package.json` — project dependencies.
- `vercel.json` — Vercel config.

## Deploy (no CLI)
1. Create a new GitHub repository and copy this project structure into it (commit and push).
2. On Vercel, click **Import Project** → choose your GitHub repo → Deploy.
3. Add environment variables in Vercel Dashboard:
   - `SHOP_DOMAIN` (e.g. `your-store.myshopify.com`)
   - `SHOP_TOKEN` (Admin API access token with read_products scope)

> Quick test (not secure): you can also open the endpoint in browser with query params (only for quick testing):
> `https://<your-vercel-app>.vercel.app/api/generate?SHOP_DOMAIN=your-store.myshopify.com&SHOP_TOKEN=shpat_xxx`
> But do **not** put sensitive tokens in public links for production.

## Output
- Downloads `shopify_all_products.csv`.
- Columns include product metadata and JSON strings under `metafields_json` and `variants_json`. If you’d prefer one CSV row per variant, I can change it to a flattened export.

## Notes
- The function paginates through Shopify GraphQL (250 per page) and will fetch all store products — for big catalogs this may take time or hit Shopify rate limits.
- Uses Shopify Admin GraphQL API version `2024-10`. Update `utils/shopify.js` if you want a different API version.
