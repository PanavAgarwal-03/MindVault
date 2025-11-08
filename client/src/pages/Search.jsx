import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { searchThoughts, getThoughts } from '../api';
import ThoughtCard from '../components/ThoughtCard';
import FilterBar from '../components/FilterBar';

function Search() {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiFilters, setAiFilters] = useState([]);
  const [filters, setFilters] = useState({
    type: 'all',
    reason: 'all',
    topicAuto: 'all',
    category: 'all',
    dateRange: 'all',
    from: null,
    to: null
  });
  const [searchMode, setSearchMode] = useState('semantic');
  const searchTimeoutRef = useRef(null);
  const isMountedRef = useRef(false);

  // Perform search function
  const performSearch = async (searchQuery = query) => {
    try {
      setLoading(true);
      console.log('Searching with:', { query: searchQuery, filters, searchMode });

      if (searchQuery.trim()) {
        // Perform search - always use semantic/AI mode
        const response = await searchThoughts(searchQuery, filters, 50);
        console.log('Search response:', response);
        setResults(response.results || []);
        
        // Display AI-detected filters if available
        if (response.aiFilters && response.aiFilters.length > 0) {
          setAiFilters(response.aiFilters);
        } else {
          setAiFilters([]);
        }
      } else {
        // No query - show all thoughts with filters
        const response = await getThoughts();
        let thoughtsList = response.thoughts || [];

        // Apply filters
        if (filters.type !== 'all') {
          thoughtsList = thoughtsList.filter(t => {
            const thoughtType = t.type || t.contentType;
            return thoughtType === filters.type;
          });
        }
        if (filters.reason !== 'all') {
          thoughtsList = thoughtsList.filter(t => t.reason === filters.reason);
        }
        if (filters.topicAuto !== 'all') {
          thoughtsList = thoughtsList.filter(t => t.topicAuto === filters.topicAuto);
        }
        if (filters.dateRange !== 'all') {
          const now = new Date();
          thoughtsList = thoughtsList.filter(t => {
            const thoughtDate = new Date(t.createdAt);
            const daysDiff = (now - thoughtDate) / (1000 * 60 * 60 * 24);
            if (filters.dateRange === 'today') return daysDiff <= 1;
            if (filters.dateRange === 'week') return daysDiff <= 7;
            if (filters.dateRange === 'month') return daysDiff <= 30;
            if (filters.dateRange === 'year') return daysDiff <= 365;
            return true;
          });
        }

        setResults(thoughtsList);
        setAiFilters([]);
      }
    } catch (error) {
      console.error('Error searching:', error);
      setResults([]);
      setAiFilters([]);
    } finally {
      setLoading(false);
    }
  };

  // Load on mount
  useEffect(() => {
    isMountedRef.current = true;
    performSearch();
    return () => {
      isMountedRef.current = false;
    };
  }, [location.pathname]);

  // Debounced search when query changes
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        performSearch();
      }
    }, 300); // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  // Re-search when filters or search mode change
  useEffect(() => {
    if (isMountedRef.current) {
      performSearch();
    }
  }, [filters, searchMode]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) {
      // If no query, just reload with filters
      performSearch('');
      return;
    }
    performSearch();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Search Your Memory
        </h2>

        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your thoughts... (e.g., 'AI articles from last month', 'products under ₹1000')"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary px-6"
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            🤖 AI-powered search understands natural language queries and automatically detects filters
          </p>
        </form>

        {/* AI-Detected Filters */}
        {aiFilters.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              🤖 Filters Detected:
            </p>
            <div className="flex flex-wrap gap-2">
              {aiFilters.map((filter, index) => (
                <span
                  key={index}
                  className="inline-block px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                >
                  {filter}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          onFilterChange={setFilters}
          uniqueTopics={[...new Set(results.map(r => r.topicAuto).filter(Boolean))]}
          uniqueCategories={[...new Set(results.map(r => r.category).filter(Boolean))]}
        />

        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Searching...</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Found {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((thought, index) => (
                <motion.div
                  key={thought._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <ThoughtCard thought={thought} onUpdate={performSearch} />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              No results found for "{query}"
            </p>
          </div>
        )}

        {!loading && !query && results.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Enter a search query or adjust filters to see results
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Search;