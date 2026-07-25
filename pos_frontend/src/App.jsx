import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { CompanyProvider } from './context/CompanyContext';
import ProtectedRoute from './components/ProtectedRoute';
import GlobalTextFieldShortcuts from './components/GlobalTextFieldShortcuts';
import AppRouteHistory from './components/AppRouteHistory';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProductList from './pages/products/ProductList';
import ProductForm from './pages/products/ProductForm';
import ProductPriceList from './pages/products/ProductPriceList';
import ProductGroupList from './pages/products/ProductGroupList';
import ProductGroupForm from './pages/products/ProductGroupForm';
import CustomerList from './pages/customers/CustomerList';
import CustomerForm from './pages/customers/CustomerForm';
import BillingList from './pages/billing/BillingList';
import BillingForm from './pages/billing/BillingForm';
import BarcodeGenerator from './pages/barcode/BarcodeGenerator';
import Settings from './pages/Settings';

const P      = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;
const Admin  = ({ children }) => <ProtectedRoute adminOnly>{children}</ProtectedRoute>;

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <CompanyProvider>
        <GlobalTextFieldShortcuts />
        <Router>
          <AppRouteHistory />
          <Routes>
            {/* Public routes */}
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes */}
            <Route path="/dashboard" element={<P><Dashboard /></P>} />

            {/* Products — static paths MUST come before :id */}
            <Route path="/products"              element={<P><ProductList /></P>} />
            <Route path="/products/prices"       element={<Admin><ProductPriceList /></Admin>} />
            <Route path="/products/groups"       element={<P><ProductGroupList /></P>} />
            <Route path="/products/groups/new"   element={<P><ProductGroupForm /></P>} />
            <Route path="/products/groups/:id"   element={<P><ProductGroupForm /></P>} />
            <Route path="/products/new"          element={<P><ProductForm /></P>} />
            <Route path="/products/:id"          element={<P><ProductForm /></P>} />

            {/* Customers */}
            <Route path="/customers"     element={<P><CustomerList /></P>} />
            <Route path="/customers/new" element={<P><CustomerForm /></P>} />
            <Route path="/customers/:id" element={<P><CustomerForm /></P>} />

            {/* Billing — Sales Form (/billing/new) + Sales Report (/billing) */}
            <Route path="/billing"        element={<P><BillingList /></P>} />
            <Route path="/billing/new"    element={<P><BillingForm /></P>} />
            <Route path="/billing/:id"    element={<P><BillingForm /></P>} />

            {/* Barcode Generator */}
            <Route path="/barcode-generator" element={<P><BarcodeGenerator /></P>} />

            {/* Settings / Profile */}
            <Route path="/settings" element={<P><Settings /></P>} />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
        </CompanyProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
