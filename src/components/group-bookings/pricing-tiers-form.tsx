'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { updatePricingTiers } from '@/actions/group-bookings/pricing-tiers';
import { toast } from 'sonner';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';

interface PricingTier {
  minParticipants: number;
  maxParticipants: number | null;
  pricePerPerson: string;
}

interface PricingTiersFormProps {
  initialTiers: Array<{
    minParticipants: number;
    maxParticipants: number | null;
    pricePerPerson: string;
  }>;
}

export function PricingTiersForm({ initialTiers }: PricingTiersFormProps) {
  const [mode, setMode] = useState<'quick' | 'custom'>(initialTiers.length > 0 ? 'custom' : 'quick');
  const [tiers, setTiers] = useState<PricingTier[]>(
    initialTiers.length > 0
      ? initialTiers.map(t => ({ ...t, pricePerPerson: t.pricePerPerson }))
      : [
          { minParticipants: 2, maxParticipants: 2, pricePerPerson: '' },
          { minParticipants: 3, maxParticipants: 3, pricePerPerson: '' },
          { minParticipants: 4, maxParticipants: 4, pricePerPerson: '' },
          { minParticipants: 5, maxParticipants: null, pricePerPerson: '' }, // 5+
        ]
  );
  const [saving, setSaving] = useState(false);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<'quick' | 'custom' | null>(null);

  const hasFilledPrices = tiers.some(t => t.pricePerPerson !== '');

  const requestModeSwitch = (newMode: 'quick' | 'custom') => {
    if (newMode === mode) return;
    
    if (!hasFilledPrices) {
      confirmModeSwitch(newMode);
      return;
    }
    
    setPendingMode(newMode);
    setSwitchDialogOpen(true);
  };

  const confirmModeSwitch = (newMode: 'quick' | 'custom') => {
    if (newMode === 'quick') {
      setTiers([
        { minParticipants: 2, maxParticipants: 2, pricePerPerson: '' },
        { minParticipants: 3, maxParticipants: 3, pricePerPerson: '' },
        { minParticipants: 4, maxParticipants: 4, pricePerPerson: '' },
        { minParticipants: 5, maxParticipants: null, pricePerPerson: '' },
      ]);
    } else {
      setTiers([{ minParticipants: 2, maxParticipants: 4, pricePerPerson: '' }]);
    }
    setMode(newMode);
    setSwitchDialogOpen(false);
    setPendingMode(null);
  };

  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    const newMin = lastTier.maxParticipants ? lastTier.maxParticipants + 1 : lastTier.minParticipants + 1;
    setTiers([...tiers, { minParticipants: newMin, maxParticipants: newMin + 2, pricePerPerson: '' }]);
  };

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof PricingTier, value: any) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setTiers(newTiers);
  };

  const handleSave = async () => {
    // Validate
    for (const tier of tiers) {
      if (!tier.pricePerPerson || parseFloat(tier.pricePerPerson) <= 0) {
        toast.error('All tiers must have a valid price');
        return;
      }
    }

    setSaving(true);
    const result = await updatePricingTiers(
      tiers.map(t => ({
        minParticipants: t.minParticipants,
        maxParticipants: t.maxParticipants,
        pricePerPerson: parseFloat(t.pricePerPerson),
      }))
    );

    setSaving(false);

    if (result.success) {
      toast.success('Pricing tiers saved successfully!');
    } else {
      toast.error(result.error || 'Failed to save pricing tiers');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <div className="flex gap-4">
          <Button
            type="button"
            variant={mode === 'quick' ? 'default' : 'outline'}
            onClick={() => requestModeSwitch('quick')}
          >
            Quick Setup (2, 3, 4, 5+)
          </Button>
          <Button
            type="button"
            variant={mode === 'custom' ? 'default' : 'outline'}
            onClick={() => requestModeSwitch('custom')}
          >
            Custom Ranges
          </Button>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          {mode === 'quick'
            ? 'Set a fixed price for 2, 3, 4, and 5+ participants'
            : 'Create custom participant ranges with different pricing'}
        </p>
        <div className="mt-3 flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-800">
            <strong>Important:</strong> Pricing tiers must not overlap. Each participant count should belong to only one tier.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg font-medium text-sm text-gray-700">
          <div className="col-span-5">Number of Participants</div>
          <div className="col-span-5">Price per Person</div>
          <div className="col-span-2"></div>
        </div>

        {tiers.map((tier, index) => (
          <div key={index} className="grid grid-cols-12 gap-4 items-center">
            {mode === 'quick' ? (
              <div className="col-span-5 flex items-center gap-2">
                <input
                  type="number"
                  value={tier.minParticipants}
                  disabled
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                />
                {tier.maxParticipants === null ? (
                  <span className="text-gray-700">+</span>
                ) : (
                  <>
                    <span className="text-gray-700">people</span>
                  </>
                )}
              </div>
            ) : (
              <div className="col-span-5 flex items-center gap-2">
                <input
                  type="number"
                  value={tier.minParticipants}
                  onChange={(e) => updateTier(index, 'minParticipants', parseInt(e.target.value) || 2)}
                  min="2"
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
                />
                <span className="text-gray-700">-</span>
                <input
                  type="number"
                  value={tier.maxParticipants || ''}
                  onChange={(e) =>
                    updateTier(index, 'maxParticipants', e.target.value ? parseInt(e.target.value) : null)
                  }
                  placeholder="∞"
                  min={tier.minParticipants}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
                />
              </div>
            )}

            <div className="col-span-5">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={tier.pricePerPerson}
                  onChange={(e) => updateTier(index, 'pricePerPerson', e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
                />
              </div>
            </div>

            <div className="col-span-2 flex justify-end">
              {mode === 'custom' && tiers.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTier(index)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {mode === 'custom' && (
          <Button
            type="button"
            variant="outline"
            onClick={addTier}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Tier
          </Button>
        )}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-8"
          >
            {saving ? 'Saving...' : 'Save Pricing Tiers'}
          </Button>
        </div>
      </div>

      <AlertDialog open={switchDialogOpen} onOpenChange={setSwitchDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Switch Pricing Mode?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved prices in your current tiers. Switching to {pendingMode === 'quick' ? 'Quick Setup' : 'Custom Ranges'} will{' '}
              <strong>reset all your current tiers and prices</strong>.
              <br /><br />
              Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSwitchDialogOpen(false);
              setPendingMode(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingMode && confirmModeSwitch(pendingMode)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Yes, Switch Mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

