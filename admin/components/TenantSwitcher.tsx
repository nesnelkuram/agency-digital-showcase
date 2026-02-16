import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useTenantContext } from '@/contexts/TenantContext';
import { Tenant } from '@/shared/types/tenant';
import { Building2, ChevronDown, Search, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TenantSwitcher: React.FC = () => {
  const { currentTenant, userRole, switchTenant } = useTenantContext();
  const [isOpen, setIsOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Only render for super admins
  if (userRole !== 'super_admin') {
    return null;
  }

  // Fetch all tenants when dropdown opens
  useEffect(() => {
    if (isOpen && tenants.length === 0) {
      fetchTenants();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const tenantsQuery = query(
        collection(db, 'tenants'),
        orderBy('name', 'asc')
      );
      const snapshot = await getDocs(tenantsQuery);
      const tenantsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Tenant[];
      setTenants(tenantsData);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTenantSwitch = async (tenantId: string) => {
    await switchTenant(tenantId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const filteredTenants = tenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tenant.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'trial':
        return 'bg-yellow-100 text-yellow-700';
      case 'suspended':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 font-commons"
      >
        <Building2 className="w-4 h-4 text-indigo-600" />
        <span className="text-sm font-medium text-gray-700">
          {currentTenant?.name || 'Tenant Sec'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 right-0 w-80 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50 font-commons"
          >
            {/* Search Input */}
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tenants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Tenants List */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center">
                  <div className="inline-block w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-2 text-sm text-gray-500">Loading tenants...</p>
                </div>
              ) : filteredTenants.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-sm text-gray-500">No tenants found</p>
                </div>
              ) : (
                <div className="py-2">
                  {filteredTenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => handleTenantSwitch(tenant.id)}
                      className={`w-full px-4 py-3 flex items-center justify-between hover:bg-indigo-50 transition-colors duration-150 ${
                        currentTenant?.id === tenant.id ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">
                            {tenant.name}
                          </p>
                          {currentTenant?.id === tenant.id && (
                            <Check className="w-4 h-4 text-indigo-600" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {tenant.id}
                        </p>
                      </div>
                      <div>
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
                            tenant.status
                          )}`}
                        >
                          {tenant.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TenantSwitcher;
