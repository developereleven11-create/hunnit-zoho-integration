const { shopifyGraphQL, gidToId } = require('../utils/shopify');

const headers = [
  "shopify_product_id",
  "FULL NAME",
  "product_base_name",
  "shopify_variant_id",
  "product_variant_name",
  "Purchase Rate",
  "price",
  "hsn",
  "Inter State Tax Rate",
  "Desc",
  "Product Type",
  "Account",
  "Usage unit",
  "Purchase Account",
  "Initial Stock",
  "Inventory Account",
  "Item Type",
  "Status",
  "Inter State Tax Name",
  "Inter State Tax Type",
  "Intra State Tax Name",
  "Intra State Tax Type",
  "Intra State Tax Rate"
];

// User-provided static defaults for the non-dynamic columns
const STATIC_DEFAULTS = {
  "Purchase Rate": "0",
  "price": "1400",
  "hsn": "6206",
  "Inter State Tax Rate": "12.00",
  "Desc": "",
  "Product Type": "goods",
  "Account": "Sales",
  "Usage unit": "pcs",
  "Purchase Account": "Cost of Goods Sold",
  "Initial Stock": "1,000.00",
  "Inventory Account": "",
  "Item Type": "Inventory",
  "Status": "Active",
  "Inter State Tax Name": "IGST12",
  "Inter State Tax Type": "Simple",
  "Intra State Tax Name": "GST12",
  "Intra State Tax Type": "Group",
  "Intra State Tax Rate": "12.00"
};

function csvEscape(s) {
  if (s === undefined || s === null) return '';
  const str = String(s);
  return '"' + str.replace(/"/g, '""') + '"';
}

async function buildCsvRows(shopDomain, token) {
  const query = `query getLatest50Products {
    products(first: 50, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          title
          handle
          productType
          variants(first: 250) {
            edges {
              node {
                id
                title
                sku
                price
                inventoryQuantity
              }
            }
          }
        }
      }
    }
  }`;

  const data = await shopifyGraphQL(shopDomain, token, query);
  const rows = [];
  const products = (data && data.data && data.data.products && data.data.products.edges) ? data.data.products.edges : [];

  for (const pEdge of products) {
    const p = pEdge.node;
    const productId = gidToId(p.id);
    const productTitle = p.title || '';
    const baseName = p.handle || '';
    const productType = p.productType || STATIC_DEFAULTS["Product Type"];

    const variants = (p.variants && p.variants.edges) ? p.variants.edges : [];

    // If no variants, create a single row with empty variant fields
    if (!variants || variants.length === 0) {
      const fullNameNoVariant = productTitle; // no variant to append
      const row = [
        productId,
        fullNameNoVariant,
        baseName,
        "",
        "",
        STATIC_DEFAULTS["Purchase Rate"],
        STATIC_DEFAULTS["price"],
        STATIC_DEFAULTS["hsn"],
        STATIC_DEFAULTS["Inter State Tax Rate"],
        STATIC_DEFAULTS["Desc"],
        productType,
        STATIC_DEFAULTS["Account"],
        STATIC_DEFAULTS["Usage unit"],
        STATIC_DEFAULTS["Purchase Account"],
        STATIC_DEFAULTS["Initial Stock"],
        STATIC_DEFAULTS["Inventory Account"],
        STATIC_DEFAULTS["Item Type"],
        STATIC_DEFAULTS["Status"],
        STATIC_DEFAULTS["Inter State Tax Name"],
        STATIC_DEFAULTS["Inter State Tax Type"],
        STATIC_DEFAULTS["Intra State Tax Name"],
        STATIC_DEFAULTS["Intra State Tax Type"],
        STATIC_DEFAULTS["Intra State Tax Rate"]
      ];
      rows.push(row);
    } else {
      // For each variant, include variant in FULL NAME (cleaned)
      for (const vEdge of variants) {
        const v = vEdge.node;
        const variantId = gidToId(v.id);
        const variantNameRaw = v.title || '';

        // Clean variant name: remove single and double quotes
        const cleanedVariantName = variantNameRaw.replace(/['"]/g, '');

        // Build FULL NAME as "Product Title - Variant Title (cleaned)"
        const fullName = cleanedVariantName ? `${productTitle} - ${cleanedVariantName}` : productTitle;

        const price = v.price || STATIC_DEFAULTS["price"];
        const inventory = (v.inventoryQuantity !== undefined && v.inventoryQuantity !== null) ? v.inventoryQuantity : STATIC_DEFAULTS["Initial Stock"];

        const row = [
          productId,                // shopify_product_id (dynamic)
          fullName,                 // FULL NAME (product + " - " + variant cleaned)
          baseName,                 // product_base_name (dynamic)
          variantId,                // shopify_variant_id (dynamic)
          variantNameRaw,           // product_variant_name (dynamic, not cleaned)
          STATIC_DEFAULTS["Purchase Rate"],
          price,
          STATIC_DEFAULTS["hsn"],
          STATIC_DEFAULTS["Inter State Tax Rate"],
          STATIC_DEFAULTS["Desc"],
          productType,
          STATIC_DEFAULTS["Account"],
          STATIC_DEFAULTS["Usage unit"],
          STATIC_DEFAULTS["Purchase Account"],
          inventory,
          STATIC_DEFAULTS["Inventory Account"],
          STATIC_DEFAULTS["Item Type"],
          STATIC_DEFAULTS["Status"],
          STATIC_DEFAULTS["Inter State Tax Name"],
          STATIC_DEFAULTS["Inter State Tax Type"],
          STATIC_DEFAULTS["Intra State Tax Name"],
          STATIC_DEFAULTS["Intra State Tax Type"],
          STATIC_DEFAULTS["Intra State Tax Rate"]
        ];
        rows.push(row);
      }
    }
  }
  return rows;
}

// This file can run standalone (node api/generate.js) for quick tests or be used as a Vercel function.
async function mainStandalone() {
  const shopDomain = process.env.SHOP_DOMAIN;
  const token = process.env.SHOP_TOKEN;
  if (!shopDomain || !token) {
    console.error('Set SHOP_DOMAIN and SHOP_TOKEN environment variables to run locally.');
    process.exit(1);
  }
  const rows = await buildCsvRows(shopDomain, token);
  const csv = headers.map(h => csvEscape(h)).join(',') + '\n' + rows.map(r => r.map(csvEscape).join(',')).join('\n');
  console.log(csv);
}

if (require.main === module) {
  mainStandalone();
}

// Vercel handler export
module.exports = async (req, res) => {
  try {
    const shopDomain = process.env.SHOP_DOMAIN;
    const token = process.env.SHOP_TOKEN;
    if (!shopDomain || !token) {
      res.status(400).send('Missing SHOP_DOMAIN or SHOP_TOKEN environment variables.');
      return;
    }
    const rows = await buildCsvRows(shopDomain, token);
    const csvLines = [headers.map(csvEscape).join(',')].concat(rows.map(r => r.map(csvEscape).join(',')));
    const csv = csvLines.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=shopify_latest_50_products.csv');
    res.status(200).send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error: ' + String(err));
  }
};
