const { shopifyGraphQL, gidToId } = require('../utils/shopify');

const headers = [
  "shopify_product_id",
  "handle",
  "title",
  "body_html",
  "product_type",
  "vendor",
  "tags",
  "published_at",
  "created_at",
  "updated_at",
  "options",
  "image_urls",
  "metafields_json",
  "variants_json"
];

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return '"' + String(s).replace(/"/g, '""') + '"';
}

async function fetchAllProducts(shopDomain, token) {
  // Use GraphQL pagination to fetch all products (250 per page max)
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
              descriptionHtml
              productType
              vendor
              tags
              publishedAt
              createdAt
              updatedAt
              options { id name values }
              images(first:250) {
                edges { node { id url altText width height } }
              }
              metafields(first:250) {
                edges { node { id namespace key value type description } }
              }
              variants(first:250) {
                edges {
                  node {
                    id
                    title
                    sku
                    barcode
                    price
                    compareAtPrice
                    weight
                    weightUnit
                    inventoryQuantity
                    availableForSale
                    selectedOptions { name value }
                    image { id url altText }
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

function mapProductToRow(p) {
  // options as semicolon separated option:values
  const options = (p.options || []).map(o => `${o.name}:${(o.values||[]).join('|')}`).join(';');
  const images = (p.images && p.images.edges) ? p.images.edges.map(e => e.node.url) : [];
  const metafields = (p.metafields && p.metafields.edges) ? p.metafields.edges.map(e => ({
    id: e.node.id,
    namespace: e.node.namespace,
    key: e.node.key,
    value: e.node.value,
    type: e.node.type,
    description: e.node.description
  })) : [];
  const variants = (p.variants && p.variants.edges) ? p.variants.edges.map(e => ({
    id: e.node.id,
    title: e.node.title,
    sku: e.node.sku,
    barcode: e.node.barcode,
    price: e.node.price,
    compareAtPrice: e.node.compareAtPrice,
    weight: e.node.weight,
    weightUnit: e.node.weightUnit,
    inventoryQuantity: e.node.inventoryQuantity,
    availableForSale: e.node.availableForSale,
    selectedOptions: e.node.selectedOptions,
    image: e.node.image ? e.node.image.url : null
  })) : [];

  return [
    gidToId(p.id),
    p.handle || '',
    p.title || '',
    p.descriptionHtml || '',
    p.productType || '',
    p.vendor || '',
    Array.isArray(p.tags) ? p.tags.join(',') : (p.tags || ''),
    p.publishedAt || '',
    p.createdAt || '',
    p.updatedAt || '',
    options,
    images.join('|'),
    JSON.stringify(metafields),
    JSON.stringify(variants)
  ];
}

async function buildCsvRows(shopDomain, token) {
  const products = await fetchAllProducts(shopDomain, token);
  const rows = products.map(mapProductToRow);
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
    res.setHeader('Content-Disposition', 'attachment; filename=shopify_all_products.csv');
    res.status(200).send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error: ' + String(err));
  }
};
