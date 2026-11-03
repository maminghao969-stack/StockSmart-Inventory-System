export interface Supplier {
  supplier_id: number;
  supplier_name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
}

export interface Product {
  id: string;
  product_id: number;
  product_name: string;
  category: string;
  quantity: number;
  cost_price: number;
  selling_price: number;
  supplier_id?: number | null;
  supplier?: string;
  contact_person?: string;
  supplier_phone?: string;
  supplier_email?: string;
  reorder_level: number;
  last_updated?: string;
}

export interface SaleRecord {
  sale_id: number;
  product_id: number;
  quantity_sold: number;
  sale_price: number;
  sale_date: string;
}

export interface InventoryAnalysis {
  lowStock: Product[];
  overstocked: Product[];
  negativeMargin: Product[];
  duplicates: { p1: Product; p2: Product }[];
  healthy: Product[];
  issues: Array<{
    product_id: number;
    product_name: string;
    category: string;
    quantity: number;
    reorder_level: number;
    supplier: string;
    ai_flag: string;
    recommendation: string;
  }>;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}
