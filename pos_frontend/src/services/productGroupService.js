/**
 * Product Group service for Ba_db Business Management System
 */
import api from './api';

let groupsDropdownCache = null;
let groupsDropdownPromise = null;

const clearProductGroupCache = () => {
  groupsDropdownCache = null;
  groupsDropdownPromise = null;
};

const notifyProductGroupsChanged = () => {
  clearProductGroupCache();
  window.dispatchEvent(new Event('pos-product-groups-changed'));
};

window.addEventListener('pos-auth-cleared', clearProductGroupCache);
window.addEventListener('pos-auth-ready', clearProductGroupCache);

const productGroupService = {
  /**
   * Get paginated list of product groups
   * @param {Object} params - { page, page_size, search, ordering }
   */
  getGroups: async (params = {}) => {
    const response = await api.get('/product-groups/', { params });
    return response.data;
  },

  /**
   * Get all groups as lightweight dropdown list (no pagination)
   */
  getGroupsDropdown: async () => {
    if (groupsDropdownCache) return groupsDropdownCache;
    groupsDropdownPromise = groupsDropdownPromise || api.get('/product-groups/dropdown/');
    const response = await groupsDropdownPromise.finally(() => {
      groupsDropdownPromise = null;
    });
    groupsDropdownCache = response.data;
    return groupsDropdownCache; // plain array: [{ id, GroupName }, ...]
  },

  /**
   * Get single group by ID
   */
  getGroup: async (id) => {
    const response = await api.get(`/product-groups/${id}/`);
    return response.data;
  },

  /**
   * Create new product group (Admin + User)
   */
  createGroup: async (data) => {
    const response = await api.post('/product-groups/', data);
    notifyProductGroupsChanged();
    return response.data;
  },

  /**
   * Update group (Admin only)
   */
  updateGroup: async (id, data) => {
    const response = await api.put(`/product-groups/${id}/`, data);
    notifyProductGroupsChanged();
    return response.data;
  },

  /**
   * Partial update group (Admin only)
   */
  patchGroup: async (id, data) => {
    const response = await api.patch(`/product-groups/${id}/`, data);
    notifyProductGroupsChanged();
    return response.data;
  },

  /**
   * Delete group (Admin only)
   */
  deleteGroup: async (id) => {
    const response = await api.delete(`/product-groups/${id}/`);
    notifyProductGroupsChanged();
    return response.data;
  },
};

export default productGroupService;
