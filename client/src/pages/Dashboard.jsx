import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getThoughts, searchThoughts } from '../api';
import ThoughtCard from '../components/ThoughtCard';
import FilterBar from '../components/FilterBar';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Search, X, Plus, Sparkles } from 'lucide-react';

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [thoughts, setThoughts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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
  const [searchMode, setSearchMode] = useState('filter'); // 'filter' or 'semantic'
  
  // Use ref to track if we're mounting to avoid unnecessary initial load
  const isMountedRef = useRef(false);
  const searchTimeoutRef = useRef(null);

  // Define loadThoughts with useCallback to avoid infinite loops
  const loadThoughts = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Loading thoughts with:', { searchQuery, filters, searchMode });
      
      if (searchQuery.trim()) {
        // Always use semantic/AI search when query exists
        const response = await searchThoughts(searchQuery, filters, 50);
        console.log('Search response:', response);
        setThoughts(response.results || []);
        
        // Display AI-detected filters if available
        if (response.aiFilters && response.aiFilters.length > 0) {
          setAiFilters(response.aiFilters);
        } else {
          setAiFilters([]);
        }
      } else {
        // Filter only - use getThoughts for better performance when no search
        const response = await getThoughts();
        console.log('Get thoughts response:', response);
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
        if (filters.category !== 'all') {
          thoughtsList = thoughtsList.filter(t => 
            t.category === filters.category || 
            t.topicAuto === filters.category || 
            (t.topicUser && t.topicUser.includes(filters.category))
          );
        }
        // Handle date filtering - custom date range takes precedence
        if (filters.from || filters.to) {
          thoughtsList = thoughtsList.filter(t => {
            const thoughtDate = new Date(t.createdAt);
            if (filters.from && filters.to) {
              const fromDate = new Date(filters.from);
              const toDate = new Date(filters.to);
              toDate.setHours(23, 59, 59, 999);
              return thoughtDate >= fromDate && thoughtDate <= toDate;
            } else if (filters.from) {
              const fromDate = new Date(filters.from);
              return thoughtDate >= fromDate;
            } else if (filters.to) {
              const toDate = new Date(filters.to);
              toDate.setHours(23, 59, 59, 999);
              return thoughtDate <= toDate;
            }
            return true;
          });
        } else if (filters.dateRange !== 'all') {
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
        
        console.log('Filtered thoughts:', thoughtsList.length);
        setThoughts(thoughtsList);
        setAiFilters([]);
      }
    } catch (error) {
      console.error('Error loading thoughts:', error);
      setThoughts([]);
      setAiFilters([]);
    } finally {
      setLoading(false);
    }
  }, [filters, searchQuery, searchMode]);

  // Load thoughts on mount and when route changes
  useEffect(() => {
    isMountedRef.current = true;
    loadThoughts();
    return () => {
      isMountedRef.current = false;
    };
  }, [location.pathname]); // Only depend on pathname for initial load

  // Reload when filters change
  useEffect(() => {
    if (isMountedRef.current) {
      loadThoughts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, searchMode]); // Exclude loadThoughts to avoid infinite loop

  // Debounced search - reload when searchQuery changes (with debounce)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        loadThoughts();
      }
    }, 300); // 300ms debounce for search

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]); // Exclude loadThoughts to avoid infinite loop

  // Refresh thoughts when window gains focus (user returns from upload page)
  useEffect(() => {
    const handleFocus = () => {
      console.log('Window focused, reloading thoughts...');
      loadThoughts();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadThoughts]);

  const uniqueTopics = [...new Set(thoughts.map(t => t.topicAuto).filter(Boolean))];
  const uniqueCategories = [...new Set(thoughts.map(t => t.category).filter(Boolean))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-8"
        >
          <div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent">
              Your Thoughts
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2 flex items-center gap-2">
              <span>{thoughts.length} thought{thoughts.length !== 1 ? 's' : ''}</span>
              {aiFilters && aiFilters.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Filtered
                </Badge>
              )}
            </p>
          </div>
          <Button
            onClick={() => navigate('/upload')}
            className="bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Upload Thought
          </Button>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Card className="backdrop-blur-md bg-white/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
            <CardContent className="p-4">
              <div className="flex gap-3 items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search your thoughts like you think... (e.g., 'AI articles from last month', 'products under ₹1000')"
                    className="pl-10 pr-10 bg-white/50 dark:bg-gray-700/50 border-gray-300/50 dark:border-gray-600/50"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                AI-powered search understands natural language and automatically detects filters
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* AI-Detected Filters */}
        <AnimatePresence>
          {aiFilters && aiFilters.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              <Card className="backdrop-blur-md bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Filters Detected:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {aiFilters.map((filter, index) => (
                      <Badge key={index} variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        {filter}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          onFilterChange={setFilters}
          uniqueTopics={uniqueTopics}
          uniqueCategories={uniqueCategories}
        />

        {/* Thoughts Grid */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading thoughts...</p>
            </motion.div>
          ) : thoughts.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center py-12"
            >
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                {searchQuery || Object.values(filters).some(f => f !== 'all' && f !== null)
                  ? 'No thoughts found matching your search.'
                  : 'No thoughts found. Start capturing your ideas!'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {thoughts.map((thought, index) => (
                <motion.div
                  key={thought._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  layout
                >
                  <ThoughtCard thought={thought} onUpdate={loadThoughts} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

export default Dashboard;