import React, { useState, useEffect } from 'react';
import { Star, Filter, Users, TrendingUp, CheckCircle, Clock, BarChart3, AlertTriangle, Calendar, Search, Download, ExternalLink } from 'lucide-react';

const FlexLivingDashboard = () => {
  const [reviews, setReviews] = useState([]);
  const [filteredReviews, setFilteredReviews] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filters, setFilters] = useState({
    property: '',
    rating: '',
    status: '',
    date: '',
    sortBy: 'date-desc',
    channel: ''
  });

  // API integration - fetches from your backend
  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/reviews/hostaway');
      const data = await response.json();

      if (data.success) {
        setReviews(data.data);
        setFilteredReviews(data.data);
      } else {
        console.error('Failed to fetch reviews:', data.error);
      }
    } catch (error) {
      console.error('Network error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  useEffect(() => {
    let filtered = reviews.filter(review => {
      let include = true;

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        include = include && (
          review.guestName.toLowerCase().includes(searchLower) ||
          review.publicReview.toLowerCase().includes(searchLower) ||
          review.listingName.toLowerCase().includes(searchLower)
        );
      }

      // Existing filters
      if (filters.property && review.listingName !== filters.property) include = false;
      if (filters.rating && (review.rating || 0) < parseInt(filters.rating)) include = false;
      if (filters.status === 'approved' && !review.approved) include = false;
      if (filters.status === 'pending' && review.approved) include = false;
      if (filters.channel && review.channel !== filters.channel) include = false;
      
      // Date range filter
      if (dateRange.start && new Date(review.submittedAt) < new Date(dateRange.start)) include = false;
      if (dateRange.end && new Date(review.submittedAt) > new Date(dateRange.end)) include = false;

      return include;
    });

    // Sorting
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'date-asc':
          return new Date(a.submittedAt) - new Date(b.submittedAt);
        case 'date-desc':
          return new Date(b.submittedAt) - new Date(a.submittedAt);
        case 'rating-asc':
          return (a.rating || 0) - (b.rating || 0);
        case 'rating-desc':
          return (b.rating || 0) - (a.rating || 0);
        default:
          return new Date(b.submittedAt) - new Date(a.submittedAt);
      }
    });

    setFilteredReviews(filtered);
  }, [reviews, filters, searchTerm, dateRange]);

  const toggleApproval = async (reviewId, approved) => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}/approval`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ approved }),
      });

      if (response.ok) {
        setReviews(prev =>
          prev.map(review =>
            review.id === reviewId ? { ...review, approved } : review
          )
        );
      }
    } catch (error) {
      console.error('Failed to update approval status:', error);
    }
  };

  const generateStars = (rating) => {
    //This ensures the rating is a valid number between 0 and 10
    const safeRating = Math.max(0, Math.min(10, rating || 0))
    const fullStars = Math.floor(safeRating / 2);
    const halfStar = (safeRating % 2) >= 1;
    const emptyStars = Math.max(0, 5 - fullStars - (halfStar ? 1 : 0));

    return (
      <div className="flex items-center gap-1">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        ))}
        {halfStar && <Star className="w-4 h-4 fill-yellow-400/50 text-yellow-400" />}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className="w-4 h-4 text-gray-300" />
        ))}
      </div>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCategoryName = (category) => {
    return category.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getStats = () => {
    const total = filteredReviews.length;
    const avgRating = total > 0
      ? (filteredReviews.reduce((sum, review) => sum + (review.rating || 0), 0) / total).toFixed(1)
      : '0.0';
    const approved = filteredReviews.filter(review => review.approved).length;
    const pending = total - approved;

    return { total, avgRating, approved, pending };
  };

  const getAnalytics = () => {
    const byProperty = {};
    const byChannel = {};
    const lowRatedReviews = reviews.filter(r => r.rating < 8).length;

    reviews.forEach(review => {
      // By property
      if (!byProperty[review.listingName]) {
        byProperty[review.listingName] = { count: 0, totalRating: 0, approved: 0 };
      }
      byProperty[review.listingName].count++;
      byProperty[review.listingName].totalRating += review.rating;
      if (review.approved) byProperty[review.listingName].approved++;

      // By channel
      if (!byChannel[review.channel]) {
        byChannel[review.channel] = { count: 0, totalRating: 0 };
      }
      byChannel[review.channel].count++;
      byChannel[review.channel].totalRating += review.rating;
    });

    return { byProperty, byChannel, lowRatedReviews };
  };

  const exportReviews = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Property,Guest,Rating,Review,Date,Channel,Status\n" +
      filteredReviews.map(r => 
        `"${r.listingName}","${r.guestName}",${r.rating},"${r.publicReview.replace(/"/g, '""')}","${r.submittedAt}","${r.channel}","${r.approved ? 'Approved' : 'Pending'}"`
      ).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "reviews_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = getStats();
  const analytics = getAnalytics();
  const properties = [...new Set(reviews.map(review => review.listingName))];
  const channels = [...new Set(reviews.map(review => review.channel))];
  const approvedReviews = reviews.filter(review => review.approved);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-8 text-white mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2">Flex Living Reviews Dashboard</h1>
              <p className="text-xl opacity-90">Manage and monitor guest reviews across all properties</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-75">Last updated</p>
              <p className="text-lg font-semibold">{new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-8 w-fit">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-3 rounded-md font-medium transition-all ${activeTab === 'dashboard'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-gray-600 hover:text-indigo-600'
              }`}
          >
            Manager Dashboard
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-3 rounded-md font-medium transition-all ${activeTab === 'analytics'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-gray-600 hover:text-indigo-600'
              }`}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('property')}
            className={`px-6 py-3 rounded-md font-medium transition-all ${activeTab === 'property'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-gray-600 hover:text-indigo-600'
              }`}
          >
            Property Display
          </button>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-r from-pink-500 to-red-500 p-6 rounded-xl text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold">{stats.total}</p>
                    <p className="opacity-90">Total Reviews</p>
                  </div>
                  <Users className="w-8 h-8 opacity-80" />
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-6 rounded-xl text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold">{stats.avgRating}</p>
                    <p className="opacity-90">Average Rating</p>
                  </div>
                  <TrendingUp className="w-8 h-8 opacity-80" />
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-6 rounded-xl text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold">{stats.approved}</p>
                    <p className="opacity-90">Approved Reviews</p>
                  </div>
                  <CheckCircle className="w-8 h-8 opacity-80" />
                </div>
              </div>

              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-6 rounded-xl text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold">{stats.pending}</p>
                    <p className="opacity-90">Pending Approval</p>
                  </div>
                  <Clock className="w-8 h-8 opacity-80" />
                </div>
              </div>
            </div>

            {/* Search and Export */}
            <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                <div className="flex gap-4 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search reviews, guests, or properties..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className="px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
                <button
                  onClick={exportReviews}
                  className="flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Filters and Reviews */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Sidebar Filters */}
              <div className="bg-white rounded-xl p-6 shadow-sm h-fit">
                <div className="flex items-center gap-2 mb-6">
                  <Filter className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-semibold text-gray-900">Filters</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Property</label>
                    <select
                      value={filters.property}
                      onChange={(e) => setFilters(prev => ({ ...prev, property: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">All Properties</option>
                      {properties.map(property => (
                        <option key={property} value={property}>{property}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
                    <select
                      value={filters.channel}
                      onChange={(e) => setFilters(prev => ({ ...prev, channel: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">All Channels</option>
                      {channels.map(channel => (
                        <option key={channel} value={channel}>{channel}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">All Status</option>
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Min Rating</label>
                    <select
                      value={filters.rating}
                      onChange={(e) => setFilters(prev => ({ ...prev, rating: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Any Rating</option>
                      <option value="9">9+ Stars</option>
                      <option value="8">8+ Stars</option>
                      <option value="7">7+ Stars</option>
                      <option value="6">6+ Stars</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                    <select
                      value={filters.sortBy}
                      onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="date-desc">Newest First</option>
                      <option value="date-asc">Oldest First</option>
                      <option value="rating-desc">Highest Rating</option>
                      <option value="rating-asc">Lowest Rating</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Reviews List */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  {filteredReviews.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      No reviews found matching your filters
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {filteredReviews.map(review => (
                        <div
                          key={review.id}
                          className={`border-2 rounded-xl p-6 transition-all hover:shadow-md ${review.approved
                            ? 'border-green-200 bg-green-50'
                            : review.rating < 8
                            ? 'border-orange-200 bg-orange-50'
                            : 'border-gray-200 bg-gray-50 hover:border-indigo-300'
                            }`}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-semibold text-gray-900">{review.guestName}</h4>
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  {review.channel}
                                </span>
                                {review.rating < 8 && (
                                  <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Needs Attention
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{review.listingName}</p>
                              <p className="text-xs text-gray-500">{formatDate(review.submittedAt)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {generateStars(review.rating || 0)}
                              <span className="font-medium">{(review.rating || 0).toFixed(1)}</span>
                            </div>
                          </div>

                          {review.reviewCategory?.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                              {review.reviewCategory.map(cat => (
                                <span
                                  key={cat.category}
                                  className={`px-3 py-1 text-xs rounded-full ${
                                    cat.rating >= 9 
                                      ? 'bg-green-100 text-green-800'
                                      : cat.rating >= 7
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-orange-100 text-orange-800'
                                  }`}
                                >
                                  {formatCategoryName(cat.category)}: {cat.rating}/10
                                </span>
                              ))}
                            </div>
                          )}
                          
                          <p className="text-gray-700 mb-4 leading-relaxed">{review.publicReview}</p>

                          <div className="flex justify-end gap-2">
                            {review.approved ? (
                              <button
                                onClick={() => toggleApproval(review.id, false)}
                                className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium flex items-center gap-2 hover:bg-green-200 transition-colors"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Approved
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => toggleApproval(review.id, true)}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => toggleApproval(review.id, false)}
                                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                                >
                                  Hide
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div>
            {/* Performance by Property */}
            <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                Performance by Property
              </h3>
              <div className="space-y-4">
                {Object.entries(analytics.byProperty).map(([property, data]) => (
                  <div key={property} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">{property}</h4>
                      <span className="text-lg font-bold text-indigo-600">
                        {(data.totalRating / data.count).toFixed(1)} ⭐
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Total Reviews:</span>
                        <span className="font-medium ml-2">{data.count}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Approved:</span>
                        <span className="font-medium ml-2">{data.approved}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Approval Rate:</span>
                        <span className="font-medium ml-2">
                          {((data.approved / data.count) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Channel Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-xl font-semibold mb-6">Channel Performance</h3>
                <div className="space-y-4">
                  {Object.entries(analytics.byChannel).map(([channel, data]) => (
                    <div key={channel} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-medium capitalize">{channel}</h4>
                        <p className="text-sm text-gray-600">{data.count} reviews</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{(data.totalRating / data.count).toFixed(1)}</p>
                        <p className="text-xs text-gray-600">avg rating</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Items */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  Action Items
                </h3>
                <div className="space-y-3">
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="font-medium text-orange-800">Low-Rated Reviews</p>
                    <p className="text-sm text-orange-600">
                      {analytics.lowRatedReviews} reviews below 8.0 stars need attention
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="font-medium text-blue-800">Pending Approvals</p>
                    <p className="text-sm text-blue-600">
                      {stats.pending} reviews awaiting approval
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="font-medium text-green-800">Response Rate</p>
                    <p className="text-sm text-green-600">
                      {((stats.approved / stats.total) * 100).toFixed(0)}% of reviews are approved
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Google Reviews Integration Status */}
            <div className="bg-white rounded-xl p-6 shadow-sm mt-8">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-blue-600" />
                Google Reviews Integration
              </h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium text-blue-900">Integration Status: Available</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Google Reviews can be integrated using the Places API. This would require:
                    </p>
                    <ul className="text-sm text-blue-700 mt-2 space-y-1 ml-4">
                      <li>• Google Places API key with Places Details enabled</li>
                      <li>• Property place IDs for each listing</li>
                      <li>• Rate limiting consideration (daily quotas)</li>
                      <li>• Real-time sync or scheduled batch processing</li>
                    </ul>
                    <button className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                      Configure Google Integration
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Property Display Tab */}
        {activeTab === 'property' && (
          <div className="max-w-4xl mx-auto">
            {/* Property Hero Section */}
            <div className="bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl p-12 text-white text-center mb-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-black opacity-20"></div>
              <div className="relative z-10">
                <h1 className="text-4xl font-bold mb-4">Shoreditch Heights Apartment</h1>
                <p className="text-xl opacity-90 mb-6">Modern 2-bedroom apartment in the heart of London</p>
                <div className="flex justify-center items-center gap-6 text-lg">
                  <div className="flex items-center gap-2">
                    {generateStars(stats.avgRating * 2)}
                    <span className="font-semibold">{stats.avgRating} ({approvedReviews.length} reviews)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Property Features */}
            <div className="bg-white rounded-xl p-8 shadow-sm mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div className="p-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Users className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Sleeps 4</h3>
                  <p className="text-gray-600">2 bedrooms, 1 bathroom</p>
                </div>
                <div className="p-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Top Rated</h3>
                  <p className="text-gray-600">Highly rated by guests</p>
                </div>
                <div className="p-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Prime Location</h3>
                  <p className="text-gray-600">Shoreditch, London</p>
                </div>
              </div>
            </div>

            {/* Guest Reviews Section */}
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-semibold text-gray-900">Guest Reviews</h2>
                <div className="text-right">
                  <div className="flex items-center gap-2 mb-1">
                    {generateStars(parseFloat(stats.avgRating) * 2)}
                    <span className="text-2xl font-bold text-gray-900">{stats.avgRating}</span>
                  </div>
                  <p className="text-sm text-gray-600">{approvedReviews.length} verified reviews</p>
                </div>
              </div>

              {/* Review Categories Summary */}
              {approvedReviews.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-6 bg-gray-50 rounded-lg">
                  {['cleanliness', 'location', 'amenities', 'hospitality'].map(category => {
                    const categoryReviews = approvedReviews.filter(r => 
                      r.reviewCategory?.some(c => c.category === category)
                    );
                    const avgScore = categoryReviews.length > 0
                      ? (categoryReviews.reduce((sum, r) => {
                          const catData = r.reviewCategory.find(c => c.category === category);
                          return sum + (catData?.rating || 0);
                        }, 0) / categoryReviews.length).toFixed(1)
                      : '0.0';

                    return (
                      <div key={category} className="text-center">
                        <p className="font-semibold text-gray-900 text-lg">{avgScore}</p>
                        <p className="text-sm text-gray-600 capitalize">{formatCategoryName(category)}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {approvedReviews.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No reviews yet</h3>
                  <p>Be the first to share your experience!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {approvedReviews
                    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
                    .map(review => (
                    <div key={review.id} className="border-l-4 border-indigo-500 bg-gray-50 p-6 rounded-r-xl hover:bg-gray-100 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-semibold text-gray-900 text-lg">{review.guestName}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1">
                              {generateStars(review.rating || 0)}
                            </div>
                            <span className="text-sm text-gray-500">{formatDate(review.submittedAt)}</span>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {review.channel}
                            </span>
                          </div>
                        </div>
                        <span className="text-xl font-bold text-indigo-600">
                          {(review.rating || 0).toFixed(1)}
                        </span>
                      </div>
                      
                      {review.reviewCategory?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {review.reviewCategory.map(cat => (
                            <span
                              key={cat.category}
                              className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full"
                            >
                              {formatCategoryName(cat.category)}: {cat.rating}/10
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <p className="text-gray-700 leading-relaxed text-lg">"{review.publicReview}"</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Call to Action */}
              <div className="mt-8 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to experience Flex Living?</h3>
                  <p className="text-gray-600 mb-4">Join hundreds of satisfied guests who have made unforgettable memories.</p>
                  <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                    Book Your Stay
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlexLivingDashboard;