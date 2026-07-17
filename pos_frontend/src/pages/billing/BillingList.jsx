import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from '../../components/Layout';
import ConfirmModal from '../../components/ConfirmModal';
import SplitTable from '../../components/SplitTable';
import RowActionPopup from '../../components/RowActionPopup';
import billingService from '../../services/billingService';
import { clearPageCache, fetchCachedPage, getCachedPage, makePageKey, prefetchCachedPage } from '../../services/pageCache';
import { useToast } from '../../context/ToastContext';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';

/* â”€â”€ Icons â”€â”€ */
const SearchIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const ViewIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const BillIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
const PrintIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>;
const PrintIconLg  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>;
const DownloadIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const CloseIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

/* â”€â”€ Helpers â”€â”€ */
const PAGE_SIZE = 13;
const fmt   = s => s ? new Date(s).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : 'â€”';
const fmtDt = s => s ? new Date(s).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'â€”';
const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
});
const fmtAmt = v => {
  if (v == null || v === '') return 'â€”';
  const amount = Number(v);
  if (!Number.isFinite(amount)) return 'â€”';
  try {
    return inrFormatter.format(amount);
  } catch {
    return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
};

/* â”€â”€ Invoice HTML builder â€” multi-line, with GST â”€â”€ */
function buildInvoiceHTML(bill, companyName = 'POS Billing System', format = 'a4') {
  const lines = bill.line_items || [];
  const num = v => Number.parseFloat(v || 0) || 0;
  const plain = v => num(v).toFixed(2);
  const money = v => `&#8377;${plain(v)}`;
  const qtyText = v => num(v).toFixed(2);
  const grossSubtotal = lines.reduce((sum, l) => {
    const rate = num(l.ChangeableRate ?? l.Price);
    return sum + (num(l.Qty) * rate);
  }, 0);
  const subTotal = num(bill.SubTotal) || grossSubtotal;
  const discountTotal = num(bill.TotalDiscount) || lines.reduce((sum, l) => {
    const lineBase = num(l.Qty) * num(l.ChangeableRate ?? l.Price);
    return sum + (num(l.DiscountAmount) || (lineBase * num(l.DiscountPercent) / 100));
  }, 0);
  const taxTotal = num(bill.GSTAmount || bill.TotalGST) || (num(bill.TotalCGST) + num(bill.TotalSGST) + num(bill.TotalIGST)) || lines.reduce((sum, l) => {
    return sum + (num(l.GSTAmount) || num(l.CGSTAmount) + num(l.SGSTAmount) + num(l.IGSTAmount));
  }, 0);
  const grandTotal = num(bill.GrandTotal || bill.Amount) || (subTotal - discountTotal + taxTotal);
  const redeemed = num(bill.RedeemedAmount || bill.RedeemedPointsAmount);
  const amountReceived = num(bill.AmountReceived || bill.ReceivedAmount || bill.PaidAmount) || grandTotal;
  const balance = num(bill.Balance || bill.BalanceAmount || (amountReceived - grandTotal));
  const taxLabel = num(bill.TotalCGST) || num(bill.TotalSGST)
    ? 'Tax (CGST 2.5% + SGST 2.5%)'
    : num(bill.TotalIGST)
      ? 'Tax (IGST)'
      : 'Tax';

  const rowsHtml = lines.length ? lines.map((l, i) => {
    const rate = num(l.ChangeableRate ?? l.Price);
    const qty = num(l.Qty);
    const base = qty * rate;
    const discount = num(l.DiscountAmount) || (base * num(l.DiscountPercent) / 100);
    const tax = num(l.GSTAmount) || num(l.CGSTAmount) + num(l.SGSTAmount) + num(l.IGSTAmount);
    const amount = num(l.Amount) || (base - discount + tax);
    const unit = l.Units ? ` <span class="muted">(${l.Units})</span>` : '';
    return `<tr>
      <td class="c">${i + 1}</td>
      <td class="product"><strong>${l.ProductName || ''}</strong>${unit}</td>
      <td class="r">${qtyText(qty)}</td>
      <td class="c">${l.PriceCodeName || l.PriceCode || l.DisplayLabel || 'MRP'}</td>
      <td class="r">${plain(rate)}</td>
      <td class="r">${plain(discount)}</td>
      <td class="r">${plain(tax)}</td>
      <td class="r">${plain(amount)}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="8" class="empty">No line items found</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>Invoice ${bill.BillNo || ('#' + bill.id)}</title>
<style>
  @page{size:A4;margin:12mm}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Inter,Arial,Helvetica,sans-serif;color:#2b1a10;background:#fff;font-size:13px;line-height:1.35}
  .invoice{min-height:100vh;background:#fff;padding:26px 28px 18px}
  .brand{display:flex;align-items:center;justify-content:center;gap:18px;margin-bottom:20px;color:#5b2f12;text-align:center}
  .brand:before,.brand:after{content:"";width:54px;height:1px;background:#dfd0c2}
  .logo{width:46px;height:46px;border-radius:13px;background:#8A5125;color:#fff;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(138,81,37,.22)}
  .logo:before{content:"";width:18px;height:18px;border:7px solid #fff;border-radius:5px;transform:rotate(45deg)}
  .brand h1{font-size:32px;line-height:1;font-weight:900;letter-spacing:-.02em;color:#5b2f12}
  .brand p{font-size:15px;color:#72645c;font-weight:600;margin-top:7px}
  .meta-card{border:1px solid #dfd0c2;border-radius:8px;padding:16px 24px;margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr;gap:28px;background:#fff}
  .meta-card .side:first-child{border-right:1px solid #dfd0c2;padding-right:28px}.meta-card .side:last-child{padding-left:10px}
  .info-row{display:grid;grid-template-columns:26px 172px 1fr;align-items:center;gap:10px;padding:6px 0;color:#4c4039}
  .info-icon{color:#8A5125;font-size:16px;text-align:center}.info-label{font-weight:600;color:#66564c}.info-value{font-weight:800;color:#1d130d}.yes{color:#12842b;font-weight:900}
  table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;border:1px solid #dfd0c2;border-radius:8px;overflow:hidden;background:#fff}
  thead th{background:#f4ece4;color:#4b2612;font-weight:900;padding:11px 12px;border-bottom:1px solid #dfd0c2;text-align:center;white-space:nowrap}
  tbody td{padding:10px 12px;border-bottom:1px solid #eadfd5;text-align:center;color:#211711;vertical-align:middle}tbody tr:last-child td{border-bottom:0}
  .product{text-align:left}.r{text-align:right}.c{text-align:center}.muted{color:#72645c;font-weight:600}.empty{text-align:center;color:#72645c;padding:18px}
  .invoice-lower{display:grid;grid-template-columns:1fr 420px;gap:16px;margin-top:6px;align-items:start}.summary{grid-column:2;border:1px solid #dfd0c2;border-radius:8px;padding:12px 18px;background:#fff}
  .sum-row{display:flex;justify-content:space-between;gap:22px;padding:4px 0;color:#34251d}.sum-row.negative{color:#d00000}.sum-row.grand{border-top:1px dashed #d7c6b8;margin-top:6px;padding-top:10px;color:#8A5125;font-size:22px;font-weight:900}
  .points{margin:6px 8px 16px;border:1px solid #cfae91;border-radius:7px;padding:10px 18px;display:flex;align-items:center;gap:14px;color:#6a5142;background:#fff}.star{width:30px;height:30px;border-radius:50%;background:#d68b21;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:18px}.points strong{font-size:22px;color:#8A5125}.points .note{font-size:12px;color:#6f625a;margin-left:6px}
  .thanks{text-align:center;border-top:1px solid #eadfd5;border-bottom:1px solid #eadfd5;padding:12px 0 10px;color:#6f625a}.thanks strong{display:block;color:#6b3518;margin-bottom:6px;font-size:14px}.support{display:flex;justify-content:center;gap:12px;color:#6f625a;font-size:12px;padding-top:12px}
  body.pos80 .invoice{max-width:360px;margin:0 auto;padding:14px}body.pos80 .brand{gap:8px}.pos80 .brand h1{font-size:20px}.pos80 .brand:before,.pos80 .brand:after,.pos80 .support{display:none}.pos80 .meta-card,.pos80 .invoice-lower{display:block}.pos80 .meta-card{padding:10px}.pos80 .meta-card .side:first-child{border-right:0;padding-right:0}.pos80 .meta-card .side:last-child{padding-left:0}.pos80 .info-row{grid-template-columns:22px 1fr;gap:6px}.pos80 .info-value{grid-column:2}.pos80 .summary{margin-top:10px}.pos80 table{font-size:11px}.pos80 thead th,.pos80 tbody td{padding:6px 4px}.pos80 .points{margin:8px 0}.pos80 .invoice-lower{margin-top:8px}
  body.thermal58 .invoice{max-width:260px;margin:0 auto;padding:10px}.thermal58 .brand{margin-bottom:10px}.thermal58 .brand h1{font-size:17px}.thermal58 .logo,.thermal58 .brand:before,.thermal58 .brand:after,.thermal58 .support{display:none}.thermal58 .meta-card,.thermal58 .invoice-lower{display:block}.thermal58 .meta-card{padding:8px}.thermal58 .meta-card .side:first-child{border-right:0;padding-right:0}.thermal58 .meta-card .side:last-child{padding-left:0}.thermal58 .info-row{grid-template-columns:1fr;gap:2px;padding:3px 0}.thermal58 table{font-size:10px}.thermal58 thead th,.thermal58 tbody td{padding:5px 3px}.thermal58 .summary{margin-top:8px;padding:8px}.thermal58 .sum-row.grand{font-size:16px}.thermal58 .points{padding:8px;margin:8px 0}.thermal58 .points strong{font-size:15px}
  @media(max-width:720px){.invoice{padding:16px}.brand h1{font-size:24px}.meta-card{grid-template-columns:1fr;padding:14px}.meta-card .side:first-child{border-right:0;border-bottom:1px solid #dfd0c2;padding:0 0 10px}.meta-card .side:last-child{padding:0}.invoice-lower{grid-template-columns:1fr}.summary{grid-column:auto}.info-row{grid-template-columns:24px 1fr}.info-value{grid-column:2}.support{flex-wrap:wrap}}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.invoice{padding:0}.support{position:fixed;bottom:0;left:0;right:0}}
</style></head>
<body class="${format}">
  <div class="invoice">
    <div class="brand"><span class="logo"></span><div><h1>${companyName}</h1><p>Sales Invoice</p></div></div>
    <section class="meta-card">
      <div class="side">
        <div class="info-row"><span class="info-icon">&#9635;</span><span class="info-label">Sale No.</span><span class="info-value">${bill.BillNo || `#${bill.id}`}</span></div>
        <div class="info-row"><span class="info-icon">&#9636;</span><span class="info-label">Invoice Date & Time</span><span class="info-value">${fmtDt(bill.CreatedOn || bill.BillDate)}</span></div>
        <div class="info-row"><span class="info-icon">&#9675;</span><span class="info-label">Sold By</span><span class="info-value">${bill.CreatedByUsername || '-'}</span></div>
        <div class="info-row"><span class="info-icon">&#9634;</span><span class="info-label">Payment Method</span><span class="info-value">${bill.PaymentMethod || 'Cash'}</span></div>
      </div>
      <div class="side">
        <div class="info-row"><span class="info-icon">&#9675;</span><span class="info-label">Customer Name</span><span class="info-value">${bill.CustomerName || '-'}</span></div>
        <div class="info-row"><span class="info-icon">&#8759;</span><span class="info-label">Customer Code</span><span class="info-value">${bill.CustomerCode || '-'}</span></div>
        <div class="info-row"><span class="info-icon">&#9635;</span><span class="info-label">GST Type / GST Bill</span><span class="info-value">GST Bill: <span class="${bill.IsGSTBill ? 'yes' : ''}">${bill.IsGSTBill ? 'Yes' : 'No'}</span></span></div>
        <div class="info-row"><span class="info-icon">&#9743;</span><span class="info-label">Phone / Code</span><span class="info-value">${bill.PhoneNumber || bill.CustomerPhone || '-'}</span></div>
      </div>
    </section>
    <table><thead><tr><th style="width:7%">S.No</th><th style="width:24%;text-align:left">Product</th><th style="width:10%">Qty</th><th style="width:14%">Price Code</th><th style="width:12%" class="r">Rate (&#8377;)</th><th style="width:13%" class="r">Discount (&#8377;)</th><th style="width:10%" class="r">Tax (&#8377;)</th><th style="width:12%" class="r">Amount (&#8377;)</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    <div class="invoice-lower"><div></div><div class="summary">
      <div class="sum-row"><span>Subtotal</span><span>${money(subTotal)}</span></div>
      <div class="sum-row negative"><span>Discount</span><span>-${money(discountTotal)}</span></div>
      <div class="sum-row"><span>${taxLabel}</span><span>${money(taxTotal)}</span></div>
      <div class="sum-row negative"><span>Redeemed Points</span><span>-${money(redeemed)}</span></div>
      <div class="sum-row"><span>Amount Received</span><span>${money(amountReceived)}</span></div>
      <div class="sum-row"><span>Balance</span><span>${money(balance)}</span></div>
      <div class="sum-row grand"><span>Grand Total</span><span>${money(grandTotal)}</span></div>
    </div></div>
    <div class="points"><span class="star">&#9733;</span><span>Reward Points Earned: <strong>${bill.EarnedPoints || 0} pts</strong><span class="note">(1 point per &#8377;100 spent)</span></span></div>
    <div class="thanks"><strong>Thank you for shopping with us!</strong><span>Please visit again &middot; ${companyName}</span></div>
    <div class="support"><span>&#9742;</span><span>Need help?</span><span>Contact support@posbilling.com</span><span>|</span><span>+91 98765 43210</span></div>
  </div>
</body></html>`;
}

const InvoiceModal = ({ bill, onClose, onPrinted, companyName }) => {
  const iframeRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [format, setFormat] = useState('a4');

  useEffect(() => {
    if (!bill || !iframeRef.current) return;
    setReady(false);
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(buildInvoiceHTML(bill, companyName, format));
    doc.close();
    const onLoad = () => setReady(true);
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [bill, companyName, format]);

  if (!bill) return null;

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
      onPrinted?.();
    }
  };

  const formatOptions = [
    ['a4', 'A4'],
    ['pos80', 'POS 80mm'],
    ['thermal58', 'Thermal 58mm'],
  ];

  const toolbarButton = {
    display:'inline-flex',alignItems:'center',justifyContent:'center',gap:'.45rem',
    height:38,padding:'0 .95rem',borderRadius:8,border:'1px solid #dfd0c2',
    fontWeight:800,fontSize:'.9rem',cursor:'pointer',whiteSpace:'nowrap',
  };

  return createPortal(
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:8000,background:'rgba(37,33,30,.62)',backdropFilter:'blur(3px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1.2rem',animation:'fadeIn .15s ease-out'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:18,boxShadow:'0 28px 70px rgba(22,18,15,.38)',width:'min(1180px,96vw)',height:'92vh',display:'flex',flexDirection:'column',overflow:'hidden',border:'1px solid rgba(138,81,37,.18)',animation:'fadeIn .18s ease-out'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem',padding:'1.45rem 1.55rem',borderBottom:'1px solid #eadfd5',background:'#fff',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:'.85rem',minWidth:0}}>
            <span style={{width:36,height:36,border:'1px solid #eadfd5',borderRadius:8,display:'inline-flex',alignItems:'center',justifyContent:'center',color:'#8A5125',flex:'0 0 auto'}}><BillIcon/></span>
            <span style={{fontWeight:900,fontSize:'1.25rem',fontFamily:'var(--font-heading)',color:'#3f2413',whiteSpace:'nowrap'}}>{bill.BillNo || `Sale #${bill.id}`}</span>
            <span style={{fontSize:'.9rem',color:'#6f6258',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>&middot; {fmtDt(bill.CreatedOn||bill.BillDate)} &middot; Customer: {bill.CustomerName || '-'}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'.75rem',flex:'0 0 auto'}}>
            <div role="tablist" aria-label="Invoice paper size" style={{display:'inline-flex',border:'1px solid #dfd0c2',borderRadius:8,overflow:'hidden',background:'#fff'}}>
              {formatOptions.map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={format === value} onClick={() => setFormat(value)}
                  style={{minWidth:value === 'a4' ? 74 : 112,height:38,padding:'0 .9rem',border:'none',borderRight:value === 'thermal58' ? 'none' : '1px solid #dfd0c2',background:format === value ? '#8A5125' : '#fff',color:format === value ? '#fff' : '#3f2c21',fontWeight:800,cursor:'pointer',fontSize:'.9rem'}}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={handlePrint} disabled={!ready} style={{...toolbarButton,background:ready?'#8A5125':'#ece3da',borderColor:ready?'#8A5125':'#e2d6ca',color:ready?'#fff':'#95877d',cursor:ready?'pointer':'not-allowed',opacity:ready?1:.75}}>
              <PrintIconLg/> Print
            </button>
            <button onClick={onClose} aria-label="Close invoice preview" style={{background:'#fff',border:'1px solid #eadfd5',borderRadius:8,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#6f6258'}}>
              <CloseIcon/>
            </button>
          </div>
        </div>
        <div style={{flex:1,overflow:'hidden',position:'relative',minHeight:0,background:'#f3efeb'}}>
          {!ready && (
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'.75rem',color:'var(--text-muted)',fontSize:'.82rem',background:'#fff',zIndex:2}}>
              <div style={{width:28,height:28,border:'3px solid var(--scale-200)',borderTopColor:'var(--primary)',borderRadius:'50%',animation:'spin .6s linear infinite'}}/>
              Loading invoice...
            </div>
          )}
          <iframe ref={iframeRef} style={{width:'100%',height:'100%',border:'none',opacity:ready?1:0,transition:'opacity .2s',display:'block'}} title={`Sale Invoice ${bill.BillNo||bill.id}`}/>
        </div>
      </div>
    </div>, document.body
  );
};
/* â”€â”€ View More Modal â€” multi-line bill detail â”€â”€ */
const ViewMoreModal = ({ bill, onClose, onOpenInvoice }) => {
  if (!bill) return null;
  const lines = bill.line_items || [];
  const hasGST = bill.IsGSTBill;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{maxWidth:640,width:'95vw'}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{bill.BillNo||`Sale #${bill.id}`} â€” Details</span>
          <button className="modal-close" onClick={onClose}><CloseIcon/></button>
        </div>
        <div className="modal-body" style={{paddingBottom:'.5rem'}}>
          {/* Header info */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.4rem .875rem',marginBottom:'.875rem',fontSize:'.82rem'}}>
            {[
              ['Sale No.',         bill.BillNo||`#${bill.id}`],
              ['Date & Time',      fmtDt(bill.CreatedOn||bill.BillDate)],
              ['Customer',         bill.CustomerName],
              ['Customer Code',    bill.CustomerCode||'â€”'],
              ['Items',            `${bill.ItemCount||lines.length} line${(bill.ItemCount||lines.length)!==1?'s':''}`],
              ['Created By',       bill.CreatedByUsername||'â€”'],
            ].map(([label,val]) => (
              <div key={label}>
                <div style={{color:'var(--text-muted)',fontSize:'.66rem',fontWeight:700,marginBottom:'.1rem',textTransform:'uppercase',letterSpacing:'.04em'}}>{label}</div>
                <div style={{color:'var(--text-primary)',fontWeight:600}}>{val}</div>
              </div>
            ))}
          </div>

          {/* Line items table */}
          {lines.length > 0 && (
            <div style={{overflowX:'auto',marginBottom:'.875rem'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.79rem'}}>
                <thead>
                  <tr style={{background:'#8A5125'}}>
                    <th style={{padding:'.35rem .5rem',color:'#fff',fontWeight:700,fontSize:'.7rem',textAlign:'center',width:32}}>#</th>
                    <th style={{padding:'.35rem .5rem',color:'#fff',fontWeight:700,fontSize:'.7rem',textAlign:'left'}}>Product</th>
                    <th style={{padding:'.35rem .5rem',color:'#fff',fontWeight:700,fontSize:'.7rem',textAlign:'right'}}>Qty</th>
                    <th style={{padding:'.35rem .5rem',color:'#fff',fontWeight:700,fontSize:'.7rem',textAlign:'right'}}>Rate</th>
                    {hasGST && <th style={{padding:'.35rem .5rem',color:'#fff',fontWeight:700,fontSize:'.7rem',textAlign:'right'}}>GST</th>}
                    <th style={{padding:'.35rem .5rem',color:'#fff',fontWeight:700,fontSize:'.7rem',textAlign:'right'}}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l,i) => (
                    <tr key={l.id||i} style={{borderBottom:'1px solid var(--divider)',background:i%2===0?'transparent':'var(--bg-soft)'}}>
                      <td style={{padding:'.32rem .5rem',textAlign:'center',color:'var(--text-muted)',fontSize:'.72rem'}}>{i+1}</td>
                      <td style={{padding:'.32rem .5rem'}}>
                        <div style={{fontWeight:700,color:'var(--text-primary)'}}>{l.ProductName}</div>
                        {l.Units && <div style={{fontSize:'.7rem',color:'var(--text-muted)'}}>{l.Units}{l.PriceCodeName?` Â· ${l.PriceCodeName}`:''}</div>}
                      </td>
                      <td style={{padding:'.32rem .5rem',textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{l.Qty}</td>
                      <td style={{padding:'.32rem .5rem',textAlign:'right',fontVariantNumeric:'tabular-nums'}}>
                        {l.ChangeableRate!=null ? (
                          <span title={`Price code rate: ${fmtAmt(l.Price)}`}>
                            {fmtAmt(l.ChangeableRate)} <span style={{fontSize:'.68rem',color:'#0277bd'}}>âœŽ</span>
                          </span>
                        ) : fmtAmt(l.Price)}
                        {parseFloat(l.DiscountPercent||0)>0 && <div style={{fontSize:'.68rem',color:'#e53935'}}>-{l.DiscountPercent}%</div>}
                      </td>
                      {hasGST && <td style={{padding:'.32rem .5rem',textAlign:'right',fontSize:'.75rem',color:parseFloat(l.GSTAmount||0)>0?'#0277bd':'var(--text-muted)'}}>
                        {parseFloat(l.GSTAmount||0)>0 ? `${l.GSTPercent}%` : 'â€”'}
                      </td>}
                      <td style={{padding:'.32rem .5rem',textAlign:'right',fontWeight:700,color:'var(--primary-dark)',fontVariantNumeric:'tabular-nums'}}>{fmtAmt(l.Amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div style={{display:'flex',justifyContent:'flex-end'}}>
            <div style={{minWidth:220,fontSize:'.82rem'}}>
              {parseFloat(bill.TotalDiscount||0)>0 && (
                <div style={{display:'flex',justifyContent:'space-between',padding:'.25rem 0',borderBottom:'1px solid var(--divider)',color:'#e53935'}}>
                  <span>Discount</span><span>âˆ’ {fmtAmt(bill.TotalDiscount)}</span>
                </div>
              )}
              {parseFloat(bill.TotalCGST||0)>0 && (
                <div style={{display:'flex',justifyContent:'space-between',padding:'.25rem 0',borderBottom:'1px solid var(--divider)',color:'#0277bd'}}>
                  <span>CGST</span><span>{fmtAmt(bill.TotalCGST)}</span>
                </div>
              )}
              {parseFloat(bill.TotalSGST||0)>0 && (
                <div style={{display:'flex',justifyContent:'space-between',padding:'.25rem 0',borderBottom:'1px solid var(--divider)',color:'#0277bd'}}>
                  <span>SGST</span><span>{fmtAmt(bill.TotalSGST)}</span>
                </div>
              )}
              {parseFloat(bill.TotalIGST||0)>0 && (
                <div style={{display:'flex',justifyContent:'space-between',padding:'.25rem 0',borderBottom:'1px solid var(--divider)',color:'#c62828'}}>
                  <span>IGST</span><span>{fmtAmt(bill.TotalIGST)}</span>
                </div>
              )}
              <div style={{display:'flex',justifyContent:'space-between',padding:'.35rem 0',fontWeight:800,fontSize:'.92rem',color:'#8A5125',borderTop:'2px solid #8A5125',marginTop:'.15rem'}}>
                <span>Grand Total</span><span>{fmtAmt(bill.GrandTotal)}</span>
              </div>
              <div style={{textAlign:'right',fontSize:'.75rem',color:'var(--text-muted)',marginTop:'.25rem'}}>
                â­ {bill.EarnedPoints} pts earned
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>Close</button>
          <button className="btn btn-primary btn-sm" onClick={()=>{onOpenInvoice(bill);onClose();}}>
            <BillIcon/> View Invoice
          </button>
        </div>
      </div>
    </div>
  );
};

/* â”€â”€ Flash toast â”€â”€ */
const FlashToast = ({ show }) => {
  if (!show) return null;
  return createPortal(
    <div style={{position:'fixed',bottom:'1.75rem',left:'50%',transform:'translateX(-50%)',zIndex:99999,
      background:'linear-gradient(135deg,#8A5125,#6b3d18)',color:'#fff',fontWeight:700,fontSize:'.82rem',
      padding:'.5rem 1.2rem',borderRadius:999,boxShadow:'0 4px 18px rgba(138,81,37,.5)',
      display:'flex',alignItems:'center',gap:'.45rem',pointerEvents:'none',animation:'flashToastIn .18s cubic-bezier(.22,1,.36,1) both'}}>
      <PrintIconLg/> Sent to printer
    </div>, document.body
  );
};

/* â”€â”€ BillingList â”€â”€ */
const BillingList = () => {
  const navigate    = useNavigate();
  const location    = useLocation();
  const toast       = useToast();
  const { companyInfo } = useCompany();
  const { isAdmin } = useAuth();
  const companyName = companyInfo?.CompanyName || 'POS Billing System';

  const [billings,  setBillings]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [deb,       setDeb]       = useState('');
  const [dateMode,  setDateMode]  = useState('period');
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');
  const [dateExact, setDateExact] = useState('');
  const [page,      setPage]      = useState(1);
  const [total,     setTotal]     = useState(0);
  const [error,     setError]     = useState('');

  const [viewMore,     setViewMore]     = useState(null);
  const [invoiceBill,  setInvoiceBill]  = useState(null);
  const [showDel,      setShowDel]      = useState(false);
  const [delTarget,    setDelTarget]    = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [selected,     setSelected]     = useState(new Set());
  const [flashPrint,   setFlashPrint]   = useState(false);
  const [hoveredBillId, setHoveredBillId] = useState(null);
  const [dismissedActionBillId, setDismissedActionBillId] = useState(null);
  /* keyboard row selection */
  const [kbRow,        setKbRow]        = useState(-1);
  const tableRef = useRef(null);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [dropPos,        setDropPos]        = useState({ top:0, right:0 });
  const exportBtnRef = useRef(null);
  const dropMenuRef  = useRef(null);
  const fetchSeqRef = useRef(0);

  const totalPages        = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleSalesTotal = billings.reduce((sum, bill) => {
    const amount = Number.parseFloat(bill.GrandTotal ?? bill.Amount ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  useEffect(() => {
    const isInteractiveTarget = (target) => Boolean(target?.closest?.(
      'input, select, textarea, button, a, [role="button"], .pagination, .row-action-popup'
    ));
    const h = e => {
      if (!tableRef.current || !billings.length) return;
      if (isInteractiveTarget(e.target)) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setKbRow(r => Math.min(r + 1, billings.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setKbRow(r => Math.max(r - 1, 0)); }
      else if (e.key === 'Enter' && kbRow >= 0 && billings[kbRow]) {
        e.preventDefault();
        if (isAdmin) navigate(`/billing/${billings[kbRow].id}`);
        else openViewMore(billings[kbRow]);
      } else if (e.key === 'Escape') {
        setViewMore(null);
        setDismissedActionBillId(billings[kbRow]?.id ?? hoveredBillId);
        setHoveredBillId(null);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [billings, kbRow, navigate, isAdmin]);

  /* â”€â”€ Auto-open invoice from BillingForm â”€â”€ */
  useEffect(() => {
    if (location.state?.newBill) { setInvoiceBill(location.state.newBill); window.history.replaceState({}, ''); }
  }, []); // eslint-disable-line

  /* â”€â”€ Debounce search â”€â”€ */
  useEffect(() => {
    const t = setTimeout(() => { setDeb(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  /* â”€â”€ Fetch â€” now fetches BillingHeader with line_items â”€â”€ */
  const fetchBillings = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    const params = { page, page_size: PAGE_SIZE };
    if (deb) params.search = deb;
    if (dateMode === 'specific') {
      if (dateExact) params.date = dateExact;
    } else {
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo)   params.date_to   = dateTo;
    }
    const cacheKey = makePageKey('billings', params);
    const cached = getCachedPage('billings', cacheKey);
    if (cached) {
      const cachedRows = cached.results !== undefined ? cached.results : (Array.isArray(cached) ? cached : []);
      setBillings(cachedRows);
      setTotal(cached.count ?? cachedRows.length);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const { data } = await fetchCachedPage('billings', cacheKey, () => billingService.getBillings(params), { force: Boolean(cached) });
      if (seq !== fetchSeqRef.current) return;
      if (data.results !== undefined) { setBillings(data.results); setTotal(data.count); }
      else { setBillings(Array.isArray(data)?data:[]); setTotal(Array.isArray(data)?data.length:0); }
      const rows = data.results !== undefined ? data.results : (Array.isArray(data) ? data : []);
      const totalCount = data.count ?? rows.length;
      const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
      [page - 1, page + 1].filter(n => n >= 1 && n <= maxPage).forEach(n => {
        const nextParams = { ...params, page: n };
        prefetchCachedPage('billings', makePageKey('billings', nextParams), () => billingService.getBillings(nextParams));
      });
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      if (!cached && billings.length === 0) setError(err.response?.data?.detail || 'Unable to retrieve data.');
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [page, deb, dateMode, dateFrom, dateTo, dateExact, billings.length]);

  useEffect(() => { fetchBillings(); }, [fetchBillings]);

  /* â”€â”€ View detail â€” fetch full bill with line_items â”€â”€ */
  const openViewMore = async (b) => {
    // If already has line_items, use directly; else fetch detail
    if (b.line_items) { setViewMore(b); return; }
    try {
      const full = await billingService.getBilling(b.id);
      setViewMore(full);
    } catch { setViewMore(b); }
  };

  const openInvoice = async (b) => {
    if (b.line_items) { setInvoiceBill(b); return; }
    try {
      const full = await billingService.getBilling(b.id);
      setInvoiceBill(full);
    } catch { setInvoiceBill(b); }
  };

  /* â”€â”€ Export dropdown position â”€â”€ */
  useLayoutEffect(() => {
    if (showExportMenu && exportBtnRef.current) {
      const r = exportBtnRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
  }, [showExportMenu]);

  useEffect(() => {
    if (!showExportMenu) return;
    const h = e => {
      if (dropMenuRef.current && !dropMenuRef.current.contains(e.target) &&
          exportBtnRef.current && !exportBtnRef.current.contains(e.target))
        setShowExportMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showExportMenu]);

  /* â”€â”€ Selection â”€â”€ */
  const toggleSelect = id =>
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPageSelected = billings.length>0 && billings.every(b=>selected.has(b.id));
  const someOnPageSelected = billings.some(b=>selected.has(b.id)) && !allOnPageSelected;
  const toggleSelectAll = () => {
    if (allOnPageSelected) setSelected(prev => { const n=new Set(prev); billings.forEach(b=>n.delete(b.id)); return n; });
    else setSelected(prev => { const n=new Set(prev); billings.forEach(b=>n.add(b.id)); return n; });
  };

  /* â”€â”€ Delete â”€â”€ */
  const handleDelete = async () => {
    const ids = selected.size > 0 ? [...selected] : [delTarget];
    setDeleting(true);
    try {
      await Promise.all(ids.map(id => billingService.deleteBilling(id)));
      clearPageCache('billings');
      toast.success('Deleted', `${ids.length} record${ids.length>1?'s':''} deleted.`);
      setShowDel(false); setDelTarget(null); setSelected(new Set()); fetchBillings();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete.'); setShowDel(false);
    } finally { setDeleting(false); }
  };

  const firePrintToast = () => { setFlashPrint(true); setTimeout(()=>setFlashPrint(false), 900); };

  /* â”€â”€ Export â”€â”€ */
  const resolveExportData = async () => {
    if (selected.size > 0) return billings.filter(b=>selected.has(b.id));
    try {
      const params = { page_size: 99999 };
      if (deb) params.search = deb;
      if (dateMode === 'specific') {
        if (dateExact) params.date = dateExact;
      } else {
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo)   params.date_to   = dateTo;
      }
      const data = await billingService.getBillings(params);
      return data.results ?? (Array.isArray(data)?data:billings);
    } catch { return billings; }
  };

  const handleExportCsv = async () => {
    setShowExportMenu(false);
    const data = await resolveExportData();
    if (!data.length) { setError('No records to export.'); return; }
    const headers = ['S.No','Sale No','Customer Code','Customer Name','Items','Sub Total','Discount','GST','Grand Total','Pts Earned','Created By','Created On'];
    const rows = data.map((b,idx) => [
      idx+1, b.BillNo||b.id, b.CustomerCode||'', b.CustomerName||'',
      b.ItemCount||0,
      parseFloat(b.SubTotal||0).toFixed(2), parseFloat(b.TotalDiscount||0).toFixed(2),
      parseFloat(b.GSTAmount||0).toFixed(2), parseFloat(b.GrandTotal||0).toFixed(2),
      b.EarnedPoints, b.CreatedByUsername||'', fmt(b.CreatedOn||b.BillDate),
    ]);
    const BOM = '\uFEFF';
    const csv = BOM + [headers,...rows].map(r=>r.map(String).map(v=>`"${v.replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=`sales_${dateMode==='specific'&&dateExact?dateExact:dateFrom?`${dateFrom}_to_${dateTo||'now'}`:new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    setShowExportMenu(false);
    const data = await resolveExportData();
    if (!data.length) { setError('No records to export.'); return; }
    const dateStr = new Date().toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const totalAmt = data.reduce((s,b)=>s+parseFloat(b.GrandTotal||0),0);
    const totalPts = data.reduce((s,b)=>s+b.EarnedPoints,0);
    const dateRangeLabel = dateMode === 'specific' && dateExact
      ? `Date: ${new Date(dateExact).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}`
      : (dateFrom || dateTo)
        ? `Period: ${dateFrom ? new Date(dateFrom).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : 'â€¦'} â†’ ${dateTo ? new Date(dateTo).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : 'â€¦'}`
        : 'All dates';
    const rowsHtml = data.map((b,idx) => `<tr>
      <td class="num">${idx+1}</td>
      <td class="mono">${b.BillNo||('#'+b.id)}</td>
      <td class="bold">${b.CustomerName||''}</td>
      <td class="c">${b.ItemCount||0}</td>
      <td class="r">${fmtAmt(b.GrandTotal || 0)}</td>
      <td class="c">${b.EarnedPoints}</td>
      <td>${b.CreatedByUsername||''}</td>
      <td class="c">${fmt(b.CreatedOn||b.BillDate)}</td>
    </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Sales Report</title>
<style>@page{size:A4 landscape;margin:12mm 10mm 10mm}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#1e1410}
.rpt-header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid #8A5125;padding-bottom:7px;margin-bottom:10px}
.rpt-header-left h1{font-size:18px;font-weight:800;color:#8A5125}.rpt-header-left p{font-size:9px;color:#7a6758;margin-top:3px}
.rpt-header-right{text-align:right;font-size:9px;color:#7a6758;line-height:1.7}.rpt-header-right strong{color:#4a3426}
table{width:100%;border-collapse:collapse}thead tr{background:#8A5125;color:#fff}
thead th{padding:5.5px 5px;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;text-align:left}
thead th.r{text-align:right}thead th.c{text-align:center}
tbody tr{border-bottom:1px solid #efe5da}tbody tr:nth-child(even){background:#faf6f2}
td{padding:5px;font-size:9.5px}td.num{text-align:center;color:#7a6758}td.c{text-align:center}td.r{text-align:right}
td.bold{font-weight:700}td.mono{font-family:'Courier New',monospace;font-size:9px;color:#7a5232}
.totals-row td{font-weight:800;background:#f3ece3;border-top:2px solid #8A5125}
.rpt-footer{margin-top:10px;display:flex;justify-content:space-between;font-size:8.5px;color:#a09080;border-top:1px solid #efe5da;padding-top:5px}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}thead{display:table-header-group}tbody tr{page-break-inside:avoid}}
</style></head><body>
<div class="rpt-header">
  <div class="rpt-header-left"><h1>Sales Report</h1><p>${data.length} record${data.length!==1?'s':''} &nbsp;Â·&nbsp; ${dateRangeLabel}</p></div>
  <div class="rpt-header-right"><div><strong>Exported:</strong> ${dateStr}</div></div>
</div>
<table><thead><tr>
  <th class="c">S.No</th><th>Bill No</th><th>Customer</th><th class="c">Items</th>
  <th class="r">Grand Total</th><th class="c">Points</th><th>Created By</th><th class="c">Date</th>
</tr></thead>
<tbody>${rowsHtml}
<tr class="totals-row"><td colspan="4" class="r">Totals</td><td class="r">${fmtAmt(totalAmt)}</td><td class="c">${totalPts}</td><td colspan="2"></td></tr>
</tbody></table>
<div class="rpt-footer"><span>POS Billing System â€” Sales Report</span><span>Printed: ${dateStr}</span></div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`;
    const w = window.open('','_blank','width=1200,height=800');
    if (!w) { setError('Pop-up blocked. Please allow pop-ups.'); return; }
    w.document.write(html); w.document.close();
  };

  const buildPages = () => {
    if (totalPages<=7) return Array.from({length:totalPages},(_,i)=>i+1);
    const pages=[];
    if (page<=4) pages.push(1,2,3,4,5,'â€¦',totalPages);
    else if (page>=totalPages-3) pages.push(1,'â€¦',totalPages-4,totalPages-3,totalPages-2,totalPages-1,totalPages);
    else pages.push(1,'â€¦',page-1,page,page+1,'â€¦',totalPages);
    return pages;
  };

  return (
    <Layout>
      <FlashToast show={flashPrint}/>
      {invoiceBill && <InvoiceModal bill={invoiceBill} onClose={()=>setInvoiceBill(null)} onPrinted={firePrintToast} companyName={companyName}/>}
      {viewMore && <ViewMoreModal bill={viewMore} onClose={()=>setViewMore(null)} onOpenInvoice={b=>{setViewMore(null);openInvoice(b);}}/>}

      {/* Page header */}
      <div className="page-header animate-in">
        <div>
          <h2 style={{fontFamily:'var(--font-heading)',fontWeight:800,color:'var(--primary)'}}>Sales Report</h2>
          <p className="page-header-sub">
            {total>0 ? `${total} sales record${total!==1?'s':''}` : 'Manage sales records and invoices'}
          </p>
        </div>
        <div className="d-flex gap-2 align-center list-header-actions">
          <div className="input-group list-header-search">
            <span className="input-group-text"><SearchIcon/></span>
            <input type="text" className="form-control"
              placeholder="Search sales..."
              value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={dateMode === 'specific'}
            onClick={() => {
              setDateMode(m => m === 'period' ? 'specific' : 'period');
              setPage(1); setDateFrom(''); setDateTo(''); setDateExact('');
            }}
            className="date-mode-switch"
            title="Toggle Period or Specific date">
            <span className={`date-mode-option${dateMode === 'period' ? ' active' : ''}`}>Period</span>
            <span className={`date-mode-option${dateMode === 'specific' ? ' active' : ''}`}>Specific</span>
          </button>
          {dateMode === 'period' ? (
            <>
              <input type="date" className="form-control form-control-sm"
                value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPage(1);}}
                title="From date"
                style={{width:126,fontSize:'.76rem',height:30}}/>
              <input type="date" className="form-control form-control-sm"
                value={dateTo} onChange={e=>{setDateTo(e.target.value);setPage(1);}}
                title="To date"
                style={{width:126,fontSize:'.76rem',height:30}}/>
            </>
          ) : (
            <input type="date" className="form-control form-control-sm"
              value={dateExact} onChange={e=>{setDateExact(e.target.value);setPage(1);}}
              title="Specific date"
              style={{width:132,fontSize:'.76rem',height:30}}/>
          )}
          {(dateFrom || dateTo || dateExact) && (
            <button className="btn btn-outline-secondary btn-sm"
              onClick={()=>{setDateFrom('');setDateTo('');setDateExact('');setPage(1);}}
              title="Clear date filter">Clear</button>
          )}
          <div style={{position:'relative'}}>
            <button ref={exportBtnRef} className="btn btn-outline-secondary btn-sm"
              onMouseDown={e=>e.stopPropagation()} onClick={()=>setShowExportMenu(v=>!v)}>
              <FileDown size={14}/> Export
            </button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={()=>navigate('/billing/new')}>
            New Sale
          </button>
        </div>
        {showExportMenu && createPortal(
          <div ref={dropMenuRef} style={{position:'fixed',top:dropPos.top,right:dropPos.right,minWidth:190,background:'var(--card-bg)',border:'1.5px solid var(--primary)',borderRadius:10,boxShadow:'0 8px 28px rgba(0,0,0,.14)',zIndex:9999,overflow:'hidden',animation:'fadeIn .12s ease-out'}}>
            {[{icon:<FileSpreadsheet size={16}/>,label:'Export Excel',fn:handleExportCsv},{icon:<FileText size={16}/>,label:'Export PDF',fn:handleExportPDF}].map((item,i) => (
              <div key={item.label}>
                {i>0&&<div style={{height:1,background:'var(--divider)',margin:'0 .75rem'}}/>}
                <button style={{display:'flex',alignItems:'center',gap:'.65rem',width:'100%',padding:'.75rem 1.1rem',background:'none',border:'none',cursor:'pointer',fontSize:'.88rem',fontWeight:700,color:'var(--text-primary)',textAlign:'left',transition:'background .12s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--scale-50)'}
                  onMouseLeave={e=>e.currentTarget.style.background='none'}
                  onClick={item.fn}>
                  {item.icon} {item.label}
                </button>
              </div>
            ))}
          </div>, document.body
        )}
      </div>

      {error && (
        <div className="alert alert-warning animate-in" style={{marginBottom:'1rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'.75rem'}}>
          <span>{error}</span>
          <div style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
            <button className="btn btn-outline-secondary btn-sm" onClick={fetchBillings}>Retry</button>
            <button className="btn btn-outline-secondary btn-sm" onClick={()=>setError('')}>Close</button>
          </div>
        </div>
      )}

      <div className="card animate-in animate-in-1 sales-report-container">
        <div className="card-body sales-report-body">
          <div className="list-toolbar" style={{display:'none'}}>
            <div className="input-group" style={{flex:'0 0 auto',maxWidth:240}}>
              <span className="input-group-text"><SearchIcon/></span>
              <input type="text" className="form-control"
                placeholder="Search sale, customerâ€¦"
                value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>

            {/* â”€â”€ Date filter: mode toggle + inputs â”€â”€ */}
            <div style={{display:'flex',alignItems:'center',gap:'.4rem',flexShrink:0,flexWrap:'wrap'}}>
              <button
                type="button"
                role="switch"
                aria-checked={dateMode === 'specific'}
                onClick={() => {
                  setDateMode(m => m === 'period' ? 'specific' : 'period');
                  setPage(1); setDateFrom(''); setDateTo(''); setDateExact('');
                }}
                className="date-mode-switch"
                title="Toggle Period or Specific date">
                <span className={`date-mode-option${dateMode === 'period' ? ' active' : ''}`}>Period</span>
                <span className={`date-mode-option${dateMode === 'specific' ? ' active' : ''}`}>Specific</span>
              </button>
              {dateMode === 'period' ? (
                <>
                  <input type="date" className="form-control form-control-sm"
                    value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPage(1);}}
                    title="From date"
                    style={{width:138,fontSize:'.8rem',height:32}}/>
                  <span style={{color:'var(--text-muted)',fontSize:'.75rem',flexShrink:0}}>â†’</span>
                  <input type="date" className="form-control form-control-sm"
                    value={dateTo} onChange={e=>{setDateTo(e.target.value);setPage(1);}}
                    title="To date"
                    style={{width:138,fontSize:'.8rem',height:32}}/>
                </>
              ) : (
                <input type="date" className="form-control form-control-sm"
                  value={dateExact} onChange={e=>{setDateExact(e.target.value);setPage(1);}}
                  title="Specific date"
                  style={{width:148,fontSize:'.8rem',height:32}}/>
              )}

              {/* Clear button â€” shown when any date filter is active */}
              {(dateFrom || dateTo || dateExact) && (
                <button className="btn btn-outline-secondary btn-sm"
                  onClick={()=>{setDateFrom('');setDateTo('');setDateExact('');setPage(1);}}
                  title="Clear date filter"
                  style={{padding:'0 .5rem',height:32,fontSize:'.76rem',flexShrink:0}}>
                  âœ• Clear
                </button>
              )}
            </div>

          </div>

          <>
              <SplitTable
                className="table table-compact sales-report-table data-table"
                tableProps={{ style: { tableLayout: 'fixed' } }}
                tableRef={tableRef}
                empty={billings.length===0}
                head={(
                    <tr style={{background:'#8A5125'}}>
                      <th style={{width:46,fontWeight:800,color:'#fff',background:'#8A5125',textAlign:'center'}}>S.No</th>
                      <th style={{fontWeight:800,color:'#fff',background:'#8A5125',textAlign:'left'}}>Particular</th>
                      <th style={{width:150,fontWeight:800,color:'#fff',background:'#8A5125',textAlign:'center'}}>Voucher No</th>
                      <th style={{width:150,fontWeight:800,color:'#fff',background:'#8A5125',textAlign:'right'}}>Amount</th>
                    </tr>
                )}
              >
                    {billings.length===0 ? (
                      <tr><td colSpan={4} style={{padding:'3rem',textAlign:'center',color:'var(--text-muted)'}}>
                        <div style={{fontSize:'2rem',marginBottom:'.5rem'}}>ðŸ§¾</div>
                        {deb?`No sales records matching "${deb}"`
                          :(dateMode==='specific'&&dateExact)?`No records on ${new Date(dateExact).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}.`
                          :(dateFrom||dateTo)?`No sales records in the selected date range.`
                          :'No sales records yet. Create your first sale.'}
                      </td></tr>
                    ) : <>
                    {billings.map((b,idx) => {
                      const grandTotal = b.GrandTotal ?? b.Amount;
                      return (
                        <tr key={b.id}
                          className={`table-row-hover${kbRow===idx?' row-keyboard-selected':''}`}
                          style={{position:'relative',cursor:'pointer'}}
                          aria-selected={kbRow===idx}
                          onMouseEnter={() => { setHoveredBillId(b.id); setKbRow(idx); setDismissedActionBillId(null); }}
                          onMouseLeave={() => setHoveredBillId(prev => prev === b.id ? null : prev)}
                          onClick={() => setKbRow(idx)}>
                          <td style={{color:'var(--text-muted)',fontSize:'.76rem',fontVariantNumeric:'tabular-nums',textAlign:'center'}}>
                            {(page-1)*PAGE_SIZE+idx+1}
                          </td>
                          <td className="sales-report-particular">
                            <div style={{fontWeight:700,color:'var(--text-primary)',fontSize:'.83rem'}}>{b.CustomerName}</div>
                            {b.CustomerCode&&<div style={{fontSize:'.7rem',color:'var(--text-muted)'}}>{b.CustomerCode}</div>}
                          </td>
                          <td style={{textAlign:'center'}}>
                            <code style={{fontSize:'.75rem',background:'var(--bg-soft)',padding:'2px 6px',borderRadius:4,fontWeight:700,color:'var(--primary-dark)'}}>
                              {b.BillNo||`#${b.id}`}
                            </code>
                          </td>
                          <td className="row-action-anchor sales-report-amount" style={{textAlign:'right',fontWeight:700,fontSize:'.83rem',color:'var(--primary-dark)',fontVariantNumeric:'tabular-nums'}}>
                            {fmtAmt(grandTotal)}
                            <RowActionPopup
                              visible={selected.size < 2 && (hoveredBillId === b.id || kbRow === idx) && dismissedActionBillId !== b.id}
                              onDismiss={() => { setDismissedActionBillId(hoveredBillId ?? b.id); setHoveredBillId(null); }}
                              actions={[
                                { type:'view', title:'View More', onClick:() => openViewMore(b) },
                                isAdmin && { type:'delete', title:'Delete', variant:'danger', onClick:() => { setSelected(new Set()); setDelTarget(b.id); setShowDel(true); } },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })}
                    </>}
              </SplitTable>

              <div className="sales-report-fixed-total" aria-label="Sales report total amount">
                <span>Total Amount:</span>
                <strong>{fmtAmt(visibleSalesTotal)}</strong>
              </div>

              <div className="table-pagination-footer">
                <div className="product-record-info">
                  Showing {billings.length ? ((page - 1) * PAGE_SIZE) + 1 : 0}-{Math.min(page * PAGE_SIZE, total)} of {total} records
                </div>
                <div className="pagination" style={{marginTop:0}}>
                  <button className="pg-item" disabled={page===1} onClick={() => setPage(p=>p-1)}>Previous</button>
                  {total > 0 && buildPages().map((n,i) =>
                    n==='...' || n==='â€¦'
                      ? <span key={`e${i}`} className="pg-item" style={{border:'none',cursor:'default',color:'var(--text-muted)'}}>...</span>
                      : <button key={n} className={`pg-item${page===n?' active':''}`} onClick={() => setPage(n)}>{n}</button>
                  )}
                  <button className="pg-item" disabled={page===totalPages || total===0} onClick={() => setPage(p=>p+1)}>Next</button>
                </div>
              </div>
          </>
        </div>
      </div>

      <ConfirmModal
        show={showDel}
        title="Delete Sales Record"
        message={selected.size>1
          ? `Delete ${selected.size} selected sales records? Earned points will be rolled back. This cannot be undone.`
          : 'Delete this sales record? Earned reward points will be rolled back. This cannot be undone.'}
        onConfirm={handleDelete}
        onCancel={()=>{setShowDel(false);setDelTarget(null);}}
        confirmVariant="danger"
        confirmText={deleting?'Deletingâ€¦':'Delete'}
        cancelText="Cancel"
      />
    </Layout>
  );
};

export default BillingList;







