'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createReview, type CreateReviewInput } from '@/actions/reviews/create';
import { toast } from 'sonner';
import { Star } from 'lucide-react';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  coachName: string;
  onSuccess?: () => void;
}

export function ReviewModal({ isOpen, onClose, bookingId, coachName, onSuccess }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    if (reviewText.trim().length < 10) {
      toast.error('Review must be at least 10 characters');
      return;
    }

    setSubmitting(true);

    const input: CreateReviewInput = {
      bookingId,
      rating,
      reviewText: reviewText.trim(),
    };

    const result = await createReview(input);

    if (result.success) {
      toast.success('Review submitted successfully!');
      setRating(0);
      setReviewText('');
      onSuccess?.();
      onClose();
    } else {
      toast.error(result.error || 'Failed to submit review');
    }

    setSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            Rate Your Experience with {coachName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900">
              How was your lesson? *
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                  disabled={submitting}
                >
                  <Star
                    className={`h-10 w-10 ${
                      star <= (hoverRating || rating)
                        ? 'fill-[#FF6B4A] text-[#FF6B4A]'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-gray-600">
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="reviewText" className="text-sm font-medium text-gray-900">
              Tell us more about your experience *
            </label>
            <Textarea
              id="reviewText"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="What did you like about the lesson? How did the coach help you improve?"
              rows={5}
              maxLength={1000}
              disabled={submitting}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              {reviewText.length}/1000 characters (minimum 10)
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || rating === 0 || reviewText.trim().length < 10}
              className="bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A] hover:opacity-90"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

