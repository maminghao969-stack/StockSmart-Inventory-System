import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { INITIAL_PRODUCTS, SUPPLIERS, INITIAL_SALES } from "./src/data/stocksmartSqlData";
import { Product, SaleRecord, Supplier } from "./src/types";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const USE_MYSQL = String(process.env.USE_MYSQL || "true").toLowerCase() === "true";
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

function requireBotKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  const expected = process.env.BOTPRESS_API_KEY;
  if (!expected) return next(); // no key configured yet = open (fine for local testing only)
  if (req.header("x-api-key") !== expected) return res.status(401).json({ error: "Invalid or missing API key" });
  next();
}

let products: Product[] = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
let sales: SaleRecord[] = JSON.parse(JSON.stringify(INITIAL_SALES));
let suppliers: Supplier[] = JSON.parse(JSON.stringify(SUPPLIERS));
let pool: any = null;

async function getPool() {
  if (!USE_MYSQL) return null;
  if (pool) return pool;
  const mysql = await import("mysql2/promise");
  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "stocksmart_ai_clean",
    waitForConnections: true,
    connectionLimit: 10,
  });
  return pool;
}

async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const p = await getPool();
  if (!p) return [];
  const [rows] = await p.execute(sql, params);
  return rows as T[];
}

async function triggerLowStockWebhook(productName: string, stock: number, reorderLevel?: number) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return { sent: false, reason: "N8N_WEBHOOK_URL is not configured in .env" };
  }

  // The teammate workflow reads $json.query.product and $json.query.stock,
  // so the website sends these values as URL query parameters.
  const url = new URL(webhookUrl);
  url.searchParams.set("product", productName);
  url.searchParams.set("stock", String(stock));
  if (reorderLevel !== undefined) url.searchParams.set("reorderLevel", String(reorderLevel));

  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    throw new Error(`n8n returned HTTP ${response.status}`);
  }
  return { sent: true };
}

async function notifyN8nIfNeeded(product: Product, remainingStock: number) {
  if (remainingStock > product.reorder_level) return;
  try {
    await triggerLowStockWebhook(product.product_name, remainingStock, product.reorder_level);
  } catch (error) {
    console.error("n8n low-stock alert failed:", error);
    // Checkout still succeeds even when n8n or Telegram is temporarily offline.
  }
}

async function readProducts(): Promise<Product[]> {
  if (!USE_MYSQL) return products;
  const rows = await query<any>(`
    SELECT p.product_id, p.product_name, p.category, p.quantity, p.cost_price, p.selling_price,
           p.supplier_id, p.reorder_level, DATE_FORMAT(p.last_updated, '%Y-%m-%d') AS last_updated,
           s.supplier_name AS supplier, s.contact_person, s.phone AS supplier_phone, s.email AS supplier_email
    FROM products p
    LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id
    ORDER BY p.product_id
  `);
  return rows.map(r => ({ ...r, id: String(r.product_id), quantity: Number(r.quantity), cost_price: Number(r.cost_price), selling_price: Number(r.selling_price), reorder_level: Number(r.reorder_level) }));
}

async function readSuppliers(): Promise<Supplier[]> {
  if (!USE_MYSQL) return suppliers;
  return query<Supplier>(`SELECT supplier_id, supplier_name, contact_person, phone, email, address FROM suppliers ORDER BY supplier_id`);
}

async function readSales(): Promise<SaleRecord[]> {
  if (!USE_MYSQL) return sales;
  const rows = await query<any>(`SELECT sale_id, product_id, quantity_sold, sale_price, DATE_FORMAT(sale_date, '%Y-%m-%d %H:%i:%s') AS sale_date FROM sales_records ORDER BY sale_date`);
  return rows.map(r => ({ ...r, quantity_sold: Number(r.quantity_sold), sale_price: Number(r.sale_price) }));
}

function analyzeInventory(list: Product[]) {
  const lowStock: Product[] = [];
  const overstocked: Product[] = [];
  const negativeMargin: Product[] = [];
  const duplicates: { p1: Product; p2: Product }[] = [];
  const healthy: Product[] = [];

  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const issues = [];
    if (p.quantity <= p.reorder_level) { lowStock.push(p); issues.push("low"); }
    if (p.quantity >= p.reorder_level * 5) { overstocked.push(p); issues.push("over"); }
    if (p.selling_price < p.cost_price) { negativeMargin.push(p); issues.push("margin"); }
    if (!issues.length) healthy.push(p);
    for (let j = i + 1; j < list.length; j++) {
      const q = list[j];
      const simplifiedA = p.product_name.toLowerCase().replace(/coca-cola/g, "coke").replace(/[^a-z0-9]/g, "");
      const simplifiedB = q.product_name.toLowerCase().replace(/coca-cola/g, "coke").replace(/[^a-z0-9]/g, "");
      if (p.category === q.category && simplifiedA.includes("coke") && simplifiedB.includes("coke") && /320ml/i.test(p.product_name + q.product_name)) duplicates.push({ p1: p, p2: q });
    }
  }

  const issues = list.map(p => {
    let ai_flag = "OK";
    let recommendation = "No action required.";
    if (p.selling_price < p.cost_price) {
      ai_flag = "Selling price lower than cost price";
      recommendation = `Raise selling price above $${p.cost_price.toFixed(2)}. Suggested selling price: $${(p.cost_price * 1.35).toFixed(2)}.`;
    } else if (p.quantity <= p.reorder_level) {
      ai_flag = "Low stock";
      recommendation = `Reorder ${Math.max(1, p.reorder_level * 2 - p.quantity)} units from ${p.supplier || "the supplier"}.`;
    } else if (p.quantity >= p.reorder_level * 5) {
      ai_flag = "Possible overstock";
      recommendation = "Run a promotion, bundle this item, or reduce the next purchase order.";
    }
    return { product_id: p.product_id, product_name: p.product_name, category: p.category, quantity: p.quantity, reorder_level: p.reorder_level, supplier: p.supplier || "", ai_flag, recommendation };
  }).filter(x => x.ai_flag !== "OK");

  return { lowStock, overstocked, negativeMargin, duplicates, healthy, issues };
}

function getSaleProfit(sale: SaleRecord, list: Product[]) {
  const product = list.find(p => p.product_id === sale.product_id);
  const unitCost = product?.cost_price ?? 0;
  const revenue = sale.quantity_sold * sale.sale_price;
  const cost = sale.quantity_sold * unitCost;
  return { revenue, cost, profit: revenue - cost, product };
}

function getMonthlySalesReport(list: Product[], saleList: SaleRecord[]) {
  const byMonth = new Map<string, { month: string; label: string; revenue: number; cost: number; profit: number; unitsSold: number; transactions: number }>();
  for (const sale of saleList) {
    const month = sale.sale_date.slice(0, 7);
    const label = new Date(`${month}-01T00:00:00`).toLocaleDateString("en-SG", { month: "short", year: "numeric" });
    const current = byMonth.get(month) || { month, label, revenue: 0, cost: 0, profit: 0, unitsSold: 0, transactions: 0 };
    const sp = getSaleProfit(sale, list);
    current.revenue += sp.revenue;
    current.cost += sp.cost;
    current.profit += sp.profit;
    current.unitsSold += sale.quantity_sold;
    current.transactions += 1;
    byMonth.set(month, current);
  }
  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function getTopSellingProducts(list: Product[], saleList: SaleRecord[]) {
  const map = new Map<number, { product_id: number; product_name: string; category: string; supplier: string; totalSold: number; revenue: number; profit: number }>();
  for (const sale of saleList) {
    const sp = getSaleProfit(sale, list);
    if (!sp.product) continue;
    const row = map.get(sale.product_id) || { product_id: sale.product_id, product_name: sp.product.product_name, category: sp.product.category, supplier: sp.product.supplier || "-", totalSold: 0, revenue: 0, profit: 0 };
    row.totalSold += sale.quantity_sold;
    row.revenue += sp.revenue;
    row.profit += sp.profit;
    map.set(sale.product_id, row);
  }
  return Array.from(map.values()).sort((a,b)=>b.totalSold-a.totalSold).slice(0, 8);
}

function getAiRecommendations(list: Product[], saleList: SaleRecord[]) {
  const analysis = analyzeInventory(list);
  const top = getTopSellingProducts(list, saleList)[0];
  const recs = [
    ...analysis.negativeMargin.map(p => ({ priority: "High", type: "Pricing", title: `Fix pricing for ${p.product_name}`, detail: `Selling price $${p.selling_price.toFixed(2)} is below cost $${p.cost_price.toFixed(2)}.`, action: `Suggested selling price: $${(p.cost_price * 1.35).toFixed(2)} or above.` })),
    ...analysis.lowStock.slice(0, 10).map(p => ({ priority: "High", type: "Restock", title: `Reorder ${p.product_name}`, detail: `${p.quantity} units left, below/at reorder level ${p.reorder_level}.`, action: `Order ${Math.max(1, p.reorder_level * 2 - p.quantity)} units from ${p.supplier || "supplier"}.` })),
    ...analysis.overstocked.map(p => ({ priority: "Medium", type: "Promotion", title: `Create promotion for ${p.product_name}`, detail: `${p.quantity} units in stock compared to reorder level ${p.reorder_level}.`, action: "Bundle with a fast-moving item or pause next restock." })),
    ...analysis.duplicates.map(d => ({ priority: "Medium", type: "Data Cleaning", title: `Review duplicate product names`, detail: `${d.p1.product_name} and ${d.p2.product_name} may refer to the same item.`, action: "Merge duplicate products before importing into SQL." }))
  ];
  if (top) recs.push({ priority: "Low", type: "Sales", title: `Protect best seller: ${top.product_name}`, detail: `${top.totalSold} units sold and $${top.profit.toFixed(2)} profit generated.`, action: "Keep stock above reorder level to prevent lost revenue." });
  return recs;
}

function getPromotionSuggestions(list: Product[], saleList: SaleRecord[]) {
  const analysis = analyzeInventory(list);
  const suggestions = analysis.overstocked.slice(0, 4).map(p => ({
    title: `${p.product_name} Bundle`,
    reason: `Overstocked at ${p.quantity} units versus reorder level ${p.reorder_level}.`,
    suggestion: `Offer a bundle discount or pair with a popular product to reduce excess inventory.`,
    impact: "Reduce holding cost and free storage space."
  }));
  const low = analysis.lowStock[0];
  if (low) suggestions.push({ title: `Protect ${low.product_name}`, reason: `Low stock may cause missed sales.`, suggestion: `Restock before running any promotions for this item.`, impact: "Avoid stockout and protect customer demand." });
  if (!suggestions.length && saleList.length) suggestions.push({ title: "Maintain healthy stock", reason: "No urgent overstock detected.", suggestion: "Use small bundles on slow-moving categories only.", impact: "Keeps inventory balanced without heavy discounts." });
  return suggestions;
}

function getBusinessRecommendations(list: Product[], saleList: SaleRecord[]) {
  const monthly = getMonthlySalesReport(list, saleList);
  const latest = monthly[monthly.length - 1];
  return [
    { title: "Implement Dynamic Reordering", detail: "Use reorder level + sales trend to decide when to restock instead of manually checking shelves.", action: "Prioritise high-margin and low-stock products first." },
    { title: "Clean Data Before SQL Import", detail: "AI flags duplicate names, pricing errors, overstock, and low stock before the data enters the database.", action: "Review AI flags before approving inventory changes." },
    { title: "Profit Monitoring", detail: latest ? `${latest.label} generated $${latest.profit.toFixed(2)} profit from ${latest.transactions} sales records.` : "No sales records are available yet.", action: "Use the Monthly Sales & Profit tab to explain business performance." }
  ];
}

async function dashboard() {
  const list = await readProducts();
  const saleList = await readSales();
  const supList = await readSuppliers();
  const totalProducts = list.length;
  const totalUnits = list.reduce((s,p)=>s+p.quantity,0);
  const totalCostValue = list.reduce((s,p)=>s+p.quantity*p.cost_price,0);
  const totalRetailValue = list.reduce((s,p)=>s+p.quantity*p.selling_price,0);
  const totalRevenue = saleList.reduce((s,x)=>s+x.quantity_sold*x.sale_price,0);
  const totalSalesCost = saleList.reduce((s,x)=>s+getSaleProfit(x, list).cost,0);
  const totalSalesProfit = totalRevenue - totalSalesCost;
  const analysis = analyzeInventory(list);
  const monthlySales = getMonthlySalesReport(list, saleList);
  const latestMonth = monthlySales[monthlySales.length - 1] || { month: "N/A", label: "No sales", revenue: 0, cost: 0, profit: 0, unitsSold: 0, transactions: 0 };
  const avgMargin = totalRevenue > 0 ? (totalSalesProfit / totalRevenue) * 100 : 0;
  const peak = monthlySales.reduce((best, row) => row.revenue > (best?.revenue || 0) ? row : best, monthlySales[0]);
  return {
    dataMode: USE_MYSQL ? "MySQL live database" : "Demo data matched to SQL schema",
    totalProducts, totalUnits, totalCostValue, totalRetailValue, totalRevenue, totalSalesProfit, totalSalesCost,
    potentialProfit: totalRetailValue-totalCostValue,
    avgMargin, peakMonth: peak || latestMonth, latestMonth, monthlySales,
    topSellingProducts: getTopSellingProducts(list, saleList),
    aiRecommendations: getAiRecommendations(list, saleList),
    promotionSuggestions: getPromotionSuggestions(list, saleList),
    businessRecommendations: getBusinessRecommendations(list, saleList),
    analysis,
    databaseQuality: getDatabaseQualitySummary(list, supList),
    suppliers: supList.length,
    lastUpdated: new Date().toISOString()
  };
}


function getDuplicatePairs(list: Product[]) {
  const pairs: { p1: Product; p2: Product; score: number }[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const score = similarityScore(list[i].product_name, list[j].product_name);
      const sameCategory = String(list[i].category || "").toLowerCase() === String(list[j].category || "").toLowerCase();
      if (sameCategory && score >= 0.86) pairs.push({ p1: list[i], p2: list[j], score });
    }
  }
  return pairs.sort((a, b) => b.score - a.score);
}

function getDatabaseQualitySummary(list: Product[], supList: Supplier[]) {
  const duplicatePairs = getDuplicatePairs(list);
  const supplierIds = new Set(supList.map(s => Number(s.supplier_id)));
  const missingSuppliers = list.filter(p => !p.supplier_id || !supplierIds.has(Number(p.supplier_id)));
  const invalidPricing = list.filter(p => Number(p.selling_price) < Number(p.cost_price));
  const wrongCategories = list.filter(p => !String(p.category || "").trim() || String(p.category).toLowerCase() === "general");
  const lowStock = list.filter(p => Number(p.quantity) <= Number(p.reorder_level));
  const overstocked = list.filter(p => Number(p.reorder_level) > 0 && Number(p.quantity) >= Number(p.reorder_level) * 5);
  const excessCapitalTiedUp = overstocked.reduce((sum, p) => {
    const healthyStockTarget = Number(p.reorder_level) * 2;
    const excessUnits = Math.max(0, Number(p.quantity) - healthyStockTarget);
    return sum + excessUnits * Number(p.cost_price);
  }, 0);
  const sellingBelowCostLosses = invalidPricing.reduce((sum, p) => sum + Math.max(0, Number(p.cost_price) - Number(p.selling_price)) * Number(p.quantity), 0);
  const issueCount = duplicatePairs.length + missingSuppliers.length + invalidPricing.length + wrongCategories.length;
  const totalAlertTriggers = lowStock.length + invalidPricing.length;
  const penalty = duplicatePairs.length * 12 + missingSuppliers.length * 18 + invalidPricing.length * 18 + wrongCategories.length * 10;
  const healthScore = Math.max(0, Math.min(100, 100 - penalty));
  return {
    totalSkus: list.length,
    duplicateCount: duplicatePairs.length,
    duplicatePairs: duplicatePairs.slice(0, 8).map(d => ({
      productA: d.p1.product_name,
      productB: d.p2.product_name,
      score: Math.round(d.score * 100)
    })),
    missingSuppliersCount: missingSuppliers.length,
    missingSuppliers: missingSuppliers.slice(0, 8).map(p => p.product_name),
    invalidPricingCount: invalidPricing.length,
    invalidPricing: invalidPricing.slice(0, 8).map(p => ({ product_name: p.product_name, cost_price: p.cost_price, selling_price: p.selling_price })),
    wrongCategoriesCount: wrongCategories.length,
    wrongCategories: wrongCategories.slice(0, 8).map(p => p.product_name),
    lowStockCount: lowStock.length,
    overstockedCount: overstocked.length,
    totalAlertTriggers,
    excessCapitalTiedUp,
    sellingBelowCostLosses,
    healthScore,
    healthLabel: healthScore >= 90 ? "Excellent" : healthScore >= 75 ? "Good" : healthScore >= 55 ? "Needs Review" : "Critical",
    relationalSoundness: issueCount === 0 ? "100% Integrated" : `${Math.max(0, 100 - penalty)}% Needs Review`,
    issueCount,
    generatedAt: new Date().toISOString()
  };
}

app.get("/api/health", async (_req, res) => res.json({ ok: true, dataMode: USE_MYSQL ? "MySQL" : "Demo", products: (await readProducts()).length }));
app.get("/api/dashboard", async (_req, res) => res.json(await dashboard()));
app.get("/api/products", async (_req, res) => res.json({ products: await readProducts(), suppliers: await readSuppliers(), analysis: analyzeInventory(await readProducts()) }));
app.get("/api/suppliers", async (_req, res) => res.json({ suppliers: await readSuppliers() }));
app.get("/api/ai/database-quality", async (_req, res) => {
  const list = await readProducts();
  const supList = await readSuppliers();
  res.json(getDatabaseQualitySummary(list, supList));
});
app.post("/api/ai/auto-sanitize", async (_req, res) => {
  if (USE_MYSQL) {
    await query(`UPDATE products SET selling_price = ROUND(cost_price * 1.35, 2), last_updated = CURDATE() WHERE selling_price < cost_price`);
    await query(`UPDATE products SET category = 'General' WHERE category IS NULL OR TRIM(category) = ''`);
    await query(`UPDATE products SET supplier_id = (SELECT supplier_id FROM suppliers ORDER BY supplier_id LIMIT 1) WHERE supplier_id IS NULL`);
  } else {
    products = products.map(p => ({
      ...p,
      category: p.category || 'General',
      supplier_id: p.supplier_id || suppliers[0]?.supplier_id,
      supplier: p.supplier || suppliers[0]?.supplier_name,
      selling_price: p.selling_price < p.cost_price ? Number((p.cost_price * 1.35).toFixed(2)) : p.selling_price
    }));
  }
  const list = await readProducts();
  const supList = await readSuppliers();
  res.json({ ok: true, note: "Auto-sanitize completed. Pricing, missing suppliers, and blank categories were checked against the SQL database.", quality: getDatabaseQualitySummary(list, supList), dashboard: await dashboard() });
});
// --- Botpress tool endpoints -----------------------------------------
// Small, purpose-built reads for the bot to call live, per question.
// Protect with BOTPRESS_API_KEY once you're past local testing.

app.get("/api/bot/low-stock", requireBotKey, async (_req, res) => {
  const list = await readProducts();
  const analysis = analyzeInventory(list);
  res.json({
    asOf: new Date().toISOString(),
    count: analysis.lowStock.length,
    items: analysis.lowStock.map(p => ({
      product_name: p.product_name,
      quantity: p.quantity,
      reorder_level: p.reorder_level,
      supplier: p.supplier || null
    }))
  });
});

app.get("/api/bot/overstock", requireBotKey, async (_req, res) => {
  const list = await readProducts();
  const analysis = analyzeInventory(list);
  res.json({
    asOf: new Date().toISOString(),
    count: analysis.overstocked.length,
    items: analysis.overstocked.map(p => ({
      product_name: p.product_name,
      quantity: p.quantity,
      reorder_level: p.reorder_level
    }))
  });
});

app.get("/api/bot/product", requireBotKey, async (req, res) => {
  const q = String(req.query.name || "").toLowerCase().trim();
  if (!q) return res.status(400).json({ error: "Provide a 'name' query parameter, e.g. /api/bot/product?name=coke" });
  const list = await readProducts();
  const matches = list
    .filter(p => p.product_name.toLowerCase().includes(q))
    .slice(0, 5)
    .map(p => ({
      product_name: p.product_name,
      category: p.category,
      quantity: p.quantity,
      reorder_level: p.reorder_level,
      cost_price: p.cost_price,
      selling_price: p.selling_price,
      supplier: p.supplier || null
    }));
  res.json({ asOf: new Date().toISOString(), query: q, matches });
});

app.get("/api/bot/supplier", requireBotKey, async (req, res) => {
  const q = String(req.query.name || "").toLowerCase().trim();
  const supList = await readSuppliers();
  const matches = q
    ? supList.filter(s => s.supplier_name.toLowerCase().includes(q))
    : supList;
  res.json({
    asOf: new Date().toISOString(),
    matches: matches.slice(0, 10).map(s => ({
      supplier_name: s.supplier_name,
      contact_person: s.contact_person,
      phone: s.phone,
      email: s.email
    }))
  });
});

app.get("/api/bot/sales-summary", requireBotKey, async (_req, res) => {
  const list = await readProducts();
  const saleList = await readSales();
  const monthly = getMonthlySalesReport(list, saleList);
  const latest = monthly[monthly.length - 1];
  res.json({
    asOf: new Date().toISOString(),
    latestMonth: latest ? { label: latest.label, revenue: latest.revenue, profit: latest.profit, unitsSold: latest.unitsSold } : null,
    topSellers: getTopSellingProducts(list, saleList).slice(0, 5).map(p => ({
      product_name: p.product_name, totalSold: p.totalSold, revenue: p.revenue, profit: p.profit
    }))
  });
});

app.get("/api/bot/recommendations", requireBotKey, async (_req, res) => {
  const list = await readProducts();
  const saleList = await readSales();
  const recs = getAiRecommendations(list, saleList).slice(0, 5);
  res.json({ asOf: new Date().toISOString(), recommendations: recs });
});

app.get("/api/sales", async (_req, res) => {
  const list = await readProducts();
  const saleList = await readSales();
  res.json({ sales: saleList, monthlySales: getMonthlySalesReport(list, saleList), topSellingProducts: getTopSellingProducts(list, saleList) });
});


app.post("/api/products/validate", async (req, res) => {
  const result = await validateProductInput(req.body);
  res.json(result);
});

app.post("/api/products", async (req, res) => {
  const validation = await validateProductInput(req.body);
  const p = validation.cleanedProduct;
  if (!validation.canSave) return res.status(400).json({ error: "Product cannot be saved yet.", validation });

  if (USE_MYSQL) {
    const result: any = await query<any>(
      `INSERT INTO products (product_name, category, quantity, cost_price, selling_price, supplier_id, reorder_level, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE())`,
      [p.product_name, p.category, p.quantity, p.cost_price, p.selling_price, p.supplier_id, p.reorder_level]
    );
    await query(
      `INSERT INTO inventory_logs (product_id, change_type, quantity_changed, reason) VALUES (LAST_INSERT_ID(), 'Stock In', ?, 'AI validated product added through website')`,
      [p.quantity]
    );
    return res.json({ ok: true, validation, insertResult: result, dashboard: await dashboard() });
  }

  products.push({ ...p, product_id: Math.max(...products.map(x => x.product_id), 0) + 1, id: String(Math.max(...products.map(x => x.product_id), 0) + 1) });
  res.json({ ok: true, validation, dashboard: await dashboard() });
});


function normaliseProductName(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/coca[\s-]?cola/g, "coke")
    .replace(/[^a-z0-9]/g, "");
}

function similarityScore(a: string, b: string) {
  const x = normaliseProductName(a);
  const y = normaliseProductName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const matrix = Array.from({ length: x.length + 1 }, (_, i) => Array(y.length + 1).fill(0));
  for (let i = 0; i <= x.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= y.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  const distance = matrix[x.length][y.length];
  return 1 - distance / Math.max(x.length, y.length);
}

function buildCleanProduct(input: any, supList: Supplier[], currentProducts: Product[]) {
  const supplierById = supList.find(s => s.supplier_id === Number(input.supplier_id));
  const supplierByName = supList.find(s => s.supplier_name.toLowerCase() === String(input.supplier || "").toLowerCase());
  const partialSupplier = supList.find(s => s.supplier_name.toLowerCase().includes(String(input.supplier || "").toLowerCase()) && String(input.supplier || "").length > 2);
  const supplier = supplierById || supplierByName || partialSupplier || null;
  const nextId = currentProducts.length ? Math.max(...currentProducts.map(p => Number(p.product_id))) + 1 : 1;
  return {
    id: String(input.product_id || nextId),
    product_id: Number(input.product_id || nextId),
    product_name: String(input.product_name || "").trim(),
    category: String(input.category || "General").trim(),
    quantity: Math.max(0, Number(input.quantity || 0)),
    cost_price: Math.max(0, Number(input.cost_price || 0)),
    selling_price: Math.max(0, Number(input.selling_price || 0)),
    supplier_id: supplier?.supplier_id || null,
    supplier: supplier?.supplier_name || "",
    contact_person: supplier?.contact_person,
    supplier_phone: supplier?.phone,
    supplier_email: supplier?.email,
    reorder_level: Math.max(0, Number(input.reorder_level || 0)),
    last_updated: new Date().toISOString().slice(0, 10)
  } as Product;
}

async function validateProductInput(input: any) {
  const currentProducts = await readProducts();
  const supList = await readSuppliers();
  const cleanedProduct = buildCleanProduct(input, supList, currentProducts);
  const warnings: any[] = [];
  const recommendations: string[] = [];

  if (!cleanedProduct.product_name) {
    warnings.push({ severity: "High", type: "Missing Product Name", message: "Product name is required before saving." });
  }
  if (!cleanedProduct.supplier_id) {
    warnings.push({ severity: "Medium", type: "Missing Supplier", message: "Supplier could not be matched to the supplier database." });
    recommendations.push("Choose an existing supplier from the dropdown so Botpress and n8n can retrieve supplier contact details later.");
  }
  if (cleanedProduct.selling_price < cleanedProduct.cost_price) {
    warnings.push({ severity: "High", type: "Pricing Error", message: `Selling price $${cleanedProduct.selling_price.toFixed(2)} is lower than cost price $${cleanedProduct.cost_price.toFixed(2)}.` });
    recommendations.push(`Suggested selling price: $${(cleanedProduct.cost_price * 1.35).toFixed(2)} or above to protect profit margin.`);
  }
  if (cleanedProduct.quantity <= cleanedProduct.reorder_level) {
    warnings.push({ severity: "High", type: "Low Stock", message: `Quantity ${cleanedProduct.quantity} is at or below reorder level ${cleanedProduct.reorder_level}.` });
    recommendations.push(`Suggested reorder quantity: ${Math.max(1, cleanedProduct.reorder_level * 2 - cleanedProduct.quantity)} units.`);
  }
  if (cleanedProduct.reorder_level > 0 && cleanedProduct.quantity >= cleanedProduct.reorder_level * 5) {
    warnings.push({ severity: "Medium", type: "Possible Overstock", message: `Quantity ${cleanedProduct.quantity} is very high compared with reorder level ${cleanedProduct.reorder_level}.` });
    recommendations.push("Consider running a promotion or reducing the next purchase order.");
  }

  const duplicates = currentProducts
    .map(p => ({ product: p, score: similarityScore(p.product_name, cleanedProduct.product_name) }))
    .filter(x => x.score >= 0.78 && x.product.category.toLowerCase() === cleanedProduct.category.toLowerCase())
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (duplicates.length) {
    warnings.push({ severity: "High", type: "Possible Duplicate", message: `This product looks similar to ${duplicates.map(d => d.product.product_name).join(", ")}.` });
    recommendations.push("Review the duplicate warning before saving. You may want to merge with the existing product instead of creating a new entry.");
  }

  const qualityScore = Math.max(35, 100 - warnings.reduce((sum, w) => sum + (w.severity === "High" ? 18 : 10), 0));
  return {
    cleanedProduct,
    warnings,
    duplicates,
    recommendations,
    qualityScore,
    canSave: !warnings.some(w => w.type === "Missing Product Name"),
    summary: warnings.length
      ? `AI found ${warnings.length} issue(s). Review before saving to the inventory database.`
      : "AI check passed. This product looks ready to save into the inventory database."
  };
}

app.put("/api/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (USE_MYSQL) {
    await query(`UPDATE products SET product_name=?, category=?, quantity=?, cost_price=?, selling_price=?, reorder_level=?, last_updated=CURDATE() WHERE product_id=?`, [req.body.product_name, req.body.category, Number(req.body.quantity), Number(req.body.cost_price), Number(req.body.selling_price), Number(req.body.reorder_level), id]);
    return res.json({ ok: true, dashboard: await dashboard() });
  }
  const index = products.findIndex(p => p.product_id === id);
  if (index === -1) return res.status(404).json({ error: "Product not found" });
  products[index] = { ...products[index], ...req.body, quantity: Number(req.body.quantity ?? products[index].quantity), cost_price: Number(req.body.cost_price ?? products[index].cost_price), selling_price: Number(req.body.selling_price ?? products[index].selling_price), reorder_level: Number(req.body.reorder_level ?? products[index].reorder_level) };
  res.json({ ok: true, dashboard: await dashboard() });
});

app.post("/api/sales", async (req, res) => {
  const product_id = Number(req.body.product_id);
  const quantity_sold = Math.max(1, Number(req.body.quantity_sold || 1));
  const list = await readProducts();
  const product = list.find(p => p.product_id === product_id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  if (product.quantity < quantity_sold) return res.status(400).json({ error: `Only ${product.quantity} unit(s) left for ${product.product_name}.` });
  const sale_price = Number(req.body.sale_price || product.selling_price);

  if (USE_MYSQL) {
    const p = await getPool();
    const connection = await p.getConnection();
    try {
      await connection.beginTransaction();
      const [[lockedProduct]]: any = await connection.execute(
        `SELECT product_id, product_name, quantity, selling_price, reorder_level FROM products WHERE product_id = ? FOR UPDATE`,
        [product_id]
      );
      if (!lockedProduct) throw new Error("Product not found");
      if (Number(lockedProduct.quantity) < quantity_sold) throw new Error(`Only ${lockedProduct.quantity} unit(s) left for ${lockedProduct.product_name}.`);
      await connection.execute(`INSERT INTO sales_records (product_id, quantity_sold, sale_price, sale_date) VALUES (?, ?, ?, NOW())`, [product_id, quantity_sold, sale_price]);
      await connection.execute(`UPDATE products SET quantity = quantity - ?, last_updated = CURDATE() WHERE product_id = ?`, [quantity_sold, product_id]);
      await connection.execute(`INSERT INTO inventory_logs (product_id, change_type, quantity_changed, reason, log_date) VALUES (?, 'Stock Out', ?, 'Customer portal checkout', NOW())`, [product_id, -quantity_sold]);
      await connection.commit();
      await notifyN8nIfNeeded(product, Number(lockedProduct.quantity) - quantity_sold);
    } catch (error: any) {
      await connection.rollback();
      return res.status(400).json({ error: error.message || "Checkout failed" });
    } finally {
      connection.release();
    }
  } else {
    sales.push({ sale_id: sales.length + 1, product_id, quantity_sold, sale_price, sale_date: new Date().toISOString().slice(0,19).replace("T", " ") });
    products = products.map(p => p.product_id === product_id ? { ...p, quantity: p.quantity - quantity_sold } : p);
  }
  res.json({ ok: true, message: `${quantity_sold} ${product.product_name} checked out. MySQL inventory, sales records and inventory logs updated.`, dashboard: await dashboard() });
});

app.post("/api/ai/clean", async (req, res) => {
  const incoming = Array.isArray(req.body.products) ? req.body.products : await readProducts();
  const supList = await readSuppliers();
  const cleaned = incoming.map((p: any, idx: number) => {
    const supplier = supList.find(s => s.supplier_id === Number(p.supplier_id)) || supList.find(s => s.supplier_name === p.supplier) || supList[0];
    return { ...p, id: String(p.id || p.product_id || idx + 1), product_id: Number(p.product_id || idx + 1), product_name: String(p.product_name || p.name || "Unnamed Product").trim(), category: String(p.category || "General").trim(), quantity: Math.max(0, Number(p.quantity || 0)), cost_price: Math.max(0, Number(p.cost_price || 0)), selling_price: Math.max(0, Number(p.selling_price || 0)), reorder_level: Math.max(0, Number(p.reorder_level || 5)), supplier_id: supplier?.supplier_id, supplier: supplier?.supplier_name, contact_person: supplier?.contact_person, supplier_phone: supplier?.phone, supplier_email: supplier?.email } as Product;
  });
  res.json({ cleaned, analysis: analyzeInventory(cleaned), note: "AI cleaning check completed: duplicates, pricing issues, low stock, overstock, and supplier matching were analysed." });
});


app.get("/api/integrations/status", async (_req, res) => {
  res.json({
    mysql: USE_MYSQL,
    n8nConfigured: Boolean(process.env.N8N_WEBHOOK_URL),
    botpressConfigured: Boolean(process.env.BOTPRESS_API_KEY),
    telegramDelivery: "Telegram is handled by the imported n8n workflow and its selected Telegram credential."
  });
});

app.post("/api/integrations/test-telegram", async (req, res) => {
  const productId = Number(req.body.product_id);
  const list = await readProducts();
  const product = list.find(p => p.product_id === productId) || list[0];
  if (!product) return res.status(404).json({ error: "No product is available for the test alert." });

  try {
    const result = await triggerLowStockWebhook(
      product.product_name,
      Number(req.body.stock ?? product.quantity),
      product.reorder_level
    );
    if (!result.sent) return res.status(400).json({ error: result.reason });
    res.json({ ok: true, message: `Test alert sent to n8n for ${product.product_name}. Check the Telegram account connected inside n8n.` });
  } catch (error: any) {
    res.status(502).json({ error: error.message || "Could not reach the n8n webhook." });
  }
});

app.post("/api/chat", async (req, res) => {
  const question = String(req.body.message || "").toLowerCase();
  const d = await dashboard();
  const analysis = d.analysis;
  let answer = "Ask me about low stock, overstock, suppliers, profit, monthly sales, or recommendations.";
  if (question.includes("low")) answer = analysis.lowStock.map((p: Product) => `${p.product_name}: ${p.quantity} left, reorder level ${p.reorder_level}, supplier ${p.supplier}`).join("\n") || "No low-stock products.";
  else if (question.includes("over")) answer = analysis.overstocked.map((p: Product) => `${p.product_name}: ${p.quantity} units, reorder level ${p.reorder_level}`).join("\n") || "No overstocked products.";
  else if (question.includes("supplier")) answer = (await readSuppliers()).map((s: Supplier) => `${s.supplier_name}: ${s.contact_person}, ${s.phone}, ${s.email}`).join("\n");
  else if (question.includes("profit")) answer = `Total sales profit is $${d.totalSalesProfit.toFixed(2)}. Latest month profit is $${d.latestMonth.profit.toFixed(2)}. Potential inventory profit is $${d.potentialProfit.toFixed(2)}.`;
  else if (question.includes("sales") || question.includes("month")) answer = d.monthlySales.map((m: any) => `${m.label}: revenue $${m.revenue.toFixed(2)}, profit $${m.profit.toFixed(2)}`).join("\n") || "No sales records yet.";
  else if (question.includes("recommend")) answer = d.aiRecommendations.slice(0,5).map((r:any)=>`${r.priority}: ${r.title} — ${r.action}`).join("\n");
  else if (question.includes("summary")) answer = `StockSmart summary: ${d.totalProducts} products, ${d.totalUnits} units, $${d.totalCostValue.toFixed(2)} stock cost value, $${d.totalRevenue.toFixed(2)} revenue, $${d.totalSalesProfit.toFixed(2)} profit, ${analysis.lowStock.length} low-stock alerts.`;
  res.json({ answer });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`StockSmart Integrated running at http://localhost:${PORT}`));
}

startServer().catch(err => {
  console.error("Server failed to start", err);
  process.exit(1);
});