import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Tenant, TenantStatus, CreateTenantData } from '@/shared/types/tenant';
import { usePermission } from '@/shared/hooks/usePermission';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Plus, Edit3, Trash2, Shield, Users, Search, X, AlertTriangle } from 'lucide-react';

interface TenantWithUserCount extends Tenant {
  userCount: number;
}

interface TenantFormData {
  name: string;
  slug: string;
  status: TenantStatus;
  maxUsers: number;
  timezone: string;
  currency: string;
}

const TenantManagementPage: React.FC = () => {
  const { isSuperAdmin } = usePermission();
  const [tenants, setTenants] = useState<TenantWithUserCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantWithUserCount | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<TenantWithUserCount | null>(null);
  const [formData, setFormData] = useState<TenantFormData>({
    name: '',
    slug: '',
    status: 'active',
    maxUsers: 10,
    timezone: 'Europe/Istanbul',
    currency: 'TRY',
  });

  // Fetch tenants with user counts
  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const tenantsQuery = query(collection(db, 'tenants'), orderBy('name'));
      const tenantsSnapshot = await getDocs(tenantsQuery);

      const tenantsWithCounts = await Promise.all(
        tenantsSnapshot.docs.map(async (tenantDoc) => {
          const tenantData = { id: tenantDoc.id, ...tenantDoc.data() } as Tenant;

          // Get user count for this tenant
          const usersQuery = query(
            collection(db, 'users'),
            where('tenantId', '==', tenantDoc.id)
          );
          const usersSnapshot = await getDocs(usersQuery);

          return {
            ...tenantData,
            userCount: usersSnapshot.size,
          };
        })
      );

      setTenants(tenantsWithCounts);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchTenants();
    } else {
      setLoading(false);
    }
  }, [isSuperAdmin, fetchTenants]);

  // Generate slug from name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  };

  // Handle form input changes
  const handleInputChange = (field: keyof TenantFormData, value: string | number) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Auto-generate slug when name changes
      if (field === 'name' && typeof value === 'string') {
        updated.slug = generateSlug(value);
      }

      return updated;
    });
  };

  // Open create modal
  const handleCreate = () => {
    setEditingTenant(null);
    setFormData({
      name: '',
      slug: '',
      status: 'active',
      maxUsers: 10,
      timezone: 'Europe/Istanbul',
      currency: 'TRY',
    });
    setShowModal(true);
  };

  // Open edit modal
  const handleEdit = (tenant: TenantWithUserCount) => {
    setEditingTenant(tenant);
    setFormData({
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      maxUsers: tenant.maxUsers || 10,
      timezone: tenant.timezone || 'Europe/Istanbul',
      currency: tenant.currency || 'TRY',
    });
    setShowModal(true);
  };

  // Save tenant (create or update)
  const handleSave = async () => {
    if (!formData.name.trim() || !formData.slug.trim()) {
      alert('Lütfen gerekli alanları doldurun');
      return;
    }

    try {
      if (editingTenant) {
        // Update existing tenant
        const tenantRef = doc(db, 'tenants', editingTenant.id);
        await updateDoc(tenantRef, {
          name: formData.name,
          slug: formData.slug,
          status: formData.status,
          maxUsers: formData.maxUsers,
          timezone: formData.timezone,
          currency: formData.currency,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new tenant
        const newTenantRef = doc(collection(db, 'tenants'));
        const createData: CreateTenantData = {
          name: formData.name,
          slug: formData.slug,
          status: formData.status,
          maxUsers: formData.maxUsers,
          timezone: formData.timezone,
          currency: formData.currency,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(newTenantRef, createData);
      }

      setShowModal(false);
      fetchTenants();
    } catch (error) {
      console.error('Error saving tenant:', error);
      alert('Tenant kaydedilirken bir hata oluştu');
    }
  };

  // Toggle tenant status (suspend/activate)
  const handleToggleStatus = async (tenant: TenantWithUserCount) => {
    const newStatus: TenantStatus = tenant.status === 'suspended' ? 'active' : 'suspended';

    try {
      const tenantRef = doc(db, 'tenants', tenant.id);
      await updateDoc(tenantRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      fetchTenants();
    } catch (error) {
      console.error('Error toggling tenant status:', error);
      alert('Durum güncellenirken bir hata oluştu');
    }
  };

  // Open delete confirmation
  const handleDeleteClick = (tenant: TenantWithUserCount) => {
    setDeletingTenant(tenant);
    setShowDeleteConfirm(true);
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (!deletingTenant) return;

    try {
      await deleteDoc(doc(db, 'tenants', deletingTenant.id));
      setShowDeleteConfirm(false);
      setDeletingTenant(null);
      fetchTenants();
    } catch (error) {
      console.error('Error deleting tenant:', error);
      alert('Tenant silinirken bir hata oluştu');
    }
  };

  // Filter tenants by search term
  const filteredTenants = tenants.filter((tenant) =>
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate stats
  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => t.status === 'active').length,
    trial: tenants.filter((t) => t.status === 'trial').length,
    suspended: tenants.filter((t) => t.status === 'suspended').length,
  };

  // Get status badge styles
  const getStatusBadge = (status: TenantStatus) => {
    const styles = {
      active: 'bg-green-100 text-green-800 border-green-200',
      trial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      suspended: 'bg-red-100 text-red-800 border-red-200',
    };

    const labels = {
      active: 'Aktif',
      trial: 'Deneme',
      suspended: 'Askıya Alındı',
    };

    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  // Show unauthorized message for non-super-admins
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 font-commons">Yetkisiz Erişim</h2>
          <p className="text-gray-600 font-commons">
            Bu sayfaya erişim için süper admin yetkisine sahip olmalısınız.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 font-commons flex items-center gap-3">
              <Building2 className="w-8 h-8 text-indigo-600" />
              Tenant Yönetimi
            </h1>
            <p className="mt-1 text-sm text-gray-600 font-commons">
              Tüm tenant hesaplarını yönetin ve izleyin
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons font-medium shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Yeni Tenant
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 font-commons">Toplam</p>
                <p className="text-3xl font-bold text-gray-900 font-commons mt-1">{stats.total}</p>
              </div>
              <Building2 className="w-10 h-10 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 font-commons">Aktif</p>
                <p className="text-3xl font-bold text-green-600 font-commons mt-1">{stats.active}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 font-commons">Deneme</p>
                <p className="text-3xl font-bold text-yellow-600 font-commons mt-1">{stats.trial}</p>
              </div>
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 font-commons">Askıda</p>
                <p className="text-3xl font-bold text-red-600 font-commons mt-1">{stats.suspended}</p>
              </div>
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Tenant ara (isim veya slug)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-commons"
            />
          </div>
        </div>

        {/* Tenant List */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-commons">
                      Tenant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-commons">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-commons">
                      Kullanıcılar
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-commons">
                      Oluşturulma
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-commons">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-commons">
                        {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz tenant bulunmuyor'}
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                              <Building2 className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 font-commons">
                                {tenant.name}
                              </div>
                              <div className="text-sm text-gray-500 font-commons">
                                {tenant.slug}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(tenant.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm text-gray-900 font-commons">
                            <Users className="w-4 h-4 text-gray-400" />
                            {tenant.userCount} / {tenant.maxUsers || 10}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-commons">
                          {tenant.createdAt
                            ? new Date(tenant.createdAt.seconds * 1000).toLocaleDateString('tr-TR')
                            : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(tenant)}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Düzenle"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(tenant)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors font-commons ${
                                tenant.status === 'suspended'
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                              }`}
                            >
                              {tenant.status === 'suspended' ? 'Aktifleştir' : 'Askıya Al'}
                            </button>
                            <button
                              onClick={() => handleDeleteClick(tenant)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 font-commons">
                    {editingTenant ? 'Tenant Düzenle' : 'Yeni Tenant Oluştur'}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-commons">
                    İsim <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-commons"
                    placeholder="Şirket Adı"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-commons">
                    Slug <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => handleInputChange('slug', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-commons"
                    placeholder="sirket-adi"
                  />
                  <p className="mt-1 text-xs text-gray-500 font-commons">
                    URL'de kullanılacak benzersiz tanımlayıcı
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-commons">
                    Durum
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-commons"
                  >
                    <option value="active">Aktif</option>
                    <option value="trial">Deneme</option>
                    <option value="suspended">Askıya Alındı</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-commons">
                    Maksimum Kullanıcı Sayısı
                  </label>
                  <input
                    type="number"
                    value={formData.maxUsers}
                    onChange={(e) => handleInputChange('maxUsers', parseInt(e.target.value) || 0)}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-commons"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-commons">
                    Zaman Dilimi
                  </label>
                  <input
                    type="text"
                    value={formData.timezone}
                    onChange={(e) => handleInputChange('timezone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-commons"
                    placeholder="Europe/Istanbul"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-commons">
                    Para Birimi
                  </label>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => handleInputChange('currency', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-commons"
                    placeholder="TRY"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-commons font-medium"
                >
                  İptal
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons font-medium"
                >
                  {editingTenant ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && deletingTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full"
            >
              <div className="p-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 text-center mb-2 font-commons">
                  Tenant Silinecek
                </h2>
                <p className="text-gray-600 text-center mb-4 font-commons">
                  <strong>{deletingTenant.name}</strong> adlı tenant'ı silmek istediğinizden emin misiniz?
                  Bu işlem geri alınamaz.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeletingTenant(null);
                    }}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-commons font-medium"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-commons font-medium"
                  >
                    Evet, Sil
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TenantManagementPage;
