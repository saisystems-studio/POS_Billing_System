/**
 * Customer service for Ba_db Business Management System
 */
import api from './api';

const notifyCustomersChanged = () => {
  window.dispatchEvent(new Event('pos-customers-changed'));
};

const customerService = {
  /**
   * Get the CustomerCode that will be assigned to the next new customer.
   * Used to pre-fill the read-only code field when the Add form opens.
   */
  getNextCode: async () => {
    const response = await api.get('/customers/next-code/');
    return response.data.next_code; // e.g. "CUS_042"
  },

  /**
   * Get paginated list of customers
   */
  getCustomers: async (params = {}) => {
    const response = await api.get('/customers/', { params });
    return response.data;
  },

  /**
   * Get single customer by ID
   */
  getCustomer: async (id) => {
    const response = await api.get(`/customers/${id}/`);
    return response.data;
  },

  createCustomer: async (data) => {
    const response = await api.post('/customers/', data);
    notifyCustomersChanged();
    return response.data;
  },

  /**
   * Update customer (Admin only)
   */
  updateCustomer: async (id, data) => {
    const response = await api.put(`/customers/${id}/`, data);
    notifyCustomersChanged();
    return response.data;
  },

  /**
   * Partial update customer (Admin only)
   */
  patchCustomer: async (id, data) => {
    const response = await api.patch(`/customers/${id}/`, data);
    notifyCustomersChanged();
    return response.data;
  },

  /**
   * Delete customer (Admin only)
   */
  deleteCustomer: async (id) => {
    const response = await api.delete(`/customers/${id}/`);
    notifyCustomersChanged();
    return response.data;
  },
};

export default customerService;
