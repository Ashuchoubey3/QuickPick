const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer'); 
const Seller = require('../models/Seller');     
const Admin = require('../models/Admin');
require('dotenv').config();

router.post('/register', [
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 5 characters').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation errors', errors: errors.array().map(err => err.msg) });
    }

    const { firstName, lastName, email, password } = req.body;

    try {
        let existingCustomer = await Customer.findOne({ email });
        if (existingCustomer) {
            return res.status(400).json({ message: 'An account with this email already exists (as a buyer).' });
        }

        let existingSeller = await Seller.findOne({ email });
        if (existingSeller) {
            return res.status(400).json({ message: 'An account with this email already exists (as a seller). Please use a different email or log in.' });
        }

        const customer = new Customer({
            firstName,
            lastName,
            email,
            password,
            role: 'buyer'
        });

        await customer.save();

        const payload = {
            user: { 
                id: customer.id,
                role: customer.role
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET, // Make sure JWT_SECRET is defined in your .env file
            { expiresIn: '1h' }, // Token expires in 1 hour
            (err, token) => {
                if (err) throw err;
                res.status(201).json({
                    message: 'Buyer registered successfully',
                    token,
                    user: { id: customer.id, firstName: customer.firstName, email: customer.email, role: customer.role }
                });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error during buyer registration');
    }
});

router.post('/seller/register', [
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('mobileNumber', 'Mobile number is required and must be 10 digits').isLength({ min: 10, max: 10 }).isNumeric(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    check('shopName', 'Shop name is required').not().isEmpty(),
    check('shopAddress', 'Shop address is required').not().isEmpty(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation errors', errors: errors.array().map(err => err.msg) });
    }

    const { firstName, lastName, email, mobileNumber, password, shopName, shopAddress, gstNumber } = req.body;

    try {
        let existingUser = await Customer.findOne({ email });
        if (!existingUser) {
            existingUser = await Seller.findOne({ email });
        }
        if (existingUser) {
            return res.status(400).json({ message: 'An account with this email already exists.' });
        }

        let existingSellerMobile = await Seller.findOne({ mobileNumber });
        if (existingSellerMobile) {
            return res.status(400).json({ message: 'A seller account with this mobile number already exists.' });
        }

        let existingShop = await Seller.findOne({ shopName });
        if (existingShop) {
             return res.status(400).json({ message: 'This shop name is already taken. Please choose another.' });
        }

        const seller = new Seller({
            firstName,
            lastName,
            email,
            mobileNumber,
            password,
            shopName,
            shopAddress,
            gstNumber,
            role: 'seller',
            isApproved: false
        });

        await seller.save();

        res.status(201).json({
            message: 'Seller registered successfully. Your account is pending admin approval.',
            seller: { id: seller.id, shopName: seller.shopName, email: seller.email, isApproved: seller.isApproved, role: seller.role }
        });

    } catch (err) {
        console.error(err.message);
        if (err.code === 11000) {
            let field = Object.keys(err.keyPattern)[0];
            let msg = `A record with this ${field} already exists.`;
            if (field === 'email') msg = 'An account with this email already exists.';
            if (field === 'mobileNumber') msg = 'A seller account with this mobile number already exists.';
            if (field === 'shopName') msg = 'This shop name is already taken.';
            if (field === 'gstNumber') msg = 'This GST number is already registered.';
            return res.status(400).json({ message: msg });
        }
        res.status(500).send('Server error during seller registration');
    }
});

router.post('/login', [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation errors', errors: errors.array().map(err => err.msg) });
    }

    const { email, password } = req.body;

    try {
        let user = null;

        user = await Customer.findOne({ email });

        if (!user) {
            user = await Seller.findOne({ email });
        }

        if (!user) { 
            user = await Admin.findOne({ email });
        }

        if (!user) {
            return res.status(400).json({ message: 'Invalid Credentials (email not found).' });
        }

        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid Credentials (password incorrect).' });
        }

        if (user.role === 'seller' && !user.isApproved) {
            return res.status(403).json({ message: 'Your seller account is pending admin approval.' });
        }

        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                res.json({
                    message: 'Login successful',
                    token,
                    user: {
                        id: user.id,
                        email: user.email,
                        role: user.role,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        ...(user.role === 'seller' && { shopName: user.shopName, isApproved: user.isApproved })
                    }
                });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error during login');
    }
});

module.exports = router;