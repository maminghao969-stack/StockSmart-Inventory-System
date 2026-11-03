import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  Database,
  DollarSign,
  FileUp,
  Home,
  ShieldCheck,
  Layers,
  Package,
  RefreshCcw,
  Search,
  Send,
  Sparkles,
  TrendingUp,
  Truck,
  Workflow,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
} from "lucide-react";
import { Product, Supplier, Message } from "./types";

type Tab = "dashboard" | "inventory" | "ai" | "customer" | "chatbot" | "automation";
type CartItem = { product_id: number; quantity: number };
type DashboardView = "live" | "sales" | "recommendations";

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboardView, setDashboardView] = useState<DashboardView>("live");
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [analysis, setAnalysis] = useState<any>({ lowStock: [], overstocked: [], negativeMargin: [], duplicates: [], issues: [] });
  const [dashboard, setDashboard] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [saleProduct, setSaleProduct] = useState<number | "">("");
  const [saleQty, setSaleQty] = useState(1);
  const [newProduct, setNewProduct] = useState({
    product_name: "",
    category: "Beverage",
    quantity: '',
    cost_price: '',
    selling_price: '',
    supplier_id: "",
    reorder_level: '',
  });
  const [aiValidation, setAiValidation] = useState<any>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [chat, setChat] = useState<Message[]>([
    { role: "assistant", content: "Hi, I am the StockSmart AI chatbot placeholder. Ask me about suppliers, low stock, profit, monthly sales, or AI recommendations." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [dbQuality, setDbQuality] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [integrationStatus, setIntegrationStatus] = useState<any>(null);
  const [telegramProduct, setTelegramProduct] = useState<number | "">("");
  const [telegramTesting, setTelegramTesting] = useState(false);

  async function loadData(showNotice = false) {
    const [pRes, dRes, qRes, iRes] = await Promise.all([
      fetch("/api/products"),
      fetch("/api/dashboard"),
      fetch("/api/ai/database-quality"),
      fetch("/api/integrations/status")
    ]);
    const pData = await pRes.json();
    const dData = await dRes.json();
    const qData = await qRes.json();
    const iData = await iRes.json();
    setProducts(pData.products || []);
    setSuppliers(pData.suppliers || []);
    setAnalysis(pData.analysis || dData.analysis || {});
    setDashboard(dData);
    setDbQuality(qData || dData.databaseQuality || null);
    setIntegrationStatus(iData);
    if (showNotice) setNotice(`Dashboard refreshed from ${dData.dataMode}.`);
  }

  useEffect(() => {
    loadData();
    const timer = window.setInterval(() => loadData(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => products.filter((p) => p.product_name.toLowerCase().includes(query.toLowerCase()) || p.category.toLowerCase().includes(query.toLowerCase()) || (p.supplier || "").toLowerCase().includes(query.toLowerCase())), [products, query]);

  async function cleanData() {
    const res = await fetch("/api/ai/clean", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ products }) });
    const data = await res.json();
    setAnalysis(data.analysis);
    setNotice(data.note);
    await loadData();
  }

  async function autoSanitizeDatabase() {
    const res = await fetch("/api/ai/auto-sanitize", { method: "POST" });
    const data = await res.json();
    setNotice(data.note || "Auto-sanitize completed.");
    await loadData(true);
  }

  async function validateNewProduct() {
    setSavingProduct(true);
    const res = await fetch("/api/products/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newProduct) });
    const data = await res.json();
    setAiValidation(data);
    setNotice(data.summary || "AI validation completed.");
    setSavingProduct(false);
  }

  async function approveAndSaveProduct() {
    if (!aiValidation?.cleanedProduct) return;
    setSavingProduct(true);
    const res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(aiValidation.cleanedProduct) });
    const data = await res.json();
    if (!res.ok) {
      setNotice(data.error || "Product could not be saved.");
      setSavingProduct(false);
      return;
    }
    setNotice("AI-approved product saved. Inventory, dashboard and recommendations updated.");
    setNewProduct({ product_name: "", category: "Beverage", quantity: "", cost_price: "", selling_price: "", supplier_id: "", reorder_level: "" });
    setAiValidation(null);
    await loadData();
    setSavingProduct(false);
  }

  function updateNewProduct(field: string, value: any) {
    setNewProduct((prev) => ({ ...prev, [field]: value }));
    setAiValidation(null);
  }

  async function simulateSale() {
    if (!saleProduct) return;
    const res = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: saleProduct, quantity_sold: saleQty }) });
    const data = await res.json();
    if (!res.ok) return setNotice(data.error || "Sale failed.");
    setNotice("Sale recorded. Inventory, sales, profit, and AI recommendations updated.");
    await loadData();
  }

  const customerProducts = useMemo(() => products.filter((p) => p.quantity > 0 && (p.product_name.toLowerCase().includes(customerQuery.toLowerCase()) || p.category.toLowerCase().includes(customerQuery.toLowerCase()))), [products, customerQuery]);
  const cartDetails = useMemo(() => cart.map((item) => {
    const product = products.find((p) => p.product_id === item.product_id);
    return product ? { ...item, product, lineTotal: item.quantity * product.selling_price } : null;
  }).filter(Boolean) as Array<CartItem & { product: Product; lineTotal: number }>, [cart, products]);
  const cartTotal = cartDetails.reduce((sum, item) => sum + item.lineTotal, 0);
  const cartUnits = cartDetails.reduce((sum, item) => sum + item.quantity, 0);

  function addToCart(product: Product) {
    setCart((prev) => {
      const current = prev.find((item) => item.product_id === product.product_id);
      if (current) {
        return prev.map((item) => item.product_id === product.product_id ? { ...item, quantity: Math.min(product.quantity, item.quantity + 1) } : item);
      }
      return [...prev, { product_id: product.product_id, quantity: 1 }];
    });
  }

  function updateCartQuantity(productId: number, quantity: number) {
    const product = products.find((p) => p.product_id === productId);
    if (!product) return;
    const safeQty = Math.max(1, Math.min(product.quantity, quantity));
    setCart((prev) => prev.map((item) => item.product_id === productId ? { ...item, quantity: safeQty } : item));
  }

  function removeFromCart(productId: number) {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  }

  async function checkoutCart() {
    if (!cartDetails.length) return setNotice("Add at least one product before checkout.");
    for (const item of cartDetails) {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: item.product_id, quantity_sold: item.quantity })
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || `Checkout failed for ${item.product.product_name}.`);
        await loadData();
        return;
      }
    }
    setCart([]);
    setNotice("Customer checkout completed. MySQL products, sales_records and inventory_logs are updated.");
    await loadData(true);
  }


  async function testTelegramAlert() {
    const productId = telegramProduct || products[0]?.product_id;
    if (!productId) return setNotice("No product is available for the Telegram test.");
    setTelegramTesting(true);
    try {
      const product = products.find((p) => p.product_id === Number(productId));
      const res = await fetch("/api/integrations/test-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: Number(productId),
          stock: product ? Math.min(product.quantity, product.reorder_level) : 1
        })
      });
      const data = await res.json();
      setNotice(data.message || data.error || "Telegram test completed.");
    } finally {
      setTelegramTesting(false);
    }
  }

  async function sendChat() {
    if (!chatInput.trim()) return;
    const message = chatInput.trim();
    setChat((prev) => [...prev, { role: "user", content: message }]);
    setChatInput("");
    const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
    const data = await res.json();
    setChat((prev) => [...prev, { role: "assistant", content: data.answer }]);
  }

  const nav = [["dashboard", Home, "Dashboard"], ["inventory", Package, "Inventory"], ["ai", Sparkles, "AI Cleaning"], ["customer", ShoppingCart, "Customer Portal"], ["chatbot", Bot, "Botpress Space"], ["automation", Workflow, "n8n Space"]] as const;
  const innerTabs = [["live", Package, "Live Inventory"], ["sales", BarChart3, "Monthly Sales & Profits"], ["recommendations", Sparkles, "AI Recommendations"]] as const;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="topbar">
        <div className="brand">
          <div className="logo"><Database size={22} /></div>
          <div>
            <h1>StockSmart <span>AI</span></h1>
            <p>Intelligent inventory forecasting, overstock checks, and promotion suggestion engine</p>
          </div>
        </div>
        <nav className="mainNav">
          {nav.map(([id, Icon, label]) => <button key={id} onClick={() => setTab(id)} className={tab === id ? "nav active" : "nav"}><Icon size={16} />{label}</button>)}
        </nav>
      </header>

      <main className="container">
        {notice && <div className="notice"><CheckCircle2 size={18} />{notice}</div>}

        {tab === "dashboard" && (
          <section>
            <div className="metricGrid four">
              <Metric title="Total Products" value={dashboard?.totalProducts ?? 0} icon={<Package />} />
              <Metric title="Stock Valuation (Cost)" value={`$${money(dashboard?.totalCostValue)}`} icon={<DollarSign />} />
              <Metric title="Projected Profit" value={`$${money(dashboard?.potentialProfit)}`} icon={<TrendingUp />} />
              <Metric title="Low Stock Alerts" value={analysis.lowStock?.length ?? 0} icon={<AlertTriangle />} danger />
            </div>

            <div className="dashboardTabs">
              {innerTabs.map(([id, Icon, label]) => <button key={id} onClick={() => setDashboardView(id)} className={dashboardView === id ? "tab active" : "tab"}><Icon size={15} />{label}</button>)}
              <button className="refresh" onClick={() => loadData(true)}><RefreshCcw size={14} /> Refresh Analysis</button>
            </div>

            {dashboardView === "live" && <LiveInventoryView dashboard={dashboard} analysis={analysis} />}
            {dashboardView === "sales" && <SalesProfitView dashboard={dashboard} />}
            {dashboardView === "recommendations" && <RecommendationsView dashboard={dashboard} analysis={analysis} />}
          </section>
        )}

        {tab === "inventory" && (
          <section>
            <div className="sectionHead"><div><h2>Inventory Database</h2><p>Products, suppliers and reorder levels follow your SQL structure.</p></div><div className="search"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product, category, supplier" /></div></div>
            <div className="tableWrap"><table><thead><tr><th>ID</th><th>Product</th><th>Category</th><th>Qty</th><th>Cost</th><th>Sell</th><th>Supplier</th><th>Status</th></tr></thead><tbody>{filtered.map((p) => <tr key={p.id}><td>{p.product_id}</td><td className="font-semibold">{p.product_name}</td><td>{p.category}</td><td>{p.quantity}</td><td>${p.cost_price.toFixed(2)}</td><td>${p.selling_price.toFixed(2)}</td><td>{p.supplier}</td><td><Badge p={p} /></td></tr>)}</tbody></table></div>
          </section>
        )}

        {tab === "ai" && (
          <section>
            <div className="sectionHead"><div><h2>AI Inventory Cleaning Assistant</h2><p>Hein's part: validate product entries before saving into the inventory database.</p></div><button className="btn" onClick={cleanData}><FileUp size={16} /> Run Full Database Check</button></div>
            <DatabaseQualitySection quality={dbQuality || dashboard?.databaseQuality} onRefresh={() => loadData(true)} onSanitize={autoSanitizeDatabase} />
            <ProductValidationForm
              product={newProduct}
              suppliers={suppliers}
              validation={aiValidation}
              saving={savingProduct}
              onChange={updateNewProduct}
              onValidate={validateNewProduct}
              onApprove={approveAndSaveProduct}
            />
            <RecommendationsView dashboard={dashboard} analysis={analysis} />
          </section>
        )}

        {tab === "customer" && (
          <section>
            <div className="sectionHead"><div><h2>Customer Portal</h2><p>Stanley's customer checkout page. Product listings come from MySQL and checkout updates the SQL database.</p></div><div className="search"><Search size={18} /><input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder="Search customer products" /></div></div>
            <div className="customerLayout">
              <div>
                <div className="customerGrid">
                  {customerProducts.map((p) => (
                    <div className="productCard" key={p.product_id}>
                      <div className="productImage"><Package size={34} /></div>
                      <div className="productMeta">
                        <span>{p.category}</span>
                        <h3>{p.product_name}</h3>
                        <p>Supplier: {p.supplier || "Assigned supplier"}</p>
                        <div className="productBottom">
                          <b>${p.selling_price.toFixed(2)}</b>
                          <small className={p.quantity <= p.reorder_level ? "stock low" : "stock"}>{p.quantity} left</small>
                        </div>
                        <button className="btn full" onClick={() => addToCart(p)} disabled={p.quantity <= 0}><ShoppingCart size={16} /> Add to Cart</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Panel title="Checkout Cart" icon={<ShoppingCart />}>
                {cartDetails.length ? cartDetails.map((item) => (
                  <div className="cartItem" key={item.product_id}>
                    <div><b>{item.product.product_name}</b><span>${item.product.selling_price.toFixed(2)} each · {item.product.quantity} available</span></div>
                    <div className="qtyControls">
                      <button onClick={() => updateCartQuantity(item.product_id, item.quantity - 1)}><Minus size={13} /></button>
                      <input value={item.quantity} onChange={(e) => updateCartQuantity(item.product_id, Number(e.target.value || 1))} />
                      <button onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}><Plus size={13} /></button>
                      <button className="trash" onClick={() => removeFromCart(item.product_id)}><Trash2 size={13} /></button>
                    </div>
                    <strong>${item.lineTotal.toFixed(2)}</strong>
                  </div>
                )) : <Empty title="Cart is empty" text="Add products from the customer list to test checkout." />}
                <div className="cartSummary"><span>{cartUnits} item(s)</span><b>Total: ${cartTotal.toFixed(2)}</b></div>
                <button className="btn full" onClick={checkoutCart} disabled={!cartDetails.length}><CheckCircle2 size={16} /> Checkout & Update MySQL</button>
                <p className="muted smallText">After checkout, the app inserts into sales_records, inserts into inventory_logs, reduces products.quantity, and refreshes dashboard, monthly profit and AI recommendations.</p>
              </Panel>
            </div>
          </section>
        )}

        <section style={{ display: tab === "chatbot" ? "block" : "none" }}>
            <div className="sectionHead"><div><h2>Botpress Chatbot & Telegram Notifications</h2><p>Rizq's Botpress assistant stays in this section, while Minghao's n8n workflow delivers low-stock messages to Telegram.</p></div></div>
            <div className="grid two">
              <Panel title="Built-in inventory chatbot" icon={<Bot />}>
                <div className="chatBox">{chat.map((m, i) => <div key={i} className={m.role === "user" ? "msg user" : "msg bot"}>{m.content}</div>)}</div>
                <div className="chatInput"><input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }} placeholder="Ask: What is my monthly profit?" /><button className="btn" onClick={sendChat}><Send size={16} /></button></div>
                <p className="muted smallText">Replace this panel with the Botpress Webchat embed when your teammate provides the Botpress script or client ID.</p>
              </Panel>
              <Panel title="Telegram alert connection" icon={<Send />}>
                <div className="issue"><b>n8n webhook</b><span>{integrationStatus?.n8nConfigured ? "Connected through N8N_WEBHOOK_URL" : "Not configured — add N8N_WEBHOOK_URL to .env"}</span></div>
                <div className="issue"><b>Telegram destination</b><span>The receiving account is controlled by the Telegram credential and Chat ID selected inside n8n.</span></div>
                <div className="formRow">
                  <select value={telegramProduct} onChange={(e) => setTelegramProduct(Number(e.target.value))}>
                    <option value="">Choose a product for test</option>
                    {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.product_name} ({p.quantity} left)</option>)}
                  </select>
                  <button className="btn" onClick={testTelegramAlert} disabled={telegramTesting || !integrationStatus?.n8nConfigured}><Send size={16} /> {telegramTesting ? "Sending..." : "Send Test Alert"}</button>
                </div>
                <p className="muted smallText">Customer checkout automatically triggers this workflow only when remaining stock is at or below the product's reorder level.</p>
              </Panel>
            </div>
            <div className="grid two">
              <Panel title="Botpress integration point" icon={<Bot />}>
                <div className="issue"><b>Live inventory data</b><span>Inside Botpress Studio, add an HTTP Request (or Execute Code) card that calls your deployed server's /api/bot/low-stock, /api/bot/overstock, /api/bot/product, /api/bot/supplier and /api/bot/sales-summary, sending header x-api-key equal to your BOTPRESS_API_KEY.</span></div>
                <div id="botpress-panel-webchat" style={{ minHeight: 520, borderRadius: 14, overflow: "hidden", border: "1px solid #e2e8f0", marginTop: 12 }} />
                <p className="muted">Botpress is for inventory questions. Telegram delivery is handled by n8n, not Botpress.</p>
              </Panel>
              <Panel title="Imported n8n workflows" icon={<Workflow />}><p className="muted">Import the two JSON templates from the n8n-workflows folder, select your own Telegram Bot credential, replace the Chat ID, and activate the workflow.</p><div className="issue"><b>Low Stock Alert</b><span>Receives product and stock from the website webhook.</span></div><div className="issue"><b>Weekly Report</b><span>Runs on schedule. Replace the sample Edit Fields node with live MySQL data when ready.</span></div></Panel>
            </div>
          </section>

        {tab === "automation" && (
          <section>
            <div className="sectionHead"><div><h2>n8n Automation Space</h2><p>Minghao's part: low stock can trigger a reorder alert through n8n.</p></div></div>
            <div className="grid two"><Panel title="Live update test" icon={<Workflow />}><p className="muted">Use this to prove real-time syncing. It records a sale, decreases stock, updates monthly sales/profit, and refreshes AI recommendations.</p><div className="formRow"><select value={saleProduct} onChange={(e) => setSaleProduct(Number(e.target.value))}><option value="">Choose product</option>{products.map(p => <option key={p.product_id} value={p.product_id}>{p.product_name} ({p.quantity} left)</option>)}</select><input type="number" min="1" value={saleQty} onChange={(e)=>setSaleQty(Number(e.target.value))}/><button className="btn" onClick={simulateSale}>Record Sale</button></div><p className="muted smallText">If USE_MYSQL=true, this updates your actual MySQL products and sales_records tables. If not, it updates demo data while the server is running.</p></Panel><Panel title="Current low-stock products" icon={<Truck />}>{analysis.lowStock?.length ? analysis.lowStock.map((p: Product) => <div className="issue" key={p.id}><b>{p.product_name}</b><span>{p.quantity} left, reorder at {p.reorder_level}. Supplier: {p.supplier}</span></div>) : <Empty title="No low-stock products" text="When stock falls below the reorder level, alerts will appear here." />}</Panel></div>
          </section>
        )}
      </main>
    </div>
  );
}



function DatabaseQualitySection({ quality, onRefresh, onSanitize }: any) {
  const q = quality || {};
  const score = Number(q.healthScore ?? 0);
  return <>
    <div className="aiHero">
      <div>
        <div className="miniLabel"><Sparkles size={14} /> Database Quality Summary</div>
        <h2>AI Inventory Management Assistant</h2>
        <p>Live audit powered by the SQL database. This section checks duplicate entries, missing suppliers, wrong categories, invalid pricing and relational soundness.</p>
      </div>
      <div className="buttonRow compact">
        <button className="btn secondary" onClick={onRefresh}><RefreshCcw size={16}/>Refresh SQL Audit</button>
        <button className="btn" onClick={onSanitize}><Sparkles size={16}/>Auto-Sanitize AI</button>
      </div>
    </div>
    <div className="metricGrid three">
      <Metric title="Total Alert Triggers" value={q.totalAlertTriggers ?? 0} icon={<AlertTriangle />} danger={(q.totalAlertTriggers ?? 0) > 0} />
      <Metric title="Excess Capital Tied Up" value={`$${money(q.excessCapitalTiedUp)}`} icon={<Layers />} />
      <Metric title="Selling Below Cost Losses" value={`$${money(q.sellingBelowCostLosses)}`} icon={<ShieldCheck />} danger={(q.sellingBelowCostLosses ?? 0) > 0} />
    </div>
    <div className="qualityGrid">
      <Panel title="Database Health Score" icon={<Database />}>
        <div className="scoreRing" style={{background: `conic-gradient(#14b8a6 ${score * 3.6}deg, #e2e8f0 0deg)`}}>
          <div><b>{score}%</b><span>{q.healthLabel || "Loading"}</span></div>
        </div>
        <div className={score >= 90 ? "health ok" : score >= 75 ? "health warn" : "health danger"}>
          {score >= 90 ? "Database state is highly integrated and clean." : "Database has issues that should be reviewed before final import."}
        </div>
      </Panel>
      <Panel title="Database Integrity Checklist" icon={<ShieldCheck />}>
        <div className="checkGrid">
          <QualityCard label="Total SKUs Analysed" value={q.totalSkus ?? 0} note="Active scan online" />
          <QualityCard label="Duplicates" value={q.duplicateCount ?? 0} note={(q.duplicateCount ?? 0) ? "Review duplicate pairs" : "No duplicates detected"} danger={(q.duplicateCount ?? 0) > 0} />
          <QualityCard label="Missing Suppliers" value={q.missingSuppliersCount ?? 0} note={(q.missingSuppliersCount ?? 0) ? "Supplier mapping needed" : "All suppliers defined"} danger={(q.missingSuppliersCount ?? 0) > 0} />
          <QualityCard label="Invalid Pricing" value={q.invalidPricingCount ?? 0} note={(q.invalidPricingCount ?? 0) ? "Below-cost pricing found" : "Healthy pricing ratios"} danger={(q.invalidPricingCount ?? 0) > 0} />
          <QualityCard label="Wrong Categories" value={q.wrongCategoriesCount ?? 0} note={(q.wrongCategoriesCount ?? 0) ? "Category cleanup needed" : "All categories hygiene clean"} danger={(q.wrongCategoriesCount ?? 0) > 0} />
          <QualityCard label="Relational Soundness" value={q.relationalSoundness || "-"} note="Standard clean index" />
        </div>
      </Panel>
    </div>
    <Panel title="Automated Relational Soundness Auditing" icon={<ShieldCheck />}>
      <p className="summary">This module reads from MySQL through the Express API. When your <b>stocksmart_ai_clean</b> database changes, this audit updates automatically with the rest of the dashboard.</p>
      {q.duplicatePairs?.length ? <div className="mt"><h4>Duplicate Pair Details</h4>{q.duplicatePairs.map((d: any, i: number) => <div className="duplicate" key={i}><b>{d.productA} ↔ {d.productB}</b><span>{d.score}% similar</span></div>)}</div> : null}
      {q.invalidPricing?.length ? <div className="mt"><h4>Invalid Pricing Details</h4>{q.invalidPricing.map((p: any, i: number) => <div className="duplicate" key={i}><b>{p.product_name}</b><span>Cost ${money(p.cost_price)} / Selling ${money(p.selling_price)}</span></div>)}</div> : null}
    </Panel>
  </>;
}

function QualityCard({ label, value, note, danger = false }: any) {
  return <div className={danger ? "qualityCard danger" : "qualityCard"}>
    <span>{label}</span>
    <b>{value}</b>
    <small>{note}</small>
  </div>;
}

function ProductValidationForm({ product, suppliers, validation, saving, onChange, onValidate, onApprove }: any) {
  const warnings = validation?.warnings || [];
  const duplicates = validation?.duplicates || [];
  const recommendations = validation?.recommendations || [];
  return <Panel title="Add Product with AI Validation" icon={<Sparkles />}>
    <p className="muted">This is Hein's workflow: the product is checked for duplicate entries, supplier matching, pricing mistakes, low stock and overstock before it is saved.</p>
    <div className="formGrid">
      <label>Product Name<input value={product.product_name} onChange={(e) => onChange("product_name", e.target.value)} placeholder="e.g. Coke Can 320ml" /></label>
      <label>Category<select value={product.category} onChange={(e) => onChange("category", e.target.value)}><option>Beverage</option><option>Dairy</option><option>Bakery</option><option>Food</option><option>Snack</option><option>Household</option><option>Personal Care</option><option>Frozen Food</option><option>Fresh Produce</option></select></label>
      <label>Quantity<input type="number" min="0" value={product.quantity} onChange={(e) => onChange("quantity", Number(e.target.value))} /></label>
      <label>Reorder Level<input type="number" min="0" value={product.reorder_level} onChange={(e) => onChange("reorder_level", Number(e.target.value))} /></label>
      <label>Cost Price<input type="number" min="0" step="0.01" value={product.cost_price} onChange={(e) => onChange("cost_price", Number(e.target.value))} /></label>
      <label>Selling Price<input type="number" min="0" step="0.01" value={product.selling_price} onChange={(e) => onChange("selling_price", Number(e.target.value))} /></label>
      <label className="wide">Supplier<select value={product.supplier_id} onChange={(e) => onChange("supplier_id", e.target.value)}><option value="">Select supplier</option>{suppliers.map((s: Supplier) => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}</select></label>
    </div>
    <div className="buttonRow"><button className="btn" onClick={onValidate} disabled={saving}>{saving ? "Checking..." : "AI Check Product"}</button><button className="btn secondary" onClick={onApprove} disabled={!validation?.canSave || saving}>Approve & Save to Inventory</button></div>
    {validation && <div className="validationBox">
      <div className="quality"><b>Inventory Quality Score</b><span>{validation.qualityScore}%</span></div>
      <p className="summary">{validation.summary}</p>
      <div className="grid two mt">
        <div>
          <h4>AI Issues Found</h4>
          {warnings.length ? warnings.map((w: any, i: number) => <div className="issue" key={i}><b>{w.severity}: {w.type}</b><span>{w.message}</span></div>) : <Empty title="No issues" text="This product passed AI validation." />}
        </div>
        <div>
          <h4>AI Suggestions</h4>
          {recommendations.length ? recommendations.map((r: string, i: number) => <div className="issue" key={i}><b>Recommendation {i + 1}</b><span>{r}</span></div>) : <Empty title="Ready to save" text="No extra corrections are needed." />}
        </div>
      </div>
      {duplicates.length > 0 && <div className="mt"><h4>Possible Duplicate Matches</h4>{duplicates.map((d: any) => <div className="duplicate" key={d.product.product_id}><b>{d.product.product_name}</b><span>{Math.round(d.score * 100)}% similar • Current qty: {d.product.quantity} • Supplier: {d.product.supplier}</span></div>)}</div>}
    </div>}
  </Panel>;
}

function LiveInventoryView({ dashboard, analysis }: any) {
  return <><Panel title="Executive Summary" icon={<Sparkles />}><p className="summary">StockSmart AI analysed <b>{dashboard?.totalProducts ?? 0}</b> products and <b>{dashboard?.totalUnits ?? 0}</b> stock units. Current cost valuation is <b>${money(dashboard?.totalCostValue)}</b> with projected profit of <b>${money(dashboard?.potentialProfit)}</b>. The system found <b>{analysis.lowStock?.length ?? 0}</b> low-stock items, <b>{analysis.overstocked?.length ?? 0}</b> overstocked items, and <b>{analysis.negativeMargin?.length ?? 0}</b> pricing issues.</p><p className="sync">Live sync mode: {dashboard?.dataMode || "Loading"} • Auto-refresh every 5 seconds</p></Panel><div className="grid two mt"><AlertPanel title="Low Stock Alerts" rows={analysis.lowStock || []} type="low" /><AlertPanel title="Overstocked Alerts" rows={analysis.overstocked || []} type="over" /></div><div className="grid two mt"><PromotionList rows={dashboard?.promotionSuggestions || []} /><BusinessList rows={dashboard?.businessRecommendations || []} /></div></>;
}

function SalesProfitView({ dashboard }: any) {
  const rows = dashboard?.monthlySales || [];
  return <><div className="metricGrid four"><Metric title="Total Sales" value={`$${money(dashboard?.totalRevenue)}`} icon={<DollarSign />} /><Metric title="Total Net Profit" value={`$${money(dashboard?.totalSalesProfit)}`} icon={<TrendingUp />} /><Metric title="Average Profit Margin" value={`${Number(dashboard?.avgMargin || 0).toFixed(1)}%`} icon={<BarChart3 />} /><Metric title="Peak Sales Month" value={dashboard?.peakMonth?.label || "No data"} icon={<BarChart3 />} /></div><Panel title="Monthly Sales & Profit Trend Analysis" icon={<BarChart3 />}><SalesChart rows={rows} /></Panel><Panel title="Best Selling Products Leaderboard" icon={<TrendingUp />}><TopSelling rows={dashboard?.topSellingProducts || []} /></Panel></>;
}

function RecommendationsView({ dashboard, analysis }: any) {
  return <><Panel title="AI Executive Summary" icon={<Sparkles />}><p className="summary">The AI recommendation engine checks inventory health, profit risks, product duplication and sales trends. It uses the same records shown in the dashboard so recommendations update whenever stock or sales data changes.</p></Panel><div className="grid two mt"><AlertPanel title="Low Stock Actions" rows={analysis.lowStock || []} type="low" /><AlertPanel title="Pricing / Overstock Actions" rows={[...(analysis.negativeMargin || []), ...(analysis.overstocked || [])]} type="over" /></div><div className="grid two mt"><PromotionList rows={dashboard?.promotionSuggestions || []} /><BusinessList rows={dashboard?.businessRecommendations || []} /></div><Panel title="Detailed AI Recommendations" icon={<Sparkles />}><Recommendations rows={dashboard?.aiRecommendations || []} /></Panel></>;
}

function Metric({ title, value, icon, danger = false }: any) { return <div className={danger ? "metric danger" : "metric"}><div><p>{title}</p><h3>{value}</h3></div><span>{React.cloneElement(icon, { size: 20 })}</span></div>; }
function Panel({ title, icon, children }: any) { return <div className="panel"><h3>{React.cloneElement(icon, { size: 18 })}{title}</h3>{children}</div>; }
function Empty({ title, text }: any) { return <div className="emptyState"><b>{title}</b><span>{text}</span></div>; }
function AlertPanel({ title, rows, type }: any) { return <Panel title={title} icon={<AlertTriangle />}>{rows.length ? rows.slice(0,6).map((p: Product) => <div className={type === "low" ? "alertItem low" : "alertItem over"} key={p.product_id}><div><b>{p.product_name}</b><small>Supplier: {p.supplier || "Not assigned"}</small></div><span>Qty: {p.quantity} / Reorder: {p.reorder_level}</span></div>) : <Empty title="No alerts" text="This section will update automatically when data changes." />}</Panel>; }
function PromotionList({ rows }: any) { return <Panel title="Promotion Suggestions" icon={<Sparkles />}>{rows.length ? rows.slice(0,4).map((r: any, i: number) => <div className="promo" key={i}><b>{r.title}</b><span>{r.reason}</span><p>{r.suggestion}</p><small>Impact: {r.impact}</small></div>) : <Empty title="No promotion needed" text="Promotion suggestions appear when overstock or slow-moving stock is detected." />}</Panel>; }
function BusinessList({ rows }: any) { return <Panel title="Business Recommendations" icon={<TrendingUp />}>{rows.map((r: any, i: number) => <div className="business" key={i}><b>{r.title}</b><span>{r.detail}</span><small>Action: {r.action}</small></div>)}</Panel>; }
function SalesChart({ rows }: any) { if (!rows.length) return <Empty title="No sales data yet" text="Add sales records or connect the customer portal to generate this chart." />; const max = Math.max(...rows.map((r:any)=>Math.max(r.revenue, r.profit)), 1); return <div className="chart"><div className="chartGrid">{rows.map((r:any) => <div className="barGroup" key={r.month}><div className="bars"><span className="bar revenue" style={{height:`${Math.max(8, r.revenue/max*190)}px`}} title={`Revenue $${money(r.revenue)}`}></span><span className="bar profit" style={{height:`${Math.max(8, Math.max(r.profit,0)/max*190)}px`}} title={`Profit $${money(r.profit)}`}></span></div><b>{r.label}</b></div>)}</div><div className="legend"><span className="dot revenue"></span>Total Revenue <span className="dot profit"></span>Net Profit</div>{rows.length === 1 && <p className="muted smallText">Only one month is currently in your sales_records table, so the chart shows the available live month. More months will appear automatically when more dated sales records are added.</p>}</div>; }
function TopSelling({ rows }: any) { if (!rows.length) return <Empty title="No sales records yet" text="Best sellers appear once sales are recorded." />; return <div className="leaderboard"><table><thead><tr><th>Rank</th><th>Product</th><th>Category</th><th>Units Sold</th><th>Revenue</th><th>Net Profit</th><th>Supplier</th></tr></thead><tbody>{rows.map((r:any, i:number)=><tr key={r.product_id}><td>{i+1}</td><td className="font-semibold">{r.product_name}</td><td>{r.category}</td><td>{r.totalSold}</td><td>${money(r.revenue)}</td><td className="profit">${money(r.profit)}</td><td>{r.supplier}</td></tr>)}</tbody></table><div className="tip"><b>Best Seller Stock Recommendation</b><span>These products drive your profits. Keep their quantities above reorder level to avoid missed sales.</span></div></div>; }
function Recommendations({ rows }: any) { if (!rows.length) return <Empty title="No urgent recommendations" text="Inventory looks healthy. New recommendations will appear as data changes." />; return <div>{rows.slice(0,12).map((r:any, i:number)=><div className="recommendation" key={i}><b><span className={r.priority === "High" ? "pill high" : r.priority === "Medium" ? "pill medium" : "pill"}>{r.priority}</span>{r.title}</b><span>{r.detail}</span><small>{r.action}</small></div>)}</div>; }
function Badge({ p }: { p: Product }) { if (p.selling_price < p.cost_price) return <span className="badge danger">Price Issue</span>; if (p.quantity <= p.reorder_level) return <span className="badge warn">Low Stock</span>; if (p.quantity >= p.reorder_level * 5) return <span className="badge info">Overstock</span>; return <span className="badge ok">OK</span>; }
function money(value: any) { return Number(value || 0).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
