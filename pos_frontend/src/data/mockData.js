/* ================================================================
   CENTRAL MOCK DATA — replace with API calls when backend is ready
   ================================================================ */

/* ── Products (normalized — no price fields here) ── */
export const MOCK_PRODUCTS = [
  { id: 1,  name: 'Basmati Rice (Premium)',  code: 'P001', category: 'Grains',       unit: 'Kg',     openingQty: 200,  alertQty: 25,  barcode: '8901234560001', status: 'Active'    },
  { id: 2,  name: 'Toor Dal',               code: 'P002', category: 'Pulses',       unit: 'Kg',     openingQty: 150,  alertQty: 20,  barcode: '8901234560002', status: 'Active'    },
  { id: 3,  name: 'Sunflower Oil 1L',       code: 'P003', category: 'Oils',         unit: 'Bottle', openingQty: 80,   alertQty: 10,  barcode: '8901234560003', status: 'Active'    },
  { id: 4,  name: 'Amul Butter 500g',       code: 'P004', category: 'Dairy',        unit: 'Pack',   openingQty: 60,   alertQty: 8,   barcode: '8901234560004', status: 'Active'    },
  { id: 5,  name: 'Colgate Toothpaste',     code: 'P005', category: 'Personal Care',unit: 'Nos',    openingQty: 120,  alertQty: 15,  barcode: '8901234560005', status: 'Active'    },
  { id: 6,  name: 'Parle-G Biscuits 800g',  code: 'P006', category: 'Snacks',       unit: 'Pack',   openingQty: 200,  alertQty: 30,  barcode: '8901234560006', status: 'Active'    },
  { id: 7,  name: 'Sugar (Fine)',           code: 'P007', category: 'Grains',       unit: 'Kg',     openingQty: 300,  alertQty: 40,  barcode: '8901234560007', status: 'Active'    },
  { id: 8,  name: 'Lifebuoy Soap',         code: 'P008', category: 'Personal Care',unit: 'Nos',    openingQty: 5,    alertQty: 10,  barcode: '8901234560008', status: 'Low Stock' },
  { id: 9,  name: 'Coca-Cola 2L',          code: 'P009', category: 'Beverages',    unit: 'Bottle', openingQty: 0,    alertQty: 5,   barcode: '8901234560009', status: 'Inactive'  },
  { id: 10, name: 'Maggi Noodles 70g',     code: 'P010', category: 'Instant Food', unit: 'Pack',   openingQty: 400,  alertQty: 50,  barcode: '8901234560010', status: 'Active'    },
];

/* ── ProductPrice (separate table — linked by productId FK) ──
   priceType: 'A' | 'B' | 'C' | 'D' | 'Retail'
   Each product has exactly 5 rows (one per price type).
*/
export const MOCK_PRICES = [
  /* Product 1 */
  { id: 1,  productId: 1,  priceType: 'A',      price: 95.00  },
  { id: 2,  productId: 1,  priceType: 'B',      price: 90.00  },
  { id: 3,  productId: 1,  priceType: 'C',      price: 85.00  },
  { id: 4,  productId: 1,  priceType: 'D',      price: 80.00  },
  { id: 5,  productId: 1,  priceType: 'Retail', price: 110.00 },
  /* Product 2 */
  { id: 6,  productId: 2,  priceType: 'A',      price: 120.00 },
  { id: 7,  productId: 2,  priceType: 'B',      price: 115.00 },
  { id: 8,  productId: 2,  priceType: 'C',      price: 110.00 },
  { id: 9,  productId: 2,  priceType: 'D',      price: 105.00 },
  { id: 10, productId: 2,  priceType: 'Retail', price: 135.00 },
  /* Product 3 */
  { id: 11, productId: 3,  priceType: 'A',      price: 145.00 },
  { id: 12, productId: 3,  priceType: 'B',      price: 140.00 },
  { id: 13, productId: 3,  priceType: 'C',      price: 135.00 },
  { id: 14, productId: 3,  priceType: 'D',      price: 130.00 },
  { id: 15, productId: 3,  priceType: 'Retail', price: 160.00 },
  /* Product 4 */
  { id: 16, productId: 4,  priceType: 'A',      price: 220.00 },
  { id: 17, productId: 4,  priceType: 'B',      price: 215.00 },
  { id: 18, productId: 4,  priceType: 'C',      price: 210.00 },
  { id: 19, productId: 4,  priceType: 'D',      price: 205.00 },
  { id: 20, productId: 4,  priceType: 'Retail', price: 240.00 },
  /* Product 5 */
  { id: 21, productId: 5,  priceType: 'A',      price: 80.00  },
  { id: 22, productId: 5,  priceType: 'B',      price: 75.00  },
  { id: 23, productId: 5,  priceType: 'C',      price: 72.00  },
  { id: 24, productId: 5,  priceType: 'D',      price: 68.00  },
  { id: 25, productId: 5,  priceType: 'Retail', price: 95.00  },
  /* Product 6 */
  { id: 26, productId: 6,  priceType: 'A',      price: 55.00  },
  { id: 27, productId: 6,  priceType: 'B',      price: 50.00  },
  { id: 28, productId: 6,  priceType: 'C',      price: 48.00  },
  { id: 29, productId: 6,  priceType: 'D',      price: 45.00  },
  { id: 30, productId: 6,  priceType: 'Retail', price: 65.00  },
  /* Product 7 */
  { id: 31, productId: 7,  priceType: 'A',      price: 42.00  },
  { id: 32, productId: 7,  priceType: 'B',      price: 40.00  },
  { id: 33, productId: 7,  priceType: 'C',      price: 38.00  },
  { id: 34, productId: 7,  priceType: 'D',      price: 36.00  },
  { id: 35, productId: 7,  priceType: 'Retail', price: 50.00  },
  /* Product 8 */
  { id: 36, productId: 8,  priceType: 'A',      price: 30.00  },
  { id: 37, productId: 8,  priceType: 'B',      price: 28.00  },
  { id: 38, productId: 8,  priceType: 'C',      price: 26.00  },
  { id: 39, productId: 8,  priceType: 'D',      price: 24.00  },
  { id: 40, productId: 8,  priceType: 'Retail', price: 35.00  },
  /* Product 9 */
  { id: 41, productId: 9,  priceType: 'A',      price: 90.00  },
  { id: 42, productId: 9,  priceType: 'B',      price: 85.00  },
  { id: 43, productId: 9,  priceType: 'C',      price: 82.00  },
  { id: 44, productId: 9,  priceType: 'D',      price: 78.00  },
  { id: 45, productId: 9,  priceType: 'Retail', price: 100.00 },
  /* Product 10 */
  { id: 46, productId: 10, priceType: 'A',      price: 14.00  },
  { id: 47, productId: 10, priceType: 'B',      price: 13.00  },
  { id: 48, productId: 10, priceType: 'C',      price: 12.00  },
  { id: 49, productId: 10, priceType: 'D',      price: 11.00  },
  { id: 50, productId: 10, priceType: 'Retail', price: 18.00  },
];

/* ── Customers ──
   priceCodeType: 'fixed' | 'random'
   Fixed customers have priceCode = 'A' | 'B' | 'C' | 'D' | 'Retail'
   Random customers have a system-generated CPC-XXXXXX code (no tier mapping)
*/
export const MOCK_CUSTOMERS = [
  { id: 1, name: 'Ramesh Traders',      phone: '+91-9876540101', whatsapp: '+91-9876540101', email: 'ramesh@example.com',  address: '12 Gandhi Nagar, Chennai',   priceCodeType: 'fixed',  priceCode: 'A',          is_active: true  },
  { id: 2, name: 'Sunita Stores',       phone: '+91-9876540202', whatsapp: '',               email: 'sunita@example.com',  address: '45 MG Road, Bengaluru',      priceCodeType: 'fixed',  priceCode: 'B',          is_active: true  },
  { id: 3, name: 'Kiran Wholesale',     phone: '+91-9876540303', whatsapp: '+91-9876540303', email: 'kiran@example.com',   address: '78 Nehru St, Hyderabad',     priceCodeType: 'fixed',  priceCode: 'C',          is_active: true  },
  { id: 4, name: 'Delhi Distributors',  phone: '+91-9876540404', whatsapp: '+91-9876549000', email: 'delhi@example.com',   address: 'Connaught Place, New Delhi', priceCodeType: 'fixed',  priceCode: 'D',          is_active: true  },
  { id: 5, name: 'Mumbai Mart',         phone: '+91-9876540505', whatsapp: '+91-9876540505', email: 'mumbai@example.com',  address: 'Bandra West, Mumbai',        priceCodeType: 'fixed',  priceCode: 'Retail',     is_active: true  },
  { id: 6, name: 'Priya Provisions',    phone: '+91-9876540606', whatsapp: '',               email: 'priya@example.com',   address: '23 Anna Salai, Chennai',     priceCodeType: 'random', priceCode: 'CPC-X9KM2A', is_active: true  },
  { id: 7, name: 'Arjun General Store', phone: '+91-9876540707', whatsapp: '+91-9876540707', email: 'arjun@example.com',   address: 'Jubilee Hills, Hyderabad',   priceCodeType: 'random', priceCode: 'CPC-Y4PB3Z', is_active: false },
];

/* ── Price type → ProductPrice.priceType mapping ── */
export const PRICE_TYPE_MAP = { A: 'A', B: 'B', C: 'C', D: 'D', Retail: 'Retail' };
export const PRICE_TYPE_OPTIONS = ['A', 'B', 'C', 'D', 'Retail'];
export const FIXED_CODE_OPTIONS = ['A', 'B', 'C', 'D', 'Retail'];

/**
 * Get price for a product given a customer's priceCode.
 * Fixed customers resolve to the matching ProductPrice tier.
 * Random customers fall back to Retail pricing.
 */
export const getPriceForCustomer = (productId, priceCode, pricesArray) => {
  const priceType = PRICE_TYPE_MAP[priceCode] || 'Retail';
  const entry = pricesArray.find(p => p.productId === productId && p.priceType === priceType);
  if (!entry) {
    const fallback = pricesArray.find(p => p.productId === productId && p.priceType === 'Retail');
    return fallback ? fallback.price : 0;
  }
  return entry.price;
};

/* ── Sales ── */
export const MOCK_SALES = [
  {
    id: 1, invoiceNo: 'INV-0001', date: '2026-07-01',
    customerId: 1, customerName: 'Ramesh Traders',
    items: [
      { productId: 1, productName: 'Basmati Rice (Premium)', priceType: 'A',      qty: 5,  unit: 'Kg',     price: 95.00  },
      { productId: 6, productName: 'Parle-G Biscuits 800g',  priceType: 'A',      qty: 10, unit: 'Pack',   price: 55.00  },
    ],
    subtotal: 1025.00, tax: 92.25, discount: 50.00, total: 1067.25, status: 'Completed',
  },
  {
    id: 2, invoiceNo: 'INV-0002', date: '2026-07-03',
    customerId: 5, customerName: 'Mumbai Mart',
    items: [
      { productId: 3, productName: 'Sunflower Oil 1L',  priceType: 'Retail', qty: 6, unit: 'Bottle', price: 160.00 },
      { productId: 4, productName: 'Amul Butter 500g',  priceType: 'Retail', qty: 4, unit: 'Pack',   price: 240.00 },
    ],
    subtotal: 1920.00, tax: 172.80, discount: 0, total: 2092.80, status: 'Completed',
  },
  {
    id: 3, invoiceNo: 'INV-0003', date: '2026-07-06',
    customerId: 2, customerName: 'Sunita Stores',
    items: [
      { productId: 2, productName: 'Toor Dal', priceType: 'B', qty: 10, unit: 'Kg', price: 115.00 },
    ],
    subtotal: 1150.00, tax: 103.50, discount: 25.00, total: 1228.50, status: 'Draft',
  },
];
