from decimal import Decimal, ROUND_HALF_UP
from rest_framework import serializers
from django.db import transaction
from django.db.models import Q
from .models import Billing, BillingHeader, BillingConfig
from customers.models import Customer, CustomerPriceConfig
from products.models import Product, ProductPriceDetails, PriceCodeList
from dashboard.models import CompanyInfo


TWO = Decimal('0.01')


def display_bill_no(value):
    if value and str(value).startswith('BIL'):
        return 'INV' + str(value)[3:]
    return value


def get_state_code(gst_no):
    """Extract 2-digit state code from GST number string."""
    if gst_no and len(gst_no) >= 2 and gst_no[:2].isdigit():
        return gst_no[:2]
    return None


def calc_line(qty, rate, disc_pct, gst_pct, is_gst, supplier_code, customer_code):
    """
    Pure calculation — returns dict with all computed amounts.
    Uses Decimal throughout. Never uses float.
    """
    qty       = Decimal(str(qty))
    rate      = Decimal(str(rate))
    disc_pct  = Decimal(str(disc_pct))
    gst_pct   = Decimal(str(gst_pct))

    base_amount     = (qty * rate).quantize(TWO, ROUND_HALF_UP)
    disc_amount     = (base_amount * disc_pct / 100).quantize(TWO, ROUND_HALF_UP)
    taxable_amount  = (base_amount - disc_amount).quantize(TWO, ROUND_HALF_UP)
    total_gst       = Decimal('0')
    cgst = sgst = igst = Decimal('0')
    gst_type = 'NONE'

    if is_gst and gst_pct > 0:
        total_gst = (taxable_amount * gst_pct / 100).quantize(TWO, ROUND_HALF_UP)
        if supplier_code and customer_code and supplier_code == customer_code:
            cgst     = (total_gst / 2).quantize(TWO, ROUND_HALF_UP)
            sgst     = (total_gst - cgst).quantize(TWO, ROUND_HALF_UP)
            gst_type = 'CGST_SGST'
        else:
            igst     = total_gst
            gst_type = 'IGST'

    final_amount = (taxable_amount + cgst + sgst + igst).quantize(TWO, ROUND_HALF_UP)
    return {
        'base_amount':    base_amount,
        'disc_amount':    disc_amount,
        'taxable_amount': taxable_amount,
        'total_gst':      total_gst,
        'cgst':           cgst,
        'sgst':           sgst,
        'igst':           igst,
        'gst_type':       gst_type,
        'final_amount':   final_amount,
    }


# ── Read serializers ──────────────────────────────────────────────────────────

class BillingLineReadSerializer(serializers.ModelSerializer):
    ProductName  = serializers.CharField(source='ProductID.ProductName', read_only=True)
    ProductCode  = serializers.CharField(source='ProductID.ProductCode', read_only=True)
    Units        = serializers.CharField(source='ProductID.Units', read_only=True)
    PriceCodeName = serializers.SerializerMethodField()

    class Meta:
        model  = Billing
        fields = [
            'id', 'LineNo', 'ProductID', 'ProductCode', 'ProductName', 'Units',
            'PriceCodeID', 'PriceCodeName',
            'Qty', 'Price', 'ChangeableRate',
            'IsDiscountApplied', 'DiscountPercent', 'DiscountAmount',
            'IsGSTApplied', 'GSTPercent', 'GSTAmount',
            'CGSTAmount', 'SGSTAmount', 'IGSTAmount', 'GSTType',
            'Amount', 'EarnedPoints',
        ]

    def get_PriceCodeName(self, obj):
        if obj.PriceCodeID:
            return obj.PriceCodeID.DisplayLabel
        return None


class BillingHeaderReadSerializer(serializers.ModelSerializer):
    BillNo = serializers.SerializerMethodField()
    CustomerName = serializers.CharField(source='CustomerID.CustomerName', read_only=True)
    CustomerCode = serializers.CharField(source='CustomerID.CustomerCode', read_only=True)
    DefaultPriceCodeLabel = serializers.SerializerMethodField()
    CreatedByUsername     = serializers.CharField(source='CreatedBy.username', read_only=True)
    line_items            = BillingLineReadSerializer(many=True, read_only=True)

    class Meta:
        model  = BillingHeader
        fields = [
            'id', 'BillNo', 'BillDate',
            'CustomerID', 'CustomerName', 'CustomerCode',
            'PriceCodeType', 'DefaultPriceCodeID', 'DefaultPriceCodeLabel',
            'IsGSTBill', 'ItemCount',
            'SubTotal', 'TotalDiscount', 'GSTAmount',
            'TotalCGST', 'TotalSGST', 'TotalIGST',
            'GrandTotal', 'EarnedPoints',
            'CreatedBy', 'CreatedByUsername', 'CreatedOn',
            'line_items',
        ]

    def get_DefaultPriceCodeLabel(self, obj):
        if obj.DefaultPriceCodeID:
            return obj.DefaultPriceCodeID.DisplayLabel
        return None

    def get_BillNo(self, obj):
        return display_bill_no(obj.BillNo)


# ── Write serializers ─────────────────────────────────────────────────────────

class BillingLineInputSerializer(serializers.Serializer):
    ProductID         = serializers.PrimaryKeyRelatedField(queryset=Product.objects.filter(IsActive=True))
    PriceCodeID       = serializers.PrimaryKeyRelatedField(queryset=PriceCodeList.objects.filter(IsActive=True))
    Qty               = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    IsDiscountApplied = serializers.BooleanField(default=False)
    DiscountPercent   = serializers.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0'), min_value=Decimal('0'), max_value=Decimal('100'))
    IsGSTApplied      = serializers.BooleanField(default=False)
    GSTPercent        = serializers.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0'), min_value=Decimal('0'), max_value=Decimal('100'), required=False)
    ChangeableRate    = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True, default=None)


def validate_unique_billing_products(lines):
    seen = set()
    duplicates = []
    for line in lines:
        product = line.get('ProductID')
        product_id = getattr(product, 'pk', product)
        if product_id in seen:
            duplicates.append(getattr(product, 'ProductName', str(product_id)))
        seen.add(product_id)
    if duplicates:
        names = ', '.join(dict.fromkeys(duplicates))
        raise serializers.ValidationError(
            f'Duplicate products are not allowed in the same bill. Merge quantity for: {names}.'
        )


def build_price_detail_lookup(lines):
    product_ids = [line['ProductID'].pk for line in lines]
    price_code_ids = [line['PriceCodeID'].pk for line in lines]
    exact = {}
    by_name = {}

    price_details = (
        ProductPriceDetails.objects
        .filter(ProductId_id__in=product_ids)
        .filter(
            Q(PriceCodeID_id__in=price_code_ids) |
            Q(PriceName__in=[line['PriceCodeID'].PriceCodeName for line in lines])
        )
    )
    for detail in price_details:
        exact.setdefault((detail.ProductId_id, detail.PriceCodeID_id), detail)
        by_name.setdefault((detail.ProductId_id, detail.PriceName), detail)
    return exact, by_name


def get_price_detail_from_lookup(exact, by_name, product, price_code):
    return (
        exact.get((product.pk, price_code.pk)) or
        by_name.get((product.pk, price_code.PriceCodeName))
    )


class BillingCreateSerializer(serializers.Serializer):
    CustomerID = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.filter(IsActive=True))
    lines      = BillingLineInputSerializer(many=True, min_length=1)

    def validate_lines(self, value):
        if not value:
            raise serializers.ValidationError("At least one billing line is required.")
        validate_unique_billing_products(value)
        return value

    def create(self, validated_data):
        user     = self.context['request'].user
        customer = validated_data['CustomerID']
        lines_in = validated_data['lines']

        # Fetch company GST info — try CompanyConfig (CompanyInfo_tbl) first,
        # fall back to legacy CompanyInfo (Company_Info) for backward compat.
        from dashboard.models import CompanyConfig
        company_cfg  = CompanyConfig.objects.first()
        if company_cfg:
            is_gst_bill   = company_cfg.IsGSTRegistered
            supplier_code = get_state_code(company_cfg.GSTNumber) if company_cfg.GSTNumber else None
        else:
            company      = CompanyInfo.objects.first()
            is_gst_bill  = company.IsGSTEnabled if company else False
            supplier_code = get_state_code(company.GSTNo) if (company and company.GSTNo) else None

        # Determine customer state code
        if customer.IsGSTCustomer and customer.GSTNo:
            customer_code = get_state_code(customer.GSTNo)
        else:
            customer_code = None  # leads to IGST for GST bills

        # Fetch active price config
        price_cfg = CustomerPriceConfig.objects.filter(CustomerID=customer, IsActive=True).select_related('FixedPriceCodeID').first()
        price_code_type       = price_cfg.PriceCodeType if price_cfg else 'Random'
        default_price_code    = price_cfg.FixedPriceCodeID if price_cfg else None

        # --- Validate and recalculate each line ---
        calculated_lines = []
        price_exact, price_by_name = build_price_detail_lookup(lines_in)
        for idx, line in enumerate(lines_in, start=1):
            product    = line['ProductID']
            req_price_code = line['PriceCodeID']

            # For Fixed customers, per-row override is allowed for any operator.
            # The frontend sends the selected PriceCodeID; use it directly.
            # (Default is pre-filled with FixedPriceCodeID but operator may change it.)
            # We do NOT force override here — the submitted PriceCodeID is always used.

            # Fetch price from DB — never trust frontend rate
            price_detail = get_price_detail_from_lookup(price_exact, price_by_name, product, req_price_code)
            if not price_detail:
                raise serializers.ValidationError(
                    {f'lines[{idx}]': f'No price found for product "{product.ProductName}" with price code "{req_price_code.DisplayLabel}".'}
                )

            rate      = price_detail.ProductPrice
            # Store user-edited rate as ChangeableRate; use it for calculation
            changeable_rate = line.get('ChangeableRate', None)
            if changeable_rate is not None:
                calc_rate = Decimal(str(changeable_rate))
            else:
                calc_rate = rate
            disc_pct  = line['DiscountPercent'] if line['IsDiscountApplied'] else Decimal('0')
            gst_pct_input = line.get('GSTPercent', None)
            if gst_pct_input is not None and is_gst_bill and line['IsGSTApplied']:
                gst_pct = int(Decimal(str(gst_pct_input)))
            else:
                gst_pct = product.GSTPercent if (is_gst_bill and line['IsGSTApplied']) else 0

            calc = calc_line(
                qty=line['Qty'], rate=calc_rate, disc_pct=disc_pct,
                gst_pct=gst_pct, is_gst=(is_gst_bill and line['IsGSTApplied']),
                supplier_code=supplier_code, customer_code=customer_code,
            )
            calculated_lines.append({
                'line_no':         idx,
                'product':         product,
                'price_code':      req_price_code,
                'qty':             line['Qty'],
                'rate':            calc_rate,
                'changeable_rate': changeable_rate,
                'is_discount':     line['IsDiscountApplied'],
                'disc_pct':        disc_pct,
                'disc_amount':     calc['disc_amount'],
                'is_gst':          (is_gst_bill and line['IsGSTApplied']),
                'gst_pct':         gst_pct,
                'gst_amount':      calc['total_gst'],
                'cgst':            calc['cgst'],
                'sgst':            calc['sgst'],
                'igst':            calc['igst'],
                'gst_type':        calc['gst_type'],
                'final_amount':    calc['final_amount'],
            })

        # --- Header totals ---
        sub_total       = sum(l['qty'] * l['rate'] for l in calculated_lines).quantize(TWO, ROUND_HALF_UP)
        total_discount  = sum(l['disc_amount'] for l in calculated_lines).quantize(TWO, ROUND_HALF_UP)
        total_gst       = sum(l['gst_amount'] for l in calculated_lines).quantize(TWO, ROUND_HALF_UP)
        total_cgst      = sum(l['cgst'] for l in calculated_lines).quantize(TWO, ROUND_HALF_UP)
        total_sgst      = sum(l['sgst'] for l in calculated_lines).quantize(TWO, ROUND_HALF_UP)
        total_igst      = sum(l['igst'] for l in calculated_lines).quantize(TWO, ROUND_HALF_UP)
        grand_total     = sum(l['final_amount'] for l in calculated_lines).quantize(TWO, ROUND_HALF_UP)
        earned_points   = int(grand_total // 100)

        with transaction.atomic():
            header = BillingHeader.objects.create(
                CustomerID=customer,
                PriceCodeType=price_code_type,
                DefaultPriceCodeID=default_price_code,
                IsGSTBill=is_gst_bill,
                ItemCount=len(calculated_lines),
                SubTotal=sub_total,
                TotalDiscount=total_discount,
                GSTAmount=total_gst,
                TotalCGST=total_cgst,
                TotalSGST=total_sgst,
                TotalIGST=total_igst,
                GrandTotal=grand_total,
                EarnedPoints=earned_points,
                CreatedBy=user,
            )
            for l in calculated_lines:
                Billing.objects.create(
                    BillingHeaderID=header,
                    LineNo=l['line_no'],
                    CustomerID=customer,
                    ProductID=l['product'],
                    PriceCodeID=l['price_code'],
                    Qty=l['qty'],
                    Price=l['rate'],
                    IsDiscountApplied=l['is_discount'],
                    DiscountPercent=l['disc_pct'],
                    DiscountAmount=l['disc_amount'],
                    IsGSTApplied=l['is_gst'],
                    GSTPercent=l['gst_pct'],
                    GSTAmount=l['gst_amount'],
                    CGSTAmount=l['cgst'],
                    SGSTAmount=l['sgst'],
                    IGSTAmount=l['igst'],
                    GSTType=l['gst_type'],
                    Amount=l['final_amount'],
                    ChangeableRate=l['changeable_rate'],
                    EarnedPoints=int(l['final_amount'] // 100),
                    CreatedBy=user,
                )
            # Update customer reward points
            customer.Customer_Redeem_Points = customer.Customer_Redeem_Points + Decimal(str(earned_points))
            customer.save(update_fields=['Customer_Redeem_Points'])

        return header


# ── Dropdown serializers ──────────────────────────────────────────────────────

class BillingCustomerDropdownSerializer(serializers.ModelSerializer):
    PriceConfig = serializers.SerializerMethodField()

    class Meta:
        model  = Customer
        fields = ['id', 'CustomerCode', 'CustomerName', 'PhoneNumber',
                  'Customer_Redeem_Points', 'IsGSTCustomer', 'GSTNo', 'PriceConfig']

    def get_PriceConfig(self, obj):
        # Read from the prefetch cache (_active_price_config is a list, no DB hit).
        cached = getattr(obj, '_active_price_config', None)
        if cached is None:
            # Fallback: not prefetched, query directly.
            cached = list(
                CustomerPriceConfig.objects
                .filter(CustomerID=obj, IsActive=True)
                .select_related('FixedPriceCodeID')
            )

        cfg = cached[0] if cached else None
        if not cfg:
            return {'PriceConfigurationMissing': True}

        # FixedPriceCodeID is already joined by the optimized prefetch/query path.
        pc = cfg.FixedPriceCodeID

        return {
            'PriceCodeType':             cfg.PriceCodeType,
            'FixedPriceCodeID':          cfg.FixedPriceCodeID_id,
            'FixedPriceCodeName':        pc.PriceCodeName if pc else None,
            'FixedLabel':                pc.DisplayLabel  if pc else None,
            'PriceConfigurationMissing': False,
        }


class BillingHeaderListSerializer(serializers.ModelSerializer):
    BillNo = serializers.SerializerMethodField()
    CustomerName      = serializers.CharField(source='CustomerID.CustomerName', read_only=True)
    CreatedByUsername = serializers.CharField(source='CreatedBy.username', read_only=True)

    class Meta:
        model  = BillingHeader
        fields = [
            'id', 'BillNo', 'BillDate',
            'CustomerID', 'CustomerName',
            'PriceCodeType', 'IsGSTBill', 'ItemCount',
            'SubTotal', 'TotalDiscount', 'GSTAmount',
            'TotalCGST', 'TotalSGST', 'TotalIGST',
            'GrandTotal', 'EarnedPoints',
            'CreatedBy', 'CreatedByUsername', 'CreatedOn',
        ]

    def get_BillNo(self, obj):
        return display_bill_no(obj.BillNo)


# ── BillingConfig serializer ─────────────────────────────────────────────────

class BillingConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model  = BillingConfig
        fields = ['id', 'ShowDiscount', 'SkipEnabled', 'SkippedColumns', 'UpdatedAt']
        read_only_fields = ['id', 'UpdatedAt']


# ── Billing Update (edit bill) serializer ────────────────────────────────────

class BillingUpdateSerializer(serializers.Serializer):
    """Used by Admin to edit an existing bill — replaces all line items."""
    CustomerID = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.filter(IsActive=True))
    lines      = BillingLineInputSerializer(many=True, min_length=1)

    def validate_lines(self, value):
        if not value:
            raise serializers.ValidationError("At least one billing line is required.")
        validate_unique_billing_products(value)
        return value

    def update(self, instance, validated_data):
        """Replace all line items and recalculate totals."""
        user     = self.context['request'].user
        customer = validated_data['CustomerID']
        lines_in = validated_data['lines']

        from dashboard.models import CompanyConfig
        company_cfg  = CompanyConfig.objects.first()
        if company_cfg:
            is_gst_bill   = company_cfg.IsGSTRegistered
            supplier_code = get_state_code(company_cfg.GSTNumber) if company_cfg.GSTNumber else None
        else:
            company      = CompanyInfo.objects.first()
            is_gst_bill  = company.IsGSTEnabled if company else False
            supplier_code = get_state_code(company.GSTNo) if (company and company.GSTNo) else None

        if customer.IsGSTCustomer and customer.GSTNo:
            customer_code = get_state_code(customer.GSTNo)
        else:
            customer_code = None

        price_cfg = CustomerPriceConfig.objects.filter(CustomerID=customer, IsActive=True).first()
        price_code_type    = price_cfg.PriceCodeType if price_cfg else 'Random'
        default_price_code = price_cfg.FixedPriceCodeID if price_cfg else None

        calculated_lines = []
        price_exact, price_by_name = build_price_detail_lookup(lines_in)
        for idx, line in enumerate(lines_in, start=1):
            product = line['ProductID']
            req_price_code = line['PriceCodeID']
            price_detail = get_price_detail_from_lookup(price_exact, price_by_name, product, req_price_code)
            if not price_detail:
                raise serializers.ValidationError({f'lines[{idx}]': f'No price found for product "{product.ProductName}".'})

            rate = price_detail.ProductPrice
            changeable_rate = line.get('ChangeableRate', None)
            if changeable_rate is not None:
                calc_rate = Decimal(str(changeable_rate))
            else:
                calc_rate = rate
            disc_pct = line['DiscountPercent'] if line['IsDiscountApplied'] else Decimal('0')
            gst_pct_input = line.get('GSTPercent', None)
            if gst_pct_input is not None and is_gst_bill and line['IsGSTApplied']:
                gst_pct = int(Decimal(str(gst_pct_input)))
            else:
                gst_pct = product.GSTPercent if (is_gst_bill and line['IsGSTApplied']) else 0

            calc = calc_line(
                qty=line['Qty'], rate=calc_rate, disc_pct=disc_pct,
                gst_pct=gst_pct, is_gst=(is_gst_bill and line['IsGSTApplied']),
                supplier_code=supplier_code, customer_code=customer_code,
            )
            calculated_lines.append({
                'line_no': idx, 'product': product, 'price_code': req_price_code,
                'qty': line['Qty'], 'rate': calc_rate, 'changeable_rate': changeable_rate,
                'is_discount': line['IsDiscountApplied'], 'disc_pct': disc_pct,
                'disc_amount': calc['disc_amount'],
                'is_gst': (is_gst_bill and line['IsGSTApplied']),
                'gst_pct': gst_pct, 'gst_amount': calc['total_gst'],
                'cgst': calc['cgst'], 'sgst': calc['sgst'], 'igst': calc['igst'],
                'gst_type': calc['gst_type'], 'final_amount': calc['final_amount'],
            })

        sub_total      = sum(l['qty'] * l['rate'] for l in calculated_lines).quantize(TWO, ROUND_HALF_UP)
        total_discount = sum(l['disc_amount'] for l in calculated_lines).quantize(TWO, ROUND_HALF_UP)
        total_gst      = sum(l['gst_amount'] for l in calculated_lines).quantize(TWO, ROUND_HALF_UP)
        total_cgst     = sum(l['cgst'] for l in calculated_lines).quantize(TWO, ROUND_HALF_UP)
        total_sgst     = sum(l['sgst'] for l in calculated_lines).quantize(TWO, ROUND_HALF_UP)
        total_igst     = sum(l['igst'] for l in calculated_lines).quantize(TWO, ROUND_HALF_UP)
        grand_total    = sum(l['final_amount'] for l in calculated_lines).quantize(TWO, ROUND_HALF_UP)
        new_points     = int(grand_total // 100)
        old_points     = instance.EarnedPoints

        with transaction.atomic():
            # Remove old reward points, add new
            customer.Customer_Redeem_Points = max(
                Decimal('0'),
                customer.Customer_Redeem_Points - Decimal(str(old_points)) + Decimal(str(new_points))
            )
            customer.save(update_fields=['Customer_Redeem_Points'])

            # Update header
            instance.CustomerID       = customer
            instance.PriceCodeType    = price_code_type
            instance.DefaultPriceCodeID = default_price_code
            instance.IsGSTBill        = is_gst_bill
            instance.ItemCount        = len(calculated_lines)
            instance.SubTotal         = sub_total
            instance.TotalDiscount    = total_discount
            instance.GSTAmount        = total_gst
            instance.TotalCGST        = total_cgst
            instance.TotalSGST        = total_sgst
            instance.TotalIGST        = total_igst
            instance.GrandTotal       = grand_total
            instance.EarnedPoints     = new_points
            instance.save()

            # Delete old lines and recreate
            instance.line_items.all().delete()
            for l in calculated_lines:
                Billing.objects.create(
                    BillingHeaderID=instance, LineNo=l['line_no'],
                    CustomerID=customer, ProductID=l['product'],
                    PriceCodeID=l['price_code'], Qty=l['qty'], Price=l['rate'],
                    IsDiscountApplied=l['is_discount'], DiscountPercent=l['disc_pct'],
                    DiscountAmount=l['disc_amount'], IsGSTApplied=l['is_gst'],
                    GSTPercent=l['gst_pct'], GSTAmount=l['gst_amount'],
                    CGSTAmount=l['cgst'], SGSTAmount=l['sgst'], IGSTAmount=l['igst'],
                    GSTType=l['gst_type'], Amount=l['final_amount'],
                    ChangeableRate=l['changeable_rate'],
                    EarnedPoints=int(l['final_amount'] // 100), CreatedBy=user,
                )
        return instance
