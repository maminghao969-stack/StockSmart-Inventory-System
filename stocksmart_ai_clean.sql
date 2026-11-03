-- StockSmart AI: AI Inventory Assistant for Small Businesses
-- VERSION B: Clean Database Schema + Sample Data
-- Project: AI Inventory Management System
-- Database: stocksmart_ai

DROP DATABASE IF EXISTS stocksmart_ai_clean;
CREATE DATABASE stocksmart_ai_clean;
USE stocksmart_ai_clean;

-- =========================
-- 1. SUPPLIERS TABLE
-- =========================
CREATE TABLE suppliers (
    supplier_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- 2. PRODUCTS TABLE
-- =========================
CREATE TABLE products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(120) NOT NULL,
    category VARCHAR(50) NOT NULL,
    quantity INT NOT NULL CHECK (quantity >= 0),
    cost_price DECIMAL(10,2) NOT NULL CHECK (cost_price >= 0),
    selling_price DECIMAL(10,2) NOT NULL CHECK (selling_price >= 0),
    supplier_id INT,
    reorder_level INT NOT NULL CHECK (reorder_level >= 0),
    last_updated DATE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
);

-- =========================
-- 3. INVENTORY LOGS TABLE
-- =========================
CREATE TABLE inventory_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    change_type ENUM('Stock In', 'Stock Out', 'Adjustment') NOT NULL,
    quantity_changed INT NOT NULL,
    reason VARCHAR(255),
    log_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- =========================
-- 4. SALES RECORDS TABLE
-- =========================
CREATE TABLE sales_records (
    sale_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    quantity_sold INT NOT NULL CHECK (quantity_sold > 0),
    sale_price DECIMAL(10,2) NOT NULL CHECK (sale_price >= 0),
    sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- =========================
-- INSERT SUPPLIERS
-- =========================
INSERT INTO suppliers (supplier_name, contact_person, phone, email, address)
VALUES
('FreshMart Supply Pte Ltd', 'Daniel Tan', '91234567', 'sales@freshmart.sg', '12 Woodlands Loop, Singapore'),
('Daily Essentials Distributor', 'Nur Aisyah', '92345678', 'contact@dailyessentials.sg', '45 Jurong East Street 21, Singapore'),
('Happy Drinks Wholesale', 'Lim Wei Jie', '93456789', 'orders@happydrinks.sg', '8 Tampines Industrial Avenue, Singapore'),
('SnackHouse Trading', 'Mary Lee', '94567890', 'support@snackhouse.sg', '22 Bedok North Road, Singapore'),
('CleanPro Supplies', 'Raj Kumar', '95678901', 'sales@cleanpro.sg', '10 Choa Chu Kang Crescent, Singapore'),
('BeautyCare SG', 'Siti Rahman', '96789012', 'orders@beautycare.sg', '18 Paya Lebar Road, Singapore'),
('FrozenHub Foods', 'Jason Wong', '97890123', 'supply@frozenhub.sg', '30 Tuas South Avenue, Singapore'),
('GreenFarm Produce', 'Tan Mei Ling', '98901234', 'hello@greenfarm.sg', '15 Lim Chu Kang Lane, Singapore');

-- =========================
-- INSERT PRODUCTS
-- Includes realistic clean inventory data for final submission:
-- No duplicate products, no missing suppliers, no invalid pricing, and healthy stock levels.
-- =========================
INSERT INTO products
(product_name, category, quantity, cost_price, selling_price, supplier_id, reorder_level, last_updated)
VALUES
('Coca-Cola Can 320ml', 'Beverage', 85, 0.80, 1.50, 3, 30, '2026-07-01'),
('Coke Zero Sugar Can 320ml', 'Beverage', 82, 0.80, 1.50, 3, 30, '2026-07-08'),
('Pepsi Can 320ml', 'Beverage', 60, 0.75, 1.40, 3, 25, '2026-07-01'),
('Sprite Can 320ml', 'Beverage', 55, 0.78, 1.50, 3, 25, '2026-07-01'),
('Mineral Water 600ml', 'Beverage', 120, 0.35, 0.90, 3, 40, '2026-07-08'),
('Green Tea Bottle 500ml', 'Beverage', 42, 0.90, 1.80, 3, 20, '2026-07-02'),
('Fresh Milk 1L', 'Dairy', 30, 2.10, 3.20, 1, 15, '2026-07-08'),
('Low Fat Milk 1L', 'Dairy', 30, 2.20, 3.40, 1, 15, '2026-07-08'),
('Cheddar Cheese 250g', 'Dairy', 22, 3.80, 5.90, 1, 10, '2026-07-08'),
('Greek Yogurt 500g', 'Dairy', 25, 3.10, 4.80, 1, 12, '2026-07-08'),

('White Bread Loaf', 'Bakery', 40, 1.40, 2.50, 1, 20, '2026-07-08'),
('Wholemeal Bread Loaf', 'Bakery', 40, 1.60, 2.80, 1, 20, '2026-07-08'),
('Butter Croissant Pack', 'Bakery', 18, 2.20, 3.80, 1, 15, '2026-07-04'),
('Chocolate Muffin Pack', 'Bakery', 25, 2.50, 4.20, 1, 15, '2026-07-04'),

('Instant Noodles Chicken', 'Pantry/Convenience', 95, 0.55, 1.20, 2, 30, '2026-07-02'),
('Instant Noodles Curry', 'Pantry/Convenience', 90, 0.55, 1.20, 2, 30, '2026-07-02'),
('Jasmine Rice 5kg', 'Grains/Pantry', 18, 9.50, 13.90, 2, 10, '2026-07-01'),
('Basmati Rice 5kg', 'Grains/Pantry', 22, 11.80, 16.90, 2, 10, '2026-07-08'),
('Eggs 10pcs', 'Fresh Food', 40, 2.80, 4.20, 8, 20, '2026-07-08'),
('Canned Tuna 185g', 'Canned Goods', 38, 1.60, 2.80, 2, 20, '2026-07-01'),
('Canned Sardines 155g', 'Canned Goods', 41, 1.20, 2.20, 2, 20, '2026-07-01'),
('Cooking Oil 2L', 'Cooking Essentials', 32, 5.90, 8.50, 2, 15, '2026-07-08'),
('Sugar 1kg', 'Pantry', 32, 1.10, 2.00, 2, 20, '2026-07-02'),
('Salt 500g', 'Pantry', 45, 0.45, 1.00, 2, 20, '2026-07-02'),

('Potato Chips Original', 'Snack', 45, 1.20, 2.20, 4, 20, '2026-07-02'),
('Potato Chips BBQ', 'Snack', 49, 1.20, 2.20, 4, 20, '2026-07-02'),
('Chocolate Wafer', 'Snack', 70, 0.60, 1.20, 4, 25, '2026-07-02'),
('Butter Cookies Pack', 'Snack', 25, 1.80, 3.20, 4, 15, '2026-07-01'),
('Peanut Biscuit Pack', 'Snack', 65, 0.90, 1.80, 4, 25, '2026-07-01'),
('Seaweed Snack Pack', 'Snack', 22, 1.10, 2.00, 4, 15, '2026-07-02'),

('Tissue Paper 5 Pack', 'Household', 30, 2.50, 4.50, 5, 15, '2026-07-04'),
('Dishwashing Liquid 500ml', 'Household', 25, 1.70, 3.20, 5, 12, '2026-07-08'),
('Laundry Detergent 2kg', 'Household', 25, 5.80, 8.90, 5, 10, '2026-07-08'),
('Floor Cleaner 1L', 'Household', 13, 2.60, 4.50, 5, 12, '2026-07-04'),
('Trash Bags 30pcs', 'Household', 28, 1.90, 3.50, 5, 15, '2026-07-04'),
('Kitchen Towel Roll', 'Household', 22, 2.20, 4.00, 5, 10, '2026-07-08'),

('Hand Soap 250ml', 'Personal Care', 16, 1.50, 2.80, 6, 15, '2026-07-03'),
('Toothpaste 150g', 'Personal Care', 22, 1.90, 3.50, 6, 15, '2026-07-03'),
('Shampoo 400ml', 'Personal Care', 13, 4.20, 6.90, 6, 10, '2026-07-03'),
('Body Wash 500ml', 'Personal Care', 17, 3.50, 5.90, 6, 12, '2026-07-03'),
('Facial Tissue Box', 'Household', 34, 1.20, 2.30, 6, 15, '2026-07-03'),

('Frozen Chicken Nuggets 1kg', 'Frozen Food', 20, 6.50, 9.90, 7, 12, '2026-07-02'),
('Frozen Fries 1kg', 'Frozen Food', 24, 3.90, 6.50, 7, 12, '2026-07-02'),
('Frozen Fish Fillet 500g', 'Frozen Food', 24, 5.20, 8.90, 7, 10, '2026-07-08'),
('Ice Cream Vanilla 1L', 'Frozen Food', 19, 4.80, 7.90, 7, 12, '2026-07-02'),

('Banana Bunch', 'Fresh Produce', 16, 1.80, 3.20, 8, 15, '2026-07-05'),
('Red Apple 5pcs', 'Fresh Produce', 21, 3.40, 5.90, 8, 15, '2026-07-05'),
('Tomatoes 500g', 'Fresh Produce', 25, 1.60, 2.90, 8, 12, '2026-07-08'),
('Lettuce Head', 'Fresh Produce', 22, 1.20, 2.50, 8, 10, '2026-07-08'),
('Carrots 1kg', 'Fresh Produce', 26, 1.90, 3.40, 8, 15, '2026-07-05'),

-- imperfect records for AI data quality detection
('Premium Coffee Powder 200g', 'Beverage', 80, 4.50, 7.90, 2, 20, '2026-07-08'),
('Organic Honey 500g', 'Sweeteners/Pantry', 20, 8.90, 12.90, 2, 8, '2026-07-08');

-- =========================
-- INSERT INVENTORY LOGS
-- =========================
INSERT INTO inventory_logs
(product_id, change_type, quantity_changed, reason, log_date)
VALUES
(1, 'Stock In', 50, 'New stock from Happy Drinks Wholesale', '2026-07-01 09:15:00'),
(1, 'Stock Out', -10, 'Customer purchases', '2026-07-02 14:20:00'),
(3, 'Stock Out', -12, 'Daily beverage sales', '2026-07-02 17:30:00'),
(5, 'Stock In', 80, 'Bulk water restock', '2026-07-02 10:00:00'),
(7, 'Stock Out', -10, 'Fast-selling dairy product', '2026-07-03 12:10:00'),
(11, 'Stock Out', -15, 'Bread sold quickly in morning', '2026-07-04 09:45:00'),
(12, 'Stock Out', -8, 'Low bakery stock', '2026-07-04 11:30:00'),
(17, 'Stock In', 10, 'Rice restock', '2026-07-01 15:00:00'),
(18, 'Stock Out', -6, 'Rice sales', '2026-07-02 18:00:00'),
(19, 'Stock Out', -12, 'Eggs sold', '2026-07-03 13:25:00'),
(25, 'Stock In', 30, 'Snack delivery received', '2026-07-02 10:40:00'),
(27, 'Stock Out', -20, 'Snack sales', '2026-07-03 16:20:00'),
(32, 'Stock Out', -8, 'Household product sales', '2026-07-04 19:10:00'),
(36, 'Stock Out', -5, 'Low kitchen towel stock', '2026-07-04 20:30:00'),
(39, 'Stock In', 12, 'Personal care restock', '2026-07-03 10:10:00'),
(42, 'Stock Out', -7, 'Frozen food sales', '2026-07-02 18:45:00'),
(44, 'Adjustment', -2, 'Damaged frozen item removed', '2026-07-02 19:00:00'),
(48, 'Stock Out', -6, 'Vegetable sales', '2026-07-05 12:00:00'),
(49, 'Stock Out', -5, 'Lettuce sold', '2026-07-05 13:30:00'),
(52, 'Adjustment', 0, 'AI flagged price issue for review', '2026-07-05 16:00:00');

-- =========================
-- INSERT SALES RECORDS
-- =========================
INSERT INTO sales_records
(product_id, quantity_sold, sale_price, sale_date)
VALUES
(1, 10, 1.50, '2026-07-02 14:20:00'),
(3, 12, 1.40, '2026-07-02 17:30:00'),
(5, 30, 0.90, '2026-07-02 18:10:00'),
(7, 7, 3.20, '2026-07-03 12:10:00'),
(8, 5, 3.40, '2026-07-03 13:00:00'),
(11, 12, 2.50, '2026-07-04 09:45:00'),
(12, 8, 2.80, '2026-07-04 11:30:00'),
(15, 15, 1.20, '2026-07-02 15:15:00'),
(16, 13, 1.20, '2026-07-02 15:50:00'),
(17, 4, 13.90, '2026-07-02 19:00:00'),
(18, 6, 16.90, '2026-07-02 18:00:00'),
(19, 12, 4.20, '2026-07-03 13:25:00'),
(25, 9, 2.20, '2026-07-03 16:20:00'),
(26, 8, 2.20, '2026-07-03 16:40:00'),
(27, 20, 1.20, '2026-07-03 17:10:00'),
(31, 5, 4.50, '2026-07-04 18:00:00'),
(32, 5, 3.20, '2026-07-04 19:10:00'),
(36, 5, 4.00, '2026-07-04 20:30:00'),
(39, 4, 6.90, '2026-07-03 20:00:00'),
(42, 6, 9.90, '2026-07-02 18:45:00'),
(43, 8, 6.50, '2026-07-02 19:15:00'),
(46, 10, 3.20, '2026-07-05 11:20:00'),
(48, 6, 2.90, '2026-07-05 12:00:00'),
(49, 5, 2.50, '2026-07-05 13:30:00'),
(50, 7, 3.40, '2026-07-05 14:00:00');

-- =========================
-- USEFUL QUERIES FOR PROJECT DEMO
-- =========================

-- 1. View all products with supplier details
SELECT 
    p.product_id,
    p.product_name,
    p.category,
    p.quantity,
    p.cost_price,
    p.selling_price,
    s.supplier_name,
    p.reorder_level,
    p.last_updated
FROM products p
LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id;

-- 2. Find low-stock products
SELECT 
    product_name,
    category,
    quantity,
    reorder_level
FROM products
WHERE quantity <= reorder_level;

-- 3. Find overstocked products
SELECT 
    product_name,
    category,
    quantity,
    reorder_level
FROM products
WHERE quantity >= reorder_level * 5;

-- 4. Check if any product has missing supplier details
SELECT 
    product_id,
    product_name,
    category,
    supplier_id
FROM products
WHERE supplier_id IS NULL;

-- 5. Find invalid prices: selling price lower than cost price
SELECT 
    product_name,
    cost_price,
    selling_price
FROM products
WHERE selling_price < cost_price;

-- 6. Find top-selling products
SELECT 
    p.product_name,
    p.category,
    SUM(sr.quantity_sold) AS total_sold,
    SUM(sr.quantity_sold * sr.sale_price) AS total_revenue
FROM sales_records sr
JOIN products p ON sr.product_id = p.product_id
GROUP BY p.product_id, p.product_name, p.category
ORDER BY total_sold DESC;

-- 7. Inventory value report
SELECT 
    category,
    SUM(quantity * cost_price) AS total_cost_value,
    SUM(quantity * selling_price) AS total_selling_value
FROM products
GROUP BY category
ORDER BY total_selling_value DESC;

-- 8. Suggested reorder quantity
SELECT 
    product_name,
    category,
    quantity,
    reorder_level,
    (reorder_level * 2 - quantity) AS suggested_reorder_quantity
FROM products
WHERE quantity <= reorder_level;

-- 9. AI data validation view
-- This helps your AI feature check problematic records.
CREATE VIEW ai_data_quality_check AS
SELECT 
    p.product_id,
    p.product_name,
    p.category,
    p.quantity,
    p.cost_price,
    p.selling_price,
    p.supplier_id,
    s.supplier_name,
    p.reorder_level,
    CASE
        WHEN p.supplier_id IS NULL THEN 'Missing supplier'
        WHEN p.selling_price < p.cost_price THEN 'Selling price lower than cost price'
        WHEN p.quantity <= p.reorder_level THEN 'Low stock'
        WHEN p.quantity >= p.reorder_level * 5 THEN 'Possible overstock'
        ELSE 'OK'
    END AS ai_flag
FROM products p
LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id;

-- 10. View AI quality issues only
SELECT *
FROM ai_data_quality_check
WHERE ai_flag <> 'OK';


-- =========================
-- VERSION B EXPORT QUERY FOR GOOGLE AI STUDIO
-- Use this query after running the clean database.
-- It includes supplier names for better AI validation.
-- =========================
SELECT
    p.product_name,
    p.category,
    p.quantity,
    p.cost_price,
    p.selling_price,
    s.supplier_name,
    p.reorder_level,
    p.last_updated
FROM products p
LEFT JOIN suppliers s
ON p.supplier_id = s.supplier_id
ORDER BY p.product_id;
