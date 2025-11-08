import { useState } from 'react';
import { motion } from 'framer-motion';
import { REASON_OPTIONS } from '../api';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { X } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'text', label: '📝 Text' },
  { value: 'link', label: '🔗 Link' },
  { value: 'image', label: '🖼️ Image' },
  { value: 'gif', label: '🎬 GIF' },
  { value: 'voice', label: '🎤 Voice' },
  { value: 'video', label: '🎥 Video' },
  { value: 'product', label: '🛍️ Product' },
  { value: 'note', label: '📄 Note' },
  { value: 'social', label: '👥 Social' },
  { value: 'pdf', label: '📄 PDF' },
  { value: 'doc', label: '📄 Document' }
];

const REASON_FILTER_OPTIONS = [
  { value: 'all', label: 'All Reasons' },
  ...REASON_OPTIONS.map(reason => ({
    value: reason,
    label: reason.charAt(0).toUpperCase() + reason.slice(1)
  }))
];

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' }
];

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'AI', label: 'AI' },
  { value: 'video', label: 'Video' },
  { value: 'product', label: 'Product' },
  { value: 'article', label: 'Article' },
  { value: 'social', label: 'Social' },
  { value: 'note', label: 'Note' },
  { value: 'development', label: 'Development' },
  { value: 'design', label: 'Design' },
  { value: 'education', label: 'Education' },
  { value: 'travel', label: 'Travel' },
  { value: 'general', label: 'General' }
];

function FilterBar({ filters, onFilterChange, uniqueTopics = [], uniqueCategories = [] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);

  // Combine predefined categories with unique categories from thoughts
  const allCategories = [
    ...CATEGORY_OPTIONS,
    ...uniqueCategories
      .filter(cat => !CATEGORY_OPTIONS.find(opt => opt.value === cat))
      .map(cat => ({ value: cat, label: cat }))
  ];

  const handleDateRangeChange = (value) => {
    if (value === 'custom') {
      setShowCustomDateRange(true);
      onFilterChange({ ...filters, dateRange: 'custom' });
    } else {
      setShowCustomDateRange(false);
      onFilterChange({ ...filters, dateRange: value, from: null, to: null });
    }
  };

  const handleClearFilters = () => {
    setShowCustomDateRange(false);
    onFilterChange({
      type: 'all',
      reason: 'all',
      topicAuto: 'all',
      category: 'all',
      dateRange: 'all',
      from: null,
      to: null
    });
  };

  const hasActiveFilters = 
    filters.type !== 'all' ||
    filters.reason !== 'all' ||
    filters.topicAuto !== 'all' ||
    filters.category !== 'all' ||
    filters.dateRange !== 'all' ||
    filters.from ||
    filters.to;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="backdrop-blur-md bg-white/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Filters
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-sm"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${isExpanded ? '' : 'hidden md:grid'}`}>
            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type
              </label>
              <Select
                value={filters.type || 'all'}
                onChange={(e) => onFilterChange({ ...filters, type: e.target.value })}
              >
                {TYPE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Reason Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason
              </label>
              <Select
                value={filters.reason || 'all'}
                onChange={(e) => onFilterChange({ ...filters, reason: e.target.value })}
              >
                {REASON_FILTER_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <Select
                value={filters.category || 'all'}
                onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
              >
                {allCategories.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Topic Filter (Auto-detected) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Topic (Auto)
              </label>
              <Select
                value={filters.topicAuto || 'all'}
                onChange={(e) => onFilterChange({ ...filters, topicAuto: e.target.value })}
              >
                <option value="all">All Topics</option>
                {uniqueTopics.map(topic => (
                  <option key={topic} value={topic}>{topic}</option>
                ))}
              </Select>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date Range
              </label>
              <Select
                value={filters.dateRange || 'all'}
                onChange={(e) => handleDateRangeChange(e.target.value)}
              >
                {DATE_RANGE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Custom Date Range Picker */}
          {(showCustomDateRange || filters.dateRange === 'custom') && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 bg-gray-50/50 dark:bg-gray-700/30 rounded-lg backdrop-blur-sm"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    From Date
                  </label>
                  <Input
                    type="date"
                    value={filters.from || ''}
                    onChange={(e) => onFilterChange({ ...filters, from: e.target.value || null })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    To Date
                  </label>
                  <Input
                    type="date"
                    value={filters.to || ''}
                    onChange={(e) => onFilterChange({ ...filters, to: e.target.value || null })}
                    min={filters.from || undefined}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 flex items-center gap-2"
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                <X className="h-4 w-4 mr-1" />
                Clear all filters
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default FilterBar;