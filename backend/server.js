const express = require('express')
const cors = require('cors')
const axios = require('axios')
const path = require('path');
require('dotenv').config();

const app = express()
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json())
app.use(express.static(path.join(__dirname, 'build')))

// Hostaway API configuration
const HOSTAWAY_CONFIG = {
    baseURL: 'https://api.hostaway.com/v1',
    accountId: process.env.HOSTAWAY_ACCOUNT_ID || '61148',
    apiKey: process.env.HOSTAWAY_API_KEY || 'f94377ebbbb479490bb3ec364649168dc443dda2e4830facaf5de2e74ccc9152'
};

// In memory storage for review approvals (This would use a database in production)

let reviewApprovals = new Map();

// Mock review data for sandbox environment
const mockReviews = [
    {
        id: 7453,
        type: "guest-to-host",
        status: "published",
        rating: null,
        publicReview: "Shane and family are wonderful! Would definitely host again. The property was immaculate and they followed all house rules perfectly. Communication was excellent throughout their stay.",
        reviewCategory: [
            { category: "cleanliness", rating: 9},
            { category: "location", rating: 10},
            { category: "amenities", rating: 9},
            { category: "hospitality", rating: 10}
        ],
        submittedAt: "2024-11-28 16:20:12",
        guestName: "Lisa Rodriguez",
        listingName: "2B N1 A - 29 Shoreditch Heights"
    }
];

// Helper function to calculate overall rating from categories
function calculateOverallRating(categories){
    if (!categories || categories.length === 0) return 7.5;

    const total = categories.reduce((sum, cat) => sum + (cat.rating || 0), 0);
    return Number((total / categories.length).toFixed(1));
}

// Routes

// GET /api/reviews/hostaway - Fetch reviews from Hostaway API
app.get('/api/reviews/hostaway', async (req, res) => {
    try{
        console.log('Fetching reviews from Hostaway API...')

        // first, should try to fetch from HostAway API
        let apiReviews = [];
        try{
            const response = await axios.get(`${HOSTAWAY_CONFIG.baseURL}/reviews`, {
                headers: {
                    'Authorization': `Bearer ${HOSTAWAY_CONFIG.apiKey}`,
                    'X-HOSTAWAY-ACCOUNT-ID': HOSTAWAY_CONFIG.accountId
                },
                params: {
                    limit: req.query.limit || 100,
                    offset: req.query.offset || 0,
                    sortBy: req.query.sortBy || 'submittedAt',
                    sortOrder: req.query.sortOrder || 'desc'
                },
                timeout: 10000
            });

            if (response.data && response.data.result && response.data.result.length > 0){
                apiReviews = response.data.result;
                console.log(`Fetched ${apiReviews.length} reviews from Hostaway API`);
            }
        } catch(apiError){
            console.log('Hostaway API returned no data (expected for sandbox), using mock data')
        }

        // If no API reviews, use the mock data (which is expected for sandbox)
        const reviews = apiReviews.length > 0 ? apiReviews : mockReviews;

        // Normalise the data structure
        const normalizedReviews = reviews.map(review => {
            const reviewId = review.id.toString();
            return {
                id: review.id,
                type: review.type,
                status: review.status,
                rating: review.rating || calculateOverallRating(review.reviewCategory),
                publicReview: review.publicReview,
                reviewCategory: review.reviewCategory || [],
                submittedAt: review.submittedAt,
                guestName: review.guestName,
                listingName: review.listingName,
                approved: reviewApprovals.get(reviewId) || false, // Default to pending approval
                channel: 'hostaway'
            };
        });

        res.json({
            success: true,
            data: normalizedReviews,
            total: normalizedReviews.length,
            source: apiReviews.length > 0 ? 'hostaway_api' : 'mock_data',
            message: apiReviews.length > 0 ? 'Data from Hostaway API' : 'Using mock data (sandbox environment)'
        });
    } catch (error){
        console.error('API Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch reviews',
            message: error.message
        });
    }
});

// PATCH /api/reviews/:id/approval - Updates the review approval status
app.patch('/api/reviews/:id/approval', async (req, res) => {
    try{
        const reviewId = req.params.id;
        const { approved } = req.body;

        if (typeof approved !== 'boolean'){
            return res.status(400).json({
                success: false,
                error: 'Invalid approval status. Must be boolean.'
            })
        }

        // Store approval status (in production this would also be saved in a database)
        reviewApprovals.set(reviewId, approved);

        console.log(`Review ${reviewId} ${approved ? 'approved' : 'hidden'}`);

        res.json({
            success: true,
            message: `Review ${approved ? 'approved' : 'hidden'} successfully`,
            reviewId,
            approved
        });
    } catch (error){
        console.error('Approval update error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to update approval status',
            message: error.message
        });
    }
});

// GET /api/reviews/statistics - Get aggregated review statistics
app.get('/api/reviews/statistics', async (req, res) => {
    try{
        // This would typically fetch from database,uses mock data for this demo
        const reviews = mockReviews.map(review => ({
            ...review,
            rating: review.rating || calculateOverallRating(review.reviewCategory),
            approved: reviewApprovals.get(review.id.toString()) || false
        }));

        const totalReviews = reviews.length;
        const averageRating = reviews.length > 0
            ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
            : 0;
        const approvedCount = reviews.filter(review => review.approved).length;
        const pendingCount = totalReviews - approvedCount;

        // property specific stats
        const propertyStats = {};
        reviews.forEach(review => {
            if(!propertyStats[review.listingName]){
                propertyStats[review.listingName] = {
                    total: 0,
                    approved: 0,
                    averageRating: 0,
                    totalRating: 0
                };
            }
            propertyStats[review.listingName].total++;
            propertyStats[review.listingName].totalRating += review.rating;
            if (review.approved) {
                propertyStats[review.listingName].approved++;
            }
        });

        // Calculate average ratings per property
        Object.keys(propertyStats).forEach(property => {
            propertyStats[property].averageRating = 
                (propertyStats[property].totalRating / propertyStats[property].total).toFixed(1);
        });

        res.json({
            success: true,
            data: {
                overall: {
                    totalReviews,
                    averageRating: parseFloat(averageRating),
                    approvedCount,
                    pendingCount,
                    approvalRate: totalReviews > 0 ? ((approvedCount / totalReviews) * 100).toFixed(1) : 0
                },
                byProperty: propertyStats,
                recentActivity: reviews
                .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
                .slice(0, 5)
                .map(review => ({
                    id: review.id,
                    guestName: review.guestName,
                    listingName: review.listingName,
                    rating: review.rating,
                    submittedAt: review.submittedAt,
                    approved: review.approved
                }))
            }
        });
    } catch (error){
        console.error('Statistics error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics',
            message: error.message
        });
    }
});

// GET /api/reviews/property/:listingId - Get reviews for specific property
app.get('/api/reviews/property/:listingId', async (req, res) => {
    try{
        const {listingId} = req.params;
        const {approved_only } = req.query;

        // In production once againe this would query the database by listing the ID
        let reviews = mockReviews
            .filter(review => review.listingName.includes(listingId) || review.id.toString() === listingId)
            .map(review => ({
                ...review,
                rating: review.rating || calculateOverallRating(review.reviewCategory),
                approved: reviewApprovals.get(review.id.toString()) || false
            }));

            // Filter to approved only if requested
            if (approved_only === 'true'){
                reviews = reviews.filter(review => review.approved);
            }

            res.json({
                success: true,
                data: reviews,
                total: reviews.length,
                listingId
            });
    } catch (error){
        console.error('Property reviews error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch property reviews',
            message: error.message
        });
    }
});

// Health Check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Flex Living Reviews API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Serve React app for all other routes (this is used in production)
app.get('*', (req, res) => {
    const buildPath = path.join(__dirname, 'build', 'index.html');
    if (require('fs').existsSync(buildPath)) {
        res.sendFile(buildPath)
    } else {
        // In development, it should just send a simple response or it will let React dev server handle it
        res.status(404).send('This route is handled by React in development mode')
    }

});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Flex Living Reviews API running on port ${PORT}`)
    console.log(`Dashboard is available at http://localhost:${PORT}`)
    console.log(`API endpoints:`)
    console.log(`  GET /api/reviews/hostaway`)
    console.log(`  PATCH /api/reviews/:id/approval`)
    console.log(`  GET /api/reviews/statistics`)
    console.log(`  GET /api/reviews/property/:listingId`)
    console.log(`  GET /api/health`)
});

module.exports = app;