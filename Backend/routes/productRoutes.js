const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, authorize('seller'), [
    check('name', 'Product name is required').not().isEmpty(),
    check('description', 'Product description is required').not().isEmpty(),
    check('price', 'Product price is required and must be a number').isFloat({ min: 0 }),
    check('category', 'Product category is required').not().isEmpty(),
    check('stock', 'Stock quantity is required and must be a non-negative integer').isInt({ min: 0 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation errors', errors: errors.array().map(err => err.msg) });
    }
    console.log(req.body)
    const { name, description, price, category, stock, imageUrl } = req.body;

    try {
        const sellerId = req.user.id;

        const seller = await Seller.findById(sellerId);
        if (!seller || !seller.isApproved) {
            return res.status(403).json({ message: 'Forbidden: Only approved sellers can add products.' });
        }

        const newProduct = new Product({
            name,
            description,
            price,
            category,
            stock,
            imageUrl,
            seller: sellerId, 
            isAvailable: stock > 0 
        });

        await newProduct.save();

        res.status(201).json({ message: 'Product added successfully', product: newProduct });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error when adding product');
    }
});

router.get('/', async (req, res) => {
    try {
        const products = await Product.find().populate('seller', 'shopName email mobileNumber');
        res.json(products);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error when fetching products');
    }
});

router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('seller', 'shopName email mobileNumber');

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Product ID' });
        }
        res.status(500).send('Server error when fetching product');
    }
});

router.get('/seller/:sellerId', protect, authorize(['admin', 'seller']), async (req, res) => {
    try {
        const requestedSellerId = req.params.sellerId;
        const loggedInUserId = req.user.id;
        const loggedInUserRole = req.user.role;

        if (loggedInUserRole !== 'admin' && requestedSellerId !== loggedInUserId) {
            return res.status(403).json({ message: 'Forbidden: You can only view your own products or you are not an admin.' });
        }

        const products = await Product.find({ seller: requestedSellerId }).populate('seller', 'shopName email mobileNumber');
        res.json(products);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Seller ID' });
        }
        res.status(500).send('Server error when fetching seller products');
    }
});


router.put('/:id', protect, authorize(['seller', 'admin']), [
    check('name', 'Product name is required').optional().not().isEmpty(),
    check('price', 'Product price must be a number').optional().isFloat({ min: 0 }),
    // ... other validation rules
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation errors', errors: errors.array().map(err => err.msg) });
    }

    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (req.user.role !== 'admin' && product.seller.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Forbidden: You are not authorized to update this product.' });
        }

        Object.keys(req.body).forEach(key => {
            if (productSchema.paths[key] && key !== 'seller' && key !== 'createdAt' && key !== 'updatedAt') {
                product[key] = req.body[key];
            }
        });

        if (req.body.stock !== undefined) {
            product.isAvailable = product.stock > 0;
        }

        await product.save();
        res.json({ message: 'Product updated successfully', product });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Product ID' });
        }
        res.status(500).send('Server error when updating product');
    }
});

router.delete('/:id', protect, authorize(['seller', 'admin']), async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (req.user.role !== 'admin' && product.seller.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Forbidden: You are not authorized to delete this product.' });
        }

        await product.deleteOne(); 
        res.json({ message: 'Product deleted successfully' });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Product ID' });
        }
        res.status(500).send('Server error when deleting product');
    }
});


module.exports = router;