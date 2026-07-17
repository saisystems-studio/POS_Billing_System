# POS GST Implementation Status

## ✅ COMPLETED

### Database Migrations
- ✅ PriceCodeList_tbl created with A, B, C, D, Retail codes
- ✅ Product_tbl: Added ProductCode, HSNCode, GSTPercent
- ✅ Customer_tbl: Added IsGSTCustomer, GSTNo, IsWhatsappSameAsPhone, PhoneNumber nullable
- ✅ CustomerPriceConfig_tbl: Created for Fixed/Random price selection
- ✅ BillingHeader_tbl: Created with GST summary fields
- ✅ Billing_tbl: Added BillingHeaderID, LineNo, PriceCodeID, GST fields (CGST, SGST, IGST, GSTType)
- ✅ Company_Info: Added IsGSTEnabled, GSTNo (dashboard migration already applied)
- ✅ User_Settings: Added keyboard_shortcuts_enabled, keyboard_shortcuts

### Backend API Updates
- ✅ CompanyInfoSerializer: Changed to use IsGSTEnabled/GSTNo, added GST validation
- ✅ ProductSerializer: Added ProductCode, HSNCode, GSTPercent fields
- ✅ ProductWithPricesCreateSerializer: Added HSNCode, GSTPercent
- ✅ ProductViews: Updated create/update to handle HSNCode and GSTPercent
- ✅ CompanyInfoPublicView: Returns IsGSTEnabled and GSTNo for forms
- ✅ UserSettingsSerializer: Added keyboard shortcuts fields

## ⏳ REMAINING WORK

### Backend APIs
1. **PriceCodeList API** - Create endpoints:
   - GET /api/price-codes/ - List all active price codes for dropdowns
   
2. **CustomerPriceConfig API** - Create endpoints:
   - POST /api/customers/{id}/price-config/ - Save customer price configuration
   - GET /api/customers/{id}/price-config/ - Get customer price configuration
   
3. **Customer API Updates**:
   - Update CustomerSerializer to handle IsGSTCustomer, GSTNo fields
   - Add GST number validation (15 chars, starts with 2-digit state code)
   
4. **Billing API - Complete Rewrite**:
   - Create BillingHeaderSerializer with all summary fields
   - Create BillingLineSerializer for line items
   - Create POST /api/billing/create-bill/ endpoint:
     * Accept header + array of line items
     * Validate customer price config
     * Recalculate all amounts, discounts, GST on backend
     * Compare supplier state code vs customer state code
     * Calculate CGST+SGST (intra-state) or IGST (inter-state)
     * Save BillingHeader + all Billing lines in transaction
     * Update customer reward points
   - Add GET /api/billing/products-with-prices/?customer_id=X
     * Returns products with all price codes and current rates
   - Add GET /api/price-codes/
     * Returns A, B, C, D, Retail with IDs

### Frontend Updates

1. **CompanyInfo Form** (`src/pages/CompanyInfo.jsx`):
   - Change `HasGST` to `IsGSTEnabled`
   - Change `GSTNumber` to `GSTNo`
   - Update validation for 15-char GST number with state code check
   
2. **Product Form** (`src/pages/products/ProductForm.jsx`):
   - Fetch company GST status from `/api/company/public/`
   - Conditionally show/hide HSNCode and GSTPercent fields
   - When IsGSTEnabled=false: hide fields, save HSNCode as null, GSTPercent as 0
   - When IsGSTEnabled=true: show fields, validate GST Percent 0-100
   
3. **Customer Form** (`src/pages/customers/CustomerForm.jsx`):
   - Add GST Customer checkbox (shown only when company IsGSTEnabled=true)
   - Show GST Number field only when GST Customer is checked
   - Validate GST Number as 15 chars when required
   - Add Price Type dropdown: Fixed/Random
   - Add Default Price Code dropdown (A/B/C/D/Retail) - shown only for Fixed
   - Save CustomerPriceConfig through new API
   
4. **Billing Form - COMPLETE REWRITE** (`src/pages/billing/BillingForm.jsx`):
   - Create Excel-like grid with columns:
     * S.No | Particulars | Quantity | Price Code | Rate | Discount | GST | Amount
   - Customer dropdown at top:
     * After selection, display price type (Fixed/Random)
     * Display default price code for Fixed customers
   - Multiple rows with inline editing
   - Particulars: Searchable product dropdown
   - Quantity: Decimal input
   - Price Code: Dropdown (auto-select for Fixed, enable for Random)
   - Rate: Auto-filled, read-only
   - Discount: Checkbox + percentage input
   - GST: Checkbox (only if company IsGSTEnabled=true)
   - Amount: Auto-calculated, read-only
   - Bottom summary: Item count, Overall Total
   - Save button: Submit to POST /api/billing/create-bill/
   - After save: Show Bill Number, clear form
   
5. **Billing List** (`src/pages/billing/BillingList.jsx`):
   - Display BillNo, Customer, Date, ItemCount, GrandTotal
   - Add columns for TotalCGST, TotalSGST, TotalIGST
   - Filter by date, customer
   - View bill details with line items

### Calculation Logic (Backend)

```python
# For each line item:
BaseAmount = Quantity × Rate
DiscountAmount = BaseAmount × DiscountPercent ÷ 100
TaxableAmount = BaseAmount - DiscountAmount
TotalGSTAmount = TaxableAmount × GSTPercent ÷ 100

# Extract state codes
SupplierStateCode = Company.GSTNo[:2] if Company.GSTNo else None
CustomerStateCode = Customer.GSTNo[:2] if Customer.GSTNo else None

# Determine tax type
if SupplierStateCode == CustomerStateCode:
    # Intra-state
    CGSTAmount = TotalGSTAmount ÷ 2
    SGSTAmount = TotalGSTAmount ÷ 2
    IGSTAmount = 0
    GSTType = "CGST_SGST"
else:
    # Inter-state
    CGSTAmount = 0
    SGSTAmount = 0
    IGSTAmount = TotalGSTAmount
    GSTType = "IGST"

FinalAmount = TaxableAmount + CGSTAmount + SGSTAmount + IGSTAmount

# Header totals = sum of all line items
```

### Key Rules to Remember
- Never trust frontend calculations - always recalculate on backend
- Save only IDs in relationships (PriceCodeID, not price code name)
- ProductCode, CustomerCode, BillNo are auto-generated
- GSTPercent is Integer, amounts are Decimal(18,2)
- Unique constraint: BillingHeaderID + LineNo
- One active CustomerPriceConfig per customer
- Keyboard shortcuts editable only by Admin in User_Settings table

## Testing Checklist
- [ ] Create company with GST enabled
- [ ] Create products with HSN and GST %
- [ ] Create customer with Fixed price (Price A)
- [ ] Create customer with Random price
- [ ] Create bill for Fixed customer (price code locked)
- [ ] Create bill for Random customer (select different price codes per row)
- [ ] Verify CGST+SGST for same-state customer
- [ ] Verify IGST for different-state customer
- [ ] Verify discount calculations
- [ ] Verify reward points calculation and customer balance update
- [ ] Test with GST disabled (all GST fields hidden, amounts zero)
