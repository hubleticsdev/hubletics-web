'use client';

import { useState } from 'react';
import { updateUserPlatformFee } from '@/actions/admin/update-platform-fee';
import { toast } from 'sonner';

type PlatformFeeEditorProps = {
  userId: string;
  currentFee: number;
  userRole: string;
};

export function PlatformFeeEditor({ userId, currentFee, userRole }: PlatformFeeEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fee, setFee] = useState(currentFee.toString());
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const feeValue = parseFloat(fee);

    if (isNaN(feeValue) || feeValue < 0 || feeValue > 100) {
      toast.error('Platform fee must be between 0% and 100%');
      return;
    }

    setIsSaving(true);
    const result = await updateUserPlatformFee(userId, feeValue);
    setIsSaving(false);

    if (result.success) {
      toast.success('Platform fee updated successfully');
      setIsEditing(false);
    } else {
      toast.error(result.error || 'Failed to update platform fee');
      setFee(currentFee.toString()); // Reset to original value
    }
  };

  const handleCancel = () => {
    setFee(currentFee.toString());
    setIsEditing(false);
  };

  // Only show for coaches (platform fee only applies to coaches)
  if (userRole !== 'coach') {
    return <span className="text-xs text-gray-400">N/A</span>;
  }

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="group flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors"
      >
        <span className="font-medium">{currentFee}%</span>
        <svg
          className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <input
          type="number"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          min="0"
          max="100"
          step="0.01"
          disabled={isSaving}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSave();
            } else if (e.key === 'Escape') {
              handleCancel();
            }
          }}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
      </div>
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
        title="Save"
      >
        {isSaving ? (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-600 border-t-transparent"></div>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <button
        onClick={handleCancel}
        disabled={isSaving}
        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
        title="Cancel"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
