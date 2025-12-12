import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  baseUrl: string;
  className?: string;
}

export function Pagination({ pagination, baseUrl, className }: PaginationProps) {
  const { page, pages, hasNext, hasPrev } = pagination;

  if (pages <= 1) return null;

  const createPageUrl = (pageNum: number) => {
    const url = new URL(baseUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    url.searchParams.set('page', pageNum.toString());
    return url.pathname + url.search;
  };

  const pageNumbers = [];
  const showPages = 5;
  const halfShow = Math.floor(showPages / 2);

  let startPage = Math.max(1, page - halfShow);
  const endPage = Math.min(pages, startPage + showPages - 1);

  if (endPage - startPage + 1 < showPages) {
    startPage = Math.max(1, endPage - showPages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className={cn('flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6', className)}>
      <div className="flex justify-between flex-1 sm:hidden">
        {hasPrev && (
          <Link
            href={createPageUrl(page - 1)}
            className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Previous
          </Link>
        )}
        {hasNext && (
          <Link
            href={createPageUrl(page + 1)}
            className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Next
          </Link>
        )}
      </div>

      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing page <span className="font-medium">{page}</span> of{' '}
            <span className="font-medium">{pages}</span> ({pagination.total} total items)
          </p>
        </div>

        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            {hasPrev && (
              <Link
                href={createPageUrl(page - 1)}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                <span className="sr-only">Previous</span>
                <ChevronLeft className="h-5 w-5" />
              </Link>
            )}

            {pageNumbers.map((pageNum) => (
              <Link
                key={pageNum}
                href={createPageUrl(pageNum)}
                className={cn(
                  'relative inline-flex items-center px-4 py-2 border text-sm font-medium',
                  pageNum === page
                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                )}
              >
                {pageNum}
              </Link>
            ))}

            {hasNext && (
              <Link
                href={createPageUrl(page + 1)}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                <span className="sr-only">Next</span>
                <ChevronRight className="h-5 w-5" />
              </Link>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
}
