import React, { useState } from 'react';
import { Plus, Trash2, Check, X, Pencil, Flag } from 'lucide-react';
import { CostStatus, COST_STATUS_LABELS } from '@/shared/types/pricing';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'select' | 'status' | 'boolean';
  width?: string;
  options?: { value: string; label: string }[];
  editable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  // Role-based visibility (for PersonnelCostsPage)
  hideForRoles?: string[];
  showForRoles?: string[];
  // Role-based editability
  editableForRoles?: string[];
}

interface CostTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  onAdd: () => void;
  onUpdate: (id: string, field: keyof T, value: unknown) => void;
  onDelete: (id: string) => void;
  emptyRow?: Partial<T>;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

function CostTable<T extends { id: string }>({
  columns,
  data,
  onAdd,
  onUpdate,
  onDelete,
}: CostTableProps<T>) {
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleStartEdit = (id: string, field: string, currentValue: unknown) => {
    setEditingCell({ id, field });
    setEditValue(String(currentValue ?? ''));
  };

  const handleSaveEdit = (id: string, field: string, type: string) => {
    let value: unknown = editValue;

    if (type === 'number' || type === 'currency') {
      value = parseFloat(editValue.replace(/[^\d.-]/g, '')) || 0;
    } else if (type === 'boolean') {
      value = editValue === 'true';
    }

    onUpdate(id, field as keyof T, value);
    setEditingCell(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string, field: string, type: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(id, field, type);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const getValue = (row: T, key: string): unknown => {
    const keys = key.split('.');
    let value: unknown = row;
    for (const k of keys) {
      value = (value as Record<string, unknown>)?.[k];
    }
    return value;
  };

  // Check if column should be visible for this row
  const isColumnVisible = (column: Column<T>, row: T): boolean => {
    const role = getValue(row, 'role') as string | undefined;
    if (!role) return true;

    // If showForRoles is specified, only show for those roles
    if (column.showForRoles && column.showForRoles.length > 0) {
      return column.showForRoles.includes(role);
    }

    // If hideForRoles is specified, hide for those roles
    if (column.hideForRoles && column.hideForRoles.length > 0) {
      return !column.hideForRoles.includes(role);
    }

    return true;
  };

  const renderCell = (row: T, column: Column<T>) => {
    const value = getValue(row, column.key as string);
    const isEditing = editingCell?.id === row.id && editingCell?.field === column.key;

    // Check editability - consider editableForRoles if specified
    let editable = column.editable !== false;
    if (editable && column.editableForRoles && column.editableForRoles.length > 0) {
      const role = getValue(row, 'role') as string | undefined;
      editable = role ? column.editableForRoles.includes(role) : false;
    }

    if (column.render && !isEditing) {
      return column.render(value, row);
    }

    if (isEditing && editable) {
      if (column.type === 'select') {
        return (
          <div className="flex items-center gap-1 min-w-[120px]">
            <select
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 min-w-[60px] px-2 py-1 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            >
              {column.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => handleSaveEdit(row.id, column.key as string, column.type)}
              className="p-1 text-green-600 hover:bg-green-50 rounded flex-shrink-0"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-1 text-red-600 hover:bg-red-50 rounded flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      }

      if (column.type === 'status') {
        return (
          <div className="flex items-center gap-1 min-w-[120px]">
            <select
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 min-w-[60px] px-2 py-1 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            >
              <option value="real">{COST_STATUS_LABELS.real}</option>
              <option value="potential">{COST_STATUS_LABELS.potential}</option>
            </select>
            <button
              onClick={() => handleSaveEdit(row.id, column.key as string, column.type)}
              className="p-1 text-green-600 hover:bg-green-50 rounded flex-shrink-0"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-1 text-red-600 hover:bg-red-50 rounded flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      }

      if (column.type === 'boolean') {
        return (
          <div className="flex items-center gap-1 min-w-[80px]">
            <select
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 min-w-[60px] px-2 py-1 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            >
              <option value="true">Evet</option>
              <option value="false">Hayir</option>
            </select>
            <button
              onClick={() => handleSaveEdit(row.id, column.key as string, column.type)}
              className="p-1 text-green-600 hover:bg-green-50 rounded flex-shrink-0"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-1 text-red-600 hover:bg-red-50 rounded flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-1 min-w-[160px]">
          <input
            type={column.type === 'number' || column.type === 'currency' ? 'text' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, row.id, column.key as string, column.type)}
            className="flex-1 min-w-[80px] px-2 py-1 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
            autoFocus
          />
          <button
            onClick={() => handleSaveEdit(row.id, column.key as string, column.type)}
            className="p-1 text-green-600 hover:bg-green-50 rounded flex-shrink-0"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={handleCancelEdit}
            className="p-1 text-red-600 hover:bg-red-50 rounded flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }

    // Editable cell wrapper with edit icon
    const EditableWrapper = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
      <div
        onClick={onClick}
        className="group/cell flex items-center gap-1 cursor-pointer hover:bg-white/50 px-1 py-0.5 rounded -mx-1"
      >
        <span className="flex-1">{children}</span>
        <Pencil className="w-3 h-3 text-indigo-400 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
      </div>
    );

    // Display mode
    if (column.type === 'currency') {
      const content = <>{formatCurrency(value as number)} TL</>;
      if (editable) {
        return (
          <EditableWrapper onClick={() => handleStartEdit(row.id, column.key as string, value)}>
            {content}
          </EditableWrapper>
        );
      }
      return content;
    }

    if (column.type === 'status') {
      const status = value as CostStatus;
      const content = (
        <span className={`font-medium ${status === 'real' ? 'text-[#171717]' : 'text-indigo-600'}`}>
          {status === 'real' ? 'Reel' : 'Potansiyel+'}
        </span>
      );
      if (editable) {
        return (
          <EditableWrapper onClick={() => handleStartEdit(row.id, column.key as string, value)}>
            {content}
          </EditableWrapper>
        );
      }
      return content;
    }

    if (column.type === 'boolean') {
      const boolValue = value === true || value === 'true' || value === undefined; // varsayılan true
      const content = (
        <span className={`inline-flex items-center gap-1 font-medium ${boolValue ? 'text-green-600' : 'text-red-500'}`}>
          <Flag className="w-3.5 h-3.5" />
          {boolValue ? 'Evet' : 'Hayır'}
        </span>
      );
      if (editable) {
        return (
          <EditableWrapper onClick={() => handleStartEdit(row.id, column.key as string, boolValue ? 'true' : 'false')}>
            {content}
          </EditableWrapper>
        );
      }
      return content;
    }

    if (column.type === 'select' && column.options) {
      // Handle both string and boolean values for select options
      const valueStr = String(value);
      const option = column.options.find((o) => o.value === valueStr || o.value === value);
      const content = <>{option?.label ?? valueStr}</>;
      if (editable) {
        return (
          <EditableWrapper onClick={() => handleStartEdit(row.id, column.key as string, valueStr)}>
            {content}
          </EditableWrapper>
        );
      }
      return content;
    }

    const content = <>{value as string}</>;
    if (editable) {
      return (
        <EditableWrapper onClick={() => handleStartEdit(row.id, column.key as string, value)}>
          {content}
        </EditableWrapper>
      );
    }
    return content;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        {/* Header */}
        <thead>
          <tr style={{ backgroundColor: '#DDD6FE' }}>
            {columns.map((column) => (
              <th
                key={column.key as string}
                className="px-4 py-3 text-left font-commons text-sm font-semibold text-[#171717]"
                style={{ width: column.width }}
              >
                {column.label}
              </th>
            ))}
            <th className="px-4 py-3 w-12"></th>
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={row.id}
              className="border-b border-indigo-100 group"
              style={{ backgroundColor: rowIndex % 2 === 0 ? '#EDE9FE' : '#F5F3FF' }}
            >
              {columns.map((column) => (
                <td
                  key={`${row.id}-${column.key as string}`}
                  className="px-4 py-3 font-commons text-sm text-[#171717]"
                >
                  {isColumnVisible(column, row) ? renderCell(row, column) : (
                    <span className="text-neutral-300">-</span>
                  )}
                </td>
              ))}
              <td className="px-4 py-3">
                {deleteConfirm === row.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onDelete(row.id);
                        setDeleteConfirm(null);
                      }}
                      className="p-1.5 text-white bg-red-500 hover:bg-red-600 rounded"
                      title="Onayla"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="p-1.5 text-gray-600 bg-gray-200 hover:bg-gray-300 rounded"
                      title="Iptal"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(row.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}

          {/* Empty row for adding */}
          <tr style={{ backgroundColor: data.length % 2 === 0 ? '#EDE9FE' : '#F5F3FF' }}>
            {columns.map((column, colIndex) => (
              <td
                key={`empty-${column.key as string}`}
                className="px-4 py-3 font-commons text-sm text-[#171717]/30"
              >
                {colIndex === 0 ? 'Yeni ekle...' : ''}
              </td>
            ))}
            <td className="px-4 py-3">
              <button
                onClick={onAdd}
                className="p-1.5 text-white bg-indigo-500 hover:bg-indigo-600 rounded"
                title="Yeni ekle"
              >
                <Plus className="w-4 h-4" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default CostTable;
