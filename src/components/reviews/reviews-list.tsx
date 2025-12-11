import Image from 'next/image';
import { Star } from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  reviewText: string | null;
  createdAt: Date;
  reviewer: {
    name: string;
    image: string | null;
  };
}

interface ReviewsListProps {
  reviews: Review[];
  coachName: string;
}

export function ReviewsList({ reviews, coachName }: ReviewsListProps) {
  if (reviews.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <Star className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">No reviews yet</p>
        <p className="text-sm text-gray-500 mt-1">
          Be the first to book with {coachName} and leave a review!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reviews.map((review) => (
        <div
          key={review.id}
          className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-start gap-4 mb-4">
            <div className="relative h-12 w-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
              {review.reviewer.image ? (
                <Image
                  src={review.reviewer.image}
                  alt={review.reviewer.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full w-full bg-gradient-to-br from-[#FF6B4A] to-[#FF8C5A] text-white font-semibold text-lg">
                  {review.reviewer.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900">{review.reviewer.name}</h4>
                <span className="text-sm text-gray-500">
                  {new Date(review.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${
                      star <= review.rating
                        ? 'fill-[#FF6B4A] text-[#FF6B4A]'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
                <span className="text-sm font-medium text-gray-700 ml-2">
                  {review.rating}.0
                </span>
              </div>
            </div>
          </div>

          {review.reviewText && (
            <p className="text-gray-700 leading-relaxed">{review.reviewText}</p>
          )}
        </div>
      ))}
    </div>
  );
}

