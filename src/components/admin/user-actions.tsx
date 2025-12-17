'use client';

import { useState } from 'react';
import { updateUserStatus } from '@/actions/admin/users';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Ban, ShieldOff, CheckCircle, XCircle } from 'lucide-react';
import type { UserStatus } from '@/types/auth';

interface UserActionsProps {
  userId: string;
  currentStatus: UserStatus;
  userName: string;
  userEmail: string;
  isCurrentUser: boolean;
  isAdmin: boolean;
}

export function UserActions({
  userId,
  currentStatus,
  userName,
  userEmail,
  isCurrentUser,
  isAdmin,
}: UserActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionType, setActionType] = useState<string | null>(null);

  const handleStatusChange = async (
    newStatus: 'active' | 'suspended' | 'banned' | 'deactivated'
  ) => {
    if (isCurrentUser) {
      toast.error('Cannot modify your own status');
      return;
    }

    if (isAdmin && newStatus !== 'active') {
      toast.error('Cannot suspend or ban admin users');
      return;
    }

    setIsProcessing(true);
    setActionType(newStatus);

    const result = await updateUserStatus(userId, newStatus);

    setIsProcessing(false);
    setActionType(null);

    if (result.success) {
      toast.success(
        `User ${newStatus === 'active' ? 'activated' : newStatus === 'suspended' ? 'suspended' : newStatus === 'banned' ? 'banned' : 'deactivated'} successfully`
      );
    } else {
      toast.error(result.error || 'Failed to update user status');
    }
  };

  if (isCurrentUser) {
    return (
      <span className="text-xs text-gray-400 italic">Current user</span>
    );
  }

  if (isAdmin) {
    return (
      <span className="text-xs text-gray-400 italic">Admin user</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {currentStatus === 'active' ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleStatusChange('suspended')}
            disabled={isProcessing}
            className="border-orange-300 text-orange-600 hover:bg-orange-50"
          >
            {isProcessing && actionType === 'suspended' ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <ShieldOff className="h-3 w-3 mr-1" />
            )}
            Suspend
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleStatusChange('banned')}
            disabled={isProcessing}
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            {isProcessing && actionType === 'banned' ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Ban className="h-3 w-3 mr-1" />
            )}
            Ban
          </Button>
        </>
      ) : currentStatus === 'suspended' ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleStatusChange('active')}
            disabled={isProcessing}
            className="border-green-300 text-green-600 hover:bg-green-50"
          >
            {isProcessing && actionType === 'active' ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <CheckCircle className="h-3 w-3 mr-1" />
            )}
            Activate
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleStatusChange('banned')}
            disabled={isProcessing}
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            {isProcessing && actionType === 'banned' ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Ban className="h-3 w-3 mr-1" />
            )}
            Ban
          </Button>
        </>
      ) : currentStatus === 'banned' ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleStatusChange('active')}
          disabled={isProcessing}
          className="border-green-300 text-green-600 hover:bg-green-50"
        >
          {isProcessing && actionType === 'active' ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <CheckCircle className="h-3 w-3 mr-1" />
          )}
          Activate
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleStatusChange('active')}
          disabled={isProcessing}
          className="border-green-300 text-green-600 hover:bg-green-50"
        >
          {isProcessing && actionType === 'active' ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <CheckCircle className="h-3 w-3 mr-1" />
          )}
          Activate
        </Button>
      )}
    </div>
  );
}
