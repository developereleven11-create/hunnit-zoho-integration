// api/generate.js
const { shopifyGraphQL, gidToId } = require('../utils/shopify');

const headers = [
  "title",
  "handle",
  "shopify_product_id",
  "variant_name",
  "variant_id",
  "product_type"
];

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : String(v);
  return '"' + s.replace(/"/g, '""') + '"';
}

async function fetchAllProducts(shopDomain, token) {
  let hasNext = true;
  let cursor = null;
  const products = [];
  while (hasNext) {
    const after = cursor ? `, after: "${cursor}"` : '';
    const query = `
      {
        products(first: 250${after}) {
          pageInfo { hasNextPage }
          edges {
            cursor
            node {
              id
              handle
              title
              productType
              variants(first:250) {
                edges {
                  node {
                    id
                    title
                  }
                }
              }
            }
          }
        }
      }`;
    const json = await shopifyGraphQL(shopDomain, token, query);
    if (!json || !json.data || !json.data.products) {
      throw new Error('Unexpected response from Shopify GraphQL: ' + JSON.stringify(json));
    }
    const prodEdges = json.data.products.edges || [];
    for (const edge of prodEdges) {
      products.push(edge.node);
      cursor = edge.cursor;
    }
    hasNext = json.data.products.pageInfo.hasNextPage;
  }
  return products;
}

async function buildCsvRows(shopDomain, token) {
  const products = await fetchAllProducts(shopDomain, token);
  const rows = [];
  for (const p of products) {
    const productId = gidToId(p.id);
    const title = p.title || '';
    const handle = p.handle || '';
    const productType = p.productType || '';
    const variantEdges = (p.variants && p.variants.edges) ? p.variants.edges : [];
    for (const ve of variantEdges) {
      const v = ve.node;
      const variantId = gidToId(v.id);
      const variantName = v.title || '';
      rows.push([
        title,
        handle,
        productId,
        variantName,
        variantId,
        productType
      ]);
    }
  }
  return rows;
}

module.exports = async (req, res) => {
  try {
    const shopDomain = process.env.SHOP_DOMAIN || req.query.SHOP_DOMAIN || req.body.SHOP_DOMAIN;
    const token = process.env.SHOP_TOKEN || req.query.SHOP_TOKEN || req.body.SHOP_TOKEN;
    if (!shopDomain || !token) {
      res.status(400).send('Missing SHOP_DOMAIN or SHOP_TOKEN environment variables.');
      return;
    }
    const rows = await buildCsvRows(shopDomain, token);
    const csvLines = [headers.map(csvEscape).join(',')].concat(rows.map(r => r.map(csvEscape).join(',')));
    const csv = csvLines.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=shopify_variants_simple.csv');
    res.status(200).send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error: ' + String(err));
  }
};
