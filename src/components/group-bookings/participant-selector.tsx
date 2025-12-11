'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { searchUsersByUsername } from '@/actions/group-bookings/search-users';
import { X, Search, Loader2 } from 'lucide-react';

interface ParticipantSelectorProps {
  selectedUsernames: string[];
  onAdd: (username: string) => void;
  onRemove: (username: string) => void;
  maxParticipants?: number;
}

export function ParticipantSelector({
  selectedUsernames,
  onAdd,
  onRemove,
  maxParticipants = 20,
}: ParticipantSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ username: string; name: string; image: string | null }>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      const result = await searchUsersByUsername(searchQuery);
      setSearching(false);

      if (result.success && result.users) {
        setSearchResults(
          result.users.filter(u => !selectedUsernames.includes(u.username))
        );
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedUsernames]);

  const canAddMore = selectedUsernames.length < maxParticipants - 1; // -1 for organizer

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by @username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={!canAddMore}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent disabled:bg-gray-50"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>

      {searchResults.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y max-h-48 overflow-y-auto">
          {searchResults.map((user) => (
            <button
              key={user.username}
              type="button"
              onClick={() => {
                onAdd(user.username);
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                {user.image ? (
                  <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-medium text-gray-600">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <div className="font-medium text-gray-900">{user.name}</div>
                <div className="text-sm text-gray-500">@{user.username}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedUsernames.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selected Participants ({selectedUsernames.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {selectedUsernames.map((username) => (
              <div
                key={username}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#FF6B4A] text-white rounded-full text-sm"
              >
                <span>@{username}</span>
                <button
                  type="button"
                  onClick={() => onRemove(username)}
                  className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!canAddMore && (
        <p className="text-sm text-gray-500">
          Maximum participants reached
        </p>
      )}
    </div>
  );
}

